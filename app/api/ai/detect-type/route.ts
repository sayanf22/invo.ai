/**
 * Document Type Detection API
 * Server-side endpoint to detect document type from user prompt
 * SECURITY: All detection logic runs on backend, never exposed to client
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { detectDocumentType, getDetectionMessage } from "@/lib/server/document-type-detector"
import { checkCostLimit, parseTier, type UserTier } from "@/lib/cost-protection"

interface DetectTypeRequest {
    prompt: string
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Check cost limit before processing
        const { data: sub } = await (auth.supabase as any)
            .from("subscriptions")
            .select("plan")
            .eq("user_id", auth.user.id)
            .single()
        const userTier = parseTier((sub as any)?.plan)

        const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation", userTier)
        if (costError) return costError

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

        // SECURITY: Validate prompt length (max 10,000 chars)
        if (body.prompt.length > 10_000) {
            return NextResponse.json(
                { error: "Prompt too long. Maximum 10,000 characters." },
                { status: 400 }
            )
        }

        // SECURITY: Sanitize prompt input
        const sanitizedPrompt = sanitizeText(body.prompt)

        // SECURITY: Limit prompt length — for type detection, only the first part matters
        const detectionPrompt = sanitizedPrompt.length > 1000
            ? sanitizedPrompt.slice(0, 1000)
            : sanitizedPrompt

        // Detect document type (server-side only)
        const detection = detectDocumentType(detectionPrompt)
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
