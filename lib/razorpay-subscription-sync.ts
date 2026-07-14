import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
    cancelRazorpaySubscription,
    getSubscription,
    planIdToAmount,
    planIdToCurrency,
    planIdToCycle,
    planIdToPlan,
    type PlanId,
} from "@/lib/razorpay"

interface RazorpaySubscriptionEntity {
    id: string
    status?: string
    plan_id?: string
    notes?: Record<string, string>
    current_start?: number | null
    current_end?: number | null
}

interface SubscriptionWebhookEvent {
    payload?: {
        subscription?: { entity?: RazorpaySubscriptionEntity }
        payment?: { entity?: Record<string, any> }
    }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function adminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error("Supabase service role is required for subscription webhooks")
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function authoritativeEntity(entity: RazorpaySubscriptionEntity): Promise<RazorpaySubscriptionEntity> {
    if (entity.plan_id && entity.current_start && entity.current_end) return entity
    const live = entity.id ? await getSubscription(entity.id) : null
    if (!live) throw new Error("Unable to fetch authoritative Razorpay subscription")
    return { ...entity, ...live }
}

function requireProviderSnapshot(entity: RazorpaySubscriptionEntity) {
    const plan = entity.plan_id ? planIdToPlan(entity.plan_id) : null
    const billingCycle = entity.plan_id ? planIdToCycle(entity.plan_id) : null
    const currency = entity.plan_id ? planIdToCurrency(entity.plan_id) : null
    const amount = entity.plan_id ? planIdToAmount(entity.plan_id) : null
    if (!plan || plan === "free" || !billingCycle || !currency || amount == null) {
        throw new Error(`Unknown Razorpay plan_id: ${entity.plan_id || "missing"}`)
    }
    if (!entity.current_start || !entity.current_end) {
        throw new Error("Razorpay subscription period is missing")
    }
    return {
        plan: plan as Exclude<PlanId, "free">,
        billingCycle,
        currency,
        amount,
        periodStart: new Date(entity.current_start * 1000),
        periodEnd: new Date(entity.current_end * 1000),
    }
}

async function syncActiveSubscription(
    db: SupabaseClient,
    event: SubscriptionWebhookEvent,
    entity: RazorpaySubscriptionEntity,
    eventType: string,
) {
    const authoritative = await authoritativeEntity(entity)
    let userId = authoritative.notes?.user_id
    if (!userId || !UUID_PATTERN.test(userId)) {
        const { data: owner, error: ownerError } = await db.from("subscriptions")
            .select("user_id").eq("razorpay_subscription_id", authoritative.id).maybeSingle()
        if (ownerError) throw ownerError
        userId = owner?.user_id
    }
    if (!userId || !UUID_PATTERN.test(userId)) throw new Error("Subscription webhook is missing a valid user_id")
    const snapshot = requireProviderSnapshot(authoritative)

    const { data: existing, error: readError } = await db
        .from("subscriptions")
        .select("razorpay_subscription_id,current_period_start,current_period_end,scheduled_downgrade")
        .eq("user_id", userId)
        .maybeSingle()
    if (readError) throw readError

    const existingStart = existing?.current_period_start ? Date.parse(existing.current_period_start) : 0
    const existingEnd = existing?.current_period_end ? Date.parse(existing.current_period_end) : 0
    const incomingStart = snapshot.periodStart.getTime()
    const incomingEnd = snapshot.periodEnd.getTime()
    const sameProviderSubscription = !existing?.razorpay_subscription_id || existing.razorpay_subscription_id === authoritative.id
    const stale = sameProviderSubscription
        ? incomingEnd < existingEnd
        : incomingStart <= existingStart

    if (!stale) {
        const previousSubscriptionId = existing?.razorpay_subscription_id
        if (previousSubscriptionId && previousSubscriptionId !== authoritative.id) {
            await cancelRazorpaySubscription(previousSubscriptionId, false)
        }

        const update: Record<string, unknown> = {
            user_id: userId,
            plan: snapshot.plan,
            billing_cycle: snapshot.billingCycle,
            status: "active",
            razorpay_subscription_id: authoritative.id,
            razorpay_plan_id: authoritative.plan_id,
            amount_paid: snapshot.amount,
            currency: snapshot.currency,
            current_period_start: snapshot.periodStart.toISOString(),
            current_period_end: snapshot.periodEnd.toISOString(),
            cancelled_at: null,
            updated_at: new Date().toISOString(),
        }
        if (existing?.scheduled_downgrade === snapshot.plan) update.scheduled_downgrade = null
        const { error } = await db.from("subscriptions").upsert(update, { onConflict: "user_id" })
        if (error) throw error
    }

    const payment = event.payload?.payment?.entity
    if (eventType === "subscription.charged" && payment?.id) {
        const { data: prior, error: priorError } = await db.from("payment_history")
            .select("id").eq("razorpay_payment_id", payment.id).maybeSingle()
        if (priorError) throw priorError
        if (!prior) {
            const { error } = await db.from("payment_history").insert({
                user_id: userId,
                razorpay_payment_id: payment.id,
                razorpay_order_id: payment.order_id ?? null,
                amount: payment.amount ?? snapshot.amount,
                currency: payment.currency ?? snapshot.currency,
                status: "captured",
                plan: snapshot.plan,
                billing_cycle: snapshot.billingCycle,
            })
            if (error) throw error
        }
    }


    if (eventType === "subscription.activated" && !stale) {
        const planLabel = snapshot.plan.charAt(0).toUpperCase() + snapshot.plan.slice(1)
        const { error } = await db.from("notifications").insert({
            user_id: userId,
            type: "subscription_activated",
            title: `${planLabel} Plan Activated 🎉`,
            message: `Your ${planLabel} plan is now active.`,
            metadata: {
                plan: snapshot.plan,
                billingCycle: snapshot.billingCycle,
                razorpay_subscription_id: authoritative.id,
            },
        })
        if (error) throw error
    }

    const { error: profileError } = await db.from("profiles")
        .update({ plan_selected: true }).eq("id", userId)
    if (profileError) throw profileError
}

async function syncProviderStatus(
    db: SupabaseClient,
    entity: RazorpaySubscriptionEntity,
    status: "cancelled" | "past_due",
) {
    if (!entity.id) throw new Error("Subscription webhook is missing subscription id")
    const update: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    }
    if (status === "cancelled") update.cancelled_at = new Date().toISOString()
    if (entity.current_start) update.current_period_start = new Date(entity.current_start * 1000).toISOString()
    if (entity.current_end) update.current_period_end = new Date(entity.current_end * 1000).toISOString()
    const { error } = await db.from("subscriptions")
        .update(update).eq("razorpay_subscription_id", entity.id)
    if (error) throw error
}

