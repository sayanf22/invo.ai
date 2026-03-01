/**
 * Cost Protection Module
 * 
 * Tracks and limits AI API spending per user to prevent cost abuse.
 * Implements monthly spending limits and usage tracking.
 */

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

// Cost limits per user tier
const COST_LIMITS = {
    free: 5.0,      // $5/month for free tier
    pro: 50.0,      // $50/month for pro tier
    enterprise: 500.0, // $500/month for enterprise
}

// Estimated costs per operation (in USD)
const OPERATION_COSTS = {
    onboarding: 0.005,           // DeepSeek Chat
    generation: 0.00094,         // DeepSeek Reasoner with cache
    generation_no_cache: 0.003,  // DeepSeek Reasoner without cache
    embedding: 0.00001,          // OpenAI embeddings
}

interface UsageRecord {
    user_id: string
    month: string
    ai_requests_count: number
    ai_tokens_used: number
    estimated_cost_usd: number
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/**
 * Get user's current month usage
 */
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
    
    if (error && error.code !== "PGRST116") { // PGRST116 = no rows
        console.error("Error fetching user usage:", error)
        return null
    }
    
    return data as UsageRecord | null
}

/**
 * Check if user has exceeded their monthly cost limit
 * Returns null if within limit, or NextResponse with 429 if exceeded
 */
export async function checkCostLimit(
    supabase: SupabaseClient<Database>,
    userId: string,
    operationType: keyof typeof OPERATION_COSTS,
    userTier: "free" | "pro" | "enterprise" = "free"
): Promise<NextResponse | null> {
    try {
        const usage = await getUserUsage(supabase, userId)
        const currentCost = usage?.estimated_cost_usd || 0
        const operationCost = OPERATION_COSTS[operationType]
        const limit = COST_LIMITS[userTier]
        
        // Check if adding this operation would exceed limit
        if (currentCost + operationCost > limit) {
            return NextResponse.json(
                {
                    error: "Monthly AI usage limit exceeded",
                    currentUsage: currentCost.toFixed(2),
                    limit: limit.toFixed(2),
                    tier: userTier,
                    message: userTier === "free" 
                        ? "Upgrade to Pro for higher limits"
                        : "Contact support to increase your limit",
                },
                { status: 429 }
            )
        }
        
        return null
    } catch (error) {
        console.error("Cost limit check failed:", error)
        // FAIL OPEN: Don't block users if cost tracking has issues
        return null
    }
}

/**
 * Track AI operation usage
 * Call this AFTER successful AI operation
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
        
        // Upsert usage record
        const { error } = await supabase.rpc("increment_user_usage", {
            p_user_id: userId,
            p_month: month,
            p_requests: 1,
            p_tokens: tokensUsed,
            p_cost: cost,
        })
        
        if (error) {
            console.error("Error tracking usage:", error)
            // Don't throw - usage tracking failure shouldn't break the app
        }
    } catch (error) {
        console.error("Usage tracking failed:", error)
    }
}

/**
 * Get user's current usage statistics
 */
export async function getUserUsageStats(
    supabase: SupabaseClient<Database>,
    userId: string
): Promise<{
    currentMonth: string
    requestsCount: number
    tokensUsed: number
    estimatedCost: number
    limit: number
    percentUsed: number
    tier: string
} | null> {
    try {
        const usage = await getUserUsage(supabase, userId)
        
        if (!usage) {
            return {
                currentMonth: getCurrentMonth(),
                requestsCount: 0,
                tokensUsed: 0,
                estimatedCost: 0,
                limit: COST_LIMITS.free,
                percentUsed: 0,
                tier: "free",
            }
        }
        
        // TODO: Get user tier from database
        const tier = "free"
        const limit = COST_LIMITS[tier]
        const percentUsed = (usage.estimated_cost_usd / limit) * 100
        
        return {
            currentMonth: usage.month,
            requestsCount: usage.ai_requests_count,
            tokensUsed: usage.ai_tokens_used,
            estimatedCost: usage.estimated_cost_usd,
            limit,
            percentUsed: Math.min(percentUsed, 100),
            tier,
        }
    } catch (error) {
        console.error("Error getting usage stats:", error)
        return null
    }
}

/**
 * Reset usage for testing (admin only)
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
