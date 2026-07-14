import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { PLANS, type PlanId, cancelRazorpaySubscription, updateRazorpaySubscriptionPlan, getPlanIdForCurrency } from "@/lib/razorpay"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/razorpay/downgrade
 * Schedules a plan downgrade for the end of the current billing period.
 * The user keeps their current plan until the period ends, then switches.
 *
 * When the target is "free" (i.e. a cancellation), we ALSO cancel the underlying
 * Razorpay recurring subscription at cycle end so the customer is never charged
 * again, and we disable their paid-only automations (recurring invoices +
 * pending email reminders).
 *
 * SECURITY: Server-side only, validates plan hierarchy.
 */
export async function POST(request: Request) {
    const originError = validateOrigin(request as any)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { targetPlan } = body as { targetPlan: string }

        if (!targetPlan || !["free", "starter", "pro"].includes(targetPlan)) {
            return NextResponse.json({ error: "Invalid target plan" }, { status: 400 })
        }

        // Service-role client. Subscription writes MUST bypass RLS: the
        // sub_update_free_only policy's WITH CHECK requires the resulting row to
        // have plan='free', so ANY update to a paid row (plan stays 'pro'/'starter'/
        // 'agency' until period end) via the authenticated client is rejected. This
        // is why scheduling a downgrade/cancel silently failed for paid users.
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } }
        )

        // Get current subscription (SELECT via RLS-bound client — read-own is allowed)
        const { data: sub } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", auth.user.id)
            .single()

        if (!sub) {
            return NextResponse.json({ error: "No active subscription" }, { status: 400 })
        }

        const currentSub = sub as any
        const { resolveEffectiveTier } = await import("@/lib/cost-protection")
        const effectivePlan = resolveEffectiveTier(currentSub)
        if (effectivePlan === "free") {
            return NextResponse.json({ error: "No active paid subscription" }, { status: 400 })
        }

        const planOrder = ["free", "starter", "pro", "agency"]
        const currentIdx = planOrder.indexOf(effectivePlan)
        const targetIdx = planOrder.indexOf(targetPlan)

        // Validate it's actually a downgrade
        if (targetIdx >= currentIdx) {
            return NextResponse.json({ error: "This is not a downgrade" }, { status: 400 })
        }

        // Persist intent first, then require provider confirmation. If the
        // provider call fails, roll back the local schedule so UI, entitlement,
        // and future billing cannot diverge.
        const previousDowngrade = currentSub.scheduled_downgrade ?? null
        const { error } = await svc
            .from("subscriptions" as any)
            .update({ scheduled_downgrade: targetPlan, updated_at: new Date().toISOString() })
            .eq("user_id", auth.user.id)
        if (error) {
            console.error("Downgrade schedule error:", error)
            return NextResponse.json({ error: "Failed to schedule downgrade" }, { status: 500 })
        }

        const rollbackSchedule = async () => {
            const { error: rollbackError } = await svc
                .from("subscriptions" as any)
                .update({ scheduled_downgrade: previousDowngrade, updated_at: new Date().toISOString() })
                .eq("user_id", auth.user.id)
            if (rollbackError) console.error("[downgrade] rollback failed:", rollbackError)
        }

        try {
            if (targetPlan === "free") {
                await cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)
                const { error: cancelStateError } = await svc
                    .from("subscriptions" as any)
                    .update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                    .eq("user_id", auth.user.id)
                if (cancelStateError) throw cancelStateError
            } else {
                const targetPlanId = getPlanIdForCurrency(
                    targetPlan as "starter" | "pro" | "agency",
                    currentSub.currency,
                    currentSub.billing_cycle,
                )
                if (!targetPlanId) throw new Error("No Razorpay plan exists for the requested currency and cycle")
                await updateRazorpaySubscriptionPlan(
                    currentSub.razorpay_subscription_id,
                    targetPlanId,
                    "cycle_end",
                )
            }
        } catch (providerError) {
            await rollbackSchedule()
            console.error("[downgrade] Provider scheduling failed:", providerError)
            return NextResponse.json(
                { error: "The billing provider could not schedule this change. Your current plan is unchanged." },
                { status: 502 },
            )
        }

        if (targetPlan === "free") {
            try {
                await (svc as any).from("recurring_invoices")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", auth.user.id).eq("is_active", true)
                await (svc as any).from("email_schedules")
                    .update({ status: "cancelled", cancelled_reason: "subscription_cancelled", updated_at: new Date().toISOString() })
                    .eq("user_id", auth.user.id).eq("status", "pending")
            } catch (cleanupErr) {
                console.error("[downgrade] automation cleanup failed (non-fatal):", cleanupErr)
            }
        }

        const periodEnd = currentSub.current_period_end
            ? new Date(currentSub.current_period_end).toLocaleDateString()
            : "end of billing period"

        return NextResponse.json({
            success: true,
            message: `Your plan will change to ${PLANS[targetPlan as PlanId].name} on ${periodEnd}. You keep ${PLANS[currentSub.plan as PlanId].name} features until then.`,
            effectiveDate: currentSub.current_period_end,
        })
    } catch (error) {
        console.error("Downgrade error:", error)
        return NextResponse.json({ error: "Failed to process downgrade" }, { status: 500 })
    }
}
