import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createPaymentLink } from "@/lib/razorpay"
import { createStripePaymentLink } from "@/lib/stripe-payments"
import { createCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import { getUserPaymentCredentials, type UserPaymentCredentials } from "@/lib/payment-credentials"
import { deriveInvoicePaymentDetails } from "@/lib/invoice-payment-context"
import { cancelProviderLink, type CreatedProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { getClientIP, validateBodySize } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit-log"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function recipientOriginAllowed(request: NextRequest): boolean {
    const configured = process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"
    const allowed = new Set([configured.replace(/\/$/, ""), "https://clorefy.com", "https://www.clorefy.com"])
    if (process.env.NODE_ENV !== "production") {
        allowed.add("http://localhost:3000")
        allowed.add("http://localhost:3001")
    }
    const origin = request.headers.get("origin")?.replace(/\/$/, "")
    const referer = request.headers.get("referer")
    const host = request.headers.get("host")
    if (origin && allowed.has(origin)) return true
    if (!origin && referer && [...allowed].some((value) => referer === value || referer.startsWith(`${value}/`))) return true
    return Boolean(!origin && !referer && host && [...allowed].some((value) => new URL(value).host === host))
}

function selectGateway(currency: string, previous: string, credentials: UserPaymentCredentials): InvoicePaymentGateway | null {
    if (previous === "razorpay" && credentials.razorpay) return "razorpay"
    if (previous === "stripe" && credentials.stripe) return "stripe"
    if (previous === "cashfree" && credentials.cashfree) return "cashfree"
    if (currency === "INR") return credentials.razorpay ? "razorpay" : credentials.cashfree ? "cashfree" : credentials.stripe ? "stripe" : null
    return credentials.stripe ? "stripe" : credentials.razorpay ? "razorpay" : null
}

export async function POST(request: NextRequest) {
    if (!recipientOriginAllowed(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 1024)
    if (sizeError) return sizeError
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!UUID_PATTERN.test(sessionId)) return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })

    try {
        const db = adminClient()
        const ipRateError = await checkPublicRateLimit(db, getClientIP(request), "payment_regenerate_ip", 10, 3600)
        if (ipRateError) return ipRateError
        const sessionRateError = await checkPublicRateLimit(db, sessionId, "payment_regenerate_session", 3, 3600)
        if (sessionRateError) return sessionRateError

        const { data: session, error: sessionError } = await db.from("document_sessions")
            .select("id,user_id,status,document_type,context")
            .eq("id", sessionId).maybeSingle()
        if (sessionError) throw sessionError
        if (!session || !session.context) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        if (session.document_type !== "invoice") return NextResponse.json({ error: "Only invoices support payment links" }, { status: 400 })
        if (["paid", "cancelled"].includes(session.status)) {
            return NextResponse.json({ error: `Session is ${session.status}` }, { status: 409 })
        }

        const { data: lastPayment, error: paymentError } = await db.from("invoice_payments")
            .select("id,status,amount,currency,reference_id,customer_name,customer_email,customer_phone,description,gateway")
            .eq("session_id", sessionId).eq("user_id", session.user_id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle()
        if (paymentError) throw paymentError
        if (!lastPayment) return NextResponse.json({ error: "Payment link not found" }, { status: 404 })
        if (lastPayment.status === "paid") return NextResponse.json({ error: "Invoice already paid" }, { status: 409 })
        if (["created", "partially_paid"].includes(lastPayment.status)) {
            return NextResponse.json({ success: true, platformLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/pay/${sessionId}`, regenerated: false })
        }
        if (lastPayment.status !== "expired") return NextResponse.json({ error: "This payment link was cancelled by the sender" }, { status: 410 })
        if (!Number.isSafeInteger(lastPayment.amount) || lastPayment.amount <= 0 || !/^[A-Z]{3}$/.test(lastPayment.currency)) {
            throw new Error("Stored payment amount is invalid")
        }

        const contextDetails = deriveInvoicePaymentDetails(session.context, sessionId)
        const credentials = await getUserPaymentCredentials(session.user_id)
        if (!credentials) return NextResponse.json({ error: "The sender has no available payment gateway" }, { status: 422 })
        const gateway = selectGateway(lastPayment.currency, lastPayment.gateway, credentials)
        if (!gateway) return NextResponse.json({ error: "No gateway supports this payment currency" }, { status: 422 })

        const referenceBase = lastPayment.reference_id || contextDetails.referenceId
        const freshReference = `${referenceBase.slice(0, 30)}-${Date.now().toString(36).slice(-8)}`.slice(0, 40)
        const description = lastPayment.description || contextDetails.description
        let provider: CreatedProviderLink
        if (gateway === "razorpay") {
            const credential = credentials.razorpay!
            const link = await createPaymentLink({
                amount: lastPayment.amount,
                currency: lastPayment.currency,
                description,
                referenceId: freshReference,
                customerName: lastPayment.customer_name || contextDetails.customerName,
                customerEmail: lastPayment.customer_email || contextDetails.customerEmail,
                customerPhone: lastPayment.customer_phone || contextDetails.customerPhone,
                sessionId,
                userId: session.user_id,
                dueDateIso: contextDetails.dueDate,
                userKeyId: credential.keyId,
                userKeySecret: credential.keySecret,
            })
            provider = { correlationId: link.id, providerLinkId: link.id, shortUrl: link.short_url, expiresAt: link.expire_by ? new Date(link.expire_by * 1000).toISOString() : null, testMode: credential.testMode }
        } else if (gateway === "stripe") {
            const credential = credentials.stripe!
            const link = await createStripePaymentLink({
                amount: lastPayment.amount,
                currency: lastPayment.currency,
                description,
                referenceId: freshReference,
                customerEmail: lastPayment.customer_email || contextDetails.customerEmail,
                sessionId,
                userId: session.user_id,
                userSecretKey: credential.secretKey,
            })
            provider = { correlationId: link.id, providerLinkId: link.id, shortUrl: link.url, expiresAt: null, testMode: credential.testMode }
        } else {
            const credential = credentials.cashfree!
            const link = await createCashfreePaymentLink({
                amount: lastPayment.amount,
                currency: lastPayment.currency,
                description,
                referenceId: freshReference,
                sessionId,
                customerName: lastPayment.customer_name || contextDetails.customerName,
                customerEmail: lastPayment.customer_email || contextDetails.customerEmail,
                customerPhone: lastPayment.customer_phone || contextDetails.customerPhone,
                userId: session.user_id,
                testMode: credential.testMode,
                userClientId: credential.clientId,
                userClientSecret: credential.clientSecret,
                expireInDays: 37,
            })
            provider = { correlationId: String(link.cf_link_id), providerLinkId: link.link_id, shortUrl: link.link_url, expiresAt: null, testMode: credential.testMode }
        }

        const { data: saved, error: insertError } = await db.from("invoice_payments").insert({
            session_id: sessionId,
            user_id: session.user_id,
            razorpay_payment_link_id: provider.correlationId,
            provider_link_id: provider.providerLinkId,
            short_url: provider.shortUrl,
            amount: lastPayment.amount,
            currency: lastPayment.currency,
            status: "created",
            reference_id: freshReference,
            description,
            customer_name: lastPayment.customer_name,
            customer_email: lastPayment.customer_email,
            customer_phone: lastPayment.customer_phone,
            expires_at: provider.expiresAt,
            gateway,
            is_test_mode: provider.testMode,
        } as any).select("id").single()
        if (insertError || !saved) {
            await cancelProviderLink(gateway, provider.correlationId, provider.providerLinkId, credentials)
                .catch((cleanupError) => console.error("[payments/regenerate-link] orphan cleanup failed:", cleanupError))
            if (insertError?.code === "23505") {
                return NextResponse.json({ success: true, platformLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/pay/${sessionId}`, regenerated: false })
            }
            throw insertError || new Error("Payment link persistence failed")
        }

        await logAudit(db as any, {
            user_id: session.user_id,
            action: "payment_link.regenerated",
            resource_type: "invoice_payment",
            resource_id: saved.id,
            metadata: { gateway, previous_link_status: lastPayment.status, session_id: sessionId, trigger: "recipient_auto_refresh" } as any,
        }, request).catch(() => {})
        return NextResponse.json({
            success: true,
            platformLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://clorefy.com"}/pay/${sessionId}`,
            shortUrl: provider.shortUrl,
            regenerated: true,
        })
    } catch (error) {
        console.error("[payments/regenerate-link] failed:", error)
        return NextResponse.json({ error: "Unable to refresh payment link. Please contact the sender." }, { status: 500 })
    }
}
