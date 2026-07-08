/**
 * DELETE /api/context/[id]
 *
 * Removes a reference document: deletes its chunks (cascade), the parent row,
 * and the underlying R2 object. RLS ensures a user can only delete their own.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { deleteObject } from "@/lib/r2"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase as never)
  if (csrfError) return csrfError

  try {
    const { id } = await params
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid document id." }, { status: 400 })
    }

    // Fetch the row first (RLS-scoped) to get the R2 key.
    const db = auth.supabase as any
    const { data: doc, error: fetchErr } = await db
      .from("context_documents")
      .select("id, file_key")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .single()

    if (fetchErr || !doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 })
    }

    // Delete the DB row (context_chunks cascade via FK ON DELETE CASCADE).
    const { error: delErr } = await db
      .from("context_documents")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id)

    if (delErr) {
      console.error("context delete failed:", delErr.message)
      return NextResponse.json({ error: "Could not delete the document." }, { status: 500 })
    }

    // Best-effort R2 cleanup — never block the response on storage.
    const key = (doc as any).file_key
    if (key) await deleteObject(key).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("context delete error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not delete the document." }, { status: 500 })
  }
}
