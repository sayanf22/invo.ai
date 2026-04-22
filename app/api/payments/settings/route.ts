import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { encrypt, decrypt } from "@/lib/encrypt"
import { createClient } from "@supabase/supabase-js"
import { logAudit } from "@/lib/audit-log"
import { sanitizeSQLInput as sanitizeInput } from "@/lib/sanitize"
import { generateWebhookSecret } from "@/lib/razorpay"
import { registerStripeWebhook, deleteStripeWebhook } from "@/lib/stripe-payments"

function adminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

/**
 * GET /api/payments/settings
 * Returns all gateway settings (keys masked, secrets never returned).
 */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { data } = await adminClient()
        .from("user_payment_settings")
        .select(`
            razorpay_key_id, razorpay_account_name, razorpay_enabled, razorpay_test_mode,
            razorpay_webhook_id, razorpay_webhook_secret,
            stripe_enabled, stripe_test_mode, stripe_webhook_id,
            cashfree_client_id, cashfree_enabled, cashfree_test_mode,
            updated_at
        `)
        .eq("user_id", auth.user.id)
        .maybeSingle()

    return NextResponse.json({
        settings: data ? {
            razorpay: data.razorpay_enabled ? {
                keyId: data.razorpay_key_id,
                accountName: data.razorpay_account_name,
                testMode: data.razorpay_test_mode,
                webhookSecret: data.razorpay_webhook_secret,
                webhookRegistered: !!data.razorpay_webhook_id,
            } : null,
            stripe: data.stripe_enabled ? {
                testMode: data.stripe_test_mode,
                webhookRegistered: !!data.stripe_webhook_id,
            } : null,
            cashfree: data.cashfree_enabled ? {
                clientId: data.cashfree_client_id,
                testMode: data.cashfree_test_mode,
            } : null,
            updatedAt: data.updated_at,
        } : null,
    })
}

/**
 * POST /api/payments/settings
 * Save gateway credentials. Body must include `gateway` field.
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: unknown
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 10 * 1024)
    if (sizeError) return sizeError

    const { gateway } = body as Record<string, unknown>

    if (gateway === "razorpay") return handleRazorpay(auth, body as Record<string, unknown>, request)
    if (gateway === "stripe") return handleStripe(auth, body as Record<string, unknown>, request)
    if (gateway === "cashfree") return handleCashfree(auth, body as Record<string, unknown>, request)

    return NextResponse.json({ error: "Invalid gateway. Must be: razorpay, stripe, or cashfree" }, { status: 400 })
}

/**
 * DELETE /api/payments/settings?gateway=razorpay
 */
export async function DELETE(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const gateway = request.nextUrl.searchParams.get("gateway")
    const supabase = adminClient()

    if (gateway === "stripe") {
        const { data } = await supabase
            .from("user_payment_settings")
            .select("stripe_secret_key_encrypted, stripe_webhook_id")
            .eq("user_id", auth.user.id)
            .maybeSingle()

        if (data?.stripe_webhook_id && data?.stripe_secret_key_encrypted) {
            const secret = await decrypt(data.stripe_secret_key_encrypted)
            if (secret) await deleteStripeWebhook(secret, data.stripe_webhook_id)
        }

        await supabase.from("user_payment_settings").update({
            stripe_secret_key_encrypted: null,
            stripe_webhook_id: null,
            stripe_webhook_secret: null,
            stripe_enabled: false,
        }).eq("user_id", auth.user.id)
    } else if (gateway === "razorpay") {
        await supabase.from("user_payment_settings").update({
            razorpay_key_id: null,
            razorpay_key_secret_encrypted: null,
            razorpay_webhook_id: null,
            razorpay_webhook_secret: null,
            razorpay_enabled: false,
        }).eq("user_id", auth.user.id)
    } else if (gateway === "cashfree") {
        await supabase.from("user_payment_settings").update({
            cashfree_client_id: null,
            cashfree_client_secret_encrypted: null,
            cashfree_webhook_secret: null,
            cashfree_enabled: false,
        }).eq("user_id", auth.user.id)
    } else {
        // Remove all
        await supabase.from("user_payment_settings").delete().eq("user_id", auth.user.id)
    }

    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_settings.removed",
        metadata: { gateway } as any,
    }, request)

    return NextResponse.json({ success: true })
}

