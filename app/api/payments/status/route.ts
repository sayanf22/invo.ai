import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/payments/status?sessionId=xxx
 *
 * PUBLIC endpoint — no authentication required.
 * Returns only public-safe payment status fields for a given session.
 *
 * SECURITY:
 * - No user data, gateway URLs, or sensitive fields are returned
 * - Session ID acts as an unguessable token (UUID v4)
 * - IP-based rate limiting: 30 requests per minute per IP
 * - Service role key used for DB access (bypasses RLS safely)
 */

// ── In-memory IP rate limiter ──────────────────────────────────────────

const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

interface RateLimitEntry {
    count: number
    resetAt: number
}

const ipRateLimitMap = new Map<string, RateLimitEntry>()

function checkIpRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now()
    const entry = ipRateLimitMap.get(ip)

    if (!entry || now >= entry.resetAt) {
        // New window
        ipRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
        return { allowed: true, retryAfter: 0 }
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        return { allowed: false, retryAfter }
    }

    entry.count++
    return { allowed: true, retryAfter: 0 }
}

function getClientIp(request: NextRequest): string {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "unknown"
    )
}

// ── Route Handler ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    // 1. IP-based rate limiting
    const ip = getClientIp(request)
    const { allowed, retryAfter } = checkIpRateLimit(ip)

    if (!allowed) {
        return NextResponse.json(
            { error: "Rate limit exceeded. Please try again later." },
            {
                status: 429,
                headers: {
                    "Retry-After": String(retryAfter),
                    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
                    "X-RateLimit-Remaining": "0",
                },
            }
        )
    }

    // 2. Validate sessionId param
    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // Basic UUID format check to avoid unnecessary DB queries
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId format" }, { status: 400 })
    }

    // 3. Fetch from DB using service role (no auth required)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabaseAdmin
        .from("invoice_payments")
        .select("status, amount, currency, amount_paid")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error("Payment status fetch error:", error)
        return NextResponse.json({ error: "Failed to fetch payment status" }, { status: 500 })
    }

    // 4. Return 404 for non-existent sessions
    if (!data) {
        return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
    }

    // 5. Return only public-safe fields
    return NextResponse.json({
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        amountPaid: data.amount_paid,
    })
}
