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

        // Run subscription expiry check first
        await (auth.supabase.rpc as any)("check_subscription_expiry", { p_user_id: userId })

        // Get subscription (after expiry check)
        const { data: sub } = await auth.supabase
            .from("subscriptions" as any)
            .select("*")
            .eq("user_id", userId)
            .single()

        // EFFECTIVE tier — a cancelled/expired subscription resolves to "free" so the
        // billing UI (plan name + limits) always matches what the API actually enforces.
        // The raw stored plan is returned separately as `storedPlan` for reference.
        const storedPlan = ((sub as any)?.plan || "free") as PlanId
        const plan = resolveEffectiveTier(sub as any) as PlanId
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

        // Derive a clear display status for the billing UI:
        //   active   → subscription is live and (if paid) auto-renews at current_period_end
        //   expired  → paid plan whose period has ended / been cancelled → now on free
        //   free     → never had a paid plan
        const rawStatus = (sub as any)?.status ?? "active"
        const periodEnd = (sub as any)?.current_period_end ?? null
        const isPaidStored = storedPlan !== "free"
        const effectivelyDowngraded = isPaidStored && plan === "free"
        const displayStatus = effectivelyDowngraded
            ? "expired"
            : rawStatus

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
