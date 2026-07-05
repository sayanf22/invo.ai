# Bugfix Requirements Document

## Introduction

When a subscriber downgrades between two PAID plans (e.g. Pro → Starter, or Agency → Pro), Invo.ai schedules the downgrade in Supabase but never tells Razorpay to change the recurring subscription's `plan_id`. As a result, Razorpay keeps charging the OLD (higher) amount on the next renewal even though the user's account has moved to the lower plan — a direct financial/billing correctness bug. The mirror-image case is just as broken: when a subscriber with an active PAID subscription upgrades to a higher paid tier, the app always creates a brand-new Razorpay subscription and charges the new tier's full price immediately, while the OLD Razorpay subscription is left running untouched in the background — a double-billing risk, since that abandoned subscription will keep auto-renewing and charging the user again later on its own schedule. A third, related bug in the `check_subscription_expiry` Postgres RPC sets `status = 'past_due'` whenever a scheduled downgrade lands on anything other than `free`, which causes `resolveEffectiveTier()` to incorrectly treat a successfully-downgraded paid user as FREE tier once the period rolls over. The billing UI already shows a "plan will downgrade" banner while the downgrade is pending, but there is no confirmation notification once the downgrade actually completes.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user with an active PAID subscription (starter/pro/agency) requests a downgrade to a DIFFERENT PAID tier (e.g. Pro → Starter, Agency → Pro, Agency → Starter) THEN the system schedules `scheduled_downgrade` in Supabase but does NOT call Razorpay's Update Subscription API, so Razorpay continues charging the OLD plan's price on the next renewal cycle

1.2 WHEN a user with an active PAID subscription (starter/pro) requests an UPGRADE to a HIGHER paid tier (e.g. Pro → Agency) THEN the system's `subscribe()` → `POST /api/razorpay/create-order` → `createRazorpaySubscription()` flow ALWAYS creates a brand-new Razorpay subscription and charges the full new-tier price immediately, instead of updating the user's EXISTING Razorpay subscription; the OLD Razorpay subscription is never updated or cancelled and is left running unreferenced, so it will continue to auto-renew and charge the user again later on its own original schedule — a double-billing risk

1.3 WHEN the scheduled period expires and the Postgres `check_subscription_expiry` RPC applies a downgrade to any target plan OTHER than `free` (i.e. a paid→paid downgrade, such as Pro→Starter) THEN the system sets the subscription `status` to `past_due` instead of `active`

1.4 WHEN `resolveEffectiveTier()` (in `lib/cost-protection.ts`) reads a subscription whose `status` is `past_due` (as produced by 1.3) THEN the system treats the user as FREE tier, even though the user should be on the lower paid tier they downgraded to, causing an incorrect and more severe demotion than intended

1.5 WHEN a scheduled downgrade completes (whether to free or to another paid tier) THEN the system does not send the user any notification confirming the plan change took effect

### Expected Behavior (Correct)

2.1 WHEN a user with an active PAID subscription requests a downgrade to a DIFFERENT PAID tier THEN the system SHALL call Razorpay's Update Subscription API (`PATCH /v1/subscriptions/:id` with `plan_id` set to the new tier's plan and `schedule_change_at: "cycle_end"`) so Razorpay defers the plan/price change to the end of the current billing cycle and charges the NEW (lower) amount starting next cycle, with no proration ("there is no need for any amount adjustment with the customer")

2.2 WHEN a user with an active PAID subscription requests an UPGRADE to a HIGHER paid tier THEN the system SHALL call Razorpay's Update Subscription API (`PATCH /v1/subscriptions/:id` with `plan_id` set to the new tier's plan and `schedule_change_at: "now"`) on the user's EXISTING `razorpay_subscription_id`, letting Razorpay automatically calculate the prorated difference for the remaining days in the current cycle, generate an invoice, and charge the difference immediately — rather than creating a second, independent subscription. A FREE→PAID signup (no existing `razorpay_subscription_id`) SHALL CONTINUE TO create a new subscription via the existing create-order flow, since there is nothing to update

2.3 WHEN Razorpay's Update Subscription API rejects the immediate upgrade because the prorated difference is below the minimum chargeable amount (50 currency subunits, e.g. ₹0.50) THEN the system SHALL handle this gracefully — treating it as a successful no-op update (plan changed, no charge due) or falling back to `schedule_change_at: "cycle_end"` — rather than surfacing an error to the user

2.4 WHEN a user's existing Razorpay subscription is NOT in an updatable state (i.e. its status is `created`, `pending`, or `halted` rather than `authenticated` or `active`) THEN the system SHALL detect this and fall back to the existing create-new-subscription flow rather than calling the Update Subscription API, since Razorpay only permits updates on `authenticated`/`active` subscriptions

2.5 WHEN the scheduled period expires and the `check_subscription_expiry` RPC applies ANY successful downgrade (to `free` OR to another paid tier) THEN the system SHALL set the subscription `status` to `active` (never `past_due`), since a completed scheduled downgrade is not a payment failure

