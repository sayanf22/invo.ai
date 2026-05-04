import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

/**
 * Short link redirect: /d/<shortId> → /pay/<full-session-id>
 *
 * shortId is the first 8 characters of the session UUID.
 * This is a public page — no auth required. Uses service role to look up
 * the session ID without requiring the recipient to be logged in.
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

  // Use service role — this is a public redirect, no auth needed
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
