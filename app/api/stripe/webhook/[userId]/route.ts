import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyStripeWebhookSignature } from "@/lib/stripe-payments"

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

    const isValid = await verifyStripeWebhookSignature(body, signature, settings.stripe_webhook_secret)
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
            }
            break
        }
        default:
            console.log(`[stripe-webhook/${userId}] Unhandled:`, event.type)
    }

    return NextResponse.json({ received: true })
}
