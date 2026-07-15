import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { isPublicDocumentId } from "@/lib/public-capability"

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Public, read-only status endpoint. publicId is the recipient capability. */
export async function GET(request: NextRequest) {
    try {
        const db = adminClient()
        const rateError = await checkPublicRateLimit(db, getClientIP(request), "payment_status", 30, 60)
        if (rateError) return rateError

        const publicId = request.nextUrl.searchParams.get("publicId") || ""
        if (!isPublicDocumentId(publicId)) return NextResponse.json({ error: "Invalid public document capability" }, { status: 400 })

        const { data: session, error: sessionError } = await db.from("document_sessions")
            .select("id,status").eq("public_id", publicId).maybeSingle()
        if (sessionError) {
            console.error("[payments/status] session lookup failed:", sessionError)
            return NextResponse.json({ error: "Failed to fetch payment status" }, { status: 500 })
        }
        if (!session) return NextResponse.json({ error: "Payment link not found" }, { status: 404 })

        const { data: payment, error: paymentError } = await db.from("invoice_payments")
            .select("status,amount,currency,amount_paid,paid_at,is_manual,manually_marked_at")
            .eq("session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
        if (paymentError) {
            console.error("[payments/status] lookup failed:", paymentError)
            return NextResponse.json({ error: "Failed to fetch payment status" }, { status: 500 })
        }
        if (!payment) return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
        return NextResponse.json({
            status: session.status === "paid" ? "paid" : payment.status,
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
