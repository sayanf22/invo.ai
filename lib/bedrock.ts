/**
 * Kimi K2.5 streaming client via Amazon Bedrock Mantle (OpenAI-compatible).
 *
 * Used for conversational / chat responses. Document generation still
 * goes through DeepSeek in lib/deepseek.ts.
 */

const BEDROCK_MANTLE_URL =
    "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions"
const BEDROCK_MODEL = "moonshotai.kimi-k2.5"

export async function* streamBedrockChat(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
): AsyncGenerator<{ type: "chunk" | "complete" | "error"; data: string }> {
    if (!apiKey || apiKey.trim().length === 0) {
        yield {
            type: "error",
            data: "Bedrock API key not configured. Set amazon_beadrocl_key in .env",
        }
        return
    }

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

        yield { type: "complete", data: fullContent.trim() }
    } catch (error) {
        yield {
            type: "error",
            data: error instanceof Error
                ? error.message
                : "Bedrock streaming failed",
        }
    }
}
