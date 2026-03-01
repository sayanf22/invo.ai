/**
 * Document Type Detection API
 * Server-side endpoint to detect document type from user prompt
 * SECURITY: All detection logic runs on backend, never exposed to client
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { detectDocumentType, getDetectionMessage } from "@/lib/server/document-type-detector"

interface DetectTypeRequest {
    prompt: string
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        const body: DetectTypeRequest = await request.json()

        // SECURITY: Input size limit (10KB)
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        if (!body.prompt || typeof body.prompt !== 'string') {
            return NextResponse.json(
                { error: "Prompt is required and must be a string" },
                { status: 400 }
            )
        }

        // SECURITY: Sanitize prompt input
        const sanitizedPrompt = sanitizeText(body.prompt)

        // SECURITY: Limit prompt length
        if (sanitizedPrompt.length > 1000) {
            return NextResponse.json(
                { error: "Prompt too long. Maximum 1000 characters for type detection." },
                { status: 400 }
            )
        }

        // Detect document type (server-side only)
        const detection = detectDocumentType(sanitizedPrompt)
        const message = getDetectionMessage(detection)

        return NextResponse.json({
            success: true,
            type: detection.type,
            confidence: detection.confidence,
            reasoning: detection.reasoning,
            message: message
        })

    } catch (error) {
        console.error("Document type detection error:", error)
        return NextResponse.json(
            {
                success: false,
                error: sanitizeError(error),
            },
            { status: 500 }
        )
    }
}
