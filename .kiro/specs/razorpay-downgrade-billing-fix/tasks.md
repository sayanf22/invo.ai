# Implementation Plan: Razorpay Downgrade Billing Fix

## Overview

This plan fixes three related bugs: (1) paid→paid subscription downgrades never call Razorpay's Update Subscription API, so Razorpay keeps charging the old price, (2) the `check_subscription_expiry` Postgres RPC marks any non-free scheduled downgrade as `past_due`, which incorrectly demotes the user to FREE tier via `resolveEffectiveTier`, and (3) paid→paid subscription upgrades always create a brand-new Razorpay subscription instead of updating the user's existing one, leaving the old subscription running unreferenced and creating a double-billing risk. Exploration and preservation tests are written first (Tasks 1-6) to confirm all three bugs and capture baseline behavior to protect, followed by the fix itself (Task 7) and a final validation checkpoint (Task 8).

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Paid-to-Paid Downgrade Must Update Razorpay Plan
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate Razorpay's `plan_id` is never updated on a paid→paid downgrade
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: (Pro→Starter), (Agency→Pro), (Agency→Starter), since this is a deterministic code-path bug (a specific `if` branch is simply missing), not a data-dependent one
  - Mock the Razorpay HTTP layer (or `updateRazorpaySubscriptionPlan`/fetch) and call the `/api/razorpay/downgrade` POST handler (or its extracted core logic) for each of the 3 scoped cases from `isBugCondition` in design
  - Assert that a Razorpay "update subscription plan" call was made with `plan_id` = target tier's plan_id and `schedule_change_at: "cycle_end"` (per Property 1/Expected Behavior 2.1 in design)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves no Razorpay update call is ever made for paid→paid downgrades)
  - Document counterexamples found (e.g. "downgrade(Pro→Starter) made 0 calls to the subscription-update mock; only `cancelRazorpaySubscription` gets called, and only when targetPlan==='free'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Downgrade-to-Free and Non-Downgrade Paths Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: downgrade-to-free (`targetPlan: "free"`) calls `cancelRazorpaySubscription(currentSub.razorpay_subscription_id, true)` and disables `recurring_invoices`/`email_schedules`, and makes NO call to any subscription-plan-update endpoint
  - Observe on UNFIXED code: an upgrade request (`targetIdx >= currentIdx`) returns 400 `{ error: "This is not a downgrade" }` without touching Razorpay or Supabase
  - Observe on UNFIXED code: a user with no `subscriptions` row returns 400 `{ error: "No active subscription" }`
  - Write a property-based test generating random `(currentPlan, targetPlan)` pairs across `{free, starter, pro, agency}` (plus a "no subscription" case) asserting: a Razorpay plan-update call happens if and only if `isBugCondition(X)` holds; `cancelRazorpaySubscription` is called if and only if it's a valid downgrade to `"free"`; upgrades/same-plan always return the "not a downgrade" 400; missing-subscription always returns the "no active subscription" 400 (from Preservation Requirements in design)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve — on unfixed code there is never a plan-update call for ANY input, which is consistent with "not isBugCondition ⇒ no call" but also happens to hold for isBugCondition inputs today; task 1 already captured that gap separately)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Write RPC bug condition exploration test
  - **Property 1: Bug Condition** - Downgrade Completion Never Sets past_due
  - **CRITICAL**: This test MUST FAIL on unfixed code (the live `check_subscription_expiry` RPC in Supabase project `tdeqauhtobtahncglqwq`) - failure confirms the bug exists
  - **DO NOT modify the RPC when it fails**
  - **GOAL**: Surface the counterexample that a paid→paid scheduled downgrade sets `status = 'past_due'` instead of `'active'`
  - **Scoped PBT Approach**: Scope to concrete cases: `scheduled_downgrade IN {"starter", "pro"}` with an expired `current_period_end`, using `mcp_supabase_execute_sql` against a disposable/branch row (never a real user's row) or a local Postgres test harness
  - Call `SELECT * FROM check_subscription_expiry(<test_user_id>)` for a seeded subscription with `plan='pro'`, `scheduled_downgrade='starter'`, `current_period_end` in the past
  - Assert `status = 'active'` (per Property 3/Expected Behavior 2.2 in design)
  - Run against UNFIXED (current live) RPC
  - **EXPECTED OUTCOME**: Test FAILS — RPC returns `status = 'past_due'`
  - Document the counterexample (e.g. "check_subscription_expiry(pro→starter, expired) returned status='past_due', plan='starter'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.4_

- [x] 4. Write RPC preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Genuine Payment Failure Still Marked past_due
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on the UNFIXED (current live) RPC: a non-expired subscription is returned unchanged with `scheduled_downgrade` intact and no row mutation
  - Observe on the UNFIXED RPC: an expired subscription with `scheduled_downgrade IS NULL` and `status='active'` transitions to `status='past_due'`
  - Observe on the UNFIXED RPC: an expired subscription with `scheduled_downgrade='free'` transitions to `status='active'`, `plan='free'` (already correct today — must not regress)
  - Write a property-based test generating random subscription states (expired/not-expired × scheduled_downgrade ∈ {null, "free", "starter", "pro", "agency"} × current status) asserting the RPC output matches these observed rules for every state where the bug condition does NOT hold (from Preservation Requirements in design)
  - Run tests against the UNFIXED RPC using `mcp_supabase_execute_sql` on disposable test rows only
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on the unfixed RPC
  - _Requirements: 3.5, 3.6_

- [x] 5. Write upgrade bug condition exploration test
  - **Property 5: Bug Condition** - Paid Upgrade Must Update Existing Razorpay Subscription, Not Create a New One
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `create-order` always creates a brand-new Razorpay subscription instead of updating the user's existing one on upgrade
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: (Pro→Agency), (Starter→Pro), since this is a deterministic code-path bug (no existing-subscription check exists at all in `create-order`), not a data-dependent one
  - Mock a user with an existing `razorpay_subscription_id` (e.g. `sub_ABC`) and a mocked `getSubscription()` returning Razorpay status `"active"`
  - Mock the Razorpay HTTP layer (or `updateRazorpaySubscriptionPlan`/`createRazorpaySubscription`/fetch) and call the `/api/razorpay/create-order` POST handler (or its extracted core logic) with an upgrade target plan for each of the 2 scoped cases from `isBugCondition` in design
  - Assert that a Razorpay "update subscription" call was made with `plan_id` = target tier's plan_id and `schedule_change_at: "now"` on the SAME `sub_ABC` (per Property 5/Expected Behavior 2.2 in design)
  - Assert that NO Razorpay subscription-CREATE call (`POST /v1/subscriptions`) was made
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the unfixed code makes a create call and zero update calls)
  - Document counterexamples found (e.g. "create-order(Pro→Agency) with existing sub_ABC made 1 call to the subscription-CREATE mock and 0 calls to the subscription-update mock, leaving sub_ABC active and unreferenced")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2_

- [x] 6. Write upgrade preservation property tests (BEFORE implementing fix)
  - **Property 6: Preservation** - Free-to-Paid Signups and Non-Updatable-State Fallback Unaffected
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: a user with NO existing `subscriptions` row (or no `razorpay_subscription_id`) calling `create-order` for any paid plan calls `createRazorpaySubscription()` and returns the existing `{ subscriptionId, keyId, plan, ... }` Checkout response shape
  - Observe on UNFIXED code: a user WITH an existing `razorpay_subscription_id` whose Razorpay-side status is `created`/`pending`/`halted` ALSO calls `createRazorpaySubscription()` and returns the same response shape (since unfixed code has no status branching at all — it always creates)
  - Write a property-based test generating random `(hasExistingSubscription, razorpayStatus, currentPlan, targetPlan)` combinations asserting: `createRazorpaySubscription()` is called for every free→paid case (`hasExistingSubscription = false`) and every non-updatable-state case (`razorpayStatus IN {"created","pending","halted"}`), returning the Checkout response shape, from Preservation Requirements in design
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve — on unfixed code `createRazorpaySubscription()` is called for these inputs today, and must continue to be called for these SAME inputs after the fix, even though on unfixed code it's ALSO wrongly called for the buggy upgrade inputs captured separately in task 5)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 2.3, 2.4, 3.9_

- [x] 7. Fix for Razorpay downgrade and upgrade billing and status bugs

  - [x] 7.1 Generalize `updateRazorpaySubscriptionPlan` in `lib/razorpay.ts` to accept a `scheduleChangeAt` parameter
    - Implement `updateRazorpaySubscriptionPlan(subscriptionId: string, newPlanId: string, scheduleChangeAt: "now" | "cycle_end" = "cycle_end")` calling `PATCH https://api.razorpay.com/v1/subscriptions/:id` with body `{ plan_id: newPlanId, schedule_change_at: scheduleChangeAt }`, reusing the `getSecret` + Basic-auth + `AbortSignal.timeout(10000)` pattern from `cancelRazorpaySubscription`
    - Default the parameter to `"cycle_end"` so the existing downgrade call site (task 7.2) needs no change to its invocation; the upgrade call site (task 7.7) passes `"now"` explicitly
    - Throw a descriptive error on non-OK response (except idempotent "already on this plan" cases, mirrored from the cancel function's idempotency handling)
    - This is a SINGLE parameterized function shared by both the downgrade and upgrade paths — do NOT create a separate `updateRazorpaySubscriptionPlanNow` function, per design.md's Glossary note
    - _Bug_Condition: isBugCondition(X) from design — paid→paid downgrade OR upgrade_
    - _Expected_Behavior: Property 1 (cycle_end variant) and Property 5 (now variant) from design_
    - _Requirements: 2.1, 2.2_

  - [x] 7.2 Call `updateRazorpaySubscriptionPlan` from the downgrade route for paid→paid downgrades
    - In `app/api/razorpay/downgrade/route.ts`, add an `else if` branch (paired with the existing `if (targetPlan === "free")` block) that runs when `targetPlan !== "free"`: resolve the target plan_id via `getPlanIdForCurrency(targetPlan, currentSub.currency, currentSub.billing_cycle)` and call `updateRazorpaySubscriptionPlan(currentSub.razorpay_subscription_id, targetPlanId)`
    - Wrap in try/catch, logging non-fatally on failure (consistent with the existing cancellation call), since `scheduled_downgrade` is already persisted as the source of truth
    - Do NOT modify the existing `if (targetPlan === "free")` block
    - _Bug_Condition: isBugCondition(X) from design_
    - _Expected_Behavior: Property 1 from design_
    - _Preservation: Property 2 (free-downgrade/upgrade/no-subscription paths unchanged) from design_
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4_

  - [x] 7.3 Fix `check_subscription_expiry` status assignment via new Supabase migration
    - Create `supabase/migrations/fix_downgrade_status_past_due.sql` that replaces the function body's `status = CASE WHEN v_sub.scheduled_downgrade = 'free' THEN 'active' ELSE 'past_due' END` with an unconditional `status = 'active'` in both the `UPDATE` and the `RETURN QUERY` inside the "scheduled downgrade applies" branch
    - Verify against the LIVE schema via `mcp_supabase_execute_sql` (confirm current function body, `subscriptions` columns) before applying — do not guess column names
    - Leave the "no scheduled downgrade, mark past_due" branch untouched
    - _Bug_Condition: expired subscription with non-null scheduled_downgrade, from design_
    - _Expected_Behavior: Property 3 (status='active' for any completed downgrade) from design_
    - _Preservation: Property 4 (genuine payment failure still past_due; non-expired unchanged) from design_
    - _Requirements: 2.5, 2.6, 3.5, 3.6_

  - [x] 7.4 Add downgrade-completion notification
    - Add a new notification type (e.g. `"subscription_downgrade_completed"`) to the `NotificationType` union in `lib/notifications.ts` (the `notifications.type` DB column is plain `text` with no CHECK constraint, confirmed live — no migration needed for this step)
    - At the call site where `check_subscription_expiry` result is consumed and `is_expired = true` with a plan change detected, call `createNotification(supabase, { user_id, type: "subscription_downgrade_completed", title: ..., message: \`Your plan has changed to ${PLAN_NAMES[plan]}.\`, metadata: { plan } })`, following the exact pattern in `app/api/razorpay/verify/route.ts`
    - _Expected_Behavior: Requirement 2.7 from design_
    - _Preservation: existing subscription_activated notification flow (Requirement 3.8) untouched_
    - _Requirements: 2.7, 3.8_

  - [x] 7.5 (Optional) Add `subscription.updated` webhook handling
    - In `app/api/razorpay/webhook/route.ts`, add a `case "subscription.updated":` alongside the existing `subscription.activated`/`subscription.charged`/`subscription.cancelled`/`subscription.halted` cases
    - Sync `amount_paid`/`plan`/`currency` from `subscription.entity.plan_id` using the existing `planIdToPlan`/`planIdToAmount`/`planIdToCurrency` helpers, mirroring the activation case's pattern
    - This is a defensive sync only — do not make the core fix (7.1-7.3) depend on this webhook firing
    - _Requirements: (supplementary — not directly tied to a numbered requirement clause; supports Requirement 2.1's correctness by cross-checking)_

  - [x] 7.6 Add existing-subscription lookup to the `create-order` route
    - In `app/api/razorpay/create-order/route.ts`, after validating `plan`/`billingCycle`, use the authenticated Supabase client (read-own, already RLS-permitted — no service-role client needed for this read) to query the caller's `subscriptions` row (`SELECT * FROM subscriptions WHERE user_id = auth.user.id`)
    - If a `razorpay_subscription_id` exists on that row, call `getSubscription(currentSub.razorpay_subscription_id)` (already exists in `lib/razorpay.ts`) to fetch the live Razorpay-side `status`
    - If NO row exists, or the row has no `razorpay_subscription_id`, proceed directly to the existing (unmodified) create-new-subscription path — see task 7.9
    - _Bug_Condition: isBugCondition(X) from design — hasExistingRazorpaySubscription = TRUE_
    - _Requirements: 1.2, 2.2_

  - [x] 7.7 Branch on existing-subscription state and call `updateRazorpaySubscriptionPlan(..., "now")` for updatable upgrades
    - If the fetched `status` IS `authenticated`/`active` AND `plan !== currentSub.plan` (an actual upgrade, not a no-op re-subscribe): resolve the target Razorpay `plan_id` via `getPlanIdForCurrency(plan, currentSub.currency, cycle)`, then call `updateRazorpaySubscriptionPlan(currentSub.razorpay_subscription_id, targetPlanId, "now")`
    - Catch the specific Razorpay "amount below minimum chargeable" error (prorated difference under 50 currency subunits) and treat it as a successful no-op — the plan_id has still changed on Razorpay's side even though no charge was raised — rather than surfacing an error to the user
    - On success, read `current_start`/`current_end` from the PATCH response (or call `getSubscription()` again if the response doesn't immediately reflect them) to get the accurate new period boundaries
    - Update the Supabase `subscriptions` row in place (service-role client, same free-only-RLS reason as `/downgrade` and `/verify`) with the new `plan`, `billing_cycle`, `amount_paid`, `current_period_start`, `current_period_end`
    - Return a distinct response shape `{ upgraded: true, plan, billingCycle, periodEnd }` instead of the existing Checkout-flow shape (`{ subscriptionId, keyId, ... }`)
    - _Bug_Condition: isBugCondition(X) from design_
    - _Expected_Behavior: Property 5 (update-plan call with schedule_change_at: "now" on the SAME subscription ID) from design_
    - _Requirements: 1.2, 2.2, 2.3_

  - [x] 7.8 Update `hooks/use-razorpay.ts` to skip Checkout when `create-order` returns `{ upgraded: true }`
    - Detect the `{ upgraded: true, ... }` response shape from `create-order` and skip opening Razorpay Checkout in that case, calling `onSuccess` directly instead, per design.md Fix Implementation change #9
    - Preserve the existing Checkout-opening behavior unchanged for the `{ subscriptionId, keyId, ... }` response shape
    - _Expected_Behavior: Property 5 (client-side completion without re-entering payment details) from design_
    - _Requirements: 2.2_

  - [x] 7.9 Verify the free→paid and non-updatable-state fallback paths fall through unchanged
    - If NO `subscriptions` row exists, or the row has no `razorpay_subscription_id`, or the fetched Razorpay `status` from task 7.6 is NOT `authenticated`/`active` (i.e. `created`/`pending`/`halted`): confirm execution falls through to the EXISTING `createRazorpaySubscription()` call, response shape, and downstream Checkout/`verify` flow with no new parameters or behavior change
    - If the branching added in tasks 7.6-7.7 does not naturally fall through (e.g. an early return is needed to reach the pre-existing code), add the minimal early-return/continue needed — do not otherwise modify the existing create-and-Checkout logic
    - _Preservation: Property 6 (free-to-paid signups and non-updatable-state fallback unaffected) from design_
    - _Requirements: 2.4, 3.9_

  - [x] 7.10 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Paid-to-Paid Downgrade Must Update Razorpay Plan
    - **Property 1: Expected Behavior** - Downgrade Completion Never Sets past_due
    - **Property 5: Expected Behavior** - Paid Upgrade Must Update Existing Razorpay Subscription, Not Create a New One
    - **IMPORTANT**: Re-run the SAME tests from tasks 1, 3, and 5 - do NOT write new tests
    - Run the Razorpay-call exploration test from task 1 against the fixed downgrade route
    - Run the RPC exploration test from task 3 against the fixed `check_subscription_expiry` migration
    - Run the upgrade exploration test from task 5 against the fixed `create-order` route
    - **EXPECTED OUTCOME**: All three tests PASS (confirms all three bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 7.11 Verify preservation tests still pass
    - **Property 2: Preservation** - Downgrade-to-Free and Non-Downgrade Paths Unaffected
    - **Property 2: Preservation** - Genuine Payment Failure Still Marked past_due
    - **Property 6: Preservation** - Free-to-Paid Signups and Non-Updatable-State Fallback Unaffected
    - **IMPORTANT**: Re-run the SAME tests from tasks 2, 4, and 6 - do NOT write new tests
    - Run the route-level preservation tests from task 2 against the fixed downgrade route
    - Run the RPC preservation tests from task 4 against the fixed migration
    - Run the upgrade preservation tests from task 6 against the fixed `create-order` route and `hooks/use-razorpay.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run `npx tsc --noEmit`, `npx next build --webpack`, and `npx vitest run` (per project constraints) — this MUST cover both the server-side change (`app/api/razorpay/create-order/route.ts`, `app/api/razorpay/downgrade/route.ts`, `lib/razorpay.ts`) and the client-side change (`hooks/use-razorpay.ts`) introduced by the upgrade fix
  - Ensure all tests pass, ask the user if questions arise
  - Do NOT run `pnpm run deploy` — commit and push only
  - Do not touch any files listed in `.kiro/steering/auth-critical.md`
  - Never log or expose Razorpay LIVE keys from `.env`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4", "5", "6"] },
    { "id": 1, "tasks": ["7"] },
    { "id": 2, "tasks": ["8"] }
  ]
}
```

Tasks 1-6 (exploration + preservation tests for the route-level downgrade bug, the RPC-level status bug, and the route-level upgrade bug) are independent of each other and must all complete before Task 7 (the fix), since the fix's sub-tasks 7.10-7.11 re-run these exact tests. Task 8 (checkpoint) runs last, after the fix and its verification sub-tasks are complete.

## Notes

- Tasks 1-2 target the `/api/razorpay/downgrade` route bug (downgrade billing amount). Tasks 3-4 target the `check_subscription_expiry` RPC bug (tier demotion). Tasks 5-6 target the `/api/razorpay/create-order` route bug (upgrade double-billing risk). All three must be fixed for the reported symptom ("does changing plans actually charge the right amount, exactly once, and is the UI clear about it") to be fully resolved.
- Task 3/4 RPC tests MUST run against disposable/test rows only (e.g. a Supabase branch or seeded test user), never against real user subscription rows, since `check_subscription_expiry` mutates the row it reads.
- Task 7.4's notification call site depends on identifying where the app currently invokes `check_subscription_expiry` (e.g. a billing status route/hook) — locate this during implementation rather than assuming a specific file, since it wasn't pinned down during design.
- Task 7.5 (webhook `subscription.updated` handling) is optional/supplementary and does not block the core fix's correctness.
- The upgrade fix (tasks 5-6, 7.6-7.9) touches BOTH a server route (`app/api/razorpay/create-order/route.ts`, `lib/razorpay.ts`) and a client hook (`hooks/use-razorpay.ts`), since the client must learn to recognize the new `{ upgraded: true }` response shape and skip opening Checkout. The checkpoint task (8) must run `tsc`/build/`vitest` across both, not just the server route.
