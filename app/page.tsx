"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

/**
 * Root page — fully client-side routing for Cloudflare Workers compatibility.
 *
 * Shows a spinner while auth is loading, then routes based on session state.
 * Uses a short grace period after auth loads to avoid flashing the landing page
 * when the session is about to be established (e.g. right after OAuth redirect).
 */
export default function Page() {
  const { user, supabase, isLoading } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [showApp, setShowApp] = useState(false)
  const profileCheckedRef = useRef(false)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      // No user — show landing page immediately
      setReady(true)
      return
    }

    // User is authenticated — check profile
    if (profileCheckedRef.current) return
    profileCheckedRef.current = true

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
        setReady(true)
      } catch {
        setShowApp(true)
        setReady(true)
      }
    }

    checkProfile()
  }, [user, isLoading, supabase, router])

  // Loading or grace period
  if (isLoading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Authenticated and profile complete
  if (user && showApp) {
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

  // Not authenticated — show landing page
  if (!user) {
    return <LandingPage />
  }

  // Redirecting to onboarding/choose-plan
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
