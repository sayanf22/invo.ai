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

import { createServerClient } from "@supabase/ssr"
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

// ── Main Auth Function ─────────────────────────────────────────────────

export async function authenticateRequest(): Promise<AuthResult> {
    try {
        const cookieStore = await cookies()

        const supabase = createServerClient<Database>(
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
                            // Server Component context — middleware handles refresh
                        }
                    },
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
        ]
        for (const safe of safeMessages) {
            if (error.message.includes(safe)) return error.message
        }
    }
    return "Internal server error"
}
