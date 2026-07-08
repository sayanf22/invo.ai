/**
 * Context RAG Module
 *
 * On-demand retrieval of a user's uploaded REFERENCE documents (previous
 * contracts, invoices, proposals, letterheads) so the AI can mirror how the
 * user writes their documents.
 *
 * Design principle (adaptive / conditional retrieval — 2025 best practice):
 * DO NOT inject reference material on every call. Retrieve only when the user's
 * message actually needs it:
 *   • Explicit reference intent  ("like my last contract", "use my template",
 *     "same format as before", "match my style")            → RETRIEVE
 *   • Fresh document generation  ("create/draft a contract") → RETRIEVE
 *     (style matters most when writing from scratch)
 *   • Small edits / questions    ("change the date", "what's the total?")
 *                                                            → SKIP
 *
 * Scoped to the owning user + document chain so a linked
 * invoice → contract → proposal chain shares the same uploaded references.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateEmbedding } from "./embeddings"

type AnySupabaseClient = SupabaseClient<any>

/**
 * Validates a value is a UUID. Used to sanitize identifiers before they are
 * interpolated into PostgREST `.or()` filter strings (prevents filter
 * injection via a crafted sessionId/chainId).
 */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

// ── Budget ──────────────────────────────────────────────────────────────────
// Total stored reference tokens allowed per chain. Past this, uploads are
// blocked: too much reference material dilutes retrieval and risks the model
// drifting/hallucinating instead of following the user's real documents.
export const MAX_CONTEXT_TOKENS = 40_000
/** Per-file cap so one giant file can't consume the whole budget. */
export const MAX_FILE_TOKENS = 15_000
/** Max number of reference documents per chain (upload count limit). */
export const MAX_CONTEXT_DOCS = 10
/** Max chunks injected into a single generation call. */
const MAX_RETRIEVED_CHUNKS = 6
const MATCH_THRESHOLD = 0.2

// ── Retrieval intent classification ───────────────────────────────────────

/** Phrases that signal the user explicitly wants their reference material. */
const REFERENCE_INTENT = [
  /\b(like|same as|as in|based on|according to)\b.*\b(before|previous|last|prior|earlier|old|usual|past)\b/i,
  /\b(my|our)\s+(usual|standard|typical|previous|last|old|normal|regular)\b/i,
  /\bhow (i|we) (usually|normally|typically|always)\b/i,
  /\b(reference|template|format|style|wording|structure|layout|tone)\b/i,
  /\b(uploaded|attachment|attached|the (document|file|contract|invoice|proposal))\b.*\b(i|we)\b/i,
  /\bmatch (my|our|the)\b/i,
  /\b(follow|use|copy|replicate|mirror|mimic)\b.*\b(my|our|the)\b.*\b(format|style|template|wording|structure|document|contract|invoice)\b/i,
  /\blike (i|we) did\b/i,
]

/** Verbs that indicate creating a brand-new document (style matters). */
const GENERATION_INTENT = [
  /\b(create|generate|make|build|draft|prepare|write|compose|produce)\b.*\b(invoice|contract|quote|quotation|proposal|agreement|sow|nda|document|letter|statement)\b/i,
  /\b(new|another)\s+(invoice|contract|quote|quotation|proposal|agreement|sow|nda|document)\b/i,
]

/** Signals of a small edit / question that should NOT trigger retrieval. */
const SMALL_EDIT_INTENT = [
  /\b(change|update|edit|fix|correct|set|adjust|modify|rename|replace|remove|delete|add)\b.*\b(date|due|number|rate|price|amount|quantity|qty|tax|discount|item|line|email|phone|address|name|title|currency|term|note)\b/i,
  /\b(typo|spelling|format the|make it (bold|bigger|smaller))\b/i,
  /^\s*(what|how much|when|who|why|is|are|does|do|can|show|tell)\b/i, // questions
]

export interface RetrievalDecision {
  retrieve: boolean
  reason: "reference_intent" | "generation" | "small_edit" | "question" | "no_signal"
}

