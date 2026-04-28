import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

const VALID_METHODS = ["cash", "bank_transfer", "check", "upi", "wire", "other"] as const
type PaymentMethod = typeof VALID_METHODS[number]

/**
 * POST /api/payments/mark-paid
 * Manually marks an invoice as paid (for users without a connected payment gateway).
 * Also cancels all pending email reminders for the session.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth

    let body: { sessionId?: string; paymentMethod?: string; note?: string; paidAt?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { sessionId, paymentMethod = "other", note, paidAt } = body

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    if (!VALID_METHODS.includes(paymentMethod as PaymentMethod)) {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }

    // Verify session ownership and it's an invoice
    const { data: session, error: sessionError } = await supabase
      .from("document_sessions")
      .select("id, document_type, status, user_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.document_type !== "invoice") {
      return NextResponse.json({ error: "Only invoices can be marked as paid" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const paidTimestamp = paidAt || now

    // Check if there's already an invoice_payment record for this session
    const { data: existingPayment } = await (supabase as any)
      .from("invoice_payments")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingPayment) {
      // Update existing payment record to paid
      const { error: updateError } = await (supabase as any)
        .from("invoice_payments")
        .update({
          status: "paid",
          paid_at: paidTimestamp,
          is_manual: true,
          manual_payment_method: paymentMethod,
          manual_payment_note: note || null,
          manually_marked_at: now,
          updated_at: now,
        })
        .eq("id", existingPayment.id)
        .eq("user_id", user.id)

      if (updateError) {
        console.error("Mark paid update error:", updateError)
        return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 })
      }
    } else {
      // Create a new manual payment record
      const { error: insertError } = await (supabase as any)
        .from("invoice_payments")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          status: "paid",
          amount: 0, // unknown for manual — will be 0
          currency: "USD",
          short_url: "",
          gateway: "manual",
          paid_at: paidTimestamp,
          is_manual: true,
          manual_payment_method: paymentMethod,
          manual_payment_note: note || null,
          manually_marked_at: now,
          created_at: now,
        })

      if (insertError) {
        console.error("Mark paid insert error:", insertError)
        return NextResponse.json({ error: "Failed to record payment" }, { status: 500 })
      }
    }

    // Update document_sessions status to 'paid'
    await supabase
      .from("document_sessions")
      .update({ status: "paid", updated_at: now })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    // Cancel all pending email reminders for this session
    await (supabase as any)
      .from("email_schedules")
      .update({
        status: "cancelled",
        cancelled_reason: "payment_received",
        updated_at: now,
      })
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "pending")

    return NextResponse.json({
      success: true,
      message: "Invoice marked as paid. Email reminders have been stopped.",
    })
  } catch (error) {
    console.error("Mark paid error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/payments/mark-paid?sessionId=xxx
 * Unmarks a manually paid invoice (revert to unpaid).
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const sessionId = request.nextUrl.searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // Verify ownership
    const { data: session } = await supabase
      .from("document_sessions")
      .select("id, document_type")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Only allow reverting manual payments
    const { data: payment } = await (supabase as any)
      .from("invoice_payments")
      .select("id, is_manual, gateway")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: "No paid payment found" }, { status: 404 })
    }

    if (!payment.is_manual && payment.gateway !== "manual") {
      return NextResponse.json(
        { error: "Cannot revert gateway-processed payments. Only manual payments can be reverted." },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Revert payment to 'created' (unpaid)
    await (supabase as any)
      .from("invoice_payments")
      .update({
        status: "created",
        paid_at: null,
        is_manual: false,
        manual_payment_method: null,
        manual_payment_note: null,
        manually_marked_at: null,
        updated_at: now,
      })
      .eq("id", payment.id)
      .eq("user_id", user.id)

    // Revert session status
    await supabase
      .from("document_sessions")
      .update({ status: "active", updated_at: now })
      .eq("id", sessionId)
      .eq("user_id", user.id)

    return NextResponse.json({ success: true, message: "Payment status reverted to unpaid." })
  } catch (error) {
    console.error("Unmark paid error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
