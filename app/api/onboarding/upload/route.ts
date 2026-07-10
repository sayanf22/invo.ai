/**
 * POST /api/onboarding/upload  (public, token-keyed, multipart)
 *
 * Lets the client attach files (logo / brand assets) while filling a form. No
 * auth — validated by the form token. Files go to Cloudflare R2 under a
 * form-scoped key; metadata is recorded in onboarding_files. Gated by the
 * form's `allow_uploads` snapshot. OWASP: magic-byte + size + type validation.
 *
 * GET /api/onboarding/upload?token=...&fileId=...  (public, token-keyed)
 *
 * Lets the CLIENT re-download a file they previously uploaded (e.g. after
 * closing and reopening the tab, or from the post-submit preview screen).
 * Mirrors the owner-side download in /api/onboarding/files but is gated by
 * the form token instead of authenticated ownership — a file can only be
 * downloaded if it belongs to the SAME form the token resolves to.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { uploadToR2, getObject } from "@/lib/r2"
import { sanitizeFileName } from "@/lib/sanitize"
import { ONBOARD_TOKEN_REGEX, MAX_FILES_PER_FORM } from "@/lib/onboarding-fields"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const dynamic = "force-dynamic"
export const maxDuration = 60

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf",
}
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38, 0x37], [0x47, 0x49, 0x46, 0x38, 0x39]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
}
function validateMagicBytes(buffer: ArrayBuffer, contentType: string): boolean {
  const sigs = MAGIC_BYTES[contentType]
  if (!sigs) return false
  const bytes = new Uint8Array(buffer.slice(0, 8))
  return sigs.some((sig) => sig.every((b, i) => bytes[i] === b))
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const token = formData.get("token") as string | null
    const fieldId = (formData.get("fieldId") as string | null) || ""
    const file = formData.get("file") as File | null

    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    }
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 })
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF or image." }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
    }

    const admin = serviceClient()
    const { data: form, error } = await admin
      .from("onboarding_forms")
      .select("id, user_id, status, allow_uploads, expires_at")
      .eq("token", token)
      .single()

    if (error || !form) return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    if (!form.allow_uploads) return NextResponse.json({ error: "File uploads are not enabled for this form." }, { status: 403 })
    if (form.status === "submitted") return NextResponse.json({ error: "This form has already been submitted." }, { status: 409 })
    if (form.status === "expired") return NextResponse.json({ error: "This form link is no longer active." }, { status: 410 })
    if (form.expires_at && new Date(form.expires_at) < new Date()) {
      return NextResponse.json({ error: "This form link has expired." }, { status: 410 })
    }

    // Enforce the per-form file cap.
    const { count } = await admin
      .from("onboarding_files")
      .select("id", { count: "exact", head: true })
      .eq("form_id", form.id)
    if ((count ?? 0) >= MAX_FILES_PER_FORM) {
      return NextResponse.json({ error: `You can upload up to ${MAX_FILES_PER_FORM} files.` }, { status: 409 })
    }

    const arrayBuffer = await file.arrayBuffer()
    if (!validateMagicBytes(arrayBuffer, file.type)) {
      return NextResponse.json({ error: "File content does not match its declared type." }, { status: 400 })
    }

    const safeName = sanitizeFileName(file.name)
    const dot = safeName.lastIndexOf(".")
    const ext = dot !== -1 ? safeName.slice(dot + 1).toLowerCase() : (MIME_TO_EXT[file.type] ?? "bin")
    const objectKey = `uploads/onboarding/${form.id}/${crypto.randomUUID()}.${ext}`

    await uploadToR2(objectKey, arrayBuffer, file.type)

    const { data: row, error: insertErr } = await admin.from("onboarding_files").insert({
      form_id: form.id,
      user_id: form.user_id,
      field_id: fieldId.slice(0, 64),
      file_key: objectKey,
      file_name: safeName,
      mime_type: file.type,
      file_size: file.size,
    }).select("id").single()

    if (insertErr || !row) {
      console.error("[onboarding] file row insert failed:", insertErr?.message)
      return NextResponse.json({ error: "Could not save the file. Please try again." }, { status: 500 })
    }

    return NextResponse.json({ success: true, fileId: row.id, fileName: safeName })
  } catch (error) {
    console.error("Onboarding upload error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}

// ── GET: client re-downloads a file they uploaded, gated by form token ──────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    const fileId = searchParams.get("fileId")

    if (!token || !ONBOARD_TOKEN_REGEX.test(token)) {
      return NextResponse.json({ error: "Invalid form link." }, { status: 404 })
    }
    if (!fileId || !UUID_RE.test(fileId)) {
      return NextResponse.json({ error: "Invalid file id." }, { status: 400 })
    }

    const admin = serviceClient()
    const { data: form } = await admin
      .from("onboarding_forms")
      .select("id")
      .eq("token", token)
      .single()
    if (!form) return NextResponse.json({ error: "Invalid form link." }, { status: 404 })

    // Ownership scoped to THIS form — a token can only ever fetch files that
    // belong to the same form it resolves to.
    const { data: file } = await admin
      .from("onboarding_files")
      .select("file_key, file_name, mime_type")
      .eq("id", fileId)
      .eq("form_id", form.id)
      .single()
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 })

    const obj = await getObject(file.file_key)
    if (!obj) return NextResponse.json({ error: "File is no longer available." }, { status: 404 })

    const safeName = String(file.file_name || "download").replace(/[^\w.\- ]/g, "_").slice(0, 200)
    return new Response(obj.body, {
      headers: {
        "Content-Type": file.mime_type || obj.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    console.error("Onboarding client file download error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Download failed." }, { status: 500 })
  }
}
