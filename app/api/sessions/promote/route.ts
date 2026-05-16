/**
 * Chat Session Promotion API
 *
 * Promotes a chat-only `document_sessions` row (document_type = 'chat') into
 * a real typed session (invoice | contract | quotation | proposal) and
 * consumes 1 document quota slot.
 *
 * This is the ONLY place in the chat-first flow where quota is consumed.
 * Chat conversations are free until the user confirms creation, at which
 * point this endpoint:
 *   1. Validates the user's tier allows the requested document type.
 *   2. Validates the user hasn't hit their monthly document limit.
 *   3. Updates the session's document_type atomically.
 *   4. Increments user_usage.documents_count.
 *
 * Safety: the UPDATE is scoped to rows where document_type = 'chat' so a
 * session cannot be double-promoted and already-typed sessions cannot have
 * their type changed via this endpoint.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import {
    checkDocumentLimit,
    checkDocumentTypeAllowed,
    incrementDocumentCount,
    getUserTier,
    resolveEffectiveTier,
} from "@/lib/cost-protection"
import {
    ALL_DOCUMENT_TYPES,
    normalizeDocumentType,
    type DocumentType,
} from "@/lib/document-type-registry"

/**
 * Valid promotion targets. Includes:
 *   - All 10 canonical document types from the registry
 *   - The legacy "quotation" alias (normalized to "quote" before storage)
 *
 * Both lowercase canonical and the "quotation" alias are accepted from the
 * client, but the value persisted to the DB is always the normalized form.
 */
type PromoteTargetType = DocumentType | "quotation"

const VALID_TARGET_TYPES: readonly string[] = [
    ...ALL_DOCUMENT_TYPES,
    "quotation",
] as const

interface PromoteSessionRequest {
    sessionId: string
    targetType: PromoteTargetType
}

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request)
        if (auth.error) return auth.error

        const body: PromoteSessionRequest = await request.json()

        const sizeError = validateBodySize(body, 5 * 1024)
        if (sizeError) return sizeError

        if (!body.sessionId || typeof body.sessionId !== "string") {
            return NextResponse.json(
                { success: false, error: "sessionId is required" },
                { status: 400 }
            )
        }

        if (!body.targetType || typeof body.targetType !== "string" || !VALID_TARGET_TYPES.includes(body.targetType)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `targetType must be one of: ${VALID_TARGET_TYPES.join(", ")}`,
                },
                { status: 400 }
            )
        }

        // Normalize "quotation" -> "quote" before any tier checks or storage.
        // The DB and tier-limits are keyed by canonical type values only.
        const normalizedTargetType = normalizeDocumentType(body.targetType) ?? body.targetType as DocumentType

        // Resolve tier — single DB call via helper.
        const userTier = await getUserTier(auth.supabase, auth.user.id)

        // Tier gate: does this tier allow this document type?
        const typeError = checkDocumentTypeAllowed(normalizedTargetType, userTier)
        if (typeError) return typeError

        // Tier gate: does the user have quota left this month?
        const limitError = await checkDocumentLimit(auth.supabase, auth.user.id, userTier)
        if (limitError) return limitError

        // Fetch the session and verify: owned by the user AND currently chat-only.
        const { data: session, error: fetchError } = await auth.supabase
            .from("document_sessions")
            .select("id, user_id, document_type, status, created_at, context")
            .eq("id", body.sessionId)
            .eq("user_id", auth.user.id)
            .maybeSingle()

        if (fetchError || !session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 }
            )
        }

        // If already promoted to the same type (compared after normalization),
        // it's a no-op — return success.
        if (normalizeDocumentType(session.document_type) === normalizedTargetType) {
            return NextResponse.json({
                success: true,
                session: {
                    id: session.id,
                    documentType: session.document_type,
                    status: session.status,
                    createdAt: session.created_at,
                },
            })
        }

        if (session.document_type !== "chat") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Session is already typed and cannot be re-promoted",
                    currentType: session.document_type,
                },
                { status: 409 }
            )
        }

        // Atomic promotion: only update if still chat-only. Prevents races
        // where two clicks on the Create card could double-increment quota.
        // Always store the normalized type — never "quotation" for new rows.
        const { data: updated, error: updateError } = await auth.supabase
            .from("document_sessions")
            .update({
                document_type: normalizedTargetType,
                updated_at: new Date().toISOString(),
            })
            .eq("id", body.sessionId)
            .eq("user_id", auth.user.id)
            .eq("document_type", "chat")
            .select()
            .single()

        if (updateError || !updated) {
            console.error("Promote update failed:", updateError?.message)
            return NextResponse.json(
                { success: false, error: "Failed to promote session" },
                { status: 500 }
            )
        }

        // Now that the type change is committed, consume 1 quota slot.
        // If this fails the session is still promoted — non-fatal, logged.
        await incrementDocumentCount(auth.supabase, auth.user.id)

        return NextResponse.json({
            success: true,
            session: {
                id: updated.id,
                documentType: updated.document_type,
                status: updated.status,
                createdAt: updated.created_at,
            },
        })
    } catch (error) {
        console.error("Unexpected error in session promotion:", error)
        return NextResponse.json(
            { success: false, error: sanitizeError(error) },
            { status: 500 }
        )
    }
}
