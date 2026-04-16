import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Auth callback for PKCE code exchange (OAuth, magic links, email confirm).
 *
 * Pattern: collect all cookies set by Supabase during code exchange,
 * then apply them to the final redirect response.
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
                    // Collect all cookies — apply them to the final response later
                    incoming.forEach(({ name, value, options }) => {
                        cookiesToSet.push({ name, value, options })
                        // Also write to request so subsequent reads in this handler work
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

    // Determine where to redirect after successful login
    let finalPath = redirectTo

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
        if (redirectTo === "/auth/update-password") {
            finalPath = "/auth/update-password"
        } else {
            const { data: profile } = await supabase
                .from("profiles")
                .select("onboarding_complete, plan_selected")
                .eq("id", user.id)
                .single()

            const p = profile as any
            if (!p?.plan_selected) {
                finalPath = "/choose-plan"
            } else if (!p?.onboarding_complete) {
                finalPath = "/onboarding"
            }
            // Otherwise keep finalPath = redirectTo (usually "/")
        }
    }

    // Build the final redirect response and apply all collected cookies
    const finalResponse = NextResponse.redirect(`${origin}${finalPath}`)
    cookiesToSet.forEach(({ name, value, options }) => {
        finalResponse.cookies.set(name, value, options)
    })

    return finalResponse
}
