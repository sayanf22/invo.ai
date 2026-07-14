import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSubscription, getVerifiedSubscriptionCharge } from "@/lib/razorpay"
import {
    applyRazorpaySubscriptionSnapshot,
    type RazorpaySubscriptionSnapshot,
} from "@/lib/razorpay-subscription-state"

interface SubscriptionWebhookEvent {
    created_at?: number | string
    payload?: {
        subscription?: { entity?: RazorpaySubscriptionSnapshot }
        payment?: { entity?: Record<string, any> }
    }
}

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

async function boundRow(db: SupabaseClient, subscriptionId: string) {
    if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
        throw new Error("Invalid Razorpay subscription id")
    }
    const { data, error } = await (db as any).from("subscriptions").select("*")
        .or(`razorpay_subscription_id.eq.${subscriptionId},pending_razorpay_subscription_id.eq.${subscriptionId}`)
        .maybeSingle()
    if (error) throw error
    return data
}
async function syncCharged(
    db: SupabaseClient,
    event: SubscriptionWebhookEvent,
    entity: RazorpaySubscriptionSnapshot,
) {
    const row = await boundRow(db, entity.id)
    if (!row?.user_id) throw new Error("Subscription webhook is not locally bound")
    const payloadPaymentId = event.payload?.payment?.entity?.id
    const verified = await getVerifiedSubscriptionCharge(
        entity.id,
        typeof payloadPaymentId === "string" ? payloadPaymentId : undefined,
    )
    if (!verified) throw new Error("Subscription charge could not be verified")

    const result = await applyRazorpaySubscriptionSnapshot(db, verified.subscription, {
        userId: row.user_id,
        eventType: "subscription.charged",
        eventCreatedAt: eventDate(event.created_at),
        charge: verified,
    })
    if (!result.applied || result.stale) return

    const label = result.plan.charAt(0).toUpperCase() + result.plan.slice(1)
    const { error } = await (db as any).from("notifications").insert({
        user_id: row.user_id,
        type: "subscription_activated",
        title: `${label} Plan Activated 🎉`,
        message: `Your ${label} plan is active with automatic ${result.billingCycle} billing.`,
        metadata: {
            plan: result.plan,
            billingCycle: result.billingCycle,
            razorpay_subscription_id: entity.id,
            razorpay_payment_id: verified.id,
        },
    })
    if (error) throw error
}

async function syncTerminal(
    db: SupabaseClient,
    event: SubscriptionWebhookEvent,
    payloadEntity: RazorpaySubscriptionSnapshot,
    status: "cancelled" | "past_due",
    eventType: string,
) {
    if (!payloadEntity.id) throw new Error("Subscription webhook is missing subscription id")
    const live = await getSubscription(payloadEntity.id)
    if (!live || live.id !== payloadEntity.id) throw new Error("Unable to refetch terminal subscription")
    if (eventType === "subscription.cancelled" && live.status !== "cancelled") return
    if (eventType === "subscription.halted" && live.status !== "halted") return

    const row = await boundRow(db, live.id)
    if (!row) return
    if (row.pending_razorpay_subscription_id === live.id && row.razorpay_subscription_id !== live.id) {
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
    if (existingAt && incomingAt.getTime() < existingAt.getTime()) return

    const liveEnd = live.current_end ? new Date(live.current_end * 1000) : null
    const existingEnd = row.current_period_end ? new Date(row.current_period_end) : null
    const nonExtendingEnd = liveEnd && (!existingEnd || liveEnd.getTime() <= existingEnd.getTime()) ? liveEnd : null
    const expired = Boolean(nonExtendingEnd && nonExtendingEnd.getTime() <= Date.now())
    const normalizeToFree = status === "cancelled" && expired && row.scheduled_downgrade === "free"
    const update: Record<string, unknown> = {
        status,
        provider_sync_required: false,
        provider_event_created_at: incomingAt.toISOString(),
        provider_event_type: eventType,
        updated_at: new Date().toISOString(),
        ...(status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {}),
        ...(nonExtendingEnd ? { current_period_end: nonExtendingEnd.toISOString() } : {}),
    }
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
        if (!entity?.id) throw new Error("Subscription webhook payload is missing")
        if (eventType === "subscription.charged") await syncCharged(db, event, entity)
        else if (eventType === "subscription.cancelled") await syncTerminal(db, event, entity, "cancelled", eventType)
        else if (eventType === "subscription.halted") await syncTerminal(db, event, entity, "past_due", eventType)
        // subscription.activated/updated are lifecycle signals only; never grants.
        return null
    } catch (error) {
        console.error("[razorpay/webhook] Subscription sync failed:", error)
        return NextResponse.json({ error: "Subscription webhook processing failed" }, { status: 500 })
    }
}
