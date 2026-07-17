import type { SupabaseClient } from "@supabase/supabase-js"
import {
    getRazorpayScheduledSubscriptionChange,
    getSubscription,
    getVerifiedSubscriptionCharge,
    planIdToCycle,
    planIdToPlan,
} from "@/lib/razorpay"
import {
    applyRazorpaySubscriptionSnapshot,
    applyRazorpayTerminalSnapshot,
    hasPersistedRazorpayEntitlement,
} from "@/lib/razorpay-subscription-state"

export const ABANDONED_CHECKOUT_TTL_MS = 30 * 60 * 1000

export interface PendingSubscriptionRow {
    user_id: string
    plan: string
    billing_cycle?: string | null
    current_period_end?: string | null
    razorpay_subscription_id?: string | null
    pending_plan?: string | null
    pending_billing_cycle?: string | null
    pending_razorpay_subscription_id?: string | null
    pending_previous_subscription_id?: string | null
    pending_change_type?: string | null
    pending_effective_at?: string | null
    pending_created_at?: string | null
    pending_transition_id?: string | null
    pending_provider_plan_id?: string | null
    scheduled_downgrade?: string | null
}

export interface TransitionRecoveryResult {
    state: "none" | "pending" | "cleared" | "reconciled"
    retryableCheckout?: boolean
    targetPlan?: string | null
    targetBillingCycle?: string | null
    effectiveAt?: string | null
    reason?: string
}

function isPast(value: string | null | undefined): boolean {
    if (!value) return false
    const timestamp = Date.parse(value)
    return Number.isFinite(timestamp) && timestamp <= Date.now()
}


async function clearTransition(
    db: SupabaseClient,
    row: PendingSubscriptionRow,
    reason: "abandoned_checkout" | "provider_terminal" | "provider_missing" | "provider_no_scheduled_change",
): Promise<boolean> {
    const { data, error } = await (db as any).rpc("clear_subscription_transition", {
        p_user_id: row.user_id,
        p_expected_transition_id: row.pending_transition_id,
        p_expected_change_type: row.pending_change_type,
        p_expected_pending_subscription_id: row.pending_razorpay_subscription_id ?? null,
        p_reason: reason,
    })
    if (error) throw error
    return Boolean(data?.cleared)
}

function pending(row: PendingSubscriptionRow, extra: Partial<TransitionRecoveryResult> = {}): TransitionRecoveryResult {
    return {
        state: "pending",
        targetPlan: row.pending_plan,
        targetBillingCycle: row.pending_billing_cycle,
        effectiveAt: row.pending_effective_at,
        ...extra,
    }
}

/**
 * Reconcile one locally-pending transition against Razorpay before an API
 * blocks another plan action. It never grants access without exact captured
 * charge evidence and never clears a valid future scheduled provider update.
 */
