import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStripeWebhookSignature } from "@/lib/stripe-payments"
import { decrypt } from "@/lib/encrypt"
import { isWebhookTimestampValid } from "@/lib/webhook-dedup"
import { claimWebhookEvent, finishWebhookEvent, hashWebhookPayload } from "@/lib/webhook-events"
import { applyInvoicePaymentEvent, notifyInvoicePayment } from "@/lib/invoice-payment-events"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_]{6,200}$/

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Webhook service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params
    if (!UUID_PATTERN.test(userId || "")) return NextResponse.json({ received: true })

    let db: ReturnType<typeof adminClient> | null = null
    let eventId = ""
    try {
        const body = await request.text()
        const signature = request.headers.get("stripe-signature") || ""
        const timestampPart = signature.split(",").find((part) => part.startsWith("t="))
        const timestamp = timestampPart ? Number(timestampPart.slice(2)) : Number.NaN
        if (!Number.isInteger(timestamp) || !isWebhookTimestampValid(timestamp)) {
            return NextResponse.json({ error: "Invalid webhook timestamp" }, { status: 400 })
        }

        db = adminClient()
        const { data: settings, error: settingsError } = await db.from("user_payment_settings")
            .select("stripe_webhook_secret,stripe_enabled,stripe_test_mode")
            .eq("user_id", userId).maybeSingle()
        if (settingsError) throw settingsError
        if (!settings?.stripe_webhook_secret || !settings.stripe_enabled) {
            return NextResponse.json({ received: true })
        }
        const secret = await decrypt(settings.stripe_webhook_secret).catch(() => null)
            || settings.stripe_webhook_secret
        if (!await verifyStripeWebhookSignature(body, signature, secret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
        }

        let event: any
        try { event = JSON.parse(body) } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }
        eventId = typeof event?.id === "string" ? event.id : ""
        const eventType = typeof event?.type === "string" ? event.type : ""
        if (!EVENT_ID_PATTERN.test(eventId) || !eventType || typeof event?.livemode !== "boolean") {
            return NextResponse.json({ error: "Invalid Stripe event" }, { status: 400 })
        }

        if (request.headers.get("x-clorefy-test-webhook") === "1") {
            return NextResponse.json({ received: true, test: true })
        }

        const { error: verificationError } = await db.from("user_payment_settings")
            .update({ stripe_webhook_verified_at: new Date().toISOString() })
            .eq("user_id", userId)
        if (verificationError) {
            console.error("[stripe/webhook] failed to persist provider verification:", verificationError)
        }

        const claim = await claimWebhookEvent(db, "stripe", eventId, eventType, await hashWebhookPayload(body), userId)
        if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })
        if (claim === "in_progress") return NextResponse.json({ error: "Event is processing" }, { status: 503 })

        const checkout = event?.data?.object
        if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired"].includes(eventType)) {
            const metadata = checkout?.metadata || {}
            if (
                typeof checkout?.id !== "string"
                || metadata.platform !== "clorefy"
                || metadata.user_id !== userId
                || !UUID_PATTERN.test(metadata.session_id || "")
            ) throw new Error("Stripe Checkout ownership metadata is invalid")

            if (event.livemode === (settings.stripe_test_mode === true)) {
                throw new Error("Stripe event mode does not match gateway settings")
            }

            if (eventType === "checkout.session.expired") {
                await applyInvoicePaymentEvent(db, {
                    userId,
                    gateway: "stripe",
                    providerLinkId: checkout.id,
                    status: "expired",
                    isTestMode: !event.livemode,
                })
            } else if (checkout.payment_status === "paid") {
                const amount = Number(checkout.amount_total)
                if (!Number.isSafeInteger(amount) || amount <= 0 || typeof checkout.currency !== "string") {
                    throw new Error("Stripe payment amount is invalid")
                }
                const result = await applyInvoicePaymentEvent(db, {
                    userId,
                    gateway: "stripe",
                    providerLinkId: checkout.id,
                    status: "paid",
                    amountPaid: amount,
                    currency: checkout.currency,
                    providerPaymentId: typeof checkout.payment_intent === "string" ? checkout.payment_intent : null,
                    isTestMode: !event.livemode,
                    paidAt: new Date((Number(event.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
                })
                await notifyInvoicePayment(db, userId, result, eventId)
                    .catch((error) => console.error("[stripe/webhook] notification failed:", error))
            }
        }

        await finishWebhookEvent(db, "stripe", eventId, "processed")
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[stripe/webhook] processing failed:", error)
        if (db && eventId) {
            await finishWebhookEvent(db, "stripe", eventId, "failed", error instanceof Error ? error.message : "Processing failed")
                .catch((finishError) => console.error("[stripe/webhook] failure persistence failed:", finishError))
        }
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
