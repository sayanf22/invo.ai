/**
 * Image Proxy API — Returns images as base64 data URLs
 *
 * Supports two storage backends:
 * - Supabase Storage: key prefixed with "sb:" (e.g. "sb:signatures/xxx.png")
 * - R2: plain key (e.g. "logos/userId/uuid.jpg")
 *
 * This avoids CORS issues with @react-pdf/renderer's <Image> component.
 *
 * GET /api/storage/image?key=sb:signatures/xxx.png
 * GET /api/storage/image?key=logos/userId/uuid.jpg
 * Response: { dataUrl: "data:image/png;base64,..." }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getObject } from "@/lib/r2"
import { createClient } from "@supabase/supabase-js"

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
}

function getMimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || ""
  return MIME_MAP[ext] || "application/octet-stream"
}

function isSignatureKey(key: string): boolean {
  return key.startsWith("signatures/")
}

function extractUserIdFromKey(key: string): string | null {
  const segments = key.split("/")
  return segments.length >= 3 ? segments[1] : null
}

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

    const rawKey = request.nextUrl.searchParams.get("key")
    if (!rawKey) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 })
    }

    // Detect storage backend from prefix
    const isSupabaseStorage = rawKey.startsWith("sb:")
    const key = isSupabaseStorage ? rawKey.slice(3) : rawKey

    // Security: prevent path traversal attacks
    if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 })
    }

    // Ownership check for non-signature R2 keys (logos etc.)
    if (!isSupabaseStorage && !isSignatureKey(key)) {
      const keyUserId = extractUserIdFromKey(key)
      if (!keyUserId || keyUserId !== auth.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    let bodyBuffer: ArrayBuffer
    let mime: string

    if (isSupabaseStorage) {
      // Supabase Storage — use service role to bypass RLS (auth already verified above)
      const supabase = getServiceRoleClient()
      const bucket = key.startsWith("signatures/") ? "signatures" : "business-assets"
      const { data, error } = await supabase.storage.from(bucket).download(key)
      if (error || !data) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 })
      }
      bodyBuffer = await data.arrayBuffer()
      mime = data.type || getMimeFromKey(key)
    } else if (isSignatureKey(key)) {
      // Signature key without "sb:" prefix — try Supabase Storage first (new standard),
      // then fall back to R2 for backward compatibility with old signatures
      const supabase = getServiceRoleClient()
      const { data: sbData, error: sbError } = await supabase.storage.from("signatures").download(key)
      if (!sbError && sbData) {
        bodyBuffer = await sbData.arrayBuffer()
        mime = sbData.type || getMimeFromKey(key)
      } else {
        // Fallback to R2 for old signatures
        const obj = await getObject(key)
        if (!obj) {
          return NextResponse.json({ error: "Image not found" }, { status: 404 })
        }
        bodyBuffer = obj.body
        mime = obj.contentType !== "application/octet-stream" ? obj.contentType : getMimeFromKey(key)
      }
    } else {
      // R2 storage (logos etc.)
      const obj = await getObject(key)
      if (!obj) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 })
      }
      bodyBuffer = obj.body
      mime = obj.contentType !== "application/octet-stream" ? obj.contentType : getMimeFromKey(key)
    }

    const base64 = Buffer.from(bodyBuffer).toString("base64")
    const dataUrl = `data:${mime};base64,${base64}`

    return NextResponse.json({ dataUrl }, {
      headers: {
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("Image proxy error:", error instanceof Error ? `${error.name}: ${error.message}` : error)
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 })
  }
}
