/**
 * Signatures API Route
 * Creates and retrieves document signature requests.
 *
 * SECURITY: Uses authenticateRequest() + backend rate limiting for all
 * authenticated operations. Public token lookup does not require auth.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, getClientIP, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { getPublicDocumentUrl, hashSigningToken, isSigningToken } from "@/lib/public-capability"
import { checkRateLimit } from "@/lib/rate-limiter"
import { checkEmailLimit, getUserTier, incrementEmailCount } from "@/lib/cost-protection"
import { getDocumentTypeConfig } from "@/lib/document-type-registry"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"
import { recordAuditEvent } from "@/lib/signature-audit"
import { getObject } from "@/lib/r2"
import { sendEmail } from "@/lib/mailtrap"
import { randomUUID } from "crypto"
import type { Database } from "@/lib/database.types"
import { getPublicLogoUrl } from "@/lib/public-logo"

// Generate a unique signing token (sign_ + 32 hex chars)
function generateSigningToken(): string {
    return `sign_${randomUUID().replace(/-/g, "")}`
}

// HTML-escape helper for email template
function h(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function esc(str: string): string {
    return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// Mirrors lib/email-template.ts BRAND tokens (app/globals.css warm off-white theme)
// so the signing invitation reads as the same product, not a separate template.
const SIGN_BRAND = {
    pageBg: "#FBF7F0",
    cardBg: "#ffffff",
    text: "#1a1714",
    textMuted: "#6b6156",
    textFaint: "#a39b8d",
    border: "#e8dfd0",
    chip: "#F3EADC",
    accent: "#b8622e",
    ink: "#1a1714",
    inkText: "#FBF7F0",
} as const
const SIGN_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/**
 * Build a signing invitation HTML email.
 * NOT using renderEmailTemplate (which is for document sharing).
 */
