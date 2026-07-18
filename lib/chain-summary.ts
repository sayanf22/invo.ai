/**
 * Rolling chain-context summarizer for linked documents.
 *
 * Maintains ONE compact, factual "rolling brief" that travels across a chain of
 * related documents for the same client. Each new linked document folds its
 * immediate parent's own content + conversation into the brief the parent
 * already carried — so the newest document knows the WHOLE chain's history
 * (including the very first document) while we only ever read the immediate
 * parent. Newer information overrides older on conflict, and the brief is
 * compressed when it grows so the model is never fed a massive wall of text.
 *
 * Reliability contract:
 *  - The summarizer tries thinking models in order: Claude Sonnet 5 →
 *    Claude Sonnet 4.6 → Kimi K2.5, then DeepSeek as a final safety net.
 *  - It never truncates a model mid-thought; it only moves to the next model
 *    when one genuinely fails or is unavailable.
 *  - It ALWAYS returns a usable brief. If every model is unavailable it returns
 *    a deterministic, fact-only brief built from the document fields, so the
 *    operation never hard-fails.
 */

const BEDROCK_MANTLE_URL = "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions"
const BEDROCK_RUNTIME_BASE = "https://bedrock-runtime.us-east-1.amazonaws.com/model"
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

// Generous ceiling that a normal summary never reaches — it exists only to stop
// a genuinely stuck socket from hanging forever (which would itself be an error).
const HARD_CEILING_MS = 110_000
const MAX_CONTEXT_JSON_CHARS = 9_000
const MAX_TRANSCRIPT_CHARS = 7_000
const MAX_EXISTING_BRIEF_CHARS = 6_000
const MAX_MESSAGES = 60
const MAX_OUTPUT_CHARS = 4_500

// Thinking model preference order. Claude ids auto-upgrade the moment the AWS
// account is authorized for them; until then the calls fail and we fall through
// to Kimi automatically.
const CLAUDE_MODELS = ["us.anthropic.claude-sonnet-5", "us.anthropic.claude-sonnet-4-6"]
const KIMI_MODEL = "moonshotai.kimi-k2.5"

const EXCLUDED_CONTEXT_FIELDS = new Set([
  "fromLogo", "showLogo", "logoShape", "logoSize",
  "senderSignatureDataUrl", "showSenderSignature",
  "recipientSignatureDataUrl", "showRecipientSignature",
  "signatureFields", "design",
  "paymentLink", "paymentLinkStatus", "showPaymentLinkInPdf",
  "_chainContext", "_chainSummary", "_parentDocumentType", "parent_document_id",
])

export interface ChainSummaryInput {
  /** Type of the immediate parent document (the doc we are linking FROM). */
  parentType: string
  /** Type of the new document being created. */
  targetType: string
  /** The immediate parent's finalized document context (its own content). */
  parentContext: Record<string, unknown>
  /** The rolling brief the parent already carried (covers everything BEFORE it). */
  existingBrief?: string | null
  /** The immediate parent's conversation, oldest → newest. */
  messages?: Array<{ role: string; content: string }>
}

function bedrockKey(): string {
  return (
    process.env.AWS_BEARER_TOKEN_BEDROCK ||
    process.env.AMAZON_BEDROCK_KEY ||
    process.env.amazon_beadrocl_key ||
    ""
  ).trim()
}

function sanitizeContextForSummary(context: Record<string, unknown>): string {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(context || {})) {
    if (EXCLUDED_CONTEXT_FIELDS.has(key)) continue
    if (value == null || value === "") continue
    if (typeof value === "string" && value.startsWith("data:")) continue
    clean[key] = value
  }
  let json = ""
  try { json = JSON.stringify(clean, null, 2) } catch { json = "" }
  return json.length > MAX_CONTEXT_JSON_CHARS ? `${json.slice(0, MAX_CONTEXT_JSON_CHARS)}\n…[truncated]` : json
}

