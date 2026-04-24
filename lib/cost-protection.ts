/**
 * Cost Protection Module
 * 
 * Tracks and limits document usage per user based on their subscription tier.
 * Implements monthly document limits and per-session message caps.
 * 
 * Billing unit: per DOCUMENT (session), not per AI message.
 * All messages within one session are free up to the per-session message cap.
 */

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// ─── Tier Definitions ─────────────────────────────────────────────────────────

export type UserTier = "free" | "starter" | "pro" | "agency"

interface TierLimits {
    documentsPerMonth: number  // 0 = unlimited
    messagesPerSession: number // 0 = unlimited
    emailsPerMonth: number     // 0 = unlimited
    allowedDocTypes: string[]
}

const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        documentsPerMonth: 5,
        messagesPerSession: 10,
        emailsPerMonth: 5,       // 1 email per document — matches doc limit
        allowedDocTypes: ["invoice", "contract"],
    },
    starter: {
        documentsPerMonth: 50,
        messagesPerSession: 30,
        emailsPerMonth: 75,      // 1.5× doc limit — allows resends
        allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
    },
    pro: {
        documentsPerMonth: 150,
        messagesPerSession: 50,
        emailsPerMonth: 300,     // 2× doc limit — comfortable for resends + follow-ups
        allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
    },
    agency: {
        documentsPerMonth: 0,    // unlimited
        messagesPerSession: 0,   // unlimited
        emailsPerMonth: 0,       // unlimited
        allowedDocTypes: ["invoice", "contract", "quotation", "proposal"],
    },
}

// Estimated costs per operation (in USD) — for internal tracking only
const OPERATION_COSTS = {
    onboarding: 0.005,
    generation: 0.00094,
    generation_no_cache: 0.003,
    embedding: 0.00001,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function getTierLimits(tier: UserTier): TierLimits {
    return TIER_LIMITS[tier]
}

// ─── Usage Fetching ───────────────────────────────────────────────────────────

interface UsageRecord {
    user_id: string
    month: string
    ai_requests_count: number
    ai_tokens_used: number
    estimated_cost_usd: number
    documents_count?: number
}

async function getUserUsage(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<UsageRecord | null> {
    const month = getCurrentMonth()

    const { data, error } = await supabase
        .from("user_usage")
        .select("*")
        .eq("user_id", userId)
        .eq("month", month)
        .single()

    if (error && error.code !== "PGRST116") {
        console.error("Error fetching user usage:", error)
        return null
    }

    return data as UsageRecord | null
}

// ─── Document Limit Check ─────────────────────────────────────────────────────

/**
 * Check if user can create a new document session.
 * Returns null if allowed, or a 429 NextResponse if limit exceeded.
 */
export async function checkDocumentLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    userTier: UserTier = "free"
): Promise<NextResponse | null> {
    try {
        const limits = TIER_LIMITS[userTier]

        // Unlimited tier
        if (limits.documentsPerMonth === 0) return null

        const usage = await getUserUsage(supabase, userId)
        const currentDocs = usage?.documents_count || 0

        if (currentDocs >= limits.documentsPerMonth) {
            return NextResponse.json(
                {
                    error: "Monthly document limit reached",
                    currentUsage: currentDocs,
                    limit: limits.documentsPerMonth,
                    tier: userTier,
                    message: userTier === "free"
                        ? "Upgrade to Starter for 50 documents/month"
                        : userTier === "starter"
                        ? "Upgrade to Pro for 150 documents/month"
                        : "Upgrade to Agency for unlimited documents",
                },
                { status: 429 }
            )
        }

        return null
    } catch (error) {
        console.error("Document limit check failed:", error)
        return null // fail open
    }
}

// ─── Message Limit Check ──────────────────────────────────────────────────────

/**
 * Count user-role messages in a session.
 * Returns 0 on error (fail-open).
 */
export async function getSessionMessageCount(
    supabase: SupabaseClient<Database>,
    sessionId: string
): Promise<number> {
    const { count, error } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("role", "user")

    if (error) {
        console.error("Error counting session messages:", error)
        return 0  // fail-open
    }
    return count || 0
}

/**
 * Check if user can send another message in the current session.
 * Returns null if allowed, or a 429 NextResponse if limit exceeded.
 */
export async function checkMessageLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    sessionId: string,
    userTier: UserTier = "free"
): Promise<NextResponse | null> {
    try {
        const limits = TIER_LIMITS[userTier]

        // Unlimited tier
        if (limits.messagesPerSession === 0) return null

        // Count messages in this session
        const { count, error } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId)
            .eq("role", "user")

        if (error) {
            console.error("Error counting session messages:", error)
            return null // fail open
        }

        const messageCount = count || 0

        if (messageCount >= limits.messagesPerSession) {
            return NextResponse.json(
                {
                    error: "Session message limit reached",
                    currentMessages: messageCount,
                    limit: limits.messagesPerSession,
                    tier: userTier,
                    message: "Start a new session to continue. This counts as a new document.",
                },
                { status: 429 }
            )
        }

        return null
    } catch (error) {
        console.error("Message limit check failed:", error)
        return null // fail open
    }
}

