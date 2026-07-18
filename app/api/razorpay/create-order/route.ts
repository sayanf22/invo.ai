import { NextResponse, type NextRequest } from "next/server"
import { authenticateRequest, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { validateCSRFToken } from "@/lib/csrf"
import { checkRateLimit } from "@/lib/rate-limiter"
import {
    createRazorpaySubscription,
    getSubscription,
    getVerifiedSubscriptionCharge,
    updateRazorpaySubscriptionPlan,
    getPlanIdForCurrency,
    planIdToCycle,
    planIdToPlan,
    RazorpayApiError,
    PLANS,
    PLAN_PRICES_BY_CURRENCY,
    resolveSubscriptionCurrency,
    type PlanId,
} from "@/lib/razorpay"
import { getSecret } from "@/lib/secrets"
import { logAudit } from "@/lib/audit-log"
import { applyRazorpaySubscriptionSnapshot } from "@/lib/razorpay-subscription-state"
import { recoverPendingSubscriptionTransition } from "@/lib/razorpay-transition-recovery"
import { createClient } from "@supabase/supabase-js"

const UPDATABLE_RAZORPAY_STATUSES = new Set(["authenticated", "active"])
const PLAN_ORDER = ["free", "starter", "pro", "agency"]

function isBelowMinimumChargeableAmountError(err: unknown): boolean {
    if (!(err instanceof RazorpayApiError)) return false
    const desc = err.description.toLowerCase()
    return desc.includes("difference amount") && desc.includes("less than")
}

function asFutureDate(value: unknown): Date | null {
    if (typeof value !== "string") return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) && date.getTime() > Date.now() ? date : null
}