// ── Gateway Handlers ───────────────────────────────────────────────────

async function handleRazorpay(auth: any, body: Record<string, unknown>, request: NextRequest) {
    const { keyId, keySecret, accountName } = body

    if (!keyId || typeof keyId !== "string") return NextResponse.json({ error: "Key ID required" }, { status: 400 })
    if (!keySecret || typeof keySecret !== "string") return NextResponse.json({ error: "Key Secret required" }, { status: 400 })

    const safeKeyId = sanitizeInput(String(keyId)).trim()
    if (!safeKeyId.startsWith("rzp_live_") && !safeKeyId.startsWith("rzp_test_")) {
        return NextResponse.json({ error: "Invalid Razorpay Key ID. Must start with rzp_live_ or rzp_test_" }, { status: 400 })
    }

    // Verify keys
    const testRes = await fetch("https://api.razorpay.com/v1/payment_links?count=1", {
        headers: { Authorization: `Basic ${btoa(`${safeKeyId}:${String(keySecret).trim()}`)}` },
    })
    if (testRes.status === 401) {
        return NextResponse.json({ error: "Invalid Razorpay credentials. Check your Key ID and Secret." }, { status: 400 })
    }

    const encryptedSecret = await encrypt(String(keySecret).trim())
    const isTestMode = safeKeyId.startsWith("rzp_test_")
    const supabase = adminClient()

    // Preserve existing webhook secret
    const { data: existing } = await supabase
        .from("user_payment_settings")
        .select("razorpay_webhook_secret")
        .eq("user_id", auth.user.id)
        .maybeSingle()

    const webhookSecret = existing?.razorpay_webhook_secret || generateWebhookSecret()

    await supabase.from("user_payment_settings").upsert({
        user_id: auth.user.id,
        razorpay_key_id: safeKeyId,
        razorpay_key_secret_encrypted: encryptedSecret,
        razorpay_account_name: accountName ? sanitizeInput(String(accountName)).slice(0, 100) : null,
        razorpay_enabled: true,
        razorpay_test_mode: isTestMode,
        razorpay_webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_settings.razorpay_connected",
        metadata: { test_mode: isTestMode } as any,
    }, request)

    return NextResponse.json({ success: true, gateway: "razorpay", testMode: isTestMode })
}

