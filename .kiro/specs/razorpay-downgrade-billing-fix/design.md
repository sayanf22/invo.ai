# Razorpay Downgrade Billing Fix - Bugfix Design

## Overview

Downgrading between two paid tiers (e.g. Pro → Starter) currently only touches the Supabase `subscriptions` row (`scheduled_downgrade`); it never calls Razorpay to change the recurring subscription's `plan_id`. Razorpay therefore keeps charging the OLD, higher price after the "downgrade" takes effect locally — a real financial bug. A second bug in the `check_subscription_expiry` Postgres RPC sets `status = 'past_due'` for any downgrade target other than `free`, which then causes `resolveEffectiveTier()` to demote a successfully-downgraded paid user all the way to FREE instead of their new (lower) paid tier.

A third, closely related billing-correctness bug affects the mirror-image case: when a subscriber with an active PAID subscription **upgrades** to a higher paid tier, `subscribe()` → `POST /api/razorpay/create-order` → `createRazorpaySubscription()` always creates a brand-new Razorpay subscription and charges the new tier's full price immediately, while the OLD Razorpay subscription is left running, unreferenced, and will keep auto-renewing and charging the user again on its own original schedule — a double-billing risk. This is the same class of defect as the downgrade bug (a paid→paid plan change that fails to route through Razorpay's Update Subscription API on the user's *existing* subscription), just manifesting in the opposite direction and through a different route (`create-order` instead of `downgrade`). Both are fixed together in this spec.

The fix has four parts:
1. Add `updateRazorpaySubscriptionPlan()` to `lib/razorpay.ts` and call it from `/api/razorpay/downgrade` whenever the downgrade is paid→paid, using Razorpay's `PATCH /v1/subscriptions/:id` with `schedule_change_at: "cycle_end"` so the price change is deferred to the next billing cycle with no manual proration.
2. Fix `check_subscription_expiry` so any successfully-applied downgrade (free or paid) sets `status = 'active'`, never `past_due`.
3. Add a downgrade-completion notification, and (optionally) handle the `subscription.updated` webhook to confirm the plan_id change server-side.
4. Extend `app/api/razorpay/create-order/route.ts` to detect an existing, updatable-state paid Razorpay subscription before defaulting to subscription creation, and call the SAME `updateRazorpaySubscriptionPlan()` helper (generalized to accept a `scheduleChangeAt` parameter) with `schedule_change_at: "now"` so the upgrade updates the existing subscription in place instead of creating a second one.

## Glossary

