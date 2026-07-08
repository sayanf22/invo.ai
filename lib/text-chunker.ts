/**
 * Text Chunker
 *
 * Splits extracted document text into overlapping, retrieval-friendly chunks
 * for embedding. Based on 2025/2026 RAG best practice: recursive, structure-
 * aware splitting at ~500 tokens with ~15% overlap. Splitting prefers natural
 * boundaries (paragraphs → sentences → words) so a chunk rarely cuts through a
 * clause — this preserves the phrasing/structure the AI needs to mirror a
 * user's writing style.
 */

/** Rough token estimate: ~4 characters per token (matches compliance-rag). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export interface TextChunk {
  index: number
  content: string
  tokenCount: number
}

const DEFAULT_CHUNK_TOKENS = 500
const DEFAULT_OVERLAP_TOKENS = 75 // ~15%
const CHARS_PER_TOKEN = 4

/**
 * Splits `text` into overlapping chunks.
 *
 * @param text            The full document text.
 * @param chunkTokens     Target chunk size in tokens (default 500).
 * @param overlapTokens   Overlap between consecutive chunks in tokens (default 75).
 */
export function chunkText(
  text: string,
  chunkTokens: number = DEFAULT_CHUNK_TOKENS,
  overlapTokens: number = DEFAULT_OVERLAP_TOKENS
): TextChunk[] {
  const clean = (text || "").replace(/\r\n/g, "\n").trim()
  if (!clean) return []

  const maxChars = chunkTokens * CHARS_PER_TOKEN
  const overlapChars = Math.min(overlapTokens * CHARS_PER_TOKEN, Math.floor(maxChars / 2))

  // 1. Split into paragraph-level units (preserve headings/structure).
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  // 2. Greedily pack paragraphs into chunks up to maxChars. Paragraphs larger
  //    than a chunk are hard-split on sentence then word boundaries.
  const rawChunks: string[] = []
  let current = ""

  const flush = () => {
    if (current.trim()) rawChunks.push(current.trim())
    current = ""
  }

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      // Paragraph too big — flush current, then hard-split the paragraph.
      flush()
      for (const piece of hardSplit(para, maxChars)) rawChunks.push(piece)
      continue
    }
    if (current.length + para.length + 2 > maxChars) {
      flush()
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  flush()

  // 3. Apply overlap: prepend the tail of the previous chunk to each chunk.
  const withOverlap: string[] = []
  for (let i = 0; i < rawChunks.length; i++) {
    if (i === 0 || overlapChars <= 0) {
      withOverlap.push(rawChunks[i])
      continue
    }
    const prev = rawChunks[i - 1]
    const tail = prev.slice(Math.max(0, prev.length - overlapChars))
    withOverlap.push(`${tail}\n\n${rawChunks[i]}`.slice(0, maxChars + overlapChars))
  }

  return withOverlap.map((content, index) => ({
    index,
    content,
    tokenCount: estimateTokens(content),
  }))
}

/** Hard-splits an oversized block on sentence, then word boundaries. */
function hardSplit(block: string, maxChars: number): string[] {
  const sentences = block.split(/(?<=[.!?])\s+/)
  const out: string[] = []
  let cur = ""
  for (const s of sentences) {
    if (s.length > maxChars) {
      if (cur.trim()) { out.push(cur.trim()); cur = "" }
      // Split very long sentence on words.
      const words = s.split(/\s+/)
      for (const w of words) {
        if (cur.length + w.length + 1 > maxChars) {
          if (cur.trim()) out.push(cur.trim())
          cur = w
        } else {
          cur = cur ? `${cur} ${w}` : w
        }
      }
      continue
    }
    if (cur.length + s.length + 1 > maxChars) {
      if (cur.trim()) out.push(cur.trim())
      cur = s
    } else {
      cur = cur ? `${cur} ${s}` : s
    }
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}