function buildSigningInvitationEmail(opts: {
    businessName: string
    businessLogoUrl?: string | null
    documentType: string
    referenceNumber: string
    signerName: string
    signingUrl: string
    expiresAt: string
    personalMessage?: string | null
}): string {
    const { businessName, businessLogoUrl, documentType, referenceNumber, signerName, signingUrl, expiresAt, personalMessage } = opts
    const B = SIGN_BRAND

    const isValidLogo = !!businessLogoUrl &&
        (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))

    const logoHtml = isValidLogo
        ? `<img src="${esc(businessLogoUrl!)}" width="36" height="36" alt="${h(businessName)}" style="display:block;border-radius:9px;object-fit:cover;width:36px;height:36px;" />`
        : ""

    const expiryFormatted = new Date(expiresAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    })

    // Either the owner's personal message OR the default greeting — never both,
    // to avoid a duplicated-looking body.
    const bodyMessageHtml = personalMessage
        ? `<tr><td class="mobile-pad" style="padding:0 32px 20px 32px;">
            <p style="margin:0;font-family:${SIGN_FONT};font-size:15px;color:${B.text};line-height:1.65;">
              ${h(personalMessage).replace(/\n/g, "<br/>")}
            </p>
          </td></tr>`
        : `<tr><td class="mobile-pad" style="padding:0 32px 20px 32px;">
            <p style="margin:0 0 6px 0;font-family:${SIGN_FONT};font-size:15px;font-weight:600;color:${B.text};">Hi ${h(signerName)},</p>
            <p style="margin:0;font-family:${SIGN_FONT};font-size:14.5px;color:${B.textMuted};line-height:1.65;">
              ${h(businessName)} is requesting your electronic signature on the document below.
            </p>
          </td></tr>`

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${h(businessName)} requests your signature</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;min-width:100%!important}
  @media only screen and (max-width:600px){
    .email-container{width:100%!important;max-width:100%!important;border-radius:0!important}
    .mobile-pad{padding-left:20px!important;padding-right:20px!important}
    .mobile-btn{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box;padding:15px 20px!important}
    .mobile-outer-pad{padding:0!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${B.pageBg};font-family:${SIGN_FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${B.pageBg};">
  <tr><td align="center" class="mobile-outer-pad" style="padding:32px 16px;">
    <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${B.cardBg};border-radius:20px;overflow:hidden;border:1px solid ${B.border};">

      <!-- Header -->
      <tr><td class="mobile-pad" style="padding:26px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${isValidLogo ? `<td style="vertical-align:middle;padding-right:12px;">${logoHtml}</td>` : ""}
          <td style="vertical-align:middle;"><span style="font-family:${SIGN_FONT};font-size:16px;font-weight:700;color:${B.text};letter-spacing:-0.01em;">${h(businessName)}</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background-color:${B.border};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

      <!-- Reference hero -->
      <tr><td class="mobile-pad" style="padding:28px 32px 4px 32px;">
        <p style="margin:0 0 4px 0;font-family:${SIGN_FONT};font-size:11px;font-weight:600;color:${B.textFaint};text-transform:uppercase;letter-spacing:0.08em;">${h(documentType)} · Signature requested</p>
        <p style="margin:0;font-family:${SIGN_FONT};font-size:26px;font-weight:800;color:${B.text};letter-spacing:-0.02em;line-height:1.2;">${h(referenceNumber)}</p>
      </td></tr>

      ${bodyMessageHtml}

      <!-- CTA -->
      <tr><td class="mobile-pad" style="padding:8px 32px 22px 32px;">
        <a href="${esc(signingUrl)}" target="_blank" class="mobile-btn"
          style="display:inline-block;padding:14px 30px;background-color:${B.accent};color:#ffffff;font-family:${SIGN_FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          Sign Document
        </a>
      </td></tr>

      <!-- Expiry + security notice -->
      <tr><td class="mobile-pad" style="padding:0 32px 26px 32px;">
        <p style="margin:0 0 10px 0;font-family:${SIGN_FONT};font-size:12.5px;color:${B.textMuted};">This signing link expires on <strong style="color:${B.text};">${h(expiryFormatted)}</strong>.</p>
        <p style="margin:0;font-family:${SIGN_FONT};font-size:12.5px;color:${B.accent};background-color:${B.chip};border:1px solid ${B.border};border-radius:10px;padding:11px 14px;">This link is unique to you. Do not share it.</p>
      </td></tr>

      <!-- Footer -->
      <tr><td class="mobile-pad" style="padding:18px 32px;background-color:${B.chip};border-top:1px solid ${B.border};">
        <p style="margin:0;font-family:${SIGN_FONT};font-size:12px;color:${B.textFaint};text-align:center;line-height:1.6;">
          Sent via <a href="https://clorefy.com" target="_blank" style="color:${B.accent};text-decoration:none;font-weight:600;">Clorefy</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

// Create a new signature request
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
        if (csrfError) return csrfError

        const rateLimitError = await checkRateLimit(auth.user.id, "signature", auth.supabase as any)
        if (rateLimitError) return rateLimitError

        const userTier = await getUserTier(auth.supabase, auth.user.id)
        const emailLimitError = await checkEmailLimit(auth.supabase, auth.user.id, userTier)
        if (emailLimitError) return emailLimitError

        let body: Record<string, unknown>
        try {
            const parsed: unknown = await request.json()
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
            }
            body = parsed as Record<string, unknown>
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
        }

        // SECURITY: Input size limit (10KB)
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : ""
        const signerEmail = typeof body.signerEmail === "string" ? body.signerEmail.trim() : ""
        const signerName = typeof body.signerName === "string" ? body.signerName.trim() : ""
        const party = body.party === undefined
            ? "Client"
            : typeof body.party === "string" ? body.party.trim() : ""
        const personalMessage = body.personalMessage === undefined || body.personalMessage === null
            ? undefined
            : typeof body.personalMessage === "string" ? body.personalMessage.trim() : null

        if (!sessionId || !signerEmail || !signerName || !party || personalMessage === null) {
            return NextResponse.json(
                { error: "Missing or invalid required fields: sessionId, signerEmail, signerName" },
                { status: 400 }
            )
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) {
            return NextResponse.json(
                { error: "Invalid signer email format" },
                { status: 400 }
            )
        }

        if (signerName.length > 200 || signerEmail.length > 254 || party.length > 100 || (personalMessage?.length ?? 0) > 2000) {
            return NextResponse.json(
                { error: "Input too long" },
                { status: 400 }
            )
        }

        const supabase = auth.supabase

        // Fetch document_sessions row and verify ownership
        const { data: session, error: sessionError } = await supabase
            .from("document_sessions")
            .select("*")
            .eq("id", sessionId)
            .single()

        if (sessionError || !session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 })
        }

        if (session.user_id !== auth.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const documentId = session.document_id ?? null
        // document_id is optional — sessions may not have one if the document
        // was never explicitly saved to the documents table. We allow signing
        // without a document_id and use session_id as the primary reference.

        const context = (session.context ?? {}) as Record<string, unknown>
        const documentConfig = getDocumentTypeConfig(session.document_type ?? "")
        if (!documentConfig?.capabilities.supports_signature) {
            return NextResponse.json(
                { error: "This document type does not support electronic signatures" },
                { status: 400 }
            )
        }
        if (
            documentConfig.capabilities.supports_client_response
            && context.showSignatureFields !== true
        ) {
            return NextResponse.json(
                { error: "Enable signature fields before sending this document for signature" },
                { status: 409 }
            )
        }

        // Sub-task 5.2: Compute document fingerprint
        const documentHash = computeDocumentFingerprint(context)

        // Generate signing token
        const signingToken = generateSigningToken()

        // expires_at = created_at + exactly 7 days (604800 seconds)
        const createdAt = new Date()
        const expiresAt = new Date(createdAt.getTime() + 604800 * 1000)

        // Sub-task 5.4: Fetch business info for email (before inserting — atomic: email must succeed first)
        const { data: business } = await supabase
            .from("businesses")
            .select("name, logo_url")
            .eq("user_id", session.user_id)
            .single()

        const businessName = business?.name ?? "Your Business"
        // Emails can't load a private R2 key — resolve through the public
        // logo endpoint so the logo renders in Gmail/Outlook/Apple Mail.
        const businessLogoUrl = getPublicLogoUrl(session.user_id, business?.logo_url ?? null)

        // Build document type label and reference number
        const docTypeLabel = session.document_type
            ? session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
            : "Document"
        const ctx = context as Record<string, unknown>
        // For non-invoice documents, prefer referenceNumber over invoiceNumber
        // to avoid showing INV- prefix on contracts/quotations/proposals
        const referenceNumber = session.document_type === "invoice"
            ? ((ctx.invoiceNumber as string) || (ctx.referenceNumber as string) || "")
            : ((ctx.referenceNumber as string) || (ctx.invoiceNumber as string) || "")

        // Build signing URL
        const signingUrl = `https://clorefy.com/sign/${signingToken}`

        // Persist the hash and finalize the parent session in one transaction.
        // This guarantees an email is never sent for a request whose session
        // transition failed, while the raw capability is never stored.
        const signatureId = randomUUID()
        const tokenHash = await hashSigningToken(signingToken)
        const verificationUrl = `https://clorefy.com/verify/${signatureId}`
        const clientName = (ctx.toName as string) || signerName || null
        const serviceSupabase = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        )
        const recipientRateError = await checkPublicRateLimit(
            serviceSupabase,
            `${auth.user.id}:${signerEmail.toLowerCase()}`,
            "signature_invitation_recipient",
            5,
            86400
        )
        if (recipientRateError) return recipientRateError

        const { data: creationData, error: creationError } = await serviceSupabase.rpc(
            "create_signature_request",
            {
                p_signature_id: signatureId,
                p_user_id: auth.user.id,
                p_session_id: sessionId,
                p_document_id: documentId,
                p_signer_email: signerEmail,
                p_signer_name: signerName,
                p_party: party,
                p_token_hash: tokenHash,
                p_created_at: createdAt.toISOString(),
                p_expires_at: expiresAt.toISOString(),
                p_document_hash: documentHash,
                p_verification_url: verificationUrl,
                p_client_name: clientName,
            }
        )
        const creation = Array.isArray(creationData) ? creationData[0] : creationData

        if (creationError) {
            console.error("[signatures] Atomic request creation error:", creationError)
            return NextResponse.json({ error: "Failed to create signature request" }, { status: 500 })
        }
        if (!creation || creation.outcome !== "created" || creation.signature_id !== signatureId) {
            const status = creation?.outcome === "not_found" ? 404 : 409
            return NextResponse.json(
                { error: status === 404 ? "Session not found" : "This document cannot be sent for signature in its current state" },
                { status }
            )
        }

        const emailSubject = `${businessName} requests your signature on ${docTypeLabel} ${referenceNumber}`.trim()
        const emailHtml = buildSigningInvitationEmail({
            businessName,
            businessLogoUrl,
            documentType: docTypeLabel,
            referenceNumber,
            signerName,
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            personalMessage,
        })

        let emailSent = false
        try {
            const emailResult = await sendEmail({
                to: signerEmail,
                subject: emailSubject,
                html: emailHtml,
                senderName: businessName,
                category: "signature_invitation",
            })
            emailSent = emailResult.success === true
            if (!emailResult.success) console.error("[signatures] Email send failed:", emailResult)
        } catch (emailErr) {
            console.error("[signatures] Email exception:", emailErr)
        }

        if (!emailSent) {
            const { data: rolledBack, error: cleanupError } = await serviceSupabase.rpc(
                "rollback_unsent_signature_request",
                {
                    p_signature_id: signatureId,
                    p_token_hash: tokenHash,
                    p_transitioned_at: createdAt.toISOString(),
                    p_previous_status: creation.previous_status,
                    p_previous_sent_at: creation.previous_sent_at,
                    p_previous_client_name: creation.previous_client_name,
                    p_previous_signature_cohort_id: creation.previous_signature_cohort_id,
                }
            )
            if (cleanupError || rolledBack !== true) {
                console.error("[signatures] Failed to roll back unsent request:", cleanupError ?? "request changed concurrently")
            }
            return NextResponse.json(
                { error: "Failed to send the signing invitation email. The signature request was not created — please try again." },
                { status: 500 }
            )
        }

        await incrementEmailCount(auth.supabase, auth.user.id)

        const ipAddress = getClientIP(request)
        await recordAuditEvent(serviceSupabase, {
            action: "signature.request_created",
            signature_id: signatureId,
            document_id: documentId ?? undefined,
            session_id: sessionId,
            actor_email: signerEmail,
            ip_address: ipAddress,
            metadata: { signer_name: signerName, party, document_hash: documentHash },
        })

        return NextResponse.json({
            success: true,
            signature: {
                id: signatureId,
                signer_email: signerEmail,
                signer_name: signerName,
                party,
                expires_at: expiresAt.toISOString(),
                verification_url: verificationUrl,
            },
            signingUrl,
            expiresAt: expiresAt.toISOString(),
            emailSent: true,
        })
    } catch (error) {
        console.error("Signature request error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// Get signature status
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const documentId = searchParams.get("documentId")
        const token = searchParams.get("token")

        if (token) {
            if (!isSigningToken(token)) {
                return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
            }

            const serviceSupabase = createClient<Database>(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            )
            const ipAddress = getClientIP(request)
            const tokenHash = await hashSigningToken(token)

            const ipRateError = await checkPublicRateLimit(serviceSupabase, ipAddress, "signature_view_ip", 60, 60)
            if (ipRateError) return ipRateError
            const tokenRateError = await checkPublicRateLimit(serviceSupabase, tokenHash, "signature_view_token", 30, 300)
            if (tokenRateError) return tokenRateError

            const { data: signature, error } = await serviceSupabase
                .from("signatures")
                .select("id, signer_name, signer_email, party, signed_at, signer_action, expires_at, verification_url, signature_image_url, session_id, document_id, documents(type, data, status)")
                .eq("token_hash", tokenHash)
                .single()

            if (error || !signature) {
                return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
            }

            const userAgent = request.headers.get("user-agent") ?? undefined

            // Bug 2 fix: Check if the parent document session has been cancelled.
            // The signer_action may still be null if the session was cancelled without
            // atomically updating signature rows — so we must check the session status too.
            //
            // Two cancellation paths invalidate a signing link:
            //   1. Owner clicks "Cancel" on document preview → status = "cancelled"
            //   2. Owner clicks "Unlock" in chat → status returns to "active"
            //      with sent_at still set (the document is being edited again).
            // Both must return 410 Gone so the recipient can never sign a stale
            // version of the document. This matches DocuSign / Adobe Sign behaviour
            // where unlocking a sent envelope voids all outstanding signing links.
            const sigSessionId = (signature as any).session_id
            if (sigSessionId) {
                const { data: parentSession } = await serviceSupabase
                    .from("document_sessions")
                    .select("status, sent_at")
                    .eq("id", sigSessionId)
                    .single()
                if (parentSession?.status === "cancelled") {
                    return NextResponse.json(
                        { error: "This document has been cancelled by the owner.", cancelled: true },
                        { status: 410 }
                    )
                }
                // Owner-unlocked: status reverted to "active" but sent_at is still set.
                if (parentSession?.status === "active" && parentSession?.sent_at) {
                    return NextResponse.json(
                        { error: "This document is no longer available. The owner has cancelled the share.", cancelled: true },
                        { status: 410 }
                    )
                }
            }

            // Check if signing request was cancelled by the document owner
            if ((signature as any).signer_action === "cancelled") {
                return NextResponse.json(
                    { error: "This signing request has been cancelled by the document owner.", cancelled: true },
                    { status: 410 }
                )
            }

            // Check expiry — Sub-task 6.3
            if (signature.expires_at && new Date(signature.expires_at) < new Date()) {
                // Fetch session to get owner user_id and document info for notification
                const sessionId = (signature as any).session_id
                if (sessionId) {
                    const { data: session } = await serviceSupabase
                        .from("document_sessions")
                        .select("user_id, document_type, context")
                        .eq("id", sessionId)
                        .single()

                    if (session) {
                        const signerName = signature.signer_name ?? "Signer"
                        const docType = session.document_type
                            ? session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
                            : "Document"
                        const ctx = (session.context ?? {}) as Record<string, unknown>
                        const referenceNumber =
                            (ctx.invoiceNumber as string) ||
                            (ctx.referenceNumber as string) ||
                            ""

                        // Record signature.expired audit event
                        await recordAuditEvent(serviceSupabase, {
                            action: "signature.expired",
                            signature_id: signature.id,
                            session_id: sessionId,
                            ip_address: ipAddress,
                            user_agent: userAgent,
                            metadata: { attempted_at: new Date().toISOString() },
                        })

                        // Create signature_expired notification for owner
                        await serviceSupabase.from("notifications" as any).insert({
                            user_id: session.user_id,
                            type: "signature_expired",
                            title: "Signing Link Expired",
                            message: `The signing link for ${signerName} on ${docType} ${referenceNumber}`.trim() + " has expired.",
                            read: false,
                            metadata: {
                                session_id: sessionId,
                                signature_id: signature.id,
                                signer_name: signerName,
                                document_type: session.document_type,
                                reference_number: referenceNumber,
                            },
                        })
                    }
                }

                return NextResponse.json({ error: "Signing link has expired" }, { status: 410 })
            }

            // Sub-task 6.1 + 6.2: Fetch session once for audit event, notification, and business info
            const sessionId = (signature as any).session_id
            let business: { name: string; logo_url: string | null } | null = null
            let sessionData: {
                auto_invoice_on_sign: boolean | null
                context?: unknown
                document_type?: string | null
                public_id: string
            } | null = null

            if (sessionId) {
                const { data: session } = await serviceSupabase
                    .from("document_sessions")
                    .select("user_id, document_type, context, auto_invoice_on_sign, public_id")
                    .eq("id", sessionId)
                    .single()

                if (session) {
                    sessionData = session
                    // Sub-task 6.2: Fetch business info for the signing page
                    const { data: biz } = await serviceSupabase
                        .from("businesses")
                        .select("name, logo_url")
                        .eq("user_id", session.user_id)
                        .single()

                    if (biz) {
                        // /sign/[token] is a public page with no auth — resolve
                        // the stored R2 key to the public logo endpoint so the
                        // logo actually renders (mirrors the email fix above).
                        business = { name: biz.name, logo_url: getPublicLogoUrl(session.user_id, biz.logo_url) }
                    }

                    // Record audit and notify the owner atomically. The partial
                    // unique index makes concurrent first views idempotent.
                    const { error: firstViewError } = await (serviceSupabase.rpc as any)(
                        "record_signature_first_view",
                        {
                            p_signature_id: signature.id,
                            p_ip_address: ipAddress,
                            p_user_agent: userAgent ?? "unknown",
                            p_viewed_at: new Date().toISOString(),
                        }
                    )
                    if (firstViewError) {
                        console.error("[signatures] Failed to record first view:", firstViewError)
                    }
                }
            }

            const sessionContext = sessionData?.context ?? null
            const documentType = sessionData?.document_type ?? null

            // Load signature image for already-signed signatures (so signer can see their signature)
            let signatureImageDataUrl: string | null = null
            if (signature.signed_at && (signature as any).signature_image_url && (signature as any).signature_image_url !== "data_url_fallback") {
                try {
                    const imgKey = (signature as any).signature_image_url as string
                    if (imgKey.startsWith("sb:")) {
                        // Supabase Storage
                        const storagePath = imgKey.slice(3)
                        const bucket = storagePath.startsWith("signatures/") ? "signatures" : "business-assets"
                        const { data: blob } = await serviceSupabase.storage.from(bucket).download(storagePath)
                        if (blob) {
                            const buf = await blob.arrayBuffer()
                            const base64 = Buffer.from(buf).toString("base64")
                            const mime = blob.type || "image/jpeg"
                            signatureImageDataUrl = `data:${mime};base64,${base64}`
                        }
                    } else {
                        // R2
                        const imgResult = await getObject(imgKey)
                        if (imgResult) {
                            const base64 = Buffer.from(imgResult.body).toString("base64")
                            const mime = imgResult.contentType !== "application/octet-stream" ? imgResult.contentType : "image/png"
                            signatureImageDataUrl = `data:${mime};base64,${base64}`
                        }
                    }
                } catch { /* ignore image load failures */ }
            }

            if (!sessionData) {
                return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
            }

            const document = signature.documents as {
                type: string
                data: Database["public"]["Tables"]["documents"]["Row"]["data"]
                status: string | null
            } | null
            const publicSignature = {
                id: signature.id,
                signer_name: signature.signer_name,
                signer_email: signature.signer_email,
                party: signature.party,
                signed_at: signature.signed_at,
                signer_action: signature.signer_action,
                expires_at: signature.expires_at,
                verification_url: signature.verification_url,
                documents: document ? {
                    type: document.type,
                    data: document.data,
                    status: document.status,
                } : null,
            }

            return NextResponse.json({
                signature: publicSignature,
                business,
                autoInvoiceOnSign: !!sessionData.auto_invoice_on_sign,
                sessionContext,
                documentType,
                publicDocumentUrl: getPublicDocumentUrl(sessionData.public_id, "view"),
                signatureImageDataUrl,
            })
        }

        if (documentId) {
            // Authenticated lookup by document
            const auth = await authenticateRequest(request)
            if (auth.error) return auth.error

            // SECURITY: Rate limit authenticated lookups
            const rateLimitError = await checkRateLimit(auth.user.id, "general")
            if (rateLimitError) return rateLimitError

            const { data: signatures, error } = await auth.supabase
                .from("signatures")
                .select("*")
                .eq("document_id", documentId)
                .order("created_at", { ascending: false })

            if (error) {
                return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 })
            }

            return NextResponse.json({ signatures })
        }

        // sessionId lookup — authenticated, for document preview toolbar
        const sessionId = searchParams.get("sessionId")
        if (sessionId) {
            const auth = await authenticateRequest(request)
            if (auth.error) return auth.error

            const rateLimitError = await checkRateLimit(auth.user.id, "general")
            if (rateLimitError) return rateLimitError

            const { data: signatures, error } = await auth.supabase
                .from("signatures")
                .select("id, signer_name, signer_email, party, signed_at, signer_action, signer_reason, created_at, ip_address, verification_url, signature_image_url, user_agent, document_hash")
                .eq("session_id", sessionId)
                .order("created_at", { ascending: false })

            if (error) {
                return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 })
            }

            // Also report whether user has a saved signature — the UI uses this
            // to skip redraws when the user already has one.
            //
            // There are two independent "saved signature" sources:
            //   1. `profiles.saved_signature_url` — set/updated any time via the
            //      Profile page's signature pad (the one users actually expect
            //      "my signature" to mean).
            //   2. `businesses.signature_url` — set once during onboarding and
            //      never touched again afterwards.
            // Check the profile signature FIRST so a signature drawn/updated on
            // the Profile page is picked up immediately; fall back to the
            // onboarding-time business signature for older accounts that never
            // visited the Profile page's signature section.
            const [{ data: profileSig }, { data: bizSig }] = await Promise.all([
                auth.supabase
                    .from("profiles")
                    .select("saved_signature_url")
                    .eq("id", auth.user.id)
                    .maybeSingle() as unknown as Promise<{ data: { saved_signature_url: string | null } | null }>,
                auth.supabase
                    .from("businesses")
                    .select("signature_url")
                    .eq("user_id", auth.user.id)
                    .maybeSingle() as unknown as Promise<{ data: { signature_url: string | null } | null }>,
            ])

            const hasSavedSignature = !!(
                (profileSig?.saved_signature_url && String(profileSig.saved_signature_url).trim().length > 0) ||
                (bizSig?.signature_url && String(bizSig.signature_url).trim().length > 0)
            )

            return NextResponse.json({ signatures, hasSavedSignature })
        }

        return NextResponse.json({ error: "Missing documentId or token parameter" }, { status: 400 })
    } catch (error) {
        console.error("Signature fetch error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
