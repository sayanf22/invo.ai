import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Auth callback for PKCE code exchange (OAuth, magic links, email confirm).
 *
 * CRITICAL FIX: We set cookies on the NextResponse redirect object directly
 * (not via next/headers cookies()). This is because cookies().set() in a
 * Route Handler doesn't reliably propagate to redirect responses on edge
 * runtimes (Cloudflare Workers). This is a known Next.js/Supabase issue.
 *
 * Pattern from Supabase middleware docs: write to both request.cookies
 * (for server reads) and response.cookies (for browser Set-Cookie headers).
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const rawRedirect = requestUrl.searchParams.get("redirect") || "/"
    const origin = requestUrl.origin

    // SECURITY: Prevent open redirect
    const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/"

    if (!code) {
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent("No authorization code provided.")}`
        )
    }

    // Determine final redirect URL (default, may change based on profile)
    let finalRedirect = `${origin}${redirectTo}`

    // Create a temporary response to collect cookies
    let response = NextResponse.redirect(finalRedirect)

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value)
                    })
                    // Recreate response to pick up updated request cookies
                    response = NextResponse.redirect(finalRedirect)
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
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

    // Session is now set. Check where to redirect.
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        if (redirectTo === "/auth/update-password") {
            finalRedirect = `${origin}/auth/update-password`
        } else {
            const { data: profile } = await supabase
                .from("profiles")
                .select("onboarding_complete, plan_selected")
                .eq("id", user.id)
                .single()

            const p = profile as any
            if (!p?.plan_selected) {
                finalRedirect = `${origin}/choose-plan`
            } else if (!p?.onboarding_complete) {
                finalRedirect = `${origin}/onboarding`
            }
        }
    }

    // Build final response with all cookies preserved
    const finalResponse = NextResponse.redirect(finalRedirect)
    // Copy all cookies from the supabase response to the final redirect
    response.cookies.getAll().forEach((cookie) => {
        finalResponse.cookies.set(cookie.name, cookie.value)
    })

    return finalResponse
}
