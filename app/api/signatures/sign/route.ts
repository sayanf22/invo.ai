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
import { getClientIP, sanitizeError } from "@/lib/api-auth"
import { generatePresignedPutUrl } from "@/lib/r2"
import { recordAuditEvent } from "@/lib/signature-audit"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"
import { generateAndStoreCertificate } from "@/lib/certificate-generator"
import { sendEmail } from "@/lib/mailtrap"

const MAX_BODY_SIZE = 500 * 1024

// Sub-task 7.1: Token format regex — sign_ followed by exactly 32 lowercase hex chars
const TOKEN_REGEX = /^sign_[0-9a-f]{32}$/

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase service role credentials")
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  try {
    // Parse body
    let body: { token?: string; signatureDataUrl?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (JSON.stringify(body).length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large. Maximum 500KB allowed." },
        { status: 413 }
      )
    }

    const { token, signatureDataUrl } = body

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing or invalid signing token" }, { status: 400 })
    }

    if (!signatureDataUrl || typeof signatureDataUrl !== "string") {
      return NextResponse.json({ error: "Missing or invalid signature data" }, { status: 400 })
    }

    // Sub-task 7.1: Validate token format before any DB lookup
    if (!TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 })
    }

    // Validate signature image format
    if (
      !signatureDataUrl.startsWith("data:image/png") &&
      !signatureDataUrl.startsWith("data:image/jpeg")
    ) {
      return NextResponse.json(
        { error: "Invalid signature image format. Must be data:image/png or data:image/jpeg." },
        { status: 400 }
      )
    }

    // Validate decoded image size
    const commaIndex = signatureDataUrl.indexOf(",")
    if (commaIndex === -1) {
      return NextResponse.json({ error: "Invalid signature data URL format" }, { status: 400 })
    }
    const base64Part = signatureDataUrl.substring(commaIndex + 1)
    const padding = (base64Part.match(/=+$/) || [""])[0].length
    const decodedSize = Math.floor((base64Part.length * 3) / 4) - padding
    if (decodedSize > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Signature image too large. Maximum 500KB allowed." },
        { status: 413 }
      )
    }

    const supabase = getServiceRoleClient()
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Sub-task 7.2: Increment attempt_count on every call
    // Supabase JS client doesn't support `col = col + 1` directly.
    // We use a two-step approach: fetch then update with incremented value.
    const { data: signatureRow, error: fetchError } = await supabase
      .from("signatures")
      .select(
        "id, attempt_count, signed_at, expires_at, document_hash, session_id, verification_url, document_id"
      )
      .eq("token", token)
      .single()

    if (fetchError || !signatureRow) {
      return NextResponse.json({ error: "Invalid or expired signing link" }, { status: 404 })
    }

    const newAttemptCount = (signatureRow.attempt_count ?? 0) + 1

    // Persist the incremented count
    await supabase
      .from("signatures")
      .update({ attempt_count: newAttemptCount } as any)
      .eq("id", signatureRow.id)

    const signature = { ...signatureRow, attempt_count: newAttemptCount }

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

    // Check if already signed
    if (signature.signed_at) {
      return NextResponse.json(
        { error: "This document has already been signed" },
        { status: 409 }
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

    // Upload signature image to R2
    let signatureImageKey = "data_url_fallback"
    try {
      const binaryStr = atob(base64Part)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const objectKey = `signatures/${signature.id}_${Date.now()}.png`
      const presignedUrl = await generatePresignedPutUrl(objectKey, "image/png")
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: bytes,
        headers: { "Content-Type": "image/png" },
      })
      if (uploadResponse.ok) {
        signatureImageKey = objectKey
      } else {
        console.error("[sign] R2 upload failed:", uploadResponse.status)
        await recordAuditEvent(supabase, {
          action: "signature.r2_fallback",
          signature_id: signature.id,
          document_id: signature.document_id ?? undefined,
          session_id: signature.session_id ?? undefined,
          ip_address: clientIP,
          user_agent: userAgent,
        })
      }
    } catch (uploadErr) {
      console.error("[sign] R2 upload error:", uploadErr)
      await recordAuditEvent(supabase, {
        action: "signature.r2_fallback",
        signature_id: signature.id,
        document_id: signature.document_id ?? undefined,
        session_id: signature.session_id ?? undefined,
        ip_address: clientIP,
        user_agent: userAgent,
      })
    }

    const signedAt = new Date().toISOString()

    // Update the signature record
    const { error: updateError } = await supabase
      .from("signatures")
      .update({
        signature_image_url: signatureImageKey,
        signed_at: signedAt,
        ip_address: clientIP,
        user_agent: userAgent,
      } as any)
      .eq("id", signature.id)

    if (updateError) {
      console.error("[sign] signature update error:", updateError)
      return NextResponse.json({ error: "Failed to record signature" }, { status: 500 })
    }

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

    // Sub-task 7.5: Check if all signers have signed
    if (signature.session_id) {
      const { data: allSignatures } = await supabase
        .from("signatures")
        .select("id, signed_at, signer_name, signer_email")
        .eq("session_id", signature.session_id)

      const allSigned =
        allSignatures &&
        allSignatures.length > 0 &&
        allSignatures.every((s: { signed_at: string | null }) => s.signed_at !== null)

      if (allSigned) {
        const completedAt = new Date().toISOString()
        const signatureIds = allSignatures.map((s: { id: string }) => s.id)

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
          .select("context, document_type, user_id")
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
        const referenceNumber =
          (context.invoiceNumber as string) ||
          (context.referenceNumber as string) ||
          ""
        const docTypeLabel =
          documentType.charAt(0).toUpperCase() + documentType.slice(1)

        // Fetch business name from businesses table via session.user_id
        let businessName = "Clorefy"
        if (session?.user_id) {
          const { data: business } = await supabase
            .from("businesses")
            .select("business_name")
            .eq("user_id", session.user_id)
            .single()
          if (business?.business_name) {
            businessName = business.business_name
          }
        }

        const verificationUrl = signature.verification_url ?? ""
        const signerEmail = currentSigner?.signer_email
        const signerName = currentSigner?.signer_name ?? "Someone"

        // Send completion email to signer
        if (signerEmail) {
          try {
            await sendEmail({
              to: signerEmail,
              subject: `You signed ${docTypeLabel} ${referenceNumber} — ${businessName}`,
              html: `
                <p>Hi ${signerName},</p>
                <p>You have successfully signed <strong>${docTypeLabel} ${referenceNumber}</strong>.</p>
                <p><strong>Signed at:</strong> ${new Date(signedAt).toUTCString()}</p>
                ${verificationUrl ? `<p><strong>Verification URL:</strong> <a href="${verificationUrl}">${verificationUrl}</a></p>` : ""}
                <p>Thank you,<br/>${businessName}</p>
              `,
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

        // Update document_sessions.status and documents.status to "signed"
        await supabase
          .from("document_sessions")
          .update({ status: "signed" } as any)
          .eq("id", signature.session_id)

        if (signature.document_id) {
          await supabase
            .from("documents")
            .update({ status: "signed" })
            .eq("id", signature.document_id)
        }
      }
    }

    // Sub-task 7.6: Return verificationUrl in success response
    return NextResponse.json({
      success: true,
      message: "Document signed successfully",
      verificationUrl: signature.verification_url ?? null,
    })
  } catch (error) {
    console.error("[sign] unexpected error:", error)
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
  }
}