function buildTranscript(messages?: Array<{ role: string; content: string }>): string {
  if (!Array.isArray(messages) || messages.length === 0) return ""
  const usable = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => `${m.role.toUpperCase()}: ${m.content.trim()}`)
  let transcript = usable.join("\n")
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = `…[earlier omitted]\n${transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS)}`
  }
  return transcript
}

const SYSTEM_PROMPT =
  "You are a precise context summarizer for a linked-document workflow. You maintain ONE rolling context brief that travels across a chain of related documents for the SAME client.\n\n" +
  "You are given: (1) the EXISTING rolling brief carried from earlier documents (may be empty for the first link), and (2) a NEW source document (as JSON) plus the conversation that produced it. Produce an UPDATED rolling brief.\n\n" +
  "STRICT RULES:\n" +
  "- Include ONLY facts present in the existing brief, the new document, or the conversation. NEVER invent, guess, or assume anything.\n" +
  "- ALWAYS preserve the original engagement context from the earliest documents: the client identity and what the relationship is fundamentally about must never be dropped.\n" +
  "- When the new document or conversation CHANGES or CONTRADICTS something in the existing brief, keep the NEWEST value and treat it as authoritative. Drop the stale contradicting value (you may mark it '(updated)').\n" +
  "- Merge, do not blindly append. Remove duplication. If the brief is getting long, COMPRESS older or less-critical details into short lines while keeping every still-relevant fact.\n" +
  "- Preserve exact names, numbers, amounts, dates, percentages, and terms as written.\n" +
  "- Do NOT include signatures, logos, styling, or internal database IDs.\n" +
  "- Organize under these labels when data exists: CLIENT, BUSINESS, PROJECT/SCOPE, DELIVERABLES, TERMS, AMOUNTS, DATES, DECISIONS/CHANGES, NOTES. Omit any label with no data.\n" +
  "- Output ONLY the updated rolling brief as concise labeled lines. No preamble, no markdown symbols. Keep it complete but under ~450 words."

function buildUserPrompt(input: ChainSummaryInput): string {
  const contextJson = sanitizeContextForSummary(input.parentContext)
  const transcript = buildTranscript(input.messages)
  const existing = (input.existingBrief || "").trim().slice(0, MAX_EXISTING_BRIEF_CHARS)
  return (
    `EXISTING ROLLING BRIEF (from earlier documents in the chain):\n${existing || "(none — this is the first document in the chain)"}\n\n` +
    `NEW SOURCE DOCUMENT TYPE: ${input.parentType}\n` +
    `NEXT DOCUMENT TO BE CREATED: ${input.targetType}\n\n` +
    `NEW SOURCE DOCUMENT (JSON):\n${contextJson || "(empty)"}\n\n` +
    (transcript ? `CONVERSATION THAT PRODUCED THE NEW SOURCE DOCUMENT (oldest to newest):\n${transcript}\n\n` : "CONVERSATION: (none available)\n\n") +
    `Produce the updated rolling brief now.`
  )
}

function boundOutput(text: string): string {
  const t = text.trim()
  return t.length > MAX_OUTPUT_CHARS ? `${t.slice(0, MAX_OUTPUT_CHARS)}…` : t
}

async function withCeiling<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HARD_CEILING_MS)
  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timer)
  }
}

