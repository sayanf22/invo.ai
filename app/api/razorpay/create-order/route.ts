import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import {
    createRazorpaySubscription,
    getSubscription,
    getSubscriptionInvoices,
    updateRazorpaySubscriptionPlan,
    getPlanIdForCurrency,
    RazorpayApiError,
    PLANS,
    PLAN_PRICES_BY_CURRENCY,
    resolveSubscriptionCurrency,
    type PlanId,
} from "@/lib/razorpay"
import { getSecret } from "@/lib/secrets"
import { createClient } from "@supabase/supabase-js"

/** Razorpay subscription statuses that permit an in-place Update Subscription call. */
const UPDATABLE_RAZORPAY_STATUSES = new Set(["authenticated", "active"])

/** Plan hierarchy — must match the ordering used in app/api/razorpay/downgrade/route.ts. */
const PLAN_ORDER = ["free", "starter", "pro", "agency"]

/**
 * Razorpay's documented wording (Update a Subscription docs) for the
 * immediate-update proration floor: "You cannot update a Subscription if the
 * difference amount after updating a Subscription (credit or refund) is less
 * than the update quantity multiplied by the smallest currency subunit."
 * Match on the stable "difference amount" + "less than" phrase rather than
 * generic words like "amount"/"minimum" that could false-positive on
 * unrelated errors.
 */
function isBelowMinimumChargeableAmountError(err: unknown): boolean {
    if (!(err instanceof RazorpayApiError)) return false
    const desc = err.description.toLowerCase()
    return desc.includes("difference amount") && desc.includes("less than")
}

