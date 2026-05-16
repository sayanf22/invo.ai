import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/sessions/unlock
 *
 * Reverts a sent document session back to "active" so the user can edit it again.
 *
 * Cancellation behavior:
 * - Sets session status back to "active"
 * - Cancels all PENDING signature requests for this session (signer_action='cancelled')
 *   so the signing links become invalid immediately
 * - Cancels all pending email reminders so the recipient doesn't receive reminders
 *   for a document that's now in flux
 *
 * Hard rules:
 * - If ANY signature has been actually signed (signed_at IS NOT NULL with no decline/revision/cancel action),
 *   the session CANNOT be unlocked — the signed document is legally binding
 * - "paid" sessions cannot be unlocked
 *
 * Body: { sessionId: string }
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { sessionId } = await request.json()
    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // Verify the session belongs to this user
    const { data: session, error: fetchError } = await auth.supabase
        .from("document_sessions")
        .select("id, status, document_type")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.status === "paid") {
        return NextResponse.json(
            { error: "Paid documents cannot be unlocked", status: session.status },
            { status: 403 }
        )
    }

    // ── Hard guard: refuse to unlock if any signature has been ACTUALLY signed ──
    // Check the signatures table directly so this works whether or not session.status was
    // updated to "signed" yet (race condition between webhook and unlock click).
    const { data: signedSigs } = await (auth.supabase as any)
        .from("signatures")
        .select("id, signed_at, signer_action")
        .eq("session_id", sessionId)
        .not("signed_at", "is", null)

    const hasActualSignature = (signedSigs ?? []).some((s: any) =>
        s.signed_at && s.signer_action !== "declined" && s.signer_action !== "revision_requested" && s.signer_action !== "cancelled"
    )

    if (hasActualSignature || session.status === "signed") {
        return NextResponse.json(
            {
                error: "This document has been signed and cannot be unlocked. Signed documents are legally binding.",
                status: "signed",
            },
            { status: 403 }
        )
    }

    if (session.status === "active") {
        return NextResponse.json({ success: true, message: "Document is already editable" })
    }

    // 1. Reset session status to "active"
    const { error: updateError } = await auth.supabase
        .from("document_sessions")
        .update({
            status: "active",
            updated_at: new Date().toISOString(),
        } as any)
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)

    if (updateError) {
        console.error("Failed to unlock session:", updateError)
        return NextResponse.json({ error: "Failed to unlock document" }, { status: 500 })
    }

    // 2. Cancel any active Razorpay payment links for this session.
    // Invoices can have a payment link that blocks editing. When unlocking,
    // the link must be cancelled so the client can't pay a stale invoice after
    // the owner edits and re-sends.
    let paymentLinkCancelled = false
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        )
        const { data: activeLinks } = await supabaseAdmin
            .from("invoice_payments")
            .select("id, razorpay_payment_link_id, status")
            .eq("session_id", sessionId)
            .in("status", ["created", "partially_paid"])

        if (activeLinks && activeLinks.length > 0) {
            for (const link of activeLinks) {
                try {
                    if (link.razorpay_payment_link_id) {
                        const { cancelPaymentLink } = await import("@/lib/razorpay")
                        await cancelPaymentLink(link.razorpay_payment_link_id)
                    }
                    await supabaseAdmin
                        .from("invoice_payments")
                        .update({ status: "cancelled", updated_at: new Date().toISOString() })
                        .eq("id", link.id)
                    paymentLinkCancelled = true
                } catch (err) {
                    // Non-fatal — log but continue unlock
                    console.warn("Failed to cancel Razorpay link during unlock:", err)
                }
            }
        }
    }

    // 3. Cancel ALL pending signature requests for this session.
    // Pending = no signed_at AND signer_action is null (not yet declined/revisioned/cancelled).
    // Setting signer_action='cancelled' makes the signing token return 410 Gone immediately.
    await (auth.supabase as any)
        .from("signatures")
        .update({
            signer_action: "cancelled",
            updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .is("signed_at", null)
        .is("signer_action", null)

    // 4. Cancel pending email reminders — old reminders reference a stale snapshot
    await (auth.supabase as any)
        .from("email_schedules")
        .update({
            status: "cancelled",
            cancelled_reason: "document_unlocked",
            updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .eq("status", "pending")

    return NextResponse.json({
        success: true,
        paymentLinkCancelled,
        message: paymentLinkCancelled
            ? "Document unlocked. Payment link cancelled. Pending signing links and reminders have been cancelled."
            : "Document unlocked. Pending signing links and reminders have been cancelled.",
    })
}
