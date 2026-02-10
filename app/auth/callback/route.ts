import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

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

                // If onboarding not complete, redirect to onboarding
                if (!profile?.onboarding_complete) {
                    return NextResponse.redirect(`${origin}/onboarding`)
                }
            }

            // Otherwise redirect to intended destination
            return NextResponse.redirect(`${origin}${redirect}`)
        }
    }

    // If there's an error or no code, redirect to login
    return NextResponse.redirect(`${origin}/auth/login?error=Unable to sign in`)
}
