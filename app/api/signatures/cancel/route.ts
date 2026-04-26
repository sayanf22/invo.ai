/**
 * POST /api/signatures/cancel
 *
 * Authenticated endpoint — allows the Document_Owner to cancel a pending signature request.
 * Sets signer_action = 'cancelled' and records a signature.cancelled audit event.
 *
 * Body: { signatureId: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, getClientIP } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { recordAuditEvent } from "@/lib/signature-audit"

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // Rate limit
    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    // Parse body
    let body: { signatureId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { signatureId } = body

    if (!signatureId || typeof signatureId !== "string") {
      return NextResponse.json({ error: "Missing signatureId" }, { status: 400 })
    }

    // Fetch signature and verify ownership via session's user_id
    const { data: signature, error: lookupError } = await auth.supabase
      .from("signatures")
      .select("id, signed_at, signer_action, signer_name, session_id, document_id")
      .eq("id", signatureId)
      .single()

    if (lookupError || !signature) {
      return NextResponse.json({ error: "Signature not found" }, { status: 404 })
    }

    // Verify ownership: the signature's session must belong to the authenticated user
    const sessionId = (signature as any).session_id
    if (!sessionId) {
      return NextResponse.json({ error: "Signature has no associated session" }, { status: 400 })
    }

    const { data: session, error: sessionError } = await auth.supabase
      .from("document_sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify signature is pending (signed_at IS NULL AND signer_action IS NULL)
    if (signature.signed_at) {
      return NextResponse.json(
        { error: "Cannot cancel a signature that has already been signed" },
        { status: 409 }
      )
    }

    if (signature.signer_action) {
      return NextResponse.json(
        { error: "Cannot cancel a signature that already has an action" },
        { status: 409 }
      )
    }

    // Set signer_action = 'cancelled'
    const { error: updateError } = await auth.supabase
      .from("signatures")
      .update({ signer_action: "cancelled" } as any)
      .eq("id", signatureId)

    if (updateError) {
      console.error("[signatures/cancel] update error:", updateError)
      return NextResponse.json({ error: "Failed to cancel signature" }, { status: 500 })
    }

    // Record signature.cancelled audit event
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") ?? undefined

    await recordAuditEvent(auth.supabase, {
      action: "signature.cancelled",
      signature_id: signatureId,
      document_id: signature.document_id ?? undefined,
      session_id: sessionId,
      actor_email: auth.user.email,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: { cancelled_by: auth.user.id, signer_name: signature.signer_name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[signatures/cancel] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
