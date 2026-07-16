import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSubscription, getVerifiedSubscriptionCharge } from "@/lib/razorpay"
import {
    applyRazorpaySubscriptionSnapshot,
    applyRazorpayTerminalSnapshot,
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
    const matchesPendingTarget = Boolean(
        row.pending_change_type
        && row.pending_provider_plan_id
        && row.pending_provider_plan_id === entity.plan_id
        && (row.pending_razorpay_subscription_id
            ? row.pending_razorpay_subscription_id === entity.id
            : row.razorpay_subscription_id === entity.id),
    )
    const pendingBoundary = matchesPendingTarget
        ? Date.parse(row.pending_effective_at || row.pending_created_at || "") - 5 * 60 * 1000
        : NaN
    const verified = await getVerifiedSubscriptionCharge(
        entity.id,
        typeof payloadPaymentId === "string" ? payloadPaymentId : undefined,
        Number.isFinite(pendingBoundary) ? pendingBoundary : undefined,
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
    eventType: "subscription.cancelled" | "subscription.halted",
) {
    if (!payloadEntity.id) throw new Error("Subscription webhook is missing subscription id")
    const live = await getSubscription(payloadEntity.id)
    if (!live || live.id !== payloadEntity.id) throw new Error("Unable to refetch terminal subscription")
    const expectedStatus = eventType === "subscription.cancelled" ? "cancelled" : "halted"
    if (live.status !== expectedStatus) return

    const row = await boundRow(db, live.id)
    if (!row?.user_id) return
    const isReplacement = row.pending_razorpay_subscription_id === live.id
        && row.razorpay_subscription_id !== live.id
    if (isReplacement) {
        const startedAt = row.pending_created_at ? Date.parse(row.pending_created_at) : NaN
        const captured = await getVerifiedSubscriptionCharge(
            live.id,
            undefined,
            Number.isFinite(startedAt) ? startedAt : undefined,
        )
        if (captured) {
            throw new Error("Terminal replacement has captured payment evidence and requires reconciliation")
        }
    }
    await applyRazorpayTerminalSnapshot(db, live, {
        userId: row.user_id,
        eventType,
        eventCreatedAt: eventDate(event.created_at),
    })
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
        else if (eventType === "subscription.cancelled") await syncTerminal(db, event, entity, eventType)
        else if (eventType === "subscription.halted") await syncTerminal(db, event, entity, eventType)
        // subscription.activated/updated are lifecycle signals only; never grants.
        return null
    } catch (error) {
        console.error("[razorpay/webhook] Subscription sync failed:", error)
        return NextResponse.json({ error: "Subscription webhook processing failed" }, { status: 500 })
    }
}
