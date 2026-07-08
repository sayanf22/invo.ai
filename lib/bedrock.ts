/**
 * Kimi K2.5 streaming client via Amazon Bedrock Mantle (OpenAI-compatible).
 *
 * Used for conversational / chat responses. Document generation still
 * goes through DeepSeek in lib/deepseek.ts.
 */

const BEDROCK_MANTLE_URL =
    "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions"
const BEDROCK_MODEL = "moonshotai.kimi-k2.5"

/** HTTP status codes that should trigger a fallback to DeepSeek */
const FALLBACK_STATUS_CODES = new Set([500, 502, 503])

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000

export async function* streamBedrockChat(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
): AsyncGenerator<{ type: "chunk" | "complete" | "error"; data: string }> {
    if (!apiKey || apiKey.trim().length === 0) {
        yield {
            type: "error",
            data: "Bedrock API key not configured. Set the Bedrock API key in your environment.",
        }
        return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const response = await fetch(BEDROCK_MANTLE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: BEDROCK_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                max_tokens: 2000,
                temperature: 0.3,
                stream: true,
            }),
            signal: controller.signal,
        })

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                yield {
                    type: "error",
                    data: "Bedrock API key is invalid or expired.",
                }
                return
            }
            if (response.status === 429) {
                yield {
                    type: "error",
                    data: "Bedrock API rate limit exceeded. Please wait and try again.",
                }
                return
            }
            if (FALLBACK_STATUS_CODES.has(response.status)) {
                yield {
                    type: "error",
                    data: `Bedrock API server error (${response.status}). Service temporarily unavailable.`,
                }
                return
            }
            throw new Error(`Bedrock API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ""
        let sseBuffer = ""

        if (!reader) {
            throw new Error("No response body from Bedrock")
        }

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            sseBuffer += chunk

            // Split on newlines, keep the last (potentially incomplete) part in the buffer
            const parts = sseBuffer.split("\n")
            sseBuffer = parts.pop() || ""

            for (const rawLine of parts) {
                const line = rawLine.trim()
                if (!line.startsWith("data: ")) continue

                const data = line.slice(6)
                if (data === "[DONE]") continue

                try {
                    const parsed = JSON.parse(data)
                    // Kimi K2.5 via Mantle uses standard OpenAI format — content only, no reasoning_content
                    const content = parsed.choices?.[0]?.delta?.content || ""

                    if (content) {
                        fullContent += content
                        yield { type: "chunk", data: content }
                    }
                } catch {
                    // Skip invalid JSON chunks
                }
            }
        }

        // Flush any remaining data in the SSE buffer after the read loop ends
        if (sseBuffer.trim()) {
            const line = sseBuffer.trim()
            if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(data)
                        const content = parsed.choices?.[0]?.delta?.content || ""
                        if (content) {
                            fullContent += content
                            yield { type: "chunk", data: content }
                        }
                    } catch {
                        // Skip invalid JSON in final buffer
                    }
                }
            }
        }

        yield { type: "complete", data: fullContent.trim() }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield {
                type: "error",
                data: "Bedrock API request timed out after 30 seconds.",
            }
            return
        }
        yield {
            type: "error",
            data: error instanceof Error
                ? error.message
                : "Bedrock streaming failed",
        }
    } finally {
        clearTimeout(timeoutId)
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Non-streaming Bedrock call for brief orchestrator commentary.
 *
 * Used by the Kimi RAG Orchestrator to produce short commentary (≤200 tokens)
 * during Thinking Mode document generation. Returns the full response text
 * (not a generator). Returns null on any error — never throws.
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Non-streaming Bedrock call for brief orchestrator commentary.
 *
 * @param systemPrompt - System instructions for the orchestrator role
 * @param userPrompt   - The content to analyze/summarize
 * @param apiKey       - Bedrock Mantle API key
 * @param maxTokens    - Maximum response tokens (default: 100)
 * @returns The response text, or null if the call fails/times out
 */
export async function callBedrockBrief(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    maxTokens: number = 100
): Promise<string | null> {
    if (!apiKey || apiKey.trim().length === 0) {
        console.error("[callBedrockBrief] Missing or empty API key")
        return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const response = await fetch(BEDROCK_MANTLE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: BEDROCK_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                max_tokens: maxTokens,
                temperature: 0.2,
                stream: false,
            }),
            signal: controller.signal,
        })

        if (!response.ok) {
            console.error("[callBedrockBrief] HTTP error", {
                status: response.status,
                statusText: response.statusText,
            })
            return null
        }

        const json = await response.json()
        const text = json.choices?.[0]?.message?.content

        if (typeof text !== "string" || text.trim().length === 0) {
            console.error("[callBedrockBrief] Empty or invalid response body", {
                choices: json.choices,
            })
            return null
        }

        return text.trim()
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            console.error(
                "[callBedrockBrief] Request timed out after 30 seconds"
            )
        } else {
            console.error("[callBedrockBrief] Unexpected error", {
                message:
                    error instanceof Error ? error.message : String(error),
            })
        }
        return null
    } finally {
        clearTimeout(timeoutId)
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Orchestrator Prompt Templates
 *
 * Template functions that accept data and return the interpolated prompt
 * string. Used by the Kimi RAG Orchestrator in Thinking Mode.
 * ───────────────────────────────────────────────────────────────────────────── */

/** System prompt for all Kimi orchestrator calls. */
export const ORCHESTRATOR_SYSTEM_PROMPT =
    "You are Kimi, a document generation orchestrator. " +
    "You review business context, compliance rules, and generated documents. " +
    "You give precise, actionable instructions. Never greet the user or act as a chatbot. " +
    "Be direct and specific — use exact numbers, field names, and values."

/** Build the user prompt for business profile commentary. */
export function BUSINESS_PROFILE_COMMENTARY_PROMPT(profile: {
    name: string
    country: string
    currency: string
    taxRegistered: boolean
    businessType: string
}): string {
    return (
        `Summarize what you understand about this business context in ≤3 sentences.\n\n` +
        `Business Name: ${profile.name}\n` +
        `Country: ${profile.country}\n` +
        `Currency: ${profile.currency}\n` +
        `Tax Registered: ${profile.taxRegistered ? "Yes" : "No"}\n` +
        `Business Type: ${profile.businessType}`
    )
}

/** Build the user prompt for compliance rules commentary. */
export function COMPLIANCE_COMMENTARY_PROMPT(rules: {
    country: string
    ruleCount: number
    categories: string[]
    keyValues: string
}): string {
    if (rules.ruleCount === 0) {
        return (
            `No compliance data was found for ${rules.country}. ` +
            `Note that the user should manually verify tax rates and regulatory requirements.`
        )
    }

    return (
        `Summarize the key compliance regulations being applied in ≤3 sentences.\n\n` +
        `Country: ${rules.country}\n` +
        `Rules Found: ${rules.ruleCount}\n` +
        `Categories: ${rules.categories.join(", ")}\n` +
        `Key Requirements:\n${rules.keyValues}`
    )
}

/**
 * Build a pre-generation instruction brief for DeepSeek.
 * Kimi analyzes the user's request + business profile + compliance rules
 * and produces specific instructions that get injected into DeepSeek's prompt.
 */
export function PRE_GENERATION_BRIEF_PROMPT(data: {
    userPrompt: string
    documentType: string
    country: string
    currency: string
    taxRegistered: boolean
    taxRate: number | undefined
    complianceRules: string
    businessName: string
    businessType: string
    hasExistingDocument: boolean
}): string {
    return (
        `You are orchestrating a document generation AI. Analyze the request below and produce a concise instruction brief (≤8 bullet points) telling the generator EXACTLY what to do.\n\n` +
        `Focus on:\n` +
        `1. What the user is asking for (new doc, edit, or question)\n` +
        `2. Tax handling: should tax be applied? At what rate? What label?\n` +
        `3. Mandatory fields for ${data.country} ${data.documentType}s that MUST be included\n` +
        `4. Common mistakes to AVOID (wrong tax rate, missing fields, wrong currency)\n` +
        `5. If editing an existing document, what specifically should change vs stay the same\n\n` +
        `--- Context ---\n` +
        `User Request: "${data.userPrompt}"\n` +
        `Document Type: ${data.documentType}\n` +
        `Business: ${data.businessName} (${data.businessType})\n` +
        `Country: ${data.country}\n` +
        `Currency: ${data.currency}\n` +
        `Tax Registered: ${data.taxRegistered ? "Yes" : "No"}\n` +
        `${data.taxRate !== undefined ? `Standard Tax Rate (from compliance DB): ${data.taxRate}%` : "No tax rate in compliance DB"}\n` +
        `Editing Existing: ${data.hasExistingDocument ? "Yes" : "No (new document)"}\n\n` +
        `--- Compliance Rules ---\n${data.complianceRules || "None available"}\n\n` +
        `Respond with ONLY the bullet-point instructions. No preamble. Start with "•".`
    )
}

/** Build the user prompt for RAG validation after document generation. */
export function RAG_VALIDATION_PROMPT(data: {
    documentJson: string
    ragRules: string
}): string {
    return (
        `Compare the generated document against the compliance rules below. ` +
        `Report mismatches for tax rate, mandatory fields, and currency using ✅ for compliant items and ⚠️ for mismatches. ` +
        `Respond in ≤5 sentences.\n\n` +
        `--- Generated Document ---\n${data.documentJson}\n\n` +
        `--- RAG Compliance Rules ---\n${data.ragRules}`
    )
}

/**
 * Build a correction prompt when Kimi finds issues in the generated document.
 * This tells DeepSeek exactly what to fix in a follow-up generation.
 */
export function CORRECTION_INSTRUCTION_PROMPT(data: {
    validationResult: string
    documentJson: string
    ragRules: string
}): string {
    return (
        `The document below was generated but has compliance issues. ` +
        `Produce a concise correction instruction (≤5 bullet points) telling the generator EXACTLY what fields to change and to what values. ` +
        `Only list fields that need fixing — do not repeat compliant items.\n\n` +
        `--- Validation Result ---\n${data.validationResult}\n\n` +
        `--- Current Document ---\n${data.documentJson}\n\n` +
        `--- Compliance Rules ---\n${data.ragRules}\n\n` +
        `Respond with ONLY the correction bullets. Start with "FIX:". Example:\n` +
        `FIX: Set taxRate to 18 (currently 0, business is GST-registered)\n` +
        `FIX: Set taxLabel to "GST" (currently empty)\n` +
        `If no fixes are needed, respond with exactly: "NO_FIXES_NEEDED"`
    )
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reference-context retrieval decision (Agentic RAG router).
 *
 * Kimi acts as the retrieval router: given the user's request and the list of
 * reference documents they've uploaded, it decides whether pulling those
 * documents in would actually help this specific request. This implements the
 * "decide whether to retrieve, then act" control loop (ReAct-style agentic RAG)
 * rather than retrieving on every turn.
 * ───────────────────────────────────────────────────────────────────────────── */

/** System prompt for the retrieval-router role. */
export const RETRIEVAL_ROUTER_SYSTEM_PROMPT =
    "You are a retrieval router for a document-generation assistant. " +
    "You decide whether the user's own uploaded reference documents (their past " +
    "contracts, invoices, proposals) should be pulled in to answer the current " +
    "request. Retrieve ONLY when the reference material would meaningfully improve " +
    "the result — e.g. writing a new document from scratch, or when the user asks " +
    "to follow their usual style/format/wording. Do NOT retrieve for tiny edits " +
    "(change a date, fix a number), pure questions about the current document, or " +
    "small tweaks. Answer with a single word: RETRIEVE or SKIP."

/** Build the retrieval-decision prompt. */
export function REFERENCE_RETRIEVAL_DECISION_PROMPT(data: {
    userPrompt: string
    documentType: string
    hasExistingDocument: boolean
    referenceFiles: string[]
}): string {
    return (
        `Decide whether to pull in the user's reference documents for this request.\n\n` +
        `User request: "${data.userPrompt}"\n` +
        `Document type being worked on: ${data.documentType}\n` +
        `Editing an existing document: ${data.hasExistingDocument ? "Yes" : "No (new document)"}\n` +
        `Reference documents available: ${data.referenceFiles.length > 0 ? data.referenceFiles.join(", ") : "none"}\n\n` +
        `Reply with ONLY one word on the first line — RETRIEVE or SKIP — then a short reason on the next line.`
    )
}

