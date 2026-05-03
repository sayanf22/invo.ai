import { NextRequest } from "next/server"
import { streamGenerateDocument, buildPrompt, DUAL_MODE_SYSTEM_PROMPT, type AIGenerationRequest } from "@/lib/deepseek"
import { streamBedrockChat } from "@/lib/bedrock"
import { authenticateRequest, validateBodySize, sanitizeError, validateOrigin } from "@/lib/api-auth"
import { classifyIntent } from "@/lib/intent-router"

import { checkCostLimit, trackUsage, checkMessageLimit, checkDocumentTypeAllowed, incrementDocumentCount, resolveEffectiveTier } from "@/lib/cost-protection"
import { logAIGeneration } from "@/lib/audit-log"
import { sanitizeText } from "@/lib/sanitize"

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

        // SECURITY: Clear any client-sent businessContext (fetched server-side inside stream)
        body.businessContext = undefined

        // Validate and default thinkingMode
        const { resolveThinkingMode } = await import("@/lib/deepseek")
        body.thinkingMode = resolveThinkingMode((body as any).thinkingMode)

        // Fetch DeepSeek API key from Vault (before stream — fast, no activity needed)
        const { getSecret } = await import("@/lib/secrets")
        const deepseekKey = await getSecret("DEEPSEEK_API_KEY")

        // Create a readable stream — data operations happen INSIDE so we can send activity events
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder()
                const sendEvent = (event: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
                }

                try {
                    // ── 0. Classify intent & emit "Analyzing request" ─────────────
                    const docTypeName = (body.documentType || "invoice").charAt(0).toUpperCase() + (body.documentType || "invoice").slice(1)
                    const cleanedPrompt = body.prompt.replace(/\[SYSTEM:[^\]]*\]\s*/g, '').trim()
                    const promptSummary = cleanedPrompt.slice(0, 60) + (cleanedPrompt.length > 60 ? "..." : "")
                    // Pre-classify intent early so we can tailor steps
                    const intentType = classifyIntent(body.prompt) === "document" ? "document" : "chat"

                    sendEvent({
                        type: "activity",
                        action: "analyze",
                        label: intentType === "document" ? "Analyzing request" : "Analyzing question",
                        detail: intentType === "document" ? `${docTypeName} • "${promptSummary}"` : `"${promptSummary}"`,
                    })

                    // ── 1. Read business profile ──────────────────────────────────
                    sendEvent({ type: "activity", action: "read", label: "Reading business profile" })
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
                            const profileDetail = [b.name, b.country, b.default_currency || "USD"].filter(Boolean).join(" • ")
                            const profileSummary = [
                                b.name && `Company: ${b.name}`,
                                b.country && `Country: ${b.country}`,
                                `Currency: ${b.default_currency || "USD"}`,
                                b.business_type && `Type: ${b.business_type}`,
                                hasTaxRegistration ? `Tax: Registered` : `Tax: Not registered`,
                                b.default_payment_terms && `Terms: ${b.default_payment_terms}`,
                            ].filter(Boolean).join("\n")
                            sendEvent({ type: "activity", action: "read", label: "Reading business profile", detail: profileDetail || "Loaded", content: profileSummary })
                        } else {
                            sendEvent({ type: "activity", action: "read", label: "Reading business profile", detail: "Not found" })
                        }
                    } catch (err) {
                        console.error("Failed to fetch business profile:", err instanceof Error ? err.message : err)
                        sendEvent({ type: "activity", action: "read", label: "Reading business profile", detail: "Not found" })
                    }

                    // ── 2. Search compliance rules (only for document generation with a country) ──
                    const country = body.businessContext?.country || ""
                    const docType = body.documentType || "invoice"
                    let complianceRuleCount = 0
                    if (country && intentType === "document") {
                        sendEvent({ type: "activity", action: "search", label: `Searching ${country} compliance` })
                    }
                    try {
                        const { getComplianceContext } = await import("@/lib/compliance-rag")

                        const isDocGeneration = !body.conversationHistory?.length ||
                            /create|generate|make|build|draft|prepare/i.test(body.prompt)

                        const complianceResult = await getComplianceContext(
                            auth.supabase,
                            country,
                            docType,
                            isDocGeneration ? undefined : body.prompt
                        )

                        body.complianceContext = complianceResult.formattedContext
                        complianceRuleCount = complianceResult.rules.length

                        // Extract the standard tax rate from RAG rules
                        let taxRateDetail = ""
                        if (complianceResult.rules.length > 0) {
                            const taxRule = complianceResult.rules.find(r => r.category === "tax_rates")
                            if (taxRule && taxRule.requirement_value) {
                                const standardRate = (taxRule.requirement_value as any).standard
                                if (standardRate !== undefined && standardRate !== null) {
                                    (body as any)._ragTaxRate = Number(standardRate)
                                    taxRateDetail = `, ${standardRate}% tax`
                                }
                            }
                        }

                        if (complianceResult.mode === "semantic") {
                            await trackUsage(auth.supabase, auth.user.id, "embedding", 100)
                        }

                        if (country && intentType === "document") {
                            const rulesSummary = complianceResult.rules.map(r => {
                                const desc = r.description || r.requirement_key
                                if (r.category === "tax_rates") {
                                    const std = (r.requirement_value as any)?.standard
                                    return `Tax: ${std !== undefined ? std + "%" : "varies"} — ${desc}`
                                }
                                return `${r.category.replace(/_/g, " ")}: ${desc}`
                            }).join("\n")

                            sendEvent({
                                type: "activity",
                                action: "search",
                                label: `Searching ${country} compliance`,
                                detail: `Found ${complianceResult.rules.length} rules${taxRateDetail}`,
                                content: rulesSummary || "No specific rules found",
                            })
                        }
                    } catch (err) {
                        console.error("RAG compliance context failed:", err instanceof Error ? err.message : err)
                        if (country && intentType === "document") {
                            sendEvent({ type: "activity", action: "search", label: `Searching ${country} compliance`, detail: "Unavailable" })
                        }
                    }

                    // ── 3. Generate document number (only for document generation) ──
                    if (intentType === "document") {
                    try {
                        const docTypeLower = (body.documentType || "invoice").toLowerCase()
                        const prefix = docTypeLower === "quotation" ? "QUO" : docTypeLower === "contract" ? "CTR" : docTypeLower === "proposal" ? "PROP" : "INV"

                        const { count } = await auth.supabase
                            .from("document_sessions")
                            .select("id", { count: "exact", head: true })
                            .eq("user_id", auth.user.id)
                            .eq("document_type", docTypeLower)

                        const nextNum = (count ?? 0) + 1
                        const year = new Date().getFullYear()
                        const month = String(new Date().getMonth() + 1).padStart(2, '0')
                        const paddedNum = String(nextNum).padStart(3, '0')
                        const nextDocNumber = `${prefix}-${year}-${month}-${paddedNum}`

                        body.prompt = `[SYSTEM: Use document number "${nextDocNumber}" for this ${docTypeLower}. Today's date is ${new Date().toISOString().split('T')[0]}. The invoice date should be today and the due date should be calculated from today based on payment terms.]\n\n${body.prompt}`

                        sendEvent({ type: "activity", action: "generate", label: "Assigning document number", detail: nextDocNumber })
                    } catch (err) {
                        console.error("Failed to generate next document number:", err)
                        // Continue without — AI will generate its own number
                    }
                    }

                    // ── 4. Route to appropriate model ─────────────────────────────
                    const isDocGeneration = classifyIntent(body.prompt) === "document"
                    const docTypeLower = (body.documentType || "invoice").toLowerCase()

                    // Track whether any model completed successfully (for usage tracking)
                    let modelCompletedSuccessfully = false

                    if (isDocGeneration) {
                        // Use DeepSeek for document generation
                        const contextParts = [
                            body.businessContext?.name && `Business: ${body.businessContext.name}`,
                            body.businessContext?.country && `Country: ${body.businessContext.country}`,
                            body.complianceContext ? `Compliance: ${complianceRuleCount} rules loaded` : null,
                            body.conversationHistory?.length ? `History: ${body.conversationHistory.length} messages` : null,
                            body.fileContext ? `File context: included` : null,
                            body.currentData ? `Editing existing document` : `Creating new document`,
                        ].filter(Boolean).join("\n")
                        sendEvent({ type: "activity", action: "generate", label: `Writing ${docTypeLower}`, detail: "DeepSeek", content: contextParts })
                        for await (const chunk of streamGenerateDocument(body, deepseekKey)) {
                            sendEvent(chunk)
                            if (chunk.type === "complete") {
                                modelCompletedSuccessfully = true
                                break
                            }
                            if (chunk.type === "error") break
                        }
                    } else {
                        // Try Kimi K2.5 via Bedrock for chat, fall back to DeepSeek if unavailable
                        const bedrockKey = process.env.amazon_beadrocl_key
                            || (typeof globalThis !== "undefined" ? (globalThis as any).amazon_beadrocl_key : "")
                            || ""

                        if (bedrockKey && bedrockKey.length > 10) {
                            sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "Kimi K2.5" })
                            const prompt = buildPrompt(body)
                            let bedrockFailed = false
                            // Track whether any chunks were forwarded from Bedrock
                            // so we can discard partial content on fallback
                            let bedrockChunksForwarded = false
                            for await (const chunk of streamBedrockChat(DUAL_MODE_SYSTEM_PROMPT, prompt, bedrockKey)) {
                                if (chunk.type === "error") {
                                    // All Bedrock errors trigger fallback: auth (401/403),
                                    // rate limit (429), server errors (500/502/503),
                                    // timeouts, and network failures
                                    console.error("Bedrock failed, falling back to DeepSeek:", chunk.data)
                                    bedrockFailed = true
                                    break
                                }
                                // Only forward chunks if fallback hasn't triggered
                                if (!bedrockFailed) {
                                    sendEvent(chunk)
                                    if (chunk.type === "chunk") {
                                        bedrockChunksForwarded = true
                                    }
                                }
                                if (chunk.type === "complete") {
                                    modelCompletedSuccessfully = true
                                    break
                                }
                            }
                            // Fallback to DeepSeek if Bedrock failed
                            if (bedrockFailed) {
                                // If any partial chunks were forwarded, send a reset
                                // signal so the client knows to discard them
                                if (bedrockChunksForwarded) {
                                    sendEvent({ type: "error", data: "__fallback_reset__" })
                                }
                                sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "DeepSeek (fallback)" })
                                for await (const chunk of streamGenerateDocument(body, deepseekKey)) {
                                    sendEvent(chunk)
                                    if (chunk.type === "complete") {
                                        modelCompletedSuccessfully = true
                                        break
                                    }
                                    if (chunk.type === "error") break
                                }
                            }
                        } else {
                            // No Bedrock key — use DeepSeek for everything
                            sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "DeepSeek" })
                            for await (const chunk of streamGenerateDocument(body, deepseekKey)) {
                                sendEvent(chunk)
                                if (chunk.type === "complete") {
                                    modelCompletedSuccessfully = true
                                    break
                                }
                                if (chunk.type === "error") break
                            }
                        }
                    }

                    // Usage tracking only runs once after the successful model completes
                    if (modelCompletedSuccessfully) {
                        // Track usage for cost protection
                        await trackUsage(auth.supabase, auth.user.id, "generation", 0)

                        // Increment document count
                        await incrementDocumentCount(auth.supabase, auth.user.id)

                        // Audit log
                        await logAIGeneration(
                            auth.supabase,
                            auth.user.id,
                            body.documentType,
                            0,
                            0.00094,
                            request
                        )
                    }
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
