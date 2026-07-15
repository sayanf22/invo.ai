/**
 * POST /api/signatures/respond
 * Public capability endpoint for decline/revision responses.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { hashSigningToken, isSigningToken } from "@/lib/public-capability"
import { recordAuditEvent } from "@/lib/signature-audit"
import type { Database } from "@/lib/database.types"

function getServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  try {
    let body: { token?: string; action?: string; reason?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 8 * 1024)
    if (sizeError) return sizeError

    const { token, action, reason } = body
    if (!isSigningToken(token) || !token.startsWith("sign_")) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
    }
    if (action !== "declined" && action !== "revision_requested") {
      return NextResponse.json(
        { error: "action must be 'declined' or 'revision_requested'" },
        { status: 400 }
      )
    }

    const trimmedReason = typeof reason === "string" ? reason.trim() : ""
    if (trimmedReason.length > 2000) {
      return NextResponse.json({ error: "Reason is too long" }, { status: 400 })
    }
    if (action === "revision_requested" && !trimmedReason) {
      return NextResponse.json(
        { error: "reason is required when requesting revision" },
        { status: 400 }
      )
    }

    const supabase = getServiceRoleClient()
    const clientIP = getClientIP(request)
    const tokenHash = await hashSigningToken(token)

    const ipRateError = await checkPublicRateLimit(supabase, clientIP, "signature_response_ip", 20, 3600)
    if (ipRateError) return ipRateError
    const tokenRateError = await checkPublicRateLimit(supabase, tokenHash, "signature_response_token", 8, 3600)
    if (tokenRateError) return tokenRateError

    const { data, error } = await supabase.rpc("respond_to_signature", {
      p_token_hash: tokenHash,
      p_action: action,
      p_reason: trimmedReason || null,
    })
    const signature = Array.isArray(data) ? data[0] : data

    if (error) {
      console.error("[signatures/respond] atomic response error:", error)
      return NextResponse.json({ error: "Failed to record response" }, { status: 500 })
    }
    if (!signature) {
      return NextResponse.json({ error: "This signing link is no longer active" }, { status: 409 })
    }
    if (signature.outcome !== "updated") {
      const failures: Record<string, { error: string; status: number }> = {
        invalid_request: { error: "Invalid response request", status: 400 },
        not_found: { error: "Signing link not found", status: 404 },
        expired: { error: "Signing link has expired", status: 410 },
        parent_cancelled: { error: "This document is no longer available", status: 410 },
        already_signed: { error: "This document has already been signed", status: 409 },
        already_responded: { error: "A response has already been recorded", status: 409 },
        conflict: { error: "This signing link is no longer active", status: 409 },
      }
      const failure = failures[signature.outcome] ?? failures.conflict
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    if (!signature.signature_id || !signature.session_id || !signature.signer_email) {
      console.error("[signatures/respond] incomplete successful RPC result")
      return NextResponse.json({ error: "Failed to record response" }, { status: 500 })
    }

    const userAgent = request.headers.get("user-agent") || "unknown"
    const auditAction = action === "declined" ? "signature.declined" : "signature.revision_requested"
    await recordAuditEvent(supabase, {
      action: auditAction,
      signature_id: signature.signature_id,
      document_id: signature.document_id ?? undefined,
      session_id: signature.session_id ?? undefined,
      actor_email: signature.signer_email,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: { reason: trimmedReason || null },
    })

    if (signature.session_id) {
      const { data: session } = await supabase
        .from("document_sessions")
        .select("user_id, document_type, context")
        .eq("id", signature.session_id)
        .single()

      if (session) {
        const ctx = (session.context ?? {}) as Record<string, unknown>
        const referenceNumber = (ctx.invoiceNumber as string) || (ctx.referenceNumber as string) || ""
        const signerName = signature.signer_name ?? "Someone"
        const docType = session.document_type ?? "document"
        const declined = action === "declined"

        await supabase.from("notifications").insert({
          user_id: session.user_id,
          type: declined ? "signature_declined" : "signature_revision_requested",
          title: declined ? "Signature Declined" : "Revision Requested",
          message: declined
            ? `${signerName} declined to sign your ${docType} ${referenceNumber}.`.trim()
            : `${signerName} requested revisions to your ${docType} ${referenceNumber}.`.trim(),
          read: false,
          metadata: {
            session_id: signature.session_id,
            signature_id: signature.signature_id,
            signer_name: signerName,
            document_type: docType,
            reference_number: referenceNumber,
            reason: trimmedReason || null,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === "declined"
        ? "You have declined to sign this document. The sender has been notified."
        : "Your revision request has been sent to the document owner.",
    })
  } catch (error) {
    console.error("[signatures/respond] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
