# Subscription Expiry Enforcement — Bugfix Design

## Overview

When a paid user's subscription expires (`current_period_end` passes without renewal), the system continues granting paid-tier privileges because `parseTier()` in `lib/cost-protection.ts` reads the `plan` column without checking expiry. All 8 API routes that resolve tier only fetch `plan` from the `subscriptions` table, and the recurring invoice processor has no subscription validity check at all. The fix introduces a `resolveEffectiveTier()` function that takes the full subscription object (plan, status, current_period_end) and returns `"free"` for expired subscriptions. All tier resolution call sites are updated to use this function, and the recurring processor and email scheduler gain expiry-aware guards.

## Glossary

- **Bug_Condition (C)**: The user has a stored paid plan (starter/pro/agency) but `current_period_end` is in the past — the subscription has expired yet the system still treats them as paid
- **Property (P)**: Expired subscriptions resolve to `"free"` tier, enforcing free-tier limits on documents, messages, emails, document types, recurring invoices, and scheduled emails
- **Preservation**: Active paid subscriptions (current_period_end in the future, status = "active") must continue to return their stored plan with all associated privileges
- **parseTier()**: Existing function in `lib/cost-protection.ts` that validates a plan string and defaults to `"free"` — does NOT check expiry
- **resolveEffectiveTier()**: New function that takes `{ plan, status, current_period_end }` and returns the effective `UserTier`, downgrading to `"free"` when the subscription has expired
- **current_period_end**: Timestamp column in the `subscriptions` table indicating when the current billing period ends
- **TIER_LIMITS**: Existing config object mapping each `UserTier` to its document, message, email limits and allowed document types

## Bug Details

### Bug Condition

The bug manifests when a user has a paid plan stored in the `subscriptions` table but their `current_period_end` has passed. Every API route that resolves tier only fetches `.select("plan")` and calls `parseTier(sub?.plan)`, which returns the stored plan value regardless of expiry. The recurring invoice processor never checks subscription status at all.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { plan: string, status: string, current_period_end: timestamp | null }
  OUTPUT: boolean

  RETURN input.plan IN ("starter", "pro", "agency")
    AND input.current_period_end IS NOT NULL
    AND input.current_period_end < NOW()