// ─── Email Limit Check ────────────────────────────────────────────────────────

/**
 * Check if user can send another email this month.
 * Returns null if allowed, or a 429 NextResponse if limit exceeded.
 *
 * Limits by tier:
 *   free    →   5 emails/month  (matches doc limit — 1 send per doc)
 *   starter →  75 emails/month  (1.5× doc limit — allows resends)
 *   pro     → 300 emails/month  (2× doc limit — comfortable for follow-ups)
 *   agency  → unlimited
 */
export async function checkEmailLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    userTier: UserTier = "free"
): Promise<NextResponse | null> {
    try {
        const limits = TIER_LIMITS[userTier]

        // Unlimited tier
        if (limits.emailsPerMonth === 0) return null

        const usage = await getUserUsage(supabase, userId)
        const currentEmails = (usage as any)?.emails_count || 0

        if (currentEmails >= limits.emailsPerMonth) {
            return NextResponse.json(
                {
                    error: "Monthly email limit reached",
                    currentUsage: currentEmails,
                    limit: limits.emailsPerMonth,
                    tier: userTier,
                    message: userTier === "free"
                        ? "Upgrade to Starter for 75 emails/month"
                        : userTier === "starter"
                        ? "Upgrade to Pro for 300 emails/month"
                        : "Upgrade to Agency for unlimited emails",
                },
                { status: 429 }
            )
        }

        return null
    } catch (error) {
        console.error("Email limit check failed:", error)
        return null // fail open
    }
}

/**
 * Increment email count for the user's current month.
 * Call this AFTER a successful email send.
 */
export async function incrementEmailCount(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<void> {
    try {
        const month = getCurrentMonth()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.rpc as any)("increment_email_count", {
            p_user_id: userId,
            p_month: month,
        })

        if (error) {
            console.error("RPC increment_email_count failed, using upsert fallback:", error)
            const { data: existing } = await supabase
                .from("user_usage")
                .select("*")
                .eq("user_id", userId)
                .eq("month", month)
                .single()

            if (existing) {
                await (supabase as any)
                    .from("user_usage")
                    .update({ emails_count: ((existing as any).emails_count || 0) + 1 })
                    .eq("user_id", userId)
                    .eq("month", month)
            } else {
                await (supabase as any)
                    .from("user_usage")
                    .insert({ user_id: userId, month, emails_count: 1 })
            }
        }
    } catch (error) {
        console.error("Email count increment failed:", error)
    }
}

// ─── Email Follow-up Schedule by Tier ────────────────────────────────────────

/**
 * Returns the follow-up schedule for a given tier.
 * Each entry: { daysFromNow, sequenceStep, sequenceType }
 * Only invoices get follow-ups (contracts/quotations/proposals don't have payment links).
 *
 * Industry standard (FreshBooks/Stripe/invoicemojo.com):
 *   - Day +3:  First overdue reminder (polite)
 *   - Day +7:  Second reminder (firmer)
 *   - Day +14: Third reminder (urgent)
 *   - Day +30: Final notice
 *   Max 4 follow-ups total. Stop on payment/bounce.
 */
export function getFollowUpSchedule(tier: UserTier): Array<{
    daysFromNow: number
    sequenceStep: number
    sequenceType: "pre_due" | "due_today" | "followup" | "final"
}> {
    switch (tier) {
        case "free":
            return [] // No auto follow-ups on free tier
        case "starter":
            return [
                { daysFromNow: 3,  sequenceStep: 2, sequenceType: "followup" },
                { daysFromNow: 7,  sequenceStep: 3, sequenceType: "followup" },
            ]
        case "pro":
            return [
                { daysFromNow: 3,  sequenceStep: 2, sequenceType: "followup" },
                { daysFromNow: 7,  sequenceStep: 3, sequenceType: "followup" },
                { daysFromNow: 14, sequenceStep: 4, sequenceType: "followup" },
                { daysFromNow: 30, sequenceStep: 5, sequenceType: "final"    },
            ]
        case "agency":
            return [
                { daysFromNow: 3,  sequenceStep: 2, sequenceType: "followup" },
                { daysFromNow: 7,  sequenceStep: 3, sequenceType: "followup" },
                { daysFromNow: 14, sequenceStep: 4, sequenceType: "followup" },
                { daysFromNow: 30, sequenceStep: 5, sequenceType: "final"    },
            ]
        default:
            return []
    }
}

// ─── Document Type Check ───────────────────────────────────────────────────────