// ── Claude via Bedrock Runtime (thinking enabled) ────────────────────────────
async function callClaude(modelId: string, userPrompt: string, key: string): Promise<string | null> {
  try {
    return await withCeiling(async (signal) => {
      const res = await fetch(`${BEDROCK_RUNTIME_BASE}/${encodeURIComponent(modelId)}/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
          // Enough room to think AND write a full brief — accuracy over speed.
          max_tokens: 6000,
          // Extended thinking: a bounded budget that comfortably finishes a
          // summary while not running away. Temperature must be omitted when
          // thinking is enabled (Anthropic requirement).
          thinking: { type: "enabled", budget_tokens: 3000 },
        }),
        signal,
      })
      if (!res.ok) return null
      const json = await res.json().catch(() => null)
      const text = Array.isArray(json?.content)
        ? json.content
            .filter((p: unknown): p is { type: string; text: string } =>
              !!p && typeof p === "object" && (p as { type?: unknown }).type === "text" &&
              typeof (p as { text?: unknown }).text === "string")
            .map((p: { text: string }) => p.text)
            .join("")
            .trim()
        : ""
      return text || null
    })
  } catch {
    return null
  }
}

// ── Kimi K2.5 via Bedrock Mantle (OpenAI-compatible) ─────────────────────────
async function callKimi(userPrompt: string, key: string): Promise<string | null> {
  try {
    return await withCeiling(async (signal) => {
      const res = await fetch(BEDROCK_MANTLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: KIMI_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1600,
          stream: false,
        }),
        signal,
      })
      if (!res.ok) return null
      const json = await res.json().catch(() => null)
      const text = json?.choices?.[0]?.message?.content
      return typeof text === "string" && text.trim() ? text.trim() : null
    })
  } catch {
    return null
  }
}

// ── DeepSeek (final safety net — always configured) ──────────────────────────
async function callDeepSeek(userPrompt: string): Promise<string | null> {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key || key.length < 20) return null
  try {
    return await withCeiling(async (signal) => {
      const res = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1600,
        }),
        signal,
      })
      if (!res.ok) return null
      const json = await res.json().catch(() => null)
      const text = json?.choices?.[0]?.message?.content
      return typeof text === "string" && text.trim() ? text.trim() : null
    })
  } catch {
    return null
  }
}

/** Deterministic, fact-only fallback so the operation never hard-fails. */
function deterministicBrief(input: ChainSummaryInput): string {
  const c = input.parentContext as Record<string, any>
  const lines: string[] = []
  const client = [c.toName, c.toEmail, c.toPhone, c.toAddress].filter(Boolean).join(" · ")
  if (client) lines.push(`CLIENT: ${client}`)
  const biz = [c.fromName, c.fromEmail].filter(Boolean).join(" · ")
  if (biz) lines.push(`BUSINESS: ${biz}`)
  const project = c.projectName || c.title || c.subject
  if (project) lines.push(`PROJECT/SCOPE: ${project}`)
  if (Array.isArray(c.items) && c.items.length) {
    const items = c.items.slice(0, 20)
      .map((it: any) => (typeof it?.description === "string" ? it.description.trim() : ""))
      .filter(Boolean).join("; ")
    if (items) lines.push(`DELIVERABLES: ${items}`)
  }
  const amounts = [c.currency && `Currency ${c.currency}`, c.total != null && c.total !== "" && `Total ${c.total}`, c.paymentTerms && `Terms ${c.paymentTerms}`]
    .filter(Boolean).join(" · ")
  if (amounts) lines.push(`AMOUNTS: ${amounts}`)
  if (typeof c.notes === "string" && c.notes.trim()) lines.push(`NOTES: ${c.notes.trim().slice(0, 400)}`)
  const prior = (input.existingBrief || "").trim()
  const head = prior ? `${prior}\n\n---\nFrom the ${input.parentType}:\n` : ""
  return boundOutput(`${head}${lines.join("\n")}`.trim())
}

/**
 * Produce the updated rolling brief. Tries thinking models in order and always
 * returns a usable brief (deterministic fallback if every model is unavailable).
 */
export async function summarizeChainContext(input: ChainSummaryInput): Promise<string> {
  const userPrompt = buildUserPrompt(input)
  const key = bedrockKey()

  if (key) {
    for (const model of CLAUDE_MODELS) {
      const out = await callClaude(model, userPrompt, key)
      if (out) return boundOutput(out)
    }
    const kimi = await callKimi(userPrompt, key)
    if (kimi) return boundOutput(kimi)
  }

  const ds = await callDeepSeek(userPrompt)
  if (ds) return boundOutput(ds)

  return deterministicBrief(input)
}
