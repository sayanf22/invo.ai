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
import { getObject } from "@/lib/r2"
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
    const { sessionId, signatureDataUrl: rawSignatureDataUrl, useSaved } = body as {
      sessionId?: string
      signatureDataUrl?: string | null
      useSaved?: boolean
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    if (!rawSignatureDataUrl && !useSaved) {
      return NextResponse.json(
        { error: "Missing signatureDataUrl or useSaved flag" },
        { status: 400 }
      )
    }

    const supabase = auth.supabase
    const serviceSupabase = getServiceRoleClient()

    // Resolve the signature source.
    // Priority: explicit signatureDataUrl (fresh draw) → saved businesses.signature_url.
    let signatureDataUrl: string | null = rawSignatureDataUrl ?? null

    if (!signatureDataUrl && useSaved) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("signature_url")
        .eq("user_id", auth.user.id)
        .maybeSingle() as { data: { signature_url: string | null } | null }

      const stored = biz?.signature_url?.trim() || ""
      if (!stored) {
        return NextResponse.json(
          { error: "No saved signature found on your profile" },
          { status: 404 }
        )
      }

      // Resolve stored key → data URL.
      // Supported forms:
      //   • data:image/... (inline, use as-is)
      //   • https://... (Supabase storage public URL → fetch bytes)
      //   • sb:<key> (Supabase storage private key)
      //   • r2:<key> or plain key (R2 bucket)
      signatureDataUrl = await resolveStoredSignatureToDataUrl(stored, serviceSupabase)
      if (!signatureDataUrl) {
        return NextResponse.json(
          { error: "Saved signature could not be loaded" },
          { status: 500 }
        )
      }
    }

    if (!signatureDataUrl) {
      return NextResponse.json({ error: "No signature data available" }, { status: 400 })
    }

    // Validate signature format (data URL only at this point)
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


/**
 * Resolve a stored signature URL / key to a base64 data URL.
 *
 * Accepts any of:
 *   • Inline data URL (returned as-is)
 *   • Supabase public URL (https://...)
 *   • "sb:<key>" → Supabase storage private object
 *   • "r2:<key>" or plain R2 object key → Cloudflare R2
 */
async function resolveStoredSignatureToDataUrl(
  stored: string,
  serviceSupabase: any
): Promise<string | null> {
  try {
    // 1. Already a data URL
    if (stored.startsWith("data:image/")) {
      return stored
    }

    // 2. Full URL → fetch bytes
    if (stored.startsWith("http://") || stored.startsWith("https://")) {
      const res = await fetch(stored)
      if (!res.ok) return null
      const buf = new Uint8Array(await res.arrayBuffer())
      const contentType = res.headers.get("content-type") || "image/png"
      return bytesToDataUrl(buf, contentType)
    }

    // 3. Supabase private storage key
    if (stored.startsWith("sb:")) {
      const key = stored.slice(3)
      const { data, error } = await serviceSupabase.storage
        .from("signatures")
        .download(key)
      if (error || !data) return null
      const buf = new Uint8Array(await data.arrayBuffer())
      const contentType = data.type || "image/png"
      return bytesToDataUrl(buf, contentType)
    }

    // 4. R2 key (with or without "r2:" prefix)
    const r2Key = stored.startsWith("r2:") ? stored.slice(3) : stored
    const obj = await getObject(r2Key)
    if (!obj) return null
    const buf = new Uint8Array(obj.body)
    return bytesToDataUrl(buf, obj.contentType || "image/png")
  } catch (err) {
    console.error("[self-sign] resolveStoredSignatureToDataUrl error:", err)
    return null
  }
}

function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  // btoa is available in Workers + Node 16+
  const b64 = typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64")
  const mime = contentType.startsWith("image/jpeg") ? "image/jpeg" : "image/png"
  return `data:${mime};base64,${b64}`
}
