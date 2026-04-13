/**
 * Upload API — Presigned PUT URL Generation
 *
 * SECURITY: Authenticates user, validates input, generates a short-lived
 * presigned PUT URL so the browser uploads directly to R2.
 * Credentials never leave the server.
 *
 * POST /api/storage/upload
 * Request:  { fileName, fileSize, contentType, category }
 * Response: { uploadUrl, objectKey }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { generatePresignedPutUrl } from "@/lib/r2"

// ── Validation constants ───────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const

type AllowedCategory = (typeof VALID_CATEGORIES)[number]

// ── Helpers ────────────────────────────────────────────────────────────

/** Map MIME type → common file extension */
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
  // Fallback to MIME-based extension
  return MIME_TO_EXT[contentType] ?? "bin"
}

// ── Route handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // 2. Rate limit
    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    // 3. Parse body
    const body = await request.json()
    const { fileName, fileSize, contentType, category } = body as {
      fileName?: string
      fileSize?: number
      contentType?: string
      category?: string
    }

    // 4. Validate required fields
    if (!fileName || fileSize == null || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileSize, contentType." },
        { status: 400 },
      )
    }

    // 5. Validate content type
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." },
        { status: 400 },
      )
    }

    // 6. Validate file size
    if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB." },
        { status: 400 },
      )
    }

    // 7. Validate category
    if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { error: "Invalid upload category." },
        { status: 400 },
      )
    }

    // 8. Generate object key: {category}/{userId}/{uuid}.{ext}
    const ext = extractExtension(fileName, contentType)
    const objectKey = `${category}/${auth.user.id}/${crypto.randomUUID()}.${ext}`

    // 9. Generate presigned PUT URL with content type restriction
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
