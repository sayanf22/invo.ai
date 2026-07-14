import type { SupabaseClient } from "@supabase/supabase-js"
import {
    cancelRazorpaySubscription,
    getSubscription,
    planIdToAmount,
    planIdToCurrency,
    planIdToCycle,
    planIdToPlan,
    type PlanId,
} from "@/lib/razorpay"

export interface RazorpaySubscriptionSnapshot {
    id: string
    status?: string
    plan_id?: string
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
}

export interface RazorpayChargeSnapshot {
    id: string
    amount?: number | null
    currency?: string | null
    order_id?: string | null
    signature?: string | null
}

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

const ACTIVE_EVENTS = new Set(["subscription.activated", "subscription.updated", "subscription.charged"])

function eventRank(type: string | null | undefined): number {
    if (type === "subscription.cancelled" || type === "subscription.halted") return 3
    if (type === "subscription.charged") return 2
    if (type === "subscription.updated" || type === "subscription.activated") return 1
    return 0
}

async function authoritativeEntity(entity: RazorpaySubscriptionSnapshot): Promise<RazorpaySubscriptionSnapshot> {
    if (entity.plan_id && entity.current_start && entity.current_end) return entity
    const live = entity.id ? await getSubscription(entity.id) : null
    if (!live) throw new Error("Unable to fetch authoritative Razorpay subscription")
    return { ...entity, ...live }
}

function requireSnapshot(entity: RazorpaySubscriptionSnapshot) {
    const plan = entity.plan_id ? planIdToPlan(entity.plan_id) : null
    const billingCycle = entity.plan_id ? planIdToCycle(entity.plan_id) : null
    const currency = entity.plan_id ? planIdToCurrency(entity.plan_id) : null
    const catalogAmount = entity.plan_id ? planIdToAmount(entity.plan_id) : null
    if (!plan || plan === "free" || !billingCycle || !currency || catalogAmount == null) {
        throw new Error(`Unknown Razorpay plan_id: ${entity.plan_id || "missing"}`)
    }
    if (!entity.current_start || !entity.current_end) {
        throw new Error("Razorpay subscription period is missing")
    }
    return {
        plan: plan as Exclude<PlanId, "free">,
        billingCycle,
        currency,
        catalogAmount,
        periodStart: new Date(entity.current_start * 1000),
        periodEnd: new Date(entity.current_end * 1000),
    }
}

async function recordCharge(
    db: SupabaseClient,
    userId: string,
    charge: RazorpayChargeSnapshot,
    plan: string,
    billingCycle: string,
    fallbackCurrency: string,
) {
    if (!charge.id || charge.amount == null) return
    const { data: prior, error: priorError } = await (db as any).from("payment_history")
        .select("id").eq("razorpay_payment_id", charge.id).maybeSingle()
    if (priorError) throw priorError
    if (prior) return
    const { error } = await (db as any).from("payment_history").insert({
        user_id: userId,
        razorpay_payment_id: charge.id,
        razorpay_order_id: charge.order_id ?? null,
        razorpay_signature: charge.signature ?? null,
        amount: charge.amount,
        currency: charge.currency || fallbackCurrency,
        status: "captured",
        plan,
        billing_cycle: billingCycle,
    })
    if (error) throw error
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

    const { data: existing, error: readError } = await (db as any).from("subscriptions")
        .select("*").eq("user_id", options.userId).maybeSingle()
    if (readError) throw readError

    const isReplacement = Boolean(existing?.razorpay_subscription_id && existing.razorpay_subscription_id !== authoritative.id)
    const isExpectedReplacement = existing?.pending_razorpay_subscription_id === authoritative.id
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
        if (options.charge) {
            await recordCharge(db, options.userId, options.charge, snapshot.plan, snapshot.billingCycle, snapshot.currency)
        }
        return {
            applied: false,
            scheduled: true,
            stale: false,
            cleanupPending: Boolean(existing?.pending_previous_subscription_id),
            plan: snapshot.plan,
            billingCycle: snapshot.billingCycle,
            periodEnd: snapshot.periodStart.toISOString(),
            chargedAmount: options.charge?.amount ?? null,
        }
    }

    const existingEventAt = existing?.provider_event_created_at
        ? Date.parse(existing.provider_event_created_at)
        : 0
    const incomingEventAt = eventAt.getTime()
    const existingStart = existing?.current_period_start ? Date.parse(existing.current_period_start) : 0
    const existingEnd = existing?.current_period_end ? Date.parse(existing.current_period_end) : 0
    const sameProvider = !existing?.razorpay_subscription_id || existing.razorpay_subscription_id === authoritative.id
    const staleByEvent = existingEventAt > incomingEventAt || (
        existingEventAt === incomingEventAt && eventRank(existing?.provider_event_type) > eventRank(eventType)
    )
    const staleByPeriod = sameProvider
        ? snapshot.periodEnd.getTime() < existingEnd
        : !isExpectedReplacement && snapshot.periodStart.getTime() <= existingStart
    const stale = staleByEvent || staleByPeriod

    if (stale) {
        return {
            applied: false,
            scheduled: false,
            stale: true,
            cleanupPending: Boolean(existing?.pending_previous_subscription_id),
            plan: snapshot.plan,
            billingCycle: snapshot.billingCycle,
            periodEnd: snapshot.periodEnd.toISOString(),
            chargedAmount: null,
        }
    }

    const previousSubscriptionId = isReplacement ? existing.razorpay_subscription_id : existing?.pending_previous_subscription_id
    const chargedAmount = options.charge?.amount ?? null
    const update: Record<string, unknown> = {
        user_id: options.userId,
        plan: snapshot.plan,
        billing_cycle: snapshot.billingCycle,
        status: "active",
        razorpay_subscription_id: authoritative.id,
        razorpay_plan_id: authoritative.plan_id,
        currency: snapshot.currency,
        current_period_start: snapshot.periodStart.toISOString(),
        current_period_end: snapshot.periodEnd.toISOString(),
        cancelled_at: null,
        scheduled_downgrade: null,
        pending_plan: null,
        pending_billing_cycle: null,
        pending_razorpay_subscription_id: null,
        pending_change_type: null,
        pending_effective_at: null,
        pending_previous_subscription_id: previousSubscriptionId || null,
        provider_sync_required: false,
        provider_event_created_at: eventAt.toISOString(),
        provider_event_type: eventType,
        updated_at: now.toISOString(),
    }
    if (chargedAmount != null) update.amount_paid = chargedAmount
    else if (!existing) update.amount_paid = snapshot.catalogAmount

    const { error: upsertError } = await (db as any).from("subscriptions")
        .upsert(update, { onConflict: "user_id" })
    if (upsertError) throw upsertError

    if (options.charge) {
        await recordCharge(db, options.userId, options.charge, snapshot.plan, snapshot.billingCycle, snapshot.currency)
    }

    const { error: profileError } = await (db as any).from("profiles")
        .update({ plan_selected: true }).eq("id", options.userId)
    if (profileError) throw profileError

    let cleanupPending = false
    if (previousSubscriptionId && previousSubscriptionId !== authoritative.id) {
        try {
            await cancelRazorpaySubscription(previousSubscriptionId, false)
            const { error: clearError } = await (db as any).from("subscriptions")
                .update({ pending_previous_subscription_id: null, updated_at: new Date().toISOString() })
                .eq("user_id", options.userId)
            cleanupPending = Boolean(clearError)
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
        chargedAmount,
    }
}

export function isActiveSubscriptionEvent(eventType: string): boolean {
    return ACTIVE_EVENTS.has(eventType)
}