/**
 * POST /api/signatures/respond
 *
 * Public endpoint — token-based access for external signers.
 * Handles Decline and Request Revision actions on a signing request.
 * (Signing itself is handled by POST /api/signatures/sign)
 *
 * Body: { token, action: 'declined' | 'revision_requested', reason? }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP } from "@/lib/api-auth"
import { recordAuditEvent } from "@/lib/signature-audit"
import type { Database } from "@/lib/database.types"

const TOKEN_REGEX = /^sign_[0-9a-f]{32}$/

function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    let body: { token?: string; action?: string; reason?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { token, action, reason } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing signing token" }, { status: 400 })
    }

    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
    }

    if (!action || !["declined", "revision_requested"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'declined' or 'revision_requested'" },
        { status: 400 }
      )
    }

    // reason is required for revision_requested
    if (action === "revision_requested" && (!reason || reason.trim().length === 0)) {
      return NextResponse.json(
        { error: "reason is required when requesting revision" },
        { status: 400 }
      )
    }

    const supabase = getServiceRoleClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Look up the signature by token
    const { data: signature, error: lookupError } = await supabase
      .from("signatures")
      .select("id, signed_at, expires_at, signer_action, signer_name, signer_email, session_id, document_id")
      .eq("token", token)
      .single()

    if (lookupError || !signature) {
      return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
    }

    // Already signed — cannot decline/revise
    if (signature.signed_at) {
      return NextResponse.json(
        { error: "This document has already been signed and cannot be declined." },
        { status: 409 }
      )
    }

    // Already responded
    if (signature.signer_action) {
      return NextResponse.json(
        { error: `You have already ${signature.signer_action === "declined" ? "declined" : "requested revision for"} this document.` },
        { status: 409 }
      )
    }

    // Check expiry
    if (signature.expires_at && new Date(signature.expires_at) < new Date()) {
      return NextResponse.json({ error: "Signing link has expired" }, { status: 410 })
    }

    // Update the signature record
    const { error: updateError } = await supabase
      .from("signatures")
      .update({
        signer_action: action,
        signer_reason: reason?.trim() ?? null,
      } as any)
      .eq("id", signature.id)

    if (updateError) {
      console.error("[signatures/respond] update error:", updateError)
      return NextResponse.json({ error: "Failed to record response" }, { status: 500 })
    }

    // Record audit event
    const auditAction = action === "declined" ? "signature.declined" : "signature.revision_requested"
    await recordAuditEvent(supabase, {
      action: auditAction as any,
      signature_id: signature.id,
      document_id: signature.document_id ?? undefined,
      session_id: (signature as any).session_id ?? undefined,
      actor_email: signature.signer_email,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: { reason: reason?.trim() ?? null },
    })

    // Notify the document owner
    if ((signature as any).session_id) {
      const { data: session } = await supabase
        .from("document_sessions")
        .select("user_id, document_type, context")
        .eq("id", (signature as any).session_id)
        .single()

      if (session) {
        const ctx = (session.context ?? {}) as Record<string, unknown>
        const referenceNumber =
          (ctx.invoiceNumber as string) ||
          (ctx.referenceNumber as string) ||
          ""
        const signerName = signature.signer_name ?? "Someone"
        const docType = session.document_type ?? "document"

        const notifType = action === "declined" ? "signature_declined" : "signature_revision_requested"
        const notifTitle = action === "declined" ? "Signature Declined" : "Revision Requested"
        const notifMessage =
          action === "declined"
            ? `${signerName} declined to sign your ${docType} ${referenceNumber}.`.trim()
            : `${signerName} requested revisions to your ${docType} ${referenceNumber}.`.trim()

        await supabase.from("notifications" as any).insert({
          user_id: session.user_id,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          read: false,
          metadata: {
            session_id: (signature as any).session_id,
            signature_id: signature.id,
            signer_name: signerName,
            document_type: docType,
            reference_number: referenceNumber,
            reason: reason?.trim() ?? null,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      action,
      message:
        action === "declined"
          ? "You have declined to sign this document. The sender has been notified."
          : "Your revision request has been sent to the document owner.",
    })
  } catch (error) {
    console.error("[signatures/respond] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
