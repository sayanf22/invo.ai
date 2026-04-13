import { NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { verifyPaymentSignature, PLANS, isValidPlanId } from "@/lib/razorpay"
import { logAudit } from "@/lib/audit-log"
import type { NextRequest } from "next/server"

/**
 * POST /api/razorpay/verify
 * Verifies payment signature and activates subscription.
 * 
 * SECURITY:
 * - Requires authentication
 * - Validates plan ID against known plans
 * - Verifies Razorpay signature using HMAC-SHA256
 * - Audit logs success and failure
 * - Uses service role client to update subscription (bypasses RLS)
 * - Logs payment to payment_history for audit trail
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    try {
        const body = await request.json()
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan,
            billingCycle,
        } = body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ error: "Missing payment details" }, { status: 400 })
        }

        // SECURITY: Validate plan ID against known plans
        if (!isValidPlanId(plan)) {
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: {
                    reason: "invalid_plan_id",
                    plan,
                    razorpay_order_id,
                } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 })
        }

        // CRITICAL: Verify signature server-side
        const isValid = await verifyPaymentSignature(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        if (!isValid) {
            console.error("Payment signature verification failed", { razorpay_order_id, razorpay_payment_id })
            // Audit log: payment verification failure
            await logAudit(auth.supabase, {
                user_id: auth.user.id,
                action: "security.payment_failure",
                metadata: {
                    reason: "signature_verification_failed",
                    razorpay_order_id,
                    razorpay_payment_id,
                } as any,
            }, request).catch(() => {})
            return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
        }

        // Use the authenticated user's Supabase client for the subscription update
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
                billing_cycle: billingCycle,
                status: "active",
                razorpay_payment_id,
                razorpay_order_id,
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

        // Log payment for audit
        await auth.supabase.from("payment_history" as any).insert({
            user_id: auth.user.id,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            amount,
            currency: "INR",
            status: "captured",
            plan,
            billing_cycle: billingCycle,
        })

        // Audit log: payment verification success
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.verify",
            metadata: {
                razorpay_order_id,
                razorpay_payment_id,
                plan,
                billing_cycle: billingCycle,
                amount,
                status: "success",
            } as any,
        }, request).catch(() => {})

        return NextResponse.json({
            success: true,
            plan,
            billingCycle,
            periodEnd: periodEnd.toISOString(),
        })
    } catch (error) {
        console.error("Verify payment error:", error)
        return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
    }
}
