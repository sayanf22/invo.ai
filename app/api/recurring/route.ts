/**
 * Recurring Invoices API
 *
 * GET  /api/recurring?sessionId=  — get recurring schedule for a session
 * POST /api/recurring             — create or update recurring schedule
 * DELETE /api/recurring?sessionId= — cancel (deactivate) recurring schedule
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

function computeNextRunAt(frequency: string, from: Date = new Date()): Date {
  const next = new Date(from)
  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7)
      break
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      break
    case "quarterly":
      next.setMonth(next.getMonth() + 3)
      break
    default:
      next.setMonth(next.getMonth() + 1)
  }
  // Set to 9 AM UTC
  next.setUTCHours(9, 0, 0, 0)
  return next
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const sessionId = new URL(request.url).searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })

  const { data, error } = await (auth.supabase as any)
    .from("recurring_invoices")
    .select("*")
    .eq("source_session_id", sessionId)
    .eq("user_id", auth.user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  return NextResponse.json({ recurring: data ?? null })
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { sessionId: string; frequency: string; autoSend?: boolean; recipientEmail?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId, frequency, autoSend = false, recipientEmail } = body

  if (!sessionId || !frequency) {
    return NextResponse.json({ error: "sessionId and frequency required" }, { status: 400 })
  }

  if (!["weekly", "monthly", "quarterly"].includes(frequency)) {
    return NextResponse.json({ error: "frequency must be weekly, monthly, or quarterly" }, { status: 400 })
  }

  // Verify session ownership and it's an invoice
  const { data: session, error: sessionError } = await auth.supabase
    .from("document_sessions")
    .select("id, document_type, user_id")
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.document_type !== "invoice") {
    return NextResponse.json({ error: "Recurring is only available for invoices" }, { status: 400 })
  }

  const nextRunAt = computeNextRunAt(frequency)

  // Upsert — create or update
  const { data, error } = await (auth.supabase as any)
    .from("recurring_invoices")
    .upsert({
      user_id: auth.user.id,
      source_session_id: sessionId,
      frequency,
      is_active: true,
      auto_send: autoSend,
      recipient_email: recipientEmail ?? null,
      next_run_at: nextRunAt.toISOString(),
    }, { onConflict: "source_session_id" })
    .select()
    .single()

  if (error) {
    console.error("[recurring] upsert error:", error)
    return NextResponse.json({ error: "Failed to save recurring schedule" }, { status: 500 })
  }

  return NextResponse.json({ recurring: data })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const sessionId = new URL(request.url).searchParams.get("sessionId")
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 })

  const { error } = await (auth.supabase as any)
    .from("recurring_invoices")
    .update({ is_active: false })
    .eq("source_session_id", sessionId)
    .eq("user_id", auth.user.id)

  if (error) return NextResponse.json({ error: "Failed to cancel" }, { status: 500 })
  return NextResponse.json({ success: true })
}
