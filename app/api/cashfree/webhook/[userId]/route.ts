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
    if (!userId || userId.length < 10) return NextResponse.json({ received: true })

    // Validate userId is a UUID to prevent path traversal / enumeration
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
        return NextResponse.json({ received: true })
    }

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
        // Cashfree webhook payload for payment links:
        // data.cf_link_id = Cashfree's internal ID (what we store in razorpay_payment_link_id)
        // data.link_id = our link_id (cf_{sessionId})
        // data.link_status = PAID | PARTIALLY_PAID | EXPIRED | CANCELLED
        const cfLinkId = String(data.cf_link_id || "")
        const linkStatus = data.link_status || ""
        const amountPaid = parseFloat(data.link_amount_paid || "0")
        const currency = data.link_currency || "INR"
        const sessionId = data.link_notes?.session_id || ""

        if (linkStatus === "PAID") {
            // Look up by cf_link_id stored in razorpay_payment_link_id column
            const updateQuery = supabaseAdmin.from("invoice_payments").update({
                status: "paid",
                amount_paid: Math.round(amountPaid * 100), // convert rupees back to paise
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })

            if (cfLinkId) {
                await updateQuery.eq("razorpay_payment_link_id", cfLinkId).eq("user_id", userId)
            } else if (sessionId) {
                await updateQuery.eq("session_id", sessionId).eq("user_id", userId)
            }

            // Update document session status
            const targetSessionId = sessionId || (await (async () => {
                if (!cfLinkId) return null
                const { data: inv } = await supabaseAdmin
                    .from("invoice_payments")
                    .select("session_id")
                    .eq("razorpay_payment_link_id", cfLinkId)
                    .eq("user_id", userId)
                    .maybeSingle()
                return inv?.session_id ?? null
            })())

            if (targetSessionId) {
                await supabaseAdmin
                    .from("document_sessions")
                    .update({ status: "paid" })
                    .eq("id", targetSessionId)
                    .eq("user_id", userId)
            }

            await supabaseAdmin.from("notifications").insert({
                user_id: userId,
                type: "general",
                title: "Invoice Paid! 🎉",
                message: `Payment of ${currency} ${amountPaid.toFixed(2)} received.`,
                metadata: { cf_link_id: cfLinkId, amount: amountPaid, currency, session_id: sessionId },
            })
        } else if (linkStatus === "PARTIALLY_PAID") {
            const updateQuery = supabaseAdmin.from("invoice_payments").update({
                status: "partially_paid",
                amount_paid: Math.round(amountPaid * 100),
                updated_at: new Date().toISOString(),
            })
            if (cfLinkId) {
                await updateQuery.eq("razorpay_payment_link_id", cfLinkId).eq("user_id", userId)
            } else if (sessionId) {
                await updateQuery.eq("session_id", sessionId).eq("user_id", userId)
            }
        }
    }

    return NextResponse.json({ received: true })
}
