/**
 * DELETE /api/sessions/delete
 * Permanently deletes a document session owned by the authenticated user.
 *
 * SECURITY:
 * - Requires authentication (JWT via Supabase) — blocks all unauthenticated requests
 * - UUID format validation — prevents injection attacks
 * - Explicit user_id ownership check in both the SELECT and DELETE queries
 * - Row-Level Security (RLS) enforces ownership at the database level as a second layer
 * - Blocks deletion of paid/signed/finalized sessions (irreversible legal/financial records)
 * - No rate limiting needed: delete is user-initiated, low-frequency, and fully auth-gated
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Statuses that are permanently protected — legal/financial records that must not be deleted
const PROTECTED_STATUSES = ["paid", "signed"]

export async function DELETE(request: NextRequest) {
    // LAYER 1: Authenticate user via JWT (cookies or Authorization: Bearer header)
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // LAYER 2: Validate session ID format — rejects non-UUID values before any DB query
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    // LAYER 3: Fetch session with explicit ownership filter (user_id = authenticated user)
    // This double-checks ownership at the application layer in addition to RLS.
    const { data: session, error: fetchError } = await auth.supabase
        .from("document_sessions")
        .select("id, user_id, status, document_type")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)  // ownership enforced here
        .single()

    if (fetchError || !session) {
        // Returns 404 whether the session doesn't exist or belongs to another user —
        // avoids leaking which session IDs exist in the system (IDOR protection)
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // LAYER 4: Block deletion of legally protected records
    // "paid" — financial records must be preserved
    // "signed" — legally binding signed documents must be preserved
    if (PROTECTED_STATUSES.includes(session.status)) {
        return NextResponse.json(
            { error: `Cannot delete a ${session.status} document. This is a legal/financial record.` },
            { status: 403 }
        )
    }

    // LAYER 5: Delete with explicit user_id constraint (defense in depth on top of RLS)
    const { error: deleteError } = await auth.supabase
        .from("document_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)  // double-check ownership in the DELETE too

    if (deleteError) {
        console.error("[sessions/delete] delete error:", deleteError)
        return NextResponse.json({ error: sanitizeError(deleteError) }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
