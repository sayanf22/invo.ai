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
    "You are Kimi, a brief and factual document reviewer. " +
    "You review business context, compliance rules, and generated documents. " +
    "Respond in 3 sentences or fewer. Be precise and avoid filler. " +
    "Never greet the user or act as a chatbot."

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
