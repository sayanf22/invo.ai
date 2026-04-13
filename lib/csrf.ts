/**
 * CSRF Protection Module
 * 
 * Implements CSRF token generation and validation for state-changing operations.
 * Per OWASP recommendations: Use synchronizer token pattern for API routes.
 * 
 * Usage in API routes:
 *   const csrfError = await validateCSRFToken(request)
 *   if (csrfError) return csrfError
 */

import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHmac, timingSafeEqual } from "crypto"
import { logAudit } from "./audit-log"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const CSRF_HEADER = "x-csrf-token"
const CSRF_COOKIE = "csrf-token"

/**
 * Get the CSRF secret from environment.
 * Requires a dedicated CSRF_SECRET — no fallback to Supabase anon key.
 */
export function getCSRFSecret(): string {
    const secret = process.env.CSRF_SECRET
    if (!secret) {
        throw new Error("CSRF_SECRET environment variable is required")
    }
    return secret
}

/**
 * Generate a CSRF token for a user session
 * Token is HMAC-signed to prevent tampering
 */
export function generateCSRFToken(sessionId: string): string {
    const secret = getCSRFSecret()
    const randomValue = randomBytes(32).toString("hex")
    const timestamp = Date.now().toString()
    const payload = `${sessionId}:${randomValue}:${timestamp}`
    
    const hmac = createHmac("sha256", secret)
    hmac.update(payload)
    const signature = hmac.digest("hex")
    
    return `${payload}:${signature}`
}

/**
 * Validate CSRF token from request
 * Returns null if valid, or NextResponse with 403 if invalid
 */
export async function validateCSRFToken(
    request: NextRequest,
    sessionId: string,
    supabase?: SupabaseClient<Database>
): Promise<NextResponse | null> {
    // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
    const method = request.method.toUpperCase()
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return null
    }

    // Get token from header
    const token = request.headers.get(CSRF_HEADER)
    
    if (!token) {
        // Audit log the failure
        if (supabase) {
            await logAudit(
                supabase,
                {
                    user_id: sessionId,
                    action: "security.csrf_failure" as any,
                    metadata: { reason: "missing_token", path: request.nextUrl.pathname },
                },
                request
            ).catch(() => {})
        }
        return NextResponse.json(
            { error: "CSRF token missing. Include X-CSRF-Token header." },
            { status: 403 }
        )
    }

    // Validate token format
    const parts = token.split(":")
    if (parts.length !== 4) {
        if (supabase) {
            await logAudit(
                supabase,
                {
                    user_id: sessionId,
                    action: "security.csrf_failure" as any,
                    metadata: { reason: "invalid_format", path: request.nextUrl.pathname },
                },
                request
            ).catch(() => {})
        }
        return NextResponse.json(
            { error: "Invalid CSRF token format" },
            { status: 403 }
        )
    }

    const [tokenSessionId, randomValue, timestamp, signature] = parts

    // Verify session ID matches
    if (tokenSessionId !== sessionId) {
        if (supabase) {
            await logAudit(
                supabase,
                {
                    user_id: sessionId,
                    action: "security.csrf_failure" as any,
                    metadata: { reason: "session_mismatch", path: request.nextUrl.pathname },
                },
                request
            ).catch(() => {})
        }
        return NextResponse.json(
            { error: "CSRF token session mismatch" },
            { status: 403 }
        )
    }

    // Verify token age (max 1 hour)
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge > 3600000) {
        if (supabase) {
            await logAudit(
                supabase,
                {
                    user_id: sessionId,
                    action: "security.csrf_failure" as any,
                    metadata: { reason: "expired", path: request.nextUrl.pathname },
                },
                request
            ).catch(() => {})
        }
        return NextResponse.json(
            { error: "CSRF token expired. Please refresh the page." },
            { status: 403 }
        )
    }

    // Verify HMAC signature using timing-safe comparison
    let secret: string
    try {
        secret = getCSRFSecret()
    } catch {
        return NextResponse.json(
            { error: "CSRF validation unavailable" },
            { status: 403 }
        )
    }

    const payload = `${tokenSessionId}:${randomValue}:${timestamp}`
    const hmac = createHmac("sha256", secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, "utf-8")
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8")

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        if (supabase) {
            await logAudit(
                supabase,
                {
                    user_id: sessionId,
                    action: "security.csrf_failure" as any,
                    metadata: { reason: "invalid_signature", path: request.nextUrl.pathname },
                },
                request
            ).catch(() => {})
        }
        return NextResponse.json(
            { error: "CSRF token signature invalid" },
            { status: 403 }
        )
    }

    return null
}

/**
 * Generate CSRF token for client-side use
 * Call this from a GET endpoint to provide token to frontend
 */
export function generateCSRFResponse(sessionId: string): NextResponse {
    const token = generateCSRFToken(sessionId)
    
    const response = NextResponse.json({ csrfToken: token })
    
    // Also set as httpOnly cookie for double-submit pattern
    response.cookies.set(CSRF_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3600, // 1 hour
        path: "/",
    })
    
    return response
}
