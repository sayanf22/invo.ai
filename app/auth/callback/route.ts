import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { syncUserOnLogin } from "@/lib/brevo"

/**
 * Auth callback for PKCE code exchange (OAuth, magic links, post-signup email confirm).
 *
 * After exchangeCodeForSession, we redirect directly to the intended destination
 * with the session cookies applied to the redirect response. @supabase/ssr writes
 * cookies in the same format the browser client reads, so the auth-provider on
 * the client picks up the session immediately.
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

    // Sync user to Brevo (fire-and-forget — never blocks the redirect)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
            // Fetch profile to check onboarding state
            const profileRes = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=onboarding_complete,full_name,created_at`,
                {
                    headers: {
                        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
                    },
                }
            )
            if (profileRes.ok) {
                const profiles = await profileRes.json()
                const profile = profiles[0]
                const isNewUser = profile
                    ? (Date.now() - new Date(profile.created_at).getTime()) < 60_000
                    : false
                await syncUserOnLogin({
                    email: user.email,
                    firstName: profile?.full_name?.split(" ")[0] ?? null,
                    isNewUser,
                    onboardingComplete: profile?.onboarding_complete ?? false,
                    signupAt: profile?.created_at ?? null,
                })
            }
        }
    } catch (syncErr) {
        console.error("[brevo] sync error (non-fatal):", syncErr)
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
