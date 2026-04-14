/**
 * Upload API — Server-Side File Upload to R2
 *
 * SECURITY: Authenticates user, validates input, uploads file to R2 server-side.
 * No CORS needed — the browser only talks to our API, never to R2 directly.
 * R2 credentials and endpoints are never exposed to the client.
 *
 * POST /api/storage/upload
 * Request:  FormData with { file, category } OR JSON with { fileName, fileSize, contentType, category }
 * Response: { objectKey }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { uploadToR2 } from "@/lib/r2"
import { sanitizeFileName } from "@/lib/sanitize"

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

    // 2. Parse — support both FormData (file upload) and JSON (legacy)
    const contentTypeHeader = request.headers.get("content-type") || ""

    let file: File | null = null
    let category = "uploads"

    if (contentTypeHeader.includes("multipart/form-data")) {
      // FormData upload (preferred — server-side, no CORS)
      const formData = await request.formData()
      file = formData.get("file") as File | null
      category = (formData.get("category") as string) || "uploads"
    } else {
      // JSON body (legacy presigned URL flow — kept for backward compat)
      // For JSON requests, return a presigned URL (old behavior)
      const body = await request.json()
      const { fileName, fileSize, contentType, category: cat } = body

      if (!fileName || fileSize == null || !contentType) {
        return NextResponse.json(
          { error: "Missing required fields: fileName, fileSize, contentType." },
          { status: 400 },
        )
      }
      if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
        return NextResponse.json(
          { error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." },
          { status: 400 },
        )
      }
      if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
      }
      if (!cat || !(VALID_CATEGORIES as readonly string[]).includes(cat)) {
        return NextResponse.json({ error: "Invalid upload category." }, { status: 400 })
      }

      // Server-side upload via presigned URL (fallback)
      const { generatePresignedPutUrl } = await import("@/lib/r2")
      const safeName = sanitizeFileName(fileName)
      const ext = extractExtension(safeName, contentType)
      const objectKey = `${cat}/${auth.user.id}/${crypto.randomUUID()}.${ext}`
      const uploadUrl = await generatePresignedPutUrl(objectKey, contentType)
      return NextResponse.json({ uploadUrl, objectKey })
    }

    // 3. Validate file
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

    // 4. Generate object key
    const safeName = sanitizeFileName(file.name)
    const ext = extractExtension(safeName, file.type)
    const objectKey = `${category}/${auth.user.id}/${crypto.randomUUID()}.${ext}`

    // 5. Upload to R2 server-side (no CORS, no presigned URL exposed)
    const buffer = new Uint8Array(await file.arrayBuffer())
    await uploadToR2(objectKey, buffer, file.type)

    return NextResponse.json({ objectKey })
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 },
    )
  }
}
