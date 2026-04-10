import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { PLANS, type PlanId } from "@/lib/razorpay"

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
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        // Get subscription
        const { data: sub } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", userId)
            .single()

        const plan = ((sub as any)?.plan || "free") as PlanId
        const planConfig = PLANS[plan]

        // Count document sessions this month
        const { count: docsUsed } = await auth.supabase
            .from("document_sessions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", monthStart)

        // Get AI request count from user_usage
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const { data: usage } = await auth.supabase
            .from("user_usage" as any)
            .select("ai_requests_count, documents_count")
            .eq("user_id", userId)
            .eq("month", monthKey)
            .single()

        const documentsUsed = docsUsed || 0
        const documentsLimit = planConfig.documentsPerMonth
        const aiRequests = (usage as any)?.ai_requests_count || 0

        return NextResponse.json({
            plan,
            planName: planConfig.name,
            subscription: sub || null,
            usage: {
                documentsUsed,
                documentsLimit,
                documentsPercent: documentsLimit > 0 ? Math.min(Math.round((documentsUsed / documentsLimit) * 100), 100) : 0,
                aiRequests,
                currentMonth: monthKey,
            },
        })
    } catch (error) {
        console.error("Usage API error:", error)
        return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
    }
}
