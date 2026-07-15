import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import { createPaymentLink } from "@/lib/razorpay"
import { createStripePaymentLink } from "@/lib/stripe-payments"
import { createCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import { getUserPaymentCredentials, type UserPaymentCredentials } from "@/lib/payment-credentials"
import { deriveInvoicePaymentDetails } from "@/lib/invoice-payment-context"
import { cancelProviderLink, type CreatedProviderLink, type InvoicePaymentGateway } from "@/lib/payment-link-provider"
import { logAudit } from "@/lib/audit-log"
import { getPublicDocumentUrl } from "@/lib/public-capability"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Payment service credentials are not configured")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

const GATEWAY_CURRENCIES: Record<InvoicePaymentGateway, ReadonlySet<string> | "all"> = {
    razorpay: new Set(["INR", "USD", "EUR", "GBP", "SGD", "AED", "CAD", "AUD", "PHP", "MYR"]),
    stripe: "all",
    cashfree: new Set(["INR"]),
}

function gatewaySupportsCurrency(gateway: InvoicePaymentGateway, currency: string): boolean {
    const supported = GATEWAY_CURRENCIES[gateway]
    return supported === "all" || supported.has(currency)
}

function chooseGateway(
    currency: string,
    credentials: UserPaymentCredentials,
    requested?: InvoicePaymentGateway,
): InvoicePaymentGateway | null {
    if (requested) {
        return credentials[requested] && gatewaySupportsCurrency(requested, currency) ? requested : null
    }
    const preferred: InvoicePaymentGateway[] = currency === "INR"
        ? ["razorpay", "cashfree", "stripe"]
        : ["stripe", "razorpay"]
    return preferred.find((gateway) => credentials[gateway] && gatewaySupportsCurrency(gateway, currency)) ?? null
}

function paymentResponse(row: any, publicId: string, isExisting: boolean) {
    return {
        success: true,
        paymentLink: {
            id: row.id,
            shortUrl: row.short_url,
            platformLink: getPublicDocumentUrl(publicId),
            status: row.status,
            razorpayId: row.razorpay_payment_link_id,
            gateway: row.gateway,
            amount: row.amount,
            currency: row.currency,
            isExisting,
        },
    }
}

export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateLimitError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateLimitError) return rateLimitError

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 2 * 1024)
    if (sizeError) return sizeError

    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!UUID_PATTERN.test(sessionId)) {
        return NextResponse.json({ error: "A valid sessionId is required" }, { status: 400 })
    }
    if (body.acceptPartial !== undefined && typeof body.acceptPartial !== "boolean") {
        return NextResponse.json({ error: "acceptPartial must be a boolean" }, { status: 400 })
    }
    const requestedGateway = body.gateway === undefined || body.gateway === null || body.gateway === ""
        ? undefined
        : String(body.gateway).toLowerCase()
    if (requestedGateway && !["razorpay", "stripe", "cashfree"].includes(requestedGateway)) {
        return NextResponse.json({ error: "Invalid payment gateway" }, { status: 400 })
    }

    try {
        const db = adminClient()
        const { data: session, error: sessionError } = await db.from("document_sessions")
            .select("id,user_id,document_type,status,context,public_id")
            .eq("id", sessionId)
            .eq("user_id", auth.user.id)
            .maybeSingle()
        if (sessionError) throw sessionError
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        if (session.document_type !== "invoice") {
            return NextResponse.json({ error: "Only invoices support payment links" }, { status: 400 })
        }
        if (["paid", "cancelled"].includes(session.status)) {
            return NextResponse.json({ error: `Cannot create a payment link for a ${session.status} invoice` }, { status: 409 })
        }

        let details
        try {
            details = deriveInvoicePaymentDetails(session.context, sessionId)
        } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid invoice data" }, { status: 422 })
        }

        const { data: existing, error: existingError } = await db.from("invoice_payments")
            .select("id,short_url,status,razorpay_payment_link_id,gateway,amount,currency")
            .eq("session_id", sessionId)
            .eq("user_id", auth.user.id)
            .in("status", ["created", "partially_paid"])
            .maybeSingle()
        if (existingError) throw existingError
        if (existing) return NextResponse.json(paymentResponse(existing, session.public_id, true))

        const credentials = await getUserPaymentCredentials(auth.user.id)
        if (!credentials) {
            return NextResponse.json({
                error: "Payment collection not set up",
                code: "NO_PAYMENT_SETTINGS",
                message: "Please add payment gateway credentials in Settings → Payments.",
            }, { status: 422 })
        }
        const gateway = chooseGateway(
            details.currency,
            credentials,
            requestedGateway as InvoicePaymentGateway | undefined,
        )
        if (!gateway) {
            const requestedMessage = requestedGateway
                ? `${requestedGateway.charAt(0).toUpperCase()}${requestedGateway.slice(1)} is not connected or does not support ${details.currency}.`
                : `No configured gateway supports ${details.currency}.`
            return NextResponse.json({
                error: "No compatible payment gateway configured",
                code: requestedGateway ? "GATEWAY_UNAVAILABLE" : "NO_PAYMENT_SETTINGS",
                message: requestedMessage,
            }, { status: 422 })
        }

        let provider: CreatedProviderLink
        try {
            if (gateway === "razorpay") {
                const credential = credentials.razorpay!
                const link = await createPaymentLink({
                    amount: details.amount,
                    currency: details.currency,
                    description: details.description,
                    referenceId: details.referenceId,
                    customerName: details.customerName,
                    customerEmail: details.customerEmail,
                    customerPhone: details.customerPhone,
                    sessionId,
                    userId: auth.user.id,
                    acceptPartial: body.acceptPartial === true,
                    dueDateIso: details.dueDate,
                    userKeyId: credential.keyId,
                    userKeySecret: credential.keySecret,
                })
                provider = {
                    correlationId: link.id,
                    providerLinkId: link.id,
                    shortUrl: link.short_url,
                    expiresAt: link.expire_by ? new Date(link.expire_by * 1000).toISOString() : null,
                    testMode: credential.testMode,
                }
            } else if (gateway === "stripe") {
                const credential = credentials.stripe!
                const link = await createStripePaymentLink({
                    amount: details.amount,
                    currency: details.currency,
                    description: details.description,
                    referenceId: details.referenceId,
                    customerEmail: details.customerEmail,
                    sessionId,
                    publicId: session.public_id,
                    userId: auth.user.id,
                    userSecretKey: credential.secretKey,
                })
                provider = {
                    correlationId: link.id,
                    providerLinkId: link.id,
                    shortUrl: link.url,
                    expiresAt: null,
                    testMode: credential.testMode,
                }
            } else {
                const credential = credentials.cashfree!
                const link = await createCashfreePaymentLink({
                    amount: details.amount,
                    currency: details.currency,
                    description: details.description,
                    referenceId: details.referenceId,
                    sessionId,
                    publicId: session.public_id,
                    customerName: details.customerName,
                    customerEmail: details.customerEmail,
                    customerPhone: details.customerPhone,
                    userId: auth.user.id,
                    testMode: credential.testMode,
                    userClientId: credential.clientId,
                    userClientSecret: credential.clientSecret,
                    expireInDays: 37,
                })
                provider = {
                    correlationId: String(link.cf_link_id),
                    providerLinkId: link.link_id,
                    shortUrl: link.link_url,
                    expiresAt: null,
                    testMode: credential.testMode,
                }
            }
        } catch (error) {
            console.error(`[payments/create-link] ${gateway} creation failed:`, error)
            return NextResponse.json({ error: "The payment gateway could not create this link. Verify your gateway settings and try again." }, { status: 502 })
        }

        const { data: saved, error: insertError } = await db.from("invoice_payments").insert({
            session_id: sessionId,
            user_id: auth.user.id,
            razorpay_payment_link_id: provider.correlationId,
            provider_link_id: provider.providerLinkId,
            short_url: provider.shortUrl,
            amount: details.amount,
            currency: details.currency,
            status: "created",
            reference_id: details.referenceId,
            description: details.description,
            customer_name: details.customerName ?? null,
            customer_email: details.customerEmail ?? null,
            customer_phone: details.customerPhone ?? null,
            expires_at: provider.expiresAt,
            gateway,
            is_test_mode: provider.testMode,
        } as any).select("id,short_url,status,razorpay_payment_link_id,gateway,amount,currency").single()

        if (insertError || !saved) {
            await cancelProviderLink(gateway, provider.correlationId, provider.providerLinkId, credentials)
                .catch((cleanupError) => console.error("[payments/create-link] orphan cleanup failed:", cleanupError))
            if (insertError?.code === "23505") {
                const { data: winner, error: winnerError } = await db.from("invoice_payments")
                    .select("id,short_url,status,razorpay_payment_link_id,gateway,amount,currency")
                    .eq("session_id", sessionId).eq("user_id", auth.user.id)
                    .in("status", ["created", "partially_paid"]).maybeSingle()
                if (!winnerError && winner) return NextResponse.json(paymentResponse(winner, session.public_id, true))
            }
            throw insertError || new Error("Payment link persistence failed")
        }

        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment_link.created",
            resource_type: "invoice_payment",
            resource_id: saved.id,
            metadata: { gateway, amount: details.amount, currency: details.currency, session_id: sessionId } as any,
        }, request).catch(() => {})

        return NextResponse.json(paymentResponse(saved, session.public_id, false))
    } catch (error) {
        console.error("[payments/create-link] failed:", error)
        return NextResponse.json({ error: "Failed to create payment link. Please try again." }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const sessionId = request.nextUrl.searchParams.get("sessionId") || ""
    if (!UUID_PATTERN.test(sessionId)) {
        return NextResponse.json({ error: "A valid sessionId is required" }, { status: 400 })
    }
    try {
        const db = adminClient()
        const [paymentResult, sessionResult] = await Promise.all([
            db.from("invoice_payments")
                .select("id,short_url,status,amount,currency,reference_id,razorpay_payment_link_id,paid_at,amount_paid,created_at,gateway")
                .eq("session_id", sessionId).eq("user_id", auth.user.id)
                .order("created_at", { ascending: false }).limit(1).maybeSingle(),
            db.from("document_sessions").select("public_id")
                .eq("id", sessionId).eq("user_id", auth.user.id).maybeSingle(),
        ])
        if (paymentResult.error || sessionResult.error) throw paymentResult.error || sessionResult.error
        if (!sessionResult.data) return NextResponse.json({ error: "Session not found" }, { status: 404 })
        const data = paymentResult.data
        return NextResponse.json({
            paymentLink: data ? {
                ...data,
                platformLink: getPublicDocumentUrl(sessionResult.data.public_id),
            } : null,
        })
    } catch (error) {
        console.error("[payments/create-link] lookup failed:", error)
        return NextResponse.json({ error: "Failed to load payment link" }, { status: 500 })
    }
}
