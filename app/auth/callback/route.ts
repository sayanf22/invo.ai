import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

/**
 * Auth callback for PKCE code exchange.
 * Handles: OAuth callbacks, email link callbacks with ?code= parameter.
 * 
 * For password reset with PKCE token_hash flow, use /auth/confirm instead.
 */
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const rawRedirect = requestUrl.searchParams.get("redirect") || "/"
    const origin = requestUrl.origin

    // SECURITY: Prevent open redirect — only allow relative paths
    const redirect = (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//"))
        ? rawRedirect
        : "/"

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // If this is a password reset flow, go straight to update-password
            if (redirect === "/auth/update-password") {
                return NextResponse.redirect(`${origin}/auth/update-password`)
            }

            // Check if user needs onboarding
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("onboarding_complete")
                    .eq("id", user.id)
                    .single()

                if (!profile?.onboarding_complete) {
                    return NextResponse.redirect(`${origin}/onboarding`)
                }
            }

            return NextResponse.redirect(`${origin}${redirect}`)
        }

        console.error("Code exchange failed:", error.message)
    }

    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent("Unable to sign in. Please try again.")}`)
}
