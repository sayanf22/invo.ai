import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { authenticateRequest, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import {
    cancelRazorpayScheduledSubscriptionChange,
    cancelRazorpaySubscription,
} from "@/lib/razorpay"
import { recoverPendingSubscriptionTransition } from "@/lib/razorpay-transition-recovery"
import { logAudit } from "@/lib/audit-log"

async function readSubscription(db: any, userId: string) {
    const { data, error } = await db.from("subscriptions" as any)
        .select("*").eq("user_id", userId).maybeSingle()
    if (error) throw error
    return data as any
}

async function clearPending(db: any, row: any) {
    const { data, error } = await db.rpc("clear_subscription_transition" as any, {
        p_user_id: row.user_id,
        p_expected_transition_id: row.pending_transition_id,
        p_expected_change_type: row.pending_change_type,
        p_expected_pending_subscription_id: row.pending_razorpay_subscription_id ?? null,
        p_reason: "user_cancelled",
    } as any)
    if (error) throw error
    return Boolean((data as any)?.cleared)
}

export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error
    const csrfError = await validateCSRFToken(request, auth.user.id, auth.supabase)
    if (csrfError) return csrfError
    const rateError = await checkRateLimit(auth.user.id, "payment", auth.supabase as any)
    if (rateError) return rateError


    try {
        const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        let row = await readSubscription(db, auth.user.id)
        if (!row?.pending_change_type) {
            return NextResponse.json({ success: true, cleared: false, reason: "no_pending_change" })
        }

        const recovery = await recoverPendingSubscriptionTransition(db, row)
        if (recovery.state === "cleared" || recovery.state === "reconciled") {
            row = await readSubscription(db, auth.user.id)
            if (!row?.pending_change_type) {
                return NextResponse.json({ success: true, cleared: true, reason: recovery.state })
            }
        }

        if (row.pending_change_type === "cancellation") {
            return NextResponse.json({
                error: "Razorpay cannot reactivate a cancelled mandate. Choose a paid plan to authorize its replacement before your current access ends.",
                code: "REAUTHORIZATION_REQUIRED",
                targetPlan: row.pending_plan,
                effectiveAt: row.pending_effective_at,
            }, { status: 409 })
        }

        const pendingId = row.pending_razorpay_subscription_id as string | null
        const currentId = row.razorpay_subscription_id as string | null
        if (pendingId && pendingId !== currentId) {
            await cancelRazorpaySubscription(pendingId, false)
            const postCancel = await recoverPendingSubscriptionTransition(db, row)
            if (postCancel.state === "pending") {
                return NextResponse.json({
                    success: false,
                    pending: true,
                    code: "CANCELLATION_RECONCILING",
                    message: "Cancellation was accepted, but captured-payment reconciliation is still in progress.",
                }, { status: 202 })
            }
        } else if (row.pending_change_type === "downgrade" || row.pending_change_type === "cycle_change") {
            if (!currentId) throw new Error("Current provider subscription is missing")
            await cancelRazorpayScheduledSubscriptionChange(currentId)
            const cleared = await clearPending(db, row)
            if (!cleared) {
                return NextResponse.json({ error: "The billing change was updated elsewhere. Refresh and retry." }, { status: 409 })
            }
        } else {
            return NextResponse.json({
                error: "This immediate change is awaiting payment confirmation and cannot be cancelled safely yet.",
                code: "PAYMENT_CONFIRMATION_PENDING",
            }, { status: 409 })
        }

        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.subscription_change_cancelled",
            metadata: {
                pending_plan: row.pending_plan,
                pending_change_type: row.pending_change_type,
                pending_subscription_id: pendingId,
            } as any,
        }, request).catch(() => {})
        return NextResponse.json({ success: true, cleared: true })
    } catch (error) {
        console.error("[cancel-change] failed:", error)
        return NextResponse.json({
            error: "The billing provider could not cancel this scheduled change. Your existing schedule is unchanged.",
        }, { status: 502 })
    }
}