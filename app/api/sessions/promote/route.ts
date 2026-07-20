/**
 * Chat Session Promotion API
 *
 * Promotes a chat-only `document_sessions` row (document_type = 'chat') into
 * a real typed session (invoice | contract | quote | proposal | estimate | …).
 *
 * Chat conversations are free until the user confirms creation. At that point
 * this endpoint:
 *   1. Validates the user's tier allows the requested document type.
 *   2. Validates the user hasn't hit their monthly document limit.
 *   3. Updates the session's document_type atomically (guarded to chat-only rows).
 *   4. Returns a compact Kimi-distilled brief of the chat for generation.
 *
 * NOTE: the monthly document slot is RESERVED later by /api/ai/stream when the
 * promoted session first generates — this endpoint does not itself increment
 * user_usage.documents_count.
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
    getUserTier,
} from "@/lib/cost-protection"
import {
    ALL_DOCUMENT_TYPES,
    normalizeDocumentType,
    getDocumentTypeLabel,
    type DocumentType,
} from "@/lib/document-type-registry"
import { callBedrockBrief, resolveBedrockKey } from "@/lib/bedrock"

/**
 * Summarize the chat conversation into a compact brief (≤6 lines, ≤700 chars)
 * for the document generator. Kimi reads the transcript and distills what the
 * user wants built — this carries the chat context into the new document
 * WITHOUT dumping the entire conversation. Returns "" on any failure so the
 * caller falls back to the CREATE_CARD summary.
 */
async function buildChatBrief(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    sessionId: string,
    userId: string,
    targetType: string
): Promise<string> {
    try {
        const bedrockKey = resolveBedrockKey()
        if (!bedrockKey) return ""

        const { data: msgs } = await supabase
            .from("chat_messages")
            .select("role, content")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: true })
            .limit(40)
        if (!Array.isArray(msgs) || msgs.length === 0) return ""

        const transcript = msgs
            .filter((m: { role: string; content: string }) => m.content && m.content.trim())
            .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
            .join("\n")
            .slice(0, 6000)
        if (!transcript) return ""

        const label = getDocumentTypeLabel(targetType)
        const system =
            "You distill a chat conversation into a short brief for a document generator. " +
            "Be concise and factual. No preamble, no greetings."
        const user =
            `The user has been chatting and now wants to create a ${label}. ` +
            `Summarize what to build in AT MOST 6 short lines and AT MOST 700 characters total. ` +
            `Capture: the document's purpose, the client/recipient, key items/services with amounts, ` +
            `any dates/terms, and specifics the user mentioned. Write it as direct instructions to the generator.\n\n` +
            `CONVERSATION:\n${transcript}`

        const raw = await callBedrockBrief(system, user, bedrockKey, 320)
        if (!raw) return ""

        // Enforce the ≤6 lines / ≤700 chars ceiling defensively.
        let brief = raw.trim().split("\n").filter(l => l.trim()).slice(0, 6).join("\n")
        if (brief.length > 700) brief = brief.slice(0, 700).trim()
        return brief
    } catch {
        return ""
    }
}

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

        // The monthly slot is reserved by /api/ai/stream when the promoted
        // session first generates a document.

        // Distill the chat into a compact brief (≤6 lines / ≤700 chars) so the
        // new document is generated with the full conversation context — not the
        // raw transcript. Best-effort with a hard 9s cap so a slow model never
        // makes the "Create" click hang; on timeout/failure we return "" and the
        // client falls back to the CREATE_CARD summary. Promotion is already
        // committed above, so this only affects the returned brief, never data.
        const chatBrief = await Promise.race([
            buildChatBrief(auth.supabase, body.sessionId, auth.user.id, normalizedTargetType),
            new Promise<string>((resolve) => setTimeout(() => resolve(""), 9000)),
        ])

        return NextResponse.json({
            success: true,
            chatBrief,
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
