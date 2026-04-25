import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/emails/track-view
 * 
 * Public endpoint — no auth required.
 * Tracks when a document is viewed via /view/ or /pay/ page.
 * Increments view_count on the document_emails table for the session.
 * Also updates invoice_payments.view_count if a payment record exists.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date().toISOString()

    // Update invoice_payments view_count (if payment record exists)
    const { data: payment } = await supabase
      .from("invoice_payments")
      .select("id, view_count")
      .eq("session_id", sessionId)
      .in("status", ["created", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (payment) {
      await supabase
        .from("invoice_payments")
        .update({
          view_count: (payment.view_count || 0) + 1,
          link_viewed_at: now,
          updated_at: now,
        })
        .eq("id", payment.id)
    }

    // Also update document_sessions with a view timestamp
    await supabase
      .from("document_sessions")
      .update({ last_viewed_at: now })
      .eq("id", sessionId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("Track view error:", err)
    return NextResponse.json({ ok: true }) // Don't fail — tracking is non-critical
  }
}
