import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree-payments"
import { decrypt } from "@/lib/encrypt"

/**
 * POST /api/cashfree/webhook/[userId]
 * Per-user Cashfree webhook. URL is embedded in payment link notify_url.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params
    if (!userId || userId.length < 10) return NextResponse.json({ error: "Invalid user" }, { status: 400 })

    const body = await request.text()
    const signature = request.headers.get("x-webhook-signature") || ""

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: settings } = await supabaseAdmin
        .from("user_payment_settings")
        .select("cashfree_client_secret_encrypted, cashfree_enabled")
        .eq("user_id", userId)
        .maybeSingle()

    if (!settings?.cashfree_client_secret_encrypted || !settings?.cashfree_enabled) {
        return NextResponse.json({ received: true })
    }

    const clientSecret = await decrypt(settings.cashfree_client_secret_encrypted)
    if (!clientSecret) return NextResponse.json({ received: true })

    const isValid = await verifyCashfreeWebhookSignature(body, signature, clientSecret)
    if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.type || event.event_type || ""
    const data = event.data || {}

    if (eventType === "PAYMENT_LINK_EVENT" || eventType.includes("PAYMENT")) {
        const linkId = data.link?.link_id || data.link_id || ""
        const status = data.link?.link_status || data.payment?.payment_status || ""
        const amount = data.link?.link_amount_paid || data.payment?.payment_amount || 0
        const currency = data.link?.link_currency || "INR"

        if (status === "PAID" || status === "SUCCESS") {
            await supabaseAdmin.from("invoice_payments").update({
                status: "paid",
                amount_paid: Math.round(amount * 100),
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }).eq("reference_id", linkId).eq("user_id", userId)

            await supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Invoice Paid! 🎉",
                message: `Payment of ${currency} ${amount} received for ${linkId || "your invoice"}.`,
                metadata: { cashfree_link_id: linkId, amount, currency },
            })
        } else if (status === "PARTIALLY_PAID") {
            await supabaseAdmin.from("invoice_payments").update({
                status: "partially_paid",
                amount_paid: Math.round(amount * 100),
                updated_at: new Date().toISOString(),
            }).eq("reference_id", linkId).eq("user_id", userId)
        }
    }

    return NextResponse.json({ received: true })
}
