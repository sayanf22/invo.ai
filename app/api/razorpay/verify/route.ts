import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { verifyPaymentSignature, PLANS, isValidPlanId } from "@/lib/razorpay"
import { logAudit } from "@/lib/audit-log"
import type { NextRequest } from "next/server"

/**
 * POST /api/razorpay/verify
 * Verifies payment signature and activates subscription.
 * 
 * Handles both:
 * - Subscription payments (razorpay_subscription_id + razorpay_payment_id)
 * - One-time order payments (razorpay_order_id + razorpay_payment_id) — legacy
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature,
            plan,
            billingCycle,
        } = body

        if (!razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: "Missing payment details" }, { status: 400 })
        }

        // Need either order_id or subscription_id
        const verifyId = razorpay_subscription_id || razorpay_order_id
        if (!verifyId) {
            return NextResponse.json({ error: "Missing order or subscription ID" }, { status: 400 })
        }

        if (!isValidPlanId(plan)) {
            return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
        }

        // Verify signature: for subscriptions, it's subscription_id|payment_id
        const isValid = await verifyPaymentSignature(
            verifyId,
            razorpay_payment_id,
            razorpay_signature
        )

        if (!isValid) {
            console.error("Payment signature verification failed", { verifyId, razorpay_payment_id })
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: { reason: "signature_verification_failed", verifyId, razorpay_payment_id } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
        }

        const planConfig = PLANS[plan]
        const amount = billingCycle === "yearly"
            ? planConfig.yearlyPrice * 12
            : planConfig.monthlyPrice

        const now = new Date()
        const periodEnd = new Date(now)
        if (billingCycle === "yearly") {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1)
        }

        // Upsert subscription
        const { error: subError } = await auth.supabase
            .from("subscriptions" as any)
            .upsert({
                user_id: auth.user.id,
                plan: plan as string,
                billing_cycle: billingCycle || "monthly",
                status: "active",
                razorpay_payment_id,
                razorpay_order_id: razorpay_order_id || null,
                razorpay_subscription_id: razorpay_subscription_id || null,
                amount_paid: amount,
                currency: "INR",
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                updated_at: now.toISOString(),
            }, { onConflict: "user_id" })

        if (subError) {
            console.error("Subscription upsert error:", subError)
            return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 })
        }

        // Mark plan as selected in profile
        await auth.supabase
            .from("profiles")
            .update({ plan_selected: true } as any)
            .eq("id", auth.user.id)

        // Log payment
        await auth.supabase.from("payment_history" as any).insert({
            user_id: auth.user.id,
            razorpay_payment_id,
            razorpay_order_id: razorpay_order_id || null,
            razorpay_signature,
            amount,
            currency: "INR",
            status: "captured",
            plan,
            billing_cycle: billingCycle || "monthly",
        }).catch(() => {})

        // Audit log
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.verify",
            metadata: { verifyId, razorpay_payment_id, plan, billing_cycle: billingCycle, amount, status: "success" } as any,
        }, request).catch(() => {})

        // Notification
        const { createNotification, PLAN_NAMES } = await import("@/lib/notifications")
        const planLabel = PLAN_NAMES[plan] || plan
        await createNotification(auth.supabase, {
            user_id: auth.user.id,
            type: "subscription_activated",
            title: `${planLabel} Plan Activated 🎉`,
            message: `Your ${planLabel} plan is now active with automatic monthly billing.`,
            metadata: { plan, billingCycle, amount, razorpay_payment_id },
        }).catch(() => {})

        return NextResponse.json({
            success: true,
            plan,
            billingCycle: billingCycle || "monthly",
            periodEnd: periodEnd.toISOString(),
        })
    } catch (error) {
        console.error("Verify payment error:", error)
        return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
    }
}