export async function POST(request: Request) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { plan, billingCycle } = body as { plan: string; billingCycle: string }

        if (!plan || !["starter", "pro", "agency"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        const cycle = (billingCycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"
        const tier = plan as "starter" | "pro" | "agency"

        // SECURITY: determine the billing currency from the SERVER-side Cloudflare
        // geo header, never from client input. This prevents a user from spoofing a
        // cheaper country to get a lower-priced plan. Falls back to INR when the
        // country is unknown or its currency isn't supported for recurring billing.
        const cfCountry = request.headers.get("cf-ipcountry") || ""
        const currency = resolveSubscriptionCurrency(cfCountry)

        // ── Existing-subscription lookup (upgrade path) ─────────────────────
        // Check whether the caller already has a paid Razorpay subscription
        // before defaulting to creating a brand-new one. Read-own via the
        // authenticated client is already RLS-permitted.
        const { data: currentSubRow } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", auth.user.id)
            .maybeSingle()

        const currentSub = currentSubRow as any
        const existingRazorpaySubscriptionId: string | undefined = currentSub?.razorpay_subscription_id

        if (existingRazorpaySubscriptionId) {
            const liveSubscription = await getSubscription(existingRazorpaySubscriptionId)
            const razorpayStatus = liveSubscription?.status
            // Razorpay's Update Subscription API ONLY works for CARD-authorised
            // subscriptions — "You can only update a Subscription authorised
            // using cards and not via UPI and Emandate" (Razorpay docs). For
            // UPI Autopay / eMandate subscribers, an in-place plan change is
            // impossible; they must re-authorise a new mandate for the higher
            // plan (create-new + cancel-old-after-verify), see task below.
            const paymentMethod = (liveSubscription?.payment_method || "").toLowerCase()
            const canUpdateInPlace = paymentMethod === "card"

            // Only branch into the update path for an ACTUAL UPGRADE (target
            // strictly HIGHER than current in the plan hierarchy) on an
            // updatable-state subscription. A same-plan re-subscribe or a
            // DOWNGRADE routed through this endpoint (instead of the dedicated
            // /downgrade cycle-end flow) must NOT trigger an immediate
            // "now" update here — that would issue an immediate refund/credit
            // note instead of the deferred, no-proration cycle-end behavior
            // /downgrade implements. Both cases fall through unchanged to the
            // existing create-new-subscription + Checkout flow below.
            const { planIdToPlan } = await import("@/lib/razorpay")
            const livePlan = liveSubscription?.plan_id ? planIdToPlan(liveSubscription.plan_id) : null
            const livePeriodEnd = liveSubscription?.current_end ? liveSubscription.current_end * 1000 : 0
            const providerHasPaidPeriod = Boolean(
                livePlan && livePlan !== "free" &&
                razorpayStatus && UPDATABLE_RAZORPAY_STATUSES.has(razorpayStatus) &&
                livePeriodEnd > Date.now(),
            )
            const effectivePlan = providerHasPaidPeriod
                ? livePlan!
                : (() => {
                    if (!currentSub?.plan || !["free", "starter", "pro", "agency"].includes(currentSub.plan)) return "free"
                    if (!currentSub.current_period_end) {
                        return ["active", "trialing"].includes(currentSub.status) ? currentSub.plan : "free"
                    }
                    const end = Date.parse(currentSub.current_period_end)
                    return Number.isFinite(end) && end > Date.now() ? currentSub.plan : "free"
                })()
            const currentIdx = PLAN_ORDER.indexOf(effectivePlan)
            const targetIdx = PLAN_ORDER.indexOf(plan)
            const isUpgrade = currentIdx >= 0 && targetIdx > currentIdx

            // Existing live subscriptions must use the dedicated direction-safe
            // flows. Never create a second mandate for a no-op or downgrade.
            if (effectivePlan !== "free" && targetIdx <= currentIdx) {
                return NextResponse.json(
                    {
                        error: targetIdx === currentIdx
                            ? "You are already on this plan"
                            : "Use the downgrade flow to schedule this change at cycle end",
                        code: targetIdx === currentIdx ? "SAME_PLAN" : "DOWNGRADE_REQUIRED",
                    },
                    { status: 409 },
                )
            }

            // ── UPI/eMandate UPGRADE: re-authorise a new mandate ────────────
            // Razorpay can't update these subscriptions in place, so create a
            // brand-new subscription for the higher plan and let the user
            // authorise it via Checkout. The OLD subscription is cancelled by
            // /verify ONLY after the new one is confirmed active (safe
            // ordering — no double-charge, no access gap). We deliberately do
            // NOT touch the Supabase row or cancel anything here, so if the
            // user abandons Checkout they keep their current (old) plan intact.
            if (
                razorpayStatus &&
                UPDATABLE_RAZORPAY_STATUSES.has(razorpayStatus) &&
                isUpgrade &&
                !canUpdateInPlace
            ) {
                const newSubscription = await createRazorpaySubscription(plan as PlanId, cycle, auth.user.id, currency)
                const amount = (PLAN_PRICES_BY_CURRENCY[currency]?.[tier]?.[cycle])
                    ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]
                const keyId = await getSecret("RAZORPAY_KEY_ID")
                // Standard Checkout response shape — the client opens Razorpay
                // Checkout for re-authorisation exactly like a fresh signup.
                // `reauthorizeUpgrade` is informational (lets the UI show
                // "you'll re-confirm your payment method" copy if desired).
                return NextResponse.json({
                    subscriptionId: newSubscription.id,
                    keyId,
                    plan,
                    billingCycle: cycle,
                    planName: PLANS[plan as PlanId].name,
                    currency,
                    amount,
                    reauthorizeUpgrade: true,
                })
            }

            // ── CARD UPGRADE: seamless in-place proration ──────────────────
            if (
                razorpayStatus &&
                UPDATABLE_RAZORPAY_STATUSES.has(razorpayStatus) &&
                isUpgrade &&
                canUpdateInPlace
            ) {
                const targetPlanId = getPlanIdForCurrency(tier, currentSub.currency || currency, cycle)
                if (!targetPlanId) {
                    return NextResponse.json({ error: "Invalid plan for subscription" }, { status: 400 })
                }

                let belowMinimumCharge = false
                let updatedSubscription: { id: string; status: string; current_start?: number | null; current_end?: number | null }
                try {
                    updatedSubscription = await updateRazorpaySubscriptionPlan(
                        existingRazorpaySubscriptionId,
                        targetPlanId,
                        "now"
                    )
                } catch (updateErr: unknown) {
                    if (isBelowMinimumChargeableAmountError(updateErr)) {
                        // Razorpay rejects the immediate update outright when the
                        // prorated difference is below the smallest currency
                        // subunit floor — per its docs, the plan is NOT changed
                        // in this case (unlike the "already on this plan"
                        // idempotency case in updateRazorpaySubscriptionPlan).
                        // Fall back to a deferred cycle_end update so the plan
                        // change still takes effect (at the next renewal,
                        // matching the downgrade route's behavior) rather than
                        // silently doing nothing.
                        belowMinimumCharge = true
                        updatedSubscription = await updateRazorpaySubscriptionPlan(
                            existingRazorpaySubscriptionId,
                            targetPlanId,
                            "cycle_end"
                        )
                    } else {
                        throw updateErr
                    }
                }

                // The PATCH response may not immediately reflect the new period
                // boundaries — re-fetch if needed to get accurate current_start/end.
                let currentStart = updatedSubscription.current_start
                let currentEnd = updatedSubscription.current_end
                if (currentStart == null || currentEnd == null) {
                    const refetched = await getSubscription(existingRazorpaySubscriptionId)
                    currentStart = refetched?.current_start ?? currentStart
                    currentEnd = refetched?.current_end ?? currentEnd
                }

                const now = new Date()
                const periodStart = currentStart ? new Date(currentStart * 1000) : now
                const periodEnd = currentEnd
                    ? new Date(currentEnd * 1000)
                    : (() => {
                        const d = new Date(now)
                        if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1)
                        else d.setMonth(d.getMonth() + 1)
                        return d
                    })()

                // The FULL new-plan price is NEVER the correct `amount_paid` for
                // an immediate ("now") update — Razorpay prorates and charges
                // only the DIFFERENCE for the remaining days in the cycle (see
                // Update a Subscription docs, "Different/Same Billing Frequency
                // Example" tables). Fetch the actual invoice Razorpay just
                // generated for the REAL charged amount. When the update was
                // deferred to cycle_end (belowMinimumCharge case), there is no
                // new charge yet — amount_paid should stay at the CURRENT
                // (pre-upgrade) amount until the next renewal actually charges
                // the new plan price, exactly like the /downgrade route leaves
                // amount_paid untouched until check_subscription_expiry applies
                // the scheduled change.
                let amountPaid = currentSub.amount_paid ?? null
                let latestInvoice: import("@/lib/razorpay").RazorpaySubscriptionInvoice | null = null
                if (!belowMinimumCharge) {
                    const invoices = await getSubscriptionInvoices(existingRazorpaySubscriptionId, 1)
                    latestInvoice = invoices[0] ?? null
                    if (latestInvoice) amountPaid = latestInvoice.amount_paid
                }

                // Update the Supabase row in place (service-role client, same
                // free-only-RLS reason as /downgrade and /verify).
                const svc = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    { auth: { persistSession: false, autoRefreshToken: false } }
                )
                const subscriptionUpdate: Record<string, unknown> = {
                    billing_cycle: cycle,
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    updated_at: now.toISOString(),
                }
                if (amountPaid != null) subscriptionUpdate.amount_paid = amountPaid
                // If the immediate update was rejected as below-minimum, we fell
                // back to a Razorpay-side `schedule_change_at: "cycle_end"`
                // update — Razorpay itself will flip `plan_id` on the
                // subscription at the next renewal, with NO action needed from
                // us. Do NOT write the new `plan` locally yet (the user isn't
                // being charged for it today); the `subscription.updated`/
                // `subscription.charged` webhook sync (task 7.5) will sync
                // `plan`/`amount_paid` into Supabase once Razorpay actually
                // applies the change at cycle end.
                if (!belowMinimumCharge) {
                    subscriptionUpdate.plan = plan
                }

                const { error: upsertErr } = await svc
                    .from("subscriptions" as any)
                    .update(subscriptionUpdate)
                    .eq("user_id", auth.user.id)

                if (upsertErr) {
                    console.error("[create-order] upgrade row update failed:", upsertErr)
                }

                // Record the REAL prorated charge in payment_history, mirroring
                // the pattern used for every other payment (verify/webhook
                // routes) — without this, the upgrade charge has no invoice
                // record at all. Idempotent on razorpay_payment_id. Skipped
                // when there was no actual charge (belowMinimumCharge, or
                // Razorpay hasn't generated a payment_id on the invoice yet).
                if (!belowMinimumCharge && latestInvoice?.payment_id) {
                    const { data: existingPayment } = await svc
                        .from("payment_history" as any)
                        .select("id")
                        .eq("razorpay_payment_id", latestInvoice.payment_id)
                        .maybeSingle()
                    if (!existingPayment) {
                        await svc.from("payment_history" as any).insert({
                            user_id: auth.user.id,
                            razorpay_payment_id: latestInvoice.payment_id,
                            razorpay_order_id: latestInvoice.order_id,
                            amount: latestInvoice.amount_paid,
                            currency: latestInvoice.currency,
                            status: "captured",
                            plan,
                            billing_cycle: cycle,
                            metadata: { type: "upgrade_proration", from_plan: currentSub.plan, invoice_id: latestInvoice.id },
                        })
                    }
                }

                // Distinct response shape from the Checkout-flow shape — the
                // client (hooks/use-razorpay.ts) detects `upgraded: true` and
                // skips opening Razorpay Checkout, since no new payment
                // details are required for an in-place plan update.
                return NextResponse.json({
                    upgraded: true,
                    plan: belowMinimumCharge ? currentSub.plan : plan,
                    billingCycle: cycle,
                    periodEnd: periodEnd.toISOString(),
                    deferredToNextCycle: belowMinimumCharge,
                })
            }
            // Non-updatable state (created/pending/halted), a downgrade sent to
            // this endpoint, or a no-op re-subscribe: fall through unchanged to
            // the existing create-new-subscription path.
        }

        // ── Free→paid signup / non-updatable-state fallback (unchanged) ─────
        // Create a Razorpay Subscription (recurring) in the resolved currency.
        const subscription = await createRazorpaySubscription(plan as PlanId, cycle, auth.user.id, currency)

        const amount = (PLAN_PRICES_BY_CURRENCY[currency]?.[tier]?.[cycle])
            ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]

        // Use getSecret (checks process.env first, then Cloudflare Worker bindings,
        // then Vault) so the publishable key is returned even when it was set via
        // `wrangler secret put` (bindings live on globalThis, not process.env).
        const keyId = await getSecret("RAZORPAY_KEY_ID")

        return NextResponse.json({
            subscriptionId: subscription.id,
            keyId,
            plan,
            billingCycle: cycle,
            planName: PLANS[plan as PlanId].name,
            currency,
            amount,
        })
    } catch (error: any) {
        console.error("Create subscription error:", error)
        return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 })
    }
}
