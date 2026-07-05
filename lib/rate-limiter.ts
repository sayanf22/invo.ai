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

type RouteCategory = "ai" | "export" | "general" | "storage" | "payment" | "email" | "signature" | "file_analysis"

const RATE_LIMITS: Record<RouteCategory, { maxRequests: number; windowSeconds: number }> = {
    ai: { maxRequests: 50, windowSeconds: 60 },       // 50 req/min for AI calls (increased for onboarding)
    export: { maxRequests: 20, windowSeconds: 60 },    // 20 req/min for exports
    storage: { maxRequests: 30, windowSeconds: 60 },   // 30 req/min for file uploads
    general: { maxRequests: 120, windowSeconds: 60 },   // 120 req/min for other API calls (page loads make many calls)
    payment: { maxRequests: 20, windowSeconds: 60 },   // 20 req/min for payment link creation
    email: { maxRequests: 15, windowSeconds: 60 },     // 15 req/min for email sending
    signature: { maxRequests: 10, windowSeconds: 60 }, // 10 req/min for signature requests
    // 40 req/min for OpenAI vision file extraction. Raised twice: 10 -> 20 was
    // still too tight because each file that needs an OpenAI-side transient
    // retry counts as 2 requests against this window, so a normal onboarding
    // batch of several documents (each potentially retrying once) burns
    // through a low budget fast. The REAL cost control is the separate
    // per-user monthly checkCostLimit() — this per-minute gate only exists to
    // stop a runaway burst, so it can afford to be generous.
    file_analysis: { maxRequests: 40, windowSeconds: 60 },
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
 * @param supabaseClient - Optional: pass the authenticated client from authenticateRequest
 *   to avoid JWT context mismatches on Cloudflare Workers. If not provided, falls back
 *   to creating a new client from cookies (works in standard Next.js environments).
 */
export async function checkRateLimit(
    identifier: string,
    category: RouteCategory,
    supabaseClient?: ReturnType<typeof createClient>
): Promise<NextResponse | null> {
    const config = RATE_LIMITS[category]

    try {
        const supabase = supabaseClient ?? await createAuthenticatedClient()

        const { data, error } = await (supabase as any).rpc('check_rate_limit', {
            p_user_id: identifier,
            p_category: category,
            p_max_requests: config.maxRequests,
            p_window_seconds: config.windowSeconds,
        })

        if (error) {
            console.error("Rate limit RPC error:", error)
            // FAIL OPEN: if the rate limiter DB is down, allow the request
            return null
        }

        const result = data as { allowed: boolean; remaining: number; retry_after: number; error?: string }

        if (!result || result.error === 'Unauthorized') {
            // JWT context mismatch — fail open rather than block legitimate users
            console.warn("Rate limit: JWT context mismatch, failing open for", category)
            return null
        }

        if (result.error) {
            console.error("Rate limit validation error:", result.error)
            return null // Fail open for config errors
        }

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: "You've uploaded several files in a short time. Give it a minute and try again — or continue in the chat and type your details.",
                    // Distinguishes "our own app-level throttle" from an upstream OpenAI
                    // 429 so the client knows NOT to retry quickly — the window genuinely
                    // hasn't cleared yet, unlike a transient OpenAI rate limit.
                    code: "app_rate_limit",
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
        // FAIL OPEN with logging
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
