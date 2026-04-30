/**
 * Self-Sign API — Document owner signs as Party A
 * POST /api/signatures/self-sign
 *
 * Authenticated endpoint. The document owner signs their own document
 * directly (no email token needed). This is the "Party A" signature.
 *
 * Body: { sessionId, signatureDataUrl }
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, getClientIP } from "@/lib/api-auth"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"
import { recordAuditEvent } from "@/lib/signature-audit"
import { randomUUID } from "crypto"

const MAX_SIG_SIZE = 100 * 1024 // 100KB

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const body = await request.json()
    const { sessionId, signatureDataUrl } = body

    if (!sessionId || !signatureDataUrl) {
      return NextResponse.json({ error: "Missing sessionId or signatureDataUrl" }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    // Validate signature format
    if (!signatureDataUrl.startsWith("data:image/png") && !signatureDataUrl.startsWith("data:image/jpeg")) {
      return NextResponse.json({ error: "Invalid signature format" }, { status: 400 })
    }

    // Validate size
    const commaIndex = signatureDataUrl.indexOf(",")
    if (commaIndex === -1) return NextResponse.json({ error: "Invalid signature data" }, { status: 400 })
    const base64Part = signatureDataUrl.substring(commaIndex + 1)
    const padding = (base64Part.match(/=+$/) || [""])[0].length
    const decodedSize = Math.floor((base64Part.length * 3) / 4) - padding
    if (decodedSize > MAX_SIG_SIZE) {
      return NextResponse.json({ error: "Signature image too large" }, { status: 413 })
    }

    const supabase = auth.supabase
    const serviceSupabase = getServiceRoleClient()

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("document_sessions")
      .select("id, user_id, context, document_type, status")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Check if already self-signed (prevent duplicate)
    const { data: existingSig } = await serviceSupabase
      .from("signatures")
      .select("id, signed_at")
      .eq("session_id", sessionId)
      .eq("party", "Sender")
      .maybeSingle()

    if (existingSig?.signed_at) {
      return NextResponse.json({ error: "You have already signed this document" }, { status: 409 })
    }

    // Fetch owner info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", auth.user.id)
      .single()

    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("user_id", auth.user.id)
      .single()

    const signerName = (profile as any)?.full_name || business?.name || auth.user.email?.split("@")[0] || "Sender"
    const signerEmail = auth.user.email || ""

    // Upload signature image to Supabase Storage
    const contentType = signatureDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png"
    const fileExt = contentType === "image/jpeg" ? "jpg" : "png"
    const binaryStr = atob(base64Part)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    let signatureImageKey = signatureDataUrl // fallback: store raw data URL if upload fails
    const sigId = randomUUID()
    const objectKey = `signatures/${sigId}_${Date.now()}.${fileExt}`

    try {
      const { error: uploadError } = await serviceSupabase.storage
        .from("signatures")
        .upload(objectKey, bytes, { contentType, upsert: false })
      if (!uploadError) {
        signatureImageKey = `sb:${objectKey}`
      } else {
        console.error("[self-sign] Storage upload failed, using data URL fallback:", uploadError.message)
      }
    } catch { /* fallback to data URL */ }

    // Compute document hash
    const context = (session.context ?? {}) as Record<string, unknown>
    const documentHash = computeDocumentFingerprint(context)

    const signedAt = new Date().toISOString()
    const verificationUrl = `https://clorefy.com/verify/${sigId}`
    const clientIP = getClientIP(request)
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Insert signature record
    const { error: insertError } = await serviceSupabase
      .from("signatures")
      .insert({
        id: sigId,
        session_id: sessionId,
        signer_name: signerName,
        signer_email: signerEmail,
        party: "Sender",
        signed_at: signedAt,
        signature_image_url: signatureImageKey,
        ip_address: clientIP,
        user_agent: userAgent,
        document_hash: documentHash,
        verification_url: verificationUrl,
        // No token needed — authenticated flow
        token: `self_${randomUUID().replace(/-/g, "")}`,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      } as any)

    if (insertError) {
      console.error("[self-sign] insert error:", insertError)
      return NextResponse.json({ error: "Failed to record signature" }, { status: 500 })
    }

    // Update verification_url
    await serviceSupabase
      .from("signatures")
      .update({ verification_url: verificationUrl } as any)
      .eq("id", sigId)

    // Record audit event
    await recordAuditEvent(serviceSupabase, {
      action: "signature.signed",
      signature_id: sigId,
      session_id: sessionId,
      actor_email: signerEmail,
      ip_address: clientIP,
      user_agent: userAgent,
      metadata: { signed_at: signedAt, party: "Sender", self_signed: true },
    })

    return NextResponse.json({
      success: true,
      signatureId: sigId,
      verificationUrl,
      signedAt,
    })
  } catch (error) {
    console.error("[self-sign] error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
