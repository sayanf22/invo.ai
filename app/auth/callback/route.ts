import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Auth callback for PKCE code exchange.
 * Uses @supabase/ssr createServerClient for proper cookie handling.
 *
 * After successful code exchange, redirects to the app.
 * The session cookies are set by @supabase/ssr's cookie adapter.
 */
export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const rawRedirect = requestUrl.searchParams.get("redirect") || "/"
    const origin = requestUrl.origin

    // SECURITY: Prevent open redirect
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
                            // Server Component context — middleware handles cookies
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

            // For all other flows, redirect to the target page.
            // The @supabase/ssr cookie adapter has already set the session cookies
            // via cookieStore.set() above.
            return NextResponse.redirect(`${origin}${redirectTo}`)
        }

        console.error("OAuth code exchange failed:", error.message)
    }

    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent("Unable to sign in. Please try again.")}`
    )
}
