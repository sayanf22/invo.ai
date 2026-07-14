import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
    applyRazorpaySubscriptionSnapshot,
    isActiveSubscriptionEvent,
    type RazorpaySubscriptionSnapshot,
} from "@/lib/razorpay-subscription-state"

interface SubscriptionWebhookEvent {
    created_at?: number | string
    payload?: {
        subscription?: { entity?: RazorpaySubscriptionSnapshot }
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

function eventDate(value: number | string | undefined): Date {
    if (typeof value === "number") return new Date(value * 1000)
    if (typeof value === "string") {
        const parsed = new Date(value)
        if (Number.isFinite(parsed.getTime())) return parsed
    }
    return new Date()
}

async function resolveUserId(db: SupabaseClient, entity: RazorpaySubscriptionSnapshot): Promise<string> {
    const noted = entity.notes?.user_id
    if (noted && UUID_PATTERN.test(noted)) return noted
    const { data, error } = await (db as any).from("subscriptions").select("user_id")
        .or(`razorpay_subscription_id.eq.${entity.id},pending_razorpay_subscription_id.eq.${entity.id}`)
        .maybeSingle()
    if (error) throw error
    if (!data?.user_id || !UUID_PATTERN.test(data.user_id)) {
        throw new Error("Subscription webhook is missing a valid user_id")
    }
    return data.user_id
}

async function syncActive(
    db: SupabaseClient,
    event: SubscriptionWebhookEvent,
    entity: RazorpaySubscriptionSnapshot,
    eventType: string,
) {
    const userId = await resolveUserId(db, entity)
    const payment = event.payload?.payment?.entity
    const result = await applyRazorpaySubscriptionSnapshot(db, entity, {
        userId,
        eventType,
        eventCreatedAt: eventDate(event.created_at),
        charge: eventType === "subscription.charged" && payment?.id ? {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            order_id: payment.order_id,
        } : null,
    })
    if (!result.applied || result.stale) return

    if (eventType === "subscription.activated") {
        const label = result.plan.charAt(0).toUpperCase() + result.plan.slice(1)
        const { error } = await (db as any).from("notifications").insert({
            user_id: userId,
            type: "subscription_activated",
            title: `${label} Plan Activated 🎉`,
            message: `Your ${label} plan is active with automatic ${result.billingCycle} billing.`,
            metadata: { plan: result.plan, billingCycle: result.billingCycle, razorpay_subscription_id: entity.id },
        })
        if (error) throw error
    }
}

async function syncTerminal(
    db: SupabaseClient,
    event: SubscriptionWebhookEvent,
    entity: RazorpaySubscriptionSnapshot,
    status: "cancelled" | "past_due",
    eventType: string,
) {
    if (!entity.id) throw new Error("Subscription webhook is missing subscription id")
    const { data: row, error: readError } = await (db as any).from("subscriptions").select("*")
        .or(`razorpay_subscription_id.eq.${entity.id},pending_razorpay_subscription_id.eq.${entity.id}`)
        .maybeSingle()
    if (readError) throw readError
    if (!row) return

    if (row.pending_razorpay_subscription_id === entity.id && row.razorpay_subscription_id !== entity.id) {
        const { error } = await (db as any).from("subscriptions").update({
            pending_plan: null,
            pending_billing_cycle: null,
            pending_razorpay_subscription_id: null,
            pending_change_type: null,
            pending_effective_at: null,
            pending_previous_subscription_id: null,
            provider_sync_required: false,
            updated_at: new Date().toISOString(),
        }).eq("user_id", row.user_id)
        if (error) throw error
        return
    }

    const incomingAt = eventDate(event.created_at)
    const existingAt = row.provider_event_created_at ? new Date(row.provider_event_created_at) : null
    const incomingEnd = entity.current_end ? new Date(entity.current_end * 1000) : null
    const existingEnd = row.current_period_end ? new Date(row.current_period_end) : null
    const stale = Boolean(
        (existingAt && incomingAt.getTime() < existingAt.getTime())
        || (existingAt && incomingAt.getTime() === existingAt.getTime()
            && row.provider_event_type && ["subscription.cancelled", "subscription.halted"].includes(row.provider_event_type)
            && !["subscription.cancelled", "subscription.halted"].includes(eventType))
        || (incomingEnd && existingEnd && incomingEnd.getTime() < existingEnd.getTime()),
    )
    if (stale) return

    const expired = Boolean(incomingEnd && incomingEnd.getTime() <= Date.now())
    const normalizeToFree = status === "cancelled" && expired && row.scheduled_downgrade === "free"
    const update: Record<string, unknown> = {
        status,
        provider_sync_required: false,
        provider_event_created_at: incomingAt.toISOString(),
        provider_event_type: eventType,
        updated_at: new Date().toISOString(),
    }
    if (status === "cancelled") update.cancelled_at = new Date().toISOString()
    if (entity.current_start) update.current_period_start = new Date(entity.current_start * 1000).toISOString()
    if (incomingEnd) update.current_period_end = incomingEnd.toISOString()
    if (normalizeToFree) Object.assign(update, {
        plan: "free",
        billing_cycle: null,
        scheduled_downgrade: null,
        pending_plan: null,
        pending_billing_cycle: null,
        pending_razorpay_subscription_id: null,
        pending_change_type: null,
        pending_effective_at: null,
        pending_previous_subscription_id: null,
    })
    const { error } = await (db as any).from("subscriptions").update(update).eq("user_id", row.user_id)
    if (error) throw error

    if (normalizeToFree) {
        await (db as any).from("recurring_invoices").update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("user_id", row.user_id).eq("is_active", true)
        await (db as any).from("email_schedules").update({
            status: "cancelled",
            cancelled_reason: "subscription_ended",
            updated_at: new Date().toISOString(),
        }).eq("user_id", row.user_id).eq("status", "pending")
    }
}

export async function handleRazorpaySubscriptionEvent(
    event: SubscriptionWebhookEvent,
    eventType: string,
    eventId: string,
): Promise<NextResponse | null> {
    if (!eventId) return NextResponse.json({ error: "Missing Razorpay event id" }, { status: 400 })

    try {
        const db = adminClient()
        const entity = event.payload?.subscription?.entity
        if (!entity) throw new Error("Subscription webhook payload is missing")
        if (isActiveSubscriptionEvent(eventType)) await syncActive(db, event, entity, eventType)
        else if (eventType === "subscription.cancelled") await syncTerminal(db, event, entity, "cancelled", eventType)
        else if (eventType === "subscription.halted") await syncTerminal(db, event, entity, "past_due", eventType)
        return null
    } catch (error) {
        console.error("[razorpay/webhook] Subscription sync failed:", error)
        return NextResponse.json({ error: "Subscription webhook processing failed" }, { status: 500 })
    }
}