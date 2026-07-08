/**
 * GET /api/context/list?sessionId=&chainId=
 *
 * Returns the reference documents visible to the current document (scoped to
 * the chain when the document is linked, otherwise to the session) plus the
 * context-fill usage for the fill bar.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getContextUsage, isUuid } from "@/lib/context-rag"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    // Validate identifiers as UUIDs before they touch any .or() filter.
    const rawSession = searchParams.get("sessionId")
    const rawChain = searchParams.get("chainId")
    const sessionId = isUuid(rawSession) ? rawSession : null
    let chainId = isUuid(rawChain) ? rawChain : null

    // Resolve chain from session so linked docs share references.
    if (sessionId && !chainId) {
      const { data: session } = await auth.supabase
        .from("document_sessions")
        .select("chain_id")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .single()
      chainId = (session as any)?.chain_id ?? null
    }

    let query = (auth.supabase as any)
      .from("context_documents")
      .select("id, file_name, mime_type, file_size, token_count, chunk_count, status, error_message, created_at")
      .eq("user_id", auth.user.id)
      .neq("status", "failed")
      .order("created_at", { ascending: false })

    if (chainId) {
      query = sessionId
        ? query.or(`chain_id.eq.${chainId},session_id.eq.${sessionId}`)
        : query.eq("chain_id", chainId)
    } else if (sessionId) {
      query = query.eq("session_id", sessionId)
    }

    const { data, error } = await query
    if (error) {
      console.error("context list failed:", error.message)
      return NextResponse.json({ error: "Could not load reference documents." }, { status: 500 })
    }

    const usage = await getContextUsage(auth.supabase, { userId: auth.user.id, chainId, sessionId })

    const documents = (data ?? []).map((d: any) => ({
      id: d.id,
      fileName: d.file_name,
      mimeType: d.mime_type,
      fileSize: d.file_size,
      tokenCount: d.token_count,
      chunkCount: d.chunk_count,
      status: d.status,
      createdAt: d.created_at,
    }))

    return NextResponse.json({ documents, usage })
  } catch (error) {
    console.error("context list error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Could not load reference documents." }, { status: 500 })
  }
}
