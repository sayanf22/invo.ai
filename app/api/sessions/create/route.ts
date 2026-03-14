/**
 * Session Creation API
 * Server-side endpoint to create new document sessions
 * SECURITY: All session logic runs on backend with proper validation
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"

interface CreateSessionRequest {
    documentType: "invoice" | "contract" | "quotation" | "proposal"
    initialPrompt?: string
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
