/**
 * DELETE /api/sessions/delete
 * Permanently deletes a document session owned by the authenticated user.
 *
 * SECURITY:
 * - Requires authentication (JWT via Supabase)
 * - UUID format validation
 * - Explicit user_id ownership check in both SELECT and DELETE
 * - Row-Level Security (RLS) as a second DB-level layer
 * - Blocks deletion of documents with ANY client interaction:
 *   • paid / signed (financial/legal records)
 *   • submitted onboarding forms (client already filled the form)
 *   • accepted / declined / changes_requested quotations/proposals
 *   • documents with actual signatures (signed_at IS NOT NULL)
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, sanitizeError } from "@/lib/api-auth"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Statuses that are permanently protected — legal/financial records
const PROTECTED_STATUSES = new Set(["paid", "signed", "finalized"])

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId || !UUID_REGEX.test(sessionId)) {
        return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    const { data: session, error: fetchError } = await auth.supabase
        .from("document_sessions")
        .select("id, user_id, status, document_type, sent_at")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // ── Protection Layer: status-based ─────────────────────────────────────
    if (PROTECTED_STATUSES.has(session.status)) {
        return NextResponse.json(
            { error: `Cannot delete a ${session.status} document. Documents sent to clients are permanent records.` },
            { status: 403 }
        )
    }

    // ── Protection Layer: ever sent to a client ───────────────────────────
    // Even if the document was later cancelled/unlocked, the fact that it was
    // shared with a client means it's a business record that must be preserved.
    // Only pure unsent drafts are deletable.
    if (session.sent_at) {
        return NextResponse.json(
            { error: "This document was sent to a client and cannot be deleted. Only unsent drafts can be removed." },
            { status: 403 }
        )
    }

    // ── Protection Layer: client has signed (any document type) ────────────
    const { data: signedSigs } = await (auth.supabase as any)
        .from("signatures")
        .select("id, signed_at, signer_action")
        .eq("session_id", sessionId)
        .not("signed_at", "is", null)

    const hasActualSignature = (signedSigs ?? []).some((s: any) =>
        s.signed_at &&
        s.signer_action !== "declined" &&
        s.signer_action !== "revision_requested" &&
        s.signer_action !== "cancelled"
    )

    if (hasActualSignature) {
        return NextResponse.json(
            { error: "This document has been signed and cannot be deleted. Signed documents are legally binding." },
            { status: 403 }
        )
    }

    // ── Protection Layer: client submitted an onboarding form ──────────────
    const docType = (session.document_type || "").toLowerCase().replace(/\s+/g, "_")
    if (docType === "client_onboarding_form") {
        const admin = serviceClient()
        const { data: submittedForm } = await admin
            .from("onboarding_forms")
            .select("id")
            .eq("session_id", sessionId)
            .eq("status", "submitted")
            .limit(1)
            .maybeSingle()

        if (submittedForm) {
            return NextResponse.json(
                { error: "This onboarding form has been filled and submitted by your client. It cannot be deleted." },
                { status: 403 }
            )
        }
    }

    // ── Protection Layer: client responded to a quotation/proposal ─────────
    if (["quotation", "quote", "proposal"].includes(docType)) {
        const { data: responses } = await (auth.supabase as any)
            .from("quotation_responses")
            .select("response_type")
            .eq("session_id", sessionId)
            .limit(1)

        if (Array.isArray(responses) && responses.length > 0) {
            const rt = responses[0].response_type
            const label = rt === "accepted" ? "accepted" : rt === "declined" ? "declined" : "responded to"
            return NextResponse.json(
                { error: `Your client has ${label} this document. It cannot be deleted.` },
                { status: 403 }
            )
        }
    }

    // ── All checks passed — delete ────────────────────────────────────────
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
