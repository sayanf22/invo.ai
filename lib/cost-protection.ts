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
import { ALL_DOCUMENT_TYPES, normalizeDocumentType } from "@/lib/document-type-registry"

// ─── Tier Definitions ─────────────────────────────────────────────────────────

export type UserTier = "free" | "starter" | "pro" | "agency"

const VALID_TIERS: readonly UserTier[] = ["free", "starter", "pro", "agency"] as const

/**
 * Safely parse a tier value from the database.
 * Returns "free" if the value is invalid or missing.
 * Prevents tier bypass via malicious DB entries.
 */
export function parseTier(value: unknown): UserTier {
    if (typeof value === "string" && (VALID_TIERS as readonly string[]).includes(value)) {
        return value as UserTier
    }
    return "free"
}

// ─── Subscription Expiry Enforcement ──────────────────────────────────────────

export interface SubscriptionRecord {
    plan: string | null
    status: string | null
    current_period_end: string | null
}

/**
 * Resolve the effective tier for a user based on their subscription record.
 * Returns "free" if the subscription is missing, expired, or cancelled.
 * A null current_period_end is treated as "no expiry" (admin grants).
 */
export function resolveEffectiveTier(subscription: SubscriptionRecord | null | undefined): UserTier {
    if (!subscription) return "free"

    const tier = parseTier(subscription.plan)
    if (tier === "free") return "free"

    // A paid period remains entitled through its exact provider-supplied end,
    // even if cancellation or renewal-failure status arrives early. This keeps
    // period-end cancellations and already-paid grace periods from losing access.
    if (subscription.current_period_end) {
        const periodEnd = Date.parse(subscription.current_period_end)
        if (!Number.isFinite(periodEnd) || periodEnd <= Date.now()) return "free"
        return tier
    }

    // A null end is reserved for perpetual/admin grants. Only live statuses may
    // use that exceptional path; a cancelled grant must not remain perpetual.
    return !subscription.status || ["active", "trialing"].includes(subscription.status)
        ? tier
        : "free"
}

interface TierLimits {
    documentsPerMonth: number  // 0 = unlimited
    messagesPerSession: number // 0 = unlimited
    chatMessagesPerSession: number // 0 = unlimited; separate cap for chat-only sessions
    emailsPerMonth: number     // 0 = unlimited
    allowedDocTypes: string[]
}

