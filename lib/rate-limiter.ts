/**
 * Rate Limiter — Supabase Backend Rate Limiting via Postgres RPC
 * 
 * SECURITY: Prevents DDoS, API credit exhaustion, and brute-force attacks.
 * Rate limits are enforced server-side in Postgres (not in-memory).
 * This survives server restarts, works across multiple instances, and cannot
 * be bypassed by the client.
 * 
 * Each route category has its own limit:
 *   - AI routes: 10 req/min (expensive API calls)
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
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// ── Configuration ──────────────────────────────────────────────────────

type RouteCategory = "ai" | "export" | "general"

const RATE_LIMITS: Record<RouteCategory, { maxRequests: number; windowSeconds: number }> = {
    ai: { maxRequests: 10, windowSeconds: 60 },       // 10 req/min for AI calls
    export: { maxRequests: 20, windowSeconds: 60 },    // 20 req/min for exports
    general: { maxRequests: 30, windowSeconds: 60 },   // 30 req/min for other
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
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // Server Component context
                        }
                    },
                },
            }
        )

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
    identifier: string,
    category: RouteCategory
): Promise<number> {
    const config = RATE_LIMITS[category]

    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // Server Component context
                        }
                    },
                },
            }
        )

        // We do a "dry" check — but since check_rate_limit records the request,
        // we can't do a pure read. Return the max as a fallback.
        // In a production system, you'd have a separate read-only function.
        return config.maxRequests
    } catch {
        return config.maxRequests
    }
}
