import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getSubscription, getVerifiedSubscriptionCharge } from "@/lib/razorpay"
import {
    applyRazorpaySubscriptionSnapshot,
    applyRazorpayTerminalSnapshot,
} from "@/lib/razorpay-subscription-state"
import { recoverPendingSubscriptionTransition } from "@/lib/razorpay-transition-recovery"
import { logAudit } from "@/lib/audit-log"

/** Recover only locally-bound, charge-backed subscription transitions. */
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError

    try {
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        const { data: current, error } = await svc.from("subscriptions" as any)
            .select("*").eq("user_id", auth.user.id).maybeSingle()
        if (error) throw error

        if ((current as any)?.pending_change_type) {
            const recovery = await recoverPendingSubscriptionTransition(svc, current as any)
            if (recovery.state === "cleared") {
                return NextResponse.json({
                    activated: false,
                    pendingCleared: true,
                    reason: recovery.reason || "stale_transition_cleared",
                })
            }
            if (recovery.state === "reconciled") {
                return NextResponse.json({ activated: true, reconciled: true })
            }
            if (recovery.state === "pending") {
                return NextResponse.json({
                    activated: false,
                    scheduled: Boolean(recovery.effectiveAt),
                    pending: true,
                    plan: recovery.targetPlan,
                    billingCycle: recovery.targetBillingCycle,
                    effectiveDate: recovery.effectiveAt,
                    reason: recovery.reason || "transition_pending",
                }, { status: 202 })
            }
        }

        const candidates = [
            (current as any)?.pending_razorpay_subscription_id,
            (current as any)?.razorpay_subscription_id,
        ].filter((value, index, values): value is string =>
            typeof value === "string" && value.startsWith("sub_") && values.indexOf(value) === index)
        if (!candidates.length) return NextResponse.json({ activated: false, reason: "no_pending_payment" })

        for (const subscriptionId of candidates) {
            const provider = await getSubscription(subscriptionId).catch(() => null)
            if (!provider || provider.id !== subscriptionId
                || provider.notes?.platform !== "clorefy"
                || provider.notes?.user_id !== auth.user.id) continue

            if (provider.status === "cancelled" || provider.status === "halted") {
                const result = await applyRazorpayTerminalSnapshot(svc, provider, {
                    userId: auth.user.id,
                    eventType: "provider.reconcile",
                    eventCreatedAt: new Date(),
                })
                await logAudit(auth.supabase, {
                    user_id: auth.user.id,
                    action: "payment.verify",
                    metadata: {
                        razorpay_subscription_id: subscriptionId,
                        provider_status: provider.status,
                        finalized: result.finalized,
                    } as any,
                }, request).catch(() => {})
                return NextResponse.json({
                    activated: false,
                    terminal: true,
                    finalized: result.finalized,
                    pendingCleared: result.pendingCleared,
                    effectiveDate: result.periodEnd,
                })
            }

            const futureReplacement = (current as any)?.pending_razorpay_subscription_id === subscriptionId
                && (current as any)?.razorpay_subscription_id !== subscriptionId
                && Boolean(provider.current_start && provider.current_start * 1000 > Date.now() + 60_000)
            if (futureReplacement) {
                const result = await applyRazorpaySubscriptionSnapshot(svc, provider, {
                    userId: auth.user.id,
                    eventType: "provider.reconcile",
                    eventCreatedAt: new Date(),
                    charge: null,
                })
                return NextResponse.json({
                    activated: false,
                    scheduled: result.scheduled,
                    plan: result.plan,
                    billingCycle: result.billingCycle,
                    effectiveDate: result.periodEnd,
                }, { status: 202 })
            }

            const verified = await getVerifiedSubscriptionCharge(subscriptionId).catch(() => null)
            if (!verified) continue
            const result = await applyRazorpaySubscriptionSnapshot(svc, verified.subscription, {
                userId: auth.user.id,
                eventType: "provider.reconcile",
                eventCreatedAt: new Date(),
                charge: verified,
            })
            if (!result.applied || result.stale) continue

            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "payment.verify",
                metadata: {
                    reconciled: true,
                    razorpay_subscription_id: subscriptionId,
                    razorpay_payment_id: verified.id,
                    invoice_id: verified.invoice_id,
                    plan: result.plan,
                } as any,
            }, request).catch(() => {})
            return NextResponse.json({
                activated: true,
                scheduled: false,
                cleanupPending: result.cleanupPending,
                plan: result.plan,
                billingCycle: result.billingCycle,
                effectiveDate: result.periodEnd,
            })
        }

        return NextResponse.json({ activated: false, reason: "no_verified_charge" }, { status: 202 })
    } catch (error) {
        console.error("[reconcile] error:", error)
        return NextResponse.json({ activated: false, reason: "error" }, { status: 500 })
    }
}