/**
 * Decides whether the user's message warrants retrieving their reference docs.
 *
 * @param message              The user's prompt (sanitized).
 * @param hasExistingDocument  Whether the session already holds a generated doc.
 */
export function classifyRetrievalIntent(
  message: string,
  hasExistingDocument: boolean
): RetrievalDecision {
  const msg = (message || "").trim()
  if (!msg) return { retrieve: false, reason: "no_signal" }

  // 1. Explicit reference intent always wins.
  if (REFERENCE_INTENT.some((re) => re.test(msg))) {
    return { retrieve: true, reason: "reference_intent" }
  }

  // 2. Fresh generation → retrieve to apply the user's style from the start.
  //    (Only meaningful when there isn't already a document being edited.)
  if (!hasExistingDocument && GENERATION_INTENT.some((re) => re.test(msg))) {
    return { retrieve: true, reason: "generation" }
  }

  // 3. Small edits / questions → skip retrieval.
  if (SMALL_EDIT_INTENT.some((re) => re.test(msg))) {
    return {
      retrieve: false,
      reason: /^\s*(what|how|when|who|why|is|are|does|do|can|show|tell)\b/i.test(msg)
        ? "question"
        : "small_edit",
    }
  }

  // 4. No clear signal: retrieve only for a first-time generation, otherwise skip.
  if (!hasExistingDocument) return { retrieve: true, reason: "generation" }
  return { retrieve: false, reason: "no_signal" }
}

// ── Retrieval ─────────────────────────────────────────────────────────────

export interface ReferenceChunk {
  id: string
  fileName: string
  content: string
  similarity: number
}

export interface ReferenceContext {
  retrieved: boolean
  chunks: ReferenceChunk[]
  formattedContext: string
  sourceFiles: string[]
}

const EMPTY_CONTEXT: ReferenceContext = {
  retrieved: false,
  chunks: [],
  formattedContext: "",
  sourceFiles: [],
}

/**
 * Retrieves the most relevant reference chunks for a query and formats them for
 * prompt injection. Never throws — returns EMPTY_CONTEXT on any error.
 */
export async function getReferenceContext(
  supabase: AnySupabaseClient,
  opts: {
    userId: string
    chainId?: string | null
    sessionId?: string | null
    query: string
    documentType?: string
  }
): Promise<ReferenceContext> {
  try {
    const embedding = await generateEmbedding(opts.query)
    if (!embedding) return EMPTY_CONTEXT

    const { data, error } = await supabase.rpc("match_context_chunks", {
      query_embedding: embedding as any,
      match_user_id: opts.userId,
      match_chain_id: opts.chainId ?? null,
      match_session_id: opts.sessionId ?? null,
      match_threshold: MATCH_THRESHOLD,
      match_count: MAX_RETRIEVED_CHUNKS,
    })

    if (error) {
      console.error("Context retrieval failed:", error.message)
      return EMPTY_CONTEXT
    }
    if (!data || data.length === 0) return EMPTY_CONTEXT

    const chunks: ReferenceChunk[] = data.map((row: any) => ({
      id: row.id,
      fileName: row.file_name,
      content: row.content,
      similarity: row.similarity,
    }))

    return {
      retrieved: true,
      chunks,
      formattedContext: formatReferenceContext(chunks, opts.documentType),
      sourceFiles: [...new Set(chunks.map((c) => c.fileName))],
    }
  } catch (err: any) {
    console.error("getReferenceContext error:", err?.message)
    return EMPTY_CONTEXT
  }
}

/**
 * Formats retrieved chunks into a prompt block. Instructs the AI to MIRROR the
 * user's structure/wording/tone from their real documents while still using the
 * current request's actual data — and NOT to copy client-specific values or
 * invent content.
 */
