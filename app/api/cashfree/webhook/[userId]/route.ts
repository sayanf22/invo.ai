import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree-payment-links"
import { decrypt } from "@/lib/encrypt"
import { isWebhookTimestampValid } from "@/lib/webhook-dedup"
import { claimWebhookEvent, finishWebhookEvent, hashWebhookPayload } from "@/lib/webhook-events"
import { applyInvoicePaymentEvent, notifyInvoicePayment, type InvoicePaymentEventStatus } from "@/lib/invoice-payment-events"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
        const signature = request.headers.get("x-webhook-signature") || ""
        const timestampHeader = request.headers.get("x-webhook-timestamp") || ""
        const rawTimestamp = Number(timestampHeader)
        const timestampSeconds = rawTimestamp > 10_000_000_000 ? Math.floor(rawTimestamp / 1000) : rawTimestamp
        if (!Number.isInteger(timestampSeconds) || !isWebhookTimestampValid(timestampSeconds)) {
            return NextResponse.json({ error: "Invalid webhook timestamp" }, { status: 400 })
        }

        db = adminClient()
        const { data: settings, error: settingsError } = await db.from("user_payment_settings")
            .select("cashfree_client_secret_encrypted,cashfree_enabled,cashfree_test_mode")
            .eq("user_id", userId).maybeSingle()
        if (settingsError) throw settingsError
        if (!settings?.cashfree_client_secret_encrypted || !settings.cashfree_enabled) {
            return NextResponse.json({ received: true })
        }
        const clientSecret = await decrypt(settings.cashfree_client_secret_encrypted)
        if (!clientSecret) throw new Error("Cashfree webhook credential cannot be decrypted")
        if (!await verifyCashfreeWebhookSignature(body, signature, timestampHeader, clientSecret)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
        }

        let event: any
        try { event = JSON.parse(body) } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }
        const eventType = typeof event?.type === "string" ? event.type : ""
        const link = event?.data?.link || event?.data || {}
        const correlationId = String(link.cf_link_id ?? link.link_id ?? "")
        const linkStatus = String(link.link_status || "").toUpperCase()
        if (!eventType || !correlationId || !linkStatus) {
            return NextResponse.json({ error: "Invalid Cashfree event" }, { status: 400 })
        }

        if (request.headers.get("x-clorefy-test-webhook") === "1") {
            return NextResponse.json({ received: true, test: true })
        }

        const { error: verificationError } = await db.from("user_payment_settings")
            .update({ cashfree_webhook_verified_at: new Date().toISOString() })
            .eq("user_id", userId)
        if (verificationError) {
            console.error("[cashfree/webhook] failed to persist provider verification:", verificationError)
        }

        eventId = `cf_${correlationId}_${timestampHeader}_${linkStatus}`.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200)
        const claim = await claimWebhookEvent(db, "cashfree", eventId, eventType, await hashWebhookPayload(body), userId)
        if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })
        if (claim === "in_progress") return NextResponse.json({ error: "Event is processing" }, { status: 503 })

        if (eventType === "PAYMENT_LINK_EVENT") {
            const statusMap: Record<string, InvoicePaymentEventStatus> = {
                PAID: "paid",
                PARTIALLY_PAID: "partially_paid",
                EXPIRED: "expired",
                CANCELLED: "cancelled",
            }
            const status = statusMap[linkStatus]
            if (status) {
                const amountMajor = Number(link.link_amount_paid ?? 0)
                const amountPaid = ["paid", "partially_paid"].includes(status)
                    ? Math.round(amountMajor * 100)
                    : null
                if (amountPaid !== null && (!Number.isSafeInteger(amountPaid) || amountPaid <= 0)) {
                    throw new Error("Cashfree payment amount is invalid")
                }
                const result = await applyInvoicePaymentEvent(db, {
                    userId,
                    gateway: "cashfree",
                    providerLinkId: correlationId,
                    status,
                    amountPaid,
                    currency: typeof link.link_currency === "string" ? link.link_currency : null,
                    providerPaymentId: typeof link.cf_payment_id === "string" ? link.cf_payment_id : null,
                    isTestMode: settings.cashfree_test_mode === true,
                    paidAt: ["paid", "partially_paid"].includes(status) ? new Date(timestampSeconds * 1000).toISOString() : null,
                })
                await notifyInvoicePayment(db, userId, result, eventId)
                    .catch((error) => console.error("[cashfree/webhook] notification failed:", error))
            }
        }

        await finishWebhookEvent(db, "cashfree", eventId, "processed")
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[cashfree/webhook] processing failed:", error)
        if (db && eventId) {
            await finishWebhookEvent(db, "cashfree", eventId, "failed", error instanceof Error ? error.message : "Processing failed")
                .catch((finishError) => console.error("[cashfree/webhook] failure persistence failed:", finishError))
        }
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
