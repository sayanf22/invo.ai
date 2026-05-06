/**
 * DELETE /api/sessions/delete
 * Permanently deletes a document session owned by the authenticated user.
 *
 * SECURITY:
 * - Requires authentication (JWT via Supabase)
 * - Verifies session ownership before deletion (RLS + explicit user_id check)
 * - Validates UUID format to prevent injection
 * - Rate limited via standard general limiter
 * - Blocks deletion of paid/signed sessions (irreversible legal records)
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Statuses that cannot be deleted — they are legal/financial records
const PROTECTED_STATUSES = ["paid", "signed"]

export async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    // Fetch the session to verify ownership and check status
    const { data: session, error: fetchError } = await auth.supabase
        .from("document_sessions")
        .select("id, user_id, status, document_type")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id) // ownership check
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Block deletion of paid/signed sessions — these are legal records
    if (PROTECTED_STATUSES.includes(session.status)) {
        return NextResponse.json(
            { error: `Cannot delete a ${session.status} document. This is a legal/financial record.` },
            { status: 403 }
        )
    }

    // Delete the session (RLS enforces user_id ownership at DB level too)
    const { error: deleteError } = await auth.supabase
        .from("document_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)

    if (deleteError) {
        console.error("[sessions/delete] delete error:", deleteError)
        return NextResponse.json({ error: sanitizeError(deleteError) }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
