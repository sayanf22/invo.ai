import { NextRequest, NextResponse } from "next/server"
import { generateDocument, type AIGenerationRequest } from "@/lib/deepseek"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
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
            return NextResponse.json(
                { success: false, error: "Prompt is required" },
                { status: 400 }
            )
        }

        // SECURITY: Limit prompt length to prevent token abuse
        if (body.prompt.length > 10_000) {
            return NextResponse.json(
                { success: false, error: "Prompt too long. Maximum 10,000 characters." },
                { status: 400 }
            )
        }

        if (!body.documentType) {
            body.documentType = "invoice" // Default to invoice
        }

        const result = await generateDocument(body)

        if (!result.success) {
            return NextResponse.json(result, { status: 500 })
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error("AI generation error:", error)
        return NextResponse.json(
            {
                success: false,
                error: sanitizeError(error),
            },
            { status: 500 }
        )
    }
}
