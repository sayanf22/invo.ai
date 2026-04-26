/**
 * Signatures API Route
 * Creates and retrieves document signature requests.
 *
 * SECURITY: Uses authenticateRequest() + backend rate limiting for all
 * authenticated operations. Public token lookup does not require auth.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, getClientIP } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"
import { recordAuditEvent } from "@/lib/signature-audit"
import { sendEmail } from "@/lib/mailtrap"
import { randomUUID } from "crypto"
import type { Database } from "@/lib/database.types"

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

    const isValidLogo = businessLogoUrl &&
        (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))

    const logoHtml = isValidLogo
        ? `<img src="${esc(businessLogoUrl!)}" alt="" width="40" height="40" style="display:block;border-radius:8px;object-fit:cover;" />`
        : ""

    const expiryFormatted = new Date(expiresAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
    })

    const personalMessageHtml = personalMessage
        ? `<tr><td style="padding:0 28px 20px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#3f3f46;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                ${h(personalMessage).replace(/\n/g, "<br/>")}
              </td></tr>
            </table>
          </td></tr>`
        : ""

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${h(businessName)} requests your signature</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
  <tr><td align="center" style="padding:24px 8px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr><td style="padding:24px 28px 20px 28px;border-bottom:1px solid #f0f0f0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${isValidLogo ? `<td style="vertical-align:middle;padding-right:14px;">${logoHtml}</td>` : ""}
            <td style="vertical-align:middle;">
              <span style="font-size:18px;font-weight:700;color:#18181b;">${h(businessName)}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:16px;font-weight:600;color:#18181b;">Hi ${h(signerName)},</p>
        <p style="margin:0 0 24px 0;font-size:15px;color:#52525b;line-height:1.6;">
          ${h(businessName)} is requesting your electronic signature on the following document.
        </p>

        <!-- Document card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;">${h(documentType)}</p>
            <p style="margin:0 0 0 0;font-size:22px;font-weight:800;color:#18181b;letter-spacing:-0.02em;">${h(referenceNumber)}</p>
          </td></tr>
        </table>
      </td></tr>

      ${personalMessageHtml}

      <!-- CTA -->
      <tr><td style="padding:0 28px 24px 28px;">
        <a href="${esc(signingUrl)}" target="_blank"
          style="display:inline-block;padding:13px 28px;background-color:#18181b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
          Sign Document
        </a>
      </td></tr>

      <!-- Expiry + security notice -->
      <tr><td style="padding:0 28px 24px 28px;">
        <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">
          This signing link expires on <strong>${h(expiryFormatted)}</strong>.
        </p>
        <p style="margin:0;font-size:13px;color:#71717a;background-color:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:10px 14px;">
          ⚠️ This signing link is unique to you. Do not share it.
        </p>
      </td></tr>

      <!-- Plain-text fallback -->
      <tr><td style="padding:0 28px 24px 28px;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">
          If the button above doesn't work, copy and paste this URL into your browser:<br/>
          <a href="${esc(signingUrl)}" style="color:#6366f1;word-break:break-all;">${h(signingUrl)}</a>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
          Sent via <a href="https://clorefy.com" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">Clorefy</a>
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
    try {
        // SECURITY: Authenticate user via standard helper
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Rate limit — signatures are intentional actions, use general (60/min)
        // The email sending itself acts as a natural throttle
        const rateLimitError = await checkRateLimit(auth.user.id, "general")
        if (rateLimitError) return rateLimitError

        const body = await request.json()

        // SECURITY: Input size limit (10KB)
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        // Sub-task 5.1: Accept sessionId (replacing documentId)
        const { sessionId, signerEmail, signerName, party = "Client", personalMessage } = body

        if (!sessionId || !signerEmail || !signerName) {
            return NextResponse.json(
                { error: "Missing required fields: sessionId, signerEmail, signerName" },
                { status: 400 }
            )
        }

        // SECURITY: Validate email format
        if (typeof signerEmail !== "string" || !signerEmail.includes("@") || !signerEmail.includes(".")) {
            return NextResponse.json(
                { error: "Invalid signer email format" },
                { status: 400 }
            )
        }

        // SECURITY: Validate string lengths to prevent abuse
        if (signerName.length > 200 || signerEmail.length > 254) {
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

        // Sub-task 5.2: Compute document fingerprint
        const context = (session.context ?? {}) as Record<string, unknown>
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
        const businessLogoUrl = business?.logo_url ?? null

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

        // Sub-task 5.4: Send signing invitation email BEFORE persisting the record (atomic)
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

        const emailResult = await sendEmail({
            to: signerEmail,
            subject: emailSubject,
            html: emailHtml,
            senderName: businessName,
            category: "signature_invitation",
        })

        // ATOMIC: If email fails, do NOT persist the signature record
        if (!emailResult.success) {
            console.error("[signatures] Email send failed:", emailResult)
            // Provide a user-friendly error message
            const isRateLimit = emailResult.statusCode === 429
            const userMessage = isRateLimit
                ? "Email sending limit reached. Please wait a moment and try again."
                : "Failed to send signing invitation email. Please check the email address and try again."
            return NextResponse.json(
                { error: userMessage },
                { status: isRateLimit ? 429 : 500 }
            )
        }

        // Insert signature record (after email succeeds)
        const { data: signature, error: sigError } = await supabase
            .from("signatures")
            .insert({
                document_id: documentId,
                signer_email: signerEmail,
                signer_name: signerName,
                party: party,
                token: signingToken,
                created_at: createdAt.toISOString(),
                expires_at: expiresAt.toISOString(),
                document_hash: documentHash,
                session_id: sessionId,
            } as any)
            .select()
            .single()

        if (sigError || !signature) {
            console.error("[signatures] Signature creation error:", sigError)
            return NextResponse.json({ error: "Failed to create signature request" }, { status: 500 })
        }

        // Set verification_url now that we have the signature id
        const verificationUrl = `https://clorefy.com/verify/${signature.id}`
        await supabase
            .from("signatures")
            .update({ verification_url: verificationUrl } as any)
            .eq("id", signature.id)

        // Sub-task 5.3: Record audit event using service-role client
        const serviceSupabase = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const ipAddress = getClientIP(request)
        await recordAuditEvent(serviceSupabase, {
            action: "signature.request_created",
            signature_id: signature.id,
            document_id: documentId,
            session_id: sessionId,
            actor_email: signerEmail,
            ip_address: ipAddress,
            metadata: {
                signer_name: signerName,
                party,
                document_hash: documentHash,
            },
        })

        return NextResponse.json({
            success: true,
            signature: { ...signature, verification_url: verificationUrl },
            signingUrl,
            expiresAt: expiresAt.toISOString(),
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
            // Public lookup by token — no auth required (signing flow)
            // SECURITY: Use service-role client for public token lookups
            const serviceSupabase = createClient<Database>(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            const { data: signature, error } = await serviceSupabase
                .from("signatures")
                .select("*, documents(id, type, data, status)")
                .eq("token", token)
                .single()

            if (error || !signature) {
                return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
            }

            const ipAddress = getClientIP(request)
            const userAgent = request.headers.get("user-agent") ?? undefined

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
            let sessionData: { auto_invoice_on_sign: boolean | null } | null = null

            if (sessionId) {
                const { data: session } = await serviceSupabase
                    .from("document_sessions")
                    .select("user_id, document_type, context, auto_invoice_on_sign")
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
                        business = { name: biz.name, logo_url: biz.logo_url }
                    }

                    // Sub-task 6.1: Record signature.viewed audit event (first view only)
                    const { data: existingViewed } = await serviceSupabase
                        .from("signature_audit_events" as any)
                        .select("id")
                        .eq("signature_id", signature.id)
                        .eq("action", "signature.viewed")
                        .limit(1)

                    const alreadyViewed = existingViewed && (existingViewed as any[]).length > 0

                    if (!alreadyViewed) {
                        const signerName = signature.signer_name ?? "Signer"
                        const docType = session.document_type
                            ? session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
                            : "Document"

                        // Record audit event
                        await recordAuditEvent(serviceSupabase, {
                            action: "signature.viewed",
                            signature_id: signature.id,
                            session_id: sessionId,
                            actor_email: signature.signer_email,
                            ip_address: ipAddress,
                            user_agent: userAgent,
                            metadata: { viewed_at: new Date().toISOString() },
                        })

                        // Insert signature_viewed notification for document owner
                        await serviceSupabase.from("notifications" as any).insert({
                            user_id: session.user_id,
                            type: "signature_viewed",
                            title: "Document Viewed",
                            message: `${signerName} viewed your ${docType} for signing.`,
                            read: false,
                            metadata: {
                                session_id: sessionId,
                                signature_id: signature.id,
                                signer_name: signerName,
                                document_type: session.document_type,
                            },
                        })
                    }
                }
            }

            return NextResponse.json({ signature, business, autoInvoiceOnSign: !!sessionData?.auto_invoice_on_sign })
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
                .select("id, signer_name, signer_email, party, signed_at, signer_action, signer_reason, created_at")
                .eq("session_id", sessionId)
                .order("created_at", { ascending: false })

            if (error) {
                return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 })
            }

            return NextResponse.json({ signatures })
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
