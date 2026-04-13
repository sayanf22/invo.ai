/**
 * Upload API — Server-Side Proxy Upload to R2
 *
 * SECURITY: Authenticates user, validates input, uploads file directly
 * to R2 via native Cloudflare bindings. No credentials exposed to client.
 *
 * POST /api/storage/upload
 * Body: FormData with `file` field + `category` field
 * Response: { objectKey }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { putObject } from "@/lib/r2"

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

// ── Helpers ────────────────────────────────────────────────────────────

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

// ── Route handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // 2. Rate limit
    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    // 3. Parse FormData
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: "Invalid request. Expected multipart form data." },
        { status: 400 },
      )
    }

    const file = formData.get("file") as File | null
    const category = formData.get("category") as string | null

    // 4. Validate file exists
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing required field: file." },
        { status: 400 },
      )
    }

    // 5. Validate content type
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." },
        { status: 400 },
      )
    }

    // 6. Validate file size
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
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
    const ext = extractExtension(file.name, file.type)
    const objectKey = `${category}/${auth.user.id}/${crypto.randomUUID()}.${ext}`

    // 9. Upload to R2 via native binding
    const arrayBuffer = await file.arrayBuffer()
    await putObject(objectKey, arrayBuffer, file.type)

    return NextResponse.json({ objectKey })
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    )
  }
}
