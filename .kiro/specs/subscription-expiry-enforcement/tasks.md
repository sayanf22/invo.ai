# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Expired Subscriptions Still Return Paid Tier
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `parseTier()` ignores expiry
  - **Scoped PBT Approach**: For any subscription with `plan` in {starter, pro, agency} AND `current_period_end` in the past, assert that the resolved tier is `"free"`
  - Write property-based test in `lib/__tests__/subscription-expiry.property.test.ts` using fast-check
  - Generate random expired subscriptions: `{ plan: fc.constantFrom("starter", "pro", "agency"), status: fc.constantFrom("active", "cancelled", "expired"), current_period_end: <past date> }`
  - Assert that `parseTier(sub.plan)` returns `"free"` for expired subscriptions (this will FAIL because parseTier only validates the plan string, not expiry)
  - The test assertions encode the expected behavior from the design: `resolveEffectiveTier(expiredSub) === "free"`
  - Run test on UNFIXED code with `pnpm vitest --run lib/__tests__/subscription-expiry.property.test.ts`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves parseTier ignores expiry)
  - Document counterexamples: e.g., `parseTier("starter")` returns `"starter"` even when `current_period_end = "2025-01-15"` (past)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Active Subscriptions and No-Subscription Users Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `parseTier("starter")` returns `"starter"` on unfixed code for active subscriptions
  - Observe: `parseTier("pro")` returns `"pro"` on unfixed code for active subscriptions
  - Observe: `parseTier(undefined)` returns `"free"` on unfixed code for no-subscription users
  - Observe: `parseTier("agency")` returns `"agency"` on unfixed code for active subscriptions
  - Write property-based test in `lib/__tests__/subscription-expiry-preservation.property.test.ts` using fast-check
  - Generate random active subscriptions: `{ plan: fc.constantFrom("starter", "pro", "agency"), status: "active", current_period_end: <future date> }`
  - Assert that for active subscriptions (current_period_end in the future), the effective tier equals the stored plan value
  - Assert that for null/undefined subscriptions, the effective tier is `"free"`
  - Assert that `getTierLimits()` returns correct limits for each tier (documentsPerMonth, messagesPerSession, emailsPerMonth, allowedDocTypes)
  - Verify tests pass on UNFIXED code with `pnpm vitest --run lib/__tests__/subscription-expiry-preservation.property.test.ts`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Implement subscription expiry enforcement fix

  - [x] 3.1 Create `resolveEffectiveTier()` function in `lib/cost-protection.ts`
    - Add `SubscriptionRecord` interface: `{ plan: string | null, status: string | null, current_period_end: string | null }`
    - Implement `resolveEffectiveTier(subscription: SubscriptionRecord | null | undefined): UserTier`
    - Logic: if subscription is null/undefined → return `"free"`
    - Logic: if `current_period_end` is null or `new Date(current_period_end) < new Date()` → return `"free"`
    - Logic: otherwise → return `parseTier(subscription.plan)`
    - Export the new function alongside existing exports
    - _Bug_Condition: isBugCondition(input) where input.plan IN ("starter","pro","agency") AND input.current_period_end < NOW()_
    - _Expected_Behavior: resolveEffectiveTier(expiredSub) returns "free" for all expired subscriptions_
    - _Preservation: Active subscriptions (current_period_end in future) return parseTier(plan)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 3.1, 3.2_

  - [x] 3.2 Update `app/api/ai/stream/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Update `app/api/ai/analyze-file/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Update `app/api/ai/detect-type/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Update `app/api/ai/profile-update/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Update `app/api/ai/clients/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Update `app/api/sessions/create/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.8 Update `app/api/sessions/create-linked/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.9 Update `app/api/emails/send-document/route.ts` to use `resolveEffectiveTier()`
    - Change `.select("plan")` to `.select("plan, status, current_period_end")`
    - Replace `parseTier(subscription?.plan)` with `resolveEffectiveTier(subscription)`
    - Import `resolveEffectiveTier` from `@/lib/cost-protection`
    - _Requirements: 2.1, 2.7_

  - [x] 3.10 Add subscription expiry check to recurring invoice processor
    - In `app/api/recurring/process/route.ts`, import `resolveEffectiveTier` from `@/lib/cost-protection`
    - Before processing each recurring invoice, fetch the user's subscription: `.from("subscriptions").select("plan, status, current_period_end").eq("user_id", sourceSession.user_id).single()`
    - Call `resolveEffectiveTier(subscription)` — if result is `"free"`, skip processing
    - Deactivate the recurring record: set `is_active = false` on the `recurring_invoices` row
    - Push result entry: `{ recurringId: rec.id, error: "Subscription expired — recurring invoice deactivated" }`
    - _Bug_Condition: User has expired subscription but recurring invoices still process_
    - _Expected_Behavior: Recurring invoices skipped and deactivated for expired users_
    - _Preservation: Active subscribers' recurring invoices continue processing normally_
    - _Requirements: 2.5, 3.7_

  - [x] 3.11 Add email schedule cancellation for expired users in recurring processor
    - After deactivating a recurring invoice for an expired user, cancel all pending `email_schedules` for that user
    - Update query: `.from("email_schedules").update({ status: "cancelled", cancelled_reason: "subscription_expired" }).eq("user_id", sourceSession.user_id).eq("status", "pending")`
    - This prevents further automated email sends for expired subscribers
    - _Bug_Condition: Expired users still have pending email follow-ups being sent_
    - _Expected_Behavior: All pending email_schedules cancelled with reason "subscription_expired"_
    - _Requirements: 2.6_

  - [x] 3.12 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Expired Subscriptions Resolve to Free Tier
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (resolveEffectiveTier returns "free" for expired subs)
    - Update the test to call `resolveEffectiveTier()` instead of `parseTier()` (since the test was written against the bug condition)
    - Run bug condition exploration test: `pnpm vitest --run lib/__tests__/subscription-expiry.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — expired subscriptions now resolve to "free")
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [x] 3.13 Verify preservation tests still pass
    - **Property 2: Preservation** - Active Subscriptions and No-Subscription Users Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests: `pnpm vitest --run lib/__tests__/subscription-expiry-preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — active subscriptions still get paid tier)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm vitest --run`
  - Ensure all property-based tests pass (bug condition + preservation)
  - Ensure existing cost-protection property tests still pass (`lib/__tests__/cost-protection.property.test.ts`)
  - Verify no TypeScript compilation errors: `pnpm tsc --noEmit`
  - Ask the user if questions arise
