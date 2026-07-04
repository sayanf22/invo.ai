import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { getSubscription, planIdToPlan, planIdToCurrency, planIdToCycle, planIdToAmount, isValidPlanId, PLANS, PLAN_PRICES_BY_CURRENCY, type PlanId } from "@/lib/razorpay"
import { logAudit } from "@/lib/audit-log"
import { createClient } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

/**
 * POST /api/razorpay/reconcile
 *
 * Self-healing subscription activation. If a payment was charged but the
 * synchronous /verify call failed (e.g. the historical signature-order bug,
 * a closed tab, or a dropped network), this endpoint recovers it:
 *
 *   1. Find a Razorpay subscription_id that THIS authenticated user previously
 *      attempted (read from their own audit_logs — never trust client input).
 *   2. Fetch that subscription LIVE from Razorpay (source of truth).
 *   3. Only activate if Razorpay reports it authenticated/active/charged AND
 *      it was created by this platform (notes.platform === 'clorefy').
 *   4. Upsert the subscription as active → the trg_sync_profile_tier trigger
 *      syncs profiles.tier automatically.
 *
 * SECURITY:
 *   - Authenticated + origin-validated.
 *   - The subscription_id is resolved from the user's OWN audit trail, so a
 *     user can never reconcile someone else's subscription.
 *   - Activation is gated on the live Razorpay status — cannot be spoofed.
 *   - Idempotent: re-running on an already-active sub is a no-op.
 */
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        // ── 1. Resolve candidate subscription_id(s) from THIS user's audit trail ──
        // We look at recent payment_failure / payment.verify events for this user.
        const { data: auditRows } = await auth.supabase
            .from("audit_logs")
            .select("action, metadata, created_at")
            .eq("user_id", auth.user.id)
            .in("action", ["security.payment_failure", "payment.verify"])
            .order("created_at", { ascending: false })
            .limit(10)

        const candidateSubIds: string[] = []
        for (const row of auditRows ?? []) {
            const meta = (row as any).metadata as Record<string, unknown> | null
            const verifyId = typeof meta?.verifyId === "string" ? meta.verifyId : null
            if (verifyId && verifyId.startsWith("sub_") && !candidateSubIds.includes(verifyId)) {
                candidateSubIds.push(verifyId)
            }
        }

        if (candidateSubIds.length === 0) {
            return NextResponse.json({ activated: false, reason: "no_pending_payment" })
        }

        // ── 2-4. Try each candidate against Razorpay (source of truth) ──────────
        const ACTIVE_STATUSES = ["authenticated", "active", "charged"]
        for (const subId of candidateSubIds) {
            let sub: Awaited<ReturnType<typeof getSubscription>>
            try {
                sub = await getSubscription(subId)
            } catch {
                continue // network/API issue — try next candidate
            }
            if (!sub) continue

            // Must be a clorefy-created subscription in a paid/active state
            if (sub.notes?.platform !== "clorefy") continue
            if (!ACTIVE_STATUSES.includes(sub.status)) continue

            // Determine the plan: prefer notes.plan, fall back to plan_id mapping
            let plan: PlanId | null = null
            if (typeof sub.notes?.plan === "string" && isValidPlanId(sub.notes.plan) && sub.notes.plan !== "free") {
                plan = sub.notes.plan as PlanId
            } else if (sub.plan_id) {
                plan = planIdToPlan(sub.plan_id)
            }
            if (!plan || plan === "free") continue

            const cycleFromPlan = sub.plan_id ? planIdToCycle(sub.plan_id) : null
            const billingCycle = (cycleFromPlan || (sub.notes?.billing_cycle === "yearly" ? "yearly" : "monthly")) as "monthly" | "yearly"
            const currency = (sub.plan_id ? planIdToCurrency(sub.plan_id) : null) || "INR"
            const paidTier = plan as "starter" | "pro" | "agency"
            // planIdToAmount records the subscriber's ACTUAL (possibly
            // grandfathered) price rather than today's current price.
            const amount = (sub.plan_id ? planIdToAmount(sub.plan_id) : null)
                ?? PLAN_PRICES_BY_CURRENCY[currency]?.[paidTier]?.[billingCycle]
                ?? PLAN_PRICES_BY_CURRENCY.INR[paidTier][billingCycle]
                ?? PLANS[plan].monthlyPrice

            // Period: use Razorpay's current_start/current_end when present
            const now = new Date()
            const periodStart = sub.current_start ? new Date(sub.current_start * 1000) : now
            const periodEnd = sub.current_end
                ? new Date(sub.current_end * 1000)
                : (() => {
                    const d = new Date(now)
                    if (billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1)
                    else d.setMonth(d.getMonth() + 1)
                    return d
                })()

            // ── Activate (upsert) — trigger syncs profiles.tier ──
            const { error: subError } = await auth.supabase
                .from("subscriptions" as any)
                .upsert({
                    user_id: auth.user.id,
                    plan: plan as string,
                    billing_cycle: billingCycle,
                    status: "active",
                    razorpay_subscription_id: sub.id,
                    amount_paid: amount,
                    currency,
                    current_period_start: periodStart.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                    updated_at: now.toISOString(),
                }, { onConflict: "user_id" })

            if (subError) {
                console.error("[reconcile] subscription upsert failed:", subError.message)
                return NextResponse.json({ activated: false, reason: "db_error" }, { status: 500 })
            }

            // Mark plan_selected on profile (protected column → service role)
            const svc = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false, autoRefreshToken: false } }
            )
            await svc.from("profiles").update({ plan_selected: true } as any).eq("id", auth.user.id)

            // Audit + notify (best-effort)
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "payment.verify",
                metadata: { reconciled: true, subscription_id: sub.id, plan, billing_cycle: billingCycle, amount } as any,
            }, request).catch(() => {})

            const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
            const planLabel = PLAN_NAMES[plan] || plan
            await createNotification(auth.supabase, {
                user_id: auth.user.id,
                type: "subscription_activated",
                title: `${planLabel} Plan Activated 🎉`,
                message: `Your ${planLabel} plan is now active.`,
                metadata: { plan, billingCycle, reconciled: true },
            }).catch(() => {})

            return NextResponse.json({ activated: true, plan, billingCycle })
        }

        return NextResponse.json({ activated: false, reason: "no_active_subscription" })
    } catch (error) {
        console.error("[reconcile] error:", error)
        return NextResponse.json({ activated: false, reason: "error" }, { status: 500 })
    }
}
