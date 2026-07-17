import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * POST /api/sessions/finalize
 *
 * Marks a document session as finalized (sent) so it appears in My Documents
 * and the share link is "live" for recipients. This is the canonical
 * lock-on-share endpoint — every share path (chat-share-card, ShareButton
 * dropdown, SendEmailDialog, etc.) calls this before performing the share
 * action, so cancellation→resend produces a clean lifecycle transition.
 *
 * Allowed transitions:
 *   active   → finalized   (first send)
 *   draft    → finalized   (first send)
 *   active+sent_at → finalized   (resend after owner unlocked from chat)
 *   cancelled → finalized  (resend after explicit cancel)
 *
 * Blocked transitions (terminal — financial / legally binding):
 *   paid     → 409 Conflict
 *   signed   → 409 Conflict
 *
 * Security:
 *   - Requires authentication
 *   - Verifies session ownership before updating (defence in depth on top of RLS)
 *   - Only the owner can finalize their own sessions
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

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
  }

  // Fetch existing status + type so we can block terminal states and route
  // onboarding forms away from this generic lock-on-share path.
  const { data: existing, error: fetchError } = await auth.supabase
    .from("document_sessions")
    .select("status, document_type")
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Client onboarding forms must never be finalized through the generic
  // lock-on-share path. They are sent exclusively via POST /api/onboarding,
  // which mints a fresh /onboard/<token> fill link and finalizes the session
  // itself. Finalizing here would mark the form "sent" without a fill link,
  // leaving the owner to share the read-only /d/<publicId> preview instead.
  if ((existing.document_type || "").trim().toLowerCase().replace(/[\s-]+/g, "_") === "client_onboarding_form") {
    return NextResponse.json(
      { error: "Onboarding forms are sent from the Send screen, which creates the fillable client link. Use Send instead of Share here." },
      { status: 400 }
    )
  }

  if (existing.status === "paid") {
    return NextResponse.json(
      { error: "This document is already paid and cannot be re-shared as a new send." },
      { status: 409 }
    )
  }

  if (existing.status === "signed") {
    return NextResponse.json(
      { error: "This document is already signed and cannot be re-shared as a new send." },
      { status: 409 }
    )
  }

  // Update — RLS enforces ownership; we add user_id again as belt-and-braces
  const nowIso = new Date().toISOString()
  const { error: updateError } = await auth.supabase
    .from("document_sessions")
    .update({
      status: "finalized",
      sent_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)

  if (updateError) {
    console.error("[sessions/finalize] update error:", updateError)
    return NextResponse.json({ error: "Failed to finalize document" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