/**
 * Check if user's tier allows the requested document type.
 */
export function checkDocumentTypeAllowed(
    docType: string,
    userTier: UserTier = "free"
): NextResponse | null {
    const limits = TIER_LIMITS[userTier]
    const normalizedType = docType.toLowerCase()

    if (!limits.allowedDocTypes.includes(normalizedType)) {
        return NextResponse.json(
            {
                error: "Document type not available on your plan",
                requestedType: normalizedType,
                allowedTypes: limits.allowedDocTypes,
                tier: userTier,
                message: `Upgrade to Starter to create ${normalizedType}s`,
            },
            { status: 403 }
        )
    }

    return null
}

// ─── Legacy Cost Check (backward compatible) ─────────────────────────────────

/**
 * Check if user has exceeded their monthly cost limit.
 * Kept for backward compatibility with existing API routes.
 * Returns null if within limit, or NextResponse with 429 if exceeded.
 */
export async function checkCostLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    operationType: keyof typeof OPERATION_COSTS,
    userTier: UserTier = "free"
): Promise<NextResponse | null> {
    // Delegate to document limit check for new tier system
    return checkDocumentLimit(supabase, userId, userTier)
}

// ─── Usage Tracking ───────────────────────────────────────────────────────────

/**
 * Track AI operation usage (cost + request count).
 * Call this AFTER successful AI operation.
 */
export async function trackUsage(
    supabase: SupabaseClient<Database>,
    userId: string,
    operationType: keyof typeof OPERATION_COSTS,
    tokensUsed: number = 0
): Promise<void> {
    try {
        const month = getCurrentMonth()
        const cost = OPERATION_COSTS[operationType]

        const { error } = await supabase.rpc("increment_user_usage", {
            p_user_id: userId,
            p_month: month,
            p_requests: 1,
            p_tokens: tokensUsed,
            p_cost: cost,
        })

        if (error) {
            console.error("Error tracking usage:", error)
        }
    } catch (error) {
        console.error("Usage tracking failed:", error)
    }
}

/**
 * Increment document count for the user's current month.
 * Call this when a new document session is created.
 */
export async function incrementDocumentCount(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<void> {
    try {
        const month = getCurrentMonth()

        // Try RPC first (atomic increment)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.rpc as any)("increment_document_count", {
            p_user_id: userId,
            p_month: month,
        })

        if (error) {
            console.error("RPC increment_document_count failed, using upsert fallback:", error)
            // Fallback: direct upsert on user_usage table
            const { data: existing } = await supabase
                .from("user_usage")
                .select("documents_count")
                .eq("user_id", userId)
                .eq("month", month)
                .single()

            if (existing) {
                await supabase
                    .from("user_usage")
                    .update({ documents_count: (existing.documents_count || 0) + 1 })
                    .eq("user_id", userId)
                    .eq("month", month)
            } else {
                await supabase
                    .from("user_usage")
                    .insert({ user_id: userId, month, documents_count: 1 })
            }
        }
    } catch (error) {
        console.error("Document count increment failed:", error)
    }
}

// ─── Usage Stats ──────────────────────────────────────────────────────────────

/**
 * Get user's current usage statistics.
 */
export async function getUserUsageStats(
    supabase: SupabaseClient<Database>,
    userId: string,
    userTier: UserTier = "free"
): Promise<{
    currentMonth: string
    documentsUsed: number
    documentsLimit: number
    requestsCount: number
    tokensUsed: number
    estimatedCost: number
    percentUsed: number
    tier: UserTier
} | null> {
    try {
        const usage = await getUserUsage(supabase, userId)
        const limits = TIER_LIMITS[userTier]
        const docsUsed = usage?.documents_count || 0
        const docsLimit = limits.documentsPerMonth

        return {
            currentMonth: usage?.month || getCurrentMonth(),
            documentsUsed: docsUsed,
            documentsLimit: docsLimit,
            requestsCount: usage?.ai_requests_count || 0,
            tokensUsed: usage?.ai_tokens_used || 0,
            estimatedCost: usage?.estimated_cost_usd || 0,
            percentUsed: docsLimit > 0 ? Math.min((docsUsed / docsLimit) * 100, 100) : 0,
            tier: userTier,
        }
    } catch (error) {
        console.error("Error getting usage stats:", error)
        return null
    }
}

/**
 * Reset usage for testing (admin only).
 */
export async function resetUserUsage(
    supabase: SupabaseClient<Database>,
    userId: string,
    month?: string
): Promise<boolean> {
    try {
        const targetMonth = month || getCurrentMonth()

        const { error } = await supabase
            .from("user_usage")
            .delete()
            .eq("user_id", userId)
            .eq("month", targetMonth)

        return !error
    } catch (error) {
        console.error("Error resetting usage:", error)
        return false
    }
}
