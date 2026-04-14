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
import { logAudit } from "./audit-log"
import type { Database } from "./database.types"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

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

// ── Helper: Create Supabase client for audit logging ───────────────────

function createAuditSupabaseClient(): SupabaseClient<Database> | null {
    try {
        return createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
    } catch {
        return null
    }
}

/** Fire-and-forget audit log helper — never throws */
function fireAndForgetAuditLog(
    action: Parameters<typeof logAudit>[1]["action"],
    metadata: Record<string, unknown>,
    request?: Request
): void {
    try {
        const auditSupabase = createAuditSupabaseClient()
        if (!auditSupabase) return
        logAudit(
            auditSupabase,
            {
                user_id: "anonymous",
                action,
                metadata: metadata as any,
            },
            request as unknown as NextRequest
        ).catch(() => {})
    } catch {
        // Never throw from audit logging
    }
}

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

        let decoded = chunks
        // Handle base64-prefixed cookies (from @supabase/ssr)
        if (decoded.startsWith("base64-")) {
            try { decoded = atob(decoded.slice(7)) } catch {}
        }
        // Handle URL-encoded cookies
        if (decoded.startsWith("%7B") || decoded.startsWith("%5B")) {
            try { decoded = decodeURIComponent(decoded) } catch {}
        }
        const parsed = JSON.parse(decoded)
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
            // Fire-and-forget audit log for auth failure
            if (request) {
                fireAndForgetAuditLog(
                    "security.auth_failure",
                    { reason: error?.message || "no_user", path: new URL(request.url).pathname },
                    request
                )
            }
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
            "AI service temporarily unavailable. Please try again.",
            "Operation failed. Please try again.",
        ]
        for (const safe of safeMessages) {
            if (error.message.includes(safe)) return error.message
        }
    }
    return "Internal server error"
}

/**
 * Get client IP address from request
 * Checks cf-connecting-ip first (Cloudflare Workers), then x-forwarded-for, then x-real-ip
 */
export function getClientIP(request: Request): string {
    const headers = request.headers
    
    // Cloudflare Workers: most reliable source
    const cfConnectingIP = headers.get("cf-connecting-ip")
    if (cfConnectingIP) {
        return cfConnectingIP
    }
    
    // Standard proxy header
    const forwarded = headers.get("x-forwarded-for")
    if (forwarded) {
        return forwarded.split(",")[0].trim()
    }
    
    const realIP = headers.get("x-real-ip")
    if (realIP) {
        return realIP
    }
    
    return "unknown"
}

/**
 * Validate request origin against allowed origins.
 * - For GET/HEAD/OPTIONS: missing Origin+Referer is allowed (same-origin browser behavior)
 * - For POST/PUT/DELETE: missing both Origin and Referer is suspicious → reject with 403
 * - Localhost origins are only allowed when NODE_ENV !== 'production'
 */
export function validateOrigin(request: Request): NextResponse | null {
    const origin = request.headers.get("origin")
    const referer = request.headers.get("referer")
    const method = request.method.toUpperCase()
    
    const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"]
    const isStateChanging = stateChangingMethods.includes(method)
    
    // For state-changing requests, reject when both Origin and Referer are absent
    if (!origin && !referer) {
        if (isStateChanging) {
            // Fire-and-forget audit log for origin failure
            fireAndForgetAuditLog(
                "security.origin_failure",
                { reason: "missing_origin_and_referer", method, path: new URL(request.url).pathname },
                request
            )
            return NextResponse.json(
                { error: "Invalid origin" },
                { status: 403 }
            )
        }
        // Allow same-origin GET/HEAD/OPTIONS (browsers may omit Origin)
        return null
    }
    
    const allowedOrigins: string[] = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        "https://clorefy.com",
        // Only include localhost origins in non-production environments
        ...(process.env.NODE_ENV !== "production"
            ? ["http://localhost:3000", "http://localhost:3001"]
            : []),
    ].filter(Boolean) as string[]
    
    // Check origin (Origin header is always scheme+host+port, no path)
    if (origin && !allowedOrigins.some(allowed => origin === allowed)) {
        // Fire-and-forget audit log for origin failure
        fireAndForgetAuditLog(
            "security.origin_failure",
            { reason: "disallowed_origin", origin, method, path: new URL(request.url).pathname },
            request
        )
        return NextResponse.json(
            { error: "Invalid origin" },
            { status: 403 }
        )
    }
    
    // Check referer as fallback (Referer includes path, so check prefix + boundary)
    if (!origin && referer && !allowedOrigins.some(allowed =>
        referer === allowed || referer.startsWith(allowed + "/")
    )) {
        // Fire-and-forget audit log for referer failure
        fireAndForgetAuditLog(
            "security.origin_failure",
            { reason: "disallowed_referer", referer, method, path: new URL(request.url).pathname },
            request
        )
        return NextResponse.json(
            { error: "Invalid referer" },
            { status: 403 }
        )
    }
    
    return null
}
