# Clorefy Pricing Model

## Billing Philosophy

**Count per document (session), not per AI message.** Each new document generation session counts as 1 document against the user's monthly quota. All messages within that session (edits, refinements, follow-ups) are free. Editing an already-generated document does not consume quota.

This approach:
- Maps directly to perceived value ("I created 12 invoices this month")
- Avoids punishing users for iterating on quality
- Enables clear upsell triggers ("18/50 docs used this month")
- Matches how competitors price (per-invoice, per-document)

## Billing Periods and Plan Changes

- UTC month boundaries remain the normal allowance reset cadence.
- Downgrades are scheduled for the exact end of the already-paid provider period; the current plan stays active until that timestamp.
- Paid access or a higher tier is never granted from Checkout, authorization, or a lifecycle-only webhook. A captured Razorpay subscription charge and confirmed provider plan are both required.
- When a verified transition actually activates, document, email, and AI allowance counters reset once. Scheduling, failed payment, and unverified payment do not reset anything.
- A paid entitlement that ends and becomes Free receives one reset at the exact recorded period boundary.
- Every transition reset archives the prior counters in `subscription_usage_resets`; webhook replays reuse a unique transition key and cannot reset twice.
- Existing documents, document editability, and historical captured-payment receipts are preserved across every plan change.
- Future scheduled paid changes can be cancelled. Because Razorpay cannot reactivate a cancelled mandate, reversing a scheduled move to Free requires authorizing a replacement mandate before current access ends.

## Per-Session Message Caps

To prevent abuse (e.g., using a single session as an unlimited chatbot), each session has a message limit:

| Tier | Messages per session |
|------|---------------------|
| Free | 10 |
| Starter | 30 |
| Pro | 50 |
| Agency | Unlimited |

Once the cap is hit, the user must start a new session (which counts as a new document).

## The 4 Tiers

| | Free | Starter | Pro | Agency |
|--|------|---------|-----|--------|
| Monthly price | $0 | $9 | $24 | $59 |
| Yearly price | $0 | $7/mo | $19/mo | $47/mo |
| Yearly savings | — | ~22% | ~21% | ~20% |
| Documents/month | 5 | 50 | 150 | Unlimited |
| Messages/session | 10 | 30 | 50 | Unlimited |
| **Email sends/month** | **5** | **100** | **250** | **Unlimited** |
| Document types | Invoice, Contract, Quote | All 9 types | All 9 types | All 9 types |
| Countries | Global (150+) | Global (150+) | Global (150+) | Global (150+) |
| Export formats | PDF only | PDF + DOCX | PDF + DOCX + Image | All formats |
| Session history | 30 days | 30 days | 1 year | Forever |
| Digital signatures | ✓ | ✓ | ✓ | ✓ |
| Recurring invoices | — | ✓ | ✓ | ✓ |
| Auto-invoice on sign | — | — | ✓ | ✓ |
| Custom logo/branding | ✓ | ✓ | ✓ | ✓ |
| Team members | 1 | 1 | 1 | 3 |
| Priority support | — | — | — | ✓ |

## Document Types (9 total)

All 9 types are available on Starter, Pro, and Agency. Free tier includes Invoice, Contract, and Quote.

| Type | Free | Paid |
|------|------|------|
| Invoice | ✓ | ✓ |
| Contract | ✓ | ✓ |
| Quote | ✓ | ✓ |
| Proposal | — | ✓ |
| Statement of Work (SOW) | — | ✓ |
| Change Order | — | ✓ |
| NDA | — | ✓ |
| Client Onboarding Form | — | ✓ |
| Payment Follow-up | — | ✓ |

## Feature Enforcement

| Feature | Gate | Enforcement |
|---------|------|-------------|
| Document limit | Per tier | `checkDocumentLimit()` in `cost-protection.ts` |
| Message limit | Per tier per session | `checkMessageLimit()` in `cost-protection.ts` |
| Email sends | Per tier per month | `checkEmailLimit()` in `cost-protection.ts` |
| Document types | Free: 3 types; Paid: all 9 | `checkDocumentTypeAllowed()` in `cost-protection.ts` |
| Recurring invoices | Starter+ | `POST /api/recurring` returns 403 for free |
| Auto-invoice on sign | Pro+ | Toggle disabled in UI + API check |
| E-signatures | All tiers | No restriction |
| Auto follow-up reminders | Paid tiers | `getFollowUpSchedule()` returns `[]` for free |

### Email Send Limits

- **Free**: 5 emails/month — 1 per document
- **Starter**: 100 emails/month — resends + follow-ups across 50 docs
- **Pro**: 250 emails/month — comfortable for follow-ups across 150 docs
- **Agency**: Unlimited

After each successful send, `incrementEmailCount()` atomically increments the counter via the `increment_email_count` Supabase RPC.

## Supported Countries

Clorefy works globally with country-aware compliance. The AI injects the correct tax rates, mandatory fields, and legal requirements for each country automatically.

**Well-tested countries (150+ total supported):** India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands, and expanding continuously.

Each country has:
- Correct tax type (GST/HST/VAT/etc.) and rates
- Mandatory document fields per local regulation
- Payment terms conventions
- Invoice numbering requirements

## Cost Analysis

### AI Cost Per Document
- DeepSeek V3: ~$0.27/M input tokens, ~$1.10/M output tokens
- One generation ≈ 3,000 input + 1,500 output tokens
- Cost per document: ~$0.001
- With cache hits (repeat patterns): even lower

### Margin Analysis

| Tier | Revenue | Max AI Cost (all docs used) | Gross Margin |
|------|---------|----------------------------|-------------|
| Free ($0) | $0 | ~$0.005 (5 docs) | — (acquisition) |
| Starter ($9) | $9 | ~$0.05 (50 docs) | ~99.4% |
| Pro ($24) | $24 | ~$0.15 (150 docs) | ~99.4% |
| Agency ($59) | $59 | ~$0.50 (est. 500 docs) | ~99.2% |

## Competitor Benchmarks

| Competitor | Price | What You Get |
|-----------|-------|-------------|
| Wave | Free / $16/mo | Basic invoicing, no AI |
| FreshBooks Lite | $8.40/mo | 5 clients, no AI |
| Invoice2go Starter | $5.99/mo | 30 invoices/yr, no AI |
| Invoice2go Premium | $39.99/mo | Unlimited, no AI |
| Zoho Invoice Free | Free | 5 customers, no AI |
| PandaDoc Essentials | $19/mo | Documents + e-sign, no AI gen |

Clorefy offers AI generation + 9 doc types + global compliance + e-signatures — significantly more value at lower or equal price points.

## Implementation Notes

### Database
- Current allowance counters are tracked in `user_usage` by UTC month.
- Completed plan transitions atomically archive pre-reset values in `subscription_usage_resets` before refreshing the active counters.
- Email count is tracked in `user_usage` (`emails_count`).
- Tier and recoverable transition state are stored in `subscriptions` (`plan`, `status`, `current_period_end`, and `pending_*`).
- Tier resolves to Free when a paid period expires; the lifecycle finalizer applies the boundary reset exactly once.

### Tier Detection
```typescript
// lib/cost-protection.ts
getUserTier(supabase, userId)  // single call, handles expiry
resolveEffectiveTier(subscription)  // expiry-aware: returns "free" if expired
```

### Enforcement Points
- `POST /api/sessions/create` → document limit check
- `POST /api/ai/stream` → message limit + doc type check
- `POST /api/emails/send-document` → email limit check + follow-up scheduling
- `POST /api/recurring` → Starter+ tier check
- `POST /api/signatures` → no tier restriction (all tiers)
