import { NextRequest } from "next/server"
import { streamGenerateDocument, buildPrompt, DUAL_MODE_SYSTEM_PROMPT, type AIGenerationRequest } from "@/lib/deepseek"
import { streamBedrockChat, streamBedrockChatWithHistory, callBedrockBrief, ORCHESTRATOR_SYSTEM_PROMPT, BUSINESS_PROFILE_COMMENTARY_PROMPT, COMPLIANCE_COMMENTARY_PROMPT, RAG_VALIDATION_PROMPT, PRE_GENERATION_BRIEF_PROMPT, CORRECTION_INSTRUCTION_PROMPT, type BedrockChatMessage } from "@/lib/bedrock"
import { authenticateRequest, validateBodySize, sanitizeError, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { classifyIntent, detectMismatch, type DocumentType as IntentDocumentType } from "@/lib/intent-router"
import { buildChatOnlySystemPrompt } from "@/lib/chat-only-prompts"
import { formatReferenceNumber } from "@/lib/document-type-registry"

import { trackUsage, checkMessageLimit, checkChatMessageLimit, checkDocumentTypeAllowed, reserveDocumentQuota, releaseDocumentQuota, getUserTier } from "@/lib/cost-protection"
import { logAIGeneration } from "@/lib/audit-log"
import { sanitizeText, stripPromptInjection } from "@/lib/sanitize"

// Streaming generation can take 60-90s in thinking mode (deepseek-v4-pro
// spends time on reasoning before emitting content).
//
// Cloudflare Workers (Paid plan): wall-clock limit is 5 minutes; CPU time is
// 30s. Streaming responses keep the request open during fetch I/O, which
// counts as wall-clock not CPU, so this is safe.
//
// `dynamic = "force-dynamic"` ensures Next.js does not try to cache or
// statically optimize the route.
export const dynamic = "force-dynamic"
// `maxDuration` is harmless on Cloudflare Workers (it ignores it), but useful
// if anyone ever deploys to Vercel as well — keeps the streaming route alive
// past the default 10s edge limit.
export const maxDuration = 120

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Validate request origin
        const originError = validateOrigin(request)
        if (originError) return originError

        // SECURITY: Authenticate user (pass request for Authorization header fallback)
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        // SECURITY: Validate CSRF token (bound to the authenticated user's session)
        const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
        if (csrfError) return csrfError

        const body: AIGenerationRequest = await request.json()

        // Detect chat-only mode early — these sessions bypass quota and use
        // a different system prompt path further down.
        const isChatOnlyMode = (body.documentType || "").toLowerCase() === "chat"

        // Fetch user tier from subscriptions table (needed for all limit checks)
        const userTier = await getUserTier(auth.supabase, auth.user.id)

        // NOTE: Document-type entitlement is enforced below, AFTER the session is
        // loaded, and ONLY for brand-new documents. Editing an already-created
        // document (including one generated during a former paid tier) must never
        // be blocked by a later downgrade — existing work always stays editable.

        const sessionId = (body as any).sessionId

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
        // SECURITY: Strip any [SYSTEM:] injection attempts from user input
        body.prompt = stripPromptInjection(body.prompt)

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
            // SECURITY: Strip any [SYSTEM:] injection attempts from file context
            body.fileContext = stripPromptInjection(body.fileContext)
            if (body.fileContext.length > 5_000) {
                body.fileContext = body.fileContext.slice(0, 5_000)
            }
        }

        if (!body.documentType) {
            body.documentType = "invoice"
        }

        // SECURITY: Validate document type against whitelist
        // 'chat' is a valid pseudo-type for chat-only advisory mode.
        // All 9 canonical document types + legacy 'quotation' alias + 'chat' are valid.
        const VALID_DOC_TYPES = [
            "invoice", "contract", "quote", "quotation", "proposal",
            "sow", "change_order", "nda", "client_onboarding_form",
            "payment_followup", "chat",
        ]
        const normalizedDocType = body.documentType.toLowerCase().trim()
        if (!VALID_DOC_TYPES.includes(normalizedDocType)) {
            body.documentType = "invoice" // Default to invoice for invalid types
        }
        // Normalize legacy "quotation" → "quote" so downstream logic uses canonical type
        if (normalizedDocType === "quotation") {
            body.documentType = "quote"
        }

        // Every AI request must be bound to an owned session. This prevents
        // calling the stream endpoint directly to bypass promotion or quota.
        if (typeof sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
            return new Response(JSON.stringify({ success: false, error: "A valid sessionId is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            })
        }
        const { data: sessionData, error: sessionError } = await auth.supabase
            .from("document_sessions")
            .select("id,status,document_type,quota_counted_at")
            .eq("id", sessionId)
            .eq("user_id", auth.user.id)
            .maybeSingle()
        if (sessionError || !sessionData) {
            return new Response(JSON.stringify({ success: false, error: "Session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            })
        }
        const requestedType = (body.documentType || "invoice").toLowerCase()
        const storedType = (sessionData.document_type || "").toLowerCase()
        const sessionMatchesRequest = requestedType === storedType
            || (requestedType === "quote" && storedType === "quotation")
        if (!sessionMatchesRequest) {
            return new Response(JSON.stringify({ success: false, error: "Session document type mismatch" }), {
                status: 409,
                headers: { "Content-Type": "application/json" },
            })
        }

        // SECURITY: Document-type entitlement (free tier only gets invoice/contract/quote).
        // Applied ONLY to new documents — a session that has already reserved its
        // document quota is existing work and remains editable on any tier, so a
        // paid→free downgrade never locks previously generated documents (all 9
        // types created while paid stay fully editable).
        if (!isChatOnlyMode && !(sessionData as any).quota_counted_at) {
            const typeError = checkDocumentTypeAllowed(requestedType, userTier)
            if (typeError) return typeError
        }
        body.sessionStatus = sessionData.status as any

        const messageLimitError = isChatOnlyMode
            ? await checkChatMessageLimit(auth.supabase, auth.user.id, sessionId, userTier)
            : await checkMessageLimit(auth.supabase, auth.user.id, sessionId, userTier)
        if (messageLimitError) return messageLimitError

        let quotaReserved = false

        // SECURITY: Clear any client-sent businessContext (fetched server-side inside stream)
        body.businessContext = undefined

        // Validate and default thinkingMode
        const { resolveThinkingMode } = await import("@/lib/deepseek")
        body.thinkingMode = resolveThinkingMode((body as any).thinkingMode)

        // Fetch DeepSeek API key from Vault (before stream — fast, no activity needed)
        const { getSecret } = await import("@/lib/secrets")
        const deepseekKey = await getSecret("DEEPSEEK_API_KEY")
        if (!isChatOnlyMode) {
            const reservation = await reserveDocumentQuota(auth.supabase, auth.user.id, sessionId)
            if (reservation.response) return reservation.response
            quotaReserved = reservation.reserved
        }
        let modelCompletedSuccessfully = false

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

                    // ── Resolve Bedrock key early (needed for orchestration gate) ──
                    const bedrockKey = process.env.amazon_beadrocl_key
                        || (typeof globalThis !== "undefined" ? (globalThis as any).amazon_beadrocl_key : "")
                        || ""

                    // ── 0b. Chat-only mode short-circuit ────────────────────────
                    // When documentType === 'chat', this is a pre-document advisory
                    // conversation. No compliance, no orchestration, no JSON —
                    // just a conversational response using the chat-only system
                    // prompt. The AI may include a [CREATE_CARD:{...}] signal at
                    // the end of its response when the user confirms they want
                    // to create a document.
                    if (isChatOnlyMode) {
                        try {
                            // Build multi-turn message history for Kimi K2.5.
                            // conversationHistory contains all prior turns; the current
                            // user message is in body.prompt (already sanitized above).
                            const historyMessages: BedrockChatMessage[] = [
                                ...(body.conversationHistory || []).map(m => ({
                                    role: m.role as "user" | "assistant",
                                    content: m.content,
                                })),
                                { role: "user" as const, content: cleanedPrompt },
                            ]

                            // Use Kimi K2.5 via Bedrock if available (preferred — fast, context-aware).
                            // Fall back to DeepSeek if Bedrock key is missing or fails.
                            if (bedrockKey && bedrockKey.length > 10) {
                                sendEvent({ type: "activity", action: "think", label: "Thinking", detail: "Clorefy Advisor" })
                                let bedrockFailed = false
                                for await (const chunk of streamBedrockChatWithHistory(buildChatOnlySystemPrompt(userTier), historyMessages, bedrockKey, 1500)) {
                                    if (chunk.type === "error") {
                                        console.error("Bedrock chat-only failed, falling back:", chunk.data)
                                        bedrockFailed = true
                                        break
                                    }
                                    sendEvent(chunk)
                                    if (chunk.type === "complete") break
                                }
                                if (bedrockFailed) {
                                    sendEvent({ type: "activity", action: "think", label: "Thinking", detail: "Clorefy" })
                                    // DeepSeek fallback: inject system prompt + history into the prompt
                                    const historyText = historyMessages.slice(0, -1)
                                        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                                        .join("\n")
                                    const fallbackBody: AIGenerationRequest = {
                                        ...body,
                                        documentType: "chat",
                                        prompt: `[SYSTEM: ${buildChatOnlySystemPrompt(userTier)}]\n\n${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ""}USER: ${cleanedPrompt}`,
                                    }
                                    for await (const chunk of streamGenerateDocument(fallbackBody, deepseekKey)) {
                                        sendEvent(chunk)
                                        if (chunk.type === "complete") break
                                        if (chunk.type === "error") break
                                    }
                                }
                            } else {
                                sendEvent({ type: "activity", action: "think", label: "Thinking", detail: "Clorefy" })
                                const historyText = historyMessages.slice(0, -1)
                                    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
                                    .join("\n")
                                const fallbackBody: AIGenerationRequest = {
                                    ...body,
                                    documentType: "chat",
                                    prompt: `[SYSTEM: ${buildChatOnlySystemPrompt(userTier)}]\n\n${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ""}USER: ${cleanedPrompt}`,
                                }
                                for await (const chunk of streamGenerateDocument(fallbackBody, deepseekKey)) {
                                    sendEvent(chunk)
                                    if (chunk.type === "complete") break
                                    if (chunk.type === "error") break
                                }
                            }
                        } catch (err) {
                            console.error("Chat-only mode error:", err instanceof Error ? err.message : err)
                            sendEvent({ type: "error", data: "Chat mode temporarily unavailable. Please try again." })
                        }
                        // Chat-only mode never consumes quota, never increments usage,
                        // never runs compliance validation. Close the stream.
                        return
                    }

                    // ── 0c. Mismatch pre-flight (typed sessions only) ──────────
                    // If the user's prompt asks for a document type that does not
                    // fit their stated goal (e.g., a contract for a payment),
                    // emit a mismatch-redirect event and close the stream. The
                    // client routes to the chat-only screen with the AI's
                    // redirect message.
                    if (intentType === "document") {
                        const requestedType = (body.documentType || "invoice").toLowerCase() as IntentDocumentType
                        if (requestedType === "invoice" || requestedType === "contract" || requestedType === "quote" || requestedType === "proposal") {
                            const mismatch = detectMismatch(cleanedPrompt, requestedType)
                            if (mismatch) {
                                const initialMessage = `I see you want to create a ${mismatch.requestedType} here, but ${mismatch.reason} Want me to create a ${mismatch.suggestedType} instead?\n\n[CREATE_CARD:{"type":"${mismatch.suggestedType}","summary":"Suggested ${mismatch.suggestedType} based on your request"}]`
                                sendEvent({
                                    type: "mismatch-redirect",
                                    requestedType: mismatch.requestedType,
                                    suggestedType: mismatch.suggestedType,
                                    reason: mismatch.reason,
                                    initialMessage,
                                })
                                return
                            }
                        }
                    }

                    // Orchestration gate: document intent + valid Bedrock key.
                    // Both fast AND thinking mode use Kimi as the planner — the
                    // difference is which DeepSeek model generates (chat vs v4-pro)
                    // and how detailed the brief is (lighter for fast mode).
                    const shouldOrchestrate = intentType === "document" && bedrockKey && bedrockKey.length > 10
                    const orchestrateInThinkingMode = body.thinkingMode === "thinking" && shouldOrchestrate

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

                    // ── 1b. Start Kimi commentary on business profile (non-blocking) ──
                    let profileCommentaryPromise: Promise<string | null> | null = null
                    let profileDetailForCommentary = ""
                    if (orchestrateInThinkingMode && body.businessContext?.name) {
                        profileDetailForCommentary = [body.businessContext.name, body.businessContext.country, body.businessContext.currency || "USD"].filter(Boolean).join(" • ")
                        profileCommentaryPromise = callBedrockBrief(
                            ORCHESTRATOR_SYSTEM_PROMPT,
                            BUSINESS_PROFILE_COMMENTARY_PROMPT({
                                name: body.businessContext.name,
                                country: body.businessContext.country || "",
                                currency: body.businessContext.currency || "USD",
                                taxRegistered: !!body.businessContext.taxRegistered,
                                businessType: body.businessContext.businessType || "",
                            }),
                            bedrockKey,
                            100
                        )
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

                    // ── 2b. Await business profile commentary (was running in parallel with compliance fetch) ──
                    if (profileCommentaryPromise) {
                        const commentary = await profileCommentaryPromise
                        if (commentary) {
                            sendEvent({ type: "activity", action: "read", label: "Reading business profile", detail: profileDetailForCommentary || "Loaded", content: commentary })
                        }
                    }

                    // ── 2d. Reference documents — Kimi decides, then retrieve ──
                    // Agentic RAG: Kimi (the orchestrator) decides whether the
                    // user's uploaded reference documents are relevant to THIS
                    // request. Only if it decides RETRIEVE do we embed the query
                    // and pull matching passages. Falls back to a heuristic
                    // classifier when Kimi is unavailable. Small edits / questions
                    // are skipped so trivial changes stay fast and undiluted.
                    try {
                        const { classifyRetrievalIntent, getReferenceContext, isUuid } = await import("@/lib/context-rag")
                        const rawRefSession = (body as any).sessionId
                        const refSessionId = isUuid(rawRefSession) ? rawRefSession as string : undefined
                        const hasExistingDocument = !!(body.currentData && Object.keys(body.currentData).length > 0)

                        // Reference context is a Pro-and-above feature.
                        const contextTierAllowed = userTier === "pro" || userTier === "agency"
                        if (refSessionId && intentType === "document" && contextTierAllowed) {
                            // Resolve chain + list of ready reference docs (existence gate).
                            const { data: sess } = await auth.supabase
                                .from("document_sessions")
                                .select("chain_id")
                                .eq("id", refSessionId)
                                .eq("user_id", auth.user.id)
                                .single()
                            const refChainId: string | null = (sess as any)?.chain_id ?? null

                            let docsQuery = (auth.supabase as any)
                                .from("context_documents")
                                .select("file_name")
                                .eq("user_id", auth.user.id)
                                .eq("status", "ready")
                                .limit(10)
                            if (refChainId) {
                                // Include docs attached to any session in the chain
                                // (mirrors the RPC's chain-membership logic).
                                const { data: chainSessions } = await auth.supabase
                                    .from("document_sessions")
                                    .select("id")
                                    .eq("user_id", auth.user.id)
                                    .eq("chain_id", refChainId)
                                const chainSessionIds = (chainSessions ?? []).map((s: any) => s.id).filter(Boolean)
                                if (refSessionId && !chainSessionIds.includes(refSessionId)) chainSessionIds.push(refSessionId)
                                docsQuery = chainSessionIds.length > 0
                                    ? docsQuery.or(`chain_id.eq.${refChainId},session_id.in.(${chainSessionIds.join(",")})`)
                                    : docsQuery.eq("chain_id", refChainId)
                            } else {
                                docsQuery = docsQuery.eq("session_id", refSessionId)
                            }
                            const { data: refDocs } = await docsQuery
                            const referenceFiles: string[] = (refDocs ?? []).map((d: any) => d.file_name).filter(Boolean)

                            if (referenceFiles.length > 0) {
                                // Decision: Kimi first, heuristic fallback.
                                let shouldRetrieve = false
                                let decisionReason = ""
                                if (bedrockKey && bedrockKey.length > 10) {
                                    sendEvent({ type: "activity", action: "think", label: "Checking your reference documents", detail: "Clorefy" })
                                    const { decideReferenceRetrieval } = await import("@/lib/bedrock")
                                    const kimiDecision = await decideReferenceRetrieval(bedrockKey, {
                                        userPrompt: cleanedPrompt,
                                        documentType: docType,
                                        hasExistingDocument,
                                        referenceFiles,
                                    })
                                    if (kimiDecision) {
                                        shouldRetrieve = kimiDecision.retrieve
                                        decisionReason = kimiDecision.reason
                                    } else {
                                        const h = classifyRetrievalIntent(cleanedPrompt, hasExistingDocument)
                                        shouldRetrieve = h.retrieve
                                        decisionReason = "heuristic fallback"
                                    }
                                } else {
                                    const h = classifyRetrievalIntent(cleanedPrompt, hasExistingDocument)
                                    shouldRetrieve = h.retrieve
                                    decisionReason = "heuristic"
                                }

                                if (shouldRetrieve) {
                                    sendEvent({ type: "activity", action: "search", label: "Reading your reference documents", detail: decisionReason || undefined })
                                    const refContext = await getReferenceContext(auth.supabase, {
                                        userId: auth.user.id,
                                        chainId: refChainId,
                                        sessionId: refSessionId,
                                        query: cleanedPrompt,
                                        documentType: docType,
                                    })
                                    if (refContext.retrieved) {
                                        // Retrieved text originates from user-uploaded files → treat as
                                        // untrusted data: strip any [SYSTEM:]-style injection attempts.
                                        body.referenceContext = stripPromptInjection(refContext.formattedContext).slice(0, 12_000)
                                        await trackUsage(auth.supabase, auth.user.id, "embedding", 100)
                                        sendEvent({
                                            type: "activity",
                                            action: "search",
                                            label: "Reading your reference documents",
                                            detail: `Matched ${refContext.chunks.length} passage${refContext.chunks.length === 1 ? "" : "s"} from ${refContext.sourceFiles.length} file${refContext.sourceFiles.length === 1 ? "" : "s"}`,
                                            content: refContext.sourceFiles.join(", "),
                                        })
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Reference-context retrieval failed:", err instanceof Error ? err.message : err)
                    }

                    // ── 2c. Kimi compliance rules commentary ──
                    let complianceRulesForValidation: any[] = []
                    if (orchestrateInThinkingMode) {
                        try {
                            const { getComplianceContext: getComplianceCtx } = await import("@/lib/compliance-rag")
                            // We already fetched compliance above; re-use complianceRuleCount and body.complianceContext
                            // Build rules summary for Kimi from the compliance context already on body
                            const complianceCategories: string[] = []
                            const complianceKeyValues: string[] = []

                            // Re-fetch rules for the summary (lightweight — already cached by Supabase)
                            try {
                                const compResult = await getComplianceCtx(auth.supabase, country, docType)
                                complianceRulesForValidation = compResult.rules
                                for (const r of compResult.rules) {
                                    if (!complianceCategories.includes(r.category)) {
                                        complianceCategories.push(r.category)
                                    }
                                    const desc = r.description || r.requirement_key
                                    if (r.category === "tax_rates") {
                                        const std = (r.requirement_value as any)?.standard
                                        complianceKeyValues.push(`Tax: ${std !== undefined ? std + "%" : "varies"} — ${desc}`)
                                    } else {
                                        complianceKeyValues.push(`${r.category.replace(/_/g, " ")}: ${desc}`)
                                    }
                                }
                            } catch {
                                // Use what we already have
                            }

                            const complianceCommentary = await callBedrockBrief(
                                ORCHESTRATOR_SYSTEM_PROMPT,
                                COMPLIANCE_COMMENTARY_PROMPT({
                                    country: country || "Unknown",
                                    ruleCount: complianceRuleCount,
                                    categories: complianceCategories,
                                    keyValues: complianceKeyValues.join("\n") || "None",
                                }),
                                bedrockKey,
                                100
                            )

                            if (complianceCommentary && country && intentType === "document") {
                                sendEvent({
                                    type: "activity",
                                    action: "search",
                                    label: `Searching ${country} compliance`,
                                    detail: `Found ${complianceRuleCount} rules`,
                                    content: complianceCommentary,
                                })
                            }
                        } catch (err) {
                            console.error("Kimi compliance commentary failed:", err instanceof Error ? err.message : err)
                        }
                    }

                    // ── 2d. If user explicitly asks to add tax, inform about RAG rate ──
                    // When user asks to add tax and business is unregistered, inject the RAG rate
                    // into the prompt so the AI can ask the user to confirm before applying
                    const userWantsTax = /\b(add|apply|include|with|want)\b.*\b(gst|vat|tax|ust|tva|btw|hst)\b/i.test(body.prompt)
                        || /\b(gst|vat|tax|ust|tva|btw|hst)\b.*\b(add|apply|include)\b/i.test(body.prompt)

                    if (userWantsTax && (body as any)._ragTaxRate !== undefined && body.businessContext) {
                        if (!body.businessContext.taxRegistered) {
                            // Business is NOT registered — tell the AI to ask the user
                            body.prompt = `[SYSTEM: The user wants to add tax. Their business is NOT registered for GST/VAT. The RAG compliance database says the standard rate for ${country} is ${(body as any)._ragTaxRate}%. Ask the user: "Your business isn't registered for GST. Would you like me to add ${(body as any)._ragTaxRate}% GST anyway?" If the user confirms (says yes, add it, ok, sure, etc.), regenerate the document with taxRate=${(body as any)._ragTaxRate}. Do NOT add tax without user confirmation.]\n\n${body.prompt}`
                        } else {
                            // Business IS registered — just use the RAG rate directly
                            body.prompt = `[SYSTEM: The user has explicitly requested tax. Use the RAG-provided tax rate of ${(body as any)._ragTaxRate}% from the compliance database.]\n\n${body.prompt}`
                        }
                    }

                    // ── 3. Generate document number (only for document generation) ──
                    if (intentType === "document") {
                    try {
                        const docTypeLower = (body.documentType || "invoice").toLowerCase()

                        const { count } = await auth.supabase
                            .from("document_sessions")
                            .select("id", { count: "exact", head: true })
                            .eq("user_id", auth.user.id)
                            .eq("document_type", docTypeLower)

                        // Single source of truth: registry-driven prefix +
                        // YYYY-MM-NNN format. Same helper is used at persist
                        // time to coerce any AI-produced reference number to
                        // the correct prefix for this document type.
                        const nextDocNumber = formatReferenceNumber(docTypeLower, (count ?? 0) + 1)

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
                    let completeResponseData: string | null = null

                    // ── 3b. Kimi pre-generation brief (Thinking Mode orchestration) ──
                    // Before DeepSeek generates, Kimi analyzes the request and produces
                    // specific instructions that get injected into DeepSeek's prompt.
                    // This is the core orchestration: Kimi GUIDES DeepSeek on what to do.
                    let kimiInstructionBrief: string | null = null
                    if (shouldOrchestrate && isDocGeneration) {
                        try {
                            sendEvent({ type: "activity", action: "think", label: "Planning document generation" })

                            // Build the compliance rules summary for the brief.
                            // In thinking mode, complianceRulesForValidation is already
                            // populated. In fast mode, we use a lighter summary built
                            // from the body.complianceContext string (already fetched
                            // earlier in the pipeline, no extra DB call).
                            let briefRulesSummary = ""
                            if (complianceRulesForValidation.length > 0) {
                                briefRulesSummary = complianceRulesForValidation.map(r => {
                                    const desc = r.description || r.requirement_key
                                    if (r.category === "tax_rates") {
                                        const std = (r.requirement_value as any)?.standard
                                        return `Tax Rate: ${std !== undefined ? std + "%" : "varies"} — ${desc}`
                                    }
                                    return `${r.category.replace(/_/g, " ")}: ${desc} (${JSON.stringify(r.requirement_value)})`
                                }).join("\n")
                            } else if (body.complianceContext) {
                                // Fast mode: trim the compliance context to first 800 chars
                                briefRulesSummary = body.complianceContext.slice(0, 800)
                            }

                            // Lighter token budget in fast mode — Kimi gives a quick plan,
                            // not a full audit. Thinking mode gets more tokens for depth.
                            const briefMaxTokens = body.thinkingMode === "thinking" ? 300 : 150

                            kimiInstructionBrief = await callBedrockBrief(
                                ORCHESTRATOR_SYSTEM_PROMPT,
                                PRE_GENERATION_BRIEF_PROMPT({
                                    userPrompt: body.prompt.replace(/\[SYSTEM:[^\]]*\]\s*/g, '').trim(),
                                    documentType: docTypeLower,
                                    country: country || "Unknown",
                                    currency: body.businessContext?.currency || "USD",
                                    taxRegistered: !!body.businessContext?.taxRegistered,
                                    taxRate: (body as any)._ragTaxRate,
                                    complianceRules: briefRulesSummary || "None available",
                                    businessName: body.businessContext?.name || "Unknown",
                                    businessType: body.businessContext?.businessType || "Unknown",
                                    hasExistingDocument: !!(body.currentData && Object.keys(body.currentData).length > 0),
                                }),
                                bedrockKey,
                                briefMaxTokens
                            )

                            if (kimiInstructionBrief) {
                                // Inject Kimi's instructions into DeepSeek's prompt
                                body.prompt = `[SYSTEM: ORCHESTRATOR INSTRUCTIONS — Follow these requirements precisely:\n${kimiInstructionBrief}\nEnd of orchestrator instructions.]\n\n${body.prompt}`

                                sendEvent({
                                    type: "activity",
                                    action: "think",
                                    label: "Planning document generation",
                                    detail: "Instructions ready",
                                    content: kimiInstructionBrief,
                                })
                            } else {
                                sendEvent({
                                    type: "activity",
                                    action: "think",
                                    label: "Planning document generation",
                                    detail: "Skipped",
                                })
                            }
                        } catch (err) {
                            console.error("Kimi pre-generation brief failed:", err instanceof Error ? err.message : err)
                            // Continue without — DeepSeek will generate using its own judgment
                        }
                    }

                    if (isDocGeneration) {
                        // Use DeepSeek for document generation
                        const contextParts = [
                            body.businessContext?.name && `Business: ${body.businessContext.name}`,
                            body.businessContext?.country && `Country: ${body.businessContext.country}`,
                            body.complianceContext ? `Compliance: ${complianceRuleCount} rules loaded` : null,
                            kimiInstructionBrief ? `Orchestrator: Instructions injected` : null,
                            body.conversationHistory?.length ? `History: ${body.conversationHistory.length} messages` : null,
                            body.fileContext ? `File context: included` : null,
                            body.currentData ? `Editing existing document` : `Creating new document`,
                        ].filter(Boolean).join("\n")
                        const modelDetail = body.thinkingMode === "thinking" ? "Clorefy • Deep Think" : "Clorefy"
                        sendEvent({ type: "activity", action: "generate", label: `Writing ${docTypeLower}`, detail: modelDetail, content: contextParts })
                        for await (const chunk of streamGenerateDocument(body, deepseekKey)) {
                            sendEvent(chunk)
                            if (chunk.type === "complete") {
                                completeResponseData = chunk.data as string || null
                                modelCompletedSuccessfully = true
                                break
                            }
                            if (chunk.type === "error") break
                        }
                    } else {
                        // Try Kimi K2.5 via Bedrock for chat, fall back to DeepSeek if unavailable
                        if (bedrockKey && bedrockKey.length > 10) {
                            sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "Clorefy" })
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
                                sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "Clorefy" })
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
                            sendEvent({ type: "activity", action: "think", label: "Thinking about your question", detail: "Clorefy" })
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

                    // ── 4b. Type-specific Zod schema validation (new document types) ──
                    // For SOW, Change Order, NDA, Client Onboarding Form, and Payment Follow-up,
                    // validate the generated JSON against the correct Zod schema. Validation is
                    // lenient — optional fields may be absent. Only reject if CRITICAL required
                    // fields are missing. On failure, retry generation once with a correction
                    // hint, then accept the second attempt even if imperfect (the document is
                    // still usable).
                    if (modelCompletedSuccessfully && completeResponseData && isDocGeneration) {
                        const schemaDocType = (body.documentType || "invoice").toLowerCase().trim()
                        const SCHEMA_VALIDATED_TYPES = ["sow", "change_order", "nda", "client_onboarding_form", "payment_followup"]
                        if (SCHEMA_VALIDATED_TYPES.includes(schemaDocType)) {
                            try {
                                const {
                                    sowSchema,
                                    changeOrderSchema,
                                    ndaSchema,
                                    clientOnboardingFormSchema,
                                    paymentFollowupSchema,
                                } = await import("@/lib/document-schemas")

                                // Critical fields — if ANY of these are missing, validation fails
                                // and we retry. Other missing fields are treated as optional.
                                const CRITICAL_FIELDS: Record<string, string[]> = {
                                    sow: ["projectOverview", "scopeItems", "fromName", "toName"],
                                    change_order: ["description", "fromName", "toName", "effectiveDate"],
                                    nda: ["parties", "confidentialInfoDefinition", "obligations", "governingLaw"],
                                    client_onboarding_form: ["clientName", "projectName", "fromName"],
                                    payment_followup: ["invoiceNumber", "invoiceAmount", "fromName", "toName", "reminderTone"],
                                }

                                // Build a lenient (partial) schema per type — all fields become
                                // optional for the purpose of AI output validation. We then
                                // manually check only the critical fields are non-null/non-empty.
                                const schemaMap: Record<string, import("zod").ZodTypeAny> = {
                                    sow: sowSchema.partial(),
                                    change_order: changeOrderSchema.partial(),
                                    nda: ndaSchema.partial(),
                                    client_onboarding_form: clientOnboardingFormSchema.partial(),
                                    payment_followup: paymentFollowupSchema.partial(),
                                }
                                const partialSchema = schemaMap[schemaDocType]
                                const criticalFields = CRITICAL_FIELDS[schemaDocType] ?? []

                                /**
                                 * Lenient validate:
                                 * 1. Parse JSON, extract document object.
                                 * 2. Run partial safeParse (all fields optional).
                                 * 3. Check critical fields exist and are non-empty.
                                 * Returns { ok: true } or { ok: false, issues, criticalMissing }.
                                 */
                                const validateAndExtract = (raw: string): { ok: true } | { ok: false; issues: any; criticalMissing: string[] } => {
                                    try {
                                        const parsed = JSON.parse(raw)
                                        const docObj = parsed.document || parsed
                                        const targetObj = docObj

                                        // Lenient parse — unknown/extra fields stripped, missing allowed
                                        const result = partialSchema.safeParse(targetObj)
                                        if (!result.success) {
                                            return {
                                                ok: false,
                                                issues: result.error.errors,
                                                criticalMissing: [],
                                            }
                                        }

                                        // Check critical fields on the parsed data
                                        const missing: string[] = []
                                        for (const field of criticalFields) {
                                            const val = (result.data as any)[field]
                                            const isEmpty =
                                                val === undefined ||
                                                val === null ||
                                                val === "" ||
                                                (Array.isArray(val) && val.length === 0)
                                            if (isEmpty) missing.push(field)
                                        }

                                        if (missing.length > 0) {
                                            return { ok: false, issues: `Missing critical fields`, criticalMissing: missing }
                                        }

                                        return { ok: true }
                                    } catch (e: any) {
                                        return { ok: false, issues: e?.message || String(e), criticalMissing: [] }
                                    }
                                }

                                const firstTry = validateAndExtract(completeResponseData)
                                if (!firstTry.ok) {
                                    // Build a human-readable summary of what's wrong
                                    const criticalSummary = firstTry.criticalMissing.length > 0
                                        ? `Critical fields missing: ${firstTry.criticalMissing.join(", ")}`
                                        : Array.isArray(firstTry.issues)
                                            ? firstTry.issues.map((i: any) => `${i.path?.join(".") || "?"}: ${i.message}`).join("; ")
                                            : String(firstTry.issues)

                                    sendEvent({ type: "activity", action: "validate", label: "Schema validation — retrying", detail: "Fixing structure" })

                                    const retryBody: typeof body = {
                                        ...body,
                                        prompt: `[SYSTEM: The previous ${schemaDocType} document was missing required fields: ${criticalSummary}. Please regenerate and ensure ALL required fields are present. Return the corrected document in full.]\n\n${body.prompt}`,
                                        conversationHistory: [],
                                        currentData: undefined,
                                    }
                                    let retryData: string | null = null
                                    for await (const chunk of streamGenerateDocument(retryBody, deepseekKey)) {
                                        if (chunk.type === "complete") {
                                            retryData = chunk.data as string || null
                                            break
                                        }
                                        if (chunk.type === "error") break
                                    }
                                    if (retryData) {
                                        const secondTry = validateAndExtract(retryData)
                                        if (secondTry.ok) {
                                            completeResponseData = retryData
                                            sendEvent({ type: "complete", data: retryData })
                                            sendEvent({ type: "activity", action: "validate", label: "Schema validation", detail: "Passed" })
                                        } else {
                                            // Second attempt still failed — use first result (document is
                                            // still partially usable), but log server-side for diagnostics
                                            console.error(`[schema-validation] ${schemaDocType} failed twice:`, secondTry.issues, "criticalMissing:", secondTry.criticalMissing)
                                        }
                                    }
                                }
                            } catch (schemaErr) {
                                console.error("[schema-validation] Import or validation error:", schemaErr instanceof Error ? schemaErr.message : schemaErr)
                                // Non-fatal — continue with the generated document as-is
                            }
                        }
                    }

                    // ── 5. RAG validation + auto-correction (Thinking Mode only) ──
                    // Kimi validates the generated document against compliance rules.
                    // If issues are found, Kimi produces correction instructions and
                    // DeepSeek regenerates with those fixes applied.
                    if (orchestrateInThinkingMode && modelCompletedSuccessfully && complianceRulesForValidation.length > 0 && completeResponseData) {
                        try {
                            sendEvent({ type: "activity", action: "validate", label: "Validating compliance" })

                            // Extract key fields from the generated document for validation
                            let docFields = completeResponseData
                            try {
                                const parsed = JSON.parse(completeResponseData)
                                const docObj = parsed.document || parsed
                                // Extract only the fields relevant for compliance validation
                                const relevant: Record<string, any> = {}
                                const src = docObj
                                if (src.taxRate !== undefined) relevant.taxRate = src.taxRate
                                if (src.tax_rate !== undefined) relevant.tax_rate = src.tax_rate
                                if (src.taxLabel !== undefined) relevant.taxLabel = src.taxLabel
                                if (src.currency !== undefined) relevant.currency = src.currency
                                if (src.items !== undefined) relevant.items = src.items
                                if (src.fromTaxId !== undefined) relevant.fromTaxId = src.fromTaxId
                                if (src.invoiceNumber !== undefined) relevant.invoiceNumber = src.invoiceNumber
                                if (src.referenceNumber !== undefined) relevant.referenceNumber = src.referenceNumber
                                if (src.invoiceDate !== undefined) relevant.invoiceDate = src.invoiceDate
                                if (src.dueDate !== undefined) relevant.dueDate = src.dueDate
                                if (src.toName !== undefined) relevant.toName = src.toName
                                if (src.toEmail !== undefined) relevant.toEmail = src.toEmail
                                if (src.paymentTerms !== undefined) relevant.paymentTerms = src.paymentTerms
                                docFields = JSON.stringify(relevant, null, 2)
                            } catch {
                                // If not valid JSON, use first 2000 chars of raw response
                                docFields = completeResponseData.slice(0, 2000)
                            }

                            // Build RAG rules summary for validation
                            const ragSummary = complianceRulesForValidation.map(r => {
                                const desc = r.description || r.requirement_key
                                if (r.category === "tax_rates") {
                                    const std = (r.requirement_value as any)?.standard
                                    return `Tax Rate: ${std !== undefined ? std + "%" : "varies"} — ${desc}`
                                }
                                return `${r.category.replace(/_/g, " ")}: ${desc} (${JSON.stringify(r.requirement_value)})`
                            }).join("\n")

                            const validation = await callBedrockBrief(
                                ORCHESTRATOR_SYSTEM_PROMPT,
                                RAG_VALIDATION_PROMPT({ documentJson: docFields, ragRules: ragSummary }),
                                bedrockKey,
                                200
                            )

                            if (validation) {
                                const hasIssues = validation.includes("⚠️")
                                sendEvent({
                                    type: "activity",
                                    action: "validate",
                                    label: "Validating compliance",
                                    detail: hasIssues ? "Issues found — correcting" : "Compliant",
                                    content: validation,
                                })

                                // ── 5b. Auto-correction: if Kimi found issues, get correction instructions and regenerate ──
                                if (hasIssues) {
                                    try {
                                        sendEvent({ type: "activity", action: "generate", label: "Applying corrections" })

                                        // Ask Kimi for specific correction instructions
                                        const correctionInstructions = await callBedrockBrief(
                                            ORCHESTRATOR_SYSTEM_PROMPT,
                                            CORRECTION_INSTRUCTION_PROMPT({
                                                validationResult: validation,
                                                documentJson: docFields,
                                                ragRules: ragSummary,
                                            }),
                                            bedrockKey,
                                            300
                                        )

                                        if (correctionInstructions && !correctionInstructions.includes("NO_FIXES_NEEDED")) {
                                            sendEvent({
                                                type: "activity",
                                                action: "generate",
                                                label: "Applying corrections",
                                                detail: "Regenerating",
                                                content: correctionInstructions,
                                            })

                                            // Build a correction prompt for DeepSeek with the original document + fixes
                                            const correctionBody: AIGenerationRequest = {
                                                ...body,
                                                prompt: `[SYSTEM: CORRECTION PASS — The orchestrator found compliance issues in the document you just generated. Apply these fixes to the EXISTING document below. Do NOT start from scratch — only change the specific fields listed. Return the complete corrected document JSON.\n\nFIXES REQUIRED:\n${correctionInstructions}\n\nORIGINAL DOCUMENT:\n${completeResponseData}\n\nReturn the corrected document in the same JSON format. Only change what the fixes require — keep everything else identical.]\n\n${body.prompt}`,
                                                currentData: undefined, // Don't send currentData — we're providing the full doc in the prompt
                                                conversationHistory: [], // Clean slate for correction
                                            }

                                            // Regenerate with corrections — collect server-side only.
                                            // Do NOT forward chunks to client (would cause duplicate
                                            // progress steps and pollute fullContent). Only send the
                                            // final corrected `complete` event which overrides the original.
                                            let correctedData: string | null = null
                                            for await (const chunk of streamGenerateDocument(correctionBody, deepseekKey)) {
                                                if (chunk.type === "complete") {
                                                    correctedData = chunk.data as string || null
                                                    break
                                                }
                                                if (chunk.type === "error") {
                                                    console.error("Correction generation error:", chunk.data)
                                                    break
                                                }
                                                // Skip chunk/reasoning events — don't forward to client
                                            }

                                            // If correction succeeded, send the corrected complete event
                                            // to the client. This overrides the original completeData.
                                            if (correctedData) {
                                                completeResponseData = correctedData
                                                sendEvent({ type: "complete", data: correctedData })
                                                sendEvent({
                                                    type: "activity",
                                                    action: "validate",
                                                    label: "Corrections applied",
                                                    detail: "Document updated",
                                                })
                                            }
                                        } else {
                                            // Kimi said no fixes needed despite ⚠️ — just report
                                            sendEvent({
                                                type: "activity",
                                                action: "generate",
                                                label: "Applying corrections",
                                                detail: "No actionable fixes",
                                            })
                                        }
                                    } catch (corrErr) {
                                        console.error("Kimi auto-correction failed:", corrErr instanceof Error ? corrErr.message : corrErr)
                                        // Document is still usable — just not corrected
                                        sendEvent({
                                            type: "activity",
                                            action: "generate",
                                            label: "Applying corrections",
                                            detail: "Skipped (error)",
                                        })
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("Kimi RAG validation failed:", err instanceof Error ? err.message : err)
                        }
                    }

                    // Usage tracking only runs once after the successful model completes
                    if (modelCompletedSuccessfully) {
                        // Track usage for cost protection
                        await trackUsage(auth.supabase, auth.user.id, "generation", 0)

                        // The monthly document slot was reserved atomically before
                        // generation. Follow-up edits reuse the session reservation.

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
                    if (quotaReserved && !modelCompletedSuccessfully) {
                        await releaseDocumentQuota(auth.user.id, sessionId).catch((releaseError) => {
                            console.error("Failed to release document quota reservation:", releaseError)
                        })
                    }
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
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
