"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { Suspense } from "react"

/**
 * Session sync page — bridges the server-side OAuth callback and client-side routing.
 *
 * After the server-side callback sets auth cookies and redirects here, this page:
 * 1. Waits for the Supabase client to pick up the session (via onAuthStateChange)
 * 2. Checks the user's profile (plan_selected, onboarding_complete)
 * 3. Redirects to the correct destination
 *
 * This solves the Cloudflare Workers edge runtime issue where server components
 * can't reliably read freshly-set cookies after an OAuth redirect.
 */
function SessionSyncContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const next = searchParams.get("next") || "/"
    const didRedirect = useRef(false)

    useEffect(() => {
        if (didRedirect.current) return

        const supabase = createClient()

        async function doSync() {
            // Give the Supabase client a moment to read the cookies
            // then check the session
            let user = null

            // Try getSession first (reads from storage)
            const { data: { session } } = await supabase.auth.getSession()
            user = session?.user ?? null

            // If no session in storage, try getUser (network call — validates cookie)
            if (!user) {
                const { data: { user: networkUser } } = await supabase.auth.getUser()
                user = networkUser
            }

            if (!user) {
                // Still no user — something went wrong, go to login
                router.replace("/auth/login?error=" + encodeURIComponent("Session could not be established. Please try again."))
                return
            }

            // Check profile
            const { data: profile } = await supabase
                .from("profiles")
                .select("onboarding_complete, plan_selected")
                .eq("id", user.id)
                .single() as any

            if (!profile?.plan_selected) {
                router.replace("/choose-plan")
                return
            }
            if (!profile?.onboarding_complete) {
                router.replace("/onboarding")
                return
            }

            // All good — go to intended destination
            const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/"
            router.replace(destination)
        }

        // Listen for auth state change (fires when session is established)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session && !didRedirect.current) {
                didRedirect.current = true
                subscription.unsubscribe()
                doSync()
            }
        })

        // Also try immediately in case the session is already available
        setTimeout(async () => {
            if (didRedirect.current) return
            const { data: { session } } = await supabase.auth.getSession()
            if (session && !didRedirect.current) {
                didRedirect.current = true
                subscription.unsubscribe()
                doSync()
            }
        }, 500)

        // Fallback: if nothing fires after 3 seconds, try anyway
        const fallback = setTimeout(async () => {
            if (didRedirect.current) return
            didRedirect.current = true
            subscription.unsubscribe()
            doSync()
        }, 3000)

        return () => {
            clearTimeout(fallback)
            subscription.unsubscribe()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
    )
}

export default function SessionSyncPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <SessionSyncContent />
        </Suspense>
    )
}