2.6 WHEN `resolveEffectiveTier()` reads a subscription that has just completed a paid→paid downgrade THEN the system SHALL resolve the effective tier to the NEW (downgraded-to) plan, not FREE

2.7 WHEN a scheduled downgrade completes THEN the system SHALL create a notification for the user confirming the plan change (e.g. "Your plan has changed to Starter"), following the existing `createNotification` pattern used for subscription activation

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user downgrades to `free` (cancellation) THEN the system SHALL CONTINUE TO call `cancelRazorpaySubscription()` to cancel the Razorpay recurring subscription at cycle end, exactly as it does today

3.2 WHEN a user downgrades to `free` THEN the system SHALL CONTINUE TO disable paid-only automations (recurring invoices, pending email reminders) immediately, exactly as it does today

3.3 WHEN a user requests an upgrade via `/api/razorpay/downgrade` (target plan is higher in the hierarchy than the current plan) THEN the system SHALL CONTINUE TO reject the request with "This is not a downgrade" from that endpoint, unaffected by this fix — upgrades continue to be handled exclusively via the `subscribe()` / `create-order` flow addressed by clause 2.2

3.4 WHEN a user has no active subscription THEN the system SHALL CONTINUE TO return "No active subscription" without attempting any Razorpay call

3.5 WHEN a subscription is not expired (period has not ended) THEN the `check_subscription_expiry` RPC SHALL CONTINUE TO return the current plan/status unchanged and SHALL CONTINUE TO leave `scheduled_downgrade` untouched

3.6 WHEN a subscription genuinely fails to renew with NO scheduled downgrade present THEN the `check_subscription_expiry` RPC SHALL CONTINUE TO mark the subscription `status` as `past_due`, exactly as it does today

3.7 WHEN the billing page renders a subscription with a pending `scheduled_downgrade` THEN the UI SHALL CONTINUE TO show the existing "Your plan will downgrade to X on [date]" banner and current-plan messaging, unaffected by this fix

3.8 WHEN a new subscription is activated (not a downgrade) THEN the system SHALL CONTINUE TO send the existing `subscription_activated` notification, unaffected by this fix

3.9 WHEN a user with NO existing paid subscription (free tier) signs up for a paid plan THEN the system SHALL CONTINUE TO create a new Razorpay subscription via `subscribe()` → `create-order` → `createRazorpaySubscription()` and activate it through the existing `POST /api/razorpay/verify` upsert and webhook flow, exactly as it does today — this fix only changes behavior when an EXISTING paid subscription is being upgraded to a higher tier

### Deriving the Bug Condition

**Bug Condition Function** — identifies the primary billing-correctness bug: a paid→paid PLAN CHANGE (either direction — downgrade or upgrade) being routed through the wrong Razorpay call. Downgrades are wrongly left un-propagated to Razorpay entirely; upgrades are wrongly routed through subscription-CREATION instead of subscription-UPDATE:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PlanChangeRequest
    // X.currentPlan, X.targetPlan ∈ {"free", "starter", "pro", "agency"}
    // X.hasExistingRazorpaySubscription: boolean
  OUTPUT: boolean

  RETURN X.currentPlan IN {"starter", "pro", "agency"}
         AND X.targetPlan IN {"starter", "pro", "agency"}
         AND X.currentPlan != X.targetPlan
         AND X.hasExistingRazorpaySubscription = TRUE
         // Covers BOTH:
         //  - Downgrade: planOrder(X.targetPlan) < planOrder(X.currentPlan)
         //    -> bug: no Razorpay update call is made at all
         //  - Upgrade:   planOrder(X.targetPlan) > planOrder(X.currentPlan)
         //    -> bug: routed through subscription-creation instead of
         //            subscription-update, leaving the old subscription
         //            running and unreferenced
END FUNCTION
```

**Property Specification** — defines correct behavior for buggy inputs:

```pascal
// Property: Fix Checking - Paid-to-Paid Plan Change Propagates to Razorpay via Update
FOR ALL X WHERE isBugCondition(X) DO
  result ← handlePlanChange'(X)
  IF planOrder(X.targetPlan) < planOrder(X.currentPlan) THEN
    // Downgrade
    ASSERT razorpaySubscriptionUpdateCalled(X.razorpaySubscriptionId, X.targetPlanId, "cycle_end")
    ASSERT result.scheduled_downgrade = X.targetPlan
    ASSERT NOT razorpaySubscriptionCreateCalled()
  ELSE
    // Upgrade
    ASSERT razorpaySubscriptionUpdateCalled(X.razorpaySubscriptionId, X.targetPlanId, "now")
    ASSERT result.razorpay_subscription_id = X.razorpaySubscriptionId  // SAME subscription, not a new one
    ASSERT NOT razorpaySubscriptionCreateCalled()
  END IF
END FOR
```

**Preservation Goal**:

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handlePlanChange(X) = handlePlanChange'(X)
  // Includes: free->paid signups (X.hasExistingRazorpaySubscription = FALSE),
  // paid->free cancellations, and no-op/unchanged-plan requests
END FOR
```
