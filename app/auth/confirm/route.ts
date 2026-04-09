import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Token exchange endpoint for PKCE auth flows.
 * Handles: email confirmation, password recovery, magic links.
 * 
 * Supabase email templates should link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password
 * 
 * This route verifies the OTP token and writes the session cookies manually,
 * since the server-side Supabase client doesn't persist sessions to cookies.
 */

const CHUNK_SIZE = 3500

function writeSessionCookies(response: NextResponse, session: { access_token: string; refresh_token: string; expires_in: number; token_type: string; user: any }) {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || ""
    const cookieName = `sb-${projectRef}-auth-token`

    const tokenObj = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: session.token_type || "bearer",
        expires_in: session.expires_in || 3600,
        expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
        user: session.user,
    }

    const raw = JSON.stringify(tokenObj)
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const cookieOpts = {
        path: "/",
        expires,
        sameSite: "lax" as const,
        secure: true,
        httpOnly: false,
    }

    // Clear old chunks
    for (let i = 0; i < 10; i++) {
        response.cookies.delete(`${cookieName}.${i}`)
    }
    response.cookies.delete(cookieName)

    // NextResponse.cookies.set automatically handles encoding
    // Store as raw JSON — the browser client's getCookie does decodeURIComponent
    if (raw.length <= CHUNK_SIZE) {
        response.cookies.set(cookieName, raw, cookieOpts)
    } else {
        const count = Math.ceil(raw.length / CHUNK_SIZE)
        for (let i = 0; i < count; i++) {
            response.cookies.set(
                `${cookieName}.${i}`,
                raw.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
                cookieOpts
            )
        }
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get("token_hash")
    const type = searchParams.get("type") as EmailOtpType | null
    const next = searchParams.get("next") ?? "/"
    const origin = new URL(request.url).origin

    // Sanitize the next parameter
    const safePath = (next.startsWith("/") && !next.startsWith("//")) ? next : "/"

    if (token_hash && type) {
        // Create a fresh Supabase client (no existing session)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error && data.session) {
            // Build redirect response and write session cookies
            const redirectUrl = new URL(safePath, origin)
            const response = NextResponse.redirect(redirectUrl)

            // Write the session to cookies so the destination page has it
            writeSessionCookies(response, data.session)

            return response
        }

        console.error("Token verification failed:", error?.message || "No session returned")
    }

    // Verification failed
    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent("Invalid or expired reset link. Please request a new one.")}`
    )
}
