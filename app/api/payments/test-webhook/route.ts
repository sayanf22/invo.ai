import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { decrypt } from "@/lib/encrypt"
import { logAudit } from "@/lib/audit-log"
import {
    checkCashfreeConnection,
    checkRazorpayConnection,
    checkStripeConnection,
    connectionFailureMessage,
    connectionFailureStatus,
    type ProviderConnectionCheck,
} from "@/lib/payment-connection-test"

type Gateway = "razorpay" | "stripe" | "cashfree"
type CheckStatus = "passed" | "pending" | "warning" | "failed"
type ConnectionCheck = { id: string; label: string; status: CheckStatus; detail: string }

async function hmac(value: string, secret: string, format: "hex" | "base64"): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)))
    if (format === "base64") return btoa(String.fromCharCode(...signed))
    return Array.from(signed, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function failedProviderResponse(gateway: Gateway, provider: string, check: ProviderConnectionCheck) {
    const temporary = check.failure === "provider_unavailable"
    return NextResponse.json({
        success: false,
        gateway,
        message: connectionFailureMessage(provider, check),
        checks: [{
            id: "credentials",
            label: "Provider API authentication",
            status: temporary ? "warning" : "failed",
            detail: temporary ? "Provider could not be reached; saved verification was not removed." : "The saved credentials were not accepted.",
        } satisfies ConnectionCheck],
    }, { status: connectionFailureStatus(check) })
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
    if (!['razorpay', 'stripe', 'cashfree'].includes(String(body.gateway))) {
        return NextResponse.json({ error: "Invalid gateway" }, { status: 400 })
    }
    const gateway = body.gateway as Gateway

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const verificationColumns = {
        razorpay: ["razorpay_credentials_verified_at", "razorpay_local_webhook_verified_at", "razorpay_provider_webhook_verified_at"],
        stripe: ["stripe_credentials_verified_at", "stripe_webhook_verified_at"],
        cashfree: ["cashfree_credentials_verified_at", "cashfree_local_webhook_verified_at", "cashfree_webhook_verified_at"],
    } as const
    const clearVerification = async (name: Gateway) => {
        const values = Object.fromEntries(verificationColumns[name].map(column => [column, null]))
        await db.from("user_payment_settings").update(values).eq("user_id", auth.user.id)
    }
    const markCredentialsVerified = async (name: Gateway) => {
        const verifiedAt = new Date().toISOString()
        const { error } = await db.from("user_payment_settings")
            .update({ [`${name}_credentials_verified_at`]: verifiedAt })
            .eq("user_id", auth.user.id)
        if (error) throw error
    }
    const { data: settings, error: settingsError } = await db.from("user_payment_settings")
        .select("razorpay_key_id,razorpay_key_secret_encrypted,razorpay_webhook_secret,razorpay_enabled,razorpay_provider_webhook_verified_at,stripe_secret_key_encrypted,stripe_webhook_id,stripe_webhook_secret,stripe_enabled,stripe_test_mode,cashfree_client_id,cashfree_client_secret_encrypted,cashfree_enabled,cashfree_test_mode,cashfree_webhook_verified_at")
        .eq("user_id", auth.user.id).maybeSingle()
    if (settingsError) return NextResponse.json({ error: "Failed to load payment settings" }, { status: 500 })
    if (!settings) return NextResponse.json({ error: "No payment settings found" }, { status: 404 })

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com").replace(/\/$/, "")
    const now = Date.now()
    let endpoint = ""
    let payload = ""
    let mode: "test" | "live" = "live"
    let providerDeliveryVerified = false
    let account: ProviderConnectionCheck["account"]
    const checks: ConnectionCheck[] = []
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-clorefy-test-webhook": "1" }
    try {
        if (gateway === "razorpay") {
            if (!settings.razorpay_enabled || !settings.razorpay_key_id || !settings.razorpay_key_secret_encrypted || !settings.razorpay_webhook_secret) {
                return NextResponse.json({ error: "Razorpay credentials or webhook secret are not configured" }, { status: 422 })
            }
            mode = settings.razorpay_key_id.startsWith("rzp_test_") ? "test" : "live"
            const apiSecret = await decrypt(settings.razorpay_key_secret_encrypted)
            const webhookSecret = await decrypt(settings.razorpay_webhook_secret)
            if (!apiSecret || !webhookSecret) {
                await clearVerification("razorpay")
                return NextResponse.json({ error: "Razorpay credentials could not be decrypted. Reconnect Razorpay." }, { status: 422 })
            }
            const providerCheck = await checkRazorpayConnection(settings.razorpay_key_id, apiSecret)
            if (!providerCheck.ok) {
                if (providerCheck.failure === "invalid_credentials") await clearVerification("razorpay")
                return failedProviderResponse(gateway, "Razorpay", providerCheck)
            }
            await markCredentialsVerified("razorpay")
            checks.push(
                { id: "credentials", label: "API credentials", status: "passed", detail: "Razorpay accepted the saved Key ID and Key Secret." },
                { id: "payment_api", label: "Payment Links API", status: "passed", detail: "The Razorpay Payment Links API is reachable in this mode." },
            )
            providerDeliveryVerified = Boolean(settings.razorpay_provider_webhook_verified_at)
            endpoint = `${appUrl}/api/razorpay/webhook/${auth.user.id}`
            payload = JSON.stringify({ entity: "event", event: "payment_link.paid", payload: {} })
            headers["x-razorpay-signature"] = await hmac(payload, webhookSecret, "hex")
            headers["x-razorpay-event-id"] = `test_${now}`
        } else if (gateway === "stripe") {
            if (!settings.stripe_enabled || !settings.stripe_secret_key_encrypted) {
                return NextResponse.json({ error: "Stripe credentials are not configured" }, { status: 422 })
            }
            mode = settings.stripe_test_mode ? "test" : "live"
            const apiSecret = await decrypt(settings.stripe_secret_key_encrypted)
            if (!apiSecret) {
                await clearVerification("stripe")
                return NextResponse.json({ error: "Stripe credentials could not be decrypted. Reconnect Stripe." }, { status: 422 })
            }
            const providerCheck = await checkStripeConnection(apiSecret)
            if (!providerCheck.ok) {
                if (providerCheck.failure === "invalid_credentials") await clearVerification("stripe")
                return failedProviderResponse(gateway, "Stripe", providerCheck)
            }
            await markCredentialsVerified("stripe")
            account = providerCheck.account
            checks.push({ id: "credentials", label: "API credentials", status: "passed", detail: "Stripe accepted the saved Secret Key." })
            const chargesNeedAction = mode === "live" && account?.chargesEnabled === false
            checks.push({
                id: "payment_api",
                label: "Account payment capability",
                status: chargesNeedAction ? "warning" : "passed",
                detail: chargesNeedAction
                    ? "Stripe accepted the key, but live charges are not enabled for this account yet. Complete Stripe account requirements."
                    : account?.chargesEnabled === true ? "Stripe reports that this account can accept charges." : "The Stripe account API is reachable.",
            })
            if (!settings.stripe_webhook_id || !settings.stripe_webhook_secret) {
                return NextResponse.json({
                    success: false, gateway, mode, credentialsVerified: true,
                    message: "Stripe credentials work, but the webhook registration is missing. Reconnect Stripe to repair it.",
                    checks: [...checks, { id: "provider_webhook", label: "Stripe webhook registration", status: "failed", detail: "No registered webhook is stored." }],
                }, { status: 409 })
            }
            const webhookSecret = await decrypt(settings.stripe_webhook_secret)
            if (!webhookSecret) {
                await db.from("user_payment_settings").update({ stripe_webhook_verified_at: null }).eq("user_id", auth.user.id)
                return NextResponse.json({ error: "Stripe webhook secret is unreadable. Reconnect Stripe." }, { status: 422 })
            }
            const expectedEndpoint = `${appUrl}/api/stripe/webhook/${auth.user.id}`
            const webhookCheck = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${encodeURIComponent(settings.stripe_webhook_id)}`, {
                headers: { Authorization: `Bearer ${apiSecret}` },
                signal: AbortSignal.timeout(15000),
            }).catch(() => null)
            if (!webhookCheck) {
                return NextResponse.json({ success: false, gateway, mode, credentialsVerified: true, message: "Stripe accepted the key, but its webhook service did not respond. Try again shortly.", checks }, { status: 503 })
            }
            if (!webhookCheck.ok) {
                await db.from("user_payment_settings").update({ stripe_webhook_verified_at: null }).eq("user_id", auth.user.id)
                return NextResponse.json({ success: false, gateway, mode, credentialsVerified: true, message: "Stripe credentials work, but the saved webhook registration no longer exists.", checks: [...checks, { id: "provider_webhook", label: "Stripe webhook registration", status: "failed", detail: "Reconnect Stripe to register the webhook again." }] }, { status: 409 })
            }
            const remoteWebhook = await webhookCheck.json()
            if (remoteWebhook.url !== expectedEndpoint || remoteWebhook.status !== "enabled") {
                await db.from("user_payment_settings").update({ stripe_webhook_verified_at: null }).eq("user_id", auth.user.id)
                return NextResponse.json({ success: false, gateway, mode, credentialsVerified: true, message: "Stripe credentials work, but the webhook is disabled or points to another URL.", checks: [...checks, { id: "provider_webhook", label: "Stripe webhook registration", status: "failed", detail: "Reconnect Stripe to repair the webhook URL." }] }, { status: 409 })
            }
            providerDeliveryVerified = true
            checks.push({ id: "provider_webhook", label: "Stripe webhook registration", status: "passed", detail: "Stripe reports the Clorefy webhook endpoint is enabled." })
            endpoint = expectedEndpoint
            const timestamp = Math.floor(now / 1000)
            payload = JSON.stringify({ id: `evt_test_${now}`, type: "checkout.session.completed", livemode: mode === "live", data: { object: {} } })
            headers["stripe-signature"] = `t=${timestamp},v1=${await hmac(`${timestamp}.${payload}`, webhookSecret, "hex")}`
        } else {
            if (!settings.cashfree_enabled || !settings.cashfree_client_id || !settings.cashfree_client_secret_encrypted) {
                return NextResponse.json({ error: "Cashfree credentials are not configured" }, { status: 422 })
            }
            mode = settings.cashfree_test_mode ? "test" : "live"
            const apiSecret = await decrypt(settings.cashfree_client_secret_encrypted)
            if (!apiSecret) {
                await clearVerification("cashfree")
                return NextResponse.json({ error: "Cashfree credentials could not be decrypted. Reconnect Cashfree." }, { status: 422 })
            }
            const providerCheck = await checkCashfreeConnection(settings.cashfree_client_id, apiSecret, mode === "test")
            if (!providerCheck.ok) {
                if (providerCheck.failure === "invalid_credentials") await clearVerification("cashfree")
                return failedProviderResponse(gateway, "Cashfree", providerCheck)
            }
            await markCredentialsVerified("cashfree")
            checks.push(
                { id: "credentials", label: "API credentials", status: "passed", detail: "Cashfree accepted the saved Payments API credentials." },
                { id: "payment_api", label: "Payment Links API", status: "passed", detail: `The Cashfree Payment Links API is reachable in ${mode} mode.` },
            )
            providerDeliveryVerified = Boolean(settings.cashfree_webhook_verified_at)
            const timestamp = String(now)
            endpoint = `${appUrl}/api/cashfree/webhook/${auth.user.id}`
            payload = JSON.stringify({ type: "PAYMENT_LINK_EVENT", data: { link: { cf_link_id: `test_${now}`, link_status: "PAID" } } })
            headers["x-webhook-timestamp"] = timestamp
            headers["x-webhook-signature"] = await hmac(`${timestamp}${payload}`, apiSecret, "base64")
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: payload,
            signal: AbortSignal.timeout(15000),
        }).catch(() => null)
        const responseBody = response ? await response.json().catch(() => null) : null
        if (!response || !response.ok || responseBody?.test !== true) {
            const webhookReset = gateway === "razorpay"
                ? { razorpay_local_webhook_verified_at: null }
                : gateway === "stripe" ? { stripe_webhook_verified_at: null } : { cashfree_local_webhook_verified_at: null }
            await db.from("user_payment_settings").update(webhookReset).eq("user_id", auth.user.id)
            return NextResponse.json({
                success: false,
                gateway,
                mode,
                credentialsVerified: true,
                message: "The provider API accepted the credentials, but Clorefy's signed webhook receiver did not acknowledge the test.",
                checks: [...checks, { id: "webhook_receiver", label: "Clorefy webhook receiver", status: "failed", detail: "Check the application URL and webhook configuration, then retry." }],
            }, { status: 502 })
        }

        const verifiedAt = new Date(now).toISOString()
        checks.push({ id: "webhook_receiver", label: "Clorefy webhook receiver", status: "passed", detail: "A signed synthetic event was verified and acknowledged. No payment was created." })
        if (gateway !== "stripe") {
            checks.push({
                id: "provider_webhook",
                label: "Real provider delivery",
                status: providerDeliveryVerified ? "passed" : "pending",
                detail: providerDeliveryVerified
                    ? `Clorefy has received a correctly signed real ${gateway === "razorpay" ? "Razorpay" : "Cashfree"} event.`
                    : `Awaiting the first correctly signed real ${gateway === "razorpay" ? "Razorpay" : "Cashfree"} event. The local receiver test cannot prove provider dashboard delivery.`,
            })
        }
        const verificationUpdate = gateway === "razorpay"
            ? { razorpay_credentials_verified_at: verifiedAt, razorpay_local_webhook_verified_at: verifiedAt }
            : gateway === "stripe"
              ? { stripe_credentials_verified_at: verifiedAt, stripe_webhook_verified_at: verifiedAt }
              : { cashfree_credentials_verified_at: verifiedAt, cashfree_local_webhook_verified_at: verifiedAt }
        const { error: verificationError } = await db.from("user_payment_settings").update(verificationUpdate).eq("user_id", auth.user.id)
        if (verificationError) throw verificationError

        const hasWarning = checks.some(check => check.status === "warning")
        const hasPending = checks.some(check => check.status === "pending")
        const message = hasWarning
            ? "Connection succeeded, but the provider account still requires attention before live payments are ready."
            : hasPending
              ? "Payment API and webhook receiver tests passed. Real provider delivery will be confirmed after the first signed provider event."
              : "Payment API, account, and webhook checks passed."
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_settings.connection_tested",
            metadata: { gateway, mode, provider_delivery_verified: providerDeliveryVerified, has_warning: hasWarning },
        }, request).catch(() => {})

        return NextResponse.json({
            success: true,
            gateway,
            mode,
            testedAt: verifiedAt,
            credentialsVerified: true,
            localReceiverVerified: true,
            providerDeliveryVerified,
            account,
            checks,
            message,
        })
    } catch (error) {
        console.error("[payments/test-webhook] failed:", error)
        return NextResponse.json({ success: false, error: "Connection test failed unexpectedly. Try again shortly." }, { status: 500 })
    }
}
