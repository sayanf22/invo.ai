import { NextRequest } from "next/server"
import { streamGenerateDocument, type AIGenerationRequest } from "@/lib/deepseek"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        // SECURITY: Rate limit (10 req/min for AI routes)
        const rateLimitError = await checkRateLimit(auth.user.id, "ai")
        if (rateLimitError) return rateLimitError

        const body: AIGenerationRequest = await request.json()

        // SECURITY: Input size limit (100KB)
        const sizeError = validateBodySize(body, 100 * 1024)
        if (sizeError) return sizeError

        if (!body.prompt) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // SECURITY: Limit prompt length
        if (body.prompt.length > 10_000) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt too long. Maximum 10,000 characters." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        if (!body.documentType) {
            body.documentType = "invoice"
        }

        // Create a readable stream from our generator
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()

                try {
                    for await (const chunk of streamGenerateDocument(body)) {
                        const data = `data: ${JSON.stringify(chunk)}\n\n`
                        controller.enqueue(encoder.encode(data))

                        if (chunk.type === "complete" || chunk.type === "error") {
                            break
                        }
                    }
                } catch (error) {
                    const errorData = `data: ${JSON.stringify({
                        type: "error",
                        data: "Stream error",
                    })}\n\n`
                    controller.enqueue(encoder.encode(errorData))
                } finally {
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        })
    } catch (error) {
        console.error("AI streaming error:", error)
        return new Response(
            JSON.stringify({
                success: false,
                error: "Internal server error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
