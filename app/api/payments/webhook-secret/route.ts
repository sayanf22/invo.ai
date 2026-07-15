import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { encrypt } from "@/lib/encrypt"
import { logAudit } from "@/lib/audit-log"
import { generateWebhookSecret } from "@/lib/razorpay"

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** Stored webhook secrets are write-only after initial creation. */
export async function GET() {
    return NextResponse.json(
        { error: "Webhook secrets cannot be revealed. Rotate the secret to receive a new value once." },
        { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } }
    )
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
    const rotating = body.rotate === true
    const secret = rotating
        ? generateWebhookSecret()
        : typeof body.secret === "string"
            ? body.secret.trim()
            : ""
    if (!rotating && (secret.length < 16 || secret.length > 256)) {
        return NextResponse.json({ error: "Secret must be between 16 and 256 characters" }, { status: 400 })
    }
    if (body.rotate !== undefined && typeof body.rotate !== "boolean") {
        return NextResponse.json({ error: "rotate must be a boolean" }, { status: 400 })
    }

    try {
        const db = adminClient()
        const { data, error } = await db.from("user_payment_settings").update({
            razorpay_webhook_secret: await encrypt(secret),
            razorpay_local_webhook_verified_at: null,
            razorpay_provider_webhook_verified_at: null,
            updated_at: new Date().toISOString(),
        }).eq("user_id", auth.user.id).eq("razorpay_enabled", true).select("user_id").maybeSingle()
        if (error) throw error
        if (!data) return NextResponse.json({ error: "Razorpay is not connected" }, { status: 404 })
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: (rotating
                ? "payment_settings.webhook_secret_rotated"
                : "payment_settings.webhook_secret_updated") as any,
            metadata: { gateway: "razorpay" } as any,
        }, request).catch(() => {})
        return NextResponse.json(
            { success: true, webhookSecret: rotating ? secret : undefined },
            { headers: { "Cache-Control": "no-store" } }
        )
    } catch (error) {
        console.error("[payments/webhook-secret] update failed:", error)
        return NextResponse.json({ error: "Failed to save webhook secret" }, { status: 500 })
    }
}
