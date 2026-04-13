import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createRazorpayOrder, PLANS, type PlanId } from "@/lib/razorpay"
import { COUNTRY_PRICING } from "@/lib/pricing"

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order for subscription payment.
 * 
 * SECURITY:
 * - Requires authentication
 * - Amount is determined server-side from plan + country (client sends country code, not amount)
 * - Validates country code against known pricing table
 */
export async function POST(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { plan, billingCycle, countryCode } = body as { plan: string; billingCycle: string; countryCode?: string }

        if (!plan || !["starter", "pro", "agency"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        if (!billingCycle || !["monthly", "yearly"].includes(billingCycle)) {
            return NextResponse.json({ error: "Invalid billing cycle" }, { status: 400 })
        }

        // Determine currency and amount from server-side pricing table
        const pricing = countryCode && COUNTRY_PRICING[countryCode]
            ? COUNTRY_PRICING[countryCode]
            : COUNTRY_PRICING["IN"]

        const paidPlan = plan as "starter" | "pro" | "agency"
        const cycle = billingCycle as "monthly" | "yearly"
        const displayAmount = pricing[paidPlan][cycle]
        const yearlyTotal = cycle === "yearly" ? displayAmount * 12 : displayAmount

        // Create order with the user's currency
        const order = await createRazorpayOrder(
            plan as PlanId,
            cycle,
            pricing.currency,
            yearlyTotal
        )

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            plan,
            billingCycle,
            planName: PLANS[plan as PlanId].name,
            displayPrice: `${pricing.currencySymbol}${displayAmount}`,
        })
    } catch (error: any) {
        console.error("Create order error:", error)
        return NextResponse.json({ error: "Operation failed. Please try again." }, { status: 500 })
    }
}
