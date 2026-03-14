/**
 * Rate Limiter — Supabase Backend Rate Limiting via Postgres RPC
 * 
 * SECURITY: Prevents DDoS, API credit exhaustion, and brute-force attacks.
 * Rate limits are enforced server-side in Postgres (not in-memory).
 * This survives server restarts, works across multiple instances, and cannot
 * be bypassed by the client.
 * 
 * Each route category has its own limit:
 *   - AI routes: 50 req/min (increased for onboarding)
 *   - Export routes: 20 req/min
 *   - Other routes: 30 req/min
 * 
 * Uses user ID as the key (requires auth first).
 * 
 * Usage:
 *   const rateLimitError = await checkRateLimit(userId, "ai", supabase)
 *   if (rateLimitError) return rateLimitError
 */

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// ── Configuration ──────────────────────────────────────────────────────

type RouteCategory = "ai" | "export" | "general"

const RATE_LIMITS: Record<RouteCategory, { maxRequests: number; windowSeconds: number }> = {
    ai: { maxRequests: 50, windowSeconds: 60 },       // 50 req/min for AI calls (increased for onboarding)
    export: { maxRequests: 20, windowSeconds: 60 },    // 20 req/min for exports
    general: { maxRequests: 30, windowSeconds: 60 },   // 30 req/min for other
}

// ── Helper: Extract access token from cookies ──────────────────────────

async function getAccessTokenFromCookies(): Promise<string | undefined> {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(c => c.name.startsWith("sb-") && c.name.includes("-auth-token"))

    if (authCookies.length === 0) return undefined

    const baseName = authCookies[0].name.replace(/\.\d+$/, "")
    const chunks = allCookies
        .filter(c => c.name === baseName || c.name.startsWith(baseName + "."))
        .sort((a, b) => {
            const aIdx = a.name.includes(".") ? parseInt(a.name.split(".").pop()!) : 0
            const bIdx = b.name.includes(".") ? parseInt(b.name.split(".").pop()!) : 0
            return aIdx - bIdx
        })
        .map(c => c.value)
        .join("")

    try {
        const parsed = JSON.parse(chunks)
        return parsed.access_token
    } catch {
        return undefined
    }
}

// ── Helper: Create authenticated Supabase client ───────────────────────

async function createAuthenticatedClient() {
    const accessToken = await getAccessTokenFromCookies()
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            },
        }
    )
}

// ── Main Function ──────────────────────────────────────────────────────

/**
 * Check rate limit for a user + route category via Supabase Postgres RPC.
 * Returns null if within limit, or a 429 NextResponse if exceeded.
 * 
 * @param identifier - User ID (UUID)
 * @param category - Route category for limit selection
 */
export async function checkRateLimit(
    identifier: string,
    category: RouteCategory
): Promise<NextResponse | null> {
    const config = RATE_LIMITS[category]

    try {
        const supabase = await createAuthenticatedClient()

        const { data, error } = await supabase.rpc('check_rate_limit', {
            p_user_id: identifier,
            p_category: category,
            p_max_requests: config.maxRequests,
            p_window_seconds: config.windowSeconds,
        })

        if (error) {
            console.error("Rate limit RPC error:", error)
            // FAIL OPEN: if the rate limiter DB is down, allow the request
            // but log it for ops alerting
            return null
        }

        const result = data as { allowed: boolean; remaining: number; retry_after: number; error?: string }

        if (result.error) {
            console.error("Rate limit validation error:", result.error)
            return NextResponse.json(
                { error: "Rate limit configuration error" },
                { status: 500 }
            )
        }

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: "Rate limit exceeded. Please try again later.",
                    retryAfter: result.retry_after,
                },
                {
                    status: 429,
                    headers: {
                        "Retry-After": String(result.retry_after),
                        "X-RateLimit-Limit": String(config.maxRequests),
                        "X-RateLimit-Remaining": "0",
                    },
                }
            )
        }

        return null
    } catch (err) {
        console.error("Rate limit check failed:", err)
        // FAIL OPEN with logging — don't block users if rate limiter has issues
        return null
    }
}

/**
 * Get remaining requests for a user + category
 */
export async function getRateLimitRemaining(
    _identifier: string,
    category: RouteCategory
): Promise<number> {
    const config = RATE_LIMITS[category]
    // Return the max as a fallback — a production system would have a separate read-only function
    return config.maxRequests
}
