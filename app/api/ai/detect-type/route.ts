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
import { checkCostLimit, resolveEffectiveTier, type UserTier, getUserTier } from "@/lib/cost-protection"
import { classifyDocumentTypeWithKimi, resolveBedrockKey } from "@/lib/bedrock"

interface DetectTypeRequest {
    prompt: string
    /** Currently-selected category pill (e.g., "Invoice"), if any. */
    selectedCategory?: string
    /**
     * Optional summary of an attached file (produced by Kimi vision on the
     * client). Lets the classifier factor in the document the user attached
     * without dumping raw file text into the prompt.
     */
    fileSummary?: string
}

/** Human-friendly label for a canonical type, used in the detection message. */
function typeLabel(type: string): string {
    const map: Record<string, string> = {
        invoice: "invoice", quote: "quote", estimate: "estimate", proposal: "proposal",
        contract: "contract", sow: "statement of work", change_order: "change order",
        nda: "NDA", client_onboarding_form: "client onboarding form",
        payment_followup: "payment follow-up", receipt: "receipt",
    }
    return map[type] ?? type
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Check cost limit before processing
        const userTier = await getUserTier(auth.supabase, auth.user.id)

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

        // The keyword classifier is retained as a fallback + for disambiguation.
        const intent = classifyIntentFull(detectionPrompt, selectedCategory)

        // Optional attached-file summary (Kimi vision output from the client).
        const fileSummary = typeof body.fileSummary === "string"
            ? sanitizeText(body.fileSummary).slice(0, 4000)
            : undefined

        // ── FAST PATH: unambiguous explicit request → answer instantly ──
        // When the keyword classifier is confident this is an explicit
        // document-creation request with a SINGLE clear type (e.g. "create an
        // invoice for Acme", "write an estimate for the website") and there is
        // no attached file, we skip the Kimi round-trip entirely. This keeps
        // obvious requests snappy. Ambiguous prompts, questions, and anything
        // with an attached file still fall through to Kimi's semantic judgment.
        const fastSuggestions = intent.suggestions ?? []
        if (
            !fileSummary &&
            intent.route === "document-explicit" &&
            intent.suggestedType &&
            fastSuggestions.length <= 1
        ) {
            return NextResponse.json({
                success: true,
                type: intent.suggestedType,
                confidence: intent.confidence,
                reasoning: detection.reasoning,
                message: `I'll help you create a ${typeLabel(intent.suggestedType)}.`,
                route: "direct-create",
                intent: {
                    route: intent.route,
                    suggestedType: intent.suggestedType,
                    confidence: intent.confidence,
                    suggestions: intent.suggestions,
                },
                mismatch: undefined,
                classifier: "keyword-fast",
            })
        }

        // ── PRIMARY: Kimi semantic classification ──
        // Kimi reads the request (and any attached-file summary) and decides the
        // type + whether the user wants to CREATE now vs. chat. This replaces
        // brittle keyword matching (e.g. "rough cost projection" → estimate).
        // A selected category pill is a strong explicit signal, so when the user
        // has already picked a type we trust the keyword path and skip Kimi.
        let kimi = null as Awaited<ReturnType<typeof classifyDocumentTypeWithKimi>>
        if (!selectedCategory) {
            try {
                kimi = await classifyDocumentTypeWithKimi(detectionPrompt, resolveBedrockKey(), fileSummary)
            } catch {
                kimi = null
            }
        }

        // Use Kimi's decision when it is confident enough; otherwise fall back to
        // the keyword classifier so the disambiguation UX still works.
        if (kimi && kimi.confidence >= 0.5) {
            const finalType = kimi.type
            const route: "direct-create" | "chat-only" =
                kimi.intent === "create" ? "direct-create" : "chat-only"
            return NextResponse.json({
                success: true,
                type: finalType,
                confidence: kimi.confidence,
                reasoning: kimi.reasoning,
                message: kimi.intent === "create"
                    ? `I'll help you create a ${typeLabel(finalType)}.`
                    : `Let's talk through what you need for your ${typeLabel(finalType)}.`,
                route,
                intent: {
                    route: kimi.intent === "create" ? "document-explicit" : "chat",
                    suggestedType: finalType,
                    confidence: kimi.confidence,
                    suggestions: [],
                },
                mismatch: undefined,
                classifier: "kimi",
            })
        }

        // ── FALLBACK: keyword classifier ──
        const message = getDetectionMessage(detection)

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
            classifier: "keyword",
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
