import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Public, read-only status endpoint. Session UUID is the recipient capability token. */
export async function GET(request: NextRequest) {
    try {
        const db = adminClient()
        const rateError = await checkPublicRateLimit(db, getClientIP(request), "payment_status", 30, 60)
        if (rateError) return rateError

        const sessionId = request.nextUrl.searchParams.get("sessionId") || ""
        if (!UUID_PATTERN.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })

        const [paymentResult, sessionResult] = await Promise.all([
            db.from("invoice_payments")
                .select("status,amount,currency,amount_paid,paid_at,is_manual,manually_marked_at")
                .eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
            db.from("document_sessions").select("status").eq("id", sessionId).maybeSingle(),
        ])
        if (paymentResult.error || sessionResult.error) {
            console.error("[payments/status] lookup failed:", paymentResult.error || sessionResult.error)
            return NextResponse.json({ error: "Failed to fetch payment status" }, { status: 500 })
        }
        const payment = paymentResult.data
        if (!payment) return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
        return NextResponse.json({
            status: sessionResult.data?.status === "paid" ? "paid" : payment.status,
            amount: payment.amount,
            currency: payment.currency,
            amount_paid: payment.amount_paid ?? null,
            paid_at: payment.paid_at ?? payment.manually_marked_at ?? null,
        })
    } catch (error) {
        console.error("[payments/status] failed:", error)
        return NextResponse.json({ error: "Payment status temporarily unavailable" }, { status: 503 })
    }
}
