import { NextRequest } from "next/server"
import { streamGenerateDocument, type AIGenerationRequest } from "@/lib/deepseek"
import { authenticateRequest, validateBodySize, sanitizeError, validateOrigin } from "@/lib/api-auth"

import { checkCostLimit, trackUsage, checkMessageLimit, checkDocumentTypeAllowed, incrementDocumentCount, type UserTier, resolveEffectiveTier } from "@/lib/cost-protection"
import { logAIGeneration } from "@/lib/audit-log"
import { sanitizeText } from "@/lib/sanitize"

// Extract contextual info from the prompt and business context for progress labels
function extractContextFromPrompt(
    prompt: string,
    businessContext?: { country?: string; [key: string]: any },
    documentType?: string
): { country: string; docType: string; clientName: string } {
    const country = businessContext?.country || "your country"
    const docType = documentType || "document"

    // Extract client name from common prompt patterns
    let clientName = ""
    // Patterns: "for Acme Corp", "to John Doe", "for John's", etc.
    const patterns = [
        /\bfor\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}(?:\s+(?:Corp|Inc|LLC|Ltd|Co|Company|Group|Services|Solutions|Technologies|Tech|Studio|Agency|Consulting))?)\b/,
        /\bto\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})\b/,
        /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})(?:'s)\s+(?:invoice|quotation|contract|proposal|document)\b/i,
    ]

    for (const pattern of patterns) {
        const match = prompt.match(pattern)
        if (match?.[1]) {
            // Filter out common false positives (verbs, prepositions, document types)
            const falsePositives = ["Create", "Generate", "Make", "Build", "Draft", "Write", "Send", "Invoice", "Contract", "Quotation", "Proposal", "Document", "Net", "Due", "Payment"]
            if (!falsePositives.includes(match[1].split(" ")[0])) {
                clientName = match[1].trim()
                break
            }
        }
    }

    return { country, docType, clientName }
}

