# Invo.ai Pricing Model

## Billing Philosophy

**Count per document (session), not per AI message.** Each new document generation session counts as 1 document against the user's monthly quota. All messages within that session (edits, refinements, follow-ups) are free. Editing an already-generated document does not consume quota.

This approach:
- Maps directly to perceived value ("I created 12 invoices this month")
- Avoids punishing users for iterating on quality
- Enables clear upsell triggers ("18/50 docs used this month")
- Matches how competitors price (per-invoice, per-document)

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
| Documents/month | 3 | 50 | 150 | Unlimited |
| Messages/session | 10 | 30 | 50 | Unlimited |
| Document types | Invoice + Contract | All 4 | All 4 | All 4 |
| PDF templates | 3 (Modern, Classic, Minimal) | All 9 | All 9 | All 9 |
| Countries | 3 (India, USA, UK) | All 11 | All 11 | All 11 |
| Export formats | PDF only | PDF + DOCX | PDF + DOCX + Image | All formats |
| Session history | 7 days | 30 days | 1 year | Forever |
| Digital signatures | — | — | ✓ | ✓ |
| Custom logo/branding | — | — | ✓ | ✓ |
| Team members | 1 | 1 | 1 | 3 |
| Priority support | — | — | — | ✓ |

## Cost Analysis

### AI Cost Per Document
- DeepSeek V3: ~$0.27/M input tokens, ~$1.10/M output tokens
- One generation ≈ 3,000 input + 1,500 output tokens
- Cost per document: ~$0.001
- With cache hits (repeat patterns): even lower

### Margin Analysis

| Tier | Revenue | Max AI Cost (all docs used) | Gross Margin |
|------|---------|----------------------------|-------------|
| Free ($0) | $0 | ~$0.003 (3 docs) | — (acquisition) |
| Starter ($9) | $9 | ~$0.05 (50 docs) | ~99.4% |
| Pro ($24) | $24 | ~$0.15 (150 docs) | ~99.4% |
| Agency ($59) | $59 | ~$0.50 (est. 500 docs) | ~99.2% |

Margins are extremely high because DeepSeek V3 is cheap. The document limits are a business model choice, not a cost constraint.

## Competitor Benchmarks

| Competitor | Price | What You Get |
|-----------|-------|-------------|
| Wave | Free / $16/mo | Basic invoicing, no AI |
| FreshBooks Lite | $8.40/mo | 5 clients, no AI |
| Invoice2go Starter | $5.99/mo | 30 invoices/yr, no AI |
| Invoice2go Premium | $39.99/mo | Unlimited, no AI |
| Zoho Invoice Free | Free | 5 customers, no AI |
| PandaDoc Essentials | $19/mo | Documents + e-sign, no AI gen |

Invo.ai offers AI generation + 4 doc types + 11 countries + 9 templates — significantly more value at lower or equal price points.

## Document Lifecycle & Download Logic

### Flow
1. User creates document via AI prompt → session created, doc count incremented
2. User can edit/refine with AI messages (within session message cap)
3. User downloads/exports the document → document is **finalized and locked**
4. After download: no further AI edits allowed on that session
5. User can still VIEW the document but cannot modify it

### Why Lock After Download
- Prevents infinite re-use of a single session (change name, re-download for different client)
- Creates natural upgrade pressure (need more docs = need higher tier)
- Matches real-world workflow (you send an invoice, it's done)
- Aligns with Stripe/FreshBooks model where finalized invoices are immutable

### What "Locked" Means
- AI chat input is disabled
- Editor fields become read-only
- Export buttons still work (re-download same version)
- A banner shows "This document has been finalized"
- User must create a new session for a new document

## Abuse Prevention Strategy

### Problem Scenarios
1. **Name-swap abuse**: User generates invoice for Client A, downloads, then changes name to Client B and downloads again
2. **Chatbot abuse**: User uses document session as unlimited AI chatbot
3. **Bulk generation**: Automated scripts creating documents

### Solutions
1. **Lock after download** — Once exported, the session is frozen. No more edits.
2. **Per-session message caps** — 10/30/50/unlimited based on tier. Prevents chatbot abuse.
3. **Rate limiting** — Existing rate limiter (10 AI requests/min) prevents automated bulk generation.
4. **Document count tracking** — `user_usage` table tracks monthly document count per user.

## Implementation Notes

### Database
- Document count tracked in `user_usage` table (column: `documents_count`)
- Session message count tracked per session
- Download/finalize status stored on the document/session record
- Tier stored on user profile (default: "free")

### Enforcement Points
- `cost-protection.ts` → `checkDocumentLimit()` before creating new session
- `cost-protection.ts` → `checkMessageLimit()` before sending AI message
- Session creation API → increment document count
- Download/export API → set `finalized_at` timestamp on session
- Editor/chat UI → check `finalized_at` to disable inputs

### Tier Detection
- User's tier stored in `profiles` or `subscriptions` table
- Default tier: "free"
- Tier checked on every API call that needs limit enforcement
- Payment integration (Stripe) updates tier on subscription change

