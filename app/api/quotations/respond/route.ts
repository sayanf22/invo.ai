/**
 * POST /api/quotations/respond
 *
 * Public endpoint — no authentication required.
 * Records a client's response (accept / decline / request changes) to a quotation.
 *
 * Requirements: 8.3, 8.5, 8.7, 8.8, 10.9, 10.10
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP } from "@/lib/api-auth"
import type { Database } from "@/lib/database.types"
import {
  VALID_RESPONSE_TYPES,
  buildQuotationResponseRow,
} from "@/lib/quotation-response-builder"
import type { ResponseType, QuotationResponseInput } from "@/lib/quotation-response-builder"

// ── Types ─────────────────────────────────────────────────────────────────────

// Re-export types for consumers (these are type-only, not route exports)
export type { ResponseType, QuotationResponseInput } from "@/lib/quotation-response-builder"

// ── Helper: build notification for owner ─────────────────────────────────────

function buildNotification(
  userId: string,
  responseType: ResponseType,
  clientName: string,
  referenceNumber: string,
  sessionId: string,
  reason?: string
) {
  const ref = referenceNumber ? ` ${referenceNumber}` : ""

  switch (responseType) {
    case "accepted":
      return {
        user_id: userId,
        type: "quotation_accepted",
        title: "Quotation Accepted",
        message: `${clientName} accepted your quotation${ref}.`,
        read: false,
        metadata: { session_id: sessionId, client_name: clientName, reference_number: referenceNumber },
      }
    case "declined":
      return {
        user_id: userId,
        type: "quotation_declined",
        title: "Quotation Declined",
        message: `${clientName} declined your quotation${ref}.`,
        read: false,
        metadata: { session_id: sessionId, client_name: clientName, reference_number: referenceNumber },
      }
    case "changes_requested":
      return {
        user_id: userId,
        type: "quotation_changes_requested",
        title: "Changes Requested",
        message: `${clientName} requested changes to your quotation${ref}.`,
        read: false,
        metadata: {
          session_id: sessionId,
          client_name: clientName,
          reference_number: referenceNumber,
          reason: reason ?? null,
        },
      }
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Use service-role client for all DB writes (public endpoint)
    const serviceSupabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { sessionId, responseType, clientName, clientEmail, reason } = body as Record<string, unknown>

    // ── Validate required fields ──────────────────────────────────────────────

    if (!sessionId || typeof sessionId !== "string" || sessionId.trim() === "") {
      return NextResponse.json({ error: "Missing required field: sessionId" }, { status: 400 })
    }

    if (!responseType || typeof responseType !== "string") {
      return NextResponse.json({ error: "Missing required field: responseType" }, { status: 400 })
    }

    if (!(VALID_RESPONSE_TYPES as string[]).includes(responseType)) {
      return NextResponse.json(
        { error: "Invalid responseType. Must be one of: accepted, declined, changes_requested" },
        { status: 400 }
      )
    }

    if (!clientName || typeof clientName !== "string" || clientName.trim() === "") {
      return NextResponse.json({ error: "Missing required field: clientName" }, { status: 400 })
    }

    if (!clientEmail || typeof clientEmail !== "string" || clientEmail.trim() === "") {
      return NextResponse.json({ error: "Missing required field: clientEmail" }, { status: 400 })
    }

    // Validate email format: must contain @ and .
    if (!clientEmail.includes("@") || !clientEmail.includes(".")) {
      return NextResponse.json({ error: "Invalid email format for clientEmail" }, { status: 400 })
    }

    // reason is required when responseType = changes_requested
    if (responseType === "changes_requested") {
      if (!reason || typeof reason !== "string" || (reason as string).trim() === "") {
        return NextResponse.json(
          { error: "reason is required when responseType is changes_requested" },
          { status: 400 }
        )
      }
    }

    const validatedResponseType = responseType as ResponseType
    const validatedReason = typeof reason === "string" ? reason : undefined

    // ── Validate sessionId corresponds to a quotation ─────────────────────────

    const { data: session, error: sessionError } = await serviceSupabase
      .from("document_sessions")
      .select("id, user_id, document_type, context")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 400 })
    }

    if (session.document_type !== "quotation") {
      return NextResponse.json(
        { error: "Session does not correspond to a quotation document" },
        { status: 400 }
      )
    }

    // ── Check for existing response (409 if already responded) ────────────────

    const { data: existingResponse } = await serviceSupabase
      .from("quotation_responses" as any)
      .select("id")
      .eq("session_id", sessionId)
      .limit(1)

    if (existingResponse && (existingResponse as any[]).length > 0) {
      return NextResponse.json(
        { error: "A response has already been recorded for this quotation" },
        { status: 409 }
      )
    }

    // ── Build and insert the response row ─────────────────────────────────────

    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get("user-agent")

    const row = buildQuotationResponseRow(
      {
        sessionId,
        responseType: validatedResponseType,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        reason: validatedReason,
      },
      ipAddress,
      userAgent
    )

    const { data: inserted, error: insertError } = await serviceSupabase
      .from("quotation_responses" as any)
      .insert(row)
      .select()
      .single()

    if (insertError || !inserted) {
      console.error("[quotations/respond] Insert error:", insertError)
      return NextResponse.json({ error: "Failed to record response" }, { status: 500 })
    }

    // ── Create owner in-app notification ──────────────────────────────────────

    const ctx = (session.context ?? {}) as Record<string, unknown>
    const referenceNumber =
      (ctx.invoiceNumber as string) || (ctx.referenceNumber as string) || ""

    const notification = buildNotification(
      session.user_id,
      validatedResponseType,
      clientName.trim(),
      referenceNumber,
      sessionId,
      validatedReason
    )

    const { error: notifError } = await serviceSupabase
      .from("notifications" as any)
      .insert(notification)

    if (notifError) {
      // Non-fatal: log but don't fail the request
      console.error("[quotations/respond] Notification insert error:", notifError)
    }

    return NextResponse.json({ success: true, response: inserted })
  } catch (error) {
    console.error("[quotations/respond] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
