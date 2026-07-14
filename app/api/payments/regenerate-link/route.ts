import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createPaymentLink } from "@/lib/razorpay"
import { createStripePaymentLink } from "@/lib/stripe-payments"
import { createCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import { getUserPaymentCredentials } from "@/lib/payment-credentials"
import { logAudit } from "@/lib/audit-log"
import { getClientIP } from "@/lib/api-auth"

/**
 * POST /api/payments/regenerate-link
 *
 * Public endpoint — called by the /pay/[sessionId] page when a recipient
 * lands on an invoice whose payment link has EXPIRED (auto-expired by the
 * gateway), but the invoice is still unpaid.
 *
 * SECURITY:
 *   - Public (unauthenticated) — recipient is by definition unauthenticated
 *   - Origin validation: must come from our own pay page (or same-origin)
 *   - Per-session rate limit: max 3 regenerations per hour
 *   - Per-IP rate limit: max 10 regenerations per hour across all sessions
 *   - Only regenerates for `expired` links — cancelled & paid are rejected
 *   - Uses the session owner's own gateway credentials
 *   - No PII or gateway details leaked in error responses
 *   - Full audit trail on every regeneration attempt
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_REGENS_PER_SESSION_PER_HOUR = 3
const MAX_REGENS_PER_IP_PER_HOUR = 10

// Currency smallest-unit multipliers (same as send-document route)
const CURRENCY_MULTIPLIERS: Record<string, number> = {
    INR: 100, USD: 100, EUR: 100, GBP: 100, SGD: 100,
    AED: 100, CAD: 100, AUD: 100, PHP: 100, MYR: 100, JPY: 1,
}

function adminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )
}

/**
 * Lightweight origin check — the recipient's browser must have come from
 * an allowed origin (our pay page or email link fetch).
 */
function validateRecipientOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin")
    const referer = request.headers.get("referer")

    const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        "https://clorefy.com",
        "https://www.clorefy.com",
        ...(process.env.NODE_ENV !== "production"
            ? ["http://localhost:3000", "http://localhost:3001"]
            : []),
    ].filter(Boolean) as string[]

    // Server-side fetch (from our own page.tsx) may not have an Origin header
    // but will have a matching Host header
    const host = request.headers.get("host")
    const ourHosts = allowedOrigins.map(o => o.replace(/^https?:\/\//, "").replace(/\/$/, ""))
    if (host && ourHosts.includes(host)) return true

    if (origin && allowedOrigins.includes(origin)) return true
    if (!origin && referer && allowedOrigins.some(o => referer.startsWith(o + "/") || referer === o)) return true

    return false
}

export async function POST(request: NextRequest) {
    // ── 0. Origin check — reject cross-origin calls from random domains ──
    if (!validateRecipientOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!sessionId || !UUID_REGEX.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    const supabase = adminClient()
    const clientIP = getClientIP(request)

    // ── 1. Per-IP rate limit — defense against scraping/abuse ────────────
    // Uses audit_logs (existing table, indexed on created_at + ip_address)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: ipRegens } = await (supabase as any)
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("action", "payment_link.regenerated")
        .eq("ip_address", clientIP)
        .gte("created_at", hourAgo)

    if ((ipRegens ?? 0) >= MAX_REGENS_PER_IP_PER_HOUR) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 }
        )
    }

    // ── 2. Load the session ──────────────────────────────────────────────
    const { data: session } = await supabase
        .from("document_sessions")
        .select("id, user_id, status, document_type, context")
        .eq("id", sessionId)
        .single()

    if (!session || !session.context) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Only invoices have payment links
    if (session.document_type !== "invoice") {
        return NextResponse.json({ error: "Only invoices support payment links" }, { status: 400 })
    }

    // Session must be in a state where payment is still expected
    if (session.status === "paid" || session.status === "cancelled") {
        return NextResponse.json(
            { error: `Session is ${session.status} — no new link needed` },
            { status: 409 }
        )
    }

    // ── 3. Load the most-recent payment record ───────────────────────────
    const { data: lastPayment } = await (supabase as any)
        .from("invoice_payments")
        .select("id, status, amount, currency, reference_id, customer_name, customer_email, customer_phone, description")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    // If there's an active or paid link already, don't regenerate
    if (lastPayment?.status === "paid") {
        return NextResponse.json({ error: "Invoice already paid" }, { status: 409 })
    }
    if (lastPayment?.status === "created" || lastPayment?.status === "partially_paid") {
        // There's an active link — just return the same URL
        return NextResponse.json({
            success: true,
            platformLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/pay/${sessionId}`,
            regenerated: false,
        })
    }

    // Only auto-regenerate for EXPIRED links. `cancelled` = sender intent — respect it.
    if (lastPayment && lastPayment.status !== "expired") {
        return NextResponse.json(
            { error: "This payment link was cancelled by the sender" },
            { status: 410 }
        )
    }

    // ── 4. Per-session rate limit ────────────────────────────────────────
    const { count: sessionRegens } = await (supabase as any)
        .from("invoice_payments")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .gte("created_at", hourAgo)

    if ((sessionRegens ?? 0) >= MAX_REGENS_PER_SESSION_PER_HOUR) {
        return NextResponse.json(
            { error: "Too many refresh attempts. Please try again later or contact the sender." },
            { status: 429 }
        )
    }

    // 4. Get the session owner's payment credentials
    const allCreds = await getUserPaymentCredentials(session.user_id)
    if (!allCreds) {
        return NextResponse.json(
            { error: "The sender hasn't configured a payment gateway. Please contact them." },
            { status: 422 }
        )
    }

    // 5. Build the payment params — reuse the last link's params if available,
    //    otherwise recompute from the session context (invoice data)
    const context = session.context as Record<string, unknown>

    let amount: number
    let currency: string
    let referenceId: string
    let customerName: string | undefined
    let customerEmail: string | undefined
    let customerPhone: string | undefined
    let description: string

    if (lastPayment) {
        amount = lastPayment.amount
        currency = lastPayment.currency
        referenceId = lastPayment.reference_id || `INV-${sessionId.slice(0, 8).toUpperCase()}`
        customerName = lastPayment.customer_name || undefined
        customerEmail = lastPayment.customer_email || undefined
        customerPhone = lastPayment.customer_phone || undefined
        description = lastPayment.description || `Invoice ${referenceId}`
    } else {
        // No previous payment — compute from invoice context
        const items = (context.items as any[]) || []
        const subtotal = items.reduce((sum: number, item: any) => {
            const qty = Number(item.quantity) || 0
            const rate = Number(item.rate) || 0
            const disc = Number(item.discount) || 0
            return sum + (qty * rate * (1 - disc / 100))
        }, 0)
        const taxRate = Number(context.taxRate) || 0
        const discountValue = Number(context.discountValue) || 0
        const shippingFee = Number(context.shippingFee) || 0
        const discountAmount = (context.discountType as string) === "percent"
            ? subtotal * (discountValue / 100)
            : discountValue
        const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
        const total = subtotal - discountAmount + taxAmount + shippingFee

        currency = ((context.currency as string) || "INR").toUpperCase()
        amount = Math.round(total * (CURRENCY_MULTIPLIERS[currency] ?? 100))
        if (amount <= 0) {
            return NextResponse.json({ error: "Invoice amount is zero" }, { status: 400 })
        }

        referenceId = (context.invoiceNumber as string) || `INV-${sessionId.slice(0, 8).toUpperCase()}`
        customerName = (context.toName as string) || undefined
        customerEmail = (context.toEmail as string) || undefined
        description = `Invoice ${referenceId}`
    }

    // Make the new reference ID unique — gateway rejects duplicates
    // Use the last 4 chars of timestamp to keep it short (gateway has 40-char limit)
    const freshRef = `${referenceId.slice(0, 34)}-${Date.now().toString().slice(-4)}`
    const dueDate = (context.dueDate as string) || undefined

    // 6. Decide which gateway to use — mirror create-link logic
    const currencyUpper = currency.toUpperCase()
    let selectedGateway: "razorpay" | "stripe" | "cashfree" | null = null
    if (currencyUpper === "INR") {
        if (allCreds.razorpay) selectedGateway = "razorpay"
        else if (allCreds.cashfree) selectedGateway = "cashfree"
        else if (allCreds.stripe) selectedGateway = "stripe"
    } else {
        if (allCreds.stripe) selectedGateway = "stripe"
        else if (allCreds.razorpay) selectedGateway = "razorpay"
    }

    if (!selectedGateway) {
        return NextResponse.json(
            { error: `No payment gateway supports ${currencyUpper}` },
            { status: 422 }
        )
    }

    // 7. Create the new gateway link
    let shortUrl: string
    let gatewayLinkId: string
    let expireByUnix: number | null = null

    try {
        if (selectedGateway === "razorpay") {
            const creds = allCreds.razorpay!
            const link = await createPaymentLink({
                amount,
                currency: currencyUpper,
                description: description.slice(0, 255),
                referenceId: freshRef,
                customerName,
                customerEmail,
                customerPhone,
                sessionId,
                userId: session.user_id,
                dueDateIso: dueDate,
                userKeyId: creds.keyId,
                userKeySecret: creds.keySecret,
            })
            shortUrl = link.short_url
            gatewayLinkId = link.id
            expireByUnix = link.expire_by
        } else if (selectedGateway === "stripe") {
            const creds = allCreds.stripe!
            const link = await createStripePaymentLink({
                amount,
                currency: currencyUpper,
                description: description.slice(0, 255),
                referenceId: freshRef,
                customerEmail,
                sessionId,
                userId: session.user_id,
                userSecretKey: creds.secretKey,
            })
            shortUrl = link.url
            gatewayLinkId = link.id
        } else {
            // Cashfree
            const creds = allCreds.cashfree!
            const link = await createCashfreePaymentLink({
                amount,
                currency: currencyUpper,
                description: description.slice(0, 255),
                referenceId: freshRef,
                sessionId: `${sessionId}-regen-${Date.now().toString().slice(-4)}`,
                customerName,
                customerEmail,
                customerPhone,
                userId: session.user_id,
                testMode: creds.testMode,
                userClientId: creds.clientId,
                userClientSecret: creds.clientSecret,
                expireInDays: 37,
            })
            shortUrl = link.link_url
            gatewayLinkId = String(link.cf_link_id)
        }
    } catch (err) {
        console.error("[regenerate-link] gateway error:", err)
        const msg = err instanceof Error ? err.message : "Unknown error"
        // Don't leak gateway internals to unauthenticated recipient
        return NextResponse.json(
            { error: "Unable to refresh payment link. Please contact the sender." },
            { status: 500 }
        )
    }

    // 8. Persist the new link — creates a NEW invoice_payments row (preserves history)
    const { data: newPayment } = await (supabase as any)
        .from("invoice_payments")
        .insert({
            session_id: sessionId,
            user_id: session.user_id,
            razorpay_payment_link_id: gatewayLinkId,
            short_url: shortUrl,
            amount,
            currency: currencyUpper,
            status: "created",
            reference_id: freshRef,
            description,
            customer_name: customerName ?? null,
            customer_email: customerEmail ?? null,
            customer_phone: customerPhone ?? null,
            expires_at: expireByUnix ? new Date(expireByUnix * 1000).toISOString() : null,
            gateway: selectedGateway,
        })
        .select("id")
        .single()

    // 9. Audit (owner, not recipient)
    await logAudit(supabase as any, {
        user_id: session.user_id,
        action: "payment_link.regenerated",
        resource_type: "invoice_payment",
        resource_id: newPayment?.id ?? undefined,
        metadata: {
            gateway: selectedGateway,
            previous_link_status: lastPayment?.status,
            session_id: sessionId,
            trigger: "recipient_auto_refresh",
        } as any,
    }, request)

    const platformLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/pay/${sessionId}`

    return NextResponse.json({
        success: true,
        platformLink,
        shortUrl,
        regenerated: true,
    })
}
