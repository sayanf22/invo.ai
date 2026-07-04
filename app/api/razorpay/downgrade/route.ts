import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { PLANS, type PlanId, cancelRazorpaySubscription } from "@/lib/razorpay"
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
        const planOrder = ["free", "starter", "pro", "agency"]
        const currentIdx = planOrder.indexOf(currentSub.plan)
        const targetIdx = planOrder.indexOf(targetPlan)

        // Validate it's actually a downgrade
        if (targetIdx >= currentIdx) {
            return NextResponse.json({ error: "This is not a downgrade" }, { status: 400 })
        }

        // Schedule the downgrade — takes effect at end of current period.
        // Service role: the row still has a paid plan, which the free-only RLS
        // UPDATE policy would otherwise reject.
        const { error } = await svc
            .from("subscriptions" as any)
            .update({
                scheduled_downgrade: targetPlan,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", auth.user.id)

        if (error) {
            console.error("Downgrade schedule error:", error)
            return NextResponse.json({ error: "Failed to schedule downgrade" }, { status: 500 })
        }

        // ── Cancellation path (downgrade to Free) ────────────────────────────
        // Cancelling means: stop future Razorpay charges AND turn off paid-only
        // automations. The user keeps access until current_period_end (cancel at
        // cycle end), after which the expiry RPC flips them to Free.
        if (targetPlan === "free") {
            // 1. Cancel the recurring Razorpay subscription at cycle end (non-fatal —
            //    if Razorpay rejects, the scheduled_downgrade still applies locally).
            try {
                await cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)
            } catch (cancelErr) {
                console.error("[downgrade] Razorpay cancel failed (non-fatal):", cancelErr)
            }

            // 2. Mark the subscription cancelled locally (keeps access until period end).
            //    Service role — same free-only RLS reason as above.
            await svc
                .from("subscriptions" as any)
                .update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq("user_id", auth.user.id)

            // 3. Disable paid-only automations immediately: recurring invoices +
            //    pending scheduled email reminders. Uses the service-role client so
            //    RLS on these tables can't block the cleanup.
            try {
                await (svc as any)
                    .from("recurring_invoices")
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .eq("user_id", auth.user.id)
                    .eq("is_active", true)
                await (svc as any)
                    .from("email_schedules")
                    .update({ status: "cancelled", cancelled_reason: "subscription_cancelled", updated_at: new Date().toISOString() })
                    .eq("user_id", auth.user.id)
                    .eq("status", "pending")
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
