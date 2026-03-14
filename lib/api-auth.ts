/**
 * API Auth Helper — Server-side authentication for ALL API routes
 * 
 * SECURITY: Every API route MUST call `authenticateRequest()` before processing.
 * This uses the user's cookies to verify their Supabase session server-side.
 * Returns 401 if not authenticated.
 * 
 * Usage:
 *   const auth = await authenticateRequest()
 *   if (auth.error) return auth.error  // Returns NextResponse with 401
 *   const { user, supabase } = auth
 */

import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "./database.types"
import type { SupabaseClient, User } from "@supabase/supabase-js"

// ── Types ──────────────────────────────────────────────────────────────

interface AuthSuccess {
    user: User
    supabase: SupabaseClient<Database>
    error: null
}

interface AuthFailure {
    user: null
    supabase: null
    error: NextResponse
}

type AuthResult = AuthSuccess | AuthFailure

// ── Helper: Extract access token from cookies ──────────────────────────

async function getAccessTokenFromCookies(): Promise<string | undefined> {
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const authCookies = allCookies.filter(c => c.name.startsWith("sb-") && c.name.includes("-auth-token"))

        if (authCookies.length === 0) return undefined

        // Reconstruct from chunked cookies
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

        const parsed = JSON.parse(chunks)
        return parsed.access_token
    } catch (err) {
        console.error("[api-auth] Cookie extraction failed:", err)
        return undefined
    }
}

// ── Main Auth Function ─────────────────────────────────────────────────

export async function authenticateRequest(request?: Request): Promise<AuthResult> {
    try {
        // Try cookies first (standard Next.js approach)
        let accessToken = await getAccessTokenFromCookies()

        // Fallback: read Authorization header (for Cloudflare Workers where cookies may not work)
        if (!accessToken && request) {
            const authHeader = request.headers.get("authorization")
            if (authHeader?.startsWith("Bearer ")) {
                accessToken = authHeader.slice(7)
            }
        }

        if (!accessToken) {
            console.error("[api-auth] No access token found in cookies or Authorization header")
        }

        const supabase = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
                },
            }
        )

        // IMPORTANT: getUser() validates the JWT server-side via Supabase Auth
        // Do NOT use getSession() — it only reads the local cookie without validation
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser()

        if (error || !user) {
            return {
                user: null,
                supabase: null,
                error: NextResponse.json(
                    { error: "Unauthorized. Please log in." },
                    { status: 401 }
                ),
            }
        }

        return { user, supabase: supabase as SupabaseClient<Database>, error: null }
    } catch (err) {
        console.error("Auth check failed:", err)
        return {
            user: null,
            supabase: null,
            error: NextResponse.json(
                { error: "Authentication failed" },
                { status: 401 }
            ),
        }
    }
}

// ── Input Validation Helpers ───────────────────────────────────────────

/**
 * Validate request body size. Returns error response if too large.
 * @param body - The parsed request body
 * @param maxSizeBytes - Maximum allowed size (default: 50KB)
 */
export function validateBodySize(
    body: unknown,
    maxSizeBytes: number = 50 * 1024
): NextResponse | null {
    const bodyStr = JSON.stringify(body)
    if (bodyStr.length > maxSizeBytes) {
        return NextResponse.json(
            { error: `Request body too large. Maximum ${Math.round(maxSizeBytes / 1024)}KB allowed.` },
            { status: 413 }
        )
    }
    return null
}

/**
 * Sanitize error for client response. Never expose internals.
 */
export function sanitizeError(error: unknown): string {
    if (error instanceof Error) {
        // Only return known safe error messages
        const safeMessages = [
            "Prompt is required",
            "Missing required fields",
            "Rate limit exceeded",
            "Request body too large",
            "Invalid document type",
            "Invalid email format",
            "Invalid country code",
            "Invalid currency code",
            "CSRF token",
            "Monthly AI usage limit exceeded",
        ]
        for (const safe of safeMessages) {
            if (error.message.includes(safe)) return error.message
        }
    }
    return "Internal server error"
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
    const headers = request.headers
    
    // Check common proxy headers
    const forwarded = headers.get("x-forwarded-for")
    if (forwarded) {
        return forwarded.split(",")[0].trim()
    }
    
    const realIP = headers.get("x-real-ip")
    if (realIP) {
        return realIP
    }
    
    const cfConnectingIP = headers.get("cf-connecting-ip") // Cloudflare
    if (cfConnectingIP) {
        return cfConnectingIP
    }
    
    return "unknown"
}

/**
 * Validate request origin against allowed origins
 */
export function validateOrigin(request: Request): NextResponse | null {
    const origin = request.headers.get("origin")
    const referer = request.headers.get("referer")
    
    // Allow same-origin requests (no origin header)
    if (!origin && !referer) {
        return null
    }
    
    const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        "https://invoai.proj-invo.workers.dev",
        "http://localhost:3000",
        "http://localhost:3001",
    ].filter(Boolean) as string[]
    
    // Check origin
    if (origin && !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
        return NextResponse.json(
            { error: "Invalid origin" },
            { status: 403 }
        )
    }
    
    // Check referer as fallback
    if (!origin && referer && !allowedOrigins.some(allowed => referer.startsWith(allowed))) {
        return NextResponse.json(
            { error: "Invalid referer" },
            { status: 403 }
        )
    }
    
    return null
}
