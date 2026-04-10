import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createRazorpayOrder, PLANS, type PlanId } from "@/lib/razorpay"

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order for subscription payment.
 * 
 * SECURITY:
 * - Requires authentication
 * - Amount is determined server-side from plan ID (client cannot set amount)
 * - Returns order_id for Razorpay Checkout
 */
export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { plan, billingCycle } = body as { plan: string; billingCycle: string }

        // Validate plan
        if (!plan || !["starter", "pro", "agency"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        // Validate billing cycle
        if (!billingCycle || !["monthly", "yearly"].includes(billingCycle)) {
            return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 })
        }

        // Create order server-side (amount determined by plan, not client)
        const order = await createRazorpayOrder(plan as PlanId, billingCycle as "monthly" | "yearly")

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            plan,
            billingCycle,
            planName: PLANS[plan as PlanId].name,
        })
    } catch (error) {
        console.error("Create order error:", error)
        return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
    }
}
