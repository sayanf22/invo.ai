import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize"
import { sendEmail } from "@/lib/mailtrap"
import { generateEmailSubject, renderEmailTemplate } from "@/lib/email-template"
import { logAudit } from "@/lib/audit-log"
import { checkEmailLimit, incrementEmailCount, getFollowUpSchedule } from "@/lib/cost-protection"
import type { UserTier } from "@/lib/cost-protection"

interface SendDocumentRequest {
  sessionId: string
  recipientEmail: string
  personalMessage?: string
  subject?: string        // user-editable subject line
  resend?: boolean
  scheduleFollowUps?: boolean  // whether to schedule auto follow-ups (invoices only)
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

    // 3. Rate limit — skip per-minute burst limiter for email sends
    // The monthly tier-based email limit (step 3b) is sufficient protection.
    // The Postgres-based rate limiter was causing false 429s in Cloudflare Workers
    // due to cookie/auth issues with the RPC call.

    // 3b. Monthly email limit (tier-based)
    const { data: subscription } = await (supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .single()
    const userTier: UserTier = (subscription?.plan as UserTier) || "free"

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

    // 6. Sanitize personal message
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
    const referenceNumber =
      (context.invoiceNumber as string) ||
      (context.referenceNumber as string) ||
      "N/A"
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

    // 9. For invoices: fetch active payment link
    let payNowUrl: string | null = null
    if (documentType === "invoice") {
      const { data: payment } = await supabase
        .from("invoice_payments")
        .select("id")
        .eq("session_id", sessionId)
        .in("status", ["created", "partially_paid"])
        .maybeSingle()

      if (payment) {
        payNowUrl = `https://clorefy.com/pay/${sessionId}`
      }
    }

    // 10. Generate subject (use user-provided subject if available, otherwise auto-generate)
    const subject = (body.subject && body.subject.trim())
      ? sanitizeText(body.subject).slice(0, 200)
      : generateEmailSubject(documentType, referenceNumber, businessName)

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
    const { data: emailRecord, error: insertError } = await supabase
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
    await supabase
      .from("document_sessions")
      .update({ status: "finalized", updated_at: new Date().toISOString() })
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

        const { error: scheduleError } = await supabase
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
