import type { SupabaseClient } from "@supabase/supabase-js"
import {
    cancelRazorpaySubscription,
    getSubscription,
    planIdToCurrency,
    planIdToCycle,
    planIdToPlan,
    type PlanId,
    type RazorpayChargeCorrelation,
} from "@/lib/razorpay"

export interface RazorpaySubscriptionSnapshot {
    id: string
    status?: string
    plan_id?: string
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
}

export type RazorpayChargeSnapshot = RazorpayChargeCorrelation

export interface ApplySubscriptionOptions {
    userId: string
    eventType?: string
    eventCreatedAt?: Date
    charge?: RazorpayChargeSnapshot | null
}

export interface ApplySubscriptionResult {
    applied: boolean
    scheduled: boolean
    stale: boolean
    cleanupPending: boolean
    plan: Exclude<PlanId, "free">
    billingCycle: "monthly" | "yearly"
    periodEnd: string
    chargedAmount: number | null
}

export interface ApplyTerminalResult {
    applied: boolean
    stale: boolean
    finalized: boolean
    pendingCleared: boolean
    periodEnd: string | null
}

export interface ApplyTerminalOptions {
    userId: string
    eventType: "subscription.cancelled" | "subscription.halted" | "provider.reconcile"
    eventCreatedAt?: Date
}

const NON_GRANT_EVENTS = new Set(["subscription.activated", "subscription.updated"])

function eventRank(type: string | null | undefined): number {
    if (type === "subscription.cancelled" || type === "subscription.halted") return 3
    if (type === "subscription.charged") return 2
    return NON_GRANT_EVENTS.has(type || "") ? 1 : 0
}
async function authoritativeEntity(entity: RazorpaySubscriptionSnapshot): Promise<RazorpaySubscriptionSnapshot> {
    if (!entity.id) throw new Error("Razorpay subscription id is missing")
    const live = await getSubscription(entity.id)
    if (!live || live.id !== entity.id) throw new Error("Unable to fetch authoritative Razorpay subscription")
    return live
}

function requireSnapshot(entity: RazorpaySubscriptionSnapshot) {
    const plan = entity.plan_id ? planIdToPlan(entity.plan_id) : null
    const billingCycle = entity.plan_id ? planIdToCycle(entity.plan_id) : null
    const currency = entity.plan_id ? planIdToCurrency(entity.plan_id) : null
    if (!plan || plan === "free" || !billingCycle || !currency) {
        throw new Error(`Unknown Razorpay plan_id: ${entity.plan_id || "missing"}`)
    }
    if (plan === "agency") throw new Error("Agency subscriptions are not available yet")
    if (!entity.current_start || !entity.current_end) throw new Error("Razorpay subscription period is missing")
    return {
        plan: plan as Exclude<PlanId, "free">,
        billingCycle,
        currency,
        periodStart: new Date(entity.current_start * 1000),
        periodEnd: new Date(entity.current_end * 1000),
    }
}

function validateCharge(
    charge: RazorpayChargeSnapshot | null | undefined,
    subscriptionId: string,
    currency: string,
) {
    if (!charge
        || !charge.id.startsWith("pay_")
        || charge.subscription_id !== subscriptionId
        || !charge.invoice_id.startsWith("inv_")
        || !charge.order_id.startsWith("order_")
        || !Number.isSafeInteger(charge.amount)
        || charge.amount <= 0
        || charge.currency.toUpperCase() !== currency.toUpperCase()
    ) throw new Error("A verified positive captured subscription charge is required")
}

