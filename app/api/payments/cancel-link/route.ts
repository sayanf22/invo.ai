import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { getUserPaymentCredentials } from "@/lib/payment-credentials"
import { cancelProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"
import { logAudit } from "@/lib/audit-log"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError

    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 2 * 1024)
    if (sizeError) return sizeError
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!UUID_PATTERN.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })

    try {
        const db = adminClient()
        const { data: link, error: linkError } = await db.from("invoice_payments")
            .select("id,status,gateway,razorpay_payment_link_id,provider_link_id")
            .eq("session_id", sessionId).eq("user_id", auth.user.id)
            .in("status", ["created", "partially_paid"]).maybeSingle()
        if (linkError) throw linkError
        if (!link) return NextResponse.json({ error: "Active payment link not found" }, { status: 404 })
        if (!["razorpay", "stripe", "cashfree"].includes(link.gateway)) {
            return NextResponse.json({ error: "This payment record cannot be cancelled online" }, { status: 409 })
        }

        const credentials = await getUserPaymentCredentials(auth.user.id)
        if (!credentials) return NextResponse.json({ error: "Gateway credentials are unavailable" }, { status: 409 })
        await cancelProviderLink(
            link.gateway as InvoicePaymentGateway,
            link.razorpay_payment_link_id,
            link.provider_link_id || link.razorpay_payment_link_id,
            credentials,
        )

        const now = new Date().toISOString()
        const { error: updateError } = await db.from("invoice_payments")
            .update({ status: "cancelled", updated_at: now })
            .eq("id", link.id).eq("user_id", auth.user.id)
        if (updateError) {
            console.error("[payments/cancel-link] provider cancelled but local update failed:", updateError)
            return NextResponse.json({ success: true, syncPending: true, message: "The provider link was cancelled; local status is still syncing." }, { status: 202 })
        }
        const { error: scheduleError } = await (db as any).from("email_schedules").update({
            status: "cancelled",
            cancelled_reason: "payment_link_cancelled",
            updated_at: now,
        }).eq("session_id", sessionId).eq("user_id", auth.user.id).eq("status", "pending")
        if (scheduleError) throw scheduleError

        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_link.cancelled",
            resource_type: "invoice_payment",
            resource_id: link.id,
            metadata: { gateway: link.gateway } as any,
        }, request).catch(() => {})
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[payments/cancel-link] failed:", error)
        return NextResponse.json({ error: "Failed to cancel payment link. Please try again." }, { status: 502 })
    }
}
