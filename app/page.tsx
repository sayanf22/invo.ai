"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { useAuth } from "@/components/auth-provider"
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
      // Check if there are auth cookies — if so, the session might still be loading
      const hasAuthCookie = typeof document !== "undefined" &&
        document.cookie.split(";").some(c => c.trim().startsWith("sb-") && c.includes("-auth-token"))
      
      if (hasAuthCookie) {
        // Auth cookies exist but user is null — wait a bit for getUser() fallback
        const timer = setTimeout(() => setReady(true), 2000)
        return () => clearTimeout(timer)
      }
      
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

  if (isLoading || !ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin" style={{ borderTopColor: 'hsl(33 17% 10%)', borderRightColor: 'hsl(33 17% 10% / 0.15)', animationDuration: '0.75s' }} />
        </div>
        <p className="text-xs font-medium text-muted-foreground tracking-wide">Clorefy</p>
      </div>
    )
  }

  if (user && showApp) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin" style={{ borderTopColor: 'hsl(33 17% 10%)', borderRightColor: 'hsl(33 17% 10% / 0.15)', animationDuration: '0.75s' }} />
          </div>
          <p className="text-xs font-medium text-muted-foreground tracking-wide">Clorefy</p>
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin" style={{ borderTopColor: 'hsl(33 17% 10%)', borderRightColor: 'hsl(33 17% 10% / 0.15)', animationDuration: '0.75s' }} />
      </div>
      <p className="text-xs font-medium text-muted-foreground tracking-wide">Clorefy</p>
    </div>
  )
}
