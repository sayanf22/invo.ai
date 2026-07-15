/**
 * POST /api/signatures/cancel
 *
 * Authenticated endpoint for cancelling the current unsigned signing envelope.
 * The database serializes cancellation with signing on the parent session row.
 *
 * Body: { signatureId: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, getClientIP, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { recordAuditEvent } from "@/lib/signature-audit"
import type { Database } from "@/lib/database.types"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Signature service credentials are not configured")
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    let body: { signatureId?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError

    const signatureId = typeof body.signatureId === "string" ? body.signatureId.trim() : ""
    if (!UUID_PATTERN.test(signatureId)) {
      return NextResponse.json({ error: "A valid signatureId is required" }, { status: 400 })
    }

    const cancelledAt = new Date().toISOString()
    const serviceSupabase = getServiceRoleClient()
    const { data, error } = await serviceSupabase.rpc("cancel_signature_request", {
      p_signature_id: signatureId,
      p_user_id: auth.user.id,
      p_cancelled_at: cancelledAt,
    })
    const cancellation = Array.isArray(data) ? data[0] : data

    if (error) {
      console.error("[signatures/cancel] atomic cancellation error:", error)
      return NextResponse.json({ error: "Failed to cancel signature request" }, { status: 500 })
    }
    if (!cancellation || cancellation.outcome !== "cancelled") {
      const failures: Record<string, { error: string; status: number }> = {
        invalid_request: { error: "Invalid cancellation request", status: 400 },
        not_found: { error: "Signature request not found", status: 404 },
        already_signed: { error: "A completed signature cannot be cancelled", status: 409 },
        cohort_partially_signed: {
          error: "This signing envelope already contains a completed signature and cannot be cancelled",
          status: 409,
        },
        stale_request: { error: "This signature request has already been superseded", status: 409 },
        already_responded: { error: "This signature request already has a recorded response", status: 409 },
        parent_cancelled: { error: "This signing envelope is no longer active", status: 409 },
        conflict: { error: "The signing envelope changed while cancellation was in progress", status: 409 },
      }
      const failure = failures[cancellation?.outcome ?? "conflict"] ?? failures.conflict
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }

    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") ?? undefined
    await recordAuditEvent(serviceSupabase, {
      action: "signature.cancelled",
      signature_id: signatureId,
      document_id: cancellation.document_id ?? undefined,
      session_id: cancellation.session_id ?? undefined,
      actor_email: auth.user.email,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: {
        cancelled_by: auth.user.id,
        signer_name: cancellation.signer_name,
        cancelled_count: cancellation.cancelled_count,
        cancelled_at: cancelledAt,
      },
    }).catch((auditError) => {
      console.error("[signatures/cancel] audit logging failed:", auditError)
    })

    return NextResponse.json({
      success: true,
      cancelledCount: cancellation.cancelled_count,
    })
  } catch (error) {
    console.error("[signatures/cancel] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