/**
 * Ask Kimi whether to retrieve the user's reference documents.
 * Returns null on any failure so the caller can fall back to a heuristic.
 */
export async function decideReferenceRetrieval(
    apiKey: string,
    data: {
        userPrompt: string
        documentType: string
        hasExistingDocument: boolean
        referenceFiles: string[]
    }
): Promise<{ retrieve: boolean; reason: string } | null> {
    const raw = await callBedrockBrief(
        RETRIEVAL_ROUTER_SYSTEM_PROMPT,
        REFERENCE_RETRIEVAL_DECISION_PROMPT(data),
        apiKey,
        60
    )
    if (!raw) return null

    const text = raw.trim()
    const firstWord = text.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z]/g, "") ?? ""
    if (firstWord === "RETRIEVE") {
        return { retrieve: true, reason: text.split("\n").slice(1).join(" ").trim() || "Kimi: reference material relevant" }
    }
    if (firstWord === "SKIP") {
        return { retrieve: false, reason: text.split("\n").slice(1).join(" ").trim() || "Kimi: reference material not needed" }
    }
    // Ambiguous response — surface as null so the heuristic decides.
    return null
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Multi-turn Bedrock chat for the chat-only advisory mode.
 *
 * Unlike `streamBedrockChat` (which takes a single user prompt), this function
 * accepts a full conversation history so Kimi K2.5 can maintain context across
 * multiple turns in the chat-only screen.
 *
 * The system prompt is always prepended as the first message.
 * ───────────────────────────────────────────────────────────────────────────── */

