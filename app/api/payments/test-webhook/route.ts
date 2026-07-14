import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { decrypt } from "@/lib/encrypt"

async function hmac(value: string, secret: string, format: "hex" | "base64"): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))
    if (format === "base64") return btoa(String.fromCharCode(...signed))
    return Array.from(signed, (byte) => byte.toString(16).padStart(2, "0")).join("")
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
    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError
    const gateway = body.gateway
    if (!["razorpay", "stripe", "cashfree"].includes(String(gateway))) {
        return NextResponse.json({ error: "Invalid gateway" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: settings, error: settingsError } = await db.from("user_payment_settings")
        .select("razorpay_webhook_secret,razorpay_enabled,stripe_webhook_secret,stripe_enabled,stripe_test_mode,cashfree_client_secret_encrypted,cashfree_enabled,cashfree_test_mode")
        .eq("user_id", auth.user.id).maybeSingle()
    if (settingsError) return NextResponse.json({ error: "Failed to load payment settings" }, { status: 500 })
    if (!settings) return NextResponse.json({ error: "No payment settings found" }, { status: 404 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
    const now = Date.now()
    let endpoint = ""
    let payload = ""
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-clorefy-test-webhook": "1",
    }

    try {
        if (gateway === "razorpay") {
            if (!settings.razorpay_enabled || !settings.razorpay_webhook_secret) {
                return NextResponse.json({ error: "Razorpay webhook is not configured" }, { status: 422 })
            }
            const secret = await decrypt(settings.razorpay_webhook_secret).catch(() => null)
                || settings.razorpay_webhook_secret
            endpoint = `${appUrl}/api/razorpay/webhook/${auth.user.id}`
            payload = JSON.stringify({ entity: "event", event: "payment_link.paid", payload: {} })
            headers["x-razorpay-signature"] = await hmac(payload, secret, "hex")
            headers["x-razorpay-event-id"] = `test_${now}`
        } else if (gateway === "stripe") {
            if (!settings.stripe_enabled || !settings.stripe_webhook_secret) {
                return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 422 })
            }
            const secret = await decrypt(settings.stripe_webhook_secret).catch(() => null)
                || settings.stripe_webhook_secret
            const timestamp = Math.floor(now / 1000)
            endpoint = `${appUrl}/api/stripe/webhook/${auth.user.id}`
            payload = JSON.stringify({
                id: `evt_test_${now}`,
                type: "checkout.session.completed",
                livemode: settings.stripe_test_mode !== true,
                data: { object: {} },
            })
            headers["stripe-signature"] = `t=${timestamp},v1=${await hmac(`${timestamp}.${payload}`, secret, "hex")}`
        } else {
            if (!settings.cashfree_enabled || !settings.cashfree_client_secret_encrypted) {
                return NextResponse.json({ error: "Cashfree webhook is not configured" }, { status: 422 })
            }
            const secret = await decrypt(settings.cashfree_client_secret_encrypted)
            if (!secret) return NextResponse.json({ error: "Cashfree credentials are unavailable" }, { status: 422 })
            const timestamp = String(now)
            endpoint = `${appUrl}/api/cashfree/webhook/${auth.user.id}`
            payload = JSON.stringify({
                type: "PAYMENT_LINK_EVENT",
                data: { link: { cf_link_id: `test_${now}`, link_status: "PAID" } },
            })
            headers["x-webhook-timestamp"] = timestamp
            headers["x-webhook-signature"] = await hmac(`${timestamp}${payload}`, secret, "base64")
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: payload,
            signal: AbortSignal.timeout(15000),
        })
        const responseBody = await response.json().catch(() => null)
        if (!response.ok || responseBody?.test !== true) {
            return NextResponse.json({
                success: false,
                status: response.status,
                message: "The signed webhook test was not acknowledged.",
            }, { status: 502 })
        }
        return NextResponse.json({ success: true, status: response.status, message: "Webhook signature and endpoint verified without changing payment state." })
    } catch (error) {
        console.error("[payments/test-webhook] failed:", error)
        return NextResponse.json({ success: false, error: "Failed to verify webhook endpoint." }, { status: 500 })
    }
}
