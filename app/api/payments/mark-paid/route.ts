import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { sanitizeText } from "@/lib/sanitize"
import { deriveInvoicePaymentDetails } from "@/lib/invoice-payment-context"
import { getUserPaymentCredentials } from "@/lib/payment-credentials"
import { cancelProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"

const VALID_METHODS = ["cash", "bank_transfer", "check", "upi", "wire", "other"] as const
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function authorizeMutation(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return { response: originError } as const
    const auth = await authenticateRequest(request)
    if (auth.error) return { response: auth.error } as const
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return { response: csrfError } as const
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return { response: rateError } as const
    return { auth, response: null } as const
}

export async function POST(request: NextRequest) {
    const authorization = await authorizeMutation(request)
    if (authorization.response) return authorization.response
    const { auth } = authorization

    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 4 * 1024)
    if (sizeError) return sizeError
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "other"
    if (!UUID_PATTERN.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    if (!VALID_METHODS.includes(paymentMethod as any)) return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    const note = body.note === undefined ? null : sanitizeText(String(body.note)).slice(0, 500)
    if (typeof body.note === "string" && body.note.length > 2_000) {
        return NextResponse.json({ error: "Payment note is too long" }, { status: 400 })
    }
    const paidAt = typeof body.paidAt === "string" ? new Date(body.paidAt) : new Date()
    if (!Number.isFinite(paidAt.getTime()) || paidAt.getTime() > Date.now() + 5 * 60_000) {
        return NextResponse.json({ error: "Invalid paidAt timestamp" }, { status: 400 })
    }

    try {
        const db = adminClient()
        const { data: session, error: sessionError } = await db.from("document_sessions")
            .select("id,user_id,document_type,context")
            .eq("id", sessionId).eq("user_id", auth.user.id).maybeSingle()
        if (sessionError) throw sessionError
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        if (session.document_type !== "invoice") return NextResponse.json({ error: "Only invoices can be marked as paid" }, { status: 400 })
        const details = deriveInvoicePaymentDetails(session.context, sessionId)

        const { data: active, error: activeError } = await db.from("invoice_payments")
            .select("gateway,razorpay_payment_link_id,provider_link_id")
            .eq("session_id", sessionId).eq("user_id", auth.user.id)
            .in("status", ["created", "partially_paid"]).maybeSingle()
        if (activeError) throw activeError
        if (active && active.gateway !== "manual") {
            const credentials = await getUserPaymentCredentials(auth.user.id)
            if (!credentials) return NextResponse.json({ error: "Gateway credentials are unavailable; the active link was not changed." }, { status: 409 })
            try {
                await cancelProviderLink(
                    active.gateway as InvoicePaymentGateway,
                    active.razorpay_payment_link_id,
                    active.provider_link_id || active.razorpay_payment_link_id,
                    credentials,
                )
            } catch (error) {
                console.error("[payments/mark-paid] active link cancellation failed:", error)
                return NextResponse.json({ error: "Could not cancel the active online payment link. Manual payment was not recorded." }, { status: 502 })
            }
        }

        const { data, error } = await (db.rpc as any)("mark_invoice_manually_paid", {
            p_user_id: auth.user.id,
            p_session_id: sessionId,
            p_payment_method: paymentMethod,
            p_note: note || null,
            p_paid_at: paidAt.toISOString(),
            p_amount: details.amount,
            p_currency: details.currency,
        })
        if (error) throw error
        if (data?.applied === false && data?.reason === "already_paid") {
            return NextResponse.json({ error: "This invoice was already paid; no manual payment was added." }, { status: 409 })
        }
        return NextResponse.json({ success: true, payment: data, message: "Invoice marked as paid. Email reminders have been stopped." })
    } catch (error) {
        console.error("[payments/mark-paid] failed:", error)
        return NextResponse.json({ error: "Failed to record manual payment" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const authorization = await authorizeMutation(request)
    if (authorization.response) return authorization.response
    const { auth } = authorization
    const sessionId = request.nextUrl.searchParams.get("sessionId") || ""
    if (!UUID_PATTERN.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })

    try {
        const { data, error } = await (adminClient().rpc as any)("revert_manual_invoice_payment", {
            p_user_id: auth.user.id,
            p_session_id: sessionId,
        })
        if (error) {
            if (error.message?.includes("Manual payment not found")) {
                return NextResponse.json({ error: "No manual payment found" }, { status: 404 })
            }
            throw error
        }
        return NextResponse.json({ success: true, payment: data, message: "Manual payment status reverted." })
    } catch (error) {
        console.error("[payments/mark-paid] revert failed:", error)
        return NextResponse.json({ error: "Failed to revert manual payment" }, { status: 500 })
    }
}
