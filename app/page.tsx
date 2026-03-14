import { AppShell } from "@/components/app-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

function AppShellFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default async function Page() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Non-authenticated users see the landing page
  if (!user) {
    return <LandingPage />
  }

  // Authenticated users: check onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single()

  // Redirect to onboarding if not complete
  if (profile && !profile.onboarding_complete) {
    redirect("/onboarding")
  }

  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShell />
    </Suspense>
  )
}