function resolveStoredEffectivePlan(subscription: any): string {
    const periodEnd = asFutureDate(subscription?.current_period_end)
    return periodEnd && PLAN_ORDER.includes(subscription?.plan) ? subscription.plan : "free"
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

    let body: Record<string, unknown>
    try { body = await request.json() } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const sizeError = validateBodySize(body, 2 * 1024)
    if (sizeError) return sizeError

    try {
        const { plan, billingCycle } = body as { plan?: string; billingCycle?: string }
        if (plan === "agency") {
            return NextResponse.json({ error: "Agency plan is coming soon", code: "AGENCY_COMING_SOON" }, { status: 403 })
        }
        if (!plan || !["starter", "pro"].includes(plan)) {
            return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
        }

        const cycle = (billingCycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"
        const tier = plan as "starter" | "pro"
        const currency = resolveSubscriptionCurrency(request.headers.get("cf-ipcountry") || "")
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        )
        const { data: currentSubRow, error: currentSubError } = await auth.supabase
            .from("subscriptions" as any).select("*").eq("user_id", auth.user.id).maybeSingle()
        if (currentSubError) throw currentSubError
        let currentSub = currentSubRow as any

        if (currentSub?.pending_change_type && currentSub?.pending_plan) {
            let recovery
            try {
                recovery = await recoverPendingSubscriptionTransition(svc, currentSub)
            } catch (error) {
                console.error("[create-order] pending transition reconciliation failed:", error)
                return NextResponse.json({
                    error: "We could not verify the existing billing change. Please retry shortly.",
                    code: "TRANSITION_CHECK_UNAVAILABLE",
                    recoverable: true,
                }, { status: 503 })
            }

            if (recovery.state === "cleared" || recovery.state === "reconciled") {
                const { data: refreshed, error: refreshError } = await svc.from("subscriptions" as any)
                    .select("*").eq("user_id", auth.user.id).maybeSingle()
                if (refreshError) throw refreshError
                currentSub = refreshed as any
            } else {
                const reversingCancellation = currentSub.pending_change_type === "cancellation"
                    && currentSub.pending_plan === "free"
                    && asFutureDate(currentSub.current_period_end)
                if (reversingCancellation) {
                    const periodEnd = asFutureDate(currentSub.current_period_end)!
                    const targetCurrency = currentSub.currency || currency
                    const targetProviderPlanId = getPlanIdForCurrency(tier, targetCurrency, cycle)
                    if (!targetProviderPlanId) {
                        return NextResponse.json({ error: "Invalid plan for subscription" }, { status: 400 })
                    }
                    const startAt = Math.max(
                        Math.floor(periodEnd.getTime() / 1000),
                        Math.floor(Date.now() / 1000) + 300,
                    )
                    const replacement = await createRazorpaySubscription(
                        plan as PlanId, cycle, auth.user.id, targetCurrency, startAt,
                    )
                    const currentIndex = PLAN_ORDER.indexOf(resolveStoredEffectivePlan(currentSub))
                    const targetIndex = PLAN_ORDER.indexOf(plan)
                    const changeType = targetIndex < currentIndex ? "downgrade"
                        : targetIndex > currentIndex ? "upgrade" : "cycle_change"
                    const { data: replaced, error: replaceError } = await svc.from("subscriptions" as any)
                        .update({
                            scheduled_downgrade: "free",
                            pending_plan: plan,
                            pending_billing_cycle: cycle,
                            pending_provider_plan_id: targetProviderPlanId,
                            pending_razorpay_subscription_id: replacement.id,
                            pending_change_type: changeType,
                            pending_effective_at: new Date(startAt * 1000).toISOString(),
                            pending_previous_subscription_id: currentSub.razorpay_subscription_id,
                            provider_sync_required: false,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", auth.user.id)
                        .eq("pending_change_type", "cancellation")
                        .select("user_id")
                        .maybeSingle()
                    if (replaceError || !replaced) {
                        const { cancelRazorpaySubscription } = await import("@/lib/razorpay")
                        await cancelRazorpaySubscription(replacement.id, false).catch(() => {})
                        return NextResponse.json({
                            error: "The scheduled cancellation changed while we were preparing reauthorization. Please retry.",
                            code: "TRANSITION_CHANGED",
                        }, { status: 409 })
                    }
                    const amount = PLAN_PRICES_BY_CURRENCY[targetCurrency]?.[tier]?.[cycle]
                        ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]
                    return NextResponse.json({
                        subscriptionId: replacement.id,
                        keyId: await getSecret("RAZORPAY_KEY_ID"),
                        plan,
                        billingCycle: cycle,
                        planName: PLANS[plan as PlanId].name,
                        currency: targetCurrency,
                        amount,
                        scheduledChange: true,
                        reversingCancellation: true,
                        effectiveDate: new Date(startAt * 1000).toISOString(),
                    })
                }

                const pendingCycle = currentSub.pending_billing_cycle || cycle
                const sameCheckout = recovery.retryableCheckout
                    && currentSub.pending_razorpay_subscription_id
                    && currentSub.pending_plan === plan
                    && pendingCycle === cycle
                if (sameCheckout) {
                    const pendingCurrency = currentSub.currency || currency
                    const amount = PLAN_PRICES_BY_CURRENCY[pendingCurrency]?.[tier]?.[cycle]
                        ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]
                    return NextResponse.json({
                        subscriptionId: currentSub.pending_razorpay_subscription_id,
                        keyId: await getSecret("RAZORPAY_KEY_ID"),
                        plan,
                        billingCycle: cycle,
                        planName: PLANS[plan as PlanId].name,
                        currency: pendingCurrency,
                        amount,
                        reusedPendingCheckout: true,
                        scheduledChange: Boolean(currentSub.pending_effective_at),
                        effectiveDate: currentSub.pending_effective_at,
                    })
                }
                return NextResponse.json({
                    error: "A verified billing change is still pending.",
                    code: "CHANGE_PENDING",
                    transition: {
                        type: currentSub.pending_change_type,
                        fromPlan: resolveStoredEffectivePlan(currentSub),
                        targetPlan: currentSub.pending_plan,
                        targetBillingCycle: currentSub.pending_billing_cycle,
                        effectiveAt: currentSub.pending_effective_at,
                        recoverable: true,
                    },
                }, { status: 409 })
            }
        }

        const existingId = currentSub?.razorpay_subscription_id as string | undefined

        if (existingId) {
            const live = await getSubscription(existingId)
            const livePlan = live?.plan_id ? planIdToPlan(live.plan_id) : null
            const liveCycle = live?.plan_id ? planIdToCycle(live.plan_id) : null
            const liveEnd = live?.current_end ? new Date(live.current_end * 1000) : null
            const localEnd = asFutureDate(currentSub.current_period_end)
            const hasProviderPaidTime = Boolean(livePlan && livePlan !== "free" && liveEnd && liveEnd.getTime() > Date.now())
            const effectivePlan = hasProviderPaidTime
                ? livePlan!
                : (localEnd && PLAN_ORDER.includes(currentSub.plan) ? currentSub.plan : "free")
            const currentCycle = (liveCycle || currentSub.billing_cycle || "monthly") as "monthly" | "yearly"
            const currentIdx = PLAN_ORDER.indexOf(effectivePlan)
            const targetIdx = PLAN_ORDER.indexOf(plan)
            const isUpgrade = targetIdx > currentIdx
            const isCycleChange = targetIdx === currentIdx && cycle !== currentCycle

            if (effectivePlan !== "free" && targetIdx < currentIdx) {
                return NextResponse.json({
                    error: "Use the downgrade flow to schedule this change at cycle end",
                    code: "DOWNGRADE_REQUIRED",
                }, { status: 409 })
            }
            if (effectivePlan !== "free" && targetIdx === currentIdx && !isCycleChange) {
                return NextResponse.json({ error: "You are already on this plan and billing cycle", code: "SAME_PLAN" }, { status: 409 })
            }

            if (effectivePlan !== "free" && (isUpgrade || isCycleChange)) {
                const targetCurrency = currentSub.currency || currency
                const targetPlanId = getPlanIdForCurrency(tier, targetCurrency, cycle)
                if (!targetPlanId) return NextResponse.json({ error: "Invalid plan for subscription" }, { status: 400 })
                const paymentMethod = (live?.payment_method || "").toLowerCase()
                const canUpdateInPlace = paymentMethod === "card" && Boolean(live?.status && UPDATABLE_RAZORPAY_STATUSES.has(live.status))
                const periodEnd = liveEnd && liveEnd.getTime() > Date.now() ? liveEnd : localEnd
                const changeType = isCycleChange ? "cycle_change" : "upgrade"
                const deferredByPolicy = isCycleChange || cycle !== currentCycle

                if (!canUpdateInPlace) {
                    // Model B — a same-cycle TIER UPGRADE activates IMMEDIATELY:
                    // the replacement subscription starts now (Razorpay charges the
                    // first full cycle right after authorization), which on the
                    // verified charge flips the plan, resets the billing period to a
                    // fresh cycle, resets the usage counters (new higher limits from
                    // 0), and cancels the old mandate — all via the existing verified
                    // activation path. Cross-cycle switches and cycle changes stay
                    // DEFERRED to the current period end (avoids losing paid time on a
                    // cycle boundary and prevents a surprise double annual charge).
                    const immediate = isUpgrade && !deferredByPolicy

                    // A confirmed current period is only required for deferred changes,
                    // which must schedule at that boundary. Immediate upgrades start now.
                    if (!immediate && !periodEnd) {
                        return NextResponse.json({
                            error: "We could not confirm your current billing period. Please contact support before changing plans.",
                        }, { status: 409 })
                    }

                    const startAt = immediate
                        ? undefined
                        : Math.max(Math.floor(periodEnd!.getTime() / 1000), Math.floor(Date.now() / 1000) + 300)
                    const effectiveAtIso = immediate
                        ? new Date().toISOString()
                        : new Date((startAt as number) * 1000).toISOString()

                    const replacement = await createRazorpaySubscription(plan as PlanId, cycle, auth.user.id, targetCurrency, startAt)
                    const { data: claimed, error: pendingError } = await svc.from("subscriptions" as any).update({
                        pending_plan: plan,
                        pending_billing_cycle: cycle,
                        pending_provider_plan_id: targetPlanId,
                        pending_razorpay_subscription_id: replacement.id,
                        pending_change_type: changeType,
                        pending_effective_at: effectiveAtIso,
                        pending_previous_subscription_id: existingId,
                        provider_sync_required: false,
                        updated_at: new Date().toISOString(),
                    }).eq("user_id", auth.user.id)
                        .is("pending_change_type", null)
                        .select("user_id")
                        .maybeSingle()
                    if (pendingError || !claimed) {
                        const { cancelRazorpaySubscription } = await import("@/lib/razorpay")
                        await cancelRazorpaySubscription(replacement.id, false).catch(() => {})
                        return NextResponse.json({
                            error: pendingError ? "Failed to save the scheduled billing change" : "A billing change is already pending",
                            ...(!pendingError ? { code: "CHANGE_PENDING" } : {}),
                        }, { status: pendingError ? 500 : 409 })
                    }
                    await logAudit(auth.supabase, {
                        user_id: auth.user.id,
                        action: "payment.subscription_created",
                        metadata: { razorpay_subscription_id: replacement.id, plan, billing_cycle: cycle, start_at: startAt ?? "now", immediate, replacement_for: existingId } as any,
                    }, request).catch(() => {})
                    const amount = PLAN_PRICES_BY_CURRENCY[targetCurrency]?.[tier]?.[cycle]
                        ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]
                    return NextResponse.json({
                        subscriptionId: replacement.id,
                        keyId: await getSecret("RAZORPAY_KEY_ID"),
                        plan,
                        billingCycle: cycle,
                        planName: PLANS[plan as PlanId].name,
                        currency: targetCurrency,
                        amount,
                        reauthorizeUpgrade: true,
                        // Immediate upgrades are NOT a scheduled/deferred change.
                        scheduledChange: !immediate,
                        immediateUpgrade: immediate,
                        effectiveDate: effectiveAtIso,
                    })
                }

                const pendingPatch = {
                    pending_plan: plan,
                    pending_billing_cycle: cycle,
                    pending_provider_plan_id: targetPlanId,
                    // In-place updates remain bound through the current provider ID.
                    // Keeping the same ID in both current and pending columns violates
                    // the ownership invariant and adds no correlation value.
                    pending_razorpay_subscription_id: null,
                    pending_change_type: changeType,
                    pending_effective_at: deferredByPolicy ? periodEnd?.toISOString() ?? null : new Date().toISOString(),
                    provider_sync_required: true,
                    updated_at: new Date().toISOString(),
                }
                const { data: claimed, error: pendingError } = await svc.from("subscriptions" as any)
                    .update(pendingPatch)
                    .eq("user_id", auth.user.id)
                    .is("pending_change_type", null)
                    .select("user_id")
                    .maybeSingle()
                if (pendingError) return NextResponse.json({ error: "Failed to prepare the billing change" }, { status: 500 })
                if (!claimed) {
                    return NextResponse.json({ error: "A billing change is already pending", code: "CHANGE_PENDING" }, { status: 409 })
                }

                let deferred = deferredByPolicy
                let updated: Awaited<ReturnType<typeof updateRazorpaySubscriptionPlan>>
                const providerUpdateStartedAt = Date.now()
                try {
                    updated = await updateRazorpaySubscriptionPlan(existingId, targetPlanId, deferred ? "cycle_end" : "now")
                } catch (error) {
                    if (!deferred && isBelowMinimumChargeableAmountError(error)) {
                        deferred = true
                        updated = await updateRazorpaySubscriptionPlan(existingId, targetPlanId, "cycle_end")
                    } else {
                        await svc.from("subscriptions" as any).update({
                            pending_plan: null,
                            pending_billing_cycle: null,
                            pending_razorpay_subscription_id: null,
                            pending_change_type: null,
                            pending_effective_at: null,
                            provider_sync_required: false,
                            updated_at: new Date().toISOString(),
                        }).eq("user_id", auth.user.id)
                        throw error
                    }
                }

                let currentStart = updated.current_start
                let currentEnd = updated.current_end
                if (currentStart == null || currentEnd == null) {
                    const refetched = await getSubscription(existingId)
                    currentStart = refetched?.current_start ?? currentStart
                    currentEnd = refetched?.current_end ?? currentEnd
                }
                const effectiveDate = deferred
                    ? (periodEnd || (currentEnd ? new Date(currentEnd * 1000) : new Date()))
                    : new Date()

                if (deferred) {
                    const { error: savedError } = await svc.from("subscriptions" as any).update({
                        pending_effective_at: effectiveDate.toISOString(),
                        provider_sync_required: false,
                        updated_at: new Date().toISOString(),
                    }).eq("user_id", auth.user.id)
                    return NextResponse.json({
                        upgraded: true,
                        pending: Boolean(savedError),
                        plan: currentSub.plan,
                        targetPlan: plan,
                        billingCycle: currentCycle,
                        targetBillingCycle: cycle,
                        periodEnd: effectiveDate.toISOString(),
                        deferredToNextCycle: true,
                        message: savedError
                            ? "Razorpay scheduled the change; local confirmation is still syncing."
                            : "Your change is scheduled for the next billing cycle.",
                    }, { status: savedError ? 202 : 200 })
                }

                const verified = await getVerifiedSubscriptionCharge(
                    existingId,
                    undefined,
                    providerUpdateStartedAt,
                ).catch((error) => {
                    console.error("[create-order] immediate upgrade charge not yet verified:", error)
                    return null
                })
                if (!verified || verified.subscription.plan_id !== targetPlanId) {
                    return NextResponse.json({
                        upgraded: true,
                        pending: true,
                        plan: currentSub.plan,
                        targetPlan: plan,
                        billingCycle: currentCycle,
                        targetBillingCycle: cycle,
                        deferredToNextCycle: false,
                        chargePending: true,
                        message: "Razorpay accepted the plan update; paid access remains pending captured charge verification.",
                    }, { status: 202 })
                }

                const result = await applyRazorpaySubscriptionSnapshot(svc, verified.subscription, {
                    userId: auth.user.id,
                    eventType: "provider.immediate_update",
                    eventCreatedAt: new Date(),
                    charge: verified,
                })
                return NextResponse.json({
                    upgraded: true,
                    pending: !result.applied,
                    plan: result.applied ? result.plan : currentSub.plan,
                    targetPlan: plan,
                    billingCycle: result.applied ? result.billingCycle : currentCycle,
                    periodEnd: result.periodEnd,
                    deferredToNextCycle: false,
                    chargedAmount: result.chargedAmount,
                    chargedCurrency: verified.currency,
                    chargePending: false,
                    cleanupPending: result.cleanupPending,
                }, { status: result.applied ? 200 : 202 })
            }
        }

        const providerPlanId = getPlanIdForCurrency(tier, currency, cycle)
        if (!providerPlanId) return NextResponse.json({ error: "Invalid plan for subscription" }, { status: 400 })
        const subscription = await createRazorpaySubscription(plan as PlanId, cycle, auth.user.id, currency)
        const pendingState = {
            user_id: auth.user.id,
            plan: currentSub?.plan || "free",
            status: currentSub?.status || "active",
            pending_plan: plan,
            pending_billing_cycle: cycle,
            pending_provider_plan_id: providerPlanId,
            pending_razorpay_subscription_id: subscription.id,
            pending_change_type: "upgrade",
            pending_effective_at: null,
            pending_previous_subscription_id: existingId || null,
            provider_sync_required: false,
            updated_at: new Date().toISOString(),
        }
        const pendingResult = currentSub
            ? await svc.from("subscriptions" as any).update(pendingState)
                .eq("user_id", auth.user.id)
                .is("pending_change_type", null)
                .select("user_id")
                .maybeSingle()
            : await svc.from("subscriptions" as any).insert(pendingState)
                .select("user_id")
                .single()
        if (pendingResult.error || !pendingResult.data) {
            const { cancelRazorpaySubscription } = await import("@/lib/razorpay")
            await cancelRazorpaySubscription(subscription.id, false).catch(() => {})
            if (!pendingResult.error) {
                return NextResponse.json({ error: "A billing change is already pending", code: "CHANGE_PENDING" }, { status: 409 })
            }
            throw new Error("Failed to persist pending subscription ownership")
        }
        await logAudit(auth.supabase, {
            user_id: auth.user.id,
            action: "payment.subscription_created",
            metadata: { razorpay_subscription_id: subscription.id, plan, billing_cycle: cycle } as any,
        }, request).catch(() => {})
        const amount = PLAN_PRICES_BY_CURRENCY[currency]?.[tier]?.[cycle]
            ?? PLAN_PRICES_BY_CURRENCY.INR[tier][cycle]
        return NextResponse.json({
            subscriptionId: subscription.id,
            keyId: await getSecret("RAZORPAY_KEY_ID"),
            plan,
            billingCycle: cycle,
            planName: PLANS[plan as PlanId].name,
            currency,
            amount,
        })
    } catch (error) {
        console.error("Create subscription error:", error)
        return NextResponse.json({ error: "Failed to create subscription. Please try again." }, { status: 500 })
    }
}