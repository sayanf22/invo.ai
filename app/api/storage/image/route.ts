/**
 * Image Proxy API — Returns R2 images as base64 data URLs
 *
 * This avoids CORS issues with @react-pdf/renderer's <Image> component
 * which fetches images via XMLHttpRequest (different from browser <img>).
 * By converting to base64 data URLs server-side, the image works everywhere.
 *
 * GET /api/storage/image?key=logos/userId/uuid.jpg
 * Response: { dataUrl: "data:image/jpeg;base64,..." }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getObject } from "@/lib/r2"

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

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const key = request.nextUrl.searchParams.get("key")
    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 })
    }

    // Verify ownership
    if (!isSignatureKey(key)) {
      const keyUserId = extractUserIdFromKey(key)
      if (!keyUserId || keyUserId !== auth.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Read object directly from R2 (native binding on Workers, S3 SDK locally)
    const obj = await getObject(key)

    if (!obj) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Convert to base64 data URL
    const base64 = Buffer.from(obj.body).toString("base64")
    const mime = obj.contentType !== "application/octet-stream" ? obj.contentType : getMimeFromKey(key)
    const dataUrl = `data:${mime};base64,${base64}`

    return NextResponse.json({ dataUrl })
  } catch (error) {
    console.error("Image proxy error:", error)
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 })
  }
}
