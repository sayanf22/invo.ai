import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Auth callback for PKCE code exchange.
 * Handles: OAuth (Google etc.), magic links, email confirmations.
 *
 * After exchangeCodeForSession, we manually write the session tokens
 * to cookies so the middleware can read them on the next request.
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
        // Use service-role-free client for code exchange
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.session) {
            const session = data.session
            const cookieStore = await cookies()

            // Write session to cookies so middleware can read it
            const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
                .replace("https://", "")
                .replace(".supabase.co", "")
            const cookieName = `sb-${projectRef}-auth-token`

            const tokenValue = JSON.stringify({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                token_type: "bearer",
                expires_in: session.expires_in,
                expires_at: session.expires_at,
                user: session.user,
            })

            const cookieOpts = {
                path: "/",
                httpOnly: false, // must be readable by client JS
                sameSite: "lax" as const,
                secure: process.env.NODE_ENV === "production",
                maxAge: 365 * 24 * 60 * 60,
            }

            // Chunk if needed (browsers limit cookie size to ~4KB)
            const CHUNK = 3500
            const encoded = encodeURIComponent(tokenValue)
            if (encoded.length <= CHUNK) {
                cookieStore.set(cookieName, encoded, cookieOpts)
            } else {
                const count = Math.ceil(encoded.length / CHUNK)
                for (let i = 0; i < count; i++) {
                    cookieStore.set(
                        `${cookieName}.${i}`,
                        encoded.slice(i * CHUNK, (i + 1) * CHUNK),
                        cookieOpts
                    )
                }
            }

            // Password reset flow
            if (redirectTo === "/auth/update-password") {
                return NextResponse.redirect(`${origin}/auth/update-password`)
            }

            // Check onboarding status
            const user = session.user
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

        console.error("OAuth code exchange failed:", error?.message)
    }

    return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent("Unable to sign in. Please try again.")}`
    )
}
