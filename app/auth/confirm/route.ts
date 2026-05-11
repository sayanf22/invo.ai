import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Token exchange endpoint for PKCE-less OTP flows:
 *   - email confirmation (signup)
 *   - password recovery
 *   - email change
 *   - magic link (non-PKCE)
 *
 * Supabase email templates link here with token_hash + type + optional next.
 *
 * Uses @supabase/ssr's createServerClient so session cookies are written in
 * the same format the browser client reads. Do NOT hand-roll cookie writing
 * here — legacy JSON format will desync from the rest of the app.
 */

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get("token_hash")
    const type = searchParams.get("type") as EmailOtpType | null
    const rawNext = searchParams.get("next") ?? "/"
    const origin = new URL(request.url).origin

    // SECURITY: prevent open redirect — only allow relative paths starting with "/"
    // Reject protocol-relative URLs like "//evil.com"
    const safePath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/"

    if (!token_hash || !type) {
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent("Invalid confirmation link. Please request a new one.")}`
        )
    }

    // Collect cookies set during verification so we can apply them to the redirect
    const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(incoming) {
                    incoming.forEach(({ name, value, options }) => {
                        cookiesToSet.push({ name, value, options })
                        request.cookies.set(name, value)
                    })
                },
            },
        }
    )

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (error) {
        console.error("[auth/confirm] verifyOtp failed:", error.message)
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent("This link is invalid or has expired. Please request a new one.")}`
        )
    }

    // Build redirect response and apply the session cookies written by @supabase/ssr.
    // The browser client will read them in the same format we wrote them.
    const response = NextResponse.redirect(new URL(safePath, origin))
    cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
    })

    return response
}