async function applyChargeAtomically(
    db: SupabaseClient,
    userId: string,
    entity: RazorpaySubscriptionSnapshot,
    snapshot: ReturnType<typeof requireSnapshot>,
    charge: RazorpayChargeSnapshot,
    eventType: string,
    eventAt: Date,
    previousSubscriptionId: string | null,
) {
    const { data, error } = await (db as any).rpc("apply_subscription_charge_event", {
        p_user_id: userId,
        p_subscription_id: entity.id,
        p_plan_id: entity.plan_id,
        p_plan: snapshot.plan,
        p_billing_cycle: snapshot.billingCycle,
        p_period_start: snapshot.periodStart.toISOString(),
        p_period_end: snapshot.periodEnd.toISOString(),
        p_payment_id: charge.id,
        p_invoice_id: charge.invoice_id,
        p_order_id: charge.order_id,
        p_amount: charge.amount,
        p_currency: charge.currency,
        p_event_type: eventType,
        p_event_created_at: eventAt.toISOString(),
        p_previous_subscription_id: previousSubscriptionId,
    })
    if (error) throw error
    if (data && typeof data === "object" && "applied" in data && !(data as any).applied) {
        throw new Error((data as any).reason || "Razorpay charge was not applied")
    }
}
export async function applyRazorpaySubscriptionSnapshot(
    db: SupabaseClient,
    entity: RazorpaySubscriptionSnapshot,
    options: ApplySubscriptionOptions,
): Promise<ApplySubscriptionResult> {
    const authoritative = await authoritativeEntity(entity)
    const snapshot = requireSnapshot(authoritative)
    const eventType = options.eventType || "provider.reconcile"
    const eventAt = options.eventCreatedAt || new Date()
    const now = new Date()

    if (authoritative.notes?.platform !== "clorefy" || authoritative.notes?.user_id !== options.userId) {
        throw new Error("Razorpay subscription ownership metadata does not match")
    }

    const { data: binding, error: bindingError } = await (db as any).from("subscriptions")
        .select("*")
        .eq("user_id", options.userId)
        .maybeSingle()
    if (bindingError) throw bindingError
    if (!binding || (
        binding.razorpay_subscription_id !== authoritative.id
        && binding.pending_razorpay_subscription_id !== authoritative.id
    )) throw new Error("Razorpay subscription is not locally bound to this user")

    const isReplacement = Boolean(binding.razorpay_subscription_id && binding.razorpay_subscription_id !== authoritative.id)
    const isExpectedReplacement = binding.pending_razorpay_subscription_id === authoritative.id
    const startsInFuture = snapshot.periodStart.getTime() > now.getTime() + 60_000

    if (isReplacement && isExpectedReplacement && startsInFuture) {
        const { error } = await (db as any).from("subscriptions").update({
            pending_plan: snapshot.plan,
            pending_billing_cycle: snapshot.billingCycle,
            pending_effective_at: snapshot.periodStart.toISOString(),
            provider_sync_required: false,
            updated_at: now.toISOString(),
        }).eq("user_id", options.userId)
        if (error) throw error
        return {
            applied: false,
            scheduled: true,
            stale: false,
            cleanupPending: Boolean(binding.pending_previous_subscription_id),
            plan: snapshot.plan,
            billingCycle: snapshot.billingCycle,
            periodEnd: snapshot.periodStart.toISOString(),
            chargedAmount: null,
        }
    }

    if (NON_GRANT_EVENTS.has(eventType)) throw new Error("Provider lifecycle events cannot grant paid entitlement")
    if (!authoritative.status || !["active", "authenticated"].includes(authoritative.status)) {
        throw new Error("Razorpay subscription is not in a grantable live state")
    }
    validateCharge(options.charge, authoritative.id, snapshot.currency)

    const existingEventAt = binding.provider_event_created_at ? Date.parse(binding.provider_event_created_at) : 0
    const incomingEventAt = eventAt.getTime()
    const existingStart = binding.current_period_start ? Date.parse(binding.current_period_start) : 0
    const existingEnd = binding.current_period_end ? Date.parse(binding.current_period_end) : 0
    const sameProvider = binding.razorpay_subscription_id === authoritative.id
    const staleByEvent = existingEventAt > incomingEventAt || (
        existingEventAt === incomingEventAt && eventRank(binding.provider_event_type) > eventRank(eventType)
    )
    const staleByPeriod = sameProvider
        ? snapshot.periodEnd.getTime() < existingEnd
        : !isExpectedReplacement && snapshot.periodStart.getTime() <= existingStart
    if (staleByEvent || staleByPeriod) {
        return {
            applied: false,
            scheduled: false,
            stale: true,
            cleanupPending: Boolean(binding.pending_previous_subscription_id),
            plan: snapshot.plan,
            billingCycle: snapshot.billingCycle,
            periodEnd: snapshot.periodEnd.toISOString(),
            chargedAmount: null,
        }
    }

    const previousSubscriptionId = isReplacement
        ? binding.razorpay_subscription_id
        : binding.pending_previous_subscription_id || null
    await applyChargeAtomically(
        db,
        options.userId,
        authoritative,
        snapshot,
        options.charge!,
        eventType,
        eventAt,
        previousSubscriptionId,
    )
    let cleanupPending = false
    if (previousSubscriptionId && previousSubscriptionId !== authoritative.id) {
        try {
            await cancelRazorpaySubscription(previousSubscriptionId, false)
            const { error } = await (db as any).from("subscriptions")
                .update({ pending_previous_subscription_id: null, updated_at: new Date().toISOString() })
                .eq("user_id", options.userId)
            cleanupPending = Boolean(error)
        } catch (error) {
            cleanupPending = true
            console.error("[subscription-state] previous mandate cleanup pending:", error)
        }
    }

    return {
        applied: true,
        scheduled: false,
        stale: false,
        cleanupPending,
        plan: snapshot.plan,
        billingCycle: snapshot.billingCycle,
        periodEnd: snapshot.periodEnd.toISOString(),
        chargedAmount: options.charge!.amount,
    }
}

/** Persist a provider-confirmed terminal state without shortening paid access. */
export async function applyRazorpayTerminalSnapshot(
    db: SupabaseClient,
    entity: RazorpaySubscriptionSnapshot,
    options: ApplyTerminalOptions,
): Promise<ApplyTerminalResult> {
    if (!entity.id || !["cancelled", "halted"].includes(entity.status || "")) {
        throw new Error("Razorpay subscription is not in a terminal live state")
    }
    if (entity.notes?.platform !== "clorefy" || entity.notes?.user_id !== options.userId) {
        throw new Error("Razorpay subscription ownership metadata does not match")
    }

    const providerPeriodEnd = entity.current_end
        ? new Date(entity.current_end * 1000).toISOString()
        : null
    const { data, error } = await (db as any).rpc("record_subscription_terminal_event", {
        p_user_id: options.userId,
        p_subscription_id: entity.id,
        p_provider_status: entity.status,
        p_period_end: providerPeriodEnd,
        p_event_type: options.eventType,
        p_event_created_at: (options.eventCreatedAt || new Date()).toISOString(),
    })
    if (error) throw error
    if (!data || typeof data !== "object") throw new Error("Terminal subscription update returned no result")
    if (!(data as any).applied && !(data as any).stale) {
        throw new Error((data as any).reason || "Terminal subscription update failed")
    }

    return {
        applied: Boolean((data as any).applied),
        stale: Boolean((data as any).stale),
        finalized: Boolean((data as any).finalized),
        pendingCleared: Boolean((data as any).pending_cleared),
        periodEnd: typeof (data as any).period_end === "string" ? (data as any).period_end : providerPeriodEnd,
    }
}

export function isActiveSubscriptionEvent(eventType: string): boolean {
    return eventType === "subscription.charged"
}
