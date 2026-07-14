import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { decrypt } from "@/lib/encrypt"
import { claimWebhookEvent, finishWebhookEvent, hashWebhookPayload } from "@/lib/webhook-events"
import { applyInvoicePaymentEvent, notifyInvoicePayment, type InvoicePaymentEventStatus } from "@/lib/invoice-payment-events"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{6,200}$/

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Webhook service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
    try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
        const expected = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, "0")).join("")
        if (expected.length !== signature.length) return false
        let difference = 0
        for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
        return difference === 0
    } catch {
        return false
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const { userId } = await params
    if (!UUID_PATTERN.test(userId || "")) return NextResponse.json({ received: true })

    let db: ReturnType<typeof adminClient> | null = null
    let eventId = ""
    try {
        const body = await request.text()
        const signature = request.headers.get("x-razorpay-signature") || ""
        eventId = request.headers.get("x-razorpay-event-id") || ""
        if (!EVENT_ID_PATTERN.test(eventId)) {
            return NextResponse.json({ error: "Missing or invalid event id" }, { status: 400 })
        }

        db = adminClient()
        const { data: settings, error: settingsError } = await db.from("user_payment_settings")
            .select("razorpay_webhook_secret,razorpay_enabled,razorpay_test_mode")
            .eq("user_id", userId).maybeSingle()
        if (settingsError) throw settingsError
        if (!settings?.razorpay_webhook_secret || !settings.razorpay_enabled) {
            return NextResponse.json({ received: true })
        }
        const secret = await decrypt(settings.razorpay_webhook_secret).catch(() => null)
            || settings.razorpay_webhook_secret
        if (!await verifySignature(body, signature, secret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
        }

        let event: any
        try { event = JSON.parse(body) } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }
        const eventType = typeof event?.event === "string" ? event.event : ""
        if (!eventType) return NextResponse.json({ error: "Invalid event" }, { status: 400 })

        if (request.headers.get("x-clorefy-test-webhook") === "1") {
            return NextResponse.json({ received: true, test: true })
        }

        const claim = await claimWebhookEvent(db, "razorpay_invoice", eventId, eventType, await hashWebhookPayload(body), userId)
        if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })
        if (claim === "in_progress") return NextResponse.json({ error: "Event is processing" }, { status: 503 })

        const statusMap: Record<string, InvoicePaymentEventStatus> = {
            "payment_link.paid": "paid",
            "payment_link.partially_paid": "partially_paid",
            "payment_link.expired": "expired",
            "payment_link.cancelled": "cancelled",
        }
        const status = statusMap[eventType]
        if (status) {
            const link = event?.payload?.payment_link?.entity
            const payment = event?.payload?.payment?.entity
            if (!link || typeof link.id !== "string") throw new Error("Payment link payload is missing")
            const amountPaid = status === "paid"
                ? Number(link.amount_paid ?? link.amount)
                : status === "partially_paid" ? Number(link.amount_paid) : null
            const result = await applyInvoicePaymentEvent(db, {
                userId,
                gateway: "razorpay",
                providerLinkId: link.id,
                status,
                amountPaid: Number.isSafeInteger(amountPaid) ? amountPaid : null,
                currency: typeof link.currency === "string" ? link.currency : null,
                providerPaymentId: typeof payment?.id === "string" ? payment.id : null,
                isTestMode: settings.razorpay_test_mode === true,
                paidAt: ["paid", "partially_paid"].includes(status) ? new Date().toISOString() : null,
            })
            await notifyInvoicePayment(db, userId, result, eventId)
                .catch((error) => console.error("[razorpay/invoice-webhook] notification failed:", error))
        }

        await finishWebhookEvent(db, "razorpay_invoice", eventId, "processed")
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[razorpay/invoice-webhook] processing failed:", error)
        if (db && eventId) {
            await finishWebhookEvent(db, "razorpay_invoice", eventId, "failed", error instanceof Error ? error.message : "Processing failed")
                .catch((finishError) => console.error("[razorpay/invoice-webhook] failure persistence failed:", finishError))
        }
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
