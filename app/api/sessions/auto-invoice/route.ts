/**
 * PATCH /api/sessions/auto-invoice
 *
 * Authenticated. Updates the auto_invoice_on_sign setting for a contract session.
 * Body: { sessionId, autoInvoiceOnSign: boolean, invoiceRecipientEmail?: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PATCH(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error
  const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
  if (csrfError) return csrfError
  const rateError = await checkRateLimit(auth.user.id, "signature", auth.supabase as any)
  if (rateError) return rateError

  let body: { sessionId: string; autoInvoiceOnSign: boolean; invoiceRecipientEmail?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const sizeError = validateBodySize(body, 4 * 1024)
  if (sizeError) return sizeError

  const { sessionId, autoInvoiceOnSign, invoiceRecipientEmail } = body

  if (!sessionId || typeof autoInvoiceOnSign !== "boolean") {
    return NextResponse.json({ error: "sessionId and autoInvoiceOnSign required" }, { status: 400 })
  }
  const normalizedRecipientEmail = invoiceRecipientEmail?.trim().toLowerCase() || null
  if (normalizedRecipientEmail && (
    normalizedRecipientEmail.length > 254 || !EMAIL_PATTERN.test(normalizedRecipientEmail)
  )) {
    return NextResponse.json({ error: "Invalid invoice recipient email" }, { status: 400 })
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
      invoice_recipient_email: normalizedRecipientEmail,
    } as any)
    .eq("id", sessionId)
    .eq("user_id", auth.user.id)

  if (updateError) {
    console.error("[auto-invoice] update error:", updateError)
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
  }

  return NextResponse.json({ success: true, autoInvoiceOnSign, invoiceRecipientEmail: normalizedRecipientEmail })
}
