import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

/**
 * Short link redirect: /d/<shortId> → /pay/<full-session-id>
 *
 * The middleware handles this redirect first (faster, no service role needed).
 * This page is a fallback in case the middleware lookup fails.
 *
 * Uses anon key (always available) with a direct query.
 * The document_sessions table has RLS — anon can read finalized sessions
 * via the public policy on the pay page.
 */
export default async function ShortLinkRedirect({
  params,
}: {
  params: Promise<{ shortId: string }>
}) {
  const { shortId } = await params

  // Validate: must be 6-8 hex chars (first segment of a UUID)
  if (!shortId || !/^[0-9a-f]{6,8}$/i.test(shortId)) {
    redirect("/")
  }

  // Try service role first (if available), fall back to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const supabase = createClient(
    supabaseUrl,
    serviceKey || anonKey,
    { auth: { persistSession: false } }
  )

  // Look up the session by matching the start of the UUID
  const { data: session } = await supabase
    .from("document_sessions")
    .select("id")
    .like("id", `${shortId.toLowerCase()}%`)
    .limit(1)
    .maybeSingle()

  if (!session) {
    redirect("/")
  }

  redirect(`/pay/${session.id}`)
}
