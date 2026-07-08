/**
 * Context Extraction
 *
 * Extracts the FULL faithful text of an uploaded reference document (PDF or
 * image) using OpenAI's vision model. Unlike `/api/ai/analyze-file` — which
 * pulls out *structured business fields* — this returns the document's complete
 * text/markdown so the RAG can later learn the user's phrasing, clause
 * structure, tone, and formatting.
 *
 * The OpenAI key is fetched from Vault via getSecret. Never throws — returns
 * `{ text: "", error }` on failure so the upload route can mark the document
 * as failed without crashing.
 */

import { getSecret } from "./secrets"

const EXTRACTION_MODEL = "gpt-5.4-mini"
const REQUEST_TIMEOUT_MS = 55_000
/** Cap extracted text so a single huge file can't blow the context budget. */
const MAX_EXTRACTED_CHARS = 120_000

const EXTRACTION_PROMPT = `You are a document transcription engine. Transcribe the attached document into clean, faithful Markdown text.

RULES:
- Reproduce ALL text content exactly as written — headings, paragraphs, clauses, line items, tables, terms, notes, and signatures.
- Preserve the document's STRUCTURE using Markdown: use # / ## for headings, "-" for lists, and Markdown tables for tabular data.
- Keep the original wording, tone, and phrasing verbatim. Do NOT summarize, paraphrase, correct, or add commentary.
- Do NOT invent content that is not in the document.
- If a section is a table (e.g. line items with quantities and prices), render it as a Markdown table.
- Output ONLY the transcribed Markdown. No preamble, no explanation, no code fences.`

export interface ExtractionResult {
  text: string
  error?: string
}

/**
 * Extracts full text from a PDF or image buffer.
 *
 * @param buffer     The file contents.
 * @param mimeType   One of image/png|jpeg|webp|gif or application/pdf.
 * @param fileName   Original file name (used for the PDF file part).
 */
export async function extractDocumentText(
  buffer: ArrayBuffer,
  mimeType: string,
  fileName: string
): Promise<ExtractionResult> {
  const apiKey = await getSecret("OPENAI_API_KEY")
  if (!apiKey) return { text: "", error: "missing_openai_key" }

  // Convert to base64 (chunked to avoid call-stack overflow on large files).
  const uint8 = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 8192
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8.slice(i, i + chunkSize))
  }
  const base64 = btoa(binary)
  const dataUrl = `data:${mimeType};base64,${base64}`

  const isImage = mimeType.startsWith("image/")
  const isPDF = mimeType === "application/pdf"

  let contentParts: any[]
  if (isImage) {
    contentParts = [
      { type: "text", text: EXTRACTION_PROMPT },
      { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
    ]
  } else if (isPDF) {
    contentParts = [
      { type: "text", text: EXTRACTION_PROMPT },
      { type: "file", file: { filename: fileName, file_data: dataUrl } },
    ]
  } else {
    return { text: "", error: "unsupported_type" }
  }

  let response: Response
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        messages: [{ role: "user", content: contentParts }],
        max_completion_tokens: 8000,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError"
    console.error("Context extraction fetch failed:", err?.name, err?.message)
    return { text: "", error: isTimeout ? "timeout" : "network_error" }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    console.error("Context extraction API error:", response.status, detail.slice(0, 300))
    return { text: "", error: `openai_${response.status}` }
  }

  const data = await response.json()
  let content: string = data.choices?.[0]?.message?.content || ""
  // Strip any stray code fences the model may add despite instructions.
  content = content.replace(/^```(?:markdown)?\n?/i, "").replace(/```$/i, "").trim()

  if (!content) return { text: "", error: "empty_extraction" }
  if (content.length > MAX_EXTRACTED_CHARS) content = content.slice(0, MAX_EXTRACTED_CHARS)

  return { text: content }
}