const TIER_LIMITS: Record<UserTier, TierLimits> = {
    free: {
        documentsPerMonth: 5,
        messagesPerSession: 10,
        chatMessagesPerSession: 200,
        emailsPerMonth: 5,
        allowedDocTypes: ["invoice", "contract", "quote"],
    },
    starter: {
        documentsPerMonth: 50,
        messagesPerSession: 30,
        chatMessagesPerSession: 500,
        emailsPerMonth: 100,
        allowedDocTypes: [...ALL_DOCUMENT_TYPES],
    },
    pro: {
        documentsPerMonth: 150,
        messagesPerSession: 50,
        chatMessagesPerSession: 1500,
        emailsPerMonth: 250,
        allowedDocTypes: [...ALL_DOCUMENT_TYPES],
    },
    agency: {
        documentsPerMonth: 0,
        messagesPerSession: 0,
        chatMessagesPerSession: 0,    // unlimited
        emailsPerMonth: 0,
        allowedDocTypes: [...ALL_DOCUMENT_TYPES],
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

/**
 * Returns information about the next tier to upgrade to from the current tier.
 * Used by the message-limit banner to derive upgrade copy from a single source of truth.
 *
 * - free    → starter (30 messages/session)
 * - starter → pro     (50 messages/session)
 * - pro     → null    (already at a top messaging tier)
 * - agency  → null    (unlimited — should never show the banner)
 */
export function nextTierUpgrade(currentTier: UserTier): {
    nextTier: UserTier | null
    label: string | null
    messagesPerSession: number | null
} {
    switch (currentTier) {
        case "free":
            return {
                nextTier: "starter",
                label: "Starter",
                messagesPerSession: TIER_LIMITS.starter.messagesPerSession,
            }
        case "starter":
            return {
                nextTier: "pro",
                label: "Pro",
                messagesPerSession: TIER_LIMITS.pro.messagesPerSession,
            }
        case "pro":
        case "agency":
        default:
            return { nextTier: null, label: null, messagesPerSession: null }
    }
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

// ─── Chat Message Limit Check ─────────────────────────────────────────────────

/**
 * Check if user can send another message in a CHAT-ONLY session.
 * These sessions use a separate, more generous limit than document sessions.
 * Returns null if allowed, or a 429 NextResponse if limit exceeded.
 */
export async function checkChatMessageLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    sessionId: string,
    userTier: UserTier = "free"
): Promise<NextResponse | null> {
    try {
        const limits = TIER_LIMITS[userTier]

        // Unlimited tier
        if (limits.chatMessagesPerSession === 0) return null

        const { count, error } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("session_id", sessionId)
            .eq("role", "user")

        if (error) {
            console.error("Error counting chat messages:", error)
            return null // fail open
        }

        // +1 for the in-flight message not yet saved
        const messageCount = (count || 0) + 1

        if (messageCount > limits.chatMessagesPerSession) {
            return NextResponse.json(
                {
                    error: "Chat message limit reached for this session",
                    currentMessages: messageCount - 1,
                    limit: limits.chatMessagesPerSession,
                    tier: userTier,
                    message: userTier === "free"
                        ? `You've used all ${limits.chatMessagesPerSession} chat messages in this session. Upgrade to Starter for 500 messages/session.`
                        : userTier === "starter"
                        ? `You've used all ${limits.chatMessagesPerSession} chat messages in this session. Upgrade to Pro for 1,500 messages/session.`
                        : `You've used all ${limits.chatMessagesPerSession} chat messages in this session. Start a new chat or upgrade for unlimited.`,
                },
                { status: 429 }
            )
        }

        return null
    } catch (error) {
        console.error("Chat message limit check failed:", error)
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
 *
 * NOTE: The current user message hasn't been saved to DB yet when this
 * check runs (it's saved AFTER the AI response in the frontend).
 * So we add +1 to the DB count to account for the in-flight message.
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

        // +1 because the current message hasn't been saved to DB yet
        // (frontend saves it AFTER the AI response succeeds)
        const messageCount = (count || 0) + 1

        if (messageCount > limits.messagesPerSession) {
            return NextResponse.json(
                {
                    error: "Session message limit reached",
                    currentMessages: messageCount - 1, // show actual saved count to user
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
 *   starter → 100 emails/month  (2× doc limit — allows resends + follow-ups)
 *   pro     → 250 emails/month  (comfortable for follow-ups across all docs)
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

        const month = getCurrentMonth()
        const { data: usage, error } = await supabase
            .from("user_usage")
            .select("emails_count")
            .eq("user_id", userId)
            .eq("month", month)
            .maybeSingle()

        if (error) {
            console.error("Email limit check DB error:", error)
            return null // fail open
        }

        const currentEmails = (usage as any)?.emails_count ?? 0

        if (currentEmails >= limits.emailsPerMonth) {
            return NextResponse.json(
                {
                    error: "Monthly email limit reached",
                    currentUsage: currentEmails,
                    limit: limits.emailsPerMonth,
                    tier: userTier,
                    message: userTier === "free"
                        ? `You've used all ${limits.emailsPerMonth} emails this month. Upgrade to Starter for 100 emails/month.`
                        : userTier === "starter"
                        ? `You've used all ${limits.emailsPerMonth} emails this month. Upgrade to Pro for 250 emails/month.`
                        : `You've used all ${limits.emailsPerMonth} emails this month. Upgrade to Agency for unlimited emails.`,
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
            // Upsert fallback — handles both insert and update atomically
            await (supabase as any)
                .from("user_usage")
                .upsert(
                    { user_id: userId, month, emails_count: 1 },
                    { onConflict: "user_id,month", ignoreDuplicates: false }
                )
        }
    } catch (error) {
        console.error("Email count increment failed:", error)
    }
}

// ─── Email Follow-up Schedule by Tier ────────────────────────────────────────

/**
 * Returns the follow-up schedule for a given tier.
 * Each entry: { daysFromNow, sequenceStep, sequenceType }
 * `daysFromNow` is relative to the invoice due date:
 *   - Negative = before due date (polite pre-due nudge)
 *   - 0        = on due date
 *   - Positive = after due date (overdue reminders)
 *
 * Only invoices get follow-ups (contracts/quotations/proposals don't have payment links).
 *
 * Industry standard 2026 (Stripe/QuickBooks/FreshBooks/Invoicemojo):
 *   - Day -3:  Pre-due polite reminder
 *   - Day  0:  Due-today gentle nudge
 *   - Day +3:  First overdue reminder (polite)
 *   - Day +7:  Second reminder (firmer)
 *   - Day +14: Third reminder (urgent)
 *   - Day +30: Final notice (last reminder — payment link must stay alive at least +7 more days)
 *
 * After the final reminder, users get 7+ days grace period before the payment link expires.
 * This aligns with Stripe/QuickBooks invoicing best practice: link lifetime >= last reminder + 7 days grace.
 *
 * All paid tiers share the same schedule — differentiation is via document/email volume limits,
 * not via reminder cadence (which is a correctness property, not a tier feature).
 */
export function getFollowUpSchedule(tier: UserTier): Array<{
    daysFromNow: number
    sequenceStep: number
    sequenceType: "pre_due" | "due_today" | "followup" | "final"
}> {
    // Free tier gets no auto follow-ups
    if (tier === "free") return []

    // All paid tiers (starter, pro, agency) share the same industry-standard cadence
    return [
        { daysFromNow: -3, sequenceStep: 1, sequenceType: "pre_due"   },
        { daysFromNow: 0,  sequenceStep: 2, sequenceType: "due_today" },
        { daysFromNow: 3,  sequenceStep: 3, sequenceType: "followup"  },
        { daysFromNow: 7,  sequenceStep: 4, sequenceType: "followup"  },
        { daysFromNow: 14, sequenceStep: 5, sequenceType: "followup"  },
        { daysFromNow: 30, sequenceStep: 6, sequenceType: "final"     },
    ]
}

/**
 * Minimum payment link lifetime in days, aligned with final reminder + grace period.
 *
 * Industry rule (Stripe hosted invoices, QuickBooks, FreshBooks):
 *   Payment link MUST outlive the entire reminder sequence plus a grace period,
 *   so users who receive the final reminder still have time to pay.
 *
 * Invariant enforced here:
 *   linkLifetime >= (lastReminderDayAfterDue + 7-day grace) AND >= 30 days (user-specified minimum)
 */
export function getMinPaymentLinkLifetimeDays(tier: UserTier): number {
    const GRACE_DAYS = 7          // Days after final reminder before link expires
    const MIN_LIFETIME = 30       // User-specified hard floor: link must live at least 1 month

    const schedule = getFollowUpSchedule(tier)
    // Only positive days (post-due reminders) matter for the lifetime calculation
    const lastReminderDay = schedule.reduce((max, entry) => Math.max(max, entry.daysFromNow), 0)
    const lifetime = lastReminderDay + GRACE_DAYS
    return Math.max(lifetime, MIN_LIFETIME)
}

// ─── Document Type Check ───────────────────────────────────────────────────────

/**
 * Check if user's tier allows the requested document type.
 * 
 * Invoice invariant: "invoice" is always accessible regardless of tier,
 * providing a hard short-circuit before consulting allowedDocTypes to
 * ensure this can never be denied by configuration drift.
 */
export function checkDocumentTypeAllowed(
    docType: string,
    userTier: UserTier = "free"
): NextResponse | null {
    const normalized = normalizeDocumentType(docType) ?? docType.toLowerCase()

    // Invariant: invoice is always accessible regardless of tier
    if (normalized === "invoice") return null

    const limits = TIER_LIMITS[userTier]

    if (!limits.allowedDocTypes.includes(normalized)) {
        const typeLabel = normalized.charAt(0).toUpperCase() + normalized.slice(1)
        const upgradeMessage = userTier === "free"
            ? `${typeLabel}s are available on Starter and above. Your Free plan includes invoices, contracts, and quotes.`
            : `${typeLabel}s are not available on your current plan.`

        return NextResponse.json(
            {
                error: "Document type not available on your plan",
                requestedType: normalized,
                allowedTypes: limits.allowedDocTypes,
                tier: userTier,
                message: upgradeMessage,
                // Distinguish type restriction from quota exhaustion
                restrictionType: "document_type",
            },
            { status: 403 }
        )
    }

    return null
}

// ─── Tier Lookup Helper ───────────────────────────────────────────────────────

/**
 * Fetch the user's effective subscription tier in a single call.
 * Eliminates the copy-pasted subscription fetch that appeared in 10+ routes.
 *
 * Falls back to "free" on any DB error so the caller never gets an unhandled
 * promise rejection. Uses maybeSingle() instead of single() so a missing row
 * (new user with no subscription yet) returns null gracefully.
 */
export async function getUserTier(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<UserTier> {
    try {
        const { data: subscription } = await (supabase as any)
            .from("subscriptions")
            .select("plan, status, current_period_end")
            .eq("user_id", userId)
            .maybeSingle()
        return resolveEffectiveTier(subscription)
    } catch {
        return "free" // fail-safe: never block user on DB errors
    }
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