async function removeFailedDedup(db: SupabaseClient, eventId: string) {
    if (!eventId) return
    const { error } = await db.from("webhook_events")
        .delete().eq("gateway", "razorpay").eq("event_id", eventId)
    if (error) console.error("[razorpay/webhook] Failed to release event for retry:", error.message)
}

/**
 * Synchronizes subscription events from Razorpay. Returns null on success or a
 * retryable HTTP response after removing the event dedup marker on failure.
 */
export async function handleRazorpaySubscriptionEvent(
    event: SubscriptionWebhookEvent,
    eventType: string,
    eventId: string,
): Promise<NextResponse | null> {
    if (!eventId) {
        return NextResponse.json({ error: "Missing Razorpay event id" }, { status: 400 })
    }

    let db: SupabaseClient | null = null
    try {
        db = adminClient()
        const entity = event.payload?.subscription?.entity
        if (!entity) throw new Error("Subscription webhook payload is missing")

        if (eventType === "subscription.activated" || eventType === "subscription.charged" || eventType === "subscription.updated") {
            await syncActiveSubscription(db, event, entity, eventType)
        } else if (eventType === "subscription.cancelled") {
            await syncProviderStatus(db, entity, "cancelled")
        } else if (eventType === "subscription.halted") {
            await syncProviderStatus(db, entity, "past_due")
        }
        return null
    } catch (error) {
        console.error("[razorpay/webhook] Subscription sync failed:", error)
        if (db) await removeFailedDedup(db, eventId)
        return NextResponse.json({ error: "Subscription webhook processing failed" }, { status: 500 })
    }
}