/**
 * Onboarding Forms API
 *
 * POST  (owner, authenticated) — create a client-fillable onboarding form for a
 *        session and email the client a tokenized link. Mirrors the signatures
 *        create flow: email is sent FIRST (atomic) so a link is never created
 *        without an invitation going out.
 * GET   (public, by ?token=) — fetch a form for the /onboard/[token] page. No
 *        auth; uses a service-role client and validates the token itself.
 *
 * SECURITY: owner ops go through authenticateRequest; public lookup validates
 * the token regex before any DB hit and only returns non-sensitive fields.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, getClientIP } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getUserTier } from "@/lib/cost-protection"
import { sendEmail } from "@/lib/mailtrap"
import {
  buildOnboardingFields,
  generateOnboardingToken,
  ONBOARD_TOKEN_REGEX,
  ONBOARD_EXPIRY_DAYS,
} from "@/lib/onboarding-fields"
import { buildOnboardingInvitationEmail } from "@/lib/onboarding-email"
import { getPublicLogoUrl } from "@/lib/public-logo"

export const dynamic = "force-dynamic"

/** Untyped service-role client — onboarding_forms/onboarding_files aren't in generated types. */
function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// ── POST: create + send ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // CSRF protection — state-changing (sends emails, creates DB records).
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase as never)
    if (csrfError) return csrfError

    // Rate limit — email sending is expensive; reuse the "email" category.
    const rateLimitError = await checkRateLimit(auth.user.id, "email", auth.supabase as never)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const sizeError = validateBodySize(body, 10 * 1024)
    if (sizeError) return sizeError

    const { sessionId, clientEmail, clientName, personalMessage } = body as {
      sessionId?: string
      clientEmail?: string
      clientName?: string
      personalMessage?: string
    }

    if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId) || !isEmail(clientEmail)) {
      return NextResponse.json({ error: "sessionId and a valid clientEmail are required." }, { status: 400 })
    }
    if (personalMessage && String(personalMessage).length > 2000) {
      return NextResponse.json({ error: "Message too long." }, { status: 400 })
    }

    // Verify session ownership + type.
    const { data: session, error: sessionErr } = await auth.supabase
      .from("document_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 })
    }
    if (session.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 })
    }
    if ((session.document_type || "").toLowerCase().replace(/\s+/g, "_") !== "client_onboarding_form") {
      return NextResponse.json({ error: "This document is not an onboarding form." }, { status: 400 })
    }

    // Lock policy: once a form has been sent (finalized) or is otherwise locked,
    // it cannot be re-sent. The owner must cancel it first — which invalidates
    // the previous fill link — and then send again. Defense-in-depth for the
    // same rule enforced in the chat + Share UI.
    const lockedStatuses = ["finalized", "signed", "paid"]
    if (lockedStatuses.includes((session.status || "").toLowerCase())) {
      return NextResponse.json(
        { error: "This form has already been sent. Cancel it first to send again." },
        { status: 409 },
      )
    }

    const context = (session.context ?? {}) as Record<string, unknown>

    // Uploads gated to Pro/Agency (entitlement snapshotted at send time).
    const tier = await getUserTier(auth.supabase, auth.user.id)
    const allowUploads = tier === "pro" || tier === "agency"

    const assetUploadLink = typeof context.assetUploadLink === "string" ? context.assetUploadLink : null
    const fields = buildOnboardingFields(context, { allowUploads, assetUploadLink })
    if (fields.length === 0) {
      return NextResponse.json(
        { error: "This form has no questions to fill. Add questions before sending." },
        { status: 400 },
      )
    }

    const token = generateOnboardingToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ONBOARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    const fillUrl = `https://clorefy.com/onboard/${token}`

    const { data: business } = await auth.supabase
      .from("businesses")
      .select("name, logo_url")
      .eq("user_id", auth.user.id)
      .single()

    const businessName = (business as any)?.name || "Your Business"
    // Emails can't load a private R2 key — resolve through the public logo
    // endpoint so the logo actually renders in Gmail/Outlook/Apple Mail.
    const businessLogoUrl = getPublicLogoUrl(auth.user.id, (business as any)?.logo_url || null)
    const formTitle =
      (typeof context.projectName === "string" && context.projectName) ||
      (typeof context.title === "string" && (context.title as string)) ||
      "Client Onboarding"
    const resolvedClientName =
      (typeof clientName === "string" && clientName.trim()) ||
      (typeof context.clientName === "string" && (context.clientName as string)) ||
      (typeof context.toName === "string" && (context.toName as string)) ||
      ""

    // Send invitation email FIRST — atomic with form creation.
    let emailSent = false
    try {
      const result = await sendEmail({
        to: clientEmail,
        subject: `Please complete your onboarding form for ${businessName}`,
        html: buildOnboardingInvitationEmail({
          businessName,
          businessLogoUrl,
          formTitle,
          clientName: resolvedClientName,
          fillUrl,
          expiresAt: expiresAt.toISOString(),
          personalMessage: personalMessage || null,
        }),
        senderName: businessName,
        category: "onboarding_invitation",
      })
      emailSent = result.success === true
      if (!result.success) console.error("[onboarding] email send failed:", result)
    } catch (err) {
      console.error("[onboarding] email exception:", err)
    }

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send the invitation email. The form was not created — please try again." },
        { status: 500 },
      )
    }

    const admin = serviceClient()
    const { data: form, error: insertErr } = await admin
      .from("onboarding_forms")
      .insert({
        user_id: auth.user.id,
        session_id: sessionId,
        token,
        status: "pending",
        allow_uploads: allowUploads,
        fields,
        title: formTitle,
        client_name: resolvedClientName || null,
        client_email: clientEmail,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single()

    if (insertErr || !form) {
      console.error("[onboarding] insert failed:", insertErr?.message)
      return NextResponse.json({ error: "Could not create the form. Please try again." }, { status: 500 })
    }

    // Track the send + finalize the session (mirrors the signature/send flow).
    await admin.from("document_emails").insert({
      user_id: auth.user.id,
      session_id: sessionId,
      recipient_email: clientEmail,
      document_type: "client_onboarding_form",
      personal_message: personalMessage || null,
      status: "sent",
      subject: `Please complete your onboarding form for ${businessName}`,
    }).then(() => {}, () => {})

    await admin.from("document_sessions").update({
      status: "finalized",
      sent_at: now.toISOString(),
      client_name: resolvedClientName || session.client_name || null,
      invoice_recipient_email: clientEmail,
      updated_at: now.toISOString(),
    }).eq("id", sessionId)

    return NextResponse.json({ success: true, onboardUrl: fillUrl, formId: form.id, emailSent })
  } catch (error) {
    console.error("Onboarding create error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}

// ── GET: public token lookup for the fill page ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get("token")
    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid or expired form link." }, { status: 404 })
    }

    const admin = serviceClient()
    const { data: form, error } = await admin
      .from("onboarding_forms")
      .select("id, user_id, token, status, allow_uploads, fields, title, client_name, client_email, draft_answers, answers, submitted_at, expires_at")
      .eq("token", token)
      .single()

    if (error || !form) {
      return NextResponse.json({ error: "Invalid or expired form link." }, { status: 404 })
    }

    // Explicitly voided (e.g. the owner cancelled the document, which expires
    // its outstanding links). Submitted forms are never voided this way.
    if (form.status === "expired") {
      return NextResponse.json({ error: "This form link is no longer active." }, { status: 410 })
    }

    // Expiry (only when not yet submitted).
    if (form.status !== "submitted" && form.expires_at && new Date(form.expires_at) < new Date()) {
      if (form.status !== "expired") {
        await admin.from("onboarding_forms").update({ status: "expired" }).eq("id", form.id)
      }
      return NextResponse.json({ error: "This form link has expired." }, { status: 410 })
    }

    const { data: business } = await admin
      .from("businesses")
      .select("name, logo_url")
      .eq("user_id", form.user_id)
      .single()

    // First-view transition pending → in_progress (best-effort).
    if (form.status === "pending") {
      await admin.from("onboarding_forms")
        .update({ status: "in_progress", ip_address: getClientIP(request) })
        .eq("id", form.id)
        .then(() => {}, () => {})
    }

    return NextResponse.json({
      form: {
        token: form.token,
        title: form.title,
        status: form.status === "pending" ? "in_progress" : form.status,
        allowUploads: form.allow_uploads,
        fields: form.fields,
        clientName: form.client_name,
        clientEmail: form.client_email,
        draftAnswers: form.draft_answers ?? {},
        answers: form.answers ?? null,
        submittedAt: form.submitted_at,
      },
      business: (business as any) ? {
        name: (business as any).name,
        // Public fill page has no auth — resolve to the public logo endpoint.
        logoUrl: getPublicLogoUrl(form.user_id, (business as any).logo_url),
      } : null,
    })
  } catch (error) {
    console.error("Onboarding lookup error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not load the form." }, { status: 500 })
  }
}
