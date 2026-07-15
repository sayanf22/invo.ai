/**
 * Signature Submission API Route
 *
 * POST /api/signatures/sign
 *
 * Public endpoint (token-based access for external signers).
 * Uses service-role Supabase client for all DB operations.
 *
 * Flow:
 * 1. Validate token format (regex) — return 400 on mismatch
 * 2. Increment attempt_count; if >= 6, record abuse_detected and return 410
 * 3. Validate token exists, not expired, not already signed
 * 4. Re-compute document fingerprint; reject on mismatch (tamper_detected, 409)
 * 5. Upload signature image to R2 (fallback to data URL)
 * 6. Update signature record
 * 7. Record signature.signed audit event
 * 8. Check if all signers have signed; if so, trigger completion pipeline
 * 9. Return success with verificationUrl
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP, sanitizeError, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { getPublicDocumentUrl, hashSigningToken, isSigningToken } from "@/lib/public-capability"
import { recordAuditEvent } from "@/lib/signature-audit"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"
import { generateAndStoreCertificate } from "@/lib/certificate-generator"
import { sendEmail } from "@/lib/mailtrap"
import { getPublicLogoUrl } from "@/lib/public-logo"
import type { Database } from "@/lib/database.types"

const MAX_BODY_SIZE = 500 * 1024

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase service role credentials")
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ── Auto-invoice trigger ──────────────────────────────────────────────────────
// Called when a contract is fully signed and auto_invoice_on_sign = true.
// Creates a linked invoice session and sends it to the client.

async function triggerAutoInvoice({
  supabase: supabaseParam,
  contractSession,
  contractSessionId,
  signerEmail,
  signerName,
  businessName,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  contractSession: Record<string, any>
  contractSessionId: string
  signerEmail: string
  signerName: string
  businessName: string
}) {
  // supabase is typed as any to avoid schema mismatch issues with untyped tables
  const supabase = supabaseParam
  const recipientEmail = contractSession.invoice_recipient_email || signerEmail
  if (!recipientEmail) {
    console.warn("[auto-invoice] No recipient email — skipping")
    return
  }

  const parentContext = (contractSession.context ?? {}) as Record<string, any>

  // Build invoice context from contract context
  const now = new Date()
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + 30) // Net 30 default

  const invoiceContext: Record<string, any> = {
    documentType: "Invoice",
    fromName: parentContext.fromName,
    fromEmail: parentContext.fromEmail,
    fromAddress: parentContext.fromAddress,
    toName: parentContext.toName || signerName,
    toEmail: recipientEmail,
    toAddress: parentContext.toAddress,
    currency: parentContext.currency || "USD",
    invoiceDate: now.toISOString().slice(0, 10),
    issueDate: now.toISOString().slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    paymentTerms: parentContext.paymentTerms || "Net 30",
    // Copy items/services from contract if present
    items: Array.isArray(parentContext.items) ? parentContext.items.map((item: any, i: number) => ({
      id: `auto-inv-${Date.now()}-${i}`,
      description: item.description || "",
      quantity: Number(item.quantity) || 1,
      rate: Number(item.rate) || 0,
    })) : [],
    // Auto-generate invoice number
    invoiceNumber: `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-AUTO`,
    design: parentContext.design,
    notes: `Auto-generated from signed contract. ${parentContext.referenceNumber ? `Contract ref: ${parentContext.referenceNumber}` : ""}`.trim(),
  }

  // Determine chain_id
  const chainId = contractSession.chain_id || contractSessionId

  // Ensure contract session has chain_id
  if (!contractSession.chain_id) {
    await supabase
      .from("document_sessions")
      .update({ chain_id: chainId })
      .eq("id", contractSessionId)
  }

  // Create linked invoice session
  const { data: invoiceSession, error: createError } = await supabase
    .from("document_sessions")
    .insert({
      user_id: contractSession.user_id,
      document_type: "invoice",
      status: "active",
      context: invoiceContext,
      chain_id: chainId,
      client_name: contractSession.client_name || signerName,
    })
    .select("id, public_id")
    .single()

  if (createError || !invoiceSession) {
    throw new Error(`Failed to create auto-invoice session: ${createError?.message}`)
  }

  const { data: quota, error: quotaError } = await (supabase as any).rpc("reserve_document_quota", {
    p_user_id: contractSession.user_id,
    p_session_id: invoiceSession.id,
    p_month: now.toISOString().slice(0, 7),
  })
  if (quotaError || !quota?.allowed) {
    await supabase.from("document_sessions").delete().eq("id", invoiceSession.id)
    throw new Error(quotaError?.message || "Monthly document limit reached")
  }

  // Create document link
  await supabase
    .from("document_links")
    .insert({
      parent_session_id: contractSessionId,
      child_session_id: invoiceSession.id,
      relationship: "auto_invoice",
    })

  // Quota was reserved atomically before linking and sending.

  // Send the invoice email via the send-document endpoint (internal call)
  // We call the Mailtrap API directly to avoid auth complexity in server-to-server
  const { renderEmailTemplate } = await import("@/lib/email-template")
  const { sendEmail } = await import("@/lib/mailtrap")

  // Fetch business logo
  const { data: business } = await supabase
    .from("businesses")
    .select("name, logo_url")
    .eq("user_id", contractSession.user_id)
    .single()

  const bName = business?.name || businessName
  // Emails can't load a private R2 key — resolve through the public logo
  // endpoint so the logo renders in Gmail/Outlook/Apple Mail.
  const bLogo = getPublicLogoUrl(contractSession.user_id, business?.logo_url || null)

  const html = renderEmailTemplate({
    businessName: bName,
    businessLogoUrl: bLogo,
    documentType: "invoice",
    referenceNumber: invoiceContext.invoiceNumber,
    recipientName: invoiceContext.toName || signerName,
    totalAmount: null,
    currency: invoiceContext.currency,
    dueDate: invoiceContext.dueDate,
    description: invoiceContext.notes,
    personalMessage: `Your contract has been signed. Please find your invoice attached.`,
    viewDocumentUrl: getPublicDocumentUrl(invoiceSession.public_id, "view"),
    payNowUrl: null,
  })

  const emailResult = await sendEmail({
    to: recipientEmail,
    subject: `Invoice ${invoiceContext.invoiceNumber} from ${bName}`,
    html,
    senderName: bName,
    category: "invoice",
  })

  if (!emailResult.success) {
    console.error("[auto-invoice] Email send failed:", emailResult)
    // Non-fatal — invoice session was created, email failed
  } else {
    // Record the email send
    await (supabase as any)
      .from("document_emails")
      .insert({
        user_id: contractSession.user_id,
        session_id: invoiceSession.id,
        recipient_email: recipientEmail,
        document_type: "invoice",
        status: "sent",
        subject: `Invoice ${invoiceContext.invoiceNumber} from ${bName}`,
      })
      .catch(() => {})

    // Finalize the invoice session
    await supabase
      .from("document_sessions")
      .update({
        status: "finalized",
        sent_at: now.toISOString(),
        client_name: invoiceContext.toName || signerName,
      } as any)
      .eq("id", invoiceSession.id)
  }

  // Notify the owner
  await (supabase as any)
    .from("notifications")
    .insert({
      user_id: contractSession.user_id,
      type: "auto_invoice_sent",
      title: "Invoice Auto-Sent",
      message: `Invoice ${invoiceContext.invoiceNumber} was automatically sent to ${recipientEmail} after contract signing.`,
      read: false,
      metadata: {
        contract_session_id: contractSessionId,
        invoice_session_id: invoiceSession.id,
        invoice_number: invoiceContext.invoiceNumber,
        recipient_email: recipientEmail,
      },
    })
    .catch(() => {})
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  try {
    let body: { token?: string; signatureDataUrl?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, MAX_BODY_SIZE)
    if (sizeError) return sizeError

    const { token, signatureDataUrl } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing or invalid signing token" }, { status: 400 })
    }

    if (!signatureDataUrl || typeof signatureDataUrl !== "string") {
      return NextResponse.json({ error: "Missing or invalid signature data" }, { status: 400 })
    }

    if (!isSigningToken(token) || !token.startsWith("sign_")) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
    }

    // Validate signature image format — accept PNG and JPEG
    if (
      !signatureDataUrl.startsWith("data:image/png") &&
      !signatureDataUrl.startsWith("data:image/jpeg")
    ) {
      return NextResponse.json(
        { error: "Invalid signature image format. Must be data:image/png or data:image/jpeg." },
        { status: 400 }
      )
    }

    // Validate decoded image size — max 100KB (compact JPEG signatures are 3–15KB)
    const commaIndex = signatureDataUrl.indexOf(",")
    if (commaIndex === -1) {
      return NextResponse.json({ error: "Invalid signature data URL format" }, { status: 400 })
    }
    const base64Part = signatureDataUrl.substring(commaIndex + 1)
    const padding = (base64Part.match(/=+$/) || [""])[0].length
    const decodedSize = Math.floor((base64Part.length * 3) / 4) - padding
    const MAX_SIG_SIZE = 100 * 1024 // 100KB — generous limit for compact JPEG
    if (decodedSize > MAX_SIG_SIZE) {
      return NextResponse.json(
        { error: "Signature image too large. Please clear and redraw your signature." },
        { status: 413 }
      )
    }

    // Detect content type from data URL prefix
    const contentType = signatureDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png"
    const fileExt = contentType === "image/jpeg" ? "jpg" : "png"

    const supabase = getServiceRoleClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const tokenHash = await hashSigningToken(token)

    const ipRateError = await checkPublicRateLimit(supabase, clientIP, "signature_sign_ip", 20, 3600)
    if (ipRateError) return ipRateError
    const tokenRateError = await checkPublicRateLimit(supabase, tokenHash, "signature_sign_token", 8, 3600)
    if (tokenRateError) return tokenRateError

    const { data: claimData, error: claimError } = await supabase.rpc("claim_signature_attempt", {
      p_token_hash: tokenHash,
    })
    const claimed = Array.isArray(claimData) ? claimData[0] : claimData
    if (claimError) {
      console.error("[sign] claim_signature_attempt error:", claimError)
      return NextResponse.json({ error: "Signing is temporarily unavailable" }, { status: 503 })
    }
    if (!claimed) {
      return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
    }

    const signature = {
      id: claimed.signature_id,
      attempt_count: claimed.attempt_count,
      signed_at: claimed.signed_at,
      signer_action: claimed.signer_action,
      expires_at: claimed.expires_at,
      document_hash: claimed.document_hash,
      session_id: claimed.session_id,
      verification_url: claimed.verification_url,
      document_id: claimed.document_id,
      parent_status: claimed.parent_status,
      parent_sent_at: claimed.parent_sent_at,
      parent_public_id: claimed.parent_public_id,
    }

    // Check abuse: attempt_count >= 6 → record audit event and return 410
    if (signature.attempt_count >= 6) {
      await recordAuditEvent(supabase, {
        action: "signature.abuse_detected",
        signature_id: signature.id,
        document_id: signature.document_id ?? undefined,
        session_id: signature.session_id ?? undefined,
        ip_address: clientIP,
        user_agent: userAgent,
        metadata: { attempt_count: signature.attempt_count },
      })
      return NextResponse.json(
        { error: "Signing link has been invalidated due to too many attempts" },
        { status: 410 }
      )
    }

    if (signature.parent_status === "cancelled" ||
        (signature.parent_status === "active" && signature.parent_sent_at)) {
      return NextResponse.json({ error: "This signing link is no longer active" }, { status: 410 })
    }

    // Check if already signed or invalidated by the sender/recipient.
    if (signature.signed_at) {
      return NextResponse.json(
        { error: "This document has already been signed" },
        { status: 409 }
      )
    }
    if (signature.signer_action) {
      return NextResponse.json(
        { error: "This signing link is no longer active" },
        { status: 410 }
      )
    }

    // Check expiry
    if (signature.expires_at && new Date(signature.expires_at) < new Date()) {
      return NextResponse.json({ error: "Signing link has expired" }, { status: 410 })
    }

    // Sub-task 7.3: Re-compute document fingerprint and compare
    if (signature.session_id && signature.document_hash) {
      const { data: session, error: sessionError } = await supabase
        .from("document_sessions")
        .select("context")
        .eq("id", signature.session_id)
        .single()

      if (!sessionError && session?.context) {
        const recomputedHash = computeDocumentFingerprint(
          session.context as Record<string, unknown>
        )
        if (recomputedHash !== signature.document_hash) {
          await recordAuditEvent(supabase, {
            action: "signature.tamper_detected",
            signature_id: signature.id,
            document_id: signature.document_id ?? undefined,
            session_id: signature.session_id,
            ip_address: clientIP,
            user_agent: userAgent,
            metadata: {
              stored_hash: signature.document_hash,
              recomputed_hash: recomputedHash,
            },
          })
          return NextResponse.json(
            { error: "Document integrity check failed" },
            { status: 409 }
          )
        }
      }
    }

    // Upload first, then let the atomic completion RPC decide whether the
    // capability is still valid. Any rejected completion removes this object.
    const objectKey = `signatures/${signature.id}_${Date.now()}.${fileExt}`
    let bytes: Uint8Array
    try {
      const binaryStr = atob(base64Part)
      bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
    } catch {
      return NextResponse.json({ error: "Invalid signature image encoding" }, { status: 400 })
    }

    const { error: storageError } = await supabase.storage
      .from("signatures")
      .upload(objectKey, bytes, { contentType, upsert: false })

    if (storageError) {
      console.error("[sign] Supabase Storage upload failed:", storageError)
      await recordAuditEvent(supabase, {
        action: "signature.upload_failed",
        signature_id: signature.id,
        document_id: signature.document_id ?? undefined,
        session_id: signature.session_id ?? undefined,
        ip_address: clientIP,
        user_agent: userAgent,
        metadata: { error: storageError.message },
      })
      return NextResponse.json({ error: "Failed to store signature image" }, { status: 500 })
    }

    const signatureImageKey = `sb:${objectKey}`
    const signedAt = new Date().toISOString()

    // Atomically commit the signature while holding the parent session lock.
    // If the owner cancels/unlocks during upload, the RPC rejects the commit.
    const { data: completionData, error: completionError } = await supabase.rpc(
      "complete_signature_signing",
      {
        p_signature_id: signature.id,
        p_token_hash: tokenHash,
        p_signature_image_url: signatureImageKey,
        p_signed_at: signedAt,
        p_ip_address: clientIP === "unknown" ? null : clientIP,
        p_user_agent: userAgent,
      }
    )
    const completedSignature = Array.isArray(completionData) ? completionData[0] : completionData

    if (completionError) {
      await supabase.storage.from("signatures").remove([objectKey]).catch(() => {})
      console.error("[sign] complete_signature_signing error:", completionError)
      return NextResponse.json({ error: "Failed to record signature" }, { status: 500 })
    }
    if (!completedSignature || completedSignature.outcome !== "signed") {
      await supabase.storage.from("signatures").remove([objectKey]).catch(() => {})
      const failures: Record<string, { error: string; status: number }> = {
        invalid_request: { error: "Invalid signature request", status: 400 },
        not_found: { error: "Invalid or expired signing link", status: 404 },
        parent_cancelled: { error: "This signing link is no longer active", status: 410 },
        stale_request: { error: "This signing request has been superseded", status: 409 },
        already_signed: { error: "This document has already been signed", status: 409 },
        already_responded: { error: "This signing link is no longer active", status: 409 },
        expired: { error: "Signing link has expired", status: 410 },
        attempts_exceeded: { error: "Signing link has been invalidated due to too many attempts", status: 410 },
        conflict: { error: "This signing link is no longer active", status: 409 },
      }
      const failure = failures[completedSignature?.outcome ?? "conflict"] ?? failures.conflict
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    const completedSession = completedSignature.completed_session === true

    // Sub-task 7.4: Record signature.signed audit event
    await recordAuditEvent(supabase, {
      action: "signature.signed",
      signature_id: signature.id,
      document_id: signature.document_id ?? undefined,
      session_id: signature.session_id ?? undefined,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: {
        signed_at: signedAt,
        signature_image_key: signatureImageKey,
      },
    })

    // Only the request that atomically transitioned the parent session runs
    // completion side effects. Other signer submissions still record signed audit.
    if (completedSession && signature.session_id) {
      const { data: completedParent } = await supabase
        .from("document_sessions")
        .select("active_signature_cohort_id")
        .eq("id", signature.session_id)
        .single()

      let completedSignaturesQuery = supabase
        .from("signatures")
        .select("id, signed_at, signer_name, signer_email")
        .eq("session_id", signature.session_id)
      if (completedParent?.active_signature_cohort_id) {
        completedSignaturesQuery = completedSignaturesQuery.eq(
          "signing_cohort_id",
          completedParent.active_signature_cohort_id
        )
      }
      const { data: allSignatures } = await completedSignaturesQuery

      const completedAt = signedAt
      const signatureIds = (allSignatures ?? []).map((s: { id: string }) => s.id)

        // Record signature.completed audit event
        await recordAuditEvent(supabase, {
          action: "signature.completed",
          document_id: signature.document_id ?? undefined,
          session_id: signature.session_id,
          metadata: {
            document_id: signature.document_id,
            completed_at: completedAt,
            signature_ids: signatureIds,
          },
        })

        // Trigger certificate generation (stub — full impl in Task 9)
        if (signature.document_id) {
          try {
            await generateAndStoreCertificate(signature.session_id, signature.document_id)
          } catch (certErr) {
            console.error("[sign] certificate generation error:", certErr)
          }
        }

        // Fetch session details for email/notifications
        const { data: session } = await supabase
          .from("document_sessions")
          .select("context, document_type, user_id, public_id")
          .eq("id", signature.session_id)
          .single()

        // Fetch current signer details
        const { data: currentSigner } = await supabase
          .from("signatures")
          .select("signer_name, signer_email")
          .eq("id", signature.id)
          .single()

        const documentType = session?.document_type ?? "document"
        const context = (session?.context ?? {}) as Record<string, unknown>
        // For non-invoice docs, prefer referenceNumber over invoiceNumber
        const referenceNumber = documentType === "invoice"
          ? ((context.invoiceNumber as string) || (context.referenceNumber as string) || "")
          : ((context.referenceNumber as string) || (context.invoiceNumber as string) || "")
        const docTypeLabel =
          documentType.charAt(0).toUpperCase() + documentType.slice(1)

        // Fetch business name from businesses table via session.user_id
        let businessName = "Clorefy"
        if (session?.user_id) {
          const { data: business } = await supabase
            .from("businesses")
            .select("name")
            .eq("user_id", session.user_id)
            .single()
          if (business?.name) {
            businessName = business.name
          }
        }

        const verificationUrl = completedSignature.verification_url ?? ""
        const signerEmail = currentSigner?.signer_email
        const signerName = currentSigner?.signer_name ?? "Someone"
        const signedDocumentUrl = getPublicDocumentUrl(
          session?.public_id ?? signature.parent_public_id,
          "view"
        )
        const escapedBusinessName = escapeHtml(businessName)
        const escapedDocumentLabel = escapeHtml(docTypeLabel)
        const escapedReferenceNumber = escapeHtml(referenceNumber)
        const escapedSignerName = escapeHtml(signerName)
        const escapedVerificationUrl = escapeHtml(verificationUrl)
        const escapedSignedDocumentUrl = escapeHtml(signedDocumentUrl)

        // Send completion email to signer
        if (signerEmail) {
          try {
            await sendEmail({
              to: signerEmail,
              subject: `You signed ${docTypeLabel} ${referenceNumber} — ${businessName}`,
              html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
  <tr><td align="center" style="padding:24px 8px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:28px 28px 20px 28px;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0;font-size:20px;font-weight:700;color:#18181b;">${escapedBusinessName}</p>
      </td></tr>
      <tr><td style="padding:28px 28px 8px 28px;">
        <div style="width:48px;height:48px;background:#dcfce7;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="font-size:24px;">✓</span>
        </div>
        <p style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#18181b;">You signed ${escapedDocumentLabel} ${escapedReferenceNumber}</p>
        <p style="margin:0 0 24px 0;font-size:14px;color:#52525b;line-height:1.6;">
          Hi ${escapedSignerName}, your electronic signature has been successfully recorded.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;border-radius:10px;border:1px solid #e4e4e7;margin-bottom:24px;">
          <tr><td style="padding:16px 20px;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;">Signed at</p>
            <p style="margin:0;font-size:14px;color:#18181b;">${new Date(signedAt).toUTCString()}</p>
          </td></tr>
          ${verificationUrl ? `<tr><td style="padding:0 20px 16px 20px;">
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;">Verification</p>
            <a href="${escapedVerificationUrl}" style="font-size:13px;color:#6366f1;word-break:break-all;">${escapedVerificationUrl}</a>
          </td></tr>` : ""}
        </table>
      </td></tr>
      <tr><td style="padding:0 28px 28px 28px;">
        <a href="${escapedSignedDocumentUrl}"
          style="display:inline-block;padding:13px 28px;background:#18181b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">
          View Signed Document
        </a>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;background:#fafafa;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
          Sent via <a href="https://clorefy.com" style="color:#6366f1;text-decoration:none;font-weight:600;">Clorefy</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`,
              senderName: businessName,
              category: "signature_completion",
            })
          } catch (emailErr) {
            console.error("[sign] completion email error:", emailErr)
          }
        }

        // Create owner in-app notifications
        if (session?.user_id) {
          const notificationMeta = {
            session_id: signature.session_id,
            signature_id: signature.id,
            signer_name: signerName,
            document_type: documentType,
            reference_number: referenceNumber,
            verification_url: verificationUrl,
          }

          // signature_signed: "[Signer Name] signed your [document type] [reference number]."
          await supabase.from("notifications").insert({
            user_id: session.user_id,
            type: "signature_signed",
            title: "Document Signed",
            message: `${signerName} signed your ${documentType} ${referenceNumber}.`,
            read: false,
            metadata: notificationMeta,
          } as any)

          // signature_completed: "Your [document type] [reference number] has been fully signed by all parties."
          await supabase.from("notifications").insert({
            user_id: session.user_id,
            type: "signature_completed",
            title: "All Signatures Complete",
            message: `Your ${documentType} ${referenceNumber} has been fully signed by all parties.`,
            read: false,
            metadata: notificationMeta,
          } as any)
        }

        // Parent session and document status were already transitioned by
        // complete_signature_signing under the same parent-row lock.

        // ── Auto-invoice on sign ──────────────────────────────────────────────
        // If the contract has auto_invoice_on_sign = true, create a linked invoice
        // and send it to the signer (or the configured recipient email).
        if (session && documentType === "contract") {
          const { data: fullSession } = await supabase
            .from("document_sessions")
            .select("auto_invoice_on_sign, invoice_recipient_email, context, user_id, chain_id, client_name")
            .eq("id", signature.session_id)
            .single()

          if (fullSession?.auto_invoice_on_sign) {
            try {
              await triggerAutoInvoice({
                supabase: supabase as any,
                contractSession: fullSession,
                contractSessionId: signature.session_id,
                signerEmail: signerEmail ?? "",
                signerName,
                businessName,
              })
            } catch (autoInvErr) {
              console.error("[sign] auto-invoice error (non-fatal):", autoInvErr)
            }
          }
        }
    }

    // Sub-task 7.6: Return verificationUrl in success response
    return NextResponse.json({
      success: true,
      message: "Document signed successfully",
      verificationUrl: completedSignature.verification_url ?? null,
    })
  } catch (error) {
    console.error("[sign] unexpected error:", error)
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
  }
}
