import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import {
    verifyPaymentSignature,
    getPayment,
    getSubscription,
    isValidPlanId,
    planIdToPlan,
} from "@/lib/razorpay"
import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"
import { logAudit } from "@/lib/audit-log"
import { createClient } from "@supabase/supabase-js"

/** Verify Razorpay Checkout and apply only provider-authoritative subscription state. */
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
        const {
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            plan,
        } = body
        const providerIdPattern = /^(pay|sub)_[A-Za-z0-9]{6,100}$/
        if (
            typeof razorpay_payment_id !== "string"
            || typeof razorpay_subscription_id !== "string"
            || typeof razorpay_signature !== "string"
            || !providerIdPattern.test(razorpay_payment_id)
            || !providerIdPattern.test(razorpay_subscription_id)
            || razorpay_signature.length < 32
            || razorpay_signature.length > 256
        ) {
            return NextResponse.json({ error: "Invalid subscription payment details" }, { status: 400 })
        }
        if (!isValidPlanId(plan) || plan === "free") {
            return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
        }

        const valid = await verifyPaymentSignature(
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
        )
        if (!valid) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: { reason: "signature_verification_failed", verifyId: razorpay_subscription_id, razorpay_payment_id } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
        }

        let providerSubscription: Awaited<ReturnType<typeof getSubscription>> = null
        try {
            providerSubscription = await getSubscription(razorpay_subscription_id)
        } catch (error) {
            console.error("[verify] failed to fetch provider subscription:", error)
        }
        const providerPlan = providerSubscription?.plan_id
            ? planIdToPlan(providerSubscription.plan_id)
            : null
        const providerOwnedByUser = providerSubscription?.id === razorpay_subscription_id
            && providerSubscription.notes?.platform === "clorefy"
            && providerSubscription.notes?.user_id === auth.user.id
        if (providerSubscription && !providerOwnedByUser) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: { reason: "subscription_owner_mismatch", razorpay_subscription_id, razorpay_payment_id } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Payment verification failed" }, { status: 403 })
        }
        if (!providerSubscription || !providerPlan || providerPlan === "free") {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "payment.verify_pending",
                metadata: { razorpay_subscription_id, razorpay_payment_id, reason: "plan_not_confirmed" } as any,
            }, request).catch(() => {})
            return NextResponse.json({
                success: true,
                pending: true,
                message: "Payment received. Razorpay confirmation is still syncing; access has not been changed yet.",
            }, { status: 202 })
        }

        if (providerPlan !== plan) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.plan_mismatch",
                metadata: { claimed_plan: plan, actual_plan: providerPlan, razorpay_subscription_id, razorpay_payment_id } as any,
            }, request).catch(() => {})
        }

        const payment = await getPayment(razorpay_payment_id).catch((error) => {
            console.error("[verify] exact payment fetch deferred to webhook:", error)
            return null
        })
        const validPaymentState = payment?.id === razorpay_payment_id
            && ["authorized", "captured"].includes(payment.status)
            && Number.isSafeInteger(payment.amount)
            && payment.amount >= 0
            && typeof payment.currency === "string"
        if (!validPaymentState) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "payment.verify_pending",
                metadata: {
                    razorpay_subscription_id,
                    razorpay_payment_id,
                    reason: payment ? "payment_not_authorized" : "payment_not_available",
                } as any,
            }, request).catch(() => {})
            return NextResponse.json({
                success: true,
                pending: true,
                message: "Payment verification is still syncing; access has not been changed yet.",
            }, { status: 202 })
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceRoleKey) throw new Error("Billing service credentials are not configured")
        const svc = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const result = await applyRazorpaySubscriptionSnapshot(svc, providerSubscription, {
            userId: auth.user.id,
            eventType: "provider.verify",
            eventCreatedAt: new Date(),
            // Checkout's authorization payment can be nominal and auto-refunded.
            // Revenue is recorded only from subscription.charged webhooks.
            charge: null,
        })

        let cleanupPending = result.cleanupPending
        if (result.scheduled) {
            const { data: row } = await svc.from("subscriptions" as any)
                .select("razorpay_subscription_id,pending_previous_subscription_id")
                .eq("user_id", auth.user.id).maybeSingle()
            const previousId = (row as any)?.pending_previous_subscription_id || (row as any)?.razorpay_subscription_id
            if (previousId && previousId !== razorpay_subscription_id) {
                try {
                    const { cancelRazorpaySubscription } = await import("@/lib/razorpay")
                    await cancelRazorpaySubscription(previousId, true)
                    const { error: clearError } = await svc.from("subscriptions" as any)
                        .update({ pending_previous_subscription_id: null, updated_at: new Date().toISOString() })
                        .eq("user_id", auth.user.id)
                    cleanupPending = Boolean(clearError)
                } catch (error) {
                    cleanupPending = true
                    console.error("[verify] old mandate cycle-end cancellation pending:", error)
                }
            }
        }

        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.verify",
            metadata: {
                verifyId: razorpay_subscription_id,
                razorpay_payment_id,
                plan: result.plan,
                billing_cycle: result.billingCycle,
                scheduled: result.scheduled,
                cleanup_pending: cleanupPending,
                amount: result.chargedAmount,
                status: "success",
            } as any,
        }, request).catch(() => {})

        const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
        const planLabel = PLAN_NAMES[result.plan] || result.plan
        await createNotification(auth.supabase, {
            user_id: auth.user.id,
            type: result.scheduled ? "general" : "subscription_activated",
            title: result.scheduled ? `${planLabel} Change Scheduled` : `${planLabel} Plan Activated 🎉`,
            message: result.scheduled
                ? `Your ${planLabel} plan starts on ${new Date(result.periodEnd).toLocaleDateString()}. Your current plan remains active until then.`
                : `Your ${planLabel} plan is active with automatic ${result.billingCycle} billing.`,
            metadata: { plan: result.plan, billingCycle: result.billingCycle, scheduled: result.scheduled },
        }).catch(() => {})

        if (result.scheduled) {
            return NextResponse.json({
                success: true,
                scheduled: true,
                cleanupPending,
                targetPlan: result.plan,
                targetBillingCycle: result.billingCycle,
                effectiveDate: result.periodEnd,
                message: cleanupPending
                    ? "Your change is authorized and scheduled. Previous mandate cleanup is still syncing."
                    : "Your change is authorized and will begin next billing cycle.",
            })
        }

        return NextResponse.json({
            success: true,
            pending: false,
            cleanupPending,
            plan: result.plan,
            billingCycle: result.billingCycle,
            periodEnd: result.periodEnd,
            chargedAmount: result.chargedAmount,
            chargedCurrency: payment?.currency ?? null,
        })
    } catch (error) {
        console.error("Verify payment error:", error)
        return NextResponse.json({
            error: "Payment was received but activation is still syncing. Please open Billing again shortly.",
            recoverable: true,
        }, { status: 500 })
    }
}