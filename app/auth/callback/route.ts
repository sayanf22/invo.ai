import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Auth callback for PKCE code exchange (OAuth, magic links, email confirm).
 *
 * After exchangeCodeForSession, we redirect to /auth/session-sync which is a
 * client-side page that reads the session from the Supabase client (which has
 * it in memory after the exchange) and then redirects to the correct page.
 *
 * This avoids the Cloudflare Workers edge runtime issue where cookies() from
 * next/headers doesn't reliably read freshly-set cookies in Server Components.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const rawRedirect = requestUrl.searchParams.get("redirect") || "/"
    const origin = requestUrl.origin

    // SECURITY: Prevent open redirect — only allow relative paths
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/"

    if (!code) {
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent("No authorization code provided.")}`
        )
    }

    // Collect cookies set during the exchange
    const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

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

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        console.error("OAuth code exchange failed:", error.message)
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent("Sign in failed. Please try again.")}`
        )
    }

    // Redirect directly to the intended destination
    // The auth-provider on the client will pick up the session from cookies
    const finalResponse = NextResponse.redirect(`${origin}${redirectTo}`)

    // Apply all collected cookies to the redirect response
    cookiesToSet.forEach(({ name, value, options }) => {
        finalResponse.cookies.set(name, value, options)
    })

    return finalResponse
}
