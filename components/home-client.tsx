"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Suspense } from "react"
import { AppShell, StartScreenSkeleton } from "@/components/app-shell"
import { useAuth } from "@/components/auth-provider"

// Content-shaped skeleton (same one AppShell uses while detecting doc type)
// instead of a bare spinner — this is the very first thing most users see.
const Spinner = () => <StartScreenSkeleton route={null} />

/**
 * Client-side auth routing for authenticated users.
 * Only mounted when the user has auth cookies — unauthenticated visitors
 * see the server-rendered LandingPage directly (good for SEO).
 */
export function HomeClient() {
  const { user, supabase, isLoading } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [showApp, setShowApp] = useState(false)
  const profileCheckedRef = useRef(false)

  useEffect(() => {
    if (isLoading) return

    if (!user) {
      const hasAuthCookie =
        typeof document !== "undefined" &&
        document.cookie
          .split(";")
          .some((c) => c.trim().startsWith("sb-") && c.includes("-auth-token"))

      if (hasAuthCookie) {
        const timer = setTimeout(() => setReady(true), 2000)
        return () => clearTimeout(timer)
      }

      setReady(true)
      return
    }

    if (profileCheckedRef.current) return
    profileCheckedRef.current = true

    async function checkProfile() {
      try {
        const { data: profile } = (await supabase
          .from("profiles")
          .select("onboarding_complete, plan_selected")
          .eq("id", user!.id)
          .single()) as any

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

  if (isLoading || !ready) return <Spinner />

  if (user && showApp) {
    return (
      <Suspense fallback={<Spinner />}>
        <AppShell />
      </Suspense>
    )
  }

  // Still loading / redirecting
  return <Spinner />
}
