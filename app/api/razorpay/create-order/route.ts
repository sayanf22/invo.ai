import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createRazorpaySubscription, PLANS, type PlanId } from "@/lib/razorpay"

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay Subscription for recurring billing.
 * 
 * SECURITY:
 * - Requires authentication
 * - Plan is validated server-side
 * - Subscription is created via Razorpay API (not client-controlled)
 */
export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { plan, billingCycle } = body as { plan: string; billingCycle: string }

        if (!plan || !["starter", "pro", "agency"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        const cycle = (billingCycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

        // Create a Razorpay Subscription (recurring)
        const subscription = await createRazorpaySubscription(plan as PlanId, cycle)

        return NextResponse.json({
            subscriptionId: subscription.id,
            keyId: process.env.RAZORPAY_KEY_ID,
            plan,
            billingCycle: cycle,
            planName: PLANS[plan as PlanId].name,
            amount: subscription.plan_id ? PLANS[plan as PlanId].monthlyPrice : 0,
        })
    } catch (error: any) {
        console.error("Create subscription error:", error)
        return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 })
    }
}
