import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize"
import { sendEmail } from "@/lib/mailtrap"
import { generateEmailSubject, renderEmailTemplate } from "@/lib/email-template"
import { logAudit } from "@/lib/audit-log"
import { checkEmailLimit, incrementEmailCount, getFollowUpSchedule } from "@/lib/cost-protection"
import { parseTier, type UserTier } from "@/lib/cost-protection"
import { createClient } from "@supabase/supabase-js"

interface SendDocumentRequest {
  sessionId: string
  recipientEmail: string
  personalMessage?: string
  subject?: string        // user-editable subject line
  resend?: boolean
  scheduleFollowUps?: boolean  // whether to schedule auto follow-ups (invoices only)
  paymentLinkExpiryDays?: number  // custom expiry for auto-created payment link
}

// ── Per-user burst rate limiter (in-memory, per worker instance) ──────────────
// Prevents a single user from sending many emails in a short burst.
// Max 3 emails per 60 seconds per user. Resets per worker restart (acceptable).
const emailBurstStore = new Map<string, { count: number; windowStart: number }>()
const EMAIL_BURST_MAX = 3
const EMAIL_BURST_WINDOW_MS = 60_000 // 1 minute

function checkEmailBurstLimit(userId: string): boolean {
  const now = Date.now()
  const record = emailBurstStore.get(userId)
  if (!record || now - record.windowStart > EMAIL_BURST_WINDOW_MS) {
    emailBurstStore.set(userId, { count: 1, windowStart: now })
    return true // allowed
  }
  if (record.count >= EMAIL_BURST_MAX) return false // blocked
  record.count++
  return true // allowed
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const userId = user.id

    // 2. Parse body
    let body: SendDocumentRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    // 3. Burst rate limit — max 3 emails per 60 seconds per user
    // Prevents rapid-fire email spam even within monthly limits
    if (!checkEmailBurstLimit(userId)) {
      return NextResponse.json(
        { error: "Too many emails sent too quickly. Please wait a minute before sending again." },
        { status: 429, headers: { "Retry-After": "60" } }
      )
    }

    // 3b. Monthly email limit (tier-based)
    const { data: subscription } = await (supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .single()
    const userTier = parseTier(subscription?.plan)

    const emailLimitError = await checkEmailLimit(supabase, userId, userTier)
    if (emailLimitError) return emailLimitError

    // 4. Validate required fields
    if (!body.sessionId || !body.recipientEmail) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, recipientEmail" },
        { status: 400 }
      )
    }

    // 5. Validate email
    let recipientEmail: string
    try {
      recipientEmail = sanitizeEmail(body.recipientEmail)
    } catch {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // 6. Sanitize personal message (AI-generated messages can be up to 2000 chars)
    let personalMessage: string | undefined
    if (body.personalMessage) {
      personalMessage = sanitizeText(body.personalMessage)
      if (personalMessage.length > 2000) {
        return NextResponse.json(
          { error: "Message must be 2000 characters or less" },
          { status: 400 }
        )
      }
    }

    const { sessionId } = body

    // Validate sessionId is a UUID to prevent unnecessary DB queries
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!sessionId || !uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    // 7. Fetch document session (verify ownership)
    const { data: session, error: sessionError } = await supabase
      .from("document_sessions")
      .select("id, document_type, context")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const documentType = session.document_type as "invoice" | "contract" | "quotation" | "proposal"
    const context = (session.context ?? {}) as Record<string, unknown>

    // Extract fields from context
    // For non-invoice documents, prefer referenceNumber over invoiceNumber
    const referenceNumber = documentType === "invoice"
      ? ((context.invoiceNumber as string) || (context.referenceNumber as string) || "N/A")
      : ((context.referenceNumber as string) || (context.invoiceNumber as string) || "N/A")
    const totalAmount =
      (context.total as string) ||
      (context.totalAmount as string) ||
      null
    const currency = (context.currency as string) || null
    const dueDate = (context.dueDate as string) || null
    const description = (context.description as string) || null
    const recipientName = (context.toName as string) || "Valued Client"

    // 8. Fetch business info
    const { data: business } = await supabase
      .from("businesses")
      .select("name, logo_url")
      .eq("user_id", userId)
      .maybeSingle()

    const businessName = business?.name || "Your Business"
    const businessLogoUrl = business?.logo_url || null

    // 9. For invoices: fetch active payment link — auto-create if none exists
    let payNowUrl: string | null = null
    if (documentType === "invoice") {
      // Use service role client for invoice_payments (may not be in RLS scope)
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: payment } = await (supabaseAdmin as any)
        .from("invoice_payments")
        .select("id, status")
        .eq("session_id", sessionId)
        .in("status", ["created", "partially_paid"])
        .maybeSingle()

      if (payment) {
        // Active payment link exists
        payNowUrl = `https://clorefy.com/pay/${sessionId}`
      } else {
        // No active payment link — try to auto-create one if user has Razorpay configured
        try {
          const { getUserRazorpayCredentials } = await import("@/app/api/payments/settings/route")
          const userCreds = await getUserRazorpayCredentials(userId)

          if (userCreds) {
            // Calculate invoice total from context
            const items = (context.items as any[]) || []
            const subtotal = items.reduce((sum: number, item: any) => {
              const qty = Number(item.quantity) || 0
              const rate = Number(item.rate) || 0
              const disc = Number(item.discount) || 0
              return sum + (qty * rate * (1 - disc / 100))
            }, 0)
            const taxRate = Number(context.taxRate) || 0
            const discountValue = Number(context.discountValue) || 0
            const shippingFee = Number(context.shippingFee) || 0
            const discountAmount = (context.discountType as string) === "percent"
              ? subtotal * (discountValue / 100)
              : discountValue
            const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
            const total = subtotal - discountAmount + taxAmount + shippingFee

            const invoiceCurrency = (context.currency as string) || "INR"
            const CURRENCY_MULTIPLIERS: Record<string, number> = {
              INR: 100, USD: 100, EUR: 100, GBP: 100, SGD: 100,
              AED: 100, CAD: 100, AUD: 100, PHP: 100, MYR: 100, JPY: 1,
            }
            const amountInSmallestUnit = Math.round(total * (CURRENCY_MULTIPLIERS[invoiceCurrency.toUpperCase()] ?? 100))

            if (amountInSmallestUnit > 0) {
              const { createPaymentLink } = await import("@/lib/razorpay")
              const invoiceRef = referenceNumber || `INV-${sessionId.slice(0, 8).toUpperCase()}`
              const description = `Invoice ${invoiceRef}${recipientName !== "Valued Client" ? ` for ${recipientName}` : ""}`
              const expiryDays = body.paymentLinkExpiryDays || undefined

              const razorpayLink = await createPaymentLink({
                amount: amountInSmallestUnit,
                currency: invoiceCurrency.toUpperCase(),
                description,
                referenceId: invoiceRef,
                customerName: recipientName !== "Valued Client" ? recipientName : undefined,
                customerEmail: recipientEmail,
                sessionId,
                userId,
                expireInDays: expiryDays,
                dueDateIso: (context.dueDate as string) || undefined,
                userKeyId: userCreds.keyId,
                userKeySecret: userCreds.keySecret,
              })

              // Save to DB
              await supabaseAdmin
                .from("invoice_payments")
                .insert({
                  session_id: sessionId,
                  user_id: userId,
                  razorpay_payment_link_id: razorpayLink.id,
                  short_url: razorpayLink.short_url,
                  amount: amountInSmallestUnit,
                  currency: invoiceCurrency.toUpperCase(),
                  status: "created",
                  reference_id: invoiceRef,
                  description,
                  customer_name: recipientName !== "Valued Client" ? recipientName : null,
                  customer_email: recipientEmail,
                  expires_at: new Date(razorpayLink.expire_by * 1000).toISOString(),
                })

              payNowUrl = `https://clorefy.com/pay/${sessionId}`
            }
          }
        } catch (err) {
          // Non-fatal — email will still be sent without Pay Now button
          console.error("Auto-create payment link failed (non-fatal):", err)
        }
      }
    }

    // 10. Generate subject (use user-provided subject if available, otherwise auto-generate)
    const subject = (body.subject && body.subject.trim())
      ? sanitizeText(body.subject).slice(0, 200)
      : generateEmailSubject(documentType, referenceNumber, businessName)

    // 10b. For contracts/quotations/proposals, look up signing token to include Sign button
    let signingUrl: string | null = null
    if (documentType === "contract" || documentType === "quotation" || documentType === "proposal") {
      const { data: sigRow } = await supabase
        .from("signatures")
        .select("token")
        .eq("session_id" as any, sessionId)
        .eq("signer_email", recipientEmail)
        .is("signed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (sigRow?.token) {
        signingUrl = `https://clorefy.com/sign/${sigRow.token}`
      }
    }

    // 11. Render HTML
    const html = renderEmailTemplate({
      businessName,
      businessLogoUrl,
      documentType,
      referenceNumber,
      recipientName,
      totalAmount,
      currency,
      dueDate,
      description,
      personalMessage: personalMessage || null,
      viewDocumentUrl: `https://clorefy.com/view/${sessionId}`,
      payNowUrl,
      signingUrl,
    })

    // 12. Send email
    const sendResult = await sendEmail({
      to: recipientEmail,
      subject,
      html,
      senderName: businessName,
      category: documentType,
    })

    // 13 & 14. Handle Mailtrap errors
    if (!sendResult.success) {
      console.error("Mailtrap send failed:", sendResult.statusCode, sendResult.message)
      if (sendResult.statusCode === 429) {
        return NextResponse.json(
          { error: "Daily email limit reached. Please try again later." },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: `Failed to send email: ${sendResult.message || "Unknown error"}` },
        { status: 502 }
      )
    }

    const mailtrapMessageId = sendResult.messageIds[0] ?? null

    // 15. Insert into document_emails
    const { data: emailRecord, error: insertError } = await (supabase as any)
      .from("document_emails")
      .insert({
        user_id: userId,
        session_id: sessionId,
        recipient_email: recipientEmail,
        document_type: documentType,
        personal_message: personalMessage || null,
        mailtrap_message_id: mailtrapMessageId,
        status: "sent",
        subject,
      })
      .select("id")
      .single()

    if (insertError || !emailRecord) {
      console.error("Failed to insert email record:", insertError)
      return NextResponse.json(
        { error: "Email sent but failed to save record. Please contact support." },
        { status: 500 }
      )
    }

    // 16. Audit log
    await logAudit(
      supabase,
      {
        user_id: userId,
        action: "email.send",
        resource_type: "email",
        resource_id: emailRecord.id,
        metadata: {
          document_type: documentType,
          recipient_email: recipientEmail,
        },
      },
      request
    )

    // 17. Increment monthly email count
    await incrementEmailCount(supabase, userId)

    // 18. Lock the document session (finalize it — no more AI edits)
    // Also stamp sent_at and client_name for the Documents page
    const clientName = (context.toName as string) || null
    await supabase
      .from("document_sessions")
      .update({
        status: "finalized",
        sent_at: new Date().toISOString(),
        client_name: clientName || undefined,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", sessionId)
      .eq("user_id", userId)

    // 19. Schedule auto follow-up reminders (invoices only, paid tiers, when requested)
    if (
      body.scheduleFollowUps !== false &&  // default: schedule unless explicitly disabled
      documentType === "invoice" &&
      userTier !== "free"
    ) {
      const followUps = getFollowUpSchedule(userTier)
      if (followUps.length > 0) {
        // Cancel any existing pending schedules for this session first (idempotent)
        await (supabase as any).rpc("cancel_email_schedules", {
          p_session_id: sessionId,
          p_reason: "resend",
        })

        const now = new Date()
        const scheduleRows = followUps.map(({ daysFromNow, sequenceStep, sequenceType }) => {
          const scheduledFor = new Date(now)
          scheduledFor.setDate(scheduledFor.getDate() + daysFromNow)
          // Set to 9 AM UTC for all follow-ups
          scheduledFor.setUTCHours(9, 0, 0, 0)
          return {
            user_id: userId,
            session_id: sessionId,
            recipient_email: recipientEmail,
            document_type: documentType,
            subject: null, // will be generated at send time
            scheduled_for: scheduledFor.toISOString(),
            sequence_step: sequenceStep,
            sequence_type: sequenceType,
            status: "pending",
          }
        })

        const { error: scheduleError } = await (supabase as any)
          .from("email_schedules")
          .insert(scheduleRows)

        if (scheduleError) {
          console.error("Failed to schedule follow-ups:", scheduleError)
          // Non-fatal — email was sent successfully
        }
      }
    }

    // 20. Return success
    return NextResponse.json(
      { emailId: emailRecord.id, message: "Email sent successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Unexpected error in send-document:", error)
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    )
  }
}
