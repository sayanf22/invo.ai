/**
 * Embeddings Module
 *
 * Thin wrapper around OpenAI's `text-embedding-3-large` (1536 dimensions) used
 * for the context-document RAG. Mirrors the model + dimensions already used by
 * `lib/compliance-rag.ts` so both RAG systems share one vector space size and
 * one DB column type (vector(1536)).
 *
 * The OpenAI key is fetched from Supabase Vault via getSecret — never exposed
 * to the client.
 */

import { getSecret } from "./secrets"

export const EMBEDDING_MODEL = "text-embedding-3-large"
export const EMBEDDING_DIMENSIONS = 1536

/** OpenAI allows large batches, but we cap to stay well within request limits. */
const MAX_BATCH_SIZE = 96
const REQUEST_TIMEOUT_MS = 20_000

interface EmbedResult {
  embeddings: number[][]
  error?: string
}

/**
 * Generates embeddings for one or more input strings in a single API call
 * (batched). Returns embeddings in the same order as the inputs.
 *
 * Never throws — on any failure returns `{ embeddings: [], error }` so callers
 * can degrade gracefully.
 */
export async function generateEmbeddings(inputs: string[]): Promise<EmbedResult> {
  if (!inputs || inputs.length === 0) return { embeddings: [] }

  const apiKey = await getSecret("OPENAI_API_KEY")
  if (!apiKey) {
    return { embeddings: [], error: "missing_openai_key" }
  }

  const all: number[][] = []

  // Process in batches to avoid oversized requests.
  for (let i = 0; i < inputs.length; i += MAX_BATCH_SIZE) {
    const batch = inputs.slice(i, i + MAX_BATCH_SIZE)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        console.error("Embeddings API error:", response.status, detail.slice(0, 300))
        return { embeddings: [], error: `openai_${response.status}` }
      }

      const json = await response.json()
      // OpenAI returns data sorted by index, but sort defensively.
      const rows: Array<{ index: number; embedding: number[] }> = json.data ?? []
      rows.sort((a, b) => a.index - b.index)
      for (const row of rows) all.push(row.embedding)
    } catch (err: any) {
      clearTimeout(timeout)
      const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError"
      console.error("Embeddings fetch failed:", err?.name, err?.message)
      return { embeddings: [], error: isTimeout ? "timeout" : "network_error" }
    }
  }

  return { embeddings: all }
}

/**
 * Convenience helper for a single string. Returns the embedding or null.
 */
export async function generateEmbedding(input: string): Promise<number[] | null> {
  const { embeddings } = await generateEmbeddings([input])
  return embeddings[0] ?? null
}
