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
