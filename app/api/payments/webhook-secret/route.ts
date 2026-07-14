import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { decrypt, encrypt } from "@/lib/encrypt"
import { logAudit } from "@/lib/audit-log"

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Razorpay lets merchants choose the signing secret. Cashfree signs with its client secret. */
export async function GET(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError
    if (request.nextUrl.searchParams.get("gateway") !== "razorpay") {
        return NextResponse.json({ error: "Only Razorpay uses a configurable webhook secret" }, { status: 400 })
    }

    try {
        const { data, error } = await adminClient().from("user_payment_settings")
            .select("razorpay_webhook_secret,razorpay_enabled")
            .eq("user_id", auth.user.id).maybeSingle()
        if (error) throw error
        if (!data?.razorpay_enabled || !data.razorpay_webhook_secret) {
            return NextResponse.json({ error: "Razorpay is not connected" }, { status: 404 })
        }
        const secret = await decrypt(data.razorpay_webhook_secret).catch(() => null)
            || data.razorpay_webhook_secret
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_settings.webhook_secret_viewed" as any,
            metadata: { gateway: "razorpay" } as any,
        }, request).catch(() => {})
        return NextResponse.json({ secret }, { headers: { "Cache-Control": "no-store" } })
    } catch (error) {
        console.error("[payments/webhook-secret] read failed:", error)
        return NextResponse.json({ error: "Failed to load webhook secret" }, { status: 500 })
    }
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
    if (body.gateway !== "razorpay") {
        return NextResponse.json({ error: "Only Razorpay uses a configurable webhook secret" }, { status: 400 })
    }
    if (typeof body.secret !== "string" || body.secret.trim().length < 16 || body.secret.trim().length > 256) {
        return NextResponse.json({ error: "Secret must be between 16 and 256 characters" }, { status: 400 })
    }

    try {
        const db = adminClient()
        const { data, error } = await db.from("user_payment_settings").update({
            razorpay_webhook_secret: await encrypt(body.secret.trim()),
            updated_at: new Date().toISOString(),
        }).eq("user_id", auth.user.id).eq("razorpay_enabled", true).select("user_id").maybeSingle()
        if (error) throw error
        if (!data) return NextResponse.json({ error: "Razorpay is not connected" }, { status: 404 })
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_settings.webhook_secret_updated" as any,
            metadata: { gateway: "razorpay" } as any,
        }, request).catch(() => {})
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[payments/webhook-secret] update failed:", error)
        return NextResponse.json({ error: "Failed to save webhook secret" }, { status: 500 })
    }
}