async function handleStripe(auth: any, body: Record<string, unknown>, request: NextRequest) {
    const { secretKey } = body

    if (!secretKey || typeof secretKey !== "string") return NextResponse.json({ error: "Secret Key required" }, { status: 400 })

    const safeKey = String(secretKey).trim()
    if (!safeKey.startsWith("sk_live_") && !safeKey.startsWith("sk_test_")) {
        return NextResponse.json({ error: "Invalid Stripe Secret Key. Must start with sk_live_ or sk_test_" }, { status: 400 })
    }

    // Verify key
    const testRes = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${safeKey}` },
    })
    if (testRes.status === 401) {
        return NextResponse.json({ error: "Invalid Stripe Secret Key." }, { status: 400 })
    }

    const encryptedSecret = await encrypt(safeKey)
    const isTestMode = safeKey.startsWith("sk_test_")
    const supabase = adminClient()

    // Delete old webhook if exists
    const { data: existing } = await supabase
        .from("user_payment_settings")
        .select("stripe_secret_key_encrypted, stripe_webhook_id")
        .eq("user_id", auth.user.id)
        .maybeSingle()

    if (existing?.stripe_webhook_id && existing?.stripe_secret_key_encrypted) {
        const oldSecret = await decrypt(existing.stripe_secret_key_encrypted)
        if (oldSecret) await deleteStripeWebhook(oldSecret, existing.stripe_webhook_id)
    }

    // Register new webhook programmatically (Stripe supports this!)
    const webhookResult = await registerStripeWebhook(safeKey, auth.user.id)

    await supabase.from("user_payment_settings").upsert({
        user_id: auth.user.id,
        stripe_secret_key_encrypted: encryptedSecret,
        stripe_enabled: true,
        stripe_test_mode: isTestMode,
        stripe_webhook_id: webhookResult?.webhookId ?? null,
        stripe_webhook_secret: webhookResult?.webhookSecret ?? null,
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_settings.stripe_connected",
        metadata: { test_mode: isTestMode, webhook_registered: !!webhookResult } as any,
    }, request)

    return NextResponse.json({
        success: true,
        gateway: "stripe",
        testMode: isTestMode,
        webhookRegistered: !!webhookResult,
    })
}

async function handleCashfree(auth: any, body: Record<string, unknown>, request: NextRequest) {
    const { clientId, clientSecret, testMode } = body

    if (!clientId || typeof clientId !== "string") return NextResponse.json({ error: "Client ID required" }, { status: 400 })
    if (!clientSecret || typeof clientSecret !== "string") return NextResponse.json({ error: "Client Secret required" }, { status: 400 })

    const safeClientId = sanitizeInput(String(clientId)).trim()
    const isTestMode = Boolean(testMode)

    // Verify credentials
    const baseUrl = isTestMode ? "https://sandbox.cashfree.com" : "https://api.cashfree.com"
    const testRes = await fetch(`${baseUrl}/pg/links?count=1`, {
        headers: {
            "x-api-version": "2025-01-01",
            "x-client-id": safeClientId,
            "x-client-secret": String(clientSecret).trim(),
        },
    })
    if (testRes.status === 401 || testRes.status === 403) {
        return NextResponse.json({ error: "Invalid Cashfree credentials. Check your Client ID and Secret." }, { status: 400 })
    }

    const encryptedSecret = await encrypt(String(clientSecret).trim())
    const webhookSecret = generateWebhookSecret()

    await adminClient().from("user_payment_settings").upsert({
        user_id: auth.user.id,
        cashfree_client_id: safeClientId,
        cashfree_client_secret_encrypted: encryptedSecret,
        cashfree_enabled: true,
        cashfree_test_mode: isTestMode,
        cashfree_webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_settings.cashfree_connected",
        metadata: { test_mode: isTestMode } as any,
    }, request)

    return NextResponse.json({ success: true, gateway: "cashfree", testMode: isTestMode })
}

/**
 * Internal: get decrypted credentials for a user + gateway.
 */
export async function getUserPaymentCredentials(userId: string) {
    const { data } = await adminClient()
        .from("user_payment_settings")
        .select(`
            razorpay_key_id, razorpay_key_secret_encrypted, razorpay_enabled, razorpay_test_mode,
            stripe_secret_key_encrypted, stripe_enabled, stripe_test_mode,
            cashfree_client_id, cashfree_client_secret_encrypted, cashfree_enabled, cashfree_test_mode
        `)
        .eq("user_id", userId)
        .maybeSingle()

    if (!data) return null

    const result: {
        razorpay?: { keyId: string; keySecret: string; testMode: boolean }
        stripe?: { secretKey: string; testMode: boolean }
        cashfree?: { clientId: string; clientSecret: string; testMode: boolean }
    } = {}

    if (data.razorpay_enabled && data.razorpay_key_id && data.razorpay_key_secret_encrypted) {
        const secret = await decrypt(data.razorpay_key_secret_encrypted)
        if (secret) result.razorpay = { keyId: data.razorpay_key_id, keySecret: secret, testMode: data.razorpay_test_mode ?? false }
    }

    if (data.stripe_enabled && data.stripe_secret_key_encrypted) {
        const secret = await decrypt(data.stripe_secret_key_encrypted)
        if (secret) result.stripe = { secretKey: secret, testMode: data.stripe_test_mode ?? false }
    }

    if (data.cashfree_enabled && data.cashfree_client_id && data.cashfree_client_secret_encrypted) {
        const secret = await decrypt(data.cashfree_client_secret_encrypted)
        if (secret) result.cashfree = { clientId: data.cashfree_client_id, clientSecret: secret, testMode: data.cashfree_test_mode ?? false }
    }

    return Object.keys(result).length > 0 ? result : null
}

/**
 * Alias for backwards compatibility — some routes import this name.
 * Returns only the Razorpay credentials for a user.
 */
export async function getUserRazorpayCredentials(userId: string) {
    const creds = await getUserPaymentCredentials(userId)
    return creds?.razorpay ?? null
}
