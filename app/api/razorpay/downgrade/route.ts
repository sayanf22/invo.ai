import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { PLANS, type PlanId } from "@/lib/razorpay"

/**
 * POST /api/razorpay/downgrade
 * Schedules a plan downgrade for the end of the current billing period.
 * The user keeps their current plan until the period ends, then switches.
 * 
 * SECURITY: Server-side only, validates plan hierarchy.
 */
export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { targetPlan } = body as { targetPlan: string }

        if (!targetPlan || !["free", "starter", "pro"].includes(targetPlan)) {
            return NextResponse.json({ error: "Invalid target plan" }, { status: 400 })
        }

        // Get current subscription
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

        // Schedule the downgrade — takes effect at end of current period
        const { error } = await auth.supabase
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
