import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/emails/view-document?sessionId=xxx
 * 
 * Public endpoint — no auth required.
 * Returns document context data for email recipients to view the document.
 * Uses service role to bypass RLS (the session ID acts as the access token).
 * Only returns the document context — no user data, no sensitive info.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId || typeof sessionId !== "string" || sessionId.length < 10) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  // UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch document session — only context and type, no user info
    const { data: session, error } = await supabase
      .from("document_sessions")
      .select("context, document_type, status")
      .eq("id", sessionId)
      .single()

    if (error || !session?.context) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Fetch payment info if it's an invoice — only active/paid payments
    let payment = null
    if (session.document_type === "invoice") {
      const { data: pay } = await supabase
        .from("invoice_payments")
        .select("short_url, status, amount, currency, amount_paid")
        .eq("session_id", sessionId)
        .in("status", ["created", "partially_paid", "paid"]) // exclude cancelled/expired
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pay) payment = pay
    }

    return NextResponse.json({
      context: session.context,
      documentType: session.document_type,
      sessionStatus: session.status,
      payment,
    })
  } catch (err) {
    console.error("View document error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
