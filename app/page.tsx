"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

/**
 * Root page — fully client-side routing.
 *
 * Why client-side? This app runs on Cloudflare Workers edge runtime where
 * cookies() from next/headers doesn't reliably read @supabase/ssr cookies
 * immediately after an OAuth redirect. The auth-provider already manages
 * session state via onAuthStateChange, so we delegate all routing to it.
 *
 * Flow:
 *  - isLoading=true  → show spinner (auth-provider is initializing)
 *  - user=null       → show landing page
 *  - user exists     → check profile, redirect to onboarding/choose-plan if needed
 *  - user complete   → show AppShell
 */
export default function Page() {
  const { user, supabase, isLoading } = useAuth()
  const router = useRouter()
  const [profileChecked, setProfileChecked] = useState(false)
  const [showApp, setShowApp] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      setProfileChecked(true)
      setShowApp(false)
      return
    }

    // User is authenticated — check profile status
    async function checkProfile() {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_complete, plan_selected")
          .eq("id", user!.id)
          .single() as any

        if (!profile?.plan_selected) {
          router.replace("/choose-plan")
          return
        }
        if (!profile?.onboarding_complete) {
          router.replace("/onboarding")
          return
        }
        setShowApp(true)
      } catch {
        // Profile check failed — show app anyway, let app-shell handle it
        setShowApp(true)
      } finally {
        setProfileChecked(true)
      }
    }

    checkProfile()
  }, [user, isLoading, supabase, router])

  // Still loading auth state
  if (isLoading || (user && !profileChecked)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return <LandingPage />
  }

  // Authenticated and profile complete
  if (showApp) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <AppShell />
      </Suspense>
    )
  }

  // Redirecting to onboarding/choose-plan
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
