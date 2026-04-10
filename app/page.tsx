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

  // Authenticated users: check profile status
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete, plan_selected")
    .eq("id", user.id)
    .single() as any

  // Step 1: Must select a plan first
  if (!profile?.plan_selected) {
    redirect("/choose-plan")
  }

  // Step 2: Must complete onboarding
  if (!profile?.onboarding_complete) {
    redirect("/onboarding")
  }

  // Step 3: Dashboard
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShell />
    </Suspense>
  )
}
