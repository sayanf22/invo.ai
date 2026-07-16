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

        // Tier-aware allowance period (single source of truth in the DB):
        //   free/expired → UTC calendar month
        //   paid         → billing-anchored monthly window (day-of-month of the
        //                  subscription's current_period_start), for monthly AND
        //                  yearly billing cycles.
        const { data: periodInfo } = await auth.supabase.rpc("current_usage_period" as any, { p_user_id: userId })
        const period = (periodInfo as any) || null
        const calendarStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        const calendarEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        const monthKey: string = period?.key || now.toISOString().slice(0, 7)
        const billingAnchored = Boolean(period?.billing_anchored)
        const periodStart = period?.period_start ? new Date(period.period_start) : calendarStart
        const usageResetsAt = period?.period_end ? new Date(period.period_end) : calendarEnd

        const [{ data: usage }, { data: lastReset }] = await Promise.all([
            auth.supabase
                .from("user_usage" as any)
                .select("ai_requests_count, documents_count, emails_count")
                .eq("user_id", userId)
                .eq("month", monthKey)
                .maybeSingle(),
            auth.supabase
                .from("subscription_usage_resets" as any)
                .select("from_plan, to_plan, effective_at, reason")
                .eq("user_id", userId)
                .eq("usage_month", monthKey)
                .order("effective_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
        ])
        const resetAt = (lastReset as any)?.effective_at
            ? new Date((lastReset as any).effective_at)
            : null
        const usagePeriodStart = resetAt && resetAt > periodStart ? resetAt : periodStart

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
            usageResetsAt: usageResetsAt.toISOString(),
            usagePolicy: billingAnchored ? "billing_anchored_monthly_window" : "utc_calendar_month",
            billingAnchored,
            lastUsageReset: lastReset ? {
                effectiveAt: (lastReset as any).effective_at,
                reason: (lastReset as any).reason,
                fromPlan: (lastReset as any).from_plan,
                toPlan: (lastReset as any).to_plan,
            } : null,
            usage: {
                documentsUsed,
                documentsLimit,
                documentsPercent: documentsLimit > 0 ? Math.min(Math.round((documentsUsed / documentsLimit) * 100), 100) : 0,
                isOverLimit: documentsLimit > 0 && documentsUsed >= documentsLimit,
                emailsUsed,
                emailsLimit: tierLimits.emailsPerMonth,
                aiRequests,
                messagesPerSession: tierLimits.messagesPerSession,
                messagesLimit: tierLimits.messagesPerSession,
                currentMonth: monthKey,
                periodStart: usagePeriodStart.toISOString(),
                periodEndExclusive: usageResetsAt.toISOString(),
                timezone: "UTC",
            },
        })
    } catch (error) {
        console.error("Usage API error:", error)
        return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
    }
}
