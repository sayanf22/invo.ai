import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { cancelPaymentLink } from "@/lib/razorpay"
import { createClient } from "@supabase/supabase-js"
import { logAudit } from "@/lib/audit-log"

/**
 * POST /api/payments/cancel-link
 * Cancels an active Razorpay Payment Link.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (payment category)
 * - Verifies session ownership before cancelling
 * - Only allows cancelling links in "created" or "partially_paid" status
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // Rate limit: max 20 payment operations per minute
    const rateLimitError = await checkRateLimit(auth.user.id, "payment")
    if (rateLimitError) return rateLimitError

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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    // Service role required for invoice_payments (may not be in RLS scope)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
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
        console.error("Razorpay cancel-link error:", msg)
        // Return a safe error message — don't expose Razorpay API internals
        if (msg.includes("already cancelled") || msg.includes("cancelled")) {
            return NextResponse.json({ error: "Payment link is already cancelled" }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to cancel payment link. Please try again." }, { status: 500 })
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
