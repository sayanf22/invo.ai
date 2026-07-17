import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyWebhookSignature } from "@/lib/razorpay"
import { claimWebhookEvent, finishWebhookEvent, hashWebhookPayload } from "@/lib/webhook-events"

const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{6,200}$/
const SUBSCRIPTION_EVENTS = new Set([
    "subscription.activated",
    "subscription.charged",
    "subscription.updated",
    "subscription.cancelled",
    "subscription.halted",
])

/** Platform Razorpay subscription webhook. Invoice links use /api/razorpay/webhook/[userId]. */
export async function POST(request: Request) {
    let db: ReturnType<typeof createClient> | null = null
    let eventId = ""
    try {
        const body = await request.text()
        const signature = request.headers.get("x-razorpay-signature") || ""
        eventId = request.headers.get("x-razorpay-event-id") || ""
        if (!await verifyWebhookSignature(body, signature)) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
        }
        if (!EVENT_ID_PATTERN.test(eventId)) {
            return NextResponse.json({ error: "Missing or invalid Razorpay event id" }, { status: 400 })
        }

        let event: any
        try { event = JSON.parse(body) } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
        }
        const eventType = typeof event?.event === "string" ? event.event : ""
        if (!eventType) return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 })

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) throw new Error("Webhook service credentials are not configured")
        db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

        const claim = await claimWebhookEvent(db, "razorpay", eventId, eventType, await hashWebhookPayload(body))
        if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true })
        if (claim === "in_progress") return NextResponse.json({ error: "Webhook is already processing" }, { status: 503 })

        if (SUBSCRIPTION_EVENTS.has(eventType)) {
            const { handleRazorpaySubscriptionEvent } = await import("@/lib/razorpay-subscription-sync")
            // Throws on failure; the outer catch persists the specific error
            // message into webhook_events.last_error for observability.
            await handleRazorpaySubscriptionEvent(event, eventType, eventId)
        }

        await finishWebhookEvent(db, "razorpay", eventId, "processed")
        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("[razorpay/webhook] processing failed:", error)
        if (db && eventId) {
            await finishWebhookEvent(db, "razorpay", eventId, "failed", error instanceof Error ? error.message : "Processing failed")
                .catch((finishError) => console.error("[razorpay/webhook] failure persistence failed:", finishError))
        }
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}
