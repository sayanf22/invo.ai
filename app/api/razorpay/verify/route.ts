import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { verifyPaymentSignature, PLANS, PLAN_PRICES_BY_CURRENCY, isValidPlanId, getSubscription, planIdToPlan, planIdToCurrency, planIdToCycle, planIdToAmount, type PlanId } from "@/lib/razorpay"
import { logAudit } from "@/lib/audit-log"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

/**
 * POST /api/razorpay/verify
 * Verifies payment signature and activates subscription.
 */
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            plan,
            billingCycle,
        } = body

        if (!razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: "Missing payment details" }, { status: 400 })
        }

        // Need either order_id or subscription_id
        const verifyId = razorpay_subscription_id || razorpay_order_id
        if (!verifyId) {
            return NextResponse.json({ error: "Missing order or subscription ID" }, { status: 400 })
        }

        if (!isValidPlanId(plan)) {
            return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
        }

        // Verify signature.
        // CRITICAL: Razorpay uses DIFFERENT concatenation orders:
        //   - Orders:        HMAC(razorpay_order_id + "|" + razorpay_payment_id)
        //   - Subscriptions: HMAC(razorpay_payment_id + "|" + razorpay_subscription_id)
        // verifyPaymentSignature(a, b) computes HMAC(`${a}|${b}`), so we must
        // pass the args in the correct order for each flow.
        const isSubscription = !!razorpay_subscription_id
        const isValid = isSubscription
            ? await verifyPaymentSignature(
                  razorpay_payment_id,
                  razorpay_subscription_id,
                  razorpay_signature
              )
            : await verifyPaymentSignature(
                  razorpay_order_id,
                  razorpay_payment_id,
                  razorpay_signature
              )

        if (!isValid) {
            console.error("Payment signature verification failed", { verifyId, razorpay_payment_id, isSubscription })
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: { reason: "signature_verification_failed", verifyId, razorpay_payment_id } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
        }

        // SECURITY: Never trust the client-supplied `plan`/`billingCycle`.
        // The signature only proves the payment + subscription are authentic; it does
        // NOT bind them to the plan the client claims. Without this, a user could
        // subscribe to Starter (cheap) and POST plan="agency" with a genuine signature
        // to unlock a higher tier for less money. We derive the real plan from
        // Razorpay's own subscription record (plan_id was set server-side at creation).
        let effectivePlan: PlanId = plan
        let effectiveCycle: string = billingCycle || "monthly"
        let effectiveCurrency = "INR"
        // The authoritative Razorpay plan_id (set server-side at creation). Used to
        // record the ACTUAL charged amount (incl. grandfathered legacy prices).
        let effectivePlanId: string | null = null

        let authoritativePeriodEnd: Date | null = null

        if (isSubscription) {
            let authoritative: { plan: PlanId | null; cycle: string | null; currency: string; planId: string | null; periodEnd: Date | null } | null = null
            try {
                const sub = await getSubscription(razorpay_subscription_id)
                if (sub) {
                    const cycleFromPlan = planIdToCycle(sub.plan_id)
                    authoritative = {
                        plan: planIdToPlan(sub.plan_id),
                        cycle: cycleFromPlan || (sub.notes?.billing_cycle === "yearly" ? "yearly" : "monthly"),
                        currency: planIdToCurrency(sub.plan_id) || "INR",
                        planId: sub.plan_id || null,
                        periodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
                    }
                }
            } catch (e) {
                console.error("verify: failed to fetch subscription from Razorpay", e)
            }

            if (!authoritative || !authoritative.plan) {
                // Could not confirm the real plan with Razorpay. Do NOT grant access
                // from client input. The webhook (which uses server-set notes) is the
                // reliable backstop and will activate the correct plan shortly.
                await logAudit(auth.supabase, {
                    user_id: auth.user.id,
                    action: "payment.verify_pending",
                    metadata: { razorpay_subscription_id, razorpay_payment_id, reason: "plan_not_confirmed" } as any,
                }, request).catch(() => {})
                return NextResponse.json({
                    success: true,
                    pending: true,
                    message: "Payment received. Your plan is being activated.",
                })
            }

            // If the client lied about the plan, log it as a security event.
            if (authoritative.plan !== plan) {
                await logAudit(auth.supabase, {
                    user_id: auth.user.id,
                    action: "security.plan_mismatch",
                    metadata: { claimed_plan: plan, actual_plan: authoritative.plan, razorpay_subscription_id, razorpay_payment_id } as any,
                }, request).catch(() => {})
            }

            effectivePlan = authoritative.plan
            effectiveCycle = authoritative.cycle || "monthly"
            effectiveCurrency = authoritative.currency || "INR"
            effectivePlanId = authoritative.planId
            authoritativePeriodEnd = authoritative.periodEnd
        }

        // Amount stored for records = the ACTUAL charged amount for this
        // subscription's plan_id. planIdToAmount checks legacy (grandfathered)
        // plans first so an existing subscriber's real historical price is
        // recorded, not today's (possibly different) current price.
        const paidTier = effectivePlan as "starter" | "pro" | "agency"
        const cycleKey = effectiveCycle === "yearly" ? "yearly" : "monthly"
        const amount = (effectivePlanId ? planIdToAmount(effectivePlanId) : null)
            ?? PLAN_PRICES_BY_CURRENCY[effectiveCurrency]?.[paidTier]?.[cycleKey]
            ?? PLAN_PRICES_BY_CURRENCY.INR[paidTier][cycleKey]
            ?? PLANS[effectivePlan].monthlyPrice

        const now = new Date()
        const periodEnd = authoritativePeriodEnd ?? new Date(now)
        if (!authoritativePeriodEnd) {
            if (effectiveCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1)
            else periodEnd.setMonth(periodEnd.getMonth() + 1)
        }

        // Service-role client. Paid subscription activation MUST bypass RLS:
        // the subscriptions RLS policies (sub_insert_free_only / sub_update_free_only)
        // only permit plan='free' for authenticated users, so a paid upsert via the
        // RLS-bound client silently fails with a policy violation. The webhook uses
        // service_role for the same reason — verify must match.
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
        )

        // Capture any PRE-EXISTING Razorpay subscription id. For a re-authorised
        // upgrade, stop the old mandate before persisting the new active provider
        // subscription. If persistence then fails, the signed new payment remains
        // recoverable by webhook/reconcile without risking double billing.
        let previousSubscriptionId: string | null = null
        if (isSubscription && razorpay_subscription_id) {
            const { data: existingRow } = await svc
                .from("subscriptions" as any)
                .select("razorpay_subscription_id")
                .eq("user_id", auth.user.id)
                .maybeSingle()
            const existingId = (existingRow as any)?.razorpay_subscription_id
            if (existingId && existingId !== razorpay_subscription_id) previousSubscriptionId = existingId
        }

        if (previousSubscriptionId) {
            try {
                const { cancelRazorpaySubscription } = await import("@/lib/razorpay")
                await cancelRazorpaySubscription(previousSubscriptionId, false)
            } catch (cancelErr) {
                console.error("[verify] failed to cancel old subscription after re-auth upgrade:", cancelErr)
                return NextResponse.json(
                    { error: "Payment succeeded, but the previous billing mandate could not be stopped. Please contact support." },
                    { status: 502 },
                )
            }
        }

        const { error: subError } = await svc
            .from("subscriptions" as any)
            .upsert({
                user_id: auth.user.id,
                plan: effectivePlan as string,
                billing_cycle: effectiveCycle || "monthly",
                status: "active",
                razorpay_payment_id,
                razorpay_order_id: razorpay_order_id || null,
                razorpay_subscription_id: razorpay_subscription_id || null,
                razorpay_plan_id: effectivePlanId,
                amount_paid: amount,
                currency: effectiveCurrency,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancelled_at: null,
                scheduled_downgrade: null,
                updated_at: now.toISOString(),
            }, { onConflict: "user_id" })

        if (subError) {
            console.error("Subscription upsert error:", subError)
            return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 })
        }

        // Mark plan as selected in profile (protected column — service role only)
        await svc
            .from("profiles")
            .update({ plan_selected: true } as any)
            .eq("id", auth.user.id)

        // Log payment (service role — RLS on payment_history is read-own/insert-restricted).
        // Idempotent guard: skip if this payment was already recorded (e.g. by webhook).
        const { data: existingPayment } = await svc
            .from("payment_history" as any)
            .select("id")
            .eq("razorpay_payment_id", razorpay_payment_id)
            .maybeSingle()

        if (!existingPayment) {
            await svc.from("payment_history" as any).insert({
                user_id: auth.user.id,
                razorpay_payment_id,
                razorpay_order_id: razorpay_order_id || null,
                razorpay_signature,
                amount,
                currency: effectiveCurrency,
                status: "captured",
                plan: effectivePlan,
                billing_cycle: effectiveCycle || "monthly",
            })
        }

        // Audit log
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.verify",
            metadata: { verifyId, razorpay_payment_id, plan: effectivePlan, billing_cycle: effectiveCycle, amount, status: "success" } as any,
        }, request).catch(() => {})

        // Notification
        const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
        const planLabel = PLAN_NAMES[effectivePlan] || effectivePlan
        await createNotification(auth.supabase, {
            user_id: auth.user.id,
            type: "subscription_activated",
            title: `${planLabel} Plan Activated 🎉`,
            message: `Your ${planLabel} plan is now active with automatic monthly billing.`,
            metadata: { plan: effectivePlan, billingCycle: effectiveCycle, amount, razorpay_payment_id },
        }).catch(() => {})

        return NextResponse.json({
            success: true,
            plan: effectivePlan,
            billingCycle: effectiveCycle || "monthly",
            periodEnd: periodEnd.toISOString(),
        })
    } catch (error) {
        console.error("Verify payment error:", error)
        return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
    }
}
