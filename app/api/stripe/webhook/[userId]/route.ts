import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStripeWebhookSignature } from "@/lib/stripe-payments"
import { decrypt } from "@/lib/encrypt"
import { markWebhookProcessed, isWebhookTimestampValid } from "@/lib/webhook-dedup"

/**
 * POST /api/stripe/webhook/[userId]
 * Per-user Stripe webhook. Registered programmatically when user connects Stripe.
 *
 * Security:
 * - UUID path validation prevents path traversal
 * - HMAC-SHA256 signature verification (constant-time in verifyStripeWebhookSignature)
 * - Timestamp validation rejects webhooks older than 5 minutes
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
    const signature = request.headers.get("stripe-signature") || ""

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: settings } = await supabaseAdmin
        .from("user_payment_settings")
        .select("stripe_webhook_secret, stripe_enabled")
        .eq("user_id", userId)
        .maybeSingle()

    if (!settings?.stripe_webhook_secret || !settings?.stripe_enabled) {
        return NextResponse.json({ received: true })
    }

    let webhookSecret = settings.stripe_webhook_secret
    try {
        const decrypted = await decrypt(settings.stripe_webhook_secret)
        if (decrypted) webhookSecret = decrypted
    } catch {
        // Old record stored as plaintext — use as-is
    }

    const isValid = await verifyStripeWebhookSignature(body, signature, webhookSecret)
    if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Parse event
    let event: Record<string, any>
    try {
        event = JSON.parse(body)
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Validate timestamp (Stripe embeds it in the signature header: t=timestamp)
    const tPart = signature.split(",").find(p => p.startsWith("t="))
    if (tPart) {
        const ts = parseInt(tPart.slice(2), 10)
        if (!isWebhookTimestampValid(ts)) {
            console.warn(`[stripe-webhook/${userId}] Stale webhook rejected, age: ${Math.floor(Date.now() / 1000) - ts}s`)
            return NextResponse.json({ error: "Webhook timestamp too old" }, { status: 400 })
        }
    }

    // Deduplication — prevent replay attacks
    const eventId = event.id || ""
    if (eventId) {
        const isNew = await markWebhookProcessed(supabaseAdmin as any, "stripe", eventId, userId)
        if (!isNew) {
            return NextResponse.json({ received: true }) // Already processed
        }
    }

    switch (event.type) {
        case "checkout.session.completed":
        case "payment_link.completed": {
            const session = event.data?.object || {}
            const metadata = session.metadata || {}
            const referenceId = metadata.reference_id || session.client_reference_id || ""
            const sessionId = metadata.session_id || ""
            const amountTotal = session.amount_total || 0
            const currency = (session.currency || "usd").toUpperCase()

            if (!referenceId && !sessionId) break

            // Race condition guard: only update if not already paid
            const updateResult = await (async () => {
                if (sessionId) {
                    return supabaseAdmin.from("invoice_payments").update({
                        status: "paid",
                        amount_paid: amountTotal,
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("session_id", sessionId)
                    .eq("user_id", userId)
                    .neq("status", "paid") // Only update if not already paid
                } else {
                    return supabaseAdmin.from("invoice_payments").update({
                        status: "paid",
                        amount_paid: amountTotal,
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("reference_id", referenceId)
                    .eq("user_id", userId)
                    .neq("status", "paid")
                }
            })()

            if (updateResult.error) {
                console.error(`[stripe-webhook/${userId}] invoice_payments update error:`, updateResult.error.message)
            }

            // Update document session status (only if not already paid)
            try {
                if (sessionId) {
                    await supabaseAdmin
                        .from("document_sessions")
                        .update({ status: "paid" })
                        .eq("id", sessionId)
                        .eq("user_id", userId)
                        .neq("status", "paid")
                } else if (referenceId) {
                    const { data: inv } = await supabaseAdmin
                        .from("invoice_payments")
                        .select("session_id")
                        .eq("reference_id", referenceId)
                        .eq("user_id", userId)
                        .maybeSingle()

                    if (inv?.session_id) {
                        await supabaseAdmin
                            .from("document_sessions")
                            .update({ status: "paid" })
                            .eq("id", inv.session_id)
                            .eq("user_id", userId)
                            .neq("status", "paid")
                    }
                }
            } catch (err) {
                console.error(`[stripe-webhook/${userId}] document_sessions update error:`, err)
            }

            // Notification (fire-and-forget, non-fatal)
            void supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Invoice Paid! 🎉",
                message: `Payment of ${currency} ${(amountTotal / 100).toFixed(2)} received.`,
                metadata: { stripe_event_id: eventId, amount: amountTotal, currency, session_id: sessionId, reference_id: referenceId },
            }).then(() => {}).catch(() => {})

            break
        }
        default:
            // Unhandled event types — silently ignore
            break
    }

    return NextResponse.json({ received: true })
}
