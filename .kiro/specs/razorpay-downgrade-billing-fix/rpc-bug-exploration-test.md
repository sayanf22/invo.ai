# Task 3: RPC Bug Condition Exploration Test — Results

**Property 1 (Bug Condition): Downgrade Completion Never Sets past_due**
**Validates: Requirements 1.3, 1.4**

## Method

Ran directly against the LIVE `check_subscription_expiry` RPC in Supabase project
`tdeqauhtobtahncglqwq` using `mcp_supabase_execute_sql`, since this RPC is a Postgres
function and cannot be meaningfully unit-tested outside the database.

Supabase branching is unavailable on this project's plan (Pro plan or above required),
so the test used a fully disposable test user (`auth.users` row, cascading to a
`profiles` row via the existing `on_auth_user_created` trigger, plus a seeded
`subscriptions` row) inserted, tested, and immediately deleted within the same session.
No real user data was read or modified at any point.

## Test Setup

Disposable test user: `pbt-test-rpc-explore-task3@example.invalid`
(`user_id = 4c0f5029-329d-44b9-9fd6-bbfaad4494ca` — deleted after the test, id recorded
here only for audit purposes)

Seeded `subscriptions` row:
```
plan                 = 'pro'
status                = 'active'
scheduled_downgrade   = 'starter'
current_period_end    = NOW() - INTERVAL '1 day'   -- expired
razorpay_subscription_id = 'sub_pbt_test_explore'  -- fake id, not a real Razorpay sub
```

## Test Execution

```sql
SELECT * FROM check_subscription_expiry('4c0f5029-329d-44b9-9fd6-bbfaad4494ca');
```

## Counterexample (Actual Result — UNFIXED code)

```json
{ "plan": "starter", "status": "past_due", "is_expired": true }
```

Persisted row after the call:
```json
{
  "plan": "starter",
  "status": "past_due",
  "scheduled_downgrade": null,
  "current_period_start": "2026-07-05T01:09:27.331Z",
  "current_period_end": "2026-08-05T01:09:27.331Z"
}
```

## Assertion

Expected (per Property 3 / Expected Behavior 2.2 in design.md):
```
status = 'active'
```

Actual (unfixed code):
```
status = 'past_due'
```

**Assertion FAILED as expected.** This confirms the bug: a paid→paid scheduled
downgrade (pro→starter) that completes via `check_subscription_expiry` incorrectly
sets `status = 'past_due'` instead of `'active'`, even though `plan` is correctly
updated to `'starter'`. Per `resolveEffectiveTier()` in `lib/cost-protection.ts`,
a `past_due` status causes the user to be treated as FREE tier instead of their
correctly-downgraded Starter tier — a more severe demotion than intended.

## Cleanup Verification

```sql
SELECT
  (SELECT count(*) FROM auth.users WHERE email = 'pbt-test-rpc-explore-task3@example.invalid') AS users_left,
  (SELECT count(*) FROM public.profiles WHERE email = 'pbt-test-rpc-explore-task3@example.invalid') AS profiles_left,
  (SELECT count(*) FROM public.subscriptions WHERE razorpay_subscription_id = 'sub_pbt_test_explore') AS subs_left;
```
Result: `{ "users_left": 0, "profiles_left": 0, "subs_left": 0 }` — disposable test
user and all related rows fully removed. No other data was touched.

## Outcome

Test FAILED on unfixed code, as expected for this bug-condition exploration test.
This confirms the bug described in Requirements 1.3 and 1.4 exists in the live
`check_subscription_expiry` RPC. The RPC was NOT modified as part of this task.
