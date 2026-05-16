/**
 * POST /api/sessions/cancel
 *
 * Cancels a document session owned by the authenticated user.
 * - Sets session status to "cancelled"
 * - Atomically marks all unsigned signature rows as signer_action = "cancelled"
 *   so signing links return 410 Gone immediately
 * - Cancels all pending email reminders for this session
 *
 * Blocked when:
 * - Session is already "paid" (financial record — cannot cancel)
 * - Any signature has been actually signed (signed_at IS NOT NULL and not declined/cancelled)
 *
 * Body: { sessionId: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: { sessionId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { sessionId } = body
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    // Fetch session and verify ownership
    const { data: session, error: fetchError } = await auth.supabase
      .from("document_sessions")
      .select("id, user_id, status, document_type")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Already cancelled — idempotent
    if (session.status === "cancelled") {
      return NextResponse.json({ success: true, message: "Document is already cancelled" })
    }

    // Cannot cancel a paid document — it's a financial record
    if (session.status === "paid") {
      return NextResponse.json(
        { error: "Paid documents cannot be cancelled. This is a financial record." },
        { status: 403 }
      )
    }

    // Block if any signature has actually been signed (legally binding)
    const { data: signedSigs } = await (auth.supabase as any)
      .from("signatures")
      .select("id, signed_at, signer_action")
      .eq("session_id", sessionId)
      .not("signed_at", "is", null)

    const hasActualSignature = (signedSigs ?? []).some((s: any) =>
      s.signed_at &&
      s.signer_action !== "declined" &&
      s.signer_action !== "revision_requested" &&
      s.signer_action !== "cancelled"
    )

    if (hasActualSignature) {
      return NextResponse.json(
        {
          error: "This document has been signed and cannot be cancelled. Signed documents are legally binding.",
          status: "signed",
        },
        { status: 403 }
      )
    }

    // 1. Set session status to "cancelled"
    const { error: updateError } = await auth.supabase
      .from("document_sessions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)

    if (updateError) {
      console.error("[sessions/cancel] update error:", updateError)
      return NextResponse.json({ error: "Failed to cancel document" }, { status: 500 })
    }

    // 2. Atomically mark all unsigned signature rows as cancelled
    await (auth.supabase as any)
      .from("signatures")
      .update({
        signer_action: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .is("signed_at", null)
      .is("signer_action", null)

    // 3. Cancel all pending email reminders
    await (auth.supabase as any)
      .from("email_schedules")
      .update({
        status: "cancelled",
        cancelled_reason: "document_cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", auth.user.id)
      .eq("status", "pending")

    return NextResponse.json({
      success: true,
      message: "Document cancelled. All signing links and reminders have been invalidated.",
    })
  } catch (error) {
    console.error("[sessions/cancel] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
