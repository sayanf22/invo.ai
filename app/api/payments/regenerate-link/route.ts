import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createPaymentLink } from "@/lib/razorpay"
import { createStripePaymentLink } from "@/lib/stripe-payments"
import { createCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import { getUserPaymentCredentials } from "@/app/api/payments/settings/route"
import { logAudit } from "@/lib/audit-log"

/**
 * POST /api/payments/regenerate-link
 *
 * Public endpoint — called by the /pay/[sessionId] page when a recipient
 * lands on an invoice whose payment link has EXPIRED (auto-expired by the
 * gateway), but the invoice is still unpaid.
 *
 * This solves the real-world problem where emails with old short-lived links
 * are already in recipient inboxes. When they click, we auto-refresh the link
 * transparently so they never see "link expired".
 *
 * INVARIANTS:
 *   - Only regenerates for EXPIRED links — not cancelled (sender intent) or paid
 *   - Session must still be in a non-terminal state (active/finalized)
 *   - Rate-limited by IP + sessionId (max 3 regenerations per hour per session)
 *   - No authentication required (recipient is unauthenticated by design)
 *   - Uses the session owner's (user's) own gateway credentials
 *
 * Returns the new platform pay URL (which is the same as the old one —
 * since the platform URL is session-scoped, not link-scoped).
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_REGENS_PER_HOUR = 3

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

export async function POST(request: NextRequest) {
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

    // 1. Load the session
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

    // 2. Load the most-recent payment record
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

    // 3. Rate limit: max 3 regenerations per session per hour
    // We track this directly against invoice_payments: count how many "created"
    // records exist for this session within the last hour. That count maps 1:1
    // to regeneration attempts since each creates a new row.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentRegens } = await (supabase as any)
        .from("invoice_payments")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .gte("created_at", hourAgo)

    if ((recentRegens ?? 0) >= MAX_REGENS_PER_HOUR) {
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
