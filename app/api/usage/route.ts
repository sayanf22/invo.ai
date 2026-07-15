import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { PLANS, type PlanId } from "@/lib/razorpay"
import { getTierLimits, resolveEffectiveTier, type UserTier } from "@/lib/cost-protection"

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

        // Subscription reads are intentionally pure. Provider webhooks and the
        // authenticated reconcile endpoint own lifecycle mutations; a GET must
        // never expire paid access because a renewal webhook arrived late.
        const { data: sub } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", userId)
            .maybeSingle()

        // One canonical entitlement resolver drives enforcement and every UI.
        const storedPlan = ((sub as any)?.plan || "free") as PlanId
        const plan = resolveEffectiveTier(sub as any) as PlanId
        const planConfig = PLANS[plan]

        // Usage remains an immutable calendar-month counter. Plan changes do not
        // reset it, preventing upgrade/downgrade cycles from minting extra quota.
        const monthKey = now.toISOString().slice(0, 7)
        const { data: usage } = await auth.supabase
            .from("user_usage" as any)
            .select("ai_requests_count, documents_count, emails_count")
            .eq("user_id", userId)
            .eq("month", monthKey)
            .maybeSingle()

        const documentsUsed = (usage as any)?.documents_count || 0
        const emailsUsed = (usage as any)?.emails_count || 0
        const documentsLimit = planConfig.documentsPerMonth
        const aiRequests = (usage as any)?.ai_requests_count || 0
        const tierLimits = getTierLimits(plan as UserTier)

        const rawStatus = (sub as any)?.status ?? "active"
        const periodEnd = (sub as any)?.current_period_end ?? null
        const isPaidStored = storedPlan !== "free"
        const effectivelyDowngraded = isPaidStored && plan === "free"
        const displayStatus = effectivelyDowngraded ? "expired" : rawStatus

        return NextResponse.json({
            plan,
            storedPlan,
            planName: planConfig.name,
            subscription: sub || null,
            billingStatus: displayStatus,
            periodEnd,
            isExpired: effectivelyDowngraded,
            usage: {
                documentsUsed,
                documentsLimit,
                documentsPercent: documentsLimit > 0 ? Math.min(Math.round((documentsUsed / documentsLimit) * 100), 100) : 0,
                emailsUsed,
                emailsLimit: tierLimits.emailsPerMonth,
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