END FUNCTION
```

### Examples

- User has `plan = "starter"`, `current_period_end = "2025-01-15"`, today is 2025-02-01. They call `POST /api/ai/stream` with `documentType: "quotation"`. **Actual**: System allows it (starter tier permits quotations). **Expected**: System returns 403 because effective tier is `"free"` and quotations are not in `["invoice", "contract"]`.
- User has `plan = "pro"`, `current_period_end = "2025-01-20"`, today is 2025-02-01. They have created 3 documents this month and try to create a 4th. **Actual**: System allows it (pro tier limit is 150). **Expected**: System returns 429 because effective tier is `"free"` with a limit of 5, and 3 < 5 so this specific case would still be allowed — but if they had 5 documents, the system would still allow up to 150.
- User has `plan = "agency"`, `current_period_end = "2025-01-10"`, today is 2025-02-01. The daily cron job runs and processes their recurring invoices. **Actual**: Recurring invoices are created and document count incremented. **Expected**: Recurring invoices are skipped and deactivated because the user's effective tier is `"free"`.
- User has `plan = "starter"`, `current_period_end = "2025-01-05"`, today is 2025-02-01. They have 3 pending email follow-ups in `email_schedules`. **Actual**: Follow-ups continue to be sent. **Expected**: Pending follow-ups are cancelled because the user's subscription has expired.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Users with active subscriptions (`current_period_end` in the future, `status = "active"`) must continue to receive their stored plan tier with all privileges
- Users with no subscription row in the database must continue to be treated as `"free"` tier
- The Razorpay webhook must continue to update subscription status and `current_period_end` on cancellation and renewal events without immediately downgrading the tier
- E-signatures must remain available on all tiers (free, starter, pro, agency) — no changes to signature routes
- Mouse/UI interactions, document export, PDF generation, and all non-tier-gated features must remain unchanged
- The `parseTier()` function must continue to exist for backward compatibility (used by the client-side `use-tier` hook)
- Free-tier users who never had a paid plan must continue to hit the 5 document/month limit with a 429 upgrade prompt

**Scope:**
All inputs where the subscription is active (`current_period_end` in the future) or where no subscription exists should be completely unaffected by this fix. This includes:
- All active paid subscriber workflows
- All never-subscribed free-tier user workflows
- Razorpay webhook processing
- E-signature creation and verification
- Document viewing, exporting, and sharing

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **`parseTier()` is expiry-unaware**: The function at `lib/cost-protection.ts:27` only validates that the plan string is one of the valid tiers. It has no access to `current_period_end` or `status` because it only receives the plan string. Every caller passes `sub?.plan` after fetching only `.select("plan")`.

2. **All 8 API routes fetch only `plan` column**: The following routes all query `.from("subscriptions").select("plan")` and call `parseTier(sub?.plan)`:
   - `app/api/ai/stream/route.ts`
   - `app/api/ai/analyze-file/route.ts`
   - `app/api/ai/detect-type/route.ts`
   - `app/api/ai/profile-update/route.ts`
   - `app/api/ai/clients/route.ts`
   - `app/api/sessions/create/route.ts`
   - `app/api/sessions/create-linked/route.ts`
   - `app/api/emails/send-document/route.ts`

3. **Recurring invoice processor has no subscription check**: `app/api/recurring/process/route.ts` iterates over all active recurring invoices and creates new sessions without ever checking whether the owning user's subscription is still valid. It uses a service-role client and never queries the `subscriptions` table.

4. **No mechanism to cancel scheduled emails on expiry**: When a subscription expires, pending entries in `email_schedules` remain in `"pending"` status. The email processing pipeline does not verify subscription validity before sending scheduled follow-ups.

## Correctness Properties

Property 1: Bug Condition - Expired Subscriptions Resolve to Free Tier

_For any_ subscription where `plan` is in {starter, pro, agency} AND `current_period_end` is in the past (isBugCondition returns true), the `resolveEffectiveTier()` function SHALL return `"free"`, causing all downstream enforcement (document limits, message limits, email limits, document type restrictions) to use free-tier values.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**

Property 2: Preservation - Active Subscriptions Unchanged

_For any_ subscription where `current_period_end` is in the future and `status` is `"active"` (isBugCondition returns false), the `resolveEffectiveTier()` function SHALL return the stored plan value (starter, pro, or agency), preserving all existing paid-tier privileges and limits.

**Validates: Requirements 3.1, 3.3, 3.5, 3.7**

Property 3: Bug Condition - Recurring Invoices Skipped for Expired Users

_For any_ recurring invoice belonging to a user whose subscription has expired (effective tier = "free"), the recurring invoice processor SHALL skip processing that invoice and deactivate the recurring record, preventing unauthorized document creation.

**Validates: Requirements 2.5**

Property 4: Bug Condition - Scheduled Emails Cancelled for Expired Users

_For any_ user whose subscription has expired, all pending entries in `email_schedules` for that user SHALL be cancelled with reason `"subscription_expired"`, preventing further automated email sends.

**Validates: Requirements 2.6**

Property 5: Preservation - E-Signatures Available on All Tiers

_For any_ user on any tier (free, starter, pro, agency), e-signature creation and verification SHALL continue to be allowed without tier restrictions.

**Validates: Requirements 2.8, 3.8**

Property 6: Preservation - No-Subscription Users Default to Free

_For any_ user with no row in the `subscriptions` table, `resolveEffectiveTier()` SHALL return `"free"`, preserving the existing default behavior.

**Validates: Requirements 3.2, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `lib/cost-protection.ts`

**New Function**: `resolveEffectiveTier()`

**Specific Changes**:
1. **Add `SubscriptionRecord` interface**: Define a type for the subscription object with `plan`, `status`, and `current_period_end` fields.
2. **Create `resolveEffectiveTier()` function**: Takes a `SubscriptionRecord | null` and returns `UserTier`. Logic:
   - If subscription is null/undefined → return `"free"`
   - If `current_period_end` is null or in the past → return `"free"`
   - If `status` is not `"active"` and `current_period_end` is in the past → return `"free"`
   - Otherwise → return `parseTier(subscription.plan)`
3. **Export the new function** alongside existing exports so all routes can import it.

**Files**: All 8 API routes listed in Root Cause #2

**Specific Changes per route**:
1. **Update `.select("plan")` to `.select("plan, status, current_period_end")`**: Fetch the full subscription record needed for expiry checking.
2. **Replace `parseTier(sub?.plan)` with `resolveEffectiveTier(sub)`**: Call the new function that checks expiry before returning the tier.
3. **No other changes needed**: All downstream enforcement functions (`checkDocumentLimit`, `checkMessageLimit`, `checkEmailLimit`, `checkDocumentTypeAllowed`) already accept a `UserTier` parameter and will automatically enforce free-tier limits when passed `"free"`.

**File**: `app/api/recurring/process/route.ts`

**Function**: `POST` handler (inside the `for` loop)

**Specific Changes**:
1. **Import `resolveEffectiveTier`** from `lib/cost-protection.ts`.
2. **Fetch subscription for each user**: Before processing each recurring invoice, query the `subscriptions` table for the owning user's subscription using `sourceSession.user_id`.
3. **Check effective tier**: Call `resolveEffectiveTier(subscription)`. If the result is `"free"`, skip processing this recurring invoice.
4. **Deactivate the recurring record**: When skipping due to expired subscription, set `is_active = false` on the `recurring_invoices` row and add a result entry with `error: "Subscription expired — recurring invoice deactivated"`.
5. **Create notification**: Notify the user that their recurring invoice was deactivated due to subscription expiry.

**File**: `app/api/recurring/process/route.ts` (additional change)

**Specific Changes**:
1. **Cancel pending email schedules**: After deactivating a recurring invoice for an expired user, cancel all pending `email_schedules` entries for that user with reason `"subscription_expired"`.

**File**: `app/api/emails/send-document/route.ts` (already covered by route update #2 above)

The email route already calls `checkEmailLimit()` — once it receives `"free"` as the effective tier (from the updated tier resolution), it will enforce the 5 emails/month limit automatically. The follow-up scheduling logic already checks `userTier !== "free"` before scheduling, so expired users will not get new follow-ups scheduled.

**No changes needed**: `app/api/signatures/*` routes — e-signatures are available on all tiers per requirement 2.8/3.8.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests for `parseTier()` and integration tests for the API routes that simulate expired subscriptions. Run these tests on the UNFIXED code to observe that expired users still get paid-tier access.

**Test Cases**:
1. **parseTier Ignores Expiry Test**: Call `parseTier("starter")` for a user whose `current_period_end` is in the past — verify it returns `"starter"` (will pass on unfixed code, confirming the bug since parseTier has no expiry awareness)
2. **Stream Route Expired User Test**: Set up a user with `plan = "pro"`, `current_period_end` in the past, call `POST /api/ai/stream` with `documentType: "quotation"` — verify it succeeds with 200 (will succeed on unfixed code, confirming the bug)
3. **Session Create Expired User Test**: Set up a user with `plan = "starter"`, `current_period_end` in the past, call `POST /api/sessions/create` with `documentType: "proposal"` — verify it succeeds (will succeed on unfixed code, confirming the bug)
4. **Recurring Processor No Check Test**: Set up a recurring invoice for a user with expired subscription, trigger `POST /api/recurring/process` — verify the invoice is processed (will succeed on unfixed code, confirming the bug)

**Expected Counterexamples**:
- All routes return success responses for expired users because `parseTier()` only validates the plan string
- Recurring processor creates new sessions for expired users because it never checks subscriptions
- Possible causes confirmed: missing expiry check in tier resolution, missing subscription query in recurring processor

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  effectiveTier := resolveEffectiveTier(input)
  ASSERT effectiveTier = "free"
  ASSERT allowedDocTypes(effectiveTier) = {"invoice", "contract"}
  ASSERT documentsPerMonth(effectiveTier) = 5
  ASSERT messagesPerSession(effectiveTier) = 10
  ASSERT emailsPerMonth(effectiveTier) = 5
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT resolveEffectiveTier(input) = parseTier(input.plan)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of plan × status × current_period_end automatically
- It catches edge cases like `current_period_end` exactly equal to `NOW()`, null values, missing subscription rows
- It provides strong guarantees that active subscriptions are completely unaffected

**Test Plan**: Observe behavior on UNFIXED code first for active subscribers and never-subscribed users, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Active Subscription Preservation**: For any subscription with `current_period_end` in the future and `status = "active"`, verify `resolveEffectiveTier()` returns the stored plan value
2. **No Subscription Preservation**: For a user with no subscription row, verify `resolveEffectiveTier(null)` returns `"free"`
3. **Recurring Invoice Active User Preservation**: For recurring invoices belonging to users with active subscriptions, verify they continue to be processed normally
4. **E-Signature All-Tier Preservation**: For any tier (including free), verify signature routes remain accessible

### Unit Tests

- Test `resolveEffectiveTier()` with expired subscription (plan = "starter", current_period_end in past) → returns "free"
- Test `resolveEffectiveTier()` with active subscription (plan = "pro", current_period_end in future) → returns "pro"
- Test `resolveEffectiveTier()` with null subscription → returns "free"
- Test `resolveEffectiveTier()` with cancelled status but current_period_end still in future → returns stored plan (grace period)
- Test `resolveEffectiveTier()` with cancelled status and current_period_end in past → returns "free"
- Test edge case: `current_period_end` exactly equal to current time → returns "free" (expired)

### Property-Based Tests

- Generate random `{ plan, status, current_period_end }` tuples and verify `resolveEffectiveTier()` returns `"free"` if and only if `current_period_end` is in the past (or null/missing), and returns the stored plan otherwise
- Generate random active subscriptions and verify all downstream limit functions (`checkDocumentLimit`, `checkEmailLimit`, `checkMessageLimit`, `checkDocumentTypeAllowed`) produce identical results to the unfixed code
- Generate random expired subscriptions and verify all downstream limit functions enforce free-tier values

### Integration Tests

- Test full API route flow: create user with expired subscription → call `/api/ai/stream` → verify free-tier enforcement (document type blocked, limits applied)
- Test recurring processor: set up expired user with active recurring invoice → trigger cron → verify invoice skipped and deactivated
- Test email scheduling: set up expired user → verify pending email schedules are cancelled
- Test Razorpay renewal: expired user renews → webhook updates `current_period_end` to future → verify tier resolves to paid again
