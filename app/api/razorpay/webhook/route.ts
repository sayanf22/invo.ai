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

        // REPLAY PROTECTION: Atomic dedup using (gateway, event_id) unique constraint.
        // We inline the insert here (rather than using markWebhookProcessed) because
        // the webhook_events table requires a NOT NULL event_type column, which the
        // shared helper doesn't know about.
        if (eventId) {
            const { error: dedupError } = await (supabase as any)
                .from("webhook_events")
                .insert({
                    gateway: "razorpay",
                    event_id: eventId,
                    event_type: eventType,
                    processed_at: new Date().toISOString(),
                })
            if (dedupError) {
                // Unique constraint violation (code 23505) = already processed
                if (dedupError.code === "23505") {
                    return NextResponse.json({ received: true, duplicate: true })
                }
                // Other DB errors: log but continue (fail-open for payments)
                console.error("[razorpay/webhook] Dedup insert error:", dedupError.message)
            }
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

            case "subscription.activated":
            case "subscription.charged": {
                const subscription = event.payload.subscription.entity
                console.log(`${eventType}:`, subscription.id)

                // Safety-net activation: if the synchronous /verify call was missed
                // (e.g. user closed the tab, signature mismatch, network drop), the
                // webhook activates the plan here so a paid user is never left on free.
                const notes = subscription.notes ?? {}
                const userId: string | undefined = notes.user_id
                const plan: string | undefined = notes.plan
                const billingCycle: string = notes.billing_cycle || "monthly"

                const VALID_PLANS = ["starter", "pro", "agency"]
                if (userId && plan && VALID_PLANS.includes(plan)) {
                    const now = new Date()
                    // Period from Razorpay's authoritative current_start/current_end
                    // (unix seconds) so the stored period tracks the real billing cycle
                    // and never drifts across renewals. Fall back to a computed window
                    // only if Razorpay omits them.
                    const periodStart = subscription.current_start
                        ? new Date(subscription.current_start * 1000)
                        : now
                    const periodEnd = subscription.current_end
                        ? new Date(subscription.current_end * 1000)
                        : (() => {
                            const d = new Date(now)
                            if (billingCycle === "yearly") d.setFullYear(d.getFullYear() + 1)
                            else d.setMonth(d.getMonth() + 1)
                            return d
                        })()

                    // Amount + currency + cycle derived from the subscription's actual
                    // plan_id so multi-currency (and grandfathered-price) subscriptions
                    // record the real charge, not today's current price for that tier.
                    const { PLAN_PRICES_BY_CURRENCY, planIdToCurrency, planIdToCycle, planIdToAmount } = await import("@/lib/razorpay")
                    const currency = (subscription.plan_id ? planIdToCurrency(subscription.plan_id) : null) || "INR"
                    const cycleKey = ((subscription.plan_id ? planIdToCycle(subscription.plan_id) : null) || billingCycle) === "yearly" ? "yearly" : "monthly"
                    const paidTier = plan as "starter" | "pro" | "agency"
                    const amount = (subscription.plan_id ? planIdToAmount(subscription.plan_id) : null)
                        ?? PLAN_PRICES_BY_CURRENCY[currency]?.[paidTier]?.[cycleKey]
                        ?? PLAN_PRICES_BY_CURRENCY.INR[paidTier][cycleKey]

                    const { error: upsertErr } = await supabase
                        .from("subscriptions" as any)
                        .upsert({
                            user_id: userId,
                            plan,
                            billing_cycle: billingCycle,
                            status: "active",
                            razorpay_subscription_id: subscription.id,
                            amount_paid: amount,
                            currency,
                            current_period_start: periodStart.toISOString(),
                            current_period_end: periodEnd.toISOString(),
                            updated_at: now.toISOString(),
                        }, { onConflict: "user_id" })

                    if (upsertErr) {
                        console.error("[webhook] subscription activation upsert failed:", upsertErr.message)
                    } else {
                        // Mark plan_selected on profile (protected column → service role)
                        await supabase
                            .from("profiles")
                            .update({ plan_selected: true } as any)
                            .eq("id", userId)
                            .then(() => {})

                        // Record the charge in payment_history so the billing page
                        // "Payment History" + receipts are populated on every renewal.
                        // Uses the real payment entity (present on subscription.charged)
                        // and is idempotent on razorpay_payment_id.
                        const chargePayment = event.payload?.payment?.entity
                        if (chargePayment?.id) {
                            const { data: existingCharge } = await supabase
                                .from("payment_history" as any)
                                .select("id")
                                .eq("razorpay_payment_id", chargePayment.id)
                                .maybeSingle()
                            if (!existingCharge) {
                                await supabase.from("payment_history" as any).insert({
                                    user_id: userId,
                                    razorpay_payment_id: chargePayment.id,
                                    razorpay_order_id: chargePayment.order_id ?? null,
                                    amount: chargePayment.amount ?? amount,
                                    currency: chargePayment.currency ?? currency,
                                    status: "captured",
                                    plan,
                                    billing_cycle: billingCycle,
                                }).then(() => {})
                            }
                        }

                        // Notify the user (only on first activation, deduped by event_id above)
                        if (eventType === "subscription.activated") {
                            const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
                            await supabase.from("notifications").insert({
                                user_id: userId,
                                type: "subscription_activated",
                                title: `${planLabel} Plan Activated 🎉`,
                                message: `Your ${planLabel} plan is now active.`,
                                metadata: { plan, billingCycle, razorpay_subscription_id: subscription.id },
                            }).then(() => {})
                        }
                    }
                } else {
                    console.warn("[webhook] subscription event missing user_id/plan in notes:", subscription.id)
                }
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

            // ── Payment Link Events ────────────────────────────────────────────

            case "payment_link.paid": {
                const paymentLink = event.payload.payment_link.entity
                const payment = event.payload.payment?.entity

                // Race condition guard: only update if not already paid
                await supabase
                    .from("invoice_payments" as any)
                    .update({
                        status: "paid",
                        razorpay_payment_id: payment?.id ?? null,
                        amount_paid: paymentLink.amount_paid ?? paymentLink.amount,
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("razorpay_payment_link_id", paymentLink.id)
                    .neq("status", "paid") // Prevent double-update

                // Create a notification for the user
                const notes = paymentLink.notes ?? {}
                const userId = notes.user_id
                const sessionId = notes.session_id
                if (userId) {
                    const amountDisplay = ((paymentLink.amount_paid ?? paymentLink.amount) / 100).toFixed(2)
                    const currency = paymentLink.currency ?? "INR"
                    await supabase
                        .from("notifications")
                        .insert({
                            user_id: userId,
                            type: "payment_received",
                            title: "Invoice Paid! 🎉",
                            message: `Payment of ${currency} ${amountDisplay} received for ${paymentLink.reference_id ?? "your invoice"}.`,
                            metadata: {
                                session_id: sessionId ?? null,
                                payment_link_id: paymentLink.id,
                                razorpay_payment_id: payment?.id,
                                amount: paymentLink.amount_paid ?? paymentLink.amount,
                                currency,
                                reference_id: paymentLink.reference_id,
                            },
                        })

                    // Lock document permanently — update session status to "paid"
                    if (sessionId) {
                        await supabase
                            .from("document_sessions")
                            .update({ status: "paid", updated_at: new Date().toISOString() } as any)
                            .eq("id", sessionId)
                            .eq("user_id", userId)
                            .neq("status", "paid")
                    } else {
                        // Fallback: find session via invoice_payments
                        const { data: invoicePayment } = await supabase
                            .from("invoice_payments" as any)
                            .select("session_id")
                            .eq("razorpay_payment_link_id", paymentLink.id)
                            .maybeSingle()
                        if (invoicePayment?.session_id) {
                            await supabase
                                .from("document_sessions")
                                .update({ status: "paid", updated_at: new Date().toISOString() } as any)
                                .eq("id", invoicePayment.session_id)
                                .eq("user_id", userId)
                                .neq("status", "paid")
                        }
                    }

                    // Cancel all pending email follow-ups (payment received)
                    if (sessionId) {
                        await (supabase as any)
                            .from("email_schedules")
                            .update({ status: "cancelled", cancelled_reason: "payment_received", updated_at: new Date().toISOString() })
                            .eq("session_id", sessionId)
                            .eq("status", "pending")
                    }
                }
                break
            }

            case "payment_link.partially_paid": {
                const paymentLink = event.payload.payment_link.entity
                const payment = event.payload.payment?.entity
                console.log("Payment link partially paid:", paymentLink.id, paymentLink.amount_paid)

                await supabase
                    .from("invoice_payments" as any)
                    .update({
                        status: "partially_paid",
                        razorpay_payment_id: payment?.id ?? null,
                        amount_paid: paymentLink.amount_paid ?? 0,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("razorpay_payment_link_id", paymentLink.id)

                // Notify user of partial payment
                const notes = paymentLink.notes ?? {}
                const userId = notes.user_id
                if (userId) {
                    const paidDisplay = ((paymentLink.amount_paid ?? 0) / 100).toFixed(2)
                    const totalDisplay = (paymentLink.amount / 100).toFixed(2)
                    const currency = paymentLink.currency ?? "INR"
                    await supabase
                        .from("notifications")
                        .insert({
                            user_id: userId,
                            type: "general",
                            title: "Partial Payment Received",
                            message: `${currency} ${paidDisplay} of ${totalDisplay} received for ${paymentLink.reference_id ?? "your invoice"}.`,
                            metadata: {
                                session_id: notes.session_id ?? null,
                                payment_link_id: paymentLink.id,
                                amount_paid: paymentLink.amount_paid,
                                amount_total: paymentLink.amount,
                                currency,
                                reference_id: paymentLink.reference_id,
                            },
                        })
                }
                break
            }

            case "payment_link.expired": {
                const paymentLink = event.payload.payment_link.entity
                console.log("Payment link expired:", paymentLink.id)

                // Resolve session_id for this link (before updating status)
                const { data: expiredPayment } = await supabase
                    .from("invoice_payments" as any)
                    .select("session_id")
                    .eq("razorpay_payment_link_id", paymentLink.id)
                    .maybeSingle()

                await supabase
                    .from("invoice_payments" as any)
                    .update({
                        status: "expired",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("razorpay_payment_link_id", paymentLink.id)

                // Cancel all pending email reminders — no point reminding on a dead link
                const expiredSessionId = (expiredPayment as any)?.session_id
                if (expiredSessionId) {
                    await (supabase as any)
                        .from("email_schedules")
                        .update({
                            status: "cancelled",
                            cancelled_reason: "payment_link_expired",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("session_id", expiredSessionId)
                        .eq("status", "pending")
                }
                break
            }

            case "payment_link.cancelled": {
                const paymentLink = event.payload.payment_link.entity
                console.log("Payment link cancelled:", paymentLink.id)

                const { data: cancelledPayment } = await supabase
                    .from("invoice_payments" as any)
                    .select("session_id")
                    .eq("razorpay_payment_link_id", paymentLink.id)
                    .maybeSingle()

                await supabase
                    .from("invoice_payments" as any)
                    .update({
                        status: "cancelled",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("razorpay_payment_link_id", paymentLink.id)

                // Cancel all pending email reminders
                const cancelledSessionId = (cancelledPayment as any)?.session_id
                if (cancelledSessionId) {
                    await (supabase as any)
                        .from("email_schedules")
                        .update({
                            status: "cancelled",
                            cancelled_reason: "payment_link_cancelled",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("session_id", cancelledSessionId)
                        .eq("status", "pending")
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
