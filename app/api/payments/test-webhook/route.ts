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
    const verificationColumns = {
        razorpay: ["razorpay_credentials_verified_at", "razorpay_local_webhook_verified_at", "razorpay_provider_webhook_verified_at"],
        stripe: ["stripe_credentials_verified_at", "stripe_webhook_verified_at"],
        cashfree: ["cashfree_credentials_verified_at", "cashfree_local_webhook_verified_at", "cashfree_webhook_verified_at"],
    } as const
    const clearVerification = async (name: "razorpay" | "stripe" | "cashfree") => {
        const values = Object.fromEntries(verificationColumns[name].map(column => [column, null]))
        await db.from("user_payment_settings").update(values).eq("user_id", auth.user.id)
    }
    const markCredentialsVerified = async (name: "razorpay" | "stripe" | "cashfree", verifiedAt: string) => {
        await db.from("user_payment_settings").update({ [`${name}_credentials_verified_at`]: verifiedAt }).eq("user_id", auth.user.id)
    }
    const { data: settings, error: settingsError } = await db.from("user_payment_settings")
        .select("razorpay_key_id,razorpay_key_secret_encrypted,razorpay_webhook_secret,razorpay_enabled,stripe_secret_key_encrypted,stripe_webhook_id,stripe_webhook_secret,stripe_enabled,stripe_test_mode,cashfree_client_id,cashfree_client_secret_encrypted,cashfree_enabled,cashfree_test_mode")
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
            if (!settings.razorpay_enabled || !settings.razorpay_key_id || !settings.razorpay_key_secret_encrypted || !settings.razorpay_webhook_secret) {
                return NextResponse.json({ error: "Razorpay credentials or webhook secret are not configured" }, { status: 422 })
            }
            const apiSecret = await decrypt(settings.razorpay_key_secret_encrypted)
            const secret = await decrypt(settings.razorpay_webhook_secret)
            if (!apiSecret || !secret) {
                await clearVerification("razorpay")
                return NextResponse.json({ error: "Razorpay credentials could not be decrypted" }, { status: 422 })
            }
            const credentialCheck = await fetch("https://api.razorpay.com/v1/payment_links?count=1", {
                headers: { Authorization: `Basic ${btoa(`${settings.razorpay_key_id}:${apiSecret}`)}` },
                signal: AbortSignal.timeout(15000),
            })
            if (!credentialCheck.ok) {
                await clearVerification("razorpay")
                return NextResponse.json({ error: "Razorpay credentials are no longer valid" }, { status: 422 })
            }
            await markCredentialsVerified("razorpay", new Date(now).toISOString())
            endpoint = `${appUrl}/api/razorpay/webhook/${auth.user.id}`
            payload = JSON.stringify({ entity: "event", event: "payment_link.paid", payload: {} })
            headers["x-razorpay-signature"] = await hmac(payload, secret, "hex")
            headers["x-razorpay-event-id"] = `test_${now}`
        } else if (gateway === "stripe") {
            if (!settings.stripe_enabled || !settings.stripe_secret_key_encrypted || !settings.stripe_webhook_id || !settings.stripe_webhook_secret) {
                return NextResponse.json({ error: "Stripe credentials or webhook are not configured" }, { status: 422 })
            }
            const apiSecret = await decrypt(settings.stripe_secret_key_encrypted)
            const secret = await decrypt(settings.stripe_webhook_secret)
            if (!apiSecret || !secret) {
                await clearVerification("stripe")
                return NextResponse.json({ error: "Stripe credentials could not be decrypted" }, { status: 422 })
            }
            const webhookCheck = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${encodeURIComponent(settings.stripe_webhook_id)}`, {
                headers: { Authorization: `Bearer ${apiSecret}` },
                signal: AbortSignal.timeout(15000),
            })
            if (!webhookCheck.ok) {
                await clearVerification("stripe")
                return NextResponse.json({ error: "Stripe credentials or registered webhook are no longer valid" }, { status: 422 })
            }
            const remoteWebhook = await webhookCheck.json()
            const expectedEndpoint = `${appUrl}/api/stripe/webhook/${auth.user.id}`
            if (remoteWebhook.url !== expectedEndpoint || remoteWebhook.status !== "enabled") {
                await db.from("user_payment_settings").update({ stripe_webhook_verified_at: null }).eq("user_id", auth.user.id)
                return NextResponse.json({ error: "Stripe webhook is missing, disabled, or points to a different URL" }, { status: 409 })
            }
            await markCredentialsVerified("stripe", new Date(now).toISOString())
            endpoint = expectedEndpoint
            const timestamp = Math.floor(now / 1000)
            payload = JSON.stringify({
                id: `evt_test_${now}`,
                type: "checkout.session.completed",
                livemode: settings.stripe_test_mode !== true,
                data: { object: {} },
            })
            headers["stripe-signature"] = `t=${timestamp},v1=${await hmac(`${timestamp}.${payload}`, secret, "hex")}`
        } else {
            if (!settings.cashfree_enabled || !settings.cashfree_client_id || !settings.cashfree_client_secret_encrypted) {
                return NextResponse.json({ error: "Cashfree credentials are not configured" }, { status: 422 })
            }
            const secret = await decrypt(settings.cashfree_client_secret_encrypted)
            if (!secret) {
                await clearVerification("cashfree")
                return NextResponse.json({ error: "Cashfree credentials are unavailable" }, { status: 422 })
            }
            const cashfreeBaseUrl = settings.cashfree_test_mode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"
            const credentialCheck = await fetch(`${cashfreeBaseUrl}/pg/links?count=1`, {
                headers: { "x-api-version": "2025-01-01", "x-client-id": settings.cashfree_client_id, "x-client-secret": secret },
                signal: AbortSignal.timeout(15000),
            })
            if (!credentialCheck.ok) {
                await clearVerification("cashfree")
                return NextResponse.json({ error: "Cashfree credentials are no longer valid" }, { status: 422 })
            }
            await markCredentialsVerified("cashfree", new Date(now).toISOString())
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
            const webhookReset = gateway === "razorpay"
                ? { razorpay_local_webhook_verified_at: null }
                : gateway === "stripe"
                  ? { stripe_webhook_verified_at: null }
                  : { cashfree_local_webhook_verified_at: null }
            await db.from("user_payment_settings").update(webhookReset).eq("user_id", auth.user.id)
            return NextResponse.json({
                success: false,
                status: response.status,
                message: "The signed webhook test was not acknowledged.",
            }, { status: 502 })
        }
        const verifiedAt = new Date(now).toISOString()
        const verificationUpdate = gateway === "razorpay"
            ? { razorpay_credentials_verified_at: verifiedAt, razorpay_local_webhook_verified_at: verifiedAt }
            : gateway === "stripe"
              ? { stripe_credentials_verified_at: verifiedAt, stripe_webhook_verified_at: verifiedAt }
              : { cashfree_credentials_verified_at: verifiedAt, cashfree_local_webhook_verified_at: verifiedAt }
        const { error: verificationError } = await db.from("user_payment_settings")
            .update(verificationUpdate).eq("user_id", auth.user.id)
        if (verificationError) throw verificationError

        const providerDeliveryVerified = gateway === "stripe"
        const message = gateway === "razorpay"
            ? "Credentials and local signed webhook receiver verified. Confirm the same URL and secret are enabled in the Razorpay dashboard."
            : gateway === "cashfree"
              ? "Credentials and the local signed receiver are verified. Provider delivery will be confirmed by the first real Cashfree event."
              : "Credentials, Stripe webhook registration, and local signed receiver verified."
        return NextResponse.json({
            success: true,
            status: response.status,
            credentialsVerified: true,
            localReceiverVerified: true,
            providerDeliveryVerified,
            message,
        })
    } catch (error) {
        console.error("[payments/test-webhook] failed:", error)
        return NextResponse.json({ success: false, error: "Failed to verify webhook endpoint." }, { status: 500 })
    }
}
