import { AppShell } from "@/components/app-shell"
import { LandingPage } from "@/components/landing/landing-page"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export default async function Page() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

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

  return <AppShell />
}
