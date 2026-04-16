/**
 * Session Creation API
 * Server-side endpoint to create new document sessions
 * SECURITY: All session logic runs on backend with proper validation
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { incrementDocumentCount, checkDocumentLimit, checkDocumentTypeAllowed } from "@/lib/cost-protection"
import type { UserTier } from "@/lib/cost-protection"

interface CreateSessionRequest {
    documentType: "invoice" | "contract" | "quotation" | "proposal"
    initialPrompt?: string
    forceNew?: boolean // bypass deduplication (e.g. explicit "New conversation" click)
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body: CreateSessionRequest = await request.json()

        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        const validTypes = ["invoice", "contract", "quotation", "proposal"]
        if (!body.documentType || !validTypes.includes(body.documentType)) {
            return NextResponse.json(
                { success: false, error: "Invalid document type. Must be: invoice, contract, quotation, or proposal" },
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
        const { data: subscription } = await (auth.supabase as any)
            .from("subscriptions")
            .select("plan")
            .eq("user_id", auth.user.id)
            .single()
        const userTier: UserTier = (subscription?.plan as UserTier) || "free"

        // Check document type is allowed for this tier (fast, no DB query)
        const typeError = checkDocumentTypeAllowed(body.documentType, userTier)
        if (typeError) return typeError

        // Check document limit for this tier (requires DB query)
        const limitError = await checkDocumentLimit(auth.supabase, auth.user.id, userTier)
        if (limitError) return limitError

        // Deduplication: prevent duplicate sessions created within 5 seconds
        // (handles React StrictMode double-invocation and fast re-renders)
        // Skip deduplication if forceNew is explicitly set (e.g. "New conversation" button)
        if (!body.forceNew) {
            const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString()
            const { data: recentSession } = await auth.supabase
                .from("document_sessions")
                .select("id, document_type, status, created_at")
                .eq("user_id", auth.user.id)
                .eq("document_type", body.documentType)
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
                document_type: body.documentType,
                status: "active",
                context: {},
            })
            .select()
            .single()

        if (createError) {
            console.error("Session creation error:", createError.message)
            return NextResponse.json(
                { success: false, error: "Failed to create session" },
                { status: 500 }
            )
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
