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
 * - Quotation/proposal recipient has responded with "declined" or "changes_requested"
 *   (the owner's path forward is to send a revised version, not revoke the response)
 *
 * Body: { sessionId: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest } from "@/lib/api-auth"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Service-role client for onboarding_forms, which has no UPDATE RLS policy
 *  (owner policies cover SELECT/DELETE only). Ownership is still enforced in
 *  the query via an explicit user_id filter. */
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

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

    // Block if the recipient already responded with "declined" or "changes_requested"
    // on a quotation/proposal. Once the client has formally responded the owner
    // cannot revoke the document — the response itself is part of the record and
    // would be orphaned by a cancellation. The owner's correct path is to
    // generate a new revised quotation/proposal that supersedes this one.
    // Also blocks on "accepted" — an accepted quote/proposal is a binding
    // agreement that must be preserved.
    if (["quotation", "quote", "proposal"].includes((session.document_type || "").toLowerCase())) {
      const { data: clientResponses } = await (auth.supabase as any)
        .from("quotation_responses")
        .select("response_type")
        .eq("session_id", sessionId)
        .limit(1)

      if (Array.isArray(clientResponses) && clientResponses.length > 0) {
        const responseType = clientResponses[0].response_type
        const human = responseType === "accepted" ? "accepted this document"
          : responseType === "declined" ? "declined this document"
          : "requested changes"
        return NextResponse.json(
          {
            error: `The recipient has already ${human}. This document cannot be cancelled.`,
            status: "responded",
            responseType,
          },
          { status: 403 }
        )
      }
    }

    // Block if a client has already submitted an onboarding form. The filled
    // answers are a permanent record — the owner cannot void them.
    if ((session.document_type || "").toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form") {
      const { data: submittedForm } = await serviceClient()
        .from("onboarding_forms")
        .select("id")
        .eq("session_id", sessionId)
        .eq("status", "submitted")
        .limit(1)
        .maybeSingle()

      if (submittedForm) {
        return NextResponse.json(
          { error: "Your client has already submitted this onboarding form. It cannot be cancelled." },
          { status: 403 }
        )
      }
    }

    // 1. Transition only an unsigned, cancellable parent. If atomic signing won
    // the race after the checks above, this guarded update affects no row.
    const { data: cancelledSession, error: updateError } = await auth.supabase
      .from("document_sessions")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .in("status", ["active", "finalized"])
      .select("id")
      .maybeSingle()

    if (updateError) {
      console.error("[sessions/cancel] update error:", updateError)
      return NextResponse.json({ error: "Failed to cancel document" }, { status: 500 })
    }
    if (!cancelledSession) {
      return NextResponse.json(
        { error: "Document state changed while cancellation was in progress. It was not cancelled." },
        { status: 409 }
      )
    }

    // 2. Atomically mark all unsigned signature rows as cancelled
    await (auth.supabase as any)
      .from("signatures")
      .update({ signer_action: "cancelled" })
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

    // 4. Invalidate any outstanding onboarding fill links for this session.
    //    Cancelling a sent form must void its public link (the client can no
    //    longer fill it) so a fresh resend issues a new token. Submitted forms
    //    are preserved — their answers are already recorded.
    //    Uses the service client: onboarding_forms has no UPDATE RLS policy, so
    //    the authenticated client would silently affect 0 rows. Ownership is
    //    still enforced via the explicit user_id filter below.
    try {
      await serviceClient()
        .from("onboarding_forms")
        .update({ status: "expired" })
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .in("status", ["pending", "in_progress"])
    } catch (e) {
      // Non-fatal: the session is already cancelled; a stale fill link is a
      // minor concern and shouldn't fail the whole cancel operation.
      console.error("[sessions/cancel] onboarding link invalidation failed:", e)
    }

    return NextResponse.json({
      success: true,
      message: "Document cancelled. All signing links and reminders have been invalidated.",
    })
  } catch (error) {
    console.error("[sessions/cancel] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
