import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { encrypt, decrypt } from "@/lib/encrypt"
import { logAudit } from "@/lib/audit-log"
import { sanitizeSQLInput as sanitizeInput } from "@/lib/sanitize"
import { generateWebhookSecret } from "@/lib/razorpay"
import { registerStripeWebhook, deleteStripeWebhook } from "@/lib/stripe-payments"

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function mutationAuth(request: NextRequest) {
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

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    try {
        const { data, error } = await adminClient().from("user_payment_settings").select(`
            razorpay_key_id, razorpay_account_name, razorpay_enabled, razorpay_test_mode,
            razorpay_webhook_id, razorpay_webhook_secret,
            razorpay_credentials_verified_at, razorpay_local_webhook_verified_at,
            razorpay_provider_webhook_verified_at,
            stripe_enabled, stripe_test_mode, stripe_webhook_id, stripe_webhook_secret,
            stripe_credentials_verified_at, stripe_webhook_verified_at,
            cashfree_client_id, cashfree_enabled, cashfree_test_mode,
            cashfree_credentials_verified_at, cashfree_local_webhook_verified_at,
            cashfree_webhook_verified_at,
            updated_at
        `).eq("user_id", auth.user.id).maybeSingle()
        if (error) throw error
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com").replace(/\/$/, "")
        return NextResponse.json({
            settings: data ? {
                razorpay: data.razorpay_enabled ? {
                    keyIdHint: data.razorpay_key_id ? `${data.razorpay_key_id.slice(0, 8)}••••${data.razorpay_key_id.slice(-4)}` : null,
                    accountName: data.razorpay_account_name,
                    testMode: data.razorpay_test_mode,
                    credentialsVerified: Boolean(data.razorpay_credentials_verified_at),
                    verifiedAt: data.razorpay_credentials_verified_at,
                    webhookUrl: `${appUrl}/api/razorpay/webhook/${auth.user.id}`,
                    webhookMode: "manual",
                    webhookConfigured: Boolean(data.razorpay_webhook_secret),
                    webhookRegistered: Boolean(data.razorpay_provider_webhook_verified_at),
                    localReceiverVerifiedAt: data.razorpay_local_webhook_verified_at,
                    providerWebhookVerifiedAt: data.razorpay_provider_webhook_verified_at,
                } : null,
                stripe: data.stripe_enabled ? {
                    testMode: data.stripe_test_mode,
                    credentialsVerified: Boolean(data.stripe_credentials_verified_at),
                    verifiedAt: data.stripe_credentials_verified_at,
                    webhookUrl: `${appUrl}/api/stripe/webhook/${auth.user.id}`,
                    webhookMode: "automatic",
                    webhookConfigured: Boolean(data.stripe_webhook_secret),
                    webhookRegistered: Boolean(data.stripe_webhook_verified_at),
                    providerWebhookVerifiedAt: data.stripe_webhook_verified_at,
                } : null,
                cashfree: data.cashfree_enabled ? {
                    clientIdHint: data.cashfree_client_id ? `${data.cashfree_client_id.slice(0, 4)}••••${data.cashfree_client_id.slice(-4)}` : null,
                    testMode: data.cashfree_test_mode,
                    credentialsVerified: Boolean(data.cashfree_credentials_verified_at),
                    verifiedAt: data.cashfree_credentials_verified_at,
                    webhookUrl: `${appUrl}/api/cashfree/webhook/${auth.user.id}`,
                    webhookMode: "per_link",
                    webhookConfigured: true,
                    webhookRegistered: Boolean(data.cashfree_webhook_verified_at),
                    localReceiverVerifiedAt: data.cashfree_local_webhook_verified_at,
                    providerWebhookVerifiedAt: data.cashfree_webhook_verified_at,
                } : null,
                updatedAt: data.updated_at,
            } : null,
        })
    } catch (error) {
        console.error("[payments/settings] read failed:", error)
        return NextResponse.json({ error: "Failed to load payment settings" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const authorization = await mutationAuth(request)
    if (authorization.response) return authorization.response
    const { auth } = authorization
    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 10 * 1024)
    if (sizeError) return sizeError
    try {
        if (body.gateway === "razorpay") return await saveRazorpay(auth, body, request)
        if (body.gateway === "stripe") return await saveStripe(auth, body, request)
        if (body.gateway === "cashfree") return await saveCashfree(auth, body, request)
        return NextResponse.json({ error: "Invalid gateway" }, { status: 400 })
    } catch (error) {
        console.error("[payments/settings] save failed:", error)
        return NextResponse.json({ error: "Failed to save payment settings" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const authorization = await mutationAuth(request)
    if (authorization.response) return authorization.response
    const { auth } = authorization
    const gateway = request.nextUrl.searchParams.get("gateway")
    if (gateway && !["razorpay", "stripe", "cashfree"].includes(gateway)) {
        return NextResponse.json({ error: "Invalid gateway" }, { status: 400 })
    }
    try {
        const db = adminClient()
        if (gateway === "stripe") {
            const { data, error } = await db.from("user_payment_settings")
                .select("stripe_secret_key_encrypted,stripe_webhook_id")
                .eq("user_id", auth.user.id).maybeSingle()
            if (error) throw error
            if (data?.stripe_webhook_id && data.stripe_secret_key_encrypted) {
                const secret = await decrypt(data.stripe_secret_key_encrypted)
                if (secret) await deleteStripeWebhook(secret, data.stripe_webhook_id)
            }
            const { error: updateError } = await db.from("user_payment_settings").update({
                stripe_secret_key_encrypted: null,
                stripe_webhook_id: null,
                stripe_webhook_secret: null,
                stripe_credentials_verified_at: null,
                stripe_webhook_verified_at: null,
                stripe_enabled: false,
            }).eq("user_id", auth.user.id)
            if (updateError) throw updateError
        } else if (gateway === "razorpay") {
            const { error } = await db.from("user_payment_settings").update({
                razorpay_key_id: null,
                razorpay_key_secret_encrypted: null,
                razorpay_webhook_id: null,
                razorpay_webhook_secret: null,
                razorpay_credentials_verified_at: null,
                razorpay_local_webhook_verified_at: null,
                razorpay_provider_webhook_verified_at: null,
                razorpay_enabled: false,
            }).eq("user_id", auth.user.id)
            if (error) throw error
        } else if (gateway === "cashfree") {
            const { error } = await db.from("user_payment_settings").update({
                cashfree_client_id: null,
                cashfree_client_secret_encrypted: null,
                cashfree_webhook_secret: null,
                cashfree_credentials_verified_at: null,
                cashfree_local_webhook_verified_at: null,
                cashfree_webhook_verified_at: null,
                cashfree_enabled: false,
            }).eq("user_id", auth.user.id)
            if (error) throw error
        } else {
            const { error } = await db.from("user_payment_settings").delete().eq("user_id", auth.user.id)
            if (error) throw error
        }
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_settings.removed",
            metadata: { gateway: gateway || "all" } as any,
        }, request).catch(() => {})
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[payments/settings] delete failed:", error)
        return NextResponse.json({ error: "Failed to remove payment settings" }, { status: 500 })
    }
}

async function saveRazorpay(auth: any, body: Record<string, unknown>, request: NextRequest) {
    if (typeof body.keyId !== "string" || typeof body.keySecret !== "string") {
        return NextResponse.json({ error: "Key ID and Key Secret are required" }, { status: 400 })
    }
    const keyId = sanitizeInput(body.keyId).trim()
    const keySecret = body.keySecret.trim()
    if (!/^(rzp_live|rzp_test)_[A-Za-z0-9]{8,100}$/.test(keyId) || keySecret.length < 8 || keySecret.length > 256) {
        return NextResponse.json({ error: "Invalid Razorpay credentials" }, { status: 400 })
    }
    const verification = await fetch("https://api.razorpay.com/v1/payment_links?count=1", {
        headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        signal: AbortSignal.timeout(15000),
    })
    if (!verification.ok) return NextResponse.json({ error: "Razorpay rejected these credentials" }, { status: 400 })

    const db = adminClient()
    const { data: existing, error: existingError } = await db.from("user_payment_settings")
        .select("razorpay_webhook_secret").eq("user_id", auth.user.id).maybeSingle()
    if (existingError) throw existingError
    let webhookSecret = generateWebhookSecret()
    const isNewWebhookSecret = !existing?.razorpay_webhook_secret
    if (existing?.razorpay_webhook_secret) {
        const decryptedSecret = await decrypt(existing.razorpay_webhook_secret).catch(() => null)
        if (!decryptedSecret) {
            return NextResponse.json({ error: "Stored Razorpay webhook secret is unreadable. Remove the connection and reconnect it." }, { status: 409 })
        }
        webhookSecret = decryptedSecret
    }
    const verifiedAt = new Date().toISOString()
    const { error } = await db.from("user_payment_settings").upsert({
        user_id: auth.user.id,
        razorpay_key_id: keyId,
        razorpay_key_secret_encrypted: await encrypt(keySecret),
        razorpay_account_name: body.accountName ? sanitizeInput(String(body.accountName)).slice(0, 100) : null,
        razorpay_enabled: true,
        razorpay_test_mode: keyId.startsWith("rzp_test_"),
        razorpay_webhook_secret: await encrypt(webhookSecret),
        razorpay_credentials_verified_at: verifiedAt,
        razorpay_local_webhook_verified_at: null,
        razorpay_provider_webhook_verified_at: null,
        updated_at: verifiedAt,
    }, { onConflict: "user_id" })
    if (error) throw error
    await auditConnection(auth, "razorpay", keyId.startsWith("rzp_test_"), request)
    return NextResponse.json({
        success: true,
        gateway: "razorpay",
        testMode: keyId.startsWith("rzp_test_"),
        // Returned only when first generated. Existing secrets are never revealed again.
        webhookSecret: isNewWebhookSecret ? webhookSecret : undefined,
    })
}

async function saveStripe(auth: any, body: Record<string, unknown>, request: NextRequest) {
    if (typeof body.secretKey !== "string") return NextResponse.json({ error: "Secret Key is required" }, { status: 400 })
    const secretKey = body.secretKey.trim()
    if (!/^(sk_live|sk_test)_[A-Za-z0-9_]{8,200}$/.test(secretKey)) {
        return NextResponse.json({ error: "Invalid Stripe Secret Key" }, { status: 400 })
    }
    const verification = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(15000),
    })
    if (!verification.ok) return NextResponse.json({ error: "Stripe rejected this Secret Key" }, { status: 400 })

    const webhook = await registerStripeWebhook(secretKey, auth.user.id)
    if (!webhook) return NextResponse.json({ error: "Stripe credentials are valid, but webhook registration failed. Try again." }, { status: 502 })
    const db = adminClient()
    const { data: existing, error: existingError } = await db.from("user_payment_settings")
        .select("stripe_secret_key_encrypted,stripe_webhook_id").eq("user_id", auth.user.id).maybeSingle()
    if (existingError) throw existingError
    const stripeVerifiedAt = new Date().toISOString()
    const { error } = await db.from("user_payment_settings").upsert({
        user_id: auth.user.id,
        stripe_secret_key_encrypted: await encrypt(secretKey),
        stripe_enabled: true,
        stripe_test_mode: secretKey.startsWith("sk_test_"),
        stripe_webhook_id: webhook.webhookId,
        stripe_webhook_secret: await encrypt(webhook.webhookSecret),
        stripe_credentials_verified_at: stripeVerifiedAt,
        stripe_webhook_verified_at: stripeVerifiedAt,
        updated_at: stripeVerifiedAt,
    }, { onConflict: "user_id" })
    if (error) {
        await deleteStripeWebhook(secretKey, webhook.webhookId)
        throw error
    }
    if (existing?.stripe_webhook_id && existing.stripe_secret_key_encrypted) {
        const oldSecret = await decrypt(existing.stripe_secret_key_encrypted)
        if (oldSecret) await deleteStripeWebhook(oldSecret, existing.stripe_webhook_id)
    }
    await auditConnection(auth, "stripe", secretKey.startsWith("sk_test_"), request, { webhook_registered: true })
    return NextResponse.json({ success: true, gateway: "stripe", testMode: secretKey.startsWith("sk_test_"), webhookRegistered: true })
}

async function saveCashfree(auth: any, body: Record<string, unknown>, request: NextRequest) {
    if (typeof body.clientId !== "string" || typeof body.clientSecret !== "string") {
        return NextResponse.json({ error: "Client ID and Client Secret are required" }, { status: 400 })
    }
    const clientId = sanitizeInput(body.clientId).trim()
    const clientSecret = body.clientSecret.trim()
    const testMode = body.testMode === true
    if (clientId.length < 6 || clientId.length > 200 || clientSecret.length < 8 || clientSecret.length > 256) {
        return NextResponse.json({ error: "Invalid Cashfree credentials" }, { status: 400 })
    }
    const baseUrl = testMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"
    const verification = await fetch(`${baseUrl}/pg/links?count=1`, {
        headers: { "x-api-version": "2025-01-01", "x-client-id": clientId, "x-client-secret": clientSecret },
        signal: AbortSignal.timeout(15000),
    })
    if (!verification.ok) return NextResponse.json({ error: "Cashfree rejected these credentials" }, { status: 400 })
    const cashfreeVerifiedAt = new Date().toISOString()
    const { error } = await adminClient().from("user_payment_settings").upsert({
        user_id: auth.user.id,
        cashfree_client_id: clientId,
        cashfree_client_secret_encrypted: await encrypt(clientSecret),
        cashfree_enabled: true,
        cashfree_test_mode: testMode,
        cashfree_webhook_secret: null,
        cashfree_credentials_verified_at: cashfreeVerifiedAt,
        cashfree_local_webhook_verified_at: null,
        cashfree_webhook_verified_at: null,
        updated_at: cashfreeVerifiedAt,
    }, { onConflict: "user_id" })
    if (error) throw error
    await auditConnection(auth, "cashfree", testMode, request)
    return NextResponse.json({ success: true, gateway: "cashfree", testMode })
}

async function auditConnection(auth: any, gateway: string, testMode: boolean, request: NextRequest, metadata: Record<string, unknown> = {}) {
    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: `payment_settings.${gateway}_connected` as any,
        metadata: { test_mode: testMode, ...metadata } as any,
    }, request).catch(() => {})
}
