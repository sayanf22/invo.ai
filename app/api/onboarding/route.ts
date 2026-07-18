/**
 * Onboarding Forms API
 *
 * POST  (owner, authenticated) — securely create or reuse a tokenized,
 *        client-fillable onboarding link. `delivery: "link"` returns it without
 *        sending email; `delivery: "email"` also sends the invitation.
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
import { canUseNativeOnboardingUploads } from "@/lib/onboarding-entitlements"
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

// ── POST: securely create/reuse a fillable link and optionally email it ──────
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase as never)
    if (csrfError) return csrfError

    const body = await request.json()
    const sizeError = validateBodySize(body, 10 * 1024)
    if (sizeError) return sizeError

    const { sessionId, clientEmail, clientName, personalMessage, delivery: requestedDelivery } = body as {
      sessionId?: string
      clientEmail?: string
      clientName?: string
      personalMessage?: string
      delivery?: "email" | "link"
    }
    const delivery = requestedDelivery ?? "email"
    const validSessionId = typeof sessionId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)

    if (!validSessionId || !["email", "link"].includes(delivery)) {
      return NextResponse.json({ error: "A valid sessionId and delivery mode are required." }, { status: 400 })
    }
    if (delivery === "email" && !isEmail(clientEmail)) {
      return NextResponse.json({ error: "A valid clientEmail is required for email delivery." }, { status: 400 })
    }
    if (clientName && String(clientName).length > 200) {
      return NextResponse.json({ error: "Client name is too long." }, { status: 400 })
    }
    if (personalMessage && String(personalMessage).length > 2000) {
      return NextResponse.json({ error: "Message too long." }, { status: 400 })
    }

    const rateLimitError = await checkRateLimit(
      auth.user.id,
      delivery === "email" ? "email" : "general",
      auth.supabase as never,
    )
    if (rateLimitError) return rateLimitError

    // Ownership is part of the query to prevent cross-user existence disclosure.
    const { data: session, error: sessionErr } = await auth.supabase
      .from("document_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (sessionErr || !session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 })
    }
    if ((session.document_type || "").toLowerCase().replace(/\s+/g, "_") !== "client_onboarding_form") {
      return NextResponse.json({ error: "This document is not an onboarding form." }, { status: 400 })
    }

    const admin = serviceClient()
    const now = new Date()
    const context = (session.context ?? {}) as Record<string, unknown>

    // Idempotency: reuse the newest active capability instead of creating a new
    // bearer token on every copy/share click.
    const { data: foundForm } = await admin
      .from("onboarding_forms")
      .select("id, token, status, title, client_name, client_email, expires_at")
      .eq("session_id", sessionId)
      .eq("user_id", auth.user.id)
      .neq("status", "expired")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let activeForm = foundForm
    if (
      activeForm &&
      activeForm.status !== "submitted" &&
      activeForm.expires_at &&
      new Date(activeForm.expires_at) <= now
    ) {
      await admin.from("onboarding_forms").update({ status: "expired" }).eq("id", activeForm.id)
      activeForm = null
    }

    if (delivery === "email" && activeForm?.status === "submitted") {
      return NextResponse.json({ error: "This onboarding form has already been submitted." }, { status: 409 })
    }
    if (!activeForm && ["signed", "paid"].includes((session.status || "").toLowerCase())) {
      return NextResponse.json({ error: "This completed document cannot create a new onboarding link." }, { status: 409 })
    }

    const formTitle =
      activeForm?.title ||
      (typeof context.projectName === "string" && context.projectName) ||
      (typeof context.title === "string" && context.title) ||
      "Client Onboarding"
    const resolvedClientName =
      (typeof clientName === "string" && clientName.trim()) ||
      activeForm?.client_name ||
      (typeof context.clientName === "string" && context.clientName) ||
      (typeof context.toName === "string" && context.toName) ||
      ""

    let createdNow = false
    if (!activeForm) {
      const tier = await getUserTier(auth.supabase, auth.user.id)
      const allowUploads = canUseNativeOnboardingUploads(tier)
      const assetUploadLink = typeof context.assetUploadLink === "string" ? context.assetUploadLink : null
      const fields = buildOnboardingFields(context, { allowUploads, assetUploadLink })
      if (fields.length === 0) {
        return NextResponse.json(
          { error: "This form has no questions to fill. Add questions before creating its link." },
          { status: 400 },
        )
      }

      const token = generateOnboardingToken()
      const expiresAt = new Date(now.getTime() + ONBOARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
      const { data: insertedForm, error: insertErr } = await admin
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
          client_email: delivery === "email" ? clientEmail : null,
          expires_at: expiresAt.toISOString(),
        })
        .select("id, token, status, title, client_name, client_email, expires_at")
        .single()

      if (insertErr || !insertedForm) {
        console.error("[onboarding] insert failed:", insertErr?.message)
        return NextResponse.json({ error: "Could not create the form link. Please try again." }, { status: 500 })
      }
      activeForm = insertedForm
      createdNow = true
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com").replace(/\/$/, "")
    const fillUrl = `${appUrl}/onboard/${activeForm.token}`
    const expiresAtIso = activeForm.expires_at ||
      new Date(now.getTime() + ONBOARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    let emailSent = false

    if (delivery === "email") {
      const recipientEmail = clientEmail as string
      const { data: business } = await auth.supabase
        .from("businesses")
        .select("name, logo_url")
        .eq("user_id", auth.user.id)
        .single()
      const businessName = (business as { name?: string | null } | null)?.name || "Your Business"
      const businessLogoUrl = getPublicLogoUrl(
        auth.user.id,
        (business as { logo_url?: string | null } | null)?.logo_url || null,
      )

      try {
        const result = await sendEmail({
          to: recipientEmail,
          subject: `Please complete your onboarding form for ${businessName}`,
          html: buildOnboardingInvitationEmail({
            businessName,
            businessLogoUrl,
            formTitle,
            clientName: resolvedClientName,
            fillUrl,
            expiresAt: expiresAtIso,
            personalMessage: personalMessage || null,
          }),
          senderName: businessName,
          category: "onboarding_invitation",
        })
        emailSent = result.success === true
        if (!result.success) console.error("[onboarding] email send failed:", result)
      } catch (error) {
        console.error("[onboarding] email exception:", error)
      }

      if (!emailSent) {
        if (createdNow) await admin.from("onboarding_forms").delete().eq("id", activeForm.id)
        return NextResponse.json({ error: "Failed to send the invitation email. Please try again." }, { status: 500 })
      }

      await admin.from("onboarding_forms").update({
        client_name: resolvedClientName || null,
        client_email: recipientEmail,
      }).eq("id", activeForm.id)

      await admin.from("document_emails").insert({
        user_id: auth.user.id,
        session_id: sessionId,
        recipient_email: recipientEmail,
        document_type: "client_onboarding_form",
        personal_message: personalMessage || null,
        status: "sent",
        subject: `Please complete your onboarding form for ${businessName}`,
      }).then(() => {}, () => {})
    }

    const sessionUpdate: Record<string, unknown> = {
      status: "finalized",
      sent_at: session.sent_at || now.toISOString(),
      client_name: resolvedClientName || session.client_name || null,
      updated_at: now.toISOString(),
    }
    if (delivery === "email") sessionUpdate.invoice_recipient_email = clientEmail

    const { error: finalizeErr } = await admin
      .from("document_sessions")
      .update(sessionUpdate)
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
    if (finalizeErr) {
      console.error("[onboarding] session finalize failed:", finalizeErr.message)
      if (createdNow && !emailSent) await admin.from("onboarding_forms").delete().eq("id", activeForm.id)
      return NextResponse.json({ error: "The link was created but the document could not be locked. Please try again." }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        onboardUrl: fillUrl,
        formId: activeForm.id,
        emailSent,
        reused: !createdNow,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("Onboarding create error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Internal server error." }, { status: 500 })
  }
}

// ── GET: public token lookup (fill page) OR owner sessionId lookup (chat link card) ──
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const sessionId = searchParams.get("sessionId")

    // Owner-authenticated lookup: "what's the current fillable link for this
    // onboarding session?" Used by the chat's "show me the link" card, which
    // otherwise has no way to know the token (it's never stored client-side).
    // Returns the most recent NON-expired form for the session — after a
    // cancel+resend, the old form is expired and this always surfaces the
    // fresh one.
    if (sessionId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId." }, { status: 400 })
      }
      const auth = await authenticateRequest(request)
      if (auth.error) return auth.error

      const admin = serviceClient()
      const { data: form } = await admin
        .from("onboarding_forms")
        .select("token, status")
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .neq("status", "expired")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!form) {
        return NextResponse.json({ error: "No active onboarding link found for this document." }, { status: 404 })
      }

      // Only surface a live link when the document is still "sent" (finalized),
      // or the form is already submitted (owner may reference the completed
      // record). If the owner cancelled/unlocked, there is no active link —
      // matching what the client sees on the public page.
      const { data: ownerSession } = await admin
        .from("document_sessions")
        .select("status")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .maybeSingle()
      const ownerSessionStatus = (ownerSession?.status || "").toLowerCase()
      const linkIsLive = form.status === "submitted" || ["finalized", "signed"].includes(ownerSessionStatus)
      if (!linkIsLive) {
        return NextResponse.json({ error: "No active onboarding link found for this document." }, { status: 404 })
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
      return NextResponse.json({ onboardUrl: `${appUrl}/onboard/${form.token}`, status: form.status })
    }

    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid or expired form link." }, { status: 404 })
    }

    const admin = serviceClient()
    const { data: form, error } = await admin
      .from("onboarding_forms")
      .select("id, user_id, session_id, token, status, allow_uploads, fields, title, client_name, client_email, draft_answers, answers, submitted_at, expires_at")
      .eq("token", token)
      .single()

    if (error || !form) {
      return NextResponse.json({ error: "Invalid or expired form link." }, { status: 404 })
    }

    // ── Determine link availability + a precise, client-facing reason ──────────
    // A non-submitted onboarding link is only fillable while its document is in
    // the "sent" (finalized) state. Availability is DERIVED FROM THE PARENT
    // SESSION (authoritative, future-proof against any cancel path), and we
    // distinguish two outcomes for professional client-facing messaging:
    //   • "cancelled" — the owner cancelled/withdrew the document
    //   • "expired"   — the link passed its time limit (or was otherwise retired)
    // Submitted forms are exempt (they always show the thank-you screen).
    if (form.status !== "submitted") {
      let sessionStatus = ""
      if (form.session_id) {
        const { data: parentSession } = await admin
          .from("document_sessions")
          .select("status")
          .eq("id", form.session_id)
          .maybeSingle()
        sessionStatus = (parentSession?.status || "").toLowerCase()
      }
      const sessionLive = ["finalized", "signed"].includes(sessionStatus)
      const cancelledByOwner = !!form.session_id && !sessionLive
      const timeExpired = !!form.expires_at && new Date(form.expires_at) < new Date()

      if (cancelledByOwner || form.status === "expired" || timeExpired) {
        // Self-heal the form row so every surface stays consistent.
        if (form.status !== "expired") {
          await admin.from("onboarding_forms").update({ status: "expired" }).eq("id", form.id).then(() => {}, () => {})
        }
        // "cancelled" (owner withdrew) is more specific than a time expiry, so
        // it takes precedence when both could apply.
        const reason: "cancelled" | "expired" = cancelledByOwner ? "cancelled" : "expired"
        const error = reason === "cancelled"
          ? "This onboarding form has been cancelled by the sender and is no longer accepting responses."
          : "This onboarding form link has expired and is no longer accepting responses."
        return NextResponse.json({ error, reason }, { status: 410 })
      }
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

    // Post-submit only: build a client-safe preview payload so the "Thank
    // you" screen can show/download the completed document. Only exposed
    // once the form is submitted — never mid-fill, since the underlying
    // document_sessions.context may carry owner-side fields (design/theme,
    // fromAddress, etc.) that shouldn't be surfaced before the client is done.
    // Explicitly allowlisted (never a raw context spread) so no unrelated
    // owner data can leak through this public endpoint.
    let preview: Record<string, unknown> | null = null
    if (form.status === "submitted") {
      const { data: session } = await admin
        .from("document_sessions")
        .select("context")
        .eq("id", form.session_id)
        .single()
      const ctx = (session?.context ?? {}) as Record<string, unknown>
      preview = {
        documentType: "client_onboarding_form",
        referenceNumber: typeof ctx.referenceNumber === "string" ? ctx.referenceNumber : "",
        clientName: form.client_name || (typeof ctx.clientName === "string" ? ctx.clientName : ""),
        clientEmail: form.client_email || (typeof ctx.clientEmail === "string" ? ctx.clientEmail : ""),
        clientPhone: typeof ctx.clientPhone === "string" ? ctx.clientPhone : "",
        clientAddress: typeof ctx.clientAddress === "string" ? ctx.clientAddress : "",
        projectName: typeof ctx.projectName === "string" ? ctx.projectName : (form.title || ""),
        projectDescription: typeof ctx.projectDescription === "string" ? ctx.projectDescription : "",
        requirements: Array.isArray(ctx.requirements) ? ctx.requirements : [],
        timelinePreference: typeof ctx.timelinePreference === "string" ? ctx.timelinePreference : "",
        budgetRange: typeof ctx.budgetRange === "string" ? ctx.budgetRange : "",
        customQuestions: Array.isArray(ctx.customQuestions) ? ctx.customQuestions : [],
        fromName: typeof ctx.fromName === "string" ? ctx.fromName : ((business as any)?.name || ""),
        notes: "", // owner's free-text notes are never shown to the client
        clientFileLink: typeof ctx.clientFileLink === "string" ? ctx.clientFileLink : null,
        clientUploadedFileNames: Array.isArray(ctx.clientUploadedFileNames) ? ctx.clientUploadedFileNames : [],
        design: (ctx.design && typeof ctx.design === "object") ? ctx.design : undefined,
      }
    }

    // Client's own uploaded files (id + name only — actual bytes are fetched
    // on demand via GET /api/onboarding/upload, token-gated per file).
    const { data: clientFiles } = await admin
      .from("onboarding_files")
      .select("id, file_name, mime_type, file_size")
      .eq("form_id", form.id)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      form: {
        token: form.token,
        title: form.title,
        status: form.status === "pending" ? "in_progress" : form.status,
        allowUploads: form.allow_uploads,
        fields: form.fields,
        clientName: form.client_name,
        clientEmail: form.client_email,
        clientFiles: (clientFiles ?? []).map((f: any) => ({ id: f.id, fileName: f.file_name, mimeType: f.mime_type, fileSize: f.file_size })),
        preview,
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
