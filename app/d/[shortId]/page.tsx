import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

/**
 * Short link redirect: /d/<shortId> → /pay/<full-session-id>
 *
 * The middleware handles this redirect first (faster, no service role needed
 * and runs on the edge). This page is a server-rendered fallback in case the
 * middleware lookup fails or is skipped.
 *
 * Important — DocuSign / Adobe Sign behaviour: cancelled documents must NOT
 * silently redirect to the homepage. The recipient is forwarded to /pay/<id>
 * for ALL non-draft sessions (active sent, finalized, paid, signed,
 * cancelled). The pay page then renders the correct status-aware UI:
 *   • cancelled / unlocked → "no longer available" screen
 *   • paid / signed       → completed-state screen
 *   • active sent         → the document itself
 *
 * Only an invalid / unknown / draft-only short ID falls through to the
 * /d/not-found page.
 */
export default async function ShortLinkRedirect({
  params,
}: {
  params: Promise<{ shortId: string }>
}) {
  const { shortId } = await params

  // Validate: must be 6-8 hex chars (first segment of a UUID)
  if (!shortId || !/^[0-9a-f]{6,8}$/i.test(shortId)) {
    redirect("/d/not-found")
  }

  // Service role preferred (bypasses RLS); anon fallback is enough because
  // the strict RPC still grants public reads for sent sessions.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const supabase = createClient(
    supabaseUrl,
    serviceKey || anonKey,
    { auth: { persistSession: false } }
  )

  // Match any session that was ever sent OR is in a terminal state
  // (cancelled, paid, signed, finalized). Pure drafts return no row.
  const { data: session } = await supabase
    .from("document_sessions")
    .select("id, status, sent_at")
    .like("id", `${shortId.toLowerCase()}%`)
    .or("sent_at.not.is.null,status.in.(paid,signed,finalized,cancelled)")
    .limit(1)
    .maybeSingle()

  if (!session?.id) {
    redirect("/d/not-found")
  }

  redirect(`/pay/${session.id}`)
}
