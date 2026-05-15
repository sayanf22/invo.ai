/**
 * Document Type Detection API
 *
 * Detects document type from a user prompt and also decides the routing
 * for the chat-first document flow:
 *   - `route: "direct-create"` — prompt is explicit, route straight to the
 *     split-screen with the detected type.
 *   - `route: "chat-only"` — prompt is a question, ambiguous, or a mismatch.
 *     Route to the new chat-only screen first.
 *
 * SECURITY: All detection logic runs on backend (pure regex, no AI call).
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { detectDocumentType, getDetectionMessage } from "@/lib/server/document-type-detector"
import { classifyIntentFull, detectMismatch, type DocumentType } from "@/lib/intent-router"
import { checkCostLimit, resolveEffectiveTier, type UserTier } from "@/lib/cost-protection"

interface DetectTypeRequest {
    prompt: string
    /** Currently-selected category pill (e.g., "Invoice"), if any. */
    selectedCategory?: string
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Check cost limit before processing
        const { data: sub } = await (auth.supabase as any)
            .from("subscriptions")
            .select("plan, status, current_period_end")
            .eq("user_id", auth.user.id)
            .single()
        const userTier = resolveEffectiveTier(sub as any)

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

        // Sanitize optional selectedCategory
        const selectedCategory = typeof body.selectedCategory === "string"
            ? body.selectedCategory.slice(0, 50)
            : undefined

        // ── Core classification ──
        // Keep the legacy detector for backward compatibility (returns type + confidence + reasoning).
        const detection = detectDocumentType(detectionPrompt)
        const message = getDetectionMessage(detection)

        // The new full classifier decides the route and picks a suggested type
        // using both the prompt text and the selected category pill.
        const intent = classifyIntentFull(detectionPrompt, selectedCategory)

        // Resolve the final type: prefer the full classifier's suggestion when
        // present, else fall back to the legacy detector.
        const finalType = intent.suggestedType ?? detection.type

        // ── Mismatch check ──
        // If the classifier thinks the user wants a specific type, see if that
        // type actually fits their goal. A contract-for-payment should
        // redirect to chat-only with a "did you mean invoice?" suggestion.
        const mismatch = detectMismatch(detectionPrompt, finalType as DocumentType)

        const route: "direct-create" | "chat-only" =
            mismatch ? "chat-only" : intent.route === "document-explicit" ? "direct-create" : "chat-only"

        return NextResponse.json({
            success: true,
            type: finalType,
            confidence: detection.confidence,
            reasoning: detection.reasoning,
            message,
            route,
            intent: {
                route: intent.route,
                suggestedType: intent.suggestedType,
                confidence: intent.confidence,
                /** Ranked suggestions for disambiguation (Requirement 3.3a) */
                suggestions: intent.suggestions,
            },
            mismatch: mismatch
                ? {
                      requestedType: mismatch.requestedType,
                      suggestedType: mismatch.suggestedType,
                      reason: mismatch.reason,
                  }
                : undefined,
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
