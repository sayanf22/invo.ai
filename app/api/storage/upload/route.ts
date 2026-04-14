/**
 * Upload API — Server-Side File Upload to R2
 *
 * The browser sends the file to this API via FormData.
 * The server uploads it to R2 using the S3 SDK (no presigned URLs, no CORS).
 * R2 credentials never leave the server.
 *
 * POST /api/storage/upload
 * Request:  FormData with { file, category }
 * Response: { objectKey }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { uploadToR2 } from "@/lib/r2"
import { sanitizeFileName } from "@/lib/sanitize"

const ALLOWED_CONTENT_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "image/gif": "gif", "application/pdf": "pdf",
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

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const category = (formData.get("category") as string) || "uploads"

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }

    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type as any)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
    }

    if (!(VALID_CATEGORIES as readonly string[]).includes(category as any)) {
      return NextResponse.json({ error: "Invalid upload category." }, { status: 400 })
    }

    const safeName = sanitizeFileName(file.name)
    const ext = extractExtension(safeName, file.type)
    const objectKey = `${category}/${auth.user.id}/${crypto.randomUUID()}.${ext}`

    // Upload to R2 server-side via S3 SDK (no CORS, no presigned URLs)
    const arrayBuffer = await file.arrayBuffer()
    await uploadToR2(objectKey, arrayBuffer, file.type)

    return NextResponse.json({ objectKey })
  } catch (error) {
    console.error("Upload API error:", error instanceof Error ? `${error.message}\n${error.stack}` : error)
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    )
  }
}