export interface BedrockChatMessage {
    role: "user" | "assistant"
    content: string
}

/**
 * Stream a multi-turn conversation with Kimi K2.5 via Amazon Bedrock Mantle.
 *
 * @param systemPrompt   - System instructions (prepended as system message)
 * @param messages       - Full conversation history including the latest user message
 * @param apiKey         - Bedrock Mantle API key
 * @param maxTokens      - Maximum response tokens (default: 1500)
 */
export async function* streamBedrockChatWithHistory(
    systemPrompt: string,
    messages: BedrockChatMessage[],
    apiKey: string,
    maxTokens: number = 1500
): AsyncGenerator<{ type: "chunk" | "complete" | "error"; data: string }> {
    if (!apiKey || apiKey.trim().length === 0) {
        yield {
            type: "error",
            data: "Bedrock API key not configured.",
        }
        return
    }

    if (!messages || messages.length === 0) {
        yield { type: "error", data: "No messages provided." }
        return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
        const response = await fetch(BEDROCK_MANTLE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: BEDROCK_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    // Limit to last 20 messages (10 pairs) to stay within context limits
                    ...messages.slice(-20),
                ],
                max_tokens: maxTokens,
                temperature: 0.4,
                stream: true,
            }),
            signal: controller.signal,
        })

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                yield { type: "error", data: "Bedrock API key is invalid or expired." }
                return
            }
            if (response.status === 429) {
                yield { type: "error", data: "Bedrock API rate limit exceeded." }
                return
            }
            if (FALLBACK_STATUS_CODES.has(response.status)) {
                yield { type: "error", data: `Bedrock API server error (${response.status}).` }
                return
            }
            throw new Error(`Bedrock API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let fullContent = ""
        let sseBuffer = ""

        if (!reader) throw new Error("No response body from Bedrock")

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            sseBuffer += chunk

            const parts = sseBuffer.split("\n")
            sseBuffer = parts.pop() || ""

            for (const rawLine of parts) {
                const line = rawLine.trim()
                if (!line.startsWith("data: ")) continue
                const data = line.slice(6)
                if (data === "[DONE]") continue
                try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content || ""
                    if (content) {
                        fullContent += content
                        yield { type: "chunk", data: content }
                    }
                } catch {
                    // Skip invalid JSON chunks
                }
            }
        }

        // Flush remaining SSE buffer
        if (sseBuffer.trim()) {
            const line = sseBuffer.trim()
            if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data !== "[DONE]") {
                    try {
                        const parsed = JSON.parse(data)
                        const content = parsed.choices?.[0]?.delta?.content || ""
                        if (content) {
                            fullContent += content
                            yield { type: "chunk", data: content }
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        yield { type: "complete", data: fullContent.trim() }
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            yield { type: "error", data: "Bedrock API request timed out after 30 seconds." }
            return
        }
        yield {
            type: "error",
            data: error instanceof Error ? error.message : "Bedrock streaming failed",
        }
    } finally {
        clearTimeout(timeoutId)
    }
}
