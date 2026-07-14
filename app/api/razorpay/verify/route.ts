import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import {
    getSubscription,
    getVerifiedSubscriptionCharge,
    isValidPlanId,
    planIdToPlan,
    verifyPaymentSignature,
} from "@/lib/razorpay"
import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"
import { logAudit } from "@/lib/audit-log"

const pendingResponse = (message: string, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ success: true, pending: true, ...extra, message }, { status: 202 })

/** Signature verification authenticates Checkout; only a captured invoice charge grants access. */
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
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 2 * 1024)
    if (sizeError) return sizeError

    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, plan } = body
        const providerIdPattern = /^(pay|sub)_[A-Za-z0-9]{6,100}$/
        if (typeof razorpay_payment_id !== "string"
            || typeof razorpay_subscription_id !== "string"
            || typeof razorpay_signature !== "string"
            || !providerIdPattern.test(razorpay_payment_id)
            || !providerIdPattern.test(razorpay_subscription_id)
            || razorpay_signature.length < 32
            || razorpay_signature.length > 256
        ) return NextResponse.json({ error: "Invalid subscription payment details" }, { status: 400 })
        if (!isValidPlanId(plan) || plan === "free") {
            return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
        }
        if (plan === "agency") {
            return NextResponse.json({ error: "Agency plan is coming soon", code: "AGENCY_COMING_SOON" }, { status: 403 })
        }

        const valid = await verifyPaymentSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)
        if (!valid) return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })

        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        const { data: localBinding, error: bindingError } = await svc.from("subscriptions" as any)
            .select("user_id, razorpay_subscription_id, pending_razorpay_subscription_id")
            .eq("user_id", auth.user.id)
            .maybeSingle()
        if (bindingError) throw bindingError
        const bound = localBinding as any
        if (!bound || (bound.razorpay_subscription_id !== razorpay_subscription_id
            && bound.pending_razorpay_subscription_id !== razorpay_subscription_id)) {
            return NextResponse.json({ error: "Subscription is not bound to this account" }, { status: 403 })
        }

        const provider = await getSubscription(razorpay_subscription_id).catch(() => null)
        const providerPlan = provider?.plan_id ? planIdToPlan(provider.plan_id) : null
        if (provider && (provider.id !== razorpay_subscription_id
            || provider.notes?.platform !== "clorefy"
            || provider.notes?.user_id !== auth.user.id)) {
            return NextResponse.json({ error: "Payment verification failed" }, { status: 403 })
        }
        if (providerPlan === "agency") {
            return NextResponse.json({ error: "Agency plan is coming soon", code: "AGENCY_COMING_SOON" }, { status: 403 })
        }
        if (!provider || !providerPlan || providerPlan === "free") {
            return pendingResponse("Payment confirmation is still syncing; access has not been changed yet.")
        }
        if (providerPlan !== plan) {
            return NextResponse.json({ error: "Verified subscription plan does not match the requested plan" }, { status: 400 })
        }
        const futureStart = Boolean(provider.current_start && provider.current_start * 1000 > Date.now() + 60_000)
        if (futureStart) {
            const scheduled = await applyRazorpaySubscriptionSnapshot(svc, provider, {
                userId: auth.user.id,
                eventType: "provider.verify",
                eventCreatedAt: new Date(),
                charge: null,
            })
            return pendingResponse("Your authorized replacement is scheduled; current access remains unchanged.", {
                scheduled: scheduled.scheduled,
                targetPlan: scheduled.plan,
                targetBillingCycle: scheduled.billingCycle,
                effectiveDate: scheduled.periodEnd,
            })
        }

        const verified = await getVerifiedSubscriptionCharge(razorpay_subscription_id, razorpay_payment_id)
            .catch((error) => {
                console.error("[verify] charge evidence unavailable:", error)
                return null
            })
        if (!verified) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "payment.verify_pending",
                metadata: { razorpay_subscription_id, razorpay_payment_id, reason: "captured_charge_not_verified" } as any,
            }, request).catch(() => {})
            return pendingResponse("Payment verification is still syncing; access has not been changed yet.")
        }

        const result = await applyRazorpaySubscriptionSnapshot(svc, verified.subscription, {
            userId: auth.user.id,
            eventType: "provider.verify",
            eventCreatedAt: new Date(),
            charge: verified,
        })
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.verify",
            metadata: {
                razorpay_subscription_id,
                razorpay_payment_id,
                plan: result.plan,
                billing_cycle: result.billingCycle,
                amount: result.chargedAmount,
                invoice_id: verified.invoice_id,
                status: "success",
            } as any,
        }, request).catch(() => {})

        if (result.applied) {
            const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
            const label = PLAN_NAMES[result.plan] || result.plan
            await createNotification(auth.supabase, {
                user_id: auth.user.id,
                type: "subscription_activated",
                title: `${label} Plan Activated 🎉`,
                message: `Your ${label} plan is active with automatic ${result.billingCycle} billing.`,
                metadata: { plan: result.plan, billingCycle: result.billingCycle, razorpay_payment_id },
            }).catch(() => {})
        }

        return NextResponse.json({
            success: true,
            pending: false,
            cleanupPending: result.cleanupPending,
            plan: result.plan,
            billingCycle: result.billingCycle,
            periodEnd: result.periodEnd,
            chargedAmount: result.chargedAmount,
            chargedCurrency: verified.currency,
        })
    } catch (error) {
        console.error("Verify payment error:", error)
        return NextResponse.json({
            error: "Payment was received but activation is still syncing. Please open Billing again shortly.",
            recoverable: true,
        }, { status: 500 })
    }
}
