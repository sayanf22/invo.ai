import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

/**
 * Token exchange endpoint for PKCE auth flows.
 * Handles: email confirmation, password recovery, magic links.
 * 
 * Supabase email templates should link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get("token_hash")
    const type = searchParams.get("type") as EmailOtpType | null
    const next = searchParams.get("next") ?? "/"
    const origin = new URL(request.url).origin

    // Sanitize the next parameter — only allow relative paths
    const safePath = (next.startsWith("/") && !next.startsWith("//")) ? next : "/"

    if (token_hash && type) {
        const supabase = await createServerSupabaseClient()

        const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash,
        })

        if (!error) {
            // Successfully verified — redirect to the intended page
            return NextResponse.redirect(`${origin}${safePath}`)
        }

        console.error("Token verification failed:", error.message)
    }

    // Verification failed — redirect to login with error
    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent("The reset link is invalid or has expired. Please request a new one.")}`
    )
}
