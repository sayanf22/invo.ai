import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * GET /api/razorpay/subscription
 * Returns the current user's subscription status.
 */
export async function GET(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const { data, error } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", auth.user.id)
            .single()

        if (error && error.code !== "PGRST116") { // PGRST116 = no rows
            console.error("Subscription fetch error:", error)
            return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
        }

        // Default to free plan if no subscription
        const subscription = data || {
            plan: "free",
            status: "active",
            billing_cycle: null,
            current_period_end: null,
        }

        return NextResponse.json({ subscription })
    } catch (error) {
        console.error("Subscription API error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