export async function recoverPendingSubscriptionTransition(
    db: SupabaseClient,
    row: PendingSubscriptionRow | null | undefined,
): Promise<TransitionRecoveryResult> {
    if (!row?.pending_change_type || !row.pending_plan) return { state: "none" }

    const pendingId = row.pending_razorpay_subscription_id || null
    const currentId = row.razorpay_subscription_id || null
    const providerId = pendingId || currentId
    if (!providerId) {
        const cleared = await clearTransition(db, row, "provider_missing")
        return { state: cleared ? "cleared" : "pending", reason: "provider_missing" }
    }

    const provider = await getSubscription(providerId)
    if (!provider) {
        const cleared = await clearTransition(db, row, "provider_missing")
        return { state: cleared ? "cleared" : "pending", reason: "provider_missing" }
    }
    if (provider.notes?.platform !== "clorefy" || provider.notes?.user_id !== row.user_id) {
        throw new Error("Razorpay transition ownership metadata does not match")
    }

    if (provider.status === "cancelled" || provider.status === "halted") {
        const replacementTerminal = Boolean(pendingId && pendingId !== currentId)
        if (replacementTerminal) {
            const evidenceBoundary = row.pending_created_at ? Date.parse(row.pending_created_at) : NaN
            const captured = await getVerifiedSubscriptionCharge(
                providerId,
                undefined,
                Number.isFinite(evidenceBoundary) ? evidenceBoundary : undefined,
            ).catch(() => null)
            if (captured) {
                return pending(row, { reason: "captured_charge_requires_terminal_reconciliation" })
            }
        }
        await applyRazorpayTerminalSnapshot(db, provider, {
            userId: row.user_id,
            eventType: "provider.reconcile",
            eventCreatedAt: new Date(),
        })
        if (replacementTerminal && row.pending_previous_subscription_id
            && row.scheduled_downgrade === "free" && !isPast(row.current_period_end)) {
            const { error } = await (db as any).from("subscriptions").update({
                pending_plan: "free",
                pending_billing_cycle: null,
                pending_provider_plan_id: null,
                pending_razorpay_subscription_id: null,
                pending_change_type: "cancellation",
                pending_effective_at: row.current_period_end,
                pending_previous_subscription_id: null,
                provider_sync_required: false,
                updated_at: new Date().toISOString(),
            }).eq("user_id", row.user_id).is("pending_change_type", null)
            if (error) throw error
            return pending({ ...row, pending_plan: "free", pending_change_type: "cancellation" }, {
                reason: "cancellation_restored",
            })
        }
        if (replacementTerminal || isPast(row.current_period_end)) {
            const cleared = await clearTransition(db, row, "provider_terminal")
            return { state: cleared ? "cleared" : "reconciled", reason: "provider_terminal" }
        }
        return pending(row, { reason: "paid_access_until_period_end" })
    }

    if (pendingId && pendingId !== currentId) {
        const createdAt = row.pending_created_at ? Date.parse(row.pending_created_at) : NaN
        const abandoned = provider.status === "created"
            && Number.isFinite(createdAt)
            && Date.now() - createdAt >= ABANDONED_CHECKOUT_TTL_MS
        if (abandoned) {
            return pending(row, { retryableCheckout: true, reason: "checkout_can_be_cancelled" })
        }
        if (provider.status === "created") return pending(row, { retryableCheckout: true })
        if (provider.current_start && provider.current_start * 1000 > Date.now() + 60_000) {
            return pending(row)
        }
    }


    const targetPlan = provider.plan_id ? planIdToPlan(provider.plan_id) : null
    const targetCycle = provider.plan_id ? planIdToCycle(provider.plan_id) : null
    const matchesTarget = targetPlan === row.pending_plan
        && (!row.pending_billing_cycle || targetCycle === row.pending_billing_cycle)
        && (!row.pending_provider_plan_id || provider.plan_id === row.pending_provider_plan_id)
    const isDeferred = row.pending_change_type === "downgrade"
        || row.pending_change_type === "cycle_change"

    if (isDeferred) {
        try {
            const scheduled = await getRazorpayScheduledSubscriptionChange(providerId)
            const scheduledPlan = scheduled?.plan_id ? planIdToPlan(scheduled.plan_id) : null
            const scheduledCycle = scheduled?.plan_id ? planIdToCycle(scheduled.plan_id) : null
            if (scheduled && scheduledPlan === row.pending_plan
                && (!row.pending_billing_cycle || scheduledCycle === row.pending_billing_cycle)
                && (!row.pending_provider_plan_id || scheduled.plan_id === row.pending_provider_plan_id)) {
                return pending(row)
            }
            if (scheduled) {
                return pending(row, { reason: "provider_scheduled_target_differs" })
            }
            if (!matchesTarget) {
                const cleared = await clearTransition(db, row, "provider_no_scheduled_change")
                return { state: cleared ? "cleared" : "pending", reason: "provider_no_scheduled_change" }
            }
        } catch (error) {
            console.error("[subscription-recovery] scheduled update check failed:", error)
            return pending(row, { reason: "provider_check_unavailable" })
        }
    }

    // Apply the same 5-minute grace the charge RPC and subscription webhook use
    // so minor DB/provider clock skew never rejects the legitimate first charge.
    // Target matching + captured-charge validation still gate every grant.
    const evidenceBoundary = isDeferred && row.pending_effective_at
        ? Date.parse(row.pending_effective_at) - 5 * 60 * 1000
        : row.pending_created_at ? Date.parse(row.pending_created_at) - 5 * 60 * 1000 : NaN
    const verified = matchesTarget
        ? await getVerifiedSubscriptionCharge(
            providerId,
            undefined,
            Number.isFinite(evidenceBoundary) ? evidenceBoundary : undefined,
        ).catch(() => null)
        : null
    let persistenceUnconfirmed = false
    if (verified) {
        const result = await applyRazorpaySubscriptionSnapshot(db, verified.subscription, {
            userId: row.user_id,
            eventType: "provider.reconcile",
            eventCreatedAt: new Date(),
            charge: verified,
        })
        if (result.applied || result.stale) {
            const persisted = await hasPersistedRazorpayEntitlement(
                db,
                row.user_id,
                providerId,
                result.plan,
                result.billingCycle,
            )
            if (persisted) return { state: "reconciled" }
            persistenceUnconfirmed = true
        }
    }

    return pending(row, {
        retryableCheckout: Boolean(pendingId && pendingId !== currentId),
        reason: persistenceUnconfirmed
            ? "entitlement_persistence_unconfirmed"
            : matchesTarget ? "captured_charge_pending" : "provider_transition_pending",
    })
}