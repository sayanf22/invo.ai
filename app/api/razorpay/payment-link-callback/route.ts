import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/razorpay/payment-link-callback
 *
 * Razorpay calls this URL (callback_url) when a customer opens the payment link.
 * We use it to track "viewed" status.
 *
 * Query params from Razorpay:
 *   razorpay_payment_link_id  — the payment link ID
 *   razorpay_payment_id       — set only after payment
 *   razorpay_payment_link_status — created | paid | partially_paid | expired
 *   razorpay_signature        — HMAC signature for verification
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const linkId = searchParams.get("razorpay_payment_link_id")
    const status = searchParams.get("razorpay_payment_link_status")
    const paymentId = searchParams.get("razorpay_payment_id")

    if (!linkId) {
        return NextResponse.redirect(new URL("/", request.url))
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        // Fetch the payment record
        const { data: payment } = await supabase
            .from("invoice_payments")
            .select("id, view_count, link_viewed_at, status")
            .eq("razorpay_payment_link_id", linkId)
            .maybeSingle()

        if (payment) {
            const updates: Record<string, unknown> = {
                view_count: (payment.view_count || 0) + 1,
                updated_at: new Date().toISOString(),
            }

            // Set first-viewed timestamp
            if (!payment.link_viewed_at) {
                updates.link_viewed_at = new Date().toISOString()
            }

            // If payment completed, update status
            if (status === "paid" && paymentId && payment.status !== "paid") {
                updates.status = "paid"
                updates.paid_at = new Date().toISOString()
                updates.razorpay_payment_id = paymentId
            }

            await supabase
                .from("invoice_payments")
                .update(updates)
                .eq("id", payment.id)
        }
    } catch (err) {
        console.error("Payment link callback error:", err)
        // Don't fail — redirect the customer regardless
    }

    // Redirect to a thank-you page or back to the payment link
    // For now redirect to homepage — in production this would be a branded thank-you page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
    return NextResponse.redirect(`${appUrl}/payment-complete?ref=${linkId}`)
}
