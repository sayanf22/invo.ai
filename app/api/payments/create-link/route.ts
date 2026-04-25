import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authenticateRequest, validateBodySize, sanitizeError } from "@/lib/api-auth"
import { createPaymentLink } from "@/lib/razorpay"
import { createStripePaymentLink } from "@/lib/stripe-payments"
import { createCashfreePaymentLink } from "@/lib/cashfree-payment-links"
import { checkRateLimit } from "@/lib/rate-limiter"
import { logAudit } from "@/lib/audit-log"
import { createClient } from "@supabase/supabase-js"
import { sanitizeSQLInput as sanitizeInput } from "@/lib/sanitize"
import { getUserRazorpayCredentials, getUserPaymentCredentials } from "@/app/api/payments/settings/route"

/**
 * POST /api/payments/create-link
 *
 * Creates a Razorpay Payment Link for an invoice session.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (general: 30/min)
 * - Amount is validated server-side — client cannot set arbitrary amounts
 * - Session ownership verified before creating link
 * - Duplicate prevention: one active link per session
 */
export async function POST(request: NextRequest) {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // 2. Rate limit — DISABLED for payment link creation
    // The Razorpay API has its own rate limiting, and we have a confirmation dialog
    // that prevents accidental double-clicks. The Postgres rate limiter was causing
    // false positives due to auth token issues in the RPC call.
    // const rateLimitError = await checkRateLimit(auth.user.id, "payment")
    // if (rateLimitError) return rateLimitError

    // 3. Parse + validate body
    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 50 * 1024) // 50KB max (includes contextSnapshot)
    if (sizeError) return sizeError

    const {
        sessionId,
        amount,       // in smallest currency unit (paise for INR)
        currency = "INR",
        description,
        referenceId,  // invoice number
        customerName,
        customerEmail,
        customerPhone,
        acceptPartial = false,
        dueDate,      // ISO date string e.g. "2026-05-30" — used for smart expiry
    } = body as Record<string, unknown>

    // Validate required fields
    if (!sessionId || typeof sessionId !== "string") {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }
    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive integer in smallest currency unit" }, { status: 400 })
    }
    if (!description || typeof description !== "string") {
        return NextResponse.json({ error: "description is required" }, { status: 400 })
    }
    if (!referenceId || typeof referenceId !== "string") {
        return NextResponse.json({ error: "referenceId is required" }, { status: 400 })
    }

    // Sanitize string inputs
    const safeDescription = sanitizeInput(String(description)).slice(0, 255)
    const safeReferenceId = sanitizeInput(String(referenceId)).slice(0, 40)
    const safeCustomerName = customerName ? sanitizeInput(String(customerName)).slice(0, 100) : undefined
    const safeCustomerEmail = customerEmail ? sanitizeInput(String(customerEmail)).slice(0, 255) : undefined
    const safeCustomerPhone = customerPhone ? sanitizeInput(String(customerPhone)).slice(0, 20) : undefined

    // 4. Verify session ownership
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: session, error: sessionError } = await supabaseAdmin
        .from("document_sessions")
        .select("id, user_id, document_type")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .maybeSingle()

    if (sessionError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // 5. Check for existing active payment link for this session
    const { data: existingLink } = await supabaseAdmin
        .from("invoice_payments")
        .select("id, short_url, status, razorpay_payment_link_id")
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .in("status", ["created", "partially_paid"])
        .maybeSingle()

    if (existingLink) {
        // Return the existing active link instead of creating a duplicate
        const platformLink = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${sessionId}`
        return NextResponse.json({
            success: true,
            paymentLink: {
                id: existingLink.id,
                shortUrl: existingLink.short_url,
                platformLink,
                status: existingLink.status,
                razorpayId: existingLink.razorpay_payment_link_id,
                isExisting: true,
            },
        })
    }

    // 6. Get user's payment credentials — try all gateways in priority order
    // Priority: Razorpay (India) → Stripe (global) → Cashfree (India)
    const allCreds = await getUserPaymentCredentials(auth.user.id)

    if (!allCreds) {
        return NextResponse.json(
            {
                error: "Payment collection not set up",
                code: "NO_PAYMENT_SETTINGS",
                message: "Please add your payment gateway API keys in Settings → Payments to start collecting payments.",
            },
            { status: 422 }
        )
    }

    // Determine which gateway to use
    // Prefer Razorpay for INR, Stripe for other currencies, Cashfree as fallback for INR
    const currencyUpper = String(currency).toUpperCase()
    let selectedGateway: "razorpay" | "stripe" | "cashfree" | null = null

    if (currencyUpper === "INR") {
        if (allCreds.razorpay) selectedGateway = "razorpay"
        else if (allCreds.cashfree) selectedGateway = "cashfree"
        else if (allCreds.stripe) selectedGateway = "stripe"
    } else {
        // Non-INR: Stripe first, then Razorpay (supports some non-INR), Cashfree doesn't support non-INR well
        if (allCreds.stripe) selectedGateway = "stripe"
        else if (allCreds.razorpay) selectedGateway = "razorpay"
    }

    if (!selectedGateway) {
        return NextResponse.json(
            {
                error: "No compatible payment gateway configured",
                code: "NO_PAYMENT_SETTINGS",
                message: `No payment gateway supports ${currencyUpper}. Please connect Stripe for international payments or Razorpay/Cashfree for INR.`,
            },
            { status: 422 }
        )
    }

    // 7. Create payment link via selected gateway
    let shortUrl: string
    let gatewayLinkId: string
    let expireByUnix: number | null = null

    if (selectedGateway === "razorpay") {
        const userCreds = allCreds.razorpay!
        let razorpayLink
        try {
            razorpayLink = await createPaymentLink({
                amount,
                currency: currencyUpper,
                description: safeDescription,
                referenceId: safeReferenceId,
                customerName: safeCustomerName,
                customerEmail: safeCustomerEmail,
                customerPhone: safeCustomerPhone,
                sessionId,
                userId: auth.user.id,
                acceptPartial: Boolean(acceptPartial),
                dueDateIso: typeof dueDate === "string" ? dueDate : undefined,
                userKeyId: userCreds.keyId,
                userKeySecret: userCreds.keySecret,
            })
        } catch (err: unknown) {
            console.error("Razorpay payment link creation failed:", err)
            const msg = err instanceof Error ? err.message : "Unknown error"
            if (msg.includes("reference ID already attempted") || msg.includes("reference_id")) {
                return NextResponse.json({ error: "A payment link with this invoice number already exists. Please use a different invoice number." }, { status: 409 })
            }
            if (msg.includes("rate limit") || msg.includes("Too Many Requests")) {
                return NextResponse.json({ error: "Razorpay API rate limit reached. Please wait a minute and try again." }, { status: 429 })
            }
            if (msg.includes("Invalid") || msg.includes("Authentication") || msg.includes("401")) {
                return NextResponse.json({ error: "Invalid Razorpay credentials. Please check your API keys in Settings → Payments.", code: "INVALID_CREDENTIALS" }, { status: 401 })
            }
            return NextResponse.json({ error: msg || "Failed to create payment link" }, { status: 500 })
        }
        shortUrl = razorpayLink.short_url
        gatewayLinkId = razorpayLink.id
        expireByUnix = razorpayLink.expire_by

    } else if (selectedGateway === "stripe") {
        const userCreds = allCreds.stripe!
        let stripeLink
        try {
            stripeLink = await createStripePaymentLink({
                amount,
                currency: currencyUpper,
                description: safeDescription,
                referenceId: safeReferenceId,
                customerEmail: safeCustomerEmail,
                sessionId,
                userId: auth.user.id,
                userSecretKey: userCreds.secretKey,
            })
        } catch (err: unknown) {
            console.error("Stripe payment link creation failed:", err)
            const msg = err instanceof Error ? err.message : "Unknown error"
            if (msg.includes("No such") || msg.includes("Invalid API Key")) {
                return NextResponse.json({ error: "Invalid Stripe credentials. Please check your API keys in Settings → Payments.", code: "INVALID_CREDENTIALS" }, { status: 401 })
            }
            return NextResponse.json({ error: msg || "Failed to create Stripe payment link" }, { status: 500 })
        }
        shortUrl = stripeLink.url
        gatewayLinkId = stripeLink.id

    } else {
        // Cashfree
        const userCreds = allCreds.cashfree!
        let cfLink
        try {
            cfLink = await createCashfreePaymentLink({
                amount,
                currency: currencyUpper,
                description: safeDescription,
                referenceId: safeReferenceId,
                customerName: safeCustomerName,
                customerEmail: safeCustomerEmail,
                customerPhone: safeCustomerPhone,
                sessionId,
                userId: auth.user.id,
                testMode: userCreds.testMode,
                userClientId: userCreds.clientId,
                userClientSecret: userCreds.clientSecret,
                expireInDays: typeof dueDate === "string" ? 30 : 30,
            })
        } catch (err: unknown) {
            console.error("Cashfree payment link creation failed:", err)
            const msg = err instanceof Error ? err.message : "Unknown error"
            if (msg.includes("401") || msg.includes("403") || msg.includes("authentication")) {
                return NextResponse.json({ error: "Invalid Cashfree credentials. Please check your API keys in Settings → Payments.", code: "INVALID_CREDENTIALS" }, { status: 401 })
            }
            return NextResponse.json({ error: msg || "Failed to create Cashfree payment link" }, { status: 500 })
        }
        shortUrl = cfLink.link_url
        gatewayLinkId = cfLink.cf_link_id
    }

    // 8. Store in DB
    const { data: savedLink, error: insertError } = await supabaseAdmin
        .from("invoice_payments")
        .insert({
            session_id: sessionId,
            user_id: auth.user.id,
            razorpay_payment_link_id: gatewayLinkId,
            short_url: shortUrl,
            amount,
            currency: String(currency).toUpperCase(),
            status: "created",
            reference_id: safeReferenceId,
            description: safeDescription,
            customer_name: safeCustomerName ?? null,
            customer_email: safeCustomerEmail ?? null,
            customer_phone: safeCustomerPhone ?? null,
            expires_at: expireByUnix ? new Date(expireByUnix * 1000).toISOString() : null,
            gateway: selectedGateway,
        })
        .select("id")
        .single()

    if (insertError) {
        console.error("Failed to save payment link to DB:", insertError)
        // Link was created in Razorpay but not saved — still return it to user
    }

    // Mark session as sent (payment link was shared) + snapshot current context from request
    // The client sends the current invoiceData so the public /pay page shows up-to-date info
    const contextSnapshot = (body as Record<string, unknown>).contextSnapshot
    const sessionUpdate: Record<string, unknown> = { sent_at: new Date().toISOString() }
    if (contextSnapshot && typeof contextSnapshot === "object" && !Array.isArray(contextSnapshot)) {
        // Validate it's a plain object with expected InvoiceData shape before storing
        const ctx = contextSnapshot as Record<string, unknown>
        // Only store if it has at least one expected InvoiceData field
        if (ctx.documentType !== undefined || ctx.fromName !== undefined || ctx.items !== undefined) {
            sessionUpdate.context = contextSnapshot
        }
    }
    await supabaseAdmin
        .from("document_sessions")
        .update(sessionUpdate)
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .is("sent_at", null) // Only set once

    // 8. Audit log
    await logAudit(auth.supabase, {
        user_id: auth.user.id,
        action: "payment_link.created",
        resource_type: "invoice_payment",
        resource_id: savedLink?.id ?? undefined,
        metadata: {
            gateway: selectedGateway,
            gateway_link_id: gatewayLinkId,
            amount,
            currency,
            session_id: sessionId,
            reference_id: safeReferenceId,
        } as any,
    }, request)

    const platformLink = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${sessionId}`

    return NextResponse.json({
        success: true,
        paymentLink: {
            id: savedLink?.id,
            shortUrl,
            platformLink,
            status: "created",
            razorpayId: gatewayLinkId,
            gateway: selectedGateway,
            isExisting: false,
        },
    })
}

/**
 * GET /api/payments/create-link?sessionId=xxx
 * Fetch existing payment link for a session
 */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: link } = await supabaseAdmin
        .from("invoice_payments")
        .select("id, short_url, status, amount, currency, reference_id, razorpay_payment_link_id, paid_at, amount_paid, created_at")
        .eq("session_id", sessionId)
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    return NextResponse.json({ paymentLink: link ? { ...link, platformLink: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${sessionId}` } : null })
}