- **Bug_Condition (C)**: A paid→paid plan change request — either a downgrade request where both `currentPlan` and `targetPlan` are paid tiers (starter/pro/agency) and `targetPlan` is lower in the hierarchy than `currentPlan`, OR an upgrade request where the user has an existing paid Razorpay subscription and `targetPlan` is higher in the hierarchy than `currentPlan`. Explicitly NOT a downgrade-to-free and NOT a free→paid signup.
- **Property (P)**: For downgrades, the fixed downgrade handler SHALL call Razorpay's subscription update API with the new plan's `plan_id` and `schedule_change_at: "cycle_end"`, so Razorpay charges the new (lower) price starting next cycle. For upgrades, the fixed create-order handler SHALL call the SAME Razorpay update API on the user's EXISTING subscription with `schedule_change_at: "now"`, so Razorpay prorates and charges the difference immediately on the SAME subscription instead of creating a new one.
- **Preservation**: All downgrade-to-free behavior (Razorpay cancellation, automation cleanup), upgrade rejection from the `/downgrade` endpoint, free→paid signup behavior (create a new subscription), and "no subscription" handling must remain byte-for-byte identical.
- **`handleDowngrade` (F)**: The current `POST` handler body of `app/api/razorpay/downgrade/route.ts`.
- **`handleDowngrade'` (F')**: The fixed handler after this change.
- **`handleUpgrade` (F)**: The current `POST` handler body of `app/api/razorpay/create-order/route.ts` — today this function has no notion of "upgrade" at all; it unconditionally calls `createRazorpaySubscription()` regardless of whether the user already has an active paid subscription.
- **`handleUpgrade'` (F')**: The fixed `create-order` handler, which first checks for an existing updatable-state paid subscription and, if found, updates it in place instead of creating a new one.
- **`updateRazorpaySubscriptionPlan`**: Function in `lib/razorpay.ts` that calls Razorpay's Update Subscription API (`PATCH /v1/subscriptions/:id`). Takes a `scheduleChangeAt: "now" | "cycle_end"` parameter so the SAME function serves both the downgrade path (`"cycle_end"`, deferred, no proration) and the upgrade path (`"now"`, immediate, prorated) — this is a single, parameterized function rather than two separate ones, since both calls hit the identical Razorpay endpoint and differ only in that one field plus how the caller handles the response. Superseded name: earlier drafts of this design referred to this as `updateRazorpaySubscriptionPlanNow` for the immediate variant; this design consolidates both variants into one function and that name is not used in the implementation.
- **`check_subscription_expiry`**: Postgres RPC (SECURITY DEFINER, live in Supabase project `tdeqauhtobtahncglqwq`) that applies a scheduled downgrade once `current_period_end` has passed.
- **`resolveEffectiveTier`**: Function in `lib/cost-protection.ts` that maps a subscription row to the tier actually granted to the user; treats any status outside `{"active", "trialing"}` as FREE.
- **Updatable state**: A Razorpay subscription `status` of `authenticated` or `active`. Per Razorpay's docs, subscriptions in `created`, `pending`, or `halted` state cannot be updated via the Update Subscription API and must instead go through the existing create-new-subscription flow.
- **Minimum chargeable amount**: Razorpay's floor of 50 currency subunits (e.g. ₹0.50) for an immediate (`schedule_change_at: "now"`) prorated charge. An update where the computed difference is below this floor is rejected by Razorpay's API and must be handled without surfacing an error to the user.

## Bug Details

### Bug Condition

The bug manifests whenever `targetPlan` and the user's current `plan` are both members of `{"starter", "pro", "agency"}` and the two differ — regardless of direction:

- **Downgrade direction** (`targetPlan` lower in `planOrder`): in `app/api/razorpay/downgrade/route.ts`, the Razorpay-affecting branch is gated by `if (targetPlan === "free")` — so for any paid→paid downgrade, execution falls through to just returning success without ever touching Razorpay's `plan_id`.
- **Upgrade direction** (`targetPlan` higher in `planOrder`): in `app/api/razorpay/create-order/route.ts`, `createRazorpaySubscription()` is called unconditionally — there is no check for an existing paid `razorpay_subscription_id` before creating a brand-new subscription. The OLD subscription is never updated or cancelled; it is simply abandoned while still active in Razorpay, and will auto-renew and charge on its own original schedule, in addition to the new subscription's immediate charge.

Both are the same underlying defect — a paid→paid plan change that never reaches Razorpay's Update Subscription API on the user's EXISTING subscription — manifesting through two different, unconnected code paths (`/downgrade` and `/create-order`) that were each built without awareness of the other.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PlanChangeRequest {
    currentPlan, targetPlan: PlanId,
    razorpaySubscriptionId: string,
    hasExistingRazorpaySubscription: boolean
  }
  OUTPUT: boolean

  RETURN X.currentPlan IN {"starter", "pro", "agency"}
         AND X.targetPlan IN {"starter", "pro", "agency"}
         AND X.currentPlan != X.targetPlan
         AND X.hasExistingRazorpaySubscription = TRUE
         // planOrder(X.targetPlan) < planOrder(X.currentPlan) -> downgrade sub-case
         // planOrder(X.targetPlan) > planOrder(X.currentPlan) -> upgrade sub-case
END FUNCTION
```

### Examples

- **Pro → Starter (downgrade)**: User on Pro (₹1799/mo) calls `/api/razorpay/downgrade` with `targetPlan: "starter"`. Expected: Razorpay subscription's `plan_id` scheduled to change to Starter's plan_id at cycle end, so next renewal charges ₹649. Actual (buggy): only `scheduled_downgrade: "starter"` is written to Supabase; Razorpay still renews at ₹1799.
- **Agency → Pro (downgrade)**: Same defect — Razorpay keeps charging the Agency price (₹4999) even after the DB says the user is on Pro.
- **Agency → Starter (downgrade)**: Same defect, larger discrepancy (₹4999 charged vs. ₹649 expected).
- **Pro → Agency (upgrade)**: User on Pro (₹1799/mo, existing `razorpay_subscription_id: sub_ABC`) calls `subscribe("agency", ...)`. Expected: `PATCH /v1/subscriptions/sub_ABC` with `plan_id` = Agency's plan_id and `schedule_change_at: "now"`, Razorpay prorates and charges the difference immediately on `sub_ABC`, and Supabase's row is updated in place (same `razorpay_subscription_id`). Actual (buggy): a brand-new `sub_XYZ` is created and charged the FULL Agency price immediately; `sub_ABC` is left active and unreferenced, and will renew and charge the FULL Pro price again on its own original schedule — the user is billed twice, once via each subscription.
- **Starter → Pro (upgrade)**: Same defect — a second subscription is created instead of updating the existing one.
- **Pro → Free (unaffected)**: `targetPlan === "free"` already correctly calls `cancelRazorpaySubscription()`. This path must be preserved exactly.
- **Free → Starter (unaffected, upgrade sub-case but NOT bug condition)**: User has no existing `razorpay_subscription_id` (`hasExistingRazorpaySubscription = FALSE`). There is no existing subscription to update, so creating a new one via `createRazorpaySubscription()` is already correct and must continue exactly as today.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Downgrade-to-free: Razorpay cancellation via `cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)`, local `cancelled_at` stamp, and recurring-invoice/email-schedule cleanup.
- Upgrade rejection FROM THE `/downgrade` ENDPOINT: `targetIdx >= currentIdx` still returns 400 "This is not a downgrade" — this endpoint continues to only ever handle downgrades; upgrades are handled exclusively via `create-order`.
- "No active subscription" 400 response when `sub` is missing.
- The `scheduled_downgrade` column write (via service-role client, bypassing the free-only RLS policy) for ALL downgrade targets, including paid→paid.
- The response shape: `{ success, message, effectiveDate }` from `/downgrade`.
- Billing page UI: the existing "Your plan will downgrade to X on [date]" banner (lines ~417-423) and current-plan-card renewal/downgrade messaging (lines ~265-271), both driven by `data?.subscription?.scheduled_downgrade`.
- `check_subscription_expiry` behavior when the period has NOT expired (returns current plan/status untouched, `scheduled_downgrade` left as-is).
- `check_subscription_expiry` behavior when a genuine payment failure occurs with no `scheduled_downgrade` set (still sets `status = 'past_due'`).
- The `subscription_activated` notification sent on first activation via the webhook.
- **Free→paid signups**: a user with NO existing `subscriptions` row (or no `razorpay_subscription_id`) requesting any paid plan via `subscribe()` → `create-order` SHALL CONTINUE TO call `createRazorpaySubscription()` and open Checkout exactly as today — there is nothing to update in this case, so the new "check for existing subscription" branch must be a no-op for these users.
- **Non-updatable-state fallback**: if a user DOES have an existing `razorpay_subscription_id` but its Razorpay-side `status` is `created`, `pending`, or `halted` (not `authenticated`/`active`), the create-order route SHALL fall back to the existing create-new-subscription + Checkout + verify flow, unchanged, rather than attempting an update Razorpay would reject.
- The `/api/razorpay/verify` upsert logic and webhook activation flow for newly-CREATED subscriptions (free→paid, or upgrades falling back to creation) remain untouched.

**Scope:**
All inputs that do NOT involve a paid→paid plan change (downgrade OR upgrade) with an existing, updatable-state Razorpay subscription should be completely unaffected by this fix. This includes:
- Downgrade requests where `targetPlan === "free"`
- Upgrade requests rejected by the `/downgrade` endpoint (wrong endpoint for that intent)
- Free→paid signups (no existing `razorpay_subscription_id`)
- Upgrade requests where the existing subscription is in a non-updatable Razorpay state (fall back to creation)
- Requests from users with no subscription
- `check_subscription_expiry` calls where the period hasn't expired, or where no downgrade is scheduled

## Hypothesized Root Cause

1. **Missing Razorpay API call for paid→paid downgrades**: `app/api/razorpay/downgrade/route.ts` only invokes `cancelRazorpaySubscription()` inside `if (targetPlan === "free")`. There is no corresponding branch that calls a Razorpay "update subscription plan" API for downgrades that stay within paid tiers, so Razorpay's `plan_id` (and thus the amount it charges on renewal) never changes.

2. **No `updateRazorpaySubscriptionPlan` helper exists**: `lib/razorpay.ts` has `cancelRazorpaySubscription` and `createRazorpaySubscription` but no function that calls `PATCH /v1/subscriptions/:id` to change `plan_id` with `schedule_change_at: "cycle_end"`. The capability simply hasn't been built.

3. **`check_subscription_expiry` RPC hardcodes `status` by free-vs-not**: The `CASE WHEN v_sub.scheduled_downgrade = 'free' THEN 'active' ELSE 'past_due' END` line conflates "downgraded away from free-eligibility" with "payment failed." Any non-free downgrade target is incorrectly treated as a billing failure.

4. **`resolveEffectiveTier` has no special case for a just-completed downgrade**: It correctly treats non-`active`/`trialing` status as FREE by design (for genuine `past_due` cases), but because bug #3 wrongly sets `past_due` on successful paid→paid downgrades, this correct-by-itself logic amplifies bug #3 into a full demotion to FREE.

5. **No downgrade-completion notification path**: `webhook/route.ts` sends `subscription_activated` on first activation but nothing calls `createNotification` when a `scheduled_downgrade` is consumed by `check_subscription_expiry` — there is no code path watching for that transition today (it only happens lazily inside the RPC, which has no side channel to trigger a notification insert). This needs an explicit call site, most naturally where the app next observes the RPC result (e.g. the route/hook that invokes `check_subscription_expiry`).

6. **`create-order` route has no existing-subscription check at all**: `app/api/razorpay/create-order/route.ts` reads `plan` and `billingCycle` from the request body and immediately calls `createRazorpaySubscription()` — it never queries the `subscriptions` table for the calling user, and `createRazorpaySubscription()` itself has no parameter for "subscription to update instead." The route was written purely for the free→paid signup case and was never revisited when upgrade-from-paid became possible, so every upgrade is silently treated as a brand-new signup. This is the upgrade-side mirror of root cause #1 above (missing Razorpay call for downgrades) — in this case the missing logic is "check for and update an existing subscription" rather than "call update at all," but the structural gap (nobody ever calls Razorpay's Update Subscription API) is identical.

## Correctness Properties

Property 1: Bug Condition - Paid-to-Paid Downgrade Must Update Razorpay Plan

_For any_ downgrade request where both the current plan and the target plan are paid tiers (starter/pro/agency) and the target is lower than the current plan, the fixed `/api/razorpay/downgrade` handler SHALL call Razorpay's Update Subscription API (`plan_id` = target tier's Razorpay plan_id for the subscription's currency/cycle, `schedule_change_at: "cycle_end"`) in addition to writing `scheduled_downgrade` to Supabase, so that Razorpay charges the new (lower) amount starting the next billing cycle.

**Validates: Requirements 2.1**

Property 2: Preservation - Downgrade-to-Free and Non-Downgrade Paths Unaffected (via `/downgrade` endpoint)

_For any_ input to the `/api/razorpay/downgrade` endpoint where the bug condition does NOT hold (downgrade-to-free, upgrade attempts sent to this endpoint, missing subscription), the fixed function SHALL produce the same result as the original function: downgrade-to-free still calls `cancelRazorpaySubscription` and disables automations, upgrade requests sent to `/downgrade` are still rejected with "This is not a downgrade" (upgrades are handled exclusively via `create-order`, see Properties 5 and 6), and missing-subscription requests still return "No active subscription" — with no new Razorpay "update plan" call made in any of these cases.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 3: Bug Condition - Downgrade Completion Never Sets past_due

_For any_ subscription whose `current_period_end` has passed and which has a non-null `scheduled_downgrade` (whether `"free"` or a paid tier), the fixed `check_subscription_expiry` RPC SHALL set `status = 'active'` (never `'past_due'`), and SHALL set `plan` to the scheduled target, so that `resolveEffectiveTier` subsequently resolves the user to that new plan rather than FREE.

**Validates: Requirements 2.5, 2.6**

Property 4: Preservation - Genuine Payment Failure Still Marked past_due

_For any_ subscription whose `current_period_end` has passed and which has NO `scheduled_downgrade` set, the fixed `check_subscription_expiry` RPC SHALL still set `status = 'past_due'`, exactly as the original function does, and subscriptions whose period has NOT expired SHALL be returned unchanged with `scheduled_downgrade` left intact.

**Validates: Requirements 3.5, 3.6**

Property 5: Bug Condition - Paid Upgrade Must Update Existing Razorpay Subscription, Not Create a New One

_For any_ upgrade request where the user has an existing paid subscription (`razorpay_subscription_id` set) whose Razorpay-side status is `authenticated` or `active`, and the requested `targetPlan` is higher in the plan hierarchy than the current plan, the fixed `create-order` handler SHALL call Razorpay's Update Subscription API (`plan_id` = target tier's Razorpay plan_id for the subscription's currency/cycle, `schedule_change_at: "now"`) on the SAME `razorpay_subscription_id`, and SHALL update the Supabase `subscriptions` row's `plan`, `current_period_start`, and `current_period_end` to reflect the immediate change — rather than calling `createRazorpaySubscription()` to create a second, independent subscription.

**Validates: Requirements 1.2, 2.2**

Property 6: Preservation - Free-to-Paid Signups and Non-Updatable-State Fallback Unaffected

_For any_ input where the upgrade bug condition does NOT hold — either because the user has no existing `razorpay_subscription_id` (free→paid signup) or because their existing subscription's Razorpay-side status is NOT `authenticated`/`active` (i.e. `created`, `pending`, or `halted`) — the fixed `create-order` handler SHALL produce the same result as the original function: call `createRazorpaySubscription()` and proceed through the existing Checkout + `/verify` activation flow unchanged, with no call made to the Update Subscription API.

**Validates: Requirements 2.3, 2.4, 3.9**

## Fix Implementation

### Changes Required

**File**: `lib/razorpay.ts`

**Function (new)**: `updateRazorpaySubscriptionPlan`

1. **Add `updateRazorpaySubscriptionPlan(subscriptionId, newPlanId, scheduleChangeAt: "now" | "cycle_end" = "cycle_end")`**: Calls `PATCH https://api.razorpay.com/v1/subscriptions/:id` with body `{ plan_id: newPlanId, schedule_change_at: scheduleChangeAt }`, using the same `getSecret("RAZORPAY_KEY_ID"/"RAZORPAY_KEY_SECRET")` + Basic auth + `AbortSignal.timeout(10000)` pattern as `cancelRazorpaySubscription`. Returns the updated subscription entity; throws on a non-idempotent API error. The `scheduleChangeAt` parameter is defined here from the start (defaulting to `"cycle_end"` so the downgrade route below needs no change to its call site) rather than being bolted on later — see change #7 for the `"now"` variant's additional error-handling and period-refresh needs when called from the upgrade path.

**File**: `app/api/razorpay/downgrade/route.ts`

**Function**: `POST` handler

2. **Add a paid→paid branch**: After the existing `scheduled_downgrade` write and alongside the existing `if (targetPlan === "free") { ... }` block, add an `else if` branch for when `targetPlan !== "free"` (i.e. still paid→paid, since the upgrade case was already rejected above) that:
   - Resolves the target Razorpay `plan_id` via `getPlanIdForCurrency(targetPlan, currentSub.currency, currentSub.billing_cycle)` (reusing the existing currency/cycle already stored on the subscription — no new user input).
   - Calls `updateRazorpaySubscriptionPlan(currentSub.razorpay_subscription_id, targetPlanId)`.
   - Wraps the call in try/catch, logging non-fatally on failure (consistent with the existing cancellation call's non-fatal error handling), since `scheduled_downgrade` in Supabase is already the source of truth for the UI and the RPC.

3. **Preserve existing free-downgrade branch untouched**: The `if (targetPlan === "free") { ... }` block (Razorpay cancel + automation cleanup) stays exactly as-is.

**File**: New Supabase migration (e.g. `supabase/migrations/fix_downgrade_status_past_due.sql`)

**Function**: `check_subscription_expiry`

4. **Fix the status assignment**: Replace `status = CASE WHEN v_sub.scheduled_downgrade = 'free' THEN 'active' ELSE 'past_due' END` with `status = 'active'` unconditionally inside the "scheduled downgrade applies" branch (both the `UPDATE` and the `RETURN QUERY`). The unrelated "no downgrade scheduled, mark past_due" branch is untouched.

**File**: `app/api/razorpay/webhook/route.ts` (optional, per bug context item 5)

5. **Add `subscription.updated` case**: Log the event and optionally verify/sync `amount_paid`/`plan`/`currency` from the authoritative `subscription.entity.plan_id` using the existing `planIdToPlan`/`planIdToAmount`/`planIdToCurrency` helpers, mirroring the pattern already used in the `subscription.activated`/`subscription.charged` case. This is a defensive sync, not required for the core fix to be correct.

**File**: notification call site for downgrade completion (e.g. wherever `check_subscription_expiry` is invoked from the app, such as a billing status API route or hook)

6. **Add downgrade-completion notification**: When `check_subscription_expiry` reports `is_expired = true` and the returned `plan` differs from the plan the caller had cached (i.e. a downgrade just applied), call `createNotification` with a new type (e.g. `"subscription_downgrade_completed"`) and a message such as `"Your plan has changed to {PLAN_NAMES[plan]}."`, following the exact pattern used in `app/api/razorpay/verify/route.ts` (`createNotification(auth.supabase, { user_id, type, title, message, metadata })`). The `notifications.type` column is plain `text` with no CHECK constraint (confirmed live), so adding a new type string requires no migration.

**File**: `lib/razorpay.ts`

**Function**: `updateRazorpaySubscriptionPlan` (same function defined in change #1 above — shared by both the downgrade and upgrade fixes, not duplicated)

7. **Upgrade-specific handling around the `"now"` call**: This is the ONE function used by both the downgrade route (`"cycle_end"`) and the create-order upgrade path (`"now"`) — there is no separate `updateRazorpaySubscriptionPlanNow` function. When called with `"now"`, the caller (create-order route) must additionally:
   - Catch the specific Razorpay error for "amount less than minimum" (per Razorpay docs, prorated difference under 50 currency subunits) and treat it as a successful no-op — the plan_id has still changed on Razorpay's side even though no charge was raised — OR retry the same call with `schedule_change_at: "cycle_end"` as a fallback. Either behavior satisfies requirement 2.3; the implementation SHOULD pick the no-op-success treatment since it's simpler and Razorpay confirms the plan change already took effect.
   - On success, read `current_start`/`current_end` from the PATCH response (or call `getSubscription()` again if the response doesn't immediately reflect them) to get the accurate new period boundaries, since an immediate mid-cycle upgrade does NOT reset to a fresh full billing cycle the way a brand-new subscription would.

**File**: `app/api/razorpay/create-order/route.ts`

**Function**: `POST` handler (renamed conceptually to `handleUpgrade'` for the upgrade branch; free→paid signups fall through the existing unchanged path)

8. **Add an existing-subscription check before creating**: At the top of the handler, after validating `plan`/`billingCycle`, use the authenticated Supabase client to look up the caller's `subscriptions` row (`SELECT * FROM subscriptions WHERE user_id = auth.user.id`, read-own is already RLS-permitted — no service-role client needed for this read).
9. **Branch on existing-subscription state**:
   - If NO row exists, or the row has no `razorpay_subscription_id` → fall through unchanged to the existing `createRazorpaySubscription()` + Checkout response (free→paid signup, Requirement 3.9).
   - If a row exists WITH a `razorpay_subscription_id`, call `getSubscription(currentSub.razorpay_subscription_id)` (already exists in `lib/razorpay.ts`) to fetch the live Razorpay-side `status`.
     - If `status` is NOT `authenticated`/`active` → fall through unchanged to the existing create-new-subscription flow (Requirement 2.4).
     - If `status` IS `authenticated`/`active` AND `plan !== currentSub.plan` (an actual upgrade, not a no-op re-subscribe) → resolve the target Razorpay `plan_id` via `getPlanIdForCurrency(plan, currentSub.currency, cycle)`, call `updateRazorpaySubscriptionPlan(currentSub.razorpay_subscription_id, targetPlanId, "now")`, then update the Supabase `subscriptions` row directly (service-role client, same free-only-RLS reason as `/downgrade` and `/verify`) with the new `plan`, `billing_cycle`, `amount_paid`, and the `current_period_start`/`current_period_end` obtained per change #7 above. Return a response shape distinguishing this "updated in place" case from the "new subscription, open Checkout" case (e.g. `{ upgraded: true, plan, billingCycle, periodEnd }` vs. the existing `{ subscriptionId, keyId, plan, ... }`), since per Razorpay's docs an in-place plan update with sufficient existing authorization does NOT require the customer to re-enter payment details or reopen Checkout — the client (`hooks/use-razorpay.ts`) SHALL be updated to detect this response shape and skip opening Razorpay Checkout, calling `onSuccess` directly instead.
10. **Preserve the free→paid and non-updatable-state paths untouched**: Both fall-through branches in #9 above hit the EXACT same `createRazorpaySubscription()` call, response shape, and downstream Checkout/`verify` flow that exists today — no new parameters, no behavior change.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause: no Razorpay update call is made for paid→paid downgrades.

**Test Plan**: Write a test that calls the `/api/razorpay/downgrade` handler logic (or a unit-testable extraction of it) with a mocked Razorpay client, for a Pro→Starter downgrade, and asserts that a "subscription update/plan change" call was made. Run on UNFIXED code — it will fail because no such call exists at all (the mock records zero calls to any update/patch endpoint).

**Test Cases**:
1. **Pro → Starter**: Assert Razorpay update-subscription call made with Starter's plan_id and `schedule_change_at: "cycle_end"` (will fail — no call made on unfixed code)
2. **Agency → Pro**: Same assertion for Agency→Pro (will fail on unfixed code)
3. **Agency → Starter**: Same assertion for Agency→Starter (will fail on unfixed code)
4. **RPC status test**: Simulate an expired subscription with `scheduled_downgrade = 'starter'` and assert the RPC result `status = 'active'` (will fail on unfixed code — returns `'past_due'`)
5. **Pro → Agency (upgrade)**: Mock a user with existing `razorpay_subscription_id: sub_ABC` and Razorpay status `active`, call `create-order` with `plan: "agency"`, and assert Razorpay's update-subscription mock was called with `sub_ABC`, Agency's plan_id, and `schedule_change_at: "now"`. Assert `createRazorpaySubscription`/`POST /v1/subscriptions` was NOT called (will fail on unfixed code — the create call IS made and the update call is never made)
6. **Starter → Pro (upgrade)**: Same assertion for Starter→Pro (will fail on unfixed code)

**Expected Counterexamples**:
- Zero calls recorded to any Razorpay subscription-update mock for paid→paid downgrades
- `check_subscription_expiry('<user with scheduled paid downgrade>')` returns `status = 'past_due'` instead of `'active'`
- For paid→paid upgrades: zero calls recorded to any Razorpay subscription-update mock, and exactly one call recorded to the subscription-CREATE mock — confirming the root cause that `create-order` always creates rather than ever updating

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) AND isDowngrade(X) DO
  result := handleDowngrade'(X)
  ASSERT razorpayUpdateCalledWith(X.razorpaySubscriptionId, targetPlanId(X), "cycle_end")
  ASSERT result.scheduled_downgrade = X.targetPlan
END FOR

FOR ALL S WHERE expired(S) AND S.scheduled_downgrade IS NOT NULL DO
  result := check_subscription_expiry'(S)
  ASSERT result.status = 'active'
END FOR

FOR ALL X WHERE isBugCondition(X) AND isUpgrade(X) AND updatableState(X) DO
  result := handleUpgrade'(X)
  ASSERT razorpayUpdateCalledWith(X.razorpaySubscriptionId, targetPlanId(X), "now")
  ASSERT result.razorpay_subscription_id = X.razorpaySubscriptionId  // same subscription
  ASSERT NOT razorpaySubscriptionCreateCalled()
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleDowngrade(X) = handleDowngrade'(X)
  ASSERT handleUpgrade(X) = handleUpgrade'(X)
END FOR

FOR ALL S WHERE NOT (expired(S) AND S.scheduled_downgrade IS NOT NULL) DO
  ASSERT check_subscription_expiry(S) = check_subscription_expiry'(S)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of `currentPlan`/`targetPlan`/subscription state automatically
- It catches edge cases like "no subscription", "already free", "same-plan request" that manual unit tests might miss
- It provides strong guarantees that the free-downgrade and upgrade-rejection paths are never altered

**Test Plan**: Observe behavior on UNFIXED code first for downgrade-to-free (confirms `cancelRazorpaySubscription` + automation cleanup fire) and for upgrade attempts (confirms 400 rejection), then write property-based tests capturing that observed behavior so the fix cannot regress them.

**Test Cases**:
1. **Downgrade-to-free preservation**: Observe on unfixed code that `targetPlan: "free"` calls `cancelRazorpaySubscription` and disables `recurring_invoices`/`email_schedules`; assert this is unchanged after the fix, and that NO call is made to `updateRazorpaySubscriptionPlan` for this case.
2. **Upgrade rejection preservation (`/downgrade` endpoint)**: Observe on unfixed code that any `targetIdx >= currentIdx` request to `/api/razorpay/downgrade` returns 400 "This is not a downgrade"; assert unchanged after the fix.
3. **No-subscription preservation**: Observe on unfixed code that a user with no `subscriptions` row gets 400 "No active subscription"; assert unchanged after the fix.
4. **RPC non-expired preservation**: Observe on unfixed code that a non-expired subscription is returned as-is with `scheduled_downgrade` intact; assert unchanged after the fix.
5. **RPC genuine-failure preservation**: Observe on unfixed code that an expired subscription with no `scheduled_downgrade` gets `status = 'past_due'`; assert unchanged after the fix.
6. **Free→paid signup preservation**: Observe on unfixed code that a user with no existing `subscriptions` row (or no `razorpay_subscription_id`) calling `create-order` for any paid plan results in exactly one call to `createRazorpaySubscription()` and a `{ subscriptionId, keyId, ... }` response; assert unchanged after the fix, and that NO call is made to `updateRazorpaySubscriptionPlan` for this case.
7. **Non-updatable-state fallback preservation**: Observe on unfixed code (there's no update logic yet, so this is really "observe the intended baseline behavior to lock in") that a user whose existing Razorpay subscription status is `created`/`pending`/`halted` still gets the create-new-subscription flow; assert this fallback is present after the fix and that NO call is made to `updateRazorpaySubscriptionPlan` for this case.

### Unit Tests

- `updateRazorpaySubscriptionPlan` sends the correct `PATCH` body (`plan_id`, `schedule_change_at`) and auth header for BOTH `"cycle_end"` and `"now"` variants
- Downgrade route calls `updateRazorpaySubscriptionPlan` only for paid→paid targets, never for free or upgrade requests
- Downgrade route's paid→paid Razorpay call failure is non-fatal (still returns success, since `scheduled_downgrade` already persisted)
- Migration correctly updates `check_subscription_expiry` behavior for both free and paid scheduled downgrades
- Create-order route calls `updateRazorpaySubscriptionPlan(..., "now")` only when an existing subscription is present AND in an updatable state AND the target plan differs from the current plan
- Create-order route falls back to `createRazorpaySubscription()` when no existing subscription, or when the existing subscription is not in an updatable state
- Create-order route handles the "amount below minimum chargeable" Razorpay error gracefully (no-op success, not a 500) when calling with `schedule_change_at: "now"`
- Create-order route reads/refetches `current_start`/`current_end` after an immediate update and writes them to Supabase's `current_period_start`/`current_period_end` (not a naive "add one cycle" computation)

### Property-Based Tests

- Generate random `(currentPlan, targetPlan)` pairs across `{free, starter, pro, agency}` and verify: Razorpay update-plan is called if and only if `isBugCondition` holds; Razorpay cancel is called if and only if `targetPlan === "free"` and it's a valid downgrade; no downgrade call happens for upgrades or same-plan requests.
- Generate random subscription states (expired/not expired × scheduled_downgrade present/absent × target free/paid) and verify `check_subscription_expiry` status output matches the corrected truth table (`active` for any completed downgrade, `past_due` only for genuine unscheduled expiry, unchanged when not expired).
- Generate random `(currentPlan, targetPlan, hasExistingSubscription, razorpayStatus)` combinations for the upgrade path and verify: `updateRazorpaySubscriptionPlan(..., "now")` is called if and only if `hasExistingSubscription = true` AND `razorpayStatus IN {"authenticated","active"}` AND `targetPlan != currentPlan`; `createRazorpaySubscription()` is called in every other case (including all free→paid cases and all non-updatable-state cases); the two calls are NEVER both made for the same request.

### Integration Tests

- Full downgrade flow: request Pro→Starter downgrade → verify Supabase row has `scheduled_downgrade = "starter"` → verify mocked Razorpay received the plan-update call → simulate period expiry → verify RPC output has `plan = "starter"`, `status = "active"` → verify `resolveEffectiveTier` now returns `"starter"` (not `"free"`).
- Full cancellation flow (regression check): request downgrade to free → verify Razorpay cancel called → verify automations disabled → simulate period expiry → verify RPC output has `plan = "free"`, `status = "active"`.
- Notification flow: simulate a completed paid→paid downgrade and verify a `subscription_downgrade_completed` notification is created with the correct plan name.
- Full upgrade flow: request Pro→Agency upgrade with an existing `active` Razorpay subscription → verify Razorpay received the update-subscription call with `schedule_change_at: "now"` on the SAME `razorpay_subscription_id` → verify NO new Razorpay subscription-create call was made → verify Supabase row's `plan` becomes `"agency"` while `razorpay_subscription_id` stays unchanged → verify `current_period_start`/`current_period_end` reflect the immediate-update response, not a naive fresh-cycle calculation.
- Full free→paid signup flow (regression check): a user with no subscription requests any paid plan → verify `createRazorpaySubscription()` is called → verify Checkout + `/verify` activation proceeds exactly as before this fix.
- Non-updatable-state fallback flow: a user with an existing subscription in `created` status requests an upgrade → verify the route falls back to `createRazorpaySubscription()` rather than attempting (and failing) an update call.
