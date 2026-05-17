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

    // Sync user to Brevo — completely non-blocking (don't await, don't delay redirect)
    // Uses service role to bypass RLS when reading the profile.
    const doBrevoSync = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) return

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            // Use service role key to bypass RLS — anon key cannot read profiles
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            if (!supabaseUrl || !serviceKey) return

            const profileRes = await fetch(
                `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=onboarding_complete,full_name,created_at`,
                {
                    headers: {
                        apikey: serviceKey,
                        Authorization: `Bearer ${serviceKey}`,
                    },
                    signal: AbortSignal.timeout(3000),
                }
            )
            if (!profileRes.ok) return

            const profiles = await profileRes.json()
            const profile = profiles[0]
            const isNewUser = profile
                ? (Date.now() - new Date(profile.created_at).getTime()) < 120_000 // 2 min window
                : false

            await syncUserOnLogin({
                email: user.email,
                firstName: profile?.full_name?.split(" ")[0] ?? null,
                isNewUser,
                onboardingComplete: profile?.onboarding_complete ?? false,
                signupAt: profile?.created_at ?? null,
            })
        } catch (syncErr) {
            // Non-fatal — Brevo sync must never affect login
            console.error("[brevo] sync error (non-fatal):", syncErr)
        }
    }

    // Fire-and-forget — don't block the redirect
    doBrevoSync().catch(() => {})

    // Redirect directly to the intended destination
    // The auth-provider on the client will pick up the session from cookies
    const finalResponse = NextResponse.redirect(`${origin}${redirectTo}`)

    // Apply all collected cookies to the redirect response
    cookiesToSet.forEach(({ name, value, options }) => {
        finalResponse.cookies.set(name, value, options)
    })

    return finalResponse
}