export function formatReferenceContext(chunks: ReferenceChunk[], documentType?: string): string {
  if (!chunks || chunks.length === 0) return ""

  const grouped = new Map<string, string[]>()
  for (const c of chunks) {
    const arr = grouped.get(c.fileName) ?? []
    arr.push(c.content)
    grouped.set(c.fileName, arr)
  }

  let block = `REFERENCE DOCUMENTS (the user's own previous ${documentType || "documents"} — retrieved because this request relates to how they write):\n`
  block += `Use these ONLY to match the user's structure, section ordering, wording, clause style, tone, and formatting conventions. `
  block += `Do NOT copy client names, dates, amounts, or other specifics from them — use the actual data for THIS request. `
  block += `If a passage does not apply to the current request, ignore it. Never invent details that are absent from both the reference and the current request.\n`

  for (const [fileName, contents] of grouped.entries()) {
    block += `\n--- From "${fileName}" ---\n`
    block += contents.join("\n…\n")
    block += "\n"
  }

  return block.trim()
}

// ── Budget helpers ──────────────────────────────────────────────────────────

export interface ContextUsage {
  usedTokens: number
  maxTokens: number
  fillPercent: number
  isFull: boolean
  documentCount: number
  maxDocuments: number
  /** True when either the token budget OR the document-count limit is reached. */
  isAtLimit: boolean
}

/**
 * Computes stored reference-token usage for a chain (or session when the
 * document is not part of a chain). Used for the fill bar + upload gating.
 */
export async function getContextUsage(
  supabase: AnySupabaseClient,
  opts: { userId: string; chainId?: string | null; sessionId?: string | null }
): Promise<ContextUsage> {
  const base = supabase
    .from("context_documents")
    .select("token_count", { count: "exact" })
    .eq("user_id", opts.userId)
    .neq("status", "failed")

  // Only interpolate identifiers into an .or() filter when they are UUIDs —
  // guards against PostgREST filter injection. Non-UUID values fall back to a
  // single parameterized .eq() (safe) or are ignored.
  const safeChain = isUuid(opts.chainId) ? opts.chainId : null
  const safeSession = isUuid(opts.sessionId) ? opts.sessionId : null

  let query = base
  if (safeChain) {
    // Include context whose originating session belongs to the chain (covers
    // context uploaded before the document was linked — chain_id still NULL on
    // those rows). Session ids come from the DB, so they are safe UUIDs.
    const { data: chainSessions } = await supabase
      .from("document_sessions")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("chain_id", safeChain)
    const sessionIds = (chainSessions ?? [])
      .map((s: any) => s.id)
      .filter((id: unknown) => isUuid(id))
    if (safeSession && !sessionIds.includes(safeSession)) sessionIds.push(safeSession)

    query = sessionIds.length > 0
      ? base.or(`chain_id.eq.${safeChain},session_id.in.(${sessionIds.join(",")})`)
      : base.eq("chain_id", safeChain)
  } else if (safeSession) {
    query = base.eq("session_id", safeSession)
  }

  const { data, error, count } = await query
  if (error) {
    console.error("getContextUsage failed:", error.message)
    return {
      usedTokens: 0, maxTokens: MAX_CONTEXT_TOKENS, fillPercent: 0,
      isFull: false, documentCount: 0, maxDocuments: MAX_CONTEXT_DOCS, isAtLimit: false,
    }
  }

  const usedTokens = (data ?? []).reduce((sum: number, r: any) => sum + (r.token_count || 0), 0)
  const fillPercent = Math.min(100, Math.round((usedTokens / MAX_CONTEXT_TOKENS) * 100))
  const documentCount = count ?? (data ?? []).length
  const isFull = usedTokens >= MAX_CONTEXT_TOKENS
  const isDocLimitReached = documentCount >= MAX_CONTEXT_DOCS

  return {
    usedTokens,
    maxTokens: MAX_CONTEXT_TOKENS,
    fillPercent,
    isFull,
    documentCount,
    maxDocuments: MAX_CONTEXT_DOCS,
    isAtLimit: isFull || isDocLimitReached,
  }
}
