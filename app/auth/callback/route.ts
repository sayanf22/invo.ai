import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Auth callback for PKCE code exchange.
 * Uses @supabase/ssr createServerClient which properly handles cookie
 * read/write for session persistence across requests.
 *
 * Handles: OAuth (Google), magic links, email confirmations.
 */
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const rawRedirect = requestUrl.searchParams.get("redirect") || "/"
    const origin = requestUrl.origin

    // SECURITY: Prevent open redirect — only allow relative paths
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/"

    if (code) {
        const cookieStore = await cookies()

        const supabase = createServerClient(
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
                            // Called from Server Component — middleware will handle cookies
                        }
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Password reset flow
            if (redirectTo === "/auth/update-password") {
                return NextResponse.redirect(`${origin}/auth/update-password`)
            }

            // Check onboarding status
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("onboarding_complete, plan_selected")
                    .eq("id", user.id)
                    .single()

                const p = profile as any
                if (!p?.plan_selected) {
                    return NextResponse.redirect(`${origin}/choose-plan`)
                }
                if (!p?.onboarding_complete) {
                    return NextResponse.redirect(`${origin}/onboarding`)
                }
            }

            return NextResponse.redirect(`${origin}${redirectTo}`)
        }

        console.error("OAuth code exchange failed:", error.message)
    }

    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent("Unable to sign in. Please try again.")}`
    )
}