// Map thinkingMode to DeepSeek model configuration
function getModelConfig(thinkingMode?: "fast" | "thinking"): {
    model: string
    temperature?: number
    reasoning_effort?: string
} {
    if (thinkingMode === "thinking") {
        return { model: "deepseek-reasoner", reasoning_effort: "low" }
    }
    // Default: fast mode
    return { model: "deepseek-chat", temperature: 0.3 }
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Validate request origin
        const originError = validateOrigin(request)
        if (originError) return originError

        // SECURITY: Authenticate user (pass request for Authorization header fallback)
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body: AIGenerationRequest = await request.json()

        // Fetch user tier from subscriptions table (needed for all limit checks)
        const { data: sub } = await (auth.supabase as any)
            .from("subscriptions")
            .select("plan, status, current_period_end")
            .eq("user_id", auth.user.id)
            .single()
        const userTier = resolveEffectiveTier(sub as any)

        // SECURITY: Cost protection - check monthly document limit with actual tier
        const costError = await checkCostLimit(auth.supabase, auth.user.id, "generation", userTier)
        if (costError) return costError

        // SECURITY: Document type restriction — free tier only gets invoice + contract
        // This is the server-side enforcement — the frontend check is just UX
        const docTypeToCheck = (body.documentType || "invoice").toLowerCase()
        const typeError = checkDocumentTypeAllowed(docTypeToCheck, userTier)
        if (typeError) return typeError

        // Check per-session message limit (if sessionId provided)
        const sessionId = (body as any).sessionId
        if (sessionId) {
            const limitError = await checkMessageLimit(auth.supabase, auth.user.id, sessionId, userTier)
            if (limitError) return limitError
        }

        // SECURITY: Input size limit (100KB)
        const sizeError = validateBodySize(body, 100 * 1024)
        if (sizeError) return sizeError

        if (!body.prompt) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt is required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // SECURITY: Sanitize prompt input
        body.prompt = sanitizeText(body.prompt)

        // SECURITY: Limit prompt length to prevent token abuse
        if (body.prompt.length > 10_000) {
            return new Response(
                JSON.stringify({ success: false, error: "Prompt too long. Maximum 10,000 characters." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        // SECURITY: Sanitize and limit fileContext
        if (body.fileContext) {
            body.fileContext = sanitizeText(body.fileContext)
            if (body.fileContext.length > 5_000) {
                body.fileContext = body.fileContext.slice(0, 5_000)
            }
        }

        if (!body.documentType) {
            body.documentType = "invoice"
        }

        // SECURITY: Always fetch business profile SERVER-SIDE — ignore any client-sent businessContext
        // This prevents prompt injection via crafted businessContext payloads
        body.businessContext = undefined // clear any client-sent value
        try {
            const { data: business } = await auth.supabase
                .from("businesses")
                .select("*")
                .eq("user_id", auth.user.id)
                .single()

            if (business) {
                const b: any = business
                let addr = ""
                if (b.address) {
                    addr = typeof b.address === "string"
                        ? b.address
                        : [b.address.street, b.address.city, b.address.state, b.address.postalCode || b.address.postal_code, b.address.country]
                            .filter(Boolean).join(", ")
                }
                // Check if business has any tax registration
                const hasTaxRegistration = b.tax_ids && typeof b.tax_ids === 'object' && Object.values(b.tax_ids).some((v: any) => v && String(v).trim().length > 0)
                
                body.businessContext = {
                    name: b.name || "",
                    address: addr || "",
                    country: b.country || "",
                    currency: b.default_currency || "USD",
                    paymentTerms: b.default_payment_terms || "Net 30",
                    signatory: {
                        name: b.primary_signatory?.name || b.owner_name || "",
                        title: b.primary_signatory?.title || "Owner",
                        email: b.email || "",
                    },
                    taxRegistered: hasTaxRegistration,
                    taxIds: hasTaxRegistration ? b.tax_ids : undefined,
                    phone: b.phone || "",
                    businessType: b.business_type || "",
                    additionalNotes: b.additional_notes || "",
                }
            }
        } catch (err) {
            console.error("Failed to fetch business profile:", err instanceof Error ? err.message : err)
            // Continue without business context — AI will use placeholders
        }

        // RAG: Fetch compliance context for the user's country and document type
        try {
            const { getComplianceContext } = await import("@/lib/compliance-rag")
            const country = body.businessContext?.country || ""
            const docType = body.documentType || "invoice"

            // Determine if this is a document generation or conversational query
            // If conversation history exists and prompt doesn't match document generation patterns → semantic mode
            const isDocGeneration = !body.conversationHistory?.length ||
                /create|generate|make|build|draft|prepare/i.test(body.prompt)

            const complianceResult = await getComplianceContext(
                auth.supabase,
                country,
                docType,
                isDocGeneration ? undefined : body.prompt  // Pass message for semantic mode
            )

            body.complianceContext = complianceResult.formattedContext

            // Extract the standard tax rate from RAG rules and inject directly
            // This ensures the AI uses the DB rate, not its training data
            if (complianceResult.rules.length > 0) {
                const taxRule = complianceResult.rules.find(r => r.category === "tax_rates")
                if (taxRule && taxRule.requirement_value) {
                    const standardRate = (taxRule.requirement_value as any).standard
                    if (standardRate !== undefined && standardRate !== null) {
                        (body as any)._ragTaxRate = Number(standardRate)
                    }
                }
            }

            // Track embedding cost for semantic mode (deterministic mode is free)
            if (complianceResult.mode === "semantic") {
                await trackUsage(auth.supabase, auth.user.id, "embedding", 100)
            }
        } catch (err) {
            console.error("RAG compliance context failed:", err instanceof Error ? err.message : err)
            // Continue without compliance context — AI will use generic guidance
        }

        // Fetch the next available invoice/document number for this user
        // This prevents the AI from generating duplicate numbers like INV-2026-001
        try {
            const docType = (body.documentType || "invoice").toLowerCase()
            const prefix = docType === "quotation" ? "QUO" : docType === "contract" ? "CTR" : docType === "proposal" ? "PROP" : "INV"
            
            // Count existing documents of this type for this user
            const { count } = await auth.supabase
                .from("document_sessions")
                .select("id", { count: "exact", head: true })
                .eq("user_id", auth.user.id)
                .eq("document_type", docType)
            
            const nextNum = (count ?? 0) + 1
            const year = new Date().getFullYear()
            const month = String(new Date().getMonth() + 1).padStart(2, '0')
            const paddedNum = String(nextNum).padStart(3, '0')
            const nextDocNumber = `${prefix}-${year}-${month}-${paddedNum}`
            
            // Inject into the prompt as additional context
            body.prompt = `[SYSTEM: Use document number "${nextDocNumber}" for this ${docType}. Today's date is ${new Date().toISOString().split('T')[0]}. The invoice date should be today and the due date should be calculated from today based on payment terms.]\n\n${body.prompt}`
        } catch (err) {
            console.error("Failed to generate next document number:", err)
            // Continue without — AI will generate its own number
        }

        // Validate and default thinkingMode
        const validModes = ["fast", "thinking"] as const
        const rawMode = (body as any).thinkingMode
        body.thinkingMode = validModes.includes(rawMode) ? rawMode : "fast"

        // Fetch DeepSeek API key from Vault
        const { getSecret } = await import("@/lib/secrets")
        const deepseekKey = await getSecret("DEEPSEEK_API_KEY")

        // Create a readable stream from our generator
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                const sendEvent = (event: Record<string, any>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
                }

                // Extract context for progress labels
                const { country, docType: ctxDocType, clientName } = extractContextFromPrompt(
                    body.prompt,
                    body.businessContext,
                    body.documentType
                )

                // Send contextual progress steps to the client
                sendEvent({ type: "progress", step: "analyze", label: `Analyzing ${ctxDocType} request${clientName ? ` for ${clientName}` : ""}` })

                try {
                    sendEvent({ type: "progress", step: "compliance", label: `Loading ${country} compliance rules` })
                    sendEvent({ type: "progress", step: "generate", label: `Generating ${ctxDocType}${clientName ? ` for ${clientName}` : ""}` })

                    for await (const chunk of streamGenerateDocument(body, deepseekKey)) {
                        const data = `data: ${JSON.stringify(chunk)}\n\n`
                        controller.enqueue(encoder.encode(data))

                        if (chunk.type === "complete" || chunk.type === "error") {
                            break
                        }
                    }

                    // Track usage for cost protection (after successful generation)
                    await trackUsage(auth.supabase, auth.user.id, "generation", 0)

                    // Increment document count (only on actual document generation, not session creation)
                    await incrementDocumentCount(auth.supabase, auth.user.id)

                    // Audit log
                    await logAIGeneration(
                        auth.supabase,
                        auth.user.id,
                        body.documentType,
                        0, // tokens used (would need to get from API response)
                        0.00094, // estimated cost
                        request
                    )
                } catch (error) {
                    const errorData = `data: ${JSON.stringify({
                        type: "error",
                        data: sanitizeError(error),
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
                error: sanitizeError(error),
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        )
    }
}
