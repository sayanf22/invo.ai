import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest } from "@/lib/api-auth"
import { getPublicDocumentUrl } from "@/lib/public-capability"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Payment links are created transactionally by /api/emails/send-document only. */
export async function POST() {
    return NextResponse.json({
        error: "Payment links are created only after the invoice amount is confirmed during Send.",
        code: "CREATE_ON_SEND_ONLY",
    }, {
        status: 405,
        headers: { Allow: "GET" },
    })
}

/** Owner-only lookup used by the toolbar to display an existing link and status. */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const sessionId = request.nextUrl.searchParams.get("sessionId") || ""
    if (!UUID_PATTERN.test(sessionId)) {
        return NextResponse.json({ error: "A valid sessionId is required" }, { status: 400 })
    }
    try {
        const db = adminClient()
        const [paymentResult, sessionResult] = await Promise.all([
            db.from("invoice_payments")
                .select("id,short_url,status,amount,currency,reference_id,razorpay_payment_link_id,paid_at,amount_paid,created_at,gateway")
                .eq("session_id", sessionId).eq("user_id", auth.user.id)
                .order("created_at", { ascending: false }).limit(1).maybeSingle(),
            db.from("document_sessions").select("public_id")
                .eq("id", sessionId).eq("user_id", auth.user.id).maybeSingle(),
        ])
        if (paymentResult.error || sessionResult.error) throw paymentResult.error || sessionResult.error
        if (!sessionResult.data) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        const data = paymentResult.data
        return NextResponse.json({
            paymentLink: data ? {
                ...data,
                platformLink: getPublicDocumentUrl(sessionResult.data.public_id),
            } : null,
        }, {
            headers: { "Cache-Control": "private, no-store" },
        })
    } catch (error) {
        console.error("[payments/create-link] lookup failed:", error)
        return NextResponse.json({ error: "Failed to load payment link" }, { status: 500 })
    }
}