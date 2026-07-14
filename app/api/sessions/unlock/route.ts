import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getUserPaymentCredentials } from "@/lib/payment-credentials"
import { cancelProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"
import { logAudit } from "@/lib/audit-log"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIVE_LINK_STATUSES = ["created", "partially_paid"]
const ONLINE_GATEWAYS = new Set<InvoicePaymentGateway>(["razorpay", "stripe", "cashfree"])

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function hasActualSignature(rows: Array<{ signed_at: string | null; signer_action: string | null }> | null): boolean {
    return (rows ?? []).some((signature) => signature.signed_at
        && !["declined", "revision_requested", "cancelled"].includes(signature.signer_action || ""))
}

/** Unlocks an unsigned, unpaid document only after every active provider link is cancelled. */
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError

    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!UUID_PATTERN.test(sessionId)) {
        return NextResponse.json({ error: "A valid sessionId is required" }, { status: 400 })
    }

    try {
        const db = adminClient()
        const { data: session, error: sessionError } = await db.from("document_sessions")
            .select("id,status,document_type")
            .eq("id", sessionId).eq("user_id", auth.user.id).maybeSingle()
        if (sessionError) throw sessionError
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        if (session.status === "paid") {
            return NextResponse.json({ error: "Paid documents cannot be unlocked", status: "paid" }, { status: 403 })
        }
        if (session.status === "signed") {
            return NextResponse.json({ error: "Signed documents cannot be unlocked", status: "signed" }, { status: 403 })
        }
        if (session.status === "active") {
            return NextResponse.json({ success: true, message: "Document is already editable" })
        }

        const { data: signedBefore, error: signedBeforeError } = await db.from("signatures")
            .select("signed_at,signer_action").eq("session_id", sessionId).not("signed_at", "is", null)
        if (signedBeforeError) throw signedBeforeError
        if (hasActualSignature(signedBefore as any)) {
            return NextResponse.json({
                error: "This document has been signed and cannot be unlocked. Signed documents are legally binding.",
                status: "signed",
            }, { status: 403 })
        }

        const { data: activeLinks, error: linksError } = await db.from("invoice_payments")
            .select("id,gateway,razorpay_payment_link_id,provider_link_id")
            .eq("session_id", sessionId).eq("user_id", auth.user.id).in("status", ACTIVE_LINK_STATUSES)
        if (linksError) throw linksError

        let paymentLinkCancelled = false
        if (activeLinks && activeLinks.length > 0) {
            const credentials = await getUserPaymentCredentials(auth.user.id)
            if (!credentials) {
                return NextResponse.json({ error: "Gateway credentials are unavailable; the document remains locked." }, { status: 409 })
            }
            for (const link of activeLinks) {
                if (!ONLINE_GATEWAYS.has(link.gateway as InvoicePaymentGateway)) {
                    return NextResponse.json({ error: "An active payment record cannot be cancelled online; the document remains locked." }, { status: 409 })
                }
                try {
                    await cancelProviderLink(
                        link.gateway as InvoicePaymentGateway,
                        link.razorpay_payment_link_id,
                        link.provider_link_id || link.razorpay_payment_link_id,
                        credentials,
                    )
                } catch (error) {
                    console.error("[sessions/unlock] provider cancellation failed:", error)
                    return NextResponse.json({ error: "Could not cancel the active payment link. The document remains locked." }, { status: 502 })
                }

                const { data: cancelled, error: cancelStateError } = await db.from("invoice_payments")
                    .update({ status: "cancelled", updated_at: new Date().toISOString() })
                    .eq("id", link.id).eq("user_id", auth.user.id)
                    .in("status", ACTIVE_LINK_STATUSES).select("id").maybeSingle()
                if (cancelStateError || !cancelled) {
                    console.error("[sessions/unlock] provider cancelled but local state failed:", cancelStateError)
                    return NextResponse.json({
                        error: "The payment provider link was cancelled, but local synchronization is pending. The document remains locked.",
                        syncPending: true,
                    }, { status: 502 })
                }
                paymentLinkCancelled = true
            }
        }

        const now = new Date().toISOString()
        const { error: signatureCancelError } = await db.from("signatures").update({
            signer_action: "cancelled",
            updated_at: now,
        }).eq("session_id", sessionId).is("signed_at", null).is("signer_action", null)
        if (signatureCancelError) throw signatureCancelError

        const { data: signedAfter, error: signedAfterError } = await db.from("signatures")
            .select("signed_at,signer_action").eq("session_id", sessionId).not("signed_at", "is", null)
        if (signedAfterError) throw signedAfterError
        if (hasActualSignature(signedAfter as any)) {
            return NextResponse.json({
                error: "This document was signed while unlock was in progress and remains locked.",
                status: "signed",
            }, { status: 409 })
        }

        const { error: scheduleError } = await db.from("email_schedules").update({
            status: "cancelled",
            cancelled_reason: "document_unlocked",
            updated_at: now,
        }).eq("session_id", sessionId).eq("user_id", auth.user.id).eq("status", "pending")
        if (scheduleError) throw scheduleError

        const { data: unlocked, error: unlockError } = await db.from("document_sessions").update({
            status: "active",
            updated_at: now,
        }).eq("id", sessionId).eq("user_id", auth.user.id).eq("status", session.status)
            .select("id").maybeSingle()
        if (unlockError) throw unlockError
        if (!unlocked) {
            return NextResponse.json({ error: "Document state changed while unlocking. It remains locked." }, { status: 409 })
        }

        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "document.unlocked" as any,
            resource_type: "document",
            resource_id: sessionId,
            metadata: { payment_link_cancelled: paymentLinkCancelled } as any,
        }, request).catch(() => {})

        return NextResponse.json({
            success: true,
            paymentLinkCancelled,
            message: paymentLinkCancelled
                ? "Document unlocked. Payment, signing, and reminder links were cancelled."
                : "Document unlocked. Pending signing links and reminders were cancelled.",
        })
    } catch (error) {
        console.error("[sessions/unlock] failed:", error)
        return NextResponse.json({ error: "Failed to unlock document; no unsafe unlock was performed." }, { status: 500 })
    }
}
