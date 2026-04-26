import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree-payments"
import { decrypt } from "@/lib/encrypt"
import { markWebhookProcessed, isWebhookTimestampValid } from "@/lib/webhook-dedup"

/**
 * POST /api/cashfree/webhook/[userId]
 * Per-user Cashfree webhook. URL is embedded in payment link notify_url.
 *
 * Security:
 * - UUID path validation prevents path traversal
 * - HMAC-SHA256 signature verification
 * - Timestamp validation rejects stale webhooks
 * - Deduplication prevents replay attacks
 * - Race condition guard: only update if not already paid
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params
    if (!userId || userId.length < 10) return NextResponse.json({ received: true })

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        return NextResponse.json({ received: true })
    }

    const body = await request.text()
    const signature = request.headers.get("x-webhook-signature") || ""

    // Validate timestamp from header (Cashfree sends x-webhook-timestamp in ms)
    const tsHeader = request.headers.get("x-webhook-timestamp")
    if (tsHeader) {
        const tsMs = parseInt(tsHeader, 10)
        if (!isNaN(tsMs)) {
            const tsSeconds = Math.floor(tsMs / 1000)
            if (!isWebhookTimestampValid(tsSeconds)) {
                console.warn(`[cashfree-webhook/${userId}] Stale webhook rejected`)
                return NextResponse.json({ error: "Webhook timestamp too old" }, { status: 400 })
            }
        }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: settings } = await supabaseAdmin
        .from("user_payment_settings")
        .select("cashfree_client_secret_encrypted, cashfree_enabled")
        .eq("user_id", userId)
        .maybeSingle()

    if (!settings?.cashfree_client_secret_encrypted || !settings?.cashfree_enabled) {
        return NextResponse.json({ received: true })
    }

    const clientSecret = await decrypt(settings.cashfree_client_secret_encrypted)
    if (!clientSecret) return NextResponse.json({ received: true })

    const isValid = await verifyCashfreeWebhookSignature(body, signature, clientSecret)
    if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    let event: Record<string, any>
    try {
        event = JSON.parse(body)
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const eventType = event.type || ""
    const data = event.data || {}

    // Deduplication using cf_link_id + event_time as event ID
    const cfLinkId = String(data.cf_link_id || "")
    const eventTime = event.event_time || ""
    const dedupId = cfLinkId ? `${cfLinkId}_${eventTime}` : ""

    if (dedupId) {
        const isNew = await markWebhookProcessed(supabaseAdmin as any, "cashfree", dedupId, userId)
        if (!isNew) {
            return NextResponse.json({ received: true }) // Already processed
        }
    }

    if (eventType === "PAYMENT_LINK_EVENT") {
        const linkStatus = data.link_status || ""
        const amountPaid = parseFloat(data.link_amount_paid || "0")
        const currency = data.link_currency || "INR"
        const sessionId = data.link_notes?.session_id || ""

        if (linkStatus === "PAID") {
            // Look up by cf_link_id (stored in razorpay_payment_link_id column)
            // Race condition guard: only update if not already paid
            if (cfLinkId) {
                await supabaseAdmin.from("invoice_payments").update({
                    status: "paid",
                    amount_paid: Math.round(amountPaid * 100),
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("razorpay_payment_link_id", cfLinkId)
                .eq("user_id", userId)
                .neq("status", "paid")
            } else if (sessionId) {
                await supabaseAdmin.from("invoice_payments").update({
                    status: "paid",
                    amount_paid: Math.round(amountPaid * 100),
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("session_id", sessionId)
                .eq("user_id", userId)
                .neq("status", "paid")
            }

            // Resolve session_id for document update
            const targetSessionId = sessionId || await (async () => {
                if (!cfLinkId) return null
                const { data: inv } = await supabaseAdmin
                    .from("invoice_payments")
                    .select("session_id")
                    .eq("razorpay_payment_link_id", cfLinkId)
                    .eq("user_id", userId)
                    .maybeSingle()
                return inv?.session_id ?? null
            })()

            if (targetSessionId) {
                await supabaseAdmin
                    .from("document_sessions")
                    .update({ status: "paid" })
                    .eq("id", targetSessionId)
                    .eq("user_id", userId)
                    .neq("status", "paid")
            }

            // Notification (fire-and-forget)
            void supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Invoice Paid! 🎉",
                message: `Payment of ${currency} ${amountPaid.toFixed(2)} received.`,
                metadata: { cf_link_id: cfLinkId, amount: amountPaid, currency, session_id: sessionId },
            }).then(() => {}).catch(() => {})

        } else if (linkStatus === "PARTIALLY_PAID") {
            if (cfLinkId) {
                await supabaseAdmin.from("invoice_payments").update({
                    status: "partially_paid",
                    amount_paid: Math.round(amountPaid * 100),
                    updated_at: new Date().toISOString(),
                })
                .eq("razorpay_payment_link_id", cfLinkId)
                .eq("user_id", userId)
                .neq("status", "paid") // Don't downgrade from paid
            }
        }
    }

    return NextResponse.json({ received: true })
}
