import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { resolveEffectiveTier } from "@/lib/cost-protection"

/** GET /api/razorpay/subscription — pure subscription status read. */
export async function GET(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const { data, error } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", auth.user.id)
            .maybeSingle()

        if (error) {
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

        return NextResponse.json({
            subscription,
            effectivePlan: resolveEffectiveTier(subscription),
        })
    } catch (error) {
        console.error("Subscription API error:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}