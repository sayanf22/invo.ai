import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { decrypt } from "@/lib/encrypt"

/**
 * POST /api/razorpay/webhook/[userId]
 *
 * Per-user Razorpay webhook endpoint.
 * Each user who connects their Razorpay keys gets their own webhook URL.
 * Razorpay fires events here when THEIR clients pay invoices.
 *
 * SECURITY:
 * - Signature verified using the user's own webhook secret (not the platform secret)
 * - Replay protection via x-razorpay-event-id
 * - userId in URL is validated against DB — no spoofing
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params

    if (!userId || typeof userId !== "string" || userId.length < 10) {
        return NextResponse.json({ received: true }) // Silent — don't reveal validation
    }

    // Validate userId is a UUID to prevent path traversal / enumeration
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        return NextResponse.json({ received: true }) // Silent — don't reveal validation
    }

    const body = await request.text()
    const signature = request.headers.get("x-razorpay-signature") || ""
    const eventId = request.headers.get("x-razorpay-event-id") || ""

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch user's webhook secret
    const { data: settings } = await supabaseAdmin
        .from("user_payment_settings")
        .select("razorpay_webhook_secret, razorpay_enabled")
        .eq("user_id", userId)
        .maybeSingle()

    if (!settings?.razorpay_webhook_secret || !settings?.razorpay_enabled) {
        // Return 200 to prevent Razorpay from retrying — user may have disconnected
        return NextResponse.json({ received: true })
    }

    // Decrypt the webhook secret (stored encrypted since security hardening)
    // Falls back to raw value for legacy plaintext secrets (migration compatibility)
    const webhookSecretPlain = await decrypt(settings.razorpay_webhook_secret)
        ?? settings.razorpay_webhook_secret

    // Verify signature using user's webhook secret
    const isValid = await verifySignature(body, signature, webhookSecretPlain)
    if (!isValid) {
        console.error(`[webhook/${userId}] Signature verification failed`)
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.event

    // Replay protection
    if (eventId) {
        const { data: existing } = await supabaseAdmin
            .from("webhook_events")
            .select("id")
            .eq("event_id", eventId)
            .maybeSingle()

        if (existing) {
            return NextResponse.json({ received: true, duplicate: true })
        }

        await supabaseAdmin.from("webhook_events").insert({
            event_id: eventId,
            event_type: eventType,
        })
    }

    // Handle payment link events
    switch (eventType) {
        case "payment_link.paid": {
            const paymentLink = event.payload.payment_link.entity
            const payment = event.payload.payment?.entity
            console.log(`[webhook/${userId}] Payment link paid:`, paymentLink.id)

            await supabaseAdmin
                .from("invoice_payments")
                .update({
                    status: "paid",
                    razorpay_payment_id: payment?.id ?? null,
                    amount_paid: paymentLink.amount_paid ?? paymentLink.amount,
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("razorpay_payment_link_id", paymentLink.id)
                .eq("user_id", userId)

            // Send notification to the user
            const amountDisplay = ((paymentLink.amount_paid ?? paymentLink.amount) / 100).toFixed(2)
            const currency = paymentLink.currency ?? "INR"
            await supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Invoice Paid! 🎉",
                message: `Payment of ${currency} ${amountDisplay} received for ${paymentLink.reference_id ?? "your invoice"}.`,
                metadata: {
                    payment_link_id: paymentLink.id,
                    razorpay_payment_id: payment?.id,
                    amount: paymentLink.amount_paid ?? paymentLink.amount,
                    currency,
                    reference_id: paymentLink.reference_id,
                },
            })

            // Also update document_sessions.status to "paid"
            try {
                const { data: invoicePayment } = await supabaseAdmin
                    .from("invoice_payments")
                    .select("session_id")
                    .eq("razorpay_payment_link_id", paymentLink.id)
                    .eq("user_id", userId)
                    .maybeSingle()

                if (invoicePayment?.session_id) {
                    await supabaseAdmin
                        .from("document_sessions")
                        .update({ status: "paid" })
                        .eq("id", invoicePayment.session_id)
                        .eq("user_id", userId)
                }
            } catch (err) {
                console.error(`[webhook/${userId}] Failed to update document_sessions:`, err)
            }
            break
        }

        case "payment_link.partially_paid": {
            const paymentLink = event.payload.payment_link.entity
            const payment = event.payload.payment?.entity
            console.log(`[webhook/${userId}] Partially paid:`, paymentLink.id)

            await supabaseAdmin
                .from("invoice_payments")
                .update({
                    status: "partially_paid",
                    razorpay_payment_id: payment?.id ?? null,
                    amount_paid: paymentLink.amount_paid ?? 0,
                    updated_at: new Date().toISOString(),
                })
                .eq("razorpay_payment_link_id", paymentLink.id)
                .eq("user_id", userId)

            const paidDisplay = ((paymentLink.amount_paid ?? 0) / 100).toFixed(2)
            const totalDisplay = (paymentLink.amount / 100).toFixed(2)
            const currency = paymentLink.currency ?? "INR"
            await supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Partial Payment Received",
                message: `${currency} ${paidDisplay} of ${totalDisplay} received for ${paymentLink.reference_id ?? "your invoice"}.`,
                metadata: {
                    payment_link_id: paymentLink.id,
                    amount_paid: paymentLink.amount_paid,
                    amount_total: paymentLink.amount,
                    currency,
                    reference_id: paymentLink.reference_id,
                },
            })
            break
        }

        case "payment_link.expired": {
            const paymentLink = event.payload.payment_link.entity
            await supabaseAdmin
                .from("invoice_payments")
                .update({ status: "expired", updated_at: new Date().toISOString() })
                .eq("razorpay_payment_link_id", paymentLink.id)
                .eq("user_id", userId)
            break
        }

        case "payment_link.cancelled": {
            const paymentLink = event.payload.payment_link.entity
            await supabaseAdmin
                .from("invoice_payments")
                .update({ status: "cancelled", updated_at: new Date().toISOString() })
                .eq("razorpay_payment_link_id", paymentLink.id)
                .eq("user_id", userId)
            break
        }

        default:
            console.log(`[webhook/${userId}] Unhandled event:`, eventType)
    }

    return NextResponse.json({ received: true })
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
    try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        )
        const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
        const expected = Array.from(new Uint8Array(sigBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("")
        return expected === signature
    } catch {
        return false
    }
}
