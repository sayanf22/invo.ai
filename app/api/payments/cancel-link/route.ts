import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { cancelPaymentLink } from "@/lib/razorpay"
import { createClient } from "@supabase/supabase-js"
import { logAudit } from "@/lib/audit-log"

/**
 * POST /api/payments/cancel-link
 * Cancels an active Razorpay Payment Link.
 *
 * SECURITY:
 * - Requires authentication
 * - Verifies session ownership before cancelling
 * - Only allows cancelling links in "created" or "partially_paid" status
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { sessionId, razorpayPaymentLinkId } = body

    if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }
    if (!razorpayPaymentLinkId || typeof razorpayPaymentLinkId !== "string") {
        return NextResponse.json({ error: "razorpayPaymentLinkId is required" }, { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Verify ownership + status
    const { data: link } = await supabaseAdmin
        .from("invoice_payments")
        .select("id, status, razorpay_payment_link_id")
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .eq("razorpay_payment_link_id", razorpayPaymentLinkId)
        .maybeSingle()

    if (!link) {
        return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
    }

    if (!["created", "partially_paid"].includes(link.status)) {
        return NextResponse.json(
            { error: `Cannot cancel a link with status: ${link.status}` },
            { status: 400 }
        )
    }

    // Cancel via Razorpay API
    try {
        await cancelPaymentLink(razorpayPaymentLinkId)
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        return NextResponse.json({ error: msg }, { status: 500 })
    }

    // Update DB
    await supabaseAdmin
        .from("invoice_payments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", link.id)

    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_link.cancelled",
        resource_type: "invoice_payment",
        resource_id: link.id,
        metadata: { razorpay_id: razorpayPaymentLinkId } as any,
    }, request)

    return NextResponse.json({ success: true })
}
