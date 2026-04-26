import { cookies } from "next/headers"
import { LandingPage } from "@/components/landing/landing-page"
import { HomeClient } from "@/components/home-client"

/**
 * Root page — server component for SEO.
 *
 * Google (and all crawlers) see the fully server-rendered LandingPage HTML.
 * Authenticated users get the HomeClient component which handles auth routing.
 *
 * This pattern ensures:
 * - Googlebot indexes real content, not a blank spinner
 * - Authenticated users still get routed to the app shell
 * - No flash of landing page for logged-in users (cookie check is server-side)
 */
export default async function Page() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const isAuthenticated = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  )

  // Authenticated users: render the client-side auth router
  if (isAuthenticated) {
    return <HomeClient />
  }

  // Unauthenticated (and Googlebot): render the full landing page server-side
  return <LandingPage />
}
