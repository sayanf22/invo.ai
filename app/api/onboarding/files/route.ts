/**
 * GET /api/onboarding/files  (owner, authenticated)
 *
 * Two modes:
 *  - ?sessionId=<uuid>  → list the native-uploaded files for that form
 *  - ?fileId=<uuid>     → download a single file (streams bytes from R2)
 *
 * Ownership is enforced via RLS (onboarding_files.user_id = auth.uid()) AND an
 * explicit user_id filter. Files uploaded by clients live in R2; this is the
 * only way the owner retrieves them.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getObject } from "@/lib/r2"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const fileId = searchParams.get("fileId")
    const db = auth.supabase as any

    // ── Download mode ──────────────────────────────────────────────────────
    if (fileId) {
      if (!UUID_RE.test(fileId)) {
        return NextResponse.json({ error: "Invalid file id." }, { status: 400 })
      }
      const { data: file, error } = await db
        .from("onboarding_files")
        .select("file_key, file_name, mime_type")
        .eq("id", fileId)
        .eq("user_id", auth.user.id)
        .single()

      if (error || !file) {
        return NextResponse.json({ error: "File not found." }, { status: 404 })
      }

      const obj = await getObject(file.file_key)
      if (!obj) {
        return NextResponse.json({ error: "File is no longer available." }, { status: 404 })
      }

      // Sanitize the filename for the Content-Disposition header.
      const safeName = String(file.file_name || "download").replace(/[^\w.\- ]/g, "_").slice(0, 200)
      return new Response(obj.body, {
        headers: {
          "Content-Type": file.mime_type || obj.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Cache-Control": "private, no-store",
        },
      })
    }

    // ── List mode ──────────────────────────────────────────────────────────
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json({ error: "Invalid session id." }, { status: 400 })
    }

    const { data: form } = await db
      .from("onboarding_forms")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!form) return NextResponse.json({ files: [] })

    const { data: files } = await db
      .from("onboarding_files")
      .select("id, file_name, mime_type, file_size, created_at")
      .eq("form_id", form.id)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: true })

    return NextResponse.json({
      files: (files ?? []).map((f: any) => ({
        id: f.id,
        fileName: f.file_name,
        mimeType: f.mime_type,
        fileSize: f.file_size,
      })),
    })
  } catch (error) {
    console.error("onboarding files error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not load files." }, { status: 500 })
  }
}
