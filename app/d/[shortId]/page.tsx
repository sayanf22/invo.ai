import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase-server"

/**
 * Short link redirect: /d/<shortId> → /pay/<full-session-id>
 * 
 * shortId is the first 8 characters of the session UUID.
 * This provides a clean, short URL for sharing documents.
 */
export default async function ShortLinkRedirect({
  params,
}: {
  params: Promise<{ shortId: string }>
}) {
  const { shortId } = await params

  if (!shortId || shortId.length < 6) {
    redirect("/")
  }

  // Look up the session by matching the start of the UUID
  const supabase = await createClient()
  const { data: session } = await supabase
    .from("document_sessions")
    .select("id")
    .like("id", `${shortId}%`)
    .limit(1)
    .single()

  if (!session) {
    redirect("/")
  }

  redirect(`/pay/${session.id}`)
}
