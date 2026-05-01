# Bugfix Requirements Document

## Introduction

When a paid user's subscription expires (i.e., `current_period_end` passes without renewal) or is cancelled, the system fails to downgrade their effective tier to "free." The root cause is that `parseTier()` in `lib/cost-protection.ts` reads the `plan` column from the `subscriptions` table directly without checking whether `current_period_end` has passed. This means expired subscribers continue to enjoy paid-tier privileges indefinitely — unlimited document types, higher limits, and recurring email processing — even though they are no longer paying.

Additionally, all API routes that check tier only fetch the `plan` column and never fetch `current_period_end` or `status`, and the recurring invoice processor has no subscription validity check at all.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user's subscription has `current_period_end` in the past and `status` is "cancelled" or not "active" THEN the system still returns the stored `plan` value (e.g., "starter", "pro", "agency") as their effective tier, granting them paid-tier privileges.

1.2 WHEN a user's subscription has expired (current_period_end < now) THEN the system still allows them to create document types beyond the free tier (quotation, proposal) because `checkDocumentTypeAllowed()` receives the stale paid tier.

1.3 WHEN a user's subscription has expired THEN the system still enforces the paid-tier document limit (e.g., 50/month for starter, 150/month for pro) instead of the free-tier limit of 5/month.

1.4 WHEN a user's subscription has expired THEN the system still enforces the paid-tier message-per-session limit (e.g., 30 for starter, 50 for pro) instead of the free-tier limit of 10/session.

1.5 WHEN the daily recurring invoice cron job runs for a user whose subscription has expired THEN the system still processes their recurring invoices because there is no subscription status check in the recurring processor.

1.6 WHEN a user's subscription has expired THEN scheduled email follow-ups (auto follow-ups from `email_schedules`) continue to be sent because the email processing pipeline does not verify the user's subscription is still active.

1.7 WHEN a user's subscription has expired THEN the system still enforces the paid-tier email limit (e.g., 100/month for starter, 250/month for pro) instead of the free-tier limit of 5 emails/month.

### Expected Behavior (Correct)

2.1 WHEN a user's subscription has `current_period_end` in the past and has not been renewed THEN the system SHALL treat their effective tier as "free" regardless of the stored `plan` value, by checking `current_period_end` against the current timestamp during tier resolution.

2.2 WHEN a user's effective tier is resolved to "free" (due to expiry) THEN the system SHALL restrict document creation to invoice and contract types only, blocking quotation and proposal creation with a 403 response.

2.3 WHEN a user's effective tier is resolved to "free" (due to expiry) THEN the system SHALL enforce the free-tier document limit of 5 documents per month.

2.4 WHEN a user's effective tier is resolved to "free" (due to expiry) THEN the system SHALL enforce the free-tier message limit of 10 messages per session.

2.5 WHEN the daily recurring invoice cron job runs THEN the system SHALL skip processing recurring invoices for any user whose subscription has expired (effective tier = "free"), and SHALL deactivate those recurring invoice records.

2.6 WHEN a user's subscription expires THEN the system SHALL cancel all pending scheduled email follow-ups for that user, preventing any further automated emails from being sent on their behalf.

2.7 WHEN a user's effective tier is resolved to "free" (due to expiry) THEN the system SHALL enforce the free-tier email limit of 5 emails per month.

2.8 WHEN any user (including free-tier) attempts to use e-signatures THEN the system SHALL allow it, as e-signatures are available on all tiers.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has an active subscription with `current_period_end` in the future and `status` is "active" THEN the system SHALL CONTINUE TO return their stored plan (starter, pro, agency) as their effective tier with all associated privileges.

3.2 WHEN a user has never had a subscription (no row in subscriptions table) THEN the system SHALL CONTINUE TO treat them as free-tier users.

3.3 WHEN a user with an active paid subscription creates documents THEN the system SHALL CONTINUE TO allow all 4 document types (invoice, contract, quotation, proposal) and enforce the paid-tier document and message limits.

3.4 WHEN the Razorpay webhook receives a `subscription.cancelled` event THEN the system SHALL CONTINUE TO update the subscription status to "cancelled" and set `cancelled_at`, without immediately downgrading the tier (the user retains access until `current_period_end`).

3.5 WHEN the Razorpay webhook receives a successful payment/renewal event THEN the system SHALL CONTINUE TO update the subscription with the new `current_period_end`, maintaining the user's paid tier.

3.6 WHEN a free-tier user (who never had a paid plan) hits the 5 document/month limit THEN the system SHALL CONTINUE TO return a 429 response with an upgrade prompt.

3.7 WHEN the recurring invoice cron job processes invoices for users with active paid subscriptions THEN the system SHALL CONTINUE TO create new linked sessions and increment document counts as before.

3.8 WHEN any user on any tier (free, starter, pro, agency) uses e-signatures THEN the system SHALL CONTINUE TO allow access, as e-signatures are available on all tiers.

---

## Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SubscriptionState { plan: string, status: string, current_period_end: timestamp | null }
  OUTPUT: boolean
  
  // Returns true when the subscription has expired but the system still treats the user as paid
  RETURN X.plan IN ("starter", "pro", "agency")
    AND (X.current_period_end IS NOT NULL AND X.current_period_end < NOW())
END FUNCTION
```

## Fix Checking Property

```pascal
// Property: Fix Checking — Expired subscriptions resolve to free tier
FOR ALL X WHERE isBugCondition(X) DO
  effectiveTier ← resolveEffectiveTier'(X)
  ASSERT effectiveTier = "free"
  ASSERT allowedDocTypes(effectiveTier) = {"invoice", "contract"}
  ASSERT documentsPerMonth(effectiveTier) = 5
  ASSERT messagesPerSession(effectiveTier) = 10
  ASSERT emailsPerMonth(effectiveTier) = 5
  ASSERT recurringInvoicesSkipped(X.user_id) = true
  ASSERT pendingEmailsCancelled(X.user_id) = true
END FOR
```

## E-Signature Fix Property

```pascal
// Property: E-signatures available on all tiers
FOR ALL tier IN {"free", "starter", "pro", "agency"} DO
  ASSERT eSignatureAllowed(tier) = true
END FOR
```

## Preservation Checking Property

```pascal
// Property: Preservation Checking — Active subscriptions unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT resolveEffectiveTier(X) = resolveEffectiveTier'(X)
END FOR
```
