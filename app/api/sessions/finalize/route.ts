import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * POST /api/sessions/finalize
 * Marks a document session as finalized (sent) so it appears in My Documents.
 * Called when user shares via WhatsApp or copies a link from the chat share card.
 * 
 * Security:
 * - Requires authentication
 * - Verifies session ownership before updating
 * - Only updates sessions owned by the authenticated user
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId } = body

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  // Update session — RLS ensures user can only update their own sessions
  const { error } = await auth.supabase
    .from("document_sessions")
    .update({
      status: "finalized",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)

  if (error) {
    console.error("Failed to finalize session:", error)
    return NextResponse.json({ error: "Failed to finalize document" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
