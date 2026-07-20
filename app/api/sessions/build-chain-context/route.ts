/**
 * Build Chain Context API
 *
 * Computes the rolling context brief for a linked document by folding the
 * immediate parent's own content + conversation into the rolling brief the
 * parent already carried. Reads ONLY the immediate parent (cheap + cumulative),
 * stores the result on this session's context so the generation step and all
 * future links in the chain can reuse it.
 *
 * Always succeeds with a usable brief (the summarizer degrades to a
 * deterministic fact-only brief if every model is unavailable).
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { summarizeChainContext } from "@/lib/chain-summary"
import { normalizeDocumentType } from "@/lib/document-type-registry"

export const dynamic = "force-dynamic"
// Kimi (primary) is capped at 20s; Claude (optional upgrade, tried only if
// Kimi fails) and DeepSeek (final fallback) each add at most ~20s more. 90s
// comfortably covers the worst case without the multi-minute waits the old
// Claude-first ordering could cause.
export const maxDuration = 90

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase as never)
    if (csrfError) return csrfError

    const body = await request.json()
    const sizeError = validateBodySize(body, 4 * 1024)
    if (sizeError) return sizeError

    const sessionId = (body as { sessionId?: string }).sessionId
    if (!sessionId || !UUID_RE.test(sessionId)) {
      return NextResponse.json({ success: false, error: "A valid sessionId is required." }, { status: 400 })
    }

    // Load the child (new) session — owner-scoped.
    const { data: child, error: childErr } = await auth.supabase
      .from("document_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (childErr || !child) {
      return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 })
    }

    const childContext = (child.context && typeof child.context === "object" && !Array.isArray(child.context))
      ? child.context as Record<string, any>
      : {}
    const existingChain = (childContext._chainContext && typeof childContext._chainContext === "object")
      ? childContext._chainContext as Record<string, any>
      : {}

    // Idempotent: if the brief is already built, return it without recomputing.
    if (typeof existingChain.summary === "string" && existingChain.summary.trim()) {
      return NextResponse.json(
        { success: true, summary: existingChain.summary, reused: true },
        { headers: { "Cache-Control": "private, no-store" } },
      )
    }

    // Find the immediate parent via the document_links record.
    const { data: link } = await auth.supabase
      .from("document_links")
      .select("parent_session_id")
      .eq("child_session_id", sessionId)
      .maybeSingle()

    const parentSessionId = link?.parent_session_id
    if (!parentSessionId) {
      // Not actually linked — nothing to build. Return empty (non-fatal).
      return NextResponse.json({ success: true, summary: "", noParent: true })
    }

    const { data: parent, error: parentErr } = await auth.supabase
      .from("document_sessions")
      .select("*")
      .eq("id", parentSessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle()

    if (parentErr || !parent) {
      return NextResponse.json({ success: true, summary: "", noParent: true })
    }

    const parentContext = (parent.context && typeof parent.context === "object" && !Array.isArray(parent.context))
      ? parent.context as Record<string, any>
      : {}

    // The rolling brief the parent already carried (covers everything BEFORE it).
    const parentChain = (parentContext._chainContext && typeof parentContext._chainContext === "object")
      ? parentContext._chainContext as Record<string, any>
      : {}
    const existingBrief = typeof parentChain.summary === "string" ? parentChain.summary : ""

    // The parent's conversation (the changes/decisions made while building it).
    const { data: parentMessages } = await auth.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", parentSessionId)
      .order("created_at", { ascending: true })

    const messages = Array.isArray(parentMessages)
      ? (parentMessages as Array<{ role: string; content: string }>).filter(
          (m) => typeof m?.content === "string" && m.content.trim(),
        )
      : []

    const parentType = normalizeDocumentType(parent.document_type) || (parent.document_type || "document").toLowerCase()
    const targetType = normalizeDocumentType(child.document_type) || (child.document_type || "document").toLowerCase()

    // Always returns a usable brief (never throws).
    const summary = await summarizeChainContext({
      parentType,
      targetType,
      parentContext,
      existingBrief,
      messages,
    })

    // Persist onto the child session's _chainContext.summary (merge, don't clobber).
    const mergedChain = { ...existingChain, summary }
    const mergedContext = { ...childContext, _chainContext: mergedChain }

    const { error: updateErr } = await auth.supabase
      .from("document_sessions")
      .update({ context: mergedContext as never, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)

    if (updateErr) {
      console.error("[build-chain-context] failed to persist summary:", updateErr.message)
      // Still return the summary so the client can use it for this generation.
    }

    return NextResponse.json(
      { success: true, summary },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[build-chain-context] error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 })
  }
}
