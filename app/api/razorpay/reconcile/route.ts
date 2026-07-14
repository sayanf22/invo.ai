import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { cancelRazorpaySubscription, getSubscription } from "@/lib/razorpay"
import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"
import { logAudit } from "@/lib/audit-log"
import { createClient } from "@supabase/supabase-js"

const ACTIVE_PROVIDER_STATUSES = new Set(["authenticated", "active", "charged"])

/** Recover provider-confirmed transitions after closed tabs or partial local failures. */
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
        const { data: current, error: currentError } = await svc.from("subscriptions" as any)
            .select("*").eq("user_id", auth.user.id).maybeSingle()
        if (currentError) throw currentError

        // Reconcile only provider IDs durably bound to this user's row. Audit-log
        // metadata is user-writable and must never be an entitlement source.
        const candidates: string[] = []
        const add = (value: unknown) => {
            if (typeof value === "string" && value.startsWith("sub_") && !candidates.includes(value)) candidates.push(value)
        }
        add((current as any)?.pending_razorpay_subscription_id)
        add((current as any)?.razorpay_subscription_id)
        if (!candidates.length) return NextResponse.json({ activated: false, reason: "no_pending_payment" })

        for (const subscriptionId of candidates) {
            const provider = await getSubscription(subscriptionId).catch(() => null)
            if (
                !provider
                || provider.id !== subscriptionId
                || provider.notes?.platform !== "clorefy"
                || provider.notes?.user_id !== auth.user.id
            ) continue

            const isExpectedFutureReplacement = (current as any)?.pending_razorpay_subscription_id === subscriptionId
                && Boolean(provider.current_start && provider.current_start * 1000 > Date.now() + 60_000)
            if (ACTIVE_PROVIDER_STATUSES.has(provider.status) && (provider.status !== "authenticated" || isExpectedFutureReplacement)) {
                const result = await applyRazorpaySubscriptionSnapshot(svc, provider, {
                    userId: auth.user.id,
                    eventType: "provider.reconcile",
                    eventCreatedAt: new Date(),
                })
                if (result.stale) continue

                let cleanupPending = result.cleanupPending
                if (result.scheduled) {
                    const { data: row } = await svc.from("subscriptions" as any)
                        .select("razorpay_subscription_id,pending_previous_subscription_id")
                        .eq("user_id", auth.user.id).maybeSingle()
                    const previousId = (row as any)?.pending_previous_subscription_id || (row as any)?.razorpay_subscription_id
                    if (previousId && previousId !== subscriptionId) {
                        try {
                            await cancelRazorpaySubscription(previousId, true)
                            const { error } = await svc.from("subscriptions" as any)
                                .update({ pending_previous_subscription_id: null, updated_at: new Date().toISOString() })
                                .eq("user_id", auth.user.id)
                            cleanupPending = Boolean(error)
                        } catch {
                            cleanupPending = true
                        }
                    }
                }

                await logAudit(auth.supabase, {
                    user_id: auth.user.id,
                    action: "payment.verify",
                    metadata: {
                        reconciled: true,
                        razorpay_subscription_id: subscriptionId,
                        plan: result.plan,
                        billing_cycle: result.billingCycle,
                        scheduled: result.scheduled,
                        cleanup_pending: cleanupPending,
                    } as any,
                }, request).catch(() => {})

                return NextResponse.json({
                    activated: result.applied,
                    scheduled: result.scheduled,
                    cleanupPending,
                    plan: result.plan,
                    billingCycle: result.billingCycle,
                    effectiveDate: result.periodEnd,
                })
            }

            if (provider.status === "cancelled" && (current as any)?.razorpay_subscription_id === subscriptionId) {
                const periodEnd = provider.current_end ? new Date(provider.current_end * 1000) : null
                const expired = Boolean(periodEnd && periodEnd.getTime() <= Date.now())
                const cancellingToFree = (current as any)?.scheduled_downgrade === "free"
                const patch: Record<string, unknown> = {
                    status: "cancelled",
                    cancelled_at: new Date().toISOString(),
                    provider_sync_required: false,
                    updated_at: new Date().toISOString(),
                }
                if (periodEnd) patch.current_period_end = periodEnd.toISOString()
                if (expired && cancellingToFree) {
                    Object.assign(patch, {
                        plan: "free",
                        billing_cycle: null,
                        scheduled_downgrade: null,
                        pending_plan: null,
                        pending_billing_cycle: null,
                        pending_razorpay_subscription_id: null,
                        pending_change_type: null,
                        pending_effective_at: null,
                    })
                }
                const { error } = await svc.from("subscriptions" as any)
                    .update(patch).eq("user_id", auth.user.id)
                if (error) return NextResponse.json({ activated: false, reason: "db_error" }, { status: 500 })
                return NextResponse.json({ activated: false, cancelled: true, normalizedToFree: expired && cancellingToFree })
            }
        }

        return NextResponse.json({ activated: false, reason: "no_active_subscription" })
    } catch (error) {
        console.error("[reconcile] error:", error)
        return NextResponse.json({ activated: false, reason: "error" }, { status: 500 })
    }
}