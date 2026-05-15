/**
 * Chat-Only Session Creation API
 *
 * Creates a `document_sessions` row with `document_type = 'chat'`, which
 * represents a pre-document advisory conversation. Chat-only sessions:
 *   - Do NOT count against `user_usage.documents_count`.
 *   - Skip `checkDocumentLimit` and `checkDocumentTypeAllowed`.
 *   - Are promoted to a real document type via `POST /api/sessions/promote`
 *     when the user confirms they want to create a document.
 *
 * Auth is still required (must be a logged-in user), but no tier gate fires.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"

interface CreateChatSessionRequest {
    initialPrompt?: string
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body: CreateChatSessionRequest = await request.json().catch(() => ({}))

        const sizeError = validateBodySize(body, 20 * 1024)
        if (sizeError) return sizeError

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

        // Create the chat-only session row. Intentionally NO tier / limit / type
        // checks — chat conversations are free until promotion.
        const { data: newSession, error: createError } = await auth.supabase
            .from("document_sessions")
            .insert({
                user_id: auth.user.id,
                document_type: "chat",
                status: "active",
                context: {},
            })
            .select()
            .single()

        if (createError || !newSession) {
            console.error("Chat session creation error:", createError?.message)
            return NextResponse.json(
                { success: false, error: "Failed to create chat session" },
                { status: 500 }
            )
        }

        // Persist the initial user prompt so it survives refresh and appears in history.
        if (sanitizedPrompt) {
            const { error: messageError } = await auth.supabase
                .from("chat_messages")
                .insert({
                    session_id: newSession.id,
                    role: "user",
                    content: sanitizedPrompt,
                })
            if (messageError) {
                // Non-fatal — the session exists, just log and continue.
                console.error("Failed to save initial chat message:", messageError.message)
            }
        }

        return NextResponse.json({
            success: true,
            session: {
                id: newSession.id,
                documentType: newSession.document_type,
                status: newSession.status,
                createdAt: newSession.created_at,
            },
        })
    } catch (error) {
        console.error("Unexpected error in chat session creation:", error)
        return NextResponse.json(
            { success: false, error: sanitizeError(error) },
            { status: 500 }
        )
    }
}
