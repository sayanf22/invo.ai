import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * GET /api/razorpay/subscription
 * Returns the current user's subscription status.
 * Also runs expiry check to apply scheduled downgrades.
 */
export async function GET(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        // Run expiry check (applies scheduled downgrades, marks past_due)
        await (auth.supabase.rpc as any)("check_subscription_expiry", { p_user_id: auth.user.id })

        const { data, error } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", auth.user.id)
            .single()

        if (error && error.code !== "PGRST116") {
            console.error("Subscription fetch error:", error)
            return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 })
        }

        const subscription = (data as any) || {
            plan: "free",
            status: "active",
            billing_cycle: null,
            current_period_end: null,
            scheduled_downgrade: null,
        }

        return NextResponse.json({ subscription })
    } catch (error) {
        console.error("Subscription API error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
