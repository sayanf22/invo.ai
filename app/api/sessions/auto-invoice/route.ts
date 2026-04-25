/**
 * PATCH /api/sessions/auto-invoice
 *
 * Authenticated. Updates the auto_invoice_on_sign setting for a contract session.
 * Body: { sessionId, autoInvoiceOnSign: boolean, invoiceRecipientEmail?: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { sessionId: string; autoInvoiceOnSign: boolean; invoiceRecipientEmail?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { sessionId, autoInvoiceOnSign, invoiceRecipientEmail } = body

  if (!sessionId || typeof autoInvoiceOnSign !== "boolean") {
    return NextResponse.json({ error: "sessionId and autoInvoiceOnSign required" }, { status: 400 })
  }

  // Verify ownership and that it's a contract
  const { data: session, error: sessionError } = await auth.supabase
    .from("document_sessions")
    .select("id, document_type, user_id")
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (session.document_type !== "contract") {
    return NextResponse.json({ error: "Auto-invoice is only available for contracts" }, { status: 400 })
  }

  const { error: updateError } = await auth.supabase
    .from("document_sessions")
    .update({
      auto_invoice_on_sign: autoInvoiceOnSign,
      invoice_recipient_email: invoiceRecipientEmail?.trim() ?? null,
    } as any)
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)

  if (updateError) {
    console.error("[auto-invoice] update error:", updateError)
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
  }

  return NextResponse.json({ success: true, autoInvoiceOnSign, invoiceRecipientEmail: invoiceRecipientEmail?.trim() ?? null })
}
