import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize"
import { sendEmail } from "@/lib/mailtrap"
import { generateEmailSubject, renderEmailTemplate } from "@/lib/email-template"
import { getPublicLogoUrl } from "@/lib/public-logo"
import { logAudit } from "@/lib/audit-log"
import { checkEmailLimit, incrementEmailCount, getFollowUpSchedule, getUserTier } from "@/lib/cost-protection"
import { createClient } from "@supabase/supabase-js"
import { cancelProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"
import { getPublicDocumentUrl } from "@/lib/public-capability"

interface SendDocumentRequest {
  sessionId: string
  recipientEmail: string
  personalMessage?: string
  subject?: string        // user-editable subject line
  resend?: boolean
  scheduleFollowUps?: boolean  // whether to schedule auto follow-ups (invoices only)
  paymentLinkExpiryDays?: number  // custom expiry for auto-created payment link
  collectOnlinePayment?: boolean  // affirmative intent; omission/false never creates a link
  confirmedPaymentAmount?: number // minor units shown in the final confirmation UI
  confirmedPaymentCurrency?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const userId = user.id

    // 1b. CSRF validation (bound to authenticated user's session)
    const csrfError = await validateCSRFToken(request, userId, supabase)
    if (csrfError) return csrfError

    // 2. Parse body
    let body: SendDocumentRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    if (body.collectOnlinePayment !== undefined && typeof body.collectOnlinePayment !== "boolean") {
      return NextResponse.json({ error: "collectOnlinePayment must be a boolean" }, { status: 400 })
    }
    if (body.confirmedPaymentAmount !== undefined && !Number.isSafeInteger(body.confirmedPaymentAmount)) {
      return NextResponse.json({ error: "confirmedPaymentAmount must be an integer in minor units" }, { status: 400 })
    }
    if (body.confirmedPaymentCurrency !== undefined && !/^[A-Za-z]{3}$/.test(body.confirmedPaymentCurrency)) {
      return NextResponse.json({ error: "confirmedPaymentCurrency must be a 3-letter currency code" }, { status: 400 })
    }

    // 3. Rate limit — standard Postgres-backed limiter, "email" category (15/min)
    const rateLimitError = await checkRateLimit(userId, "email", supabase as any)
    if (rateLimitError) return rateLimitError

    // 3b. Monthly email limit (tier-based)
    const userTier = await getUserTier(supabase, userId)

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

    // 6. Sanitize personal message (max 500 chars per Req 4.3)
    let personalMessage: string | undefined
    if (body.personalMessage) {
      personalMessage = sanitizeText(body.personalMessage)
      if (personalMessage.length > 500) {
        return NextResponse.json(
          { error: "Personal message must be 500 characters or less" },
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
      .select("id, document_type, context, public_id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // The raw type from the DB. Could be any of the 9 canonical types or
    // the legacy "quotation" alias. Normalize once for capability lookups,
    // but keep `documentType` (raw value) for downstream routing/templates.
    const documentType = session.document_type as string
    const publicDocumentUrl = getPublicDocumentUrl(session.public_id)
    const publicViewUrl = getPublicDocumentUrl(session.public_id, "view")
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
    // Emails can't load an authenticated/private R2 key directly (Gmail/Outlook
    // block data: URIs and there's no session here) — resolve through the
    // public logo endpoint instead. See lib/public-logo.ts.
    const businessLogoUrl = getPublicLogoUrl(userId, business?.logo_url || null)

    // 9. For invoices: create/reuse a payment link only after explicit amount confirmation.
    let payNowUrl: string | null = null
    const collectOnlinePayment = documentType === "invoice" && body.collectOnlinePayment === true
    if (collectOnlinePayment) {
      const { deriveInvoicePaymentDetails } = await import("@/lib/invoice-payment-context")
      let details: ReturnType<typeof deriveInvoicePaymentDetails>
      try {
        details = deriveInvoicePaymentDetails(context, sessionId)
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : "Invalid invoice amount",
        }, { status: 422 })
      }

      const confirmedCurrency = body.confirmedPaymentCurrency?.toUpperCase()
      if (
        !Number.isSafeInteger(body.confirmedPaymentAmount)
        || body.confirmedPaymentAmount !== details.amount
        || confirmedCurrency !== details.currency
      ) {
        return NextResponse.json({
          error: "The invoice amount changed while preparing to send. Review the final amount and confirm Send again.",
          code: "PAYMENT_AMOUNT_CHANGED",
        }, { status: 409 })
      }

      // Use service role client for invoice_payments (may not be in RLS scope)
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: payment, error: paymentLookupError } = await (supabaseAdmin as any)
        .from("invoice_payments")
        .select("id, status, amount, currency")
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .in("status", ["created", "partially_paid"])
        .maybeSingle()
      if (paymentLookupError) throw paymentLookupError

      if (payment) {
        if (payment.amount !== details.amount || payment.currency?.toUpperCase() !== details.currency) {
          return NextResponse.json({
            error: "An older payment link exists for a different amount. Cancel it, review the invoice, and send again.",
            code: "STALE_PAYMENT_LINK",
          }, { status: 409 })
        }
        payNowUrl = publicDocumentUrl
      } else {
        try {
          const { getUserPaymentCredentials } = await import("@/lib/payment-credentials")
          const credentials = await getUserPaymentCredentials(userId)
          if (!credentials) {
            return NextResponse.json({ error: "Connect and verify a payment gateway before including a payment link." }, { status: 422 })
          }

          const requested = typeof (context as any).paymentMethod === "string"
            ? String((context as any).paymentMethod).toLowerCase()
            : ""
          const gateway = (["razorpay", "stripe", "cashfree"].includes(requested) && (credentials as any)[requested])
            ? requested
            : details.currency === "INR"
              ? (credentials.razorpay ? "razorpay" : credentials.cashfree ? "cashfree" : credentials.stripe ? "stripe" : null)
              : (credentials.stripe ? "stripe" : credentials.razorpay ? "razorpay" : null)
          if (!gateway || (gateway === "cashfree" && details.currency !== "INR")) {
            return NextResponse.json({ error: `No connected payment gateway supports ${details.currency}.` }, { status: 422 })
          }

          let providerLinkId = ""
          let correlationId = ""
          let shortUrl = ""
          let expiresAt: string | null = null
          let testMode = false
          if (gateway === "razorpay") {
            const { createPaymentLink } = await import("@/lib/razorpay")
            const credential = credentials.razorpay!
            const requestedExpiry = Number(body.paymentLinkExpiryDays)
            const link = await createPaymentLink({
              amount: details.amount, currency: details.currency, description: details.description,
              referenceId: details.referenceId, customerName: details.customerName,
              customerEmail: recipientEmail, customerPhone: details.customerPhone,
              sessionId, userId, dueDateIso: details.dueDate,
              expireInDays: Number.isInteger(requestedExpiry) && requestedExpiry >= 1 && requestedExpiry <= 365 ? requestedExpiry : undefined,
              userKeyId: credential.keyId, userKeySecret: credential.keySecret,
            })
            providerLinkId = correlationId = link.id
            shortUrl = link.short_url
            expiresAt = link.expire_by ? new Date(link.expire_by * 1000).toISOString() : null
            testMode = credential.testMode
          } else if (gateway === "stripe") {
            const { createStripePaymentLink } = await import("@/lib/stripe-payments")
            const credential = credentials.stripe!
            const link = await createStripePaymentLink({ ...details, sessionId, publicId: session.public_id, userId, customerEmail: recipientEmail, userSecretKey: credential.secretKey })
            providerLinkId = correlationId = link.id
            shortUrl = link.url
            testMode = credential.testMode
          } else {
            const { createCashfreePaymentLink } = await import("@/lib/cashfree-payment-links")
            const credential = credentials.cashfree!
            const link = await createCashfreePaymentLink({
              ...details, sessionId, publicId: session.public_id, userId, customerEmail: recipientEmail,
              testMode: credential.testMode, userClientId: credential.clientId,
              userClientSecret: credential.clientSecret, expireInDays: 37,
            })
            correlationId = String(link.cf_link_id)
            providerLinkId = link.link_id
            shortUrl = link.link_url
            testMode = credential.testMode
          }

          const { error: insertError } = await supabaseAdmin.from("invoice_payments").insert({
            session_id: sessionId, user_id: userId, razorpay_payment_link_id: correlationId,
            provider_link_id: providerLinkId, short_url: shortUrl, amount: details.amount,
            currency: details.currency, status: "created", reference_id: details.referenceId,
            description: details.description, customer_name: details.customerName ?? null,
            customer_email: recipientEmail, customer_phone: details.customerPhone ?? null,
            expires_at: expiresAt, gateway, is_test_mode: testMode,
          } as any)
          if (insertError) {
            await cancelProviderLink(
              gateway as InvoicePaymentGateway,
              correlationId,
              providerLinkId,
              credentials,
            ).catch(cleanupError => console.error("Auto-created payment link cleanup failed:", cleanupError))
            throw insertError
          }
          payNowUrl = publicDocumentUrl
        } catch (err) {
          console.error("Auto-create payment link failed:", err)
          return NextResponse.json({ error: "The payment gateway could not create a payment link. Verify the connection and invoice amount, then try again." }, { status: 502 })
        }
      }
    }

    // 10. Generate subject (use user-provided subject if available, otherwise auto-generate)
    const subject = (body.subject && body.subject.trim())
      ? sanitizeText(body.subject).slice(0, 200)
      : generateEmailSubject(documentType, referenceNumber, businessName)

    // Signing invitations are sent by /api/signatures while the raw token exists.
    // Generic document emails must never read or reconstruct a stored signing token.
    const signingUrl: string | null = null

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
      viewDocumentUrl: publicViewUrl,
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

        // Resolve the anchor date for the schedule:
        //   - For pre_due/due_today: schedule relative to the invoice's due date (context.dueDate)
        //   - For followup/final:    schedule relative to the due date so overdue cadence is correct
        //   - If no due date exists: anchor to "now" (today is treated as the due date)
        const dueDateStr = (context.dueDate as string) || (context.invoiceDate as string) || null
        const anchorDate = dueDateStr ? new Date(dueDateStr) : new Date(now)
        // Normalize to 9 AM UTC on that day
        anchorDate.setUTCHours(9, 0, 0, 0)

        const scheduleRows = followUps
          .map(({ daysFromNow, sequenceStep, sequenceType }) => {
            const scheduledFor = new Date(anchorDate)
            scheduledFor.setUTCDate(scheduledFor.getUTCDate() + daysFromNow)
            return {
              user_id: userId,
              session_id: sessionId,
              recipient_email: recipientEmail,
              document_type: documentType,
              subject: null,
              scheduled_for: scheduledFor.toISOString(),
              sequence_step: sequenceStep,
              sequence_type: sequenceType,
              status: "pending",
            }
          })
          // Skip any reminders that would be scheduled in the past
          // (e.g., pre_due -3 days when invoice is already overdue)
          .filter((row) => new Date(row.scheduled_for).getTime() > now.getTime())

        if (scheduleRows.length > 0) {
          const { error: scheduleError } = await (supabase as any)
            .from("email_schedules")
            .insert(scheduleRows)

          if (scheduleError) {
            console.error("Failed to schedule follow-ups:", scheduleError)
            // Non-fatal — email was sent successfully
          }
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
