"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Suspense } from "react"
import { AppShell, HomeScreenSkeleton } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"
import { LandingPage } from "@/components/landing/landing-page"

// Subtle brand loader — only shown during the near-instant auth bootstrap.
const Spinner = () => <HomeScreenSkeleton />

/**
 * Client-side auth routing for authenticated users.
 * Only mounted when the user has auth cookies — unauthenticated visitors
 * see the server-rendered LandingPage directly (good for SEO).
 *
 * Perf: we render the real app AS SOON AS the user is known and run the
 * profile/onboarding check in the BACKGROUND. New users (no plan / not
 * onboarded) are redirected once that background check resolves, so there's
 * no second full-screen loading gate — the app feels instant.
 */
export function HomeClient() {
  const { user, supabase, isLoading } = useAuth()
  const router = useRouter()
  const profileCheckedRef = useRef(false)

  useEffect(() => {
    if (isLoading || !user) return
    if (profileCheckedRef.current) return
    profileCheckedRef.current = true

    ;(async () => {
      try {
        const { data: profile } = (await supabase
          .from("profiles")
          .select("onboarding_complete, plan_selected")
          .eq("id", user.id)
          .single()) as any

        // Redirect priority: plan selection first, then onboarding. These run
        // in the background while the app is already on screen.
        if (!profile?.plan_selected) {
          router.replace("/choose-plan")
          return
        }
        if (!profile?.onboarding_complete) {
          router.replace("/onboarding")
          return
        }
      } catch {
        // On error, keep the user on the app rather than trapping them on a loader.
      }
    })()
  }, [user, isLoading, supabase, router])

  // Only gate on the (fast, cached) auth bootstrap. Everything else loads in
  // the background so the app renders instantly.
  // If auth finishes loading but there's no user (stale cookie / expired session),
  // show the landing page instead of trapping on the logo.
  if (isLoading) return <Spinner />
  if (!user) return <LandingPage />

  return (
    <Suspense fallback={<Spinner />}>
      <AppShell />
    </Suspense>
  )
}
