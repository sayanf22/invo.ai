import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { PLANS, type PlanId } from "@/lib/razorpay"
import { getTierLimits, type UserTier } from "@/lib/cost-protection"

/**
 * GET /api/usage
 * Returns the current user's usage stats and subscription info.
 */
export async function GET(request: Request) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const userId = auth.user.id
        const now = new Date()

        // Run subscription expiry check first
        await (auth.supabase.rpc as any)("check_subscription_expiry", { p_user_id: userId })

        // Get subscription (after expiry check)
        const { data: sub } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", userId)
            .single()

        const plan = ((sub as any)?.plan || "free") as PlanId
        const planConfig = PLANS[plan]

        // Get usage from user_usage table — documents_count is a cumulative counter
        // that only increments (never decrements on delete), ensuring the limit is
        // not gamed by deleting and re-creating documents.
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const { data: usage } = await auth.supabase
            .from("user_usage" as any)
            .select("ai_requests_count, documents_count")
            .eq("user_id", userId)
            .eq("month", monthKey)
            .single()

        // Use the immutable cumulative counter — deleting sessions does NOT reduce this
        const documentsUsed = (usage as any)?.documents_count || 0
        const documentsLimit = planConfig.documentsPerMonth
        const aiRequests = (usage as any)?.ai_requests_count || 0

        // Get tier limits for message caps
        const tierLimits = getTierLimits(plan as UserTier)

        return NextResponse.json({
            plan,
            planName: planConfig.name,
            subscription: sub || null,
            usage: {
                documentsUsed,
                documentsLimit,
                documentsPercent: documentsLimit > 0 ? Math.min(Math.round((documentsUsed / documentsLimit) * 100), 100) : 0,
                aiRequests,
                messagesPerSession: tierLimits.messagesPerSession,
                messagesLimit: tierLimits.messagesPerSession,
                currentMonth: monthKey,
            },
        })
    } catch (error) {
        console.error("Usage API error:", error)
        return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
    }
}
