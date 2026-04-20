import { NextResponse } from "next/server"
import { verifyWebhookSignature } from "@/lib/razorpay"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/razorpay/webhook
 * Handles Razorpay webhook events for subscription lifecycle.
 * 
 * SECURITY:
 * - Verifies webhook signature using HMAC-SHA256
 * - Replay protection via x-razorpay-event-id deduplication
 * - Uses service role client (webhooks don't have user context)
 * - No authentication required (Razorpay calls this directly)
 * - Rate limited at 30/min per IP via middleware
 */
export async function POST(request: Request) {
    try {
        const body = await request.text()
        const signature = request.headers.get("x-razorpay-signature") || ""
        const eventId = request.headers.get("x-razorpay-event-id") || ""

        // CRITICAL: Verify webhook signature first
        const isValid = await verifyWebhookSignature(body, signature)
        if (!isValid) {
            console.error("Webhook signature verification failed")
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
        }

        const event = JSON.parse(body)
        const eventType = event.event

        // Create admin Supabase client for webhook operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // REPLAY PROTECTION: Check if we've already processed this event
        // Razorpay sends x-razorpay-event-id which is unique per event
        if (eventId) {
            const { data: existing } = await supabase
                .from("webhook_events" as any)
                .select("id")
                .eq("event_id", eventId)
                .maybeSingle()

            if (existing) {
                // Already processed — return 200 to prevent Razorpay from retrying
                console.log("Duplicate webhook event, skipping:", eventId)
                return NextResponse.json({ received: true, duplicate: true })
            }

            // Record this event to prevent future replays
            await supabase.from("webhook_events" as any).insert({
                event_id: eventId,
                event_type: eventType,
            })
        }

        switch (eventType) {
            case "payment.captured": {
                const payment = event.payload.payment.entity
                console.log("Payment captured:", payment.id, payment.amount)
                break
            }

            case "payment.failed": {
                const payment = event.payload.payment.entity
                console.log("Payment failed:", payment.id, payment.error_description)
                
                // Log failed payment with idempotency check
                if (payment.notes?.plan) {
                    const existing = await supabase
                        .from("payment_history" as any)
                        .select("id")
                        .eq("razorpay_payment_id", payment.id)
                        .maybeSingle()

                    if (!existing.data) {
                        await supabase.from("payment_history" as any).insert({
                            user_id: payment.notes.user_id || null,
                            razorpay_payment_id: payment.id,
                            razorpay_order_id: payment.order_id,
                            amount: payment.amount,
                            currency: payment.currency,
                            status: "failed",
                            plan: payment.notes.plan,
                            metadata: { error: payment.error_description },
                        })
                    }
                }
                break
            }

            case "subscription.activated": {
                const subscription = event.payload.subscription.entity
                console.log("Subscription activated:", subscription.id)
                break
            }

            case "subscription.charged": {
                const subscription = event.payload.subscription.entity
                console.log("Subscription charged:", subscription.id)
                break
            }

            case "subscription.cancelled": {
                const subscription = event.payload.subscription.entity
                console.log("Subscription cancelled:", subscription.id)

                if (subscription.id) {
                    await supabase
                        .from("subscriptions" as any)
                        .update({
                            status: "cancelled",
                            cancelled_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("razorpay_subscription_id", subscription.id)
                }
                break
            }

            case "subscription.halted": {
                const subscription = event.payload.subscription.entity
                console.log("Subscription halted (payment failed):", subscription.id)

                if (subscription.id) {
                    await supabase
                        .from("subscriptions" as any)
                        .update({
                            status: "past_due",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("razorpay_subscription_id", subscription.id)
                }
                break
            }

            default:
                console.log("Unhandled webhook event:", eventType)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("Webhook processing error:", error)
        // Return 200 even on error to prevent Razorpay from retrying
        return NextResponse.json({ received: true })
    }
}
