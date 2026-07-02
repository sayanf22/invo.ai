/**
 * Session Creation API
 * Server-side endpoint to create new document sessions
 * SECURITY: All session logic runs on backend with proper validation
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { incrementDocumentCount, checkDocumentLimit, checkDocumentTypeAllowed, getUserTier } from "@/lib/cost-protection"
import { resolveEffectiveTier, type UserTier } from "@/lib/cost-protection"
import { normalizeDocumentType, getDocumentTypeConfig, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"

interface CreateSessionRequest {
    documentType: string
    initialPrompt?: string
    forceNew?: boolean // bypass deduplication (e.g. explicit "New conversation" click)
    /** Optional: session ID of a parent document to link this document to */
    parentSessionId?: string
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body: CreateSessionRequest = await request.json()

        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        // Normalize to canonical document type (handles "quotation" → "quote" too)
        const normalizedType = normalizeDocumentType(body.documentType)
        if (!normalizedType) {
            return NextResponse.json(
                { success: false, error: `Invalid document type. Must be one of: ${ALL_DOCUMENT_TYPES.join(", ")}` },
                { status: 400 }
            )
        }

        let sanitizedPrompt: string | undefined
        if (body.initialPrompt) {
            sanitizedPrompt = sanitizeText(body.initialPrompt)
            if (sanitizedPrompt.length > 10_000) {
                return NextResponse.json(
                    { success: false, error: "Initial prompt too long. Maximum 10,000 characters." },
                    { status: 400 }
                )
            }
        }

        // Fetch user tier from subscriptions table, default to "free"
        const userTier = await getUserTier(auth.supabase, auth.user.id)

        // Check document type is allowed for this tier (fast, no DB query)
        const typeError = checkDocumentTypeAllowed(normalizedType, userTier)
        if (typeError) return typeError

        // Check document limit for this tier (requires DB query)
        const limitError = await checkDocumentLimit(auth.supabase, auth.user.id, userTier)
        if (limitError) return limitError

        // ── Parent document reference handling ─────────────────────────────────
        let parentContext: Record<string, any> = {}
        let chainId: string | null = null
        let clientName: string | null = null

        if (body.parentSessionId) {
            // Validate UUID format
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            if (!uuidRegex.test(body.parentSessionId)) {
                return NextResponse.json(
                    { success: false, error: "Invalid parentSessionId" },
                    { status: 400 }
                )
            }

            // Load the parent session
            const { data: parentSession, error: parentError } = await auth.supabase
                .from("document_sessions")
                .select("id, document_type, chain_id, client_name, context")
                .eq("id", body.parentSessionId)
                .eq("user_id", auth.user.id)
                .single()

            if (parentError || !parentSession) {
                return NextResponse.json(
                    { success: false, error: "Parent session not found" },
                    { status: 404 }
                )
            }

            const parentType = normalizeDocumentType(parentSession.document_type)

            // Flexible linking: any document type can be linked as the parent of
            // any other document type. `validParentTypes` is now empty for every
            // type in the registry, so this check is a no-op today — kept so a
            // future type-specific restriction can be reintroduced without
            // touching this route again.
            const childConfig = getDocumentTypeConfig(normalizedType)
            if (childConfig && childConfig.validParentTypes.length > 0) {
                if (!parentType || !childConfig.validParentTypes.includes(parentType)) {
                    const allowed = childConfig.validParentTypes.join(", ")
                    return NextResponse.json(
                        {
                            success: false,
                            error: `Invalid parent type. ${childConfig.label} can only link to: ${allowed}. Parent is "${parentSession.document_type}".`,
                        },
                        { status: 400 }
                    )
                }
            }

            // Carry forward chain_id (or promote parent to chain root)
            chainId = parentSession.chain_id || parentSession.id

            // If parent doesn't have a chain_id yet, promote it to chain root
            if (!parentSession.chain_id) {
                await auth.supabase
                    .from("document_sessions")
                    .update({ chain_id: chainId })
                    .eq("id", parentSession.id)
            }

            clientName = parentSession.client_name

            const rawContext = parentSession.context
            const rawParentCtx: Record<string, any> =
                rawContext && typeof rawContext === "object" && !Array.isArray(rawContext)
                    ? (rawContext as Record<string, any>)
                    : {}

            // Store parent_document_id in context for SOW, Change Order, Payment Follow-up
            const typesWithParentRef: string[] = ["sow", "change_order", "payment_followup"]
            if (typesWithParentRef.includes(normalizedType)) {
                parentContext.parent_document_id = parentSession.id
                parentContext._parentDocumentType = parentSession.document_type
            }

            // Auto-populate Payment Follow-up fields from linked invoice
            if (normalizedType === "payment_followup" && parentType === "invoice") {
                parentContext.linkedInvoiceId = parentSession.id
                if (rawParentCtx.invoiceNumber) parentContext.invoiceNumber = rawParentCtx.invoiceNumber
                if (rawParentCtx.total != null) parentContext.invoiceAmount = rawParentCtx.total
                if (rawParentCtx.currency) parentContext.invoiceCurrency = rawParentCtx.currency
                if (rawParentCtx.dueDate) parentContext.dueDate = rawParentCtx.dueDate
                if (rawParentCtx.paymentLinkUrl) parentContext.paymentLinkUrl = rawParentCtx.paymentLinkUrl

                // Compute days overdue if dueDate is available
                if (rawParentCtx.dueDate) {
                    const due = new Date(rawParentCtx.dueDate)
                    const today = new Date()
                    const msPerDay = 1000 * 60 * 60 * 24
                    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / msPerDay)
                    parentContext.daysOverdue = Math.max(0, daysOverdue)
                }
            }

            // Carry over client/from info for SOW context seeding
            if (normalizedType === "sow") {
                if (rawParentCtx.parentContractId == null) {
                    parentContext.parentContractId = parentSession.id
                }
                if (rawParentCtx.toName) parentContext.toName = rawParentCtx.toName
                if (rawParentCtx.toEmail) parentContext.toEmail = rawParentCtx.toEmail
                if (rawParentCtx.toAddress) parentContext.toAddress = rawParentCtx.toAddress
                if (rawParentCtx.fromName) parentContext.fromName = rawParentCtx.fromName
                if (rawParentCtx.fromEmail) parentContext.fromEmail = rawParentCtx.fromEmail
                if (rawParentCtx.fromAddress) parentContext.fromAddress = rawParentCtx.fromAddress
            }

            // Carry over client/from info for Change Order context seeding
            if (normalizedType === "change_order") {
                if (rawParentCtx.toName) parentContext.toName = rawParentCtx.toName
                if (rawParentCtx.toEmail) parentContext.toEmail = rawParentCtx.toEmail
                if (rawParentCtx.toAddress) parentContext.toAddress = rawParentCtx.toAddress
                if (rawParentCtx.fromName) parentContext.fromName = rawParentCtx.fromName
                if (rawParentCtx.fromEmail) parentContext.fromEmail = rawParentCtx.fromEmail
                if (rawParentCtx.fromAddress) parentContext.fromAddress = rawParentCtx.fromAddress
                if (rawParentCtx.currency) parentContext.currency = rawParentCtx.currency
                // Store parent doc type for schema validation (sow | contract)
                if (parentType === "sow" || parentType === "contract") {
                    parentContext.parentDocumentType = parentType
                }
                // Human-readable parent reference (e.g. "SOW-2026-07-002") for the
                // printed Change Order clause — never the raw parent session UUID.
                if (rawParentCtx.referenceNumber) {
                    parentContext.parentReferenceNumber = rawParentCtx.referenceNumber
                }
            }
        }

        // Deduplication: prevent duplicate sessions created within 5 seconds
        // (handles React StrictMode double-invocation and fast re-renders)
        // Skip deduplication if forceNew is explicitly set (e.g. "New conversation" button)
        // Also skip deduplication when creating linked sessions (parent reference provided)
        if (!body.forceNew && !body.parentSessionId) {
            const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
            const { data: recentSession } = await auth.supabase
                .from("document_sessions")
                .select("id, document_type, status, created_at")
                .eq("user_id", auth.user.id)
                .eq("document_type", normalizedType)
                .eq("status", "active")
                .gte("created_at", fiveSecondsAgo)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (recentSession) {
                // Return the existing session instead of creating a duplicate
                return NextResponse.json({
                    success: true,
                    session: {
                        id: recentSession.id,
                        documentType: recentSession.document_type,
                        status: recentSession.status,
                        createdAt: recentSession.created_at,
                    }
                })
            }
        }

        const { data: newSession, error: createError } = await auth.supabase
            .from("document_sessions")
            .insert({
                user_id: auth.user.id,
                document_type: normalizedType,
                status: "active",
                context: parentContext,
                ...(chainId ? { chain_id: chainId } : {}),
                ...(clientName ? { client_name: clientName } : {}),
            })
            .select()
            .single()

        if (createError) {
            // Handle unique constraint violation (duplicate session in same 10s window)
            if (createError.code === "23505") {
                // Race condition: another request created a session in the same window
                // Fetch and return the existing one
                const { data: existing } = await auth.supabase
                    .from("document_sessions")
                    .select("id, document_type, status, created_at")
                    .eq("user_id", auth.user.id)
                    .eq("document_type", normalizedType)
                    .eq("status", "active")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single()

                if (existing) {
                    return NextResponse.json({
                        success: true,
                        session: {
                            id: existing.id,
                            documentType: existing.document_type,
                            status: existing.status,
                            createdAt: existing.created_at,
                        }
                    })
                }
            }
            console.error("Session creation error:", createError.message)
            return NextResponse.json(
                { success: false, error: "Failed to create session" },
                { status: 500 }
            )
        }

        // If there's a parent session, create a document link record and increment document count
        if (body.parentSessionId) {
            const { error: linkError } = await auth.supabase
                .from("document_links")
                .insert({
                    parent_session_id: body.parentSessionId,
                    child_session_id: newSession.id,
                    relationship: "derived_from",
                })
            if (linkError) {
                console.error("Failed to create document link:", linkError)
                // Non-fatal — session was created, link is supplementary
            }
        }

        // NOTE: Document count is NOT incremented here — it's incremented in /api/ai/stream
        // when a document is actually generated successfully. Creating a session is just
        // starting a conversation, not generating a document.

        if (sanitizedPrompt) {
            const { error: messageError } = await auth.supabase
                .from("chat_messages")
                .insert({
                    session_id: newSession.id,
                    role: "user",
                    content: sanitizedPrompt,
                })
            if (messageError) {
                console.error("Failed to save initial message:", messageError)
            }
        }

        return NextResponse.json({
            success: true,
            session: {
                id: newSession.id,
                documentType: newSession.document_type,
                status: newSession.status,
                createdAt: newSession.created_at,
                ...(chainId ? { chainId } : {}),
            }
        })

    } catch (error) {
        console.error("Unexpected error in session creation:", error)
        return NextResponse.json(
            { success: false, error: sanitizeError(error) },
            { status: 500 }
        )
    }
}
