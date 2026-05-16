import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/emails/view-document?sessionId=xxx
 *
 * Public endpoint — no auth required.
 * Returns document context + signature images for email recipients.
 * Uses service role to bypass RLS (the session ID acts as the access token).
 *
 * Access rules:
 * - Documents that have been sent (sent_at is set), OR
 * - Documents that are signed (status = "signed") — signing is the authorization
 * Draft/unsent/unsigned documents are blocked.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId || typeof sessionId !== "string" || sessionId.length < 10) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: session, error } = await supabase
      .from("document_sessions")
      .select("context, document_type, status, sent_at, user_id")
      .eq("id", sessionId)
      .single()

    if (error || !session?.context) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Allow: sent documents OR signed documents
    // Block: drafts that were never sent and never signed
    if (!session.sent_at && session.status !== "signed") {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // ── Cancellation guard ──
    // Two cancellation paths exist:
    //   1. Owner clicks "Unlock" via chat → status returns to "active"
    //   2. Owner clicks "Cancel" via document preview → status becomes "cancelled"
    // Both should immediately revoke public access — this matches the industry
    // standard set by DocuSign / Adobe Sign / HelloSign where voiding a document
    // makes the link null and renders the document unavailable to recipients.
    // Exception: end-states "signed" and "paid" are NEVER revoked (legally binding).
    if (session.status === "cancelled") {
        return NextResponse.json(
            { error: "This document is no longer available. The owner has cancelled it.", cancelled: true },
            { status: 410 }
        )
    }
    if (session.status === "active" && session.sent_at) {
      // Owner unlocked after sending — public link is now dead
      return NextResponse.json(
        { error: "This document is no longer available. The owner has cancelled the share.", cancelled: true },
        { status: 410 }
      )
    }

    // Also check: if all signature requests for this session are cancelled,
    // treat the public view as cancelled too (defence in depth).
    if (["contract", "sow", "nda", "change_order", "quotation", "quote", "proposal"].includes(session.document_type || "")) {
      const { data: sigs } = await supabase
        .from("signatures")
        .select("signer_action, signed_at")
        .eq("session_id", sessionId)
      const hasAnySig = (sigs ?? []).length > 0
      const allCancelled = hasAnySig && (sigs ?? []).every(s =>
        (s as any).signer_action === "cancelled" && !s.signed_at
      )
      if (allCancelled) {
        return NextResponse.json(
          { error: "This document is no longer available. The owner has cancelled the share.", cancelled: true },
          { status: 410 }
        )
      }
    }

    // Payment info for invoices
    let payment = null
    if (session.document_type === "invoice") {
      const { data: pay } = await supabase
        .from("invoice_payments")
        .select("short_url, status, amount, currency, amount_paid")
        .eq("session_id", sessionId)
        .in("status", ["created", "partially_paid", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (pay) payment = pay
    }

    // Load signature images for signed documents
    // Returns base64 data URLs so the PDF template can embed them
    let signatureImages: Array<{ signerName: string; party: string; imageDataUrl: string; signedAt: string }> = []
    let senderSignatureDataUrl: string | undefined = undefined
    if (["contract", "quotation", "proposal"].includes(session.document_type || "")) {
      const { data: sigs } = await supabase
        .from("signatures")
        .select("signer_name, party, signed_at, signature_image_url")
        .eq("session_id", sessionId)
        .not("signed_at", "is", null)

      if (sigs && sigs.length > 0) {
        for (const sig of sigs) {
          const imgKey = (sig as any).signature_image_url as string | null
          if (!imgKey || imgKey === "data_url_fallback") continue

          let imageDataUrl: string | null = null

          // Handle inline data URLs directly (fallback from failed storage uploads)
          if (imgKey.startsWith("data:image/")) {
            imageDataUrl = imgKey
          } else if (imgKey.startsWith("sb:")) {
            // Supabase Storage
            try {
              const storagePath = imgKey.slice(3)
              const bucket = storagePath.startsWith("signatures/") ? "signatures" : "business-assets"
              const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(storagePath)
              if (!dlErr && blob) {
                const buf = await blob.arrayBuffer()
                const b64 = Buffer.from(buf).toString("base64")
                const mime = blob.type || "image/jpeg"
                imageDataUrl = `data:${mime};base64,${b64}`
              }
            } catch { /* non-fatal */ }
          } else {
            // R2 — use getObject
            try {
              const { getObject } = await import("@/lib/r2")
              const obj = await getObject(imgKey)
              if (obj) {
                const b64 = Buffer.from(obj.body).toString("base64")
                const mime = obj.contentType !== "application/octet-stream" ? obj.contentType : "image/png"
                imageDataUrl = `data:${mime};base64,${b64}`
              }
            } catch { /* non-fatal */ }
          }

          if (imageDataUrl) {
            if ((sig as any).party === "Sender") {
              // Map Sender signature for Party A in PDF
              senderSignatureDataUrl = imageDataUrl
            } else {
              // Map Client/other signatures for Party B in PDF
              signatureImages.push({
                signerName: sig.signer_name || "Signer",
                party: (sig as any).party || "Client",
                imageDataUrl,
                signedAt: sig.signed_at!,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({
      context: session.context,
      documentType: session.document_type,
      sessionStatus: session.status,
      payment,
      signatureImages: signatureImages.length > 0 ? signatureImages : undefined,
      senderSignatureDataUrl,
    })
  } catch (err) {
    console.error("View document error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
