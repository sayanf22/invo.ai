/**
 * Upload API — Presigned PUT URL Generation
 *
 * Returns a short-lived presigned PUT URL so the browser uploads directly to R2.
 * The R2 credentials never leave the server. The browser only gets a temporary
 * signed URL that expires in 5 minutes.
 *
 * POST /api/storage/upload
 * Request:  { fileName, fileSize, contentType, category }
 * Response: { uploadUrl, objectKey }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { generatePresignedPutUrl } from "@/lib/r2"
import { sanitizeFileName } from "@/lib/sanitize"

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}

function extractExtension(fileName: string, contentType: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex !== -1 && dotIndex < fileName.length - 1) {
    return fileName.slice(dotIndex + 1).toLowerCase()
  }
  return MIME_TO_EXT[contentType] ?? "bin"
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const body = await request.json()
    const { fileName, fileSize, contentType, category } = body as {
      fileName?: string
      fileSize?: number
      contentType?: string
      category?: string
    }

    if (!fileName || fileSize == null || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileSize, contentType." },
        { status: 400 },
      )
    }

    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType as any)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." },
        { status: 400 },
      )
    }

    if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
    }

    if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category as any)) {
      return NextResponse.json({ error: "Invalid upload category." }, { status: 400 })
    }

    const safeName = sanitizeFileName(fileName)
    const ext = extractExtension(safeName, contentType)
    const objectKey = `${category}/${auth.user.id}/${crypto.randomUUID()}.${ext}`

    const uploadUrl = await generatePresignedPutUrl(objectKey, contentType)

    return NextResponse.json({ uploadUrl, objectKey })
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json(
      { error: "Failed to generate upload URL. Please try again." },
      { status: 500 },
    )
  }
}
