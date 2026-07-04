import { NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import {
    createRazorpaySubscription,
    PLANS,
    PLAN_PRICES_BY_CURRENCY,
    resolveSubscriptionCurrency,
    type PlanId,
} from "@/lib/razorpay"

export async function POST(request: Request) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const { plan, billingCycle } = body as { plan: string; billingCycle: string }

        if (!plan || !["starter", "pro", "agency"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        const cycle = (billingCycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

        // SECURITY: determine the billing currency from the SERVER-side Cloudflare
        // geo header, never from client input. This prevents a user from spoofing a
        // cheaper country to get a lower-priced plan. Falls back to INR when the
        // country is unknown or its currency isn't supported for recurring billing.
        const cfCountry = request.headers.get("cf-ipcountry") || ""
        const currency = resolveSubscriptionCurrency(cfCountry)

        // Create a Razorpay Subscription (recurring) in the resolved currency.
        const subscription = await createRazorpaySubscription(plan as PlanId, cycle, auth.user.id, currency)

        const tier = plan as "starter" | "pro" | "agency"
        const amount = (PLAN_PRICES_BY_CURRENCY[currency]?.[tier]?.[cycle])
            ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]

        return NextResponse.json({
            subscriptionId: subscription.id,
            keyId: process.env.RAZORPAY_KEY_ID,
            plan,
            billingCycle: cycle,
            planName: PLANS[plan as PlanId].name,
            currency,
            amount,
        })
    } catch (error: any) {
        console.error("Create subscription error:", error)
        return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 })
    }
}
