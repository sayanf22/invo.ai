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
import { randomBytes, createHmac } from "crypto"

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "fallback-secret"
const CSRF_HEADER = "x-csrf-token"
const CSRF_COOKIE = "csrf-token"

/**
 * Generate a CSRF token for a user session
 * Token is HMAC-signed to prevent tampering
 */
export function generateCSRFToken(sessionId: string): string {
    const randomValue = randomBytes(32).toString("hex")
    const timestamp = Date.now().toString()
    const payload = `${sessionId}:${randomValue}:${timestamp}`
    
    const hmac = createHmac("sha256", CSRF_SECRET)
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
    sessionId: string
): Promise<NextResponse | null> {
    // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
    const method = request.method.toUpperCase()
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
        return null
    }

    // Get token from header
    const token = request.headers.get(CSRF_HEADER)
    
    if (!token) {
        return NextResponse.json(
            { error: "CSRF token missing. Include X-CSRF-Token header." },
            { status: 403 }
        )
    }

    // Validate token format
    const parts = token.split(":")
    if (parts.length !== 4) {
        return NextResponse.json(
            { error: "Invalid CSRF token format" },
            { status: 403 }
        )
    }

    const [tokenSessionId, randomValue, timestamp, signature] = parts

    // Verify session ID matches
    if (tokenSessionId !== sessionId) {
        return NextResponse.json(
            { error: "CSRF token session mismatch" },
            { status: 403 }
        )
    }

    // Verify token age (max 1 hour)
    const tokenAge = Date.now() - parseInt(timestamp)
    if (tokenAge > 3600000) {
        return NextResponse.json(
            { error: "CSRF token expired. Please refresh the page." },
            { status: 403 }
        )
    }

    // Verify HMAC signature
    const payload = `${tokenSessionId}:${randomValue}:${timestamp}`
    const hmac = createHmac("sha256", CSRF_SECRET)
    hmac.update(payload)
    const expectedSignature = hmac.digest("hex")

    if (signature !== expectedSignature) {
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
