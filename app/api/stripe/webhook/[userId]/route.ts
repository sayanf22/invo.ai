import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStripeWebhookSignature } from "@/lib/stripe-payments"
import { decrypt } from "@/lib/encrypt"

/**
 * POST /api/stripe/webhook/[userId]
 * Per-user Stripe webhook. Registered programmatically when user connects Stripe.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params
    if (!userId || userId.length < 10) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

    // Validate userId is a UUID to prevent path traversal
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        return NextResponse.json({ received: true }) // Silent — don't reveal validation
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

    // Decrypt the webhook secret (stored encrypted since security hardening)
    // Fall back to treating as plaintext for backwards compatibility with old records
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

    const event = JSON.parse(body)

    switch (event.type) {
        case "checkout.session.completed":
        case "payment_link.completed": {
            const session = event.data.object
            const metadata = session.metadata || {}
            const referenceId = metadata.reference_id || session.client_reference_id || ""
            const sessionId = metadata.session_id || ""
            const amountTotal = session.amount_total || 0
            const currency = session.currency?.toUpperCase() || "USD"

            if (referenceId || sessionId) {
                const query = supabaseAdmin.from("invoice_payments").update({
                    status: "paid",
                    amount_paid: amountTotal,
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })

                if (sessionId) query.eq("session_id", sessionId).eq("user_id", userId)
                else query.eq("reference_id", referenceId).eq("user_id", userId)

                await query

                await supabaseAdmin.from("notifications").insert({
                    user_id: userId,
                    type: "general",
                    title: "Invoice Paid! 🎉",
                    message: `Payment of ${currency} ${(amountTotal / 100).toFixed(2)} received for ${referenceId || "your invoice"}.`,
                    metadata: { stripe_session_id: session.id, amount: amountTotal, currency, reference_id: referenceId },
                })

                // Also update document_sessions.status to "paid"
                try {
                    if (sessionId) {
                        await supabaseAdmin
                            .from("document_sessions")
                            .update({ status: "paid" })
                            .eq("id", sessionId)
                            .eq("user_id", userId)
                    } else if (referenceId) {
                        const { data: invoicePayment } = await supabaseAdmin
                            .from("invoice_payments")
                            .select("session_id")
                            .eq("reference_id", referenceId)
                            .eq("user_id", userId)
                            .maybeSingle()

                        if (invoicePayment?.session_id) {
                            await supabaseAdmin
                                .from("document_sessions")
                                .update({ status: "paid" })
                                .eq("id", invoicePayment.session_id)
                                .eq("user_id", userId)
                        }
                    }
                } catch (err) {
                    console.error(`[stripe-webhook/${userId}] Failed to update document_sessions:`, err)
                }
            }
            break
        }
        default:
            console.log(`[stripe-webhook/${userId}] Unhandled:`, event.type)
    }

    return NextResponse.json({ received: true })
}
