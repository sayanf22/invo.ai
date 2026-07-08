/**
 * POST /api/context/upload
 *
 * Uploads a REFERENCE document (previous contract/invoice/proposal, letterhead,
 * etc.) that the AI later retrieves on-demand to mirror how the user writes.
 *
 * Pipeline: validate → magic-byte check → budget check → store in R2 →
 * extract full text (OpenAI vision) → chunk → embed → persist chunks.
 *
 * SECURITY:
 * - Origin + auth + CSRF validation (state-changing, calls paid OpenAI APIs)
 * - Per-user rate limit (file_analysis category — tight cap, expensive)
 * - Tier cost limit
 * - 10MB size cap, image/PDF whitelist, magic-byte content validation
 * - Per-chain token budget (rejects when full → prevents context dilution)
 * - RLS-scoped inserts (user_id = authenticated user)
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { checkCostLimit, getUserTier, trackUsage } from "@/lib/cost-protection"
import { uploadToR2, deleteObject } from "@/lib/r2"
import { sanitizeFileName } from "@/lib/sanitize"
import { extractDocumentText } from "@/lib/context-extraction"
import { chunkText, estimateTokens } from "@/lib/text-chunker"
import { generateEmbeddings } from "@/lib/embeddings"
import { getContextUsage, isUuid, MAX_CONTEXT_TOKENS, MAX_FILE_TOKENS } from "@/lib/context-rag"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "image/gif": "gif", "application/pdf": "pdf",
}

// Magic-byte signatures (OWASP File Upload — don't trust Content-Type alone).
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "image/gif": [[0x47, 0x49, 0x46, 0x38, 0x37], [0x47, 0x49, 0x46, 0x38, 0x39]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]],
}

function validateMagicBytes(buffer: ArrayBuffer, contentType: string): boolean {
  const signatures = MAGIC_BYTES[contentType]
  if (!signatures) return false
  const bytes = new Uint8Array(buffer.slice(0, 8))
  return signatures.some((sig) => sig.every((byte, i) => bytes[i] === byte))
}

export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase as never)
  if (csrfError) return csrfError

  // Expensive (OpenAI vision + embeddings) → reuse the tight file_analysis cap.
  const rateLimitError = await checkRateLimit(auth.user.id, "file_analysis", auth.supabase as never)
  if (rateLimitError) return rateLimitError

  const userTier = await getUserTier(auth.supabase, auth.user.id)

  // Reference context is a Pro-and-above feature (server-enforced).
  if (userTier !== "pro" && userTier !== "agency") {
    return NextResponse.json(
      { error: "Reference context is available on the Pro plan. Upgrade to use it." },
      { status: 403 },
    )
  }

  const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation", userTier)
  if (costError) return costError

  let uploadedKey: string | null = null

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    // Validate identifiers as UUIDs before they touch any .or() filter.
    const rawSession = formData.get("sessionId") as string | null
    const rawChain = formData.get("chainId") as string | null
    const sessionId = isUuid(rawSession) ? rawSession : null
    let chainId = isUuid(rawChain) ? rawChain : null

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }
    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: "Unsupported file type. Upload a PDF or image." }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 10MB." }, { status: 400 })
    }

    // Resolve chain_id from the session so context is shared across linked docs.
    if (sessionId && !chainId) {
      const { data: session } = await auth.supabase
        .from("document_sessions")
        .select("chain_id")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .single()
      chainId = (session as any)?.chain_id ?? null
    }

    // Budget gate — refuse when the chain's context store is full.
    const usage = await getContextUsage(auth.supabase, {
      userId: auth.user.id,
      chainId,
      sessionId,
    })
    if (usage.documentCount >= usage.maxDocuments) {
      return NextResponse.json(
        { error: `You can attach up to ${usage.maxDocuments} reference documents. Remove one before uploading more.`, usage },
        { status: 409 },
      )
    }
    if (usage.isFull) {
      return NextResponse.json(
        { error: "Context is full. Remove a reference document before uploading more.", usage },
        { status: 409 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    if (!validateMagicBytes(arrayBuffer, file.type)) {
      return NextResponse.json({ error: "File content does not match its declared type." }, { status: 400 })
    }

    // Store in R2 under the shared "uploads" category.
    const safeName = sanitizeFileName(file.name)
    const dotIndex = safeName.lastIndexOf(".")
    const ext = dotIndex !== -1 ? safeName.slice(dotIndex + 1).toLowerCase() : (MIME_TO_EXT[file.type] ?? "bin")
    const objectKey = `uploads/${auth.user.id}/${crypto.randomUUID()}.${ext}`
    await uploadToR2(objectKey, arrayBuffer, file.type)
    uploadedKey = objectKey

    // Create the parent row (processing) so a failure is still visible/cleanable.
    // Cast to any: context_documents/context_chunks aren't in generated types yet
    // (same pattern as compliance_knowledge).
    const db = auth.supabase as any
    const { data: docRow, error: insertErr } = await db
      .from("context_documents")
      .insert({
        user_id: auth.user.id,
        chain_id: chainId,
        session_id: sessionId,
        file_key: objectKey,
        file_name: safeName,
        mime_type: file.type,
        file_size: file.size,
        status: "processing",
      } as any)
      .select("id")
      .single()

    if (insertErr || !docRow) {
      await deleteObject(objectKey).catch(() => {})
      console.error("context_documents insert failed:", insertErr?.message)
      return NextResponse.json({ error: "Could not save the document. Please try again." }, { status: 500 })
    }
    const contextDocId = (docRow as any).id as string

    // Extract full text.
    const extraction = await extractDocumentText(arrayBuffer, file.type, safeName)
    if (extraction.error || !extraction.text) {
      await markFailed(auth.supabase, contextDocId, extraction.error || "empty")
      return NextResponse.json(
        { error: "Could not read this document. Try a clearer file or a different format." },
        { status: 422 },
      )
    }

    // Enforce per-file + remaining-budget token caps (truncate to fit).
    let text = extraction.text
    let tokenCount = estimateTokens(text)
    const remaining = Math.max(0, MAX_CONTEXT_TOKENS - usage.usedTokens)
    const allowedTokens = Math.min(MAX_FILE_TOKENS, remaining)
    if (tokenCount > allowedTokens) {
      text = text.slice(0, allowedTokens * 4)
      tokenCount = estimateTokens(text)
    }

    // Chunk + embed.
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      await markFailed(auth.supabase, contextDocId, "no_chunks")
      return NextResponse.json({ error: "Document appears to be empty." }, { status: 422 })
    }

    const { embeddings, error: embedErr } = await generateEmbeddings(chunks.map((c) => c.content))
    if (embedErr || embeddings.length !== chunks.length) {
      await markFailed(auth.supabase, contextDocId, embedErr || "embed_count_mismatch")
      return NextResponse.json(
        { error: "Could not process the document right now. Please try again." },
        { status: 502 },
      )
    }

    const chunkRows = chunks.map((c, i) => ({
      context_document_id: contextDocId,
      user_id: auth.user.id,
      chain_id: chainId,
      session_id: sessionId,
      chunk_index: c.index,
      content: c.content,
      token_count: c.tokenCount,
      embedding: embeddings[i] as any,
    }))

    const { error: chunkErr } = await db.from("context_chunks").insert(chunkRows as any)
    if (chunkErr) {
      await markFailed(auth.supabase, contextDocId, chunkErr.message)
      console.error("context_chunks insert failed:", chunkErr.message)
      return NextResponse.json({ error: "Could not save document chunks. Please try again." }, { status: 500 })
    }

    // Finalize.
    await db
      .from("context_documents")
      .update({
        status: "ready",
        extracted_text: text,
        token_count: tokenCount,
        chunk_count: chunks.length,
      } as any)
      .eq("id", contextDocId)

    await trackUsage(auth.supabase, auth.user.id, "embedding", chunks.length * 100)

    const newUsage = await getContextUsage(auth.supabase, {
      userId: auth.user.id,
      chainId,
      sessionId,
    })

    return NextResponse.json({
      success: true,
      document: {
        id: contextDocId,
        fileName: safeName,
        mimeType: file.type,
        fileSize: file.size,
        tokenCount,
        chunkCount: chunks.length,
        status: "ready",
      },
      usage: newUsage,
    })
  } catch (error) {
    if (uploadedKey) await deleteObject(uploadedKey).catch(() => {})
    console.error("Context upload error:", error instanceof Error ? `${error.message}\n${error.stack}` : error)
    return NextResponse.json({ error: "Failed to process the document. Please try again." }, { status: 500 })
  }
}

async function markFailed(supabase: any, id: string, reason: string): Promise<void> {
  try {
    await supabase
      .from("context_documents")
      .update({ status: "failed", error_message: String(reason).slice(0, 500) })
      .eq("id", id)
  } catch { /* best-effort */ }
}
