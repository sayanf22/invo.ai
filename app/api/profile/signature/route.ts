/**
 * Saved Signature API
 * GET  /api/profile/signature — fetch saved signature
 * POST /api/profile/signature — save/update signature
 * DELETE /api/profile/signature — remove saved signature
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"

const MAX_SIG_SIZE = 100 * 1024

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("saved_signature_url")
      .eq("id", auth.user.id)
      .single()

    const sigKey = (profile as any)?.saved_signature_url as string | null
    if (!sigKey) return NextResponse.json({ signatureDataUrl: null })

    // Fetch from Supabase Storage
    const serviceSupabase = getServiceRoleClient()
    const storagePath = sigKey.startsWith("sb:") ? sigKey.slice(3) : sigKey
    const { data: blob, error } = await serviceSupabase.storage.from("signatures").download(storagePath)
    if (error || !blob) return NextResponse.json({ signatureDataUrl: null })

    const buf = await blob.arrayBuffer()
    const b64 = Buffer.from(buf).toString("base64")
    const mime = blob.type || "image/jpeg"
    return NextResponse.json({ signatureDataUrl: `data:${mime};base64,${b64}` })
  } catch {
    return NextResponse.json({ error: "Failed to fetch signature" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { signatureDataUrl } = await request.json()
    if (!signatureDataUrl) return NextResponse.json({ error: "Missing signatureDataUrl" }, { status: 400 })

    if (!signatureDataUrl.startsWith("data:image/png") && !signatureDataUrl.startsWith("data:image/jpeg")) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 })
    }

    const commaIndex = signatureDataUrl.indexOf(",")
    const base64Part = signatureDataUrl.substring(commaIndex + 1)
    const padding = (base64Part.match(/=+$/) || [""])[0].length
    const decodedSize = Math.floor((base64Part.length * 3) / 4) - padding
    if (decodedSize > MAX_SIG_SIZE) return NextResponse.json({ error: "Too large" }, { status: 413 })

    const contentType = signatureDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png"
    const fileExt = contentType === "image/jpeg" ? "jpg" : "png"
    const binaryStr = atob(base64Part)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

    const serviceSupabase = getServiceRoleClient()
    const objectKey = `signatures/saved_${auth.user.id}.${fileExt}`

    // Delete old saved signature first (upsert)
    await serviceSupabase.storage.from("signatures").remove([objectKey]).catch(() => {})

    const { error: uploadError } = await serviceSupabase.storage
      .from("signatures")
      .upload(objectKey, bytes, { contentType, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }

    const sigKey = `sb:${objectKey}`

    // Save key to profiles
    await auth.supabase
      .from("profiles")
      .update({ saved_signature_url: sigKey } as any)
      .eq("id", auth.user.id)

    return NextResponse.json({ success: true, signatureKey: sigKey })
  } catch {
    return NextResponse.json({ error: "Failed to save signature" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const serviceSupabase = getServiceRoleClient()

    // Remove from storage (both jpg and png variants)
    await serviceSupabase.storage.from("signatures").remove([
      `signatures/saved_${auth.user.id}.jpg`,
      `signatures/saved_${auth.user.id}.png`,
    ]).catch(() => {})

    await auth.supabase
      .from("profiles")
      .update({ saved_signature_url: null } as any)
      .eq("id", auth.user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete signature" }, { status: 500 })
  }
}
