import { NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import {
    PLANS,
    type PlanId,
    cancelRazorpaySubscription,
    updateRazorpaySubscriptionPlan,
    getPlanIdForCurrency,
} from "@/lib/razorpay"
import { createClient } from "@supabase/supabase-js"
import { recoverPendingSubscriptionTransition } from "@/lib/razorpay-transition-recovery"

const PLAN_ORDER = ["free", "starter", "pro", "agency"]

/** Schedule paid downgrades and cancellation at the provider billing boundary. */
export async function POST(request: Request) {
    const originError = validateOrigin(request as any)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request as any, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError

    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError

    try {
        const { targetPlan } = body as { targetPlan?: string }
        if (!targetPlan || !["free", "starter", "pro"].includes(targetPlan)) {
            return NextResponse.json({ error: "Invalid target plan" }, { status: 400 })
        }

        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        const { data: sub } = await auth.supabase.from("subscriptions" as any)
            .select("*").eq("user_id", auth.user.id).single()
        if (!sub) return NextResponse.json({ error: "No active subscription" }, { status: 400 })

        let currentSub = sub as any
        const { resolveEffectiveTier } = await import("@/lib/cost-protection")
        let effectivePlan = resolveEffectiveTier(currentSub)
        if (effectivePlan === "free") {
            return NextResponse.json({ error: "No active paid subscription" }, { status: 400 })
        }
        if (currentSub.pending_change_type) {
            const recovery = await recoverPendingSubscriptionTransition(svc, currentSub)
            if (recovery.state === "cleared" || recovery.state === "reconciled") {
                const { data: refreshed, error: refreshError } = await svc.from("subscriptions" as any)
                    .select("*").eq("user_id", auth.user.id).maybeSingle()
                if (refreshError) throw refreshError
                currentSub = refreshed as any
                effectivePlan = resolveEffectiveTier(currentSub)
            }
            if (currentSub?.pending_change_type) {
                return NextResponse.json({
                    error: "A verified billing change is already pending.",
                    code: "CHANGE_PENDING",
                    transition: {
                        type: currentSub.pending_change_type,
                        fromPlan: effectivePlan,
                        targetPlan: currentSub.pending_plan,
                        targetBillingCycle: currentSub.pending_billing_cycle,
                        effectiveAt: currentSub.pending_effective_at,
                        recoverable: true,
                    },
                }, { status: 409 })
            }
        }
        if (effectivePlan === "free") {
            return NextResponse.json({ error: "No active paid subscription" }, { status: 400 })
        }
        if (PLAN_ORDER.indexOf(targetPlan) >= PLAN_ORDER.indexOf(effectivePlan)) {
            return NextResponse.json({ error: "This is not a downgrade" }, { status: 400 })
        }

        const effectiveAt = currentSub.current_period_end || null
        const targetProviderPlanId = targetPlan === "free" ? null : getPlanIdForCurrency(
            targetPlan as "starter" | "pro" | "agency",
            currentSub.currency,
            currentSub.billing_cycle,
        )
        if (targetPlan !== "free" && !targetProviderPlanId) {
            return NextResponse.json({ error: "No billing plan exists for the requested currency and cycle" }, { status: 400 })
        }
        const previous = {
            scheduled_downgrade: currentSub.scheduled_downgrade ?? null,
            pending_plan: currentSub.pending_plan ?? null,
            pending_billing_cycle: currentSub.pending_billing_cycle ?? null,
            pending_provider_plan_id: currentSub.pending_provider_plan_id ?? null,
            pending_change_type: currentSub.pending_change_type ?? null,
            pending_effective_at: currentSub.pending_effective_at ?? null,
            provider_sync_required: currentSub.provider_sync_required ?? false,
        }
        const pendingPatch = {
            scheduled_downgrade: targetPlan,
            pending_plan: targetPlan,
            pending_billing_cycle: targetPlan === "free" ? null : currentSub.billing_cycle,
            pending_provider_plan_id: targetProviderPlanId,
            pending_change_type: targetPlan === "free" ? "cancellation" : "downgrade",
            pending_effective_at: effectiveAt,
            provider_sync_required: true,
            updated_at: new Date().toISOString(),
        }
        const { data: claimed, error: pendingError } = await svc.from("subscriptions" as any)
            .update(pendingPatch)
            .eq("user_id", auth.user.id)
            .is("pending_change_type", null)
            .select("user_id")
            .maybeSingle()
        if (pendingError) {
            console.error("[downgrade] failed to persist intent:", pendingError)
            return NextResponse.json({ error: "Failed to schedule downgrade" }, { status: 500 })
        }
        if (!claimed) {
            return NextResponse.json({ error: "A billing change is already pending", code: "CHANGE_PENDING" }, { status: 409 })
        }

        try {
            if (targetPlan === "free") {
                await cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)
            } else {
                await updateRazorpaySubscriptionPlan(
                    currentSub.razorpay_subscription_id,
                    targetProviderPlanId!,
                    "cycle_end",
                )
            }
        } catch (providerError) {
            const { error: rollbackError } = await svc.from("subscriptions" as any)
                .update({ ...previous, updated_at: new Date().toISOString() })
                .eq("user_id", auth.user.id)
            if (rollbackError) console.error("[downgrade] rollback failed:", rollbackError)
            console.error("[downgrade] provider scheduling failed:", providerError)
            return NextResponse.json({
                error: "The billing provider could not schedule this change. Your current plan is unchanged.",
            }, { status: 502 })
        }

        const confirmationPatch: Record<string, unknown> = {
            provider_sync_required: false,
            updated_at: new Date().toISOString(),
        }
        if (targetPlan === "free") confirmationPatch.cancelled_at = new Date().toISOString()
        const { error: confirmationError } = await svc.from("subscriptions" as any)
            .update(confirmationPatch).eq("user_id", auth.user.id)

        const periodLabel = effectiveAt ? new Date(effectiveAt).toLocaleDateString() : "the end of your billing period"
        const message = `Your plan will change to ${PLANS[targetPlan as PlanId].name} on ${periodLabel}. `
            + `You keep ${PLANS[effectivePlan as PlanId].name} features until then. `
            + "There is no immediate downgrade charge or refund; the lower price begins on the next billing cycle."

        if (confirmationError) {
            console.error("[downgrade] provider confirmed but local confirmation is pending:", confirmationError)
            return NextResponse.json({
                success: true,
                syncPending: true,
                message: `${message} Provider confirmation succeeded; local status is still syncing.`,
                effectiveDate: effectiveAt,
                targetPlan,
                transition: { fromPlan: effectivePlan, targetPlan, effectiveAt, allowancesResetOnActivation: true },
            }, { status: 202 })
        }

        return NextResponse.json({
            success: true,
            message,
            effectiveDate: effectiveAt,
            targetPlan,
            transition: { fromPlan: effectivePlan, targetPlan, effectiveAt, allowancesResetOnActivation: true },
        })
    } catch (error) {
        console.error("Downgrade error:", error)
        return NextResponse.json({ error: "Failed to process downgrade" }, { status: 500 })
    }
}