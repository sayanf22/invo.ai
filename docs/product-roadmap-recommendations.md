# Clorefy — Product Roadmap & Feature Recommendations

> Research-backed recommendations for what to build next to make Clorefy a no-brainer choice over Wave, FreshBooks, PandaDoc, and Proposify.
> Based on competitor analysis, industry best practices, and gap analysis of the current product.
> Last updated: April 2026

---

## What You Have (Strong Foundation)

- ✅ AI document generation (invoice, contract, quotation, proposal) — 11 countries
- ✅ Country-compliant tax rules (GST, VAT, USt, TVA, etc.)
- ✅ Digital signatures (token-based, drawn signature)
- ✅ Client management (CRUD, CSV import/export, AI chat)
- ✅ Document linking (invoice → contract → quotation chain)
- ✅ 9 PDF templates
- ✅ Multi-format export (PDF, DOCX, Image)
- ✅ Razorpay payment integration (subscriptions)
- ✅ Admin dashboard
- ✅ Session history
- ✅ **Payment links on invoices** (Razorpay, Stripe, Cashfree) — IMPLEMENTED April 2026
- ✅ **Public payment page** (`/pay/[sessionId]`) — IMPLEMENTED April 2026
- ✅ **WhatsApp share button** — IMPLEMENTED April 2026
- ✅ **Copy payment link button** — IMPLEMENTED April 2026
- ✅ **Invoice status tracking** (Draft → Sent → Paid) — IMPLEMENTED April 2026
- ✅ **Document view tracking** (view count, last viewed) — IMPLEMENTED April 2026
- ✅ **Payment status badges** on documents list — IMPLEMENTED April 2026
- ✅ **Editor changes auto-save to DB** — IMPLEMENTED April 2026
- ✅ **Paid document lock** (read-only when paid) — IMPLEMENTED April 2026
- ✅ **Send Invoice/Document via Email** (all 4 doc types, Mailtrap) — IMPLEMENTED April 2026
- ✅ **Automated payment reminders** (day +3/+7/+14/+30, stops on payment) — IMPLEMENTED April 2026
- ✅ **Email delivery tracking** (sent/delivered/opened/bounced via webhooks) — IMPLEMENTED April 2026
- ✅ **Email follow-up management** (stop reminders, view history per document) — IMPLEMENTED April 2026
- ✅ **Tier-based email limits** (Free: 5, Starter: 100, Pro: 250, Agency: unlimited) — IMPLEMENTED April 2026
- ✅ **Security hardening** (4 audit passes, 17 vulnerabilities fixed) — IMPLEMENTED April 2026
- ✅ **Back navigation fix** (useSafeBack hook, no more 404 on back button) — IMPLEMENTED April 2026
- ✅ **Consistent loading screens** (PageLoader component, brand color #FBF7F0) — IMPLEMENTED April 2026

---

## ✅ IMPLEMENTED: Payment Links on Invoices (April 2026)

### What Was Built

Full payment link flow redesign covering Razorpay, Stripe, and Cashfree gateways:

**Core features:**
- "Get Payment Link" button on every invoice in the document preview toolbar
- Confirmation dialog showing amount, client, and lock warning before creation
- Payment link created via Razorpay Payment Links API (using user's own API keys)
- Platform link (`clorefy.com/pay/[sessionId]`) replaces raw gateway URLs for sharing
- Copy and WhatsApp share buttons use the platform link
- QR code auto-generated for the gateway URL
- Cancel payment link with confirmation modal (lists 4 consequences, shows amount)
- Payment link expiry customization (7/14/30/60 days, default 30 — Net 30 standard)

**Public payment page (`/pay/[sessionId]`):**
- Server-rendered page (no auth required) showing invoice preview, amount, and Pay Now button
- Status-based rendering: Pending (with QR + Pay Now), Paid (green badge), Expired/Cancelled (message)
- Responsive mobile layout with proper viewport handling
- Pay Now button redirects to the gateway checkout URL
- Only serves documents with active/paid payment records (prevents enumeration)

**Payment lifecycle:**
- Invoice locked after payment link creation (all editor fields disabled)
- Paid invoices permanently locked — cannot be edited, cancelled, or re-linked
- Cancel button with confirmation dialog (unlocks invoice, stops follow-up emails)
- Refresh button to check latest payment status from gateway
- Lock indicator with tooltip explaining why editing is disabled

**Webhook integration:**
- Razorpay, Stripe, and Cashfree webhooks all update `invoice_payments.status`
- Webhooks also update `document_sessions.status` to "paid" for permanent lock
- Webhook cancels all pending email follow-up schedules on payment received
- Notification sent to user on payment received
- Idempotent handling (duplicate webhooks ignored)
- UUID validation on all per-user webhook endpoints

**Data integrity:**
- Editor changes auto-saved to DB via debounced `updateSessionContext`
- Context snapshot saved atomically when payment link is created
- PDF shows "PAID" badge when payment confirmed (not "DRAFT")

**Security:**
- Public payment status API with IP-based rate limiting
- UUID validation on all public endpoints
- Only public-safe fields returned (no gateway URLs, user data, or API keys)
- RLS policies fixed (removed overly permissive UPDATE policy)
- Stripe webhook secret now encrypted at rest (AES-256-GCM)

### Process Followed

1. **Spec-driven development** — Full requirements, design, and tasks documents in `.kiro/specs/payment-link-flow-redesign/`
2. **Requirements first** — 8 user stories with acceptance criteria
3. **Design document** — Architecture diagram, component interfaces, data models, correctness properties
4. **11 implementation tasks** with sub-tasks — executed sequentially
5. **Security audit** — Supabase advisors checked, RLS policies fixed, CSP updated
6. **Mobile audit** — Viewport meta tag added, PDF overflow fixed, Pay Now button mobile-compatible

---

## ✅ IMPLEMENTED: Send Invoice/Document via Email (April 2026)

### What Was Built

Full email sending system enabling users to deliver any document directly to clients from within Clorefy. Closes the "generate → send → get paid" loop.

**Core email sending:**
- "Send via Email" button in the document preview toolbar
- "Send via Clorefy Email" option in the Share dropdown
- 2-step send dialog: Compose (email, subject, personal message, follow-up toggle, expiry) → Confirm & Send
- AI-generated personal message (optional, editable before sending)
- Branded HTML email template — mobile-responsive, Gmail/Outlook/Apple Mail compatible
- "Pay Now" button in email for invoices with active payment links
- Auto-creates Razorpay payment link if none exists when sending an invoice
- Sender shown as `{BusinessName} via Clorefy <no-reply@clorefy.com>`

**Email delivery tracking:**
- Mailtrap REST API for delivery (plain `fetch()`, Cloudflare Workers compatible)
- Webhook handler at `/api/emails/webhook` updates status: sent → delivered → opened → bounced
- HMAC signature verification on all incoming webhooks
- Email history per document (expandable in My Documents page)
- Email stats: total sent, opened, delivered, bounced counts

**Automated follow-up reminders:**
- Supabase Edge Function `process-email-schedules` runs daily at 8AM UTC via pg_cron
- Schedule: day +3 (polite), +7 (follow-up), +14 (urgent), +30 (final notice)
- Stops automatically when `invoice_payments.status = "paid"`
- Tier limits: Free = 0 follow-ups, Starter = 2, Pro/Agency = 4
- "Stop Reminders" button in My Documents email history panel
- "Manage Reminders" in Share dropdown shows pending schedule with cancel-all

**Tier-based email limits:**
- Free: 5 emails/month
- Starter: 100 emails/month
- Pro: 250 emails/month
- Agency: unlimited
- Burst rate limit: max 3 emails per 60 seconds per user (in-memory)

**My Documents integration:**
- Email badge (Sent/Delivered/Opened/Bounced) on each document card
- "N sent · N opened" clickable summary inline
- Expandable email history with individual send records and timestamps
- "Stop Reminders" button in expanded panel
- "Cancel Payment Link" button in expanded payment panel (also stops reminders)
- View count tracking: increments when client opens `/view/` or `/pay/` page

### Architecture

```
User clicks "Send via Email"
        ↓
SendEmailDialog (2-step: Compose → Confirm)
        ↓
POST /api/emails/send-document
  1. authenticateRequest() — JWT validation
  2. Burst rate limit (3/60s in-memory)
  3. Monthly tier limit (checkEmailLimit)
  4. UUID validation on sessionId
  5. Fetch document_sessions (verify ownership)
  6. Fetch businesses (sender name + logo)
  7. Auto-create Razorpay payment link if invoice + no active link
  8. Render HTML email (lib/email-template.ts)
  9. Send via Mailtrap REST API (lib/mailtrap.ts)
  10. Insert into document_emails (status: "sent")
  11. Lock document session (status: "finalized", sent_at)
  12. Schedule follow-up reminders (email_schedules table)
  13. logAudit("email.send")
        ↓
Mailtrap delivers email to client
        ↓
POST /api/emails/webhook (Mailtrap delivery callbacks)
  - Verifies HMAC signature
  - Updates document_emails status (delivered/opened/bounced)
        ↓
Supabase Edge Function: process-email-schedules
  - Runs daily at 8AM UTC via pg_cron
  - Sends follow-up reminders at day +3, +7, +14, +30
  - Stops automatically when invoice_payments.status = "paid"
```

### Files Created

| File | Purpose |
|------|---------|
| `lib/mailtrap.ts` | Email sending via Mailtrap REST API (plain `fetch()`) |
| `lib/email-template.ts` | Branded HTML email renderer (inline CSS, table layout, mobile-responsive) |
| `app/api/emails/send-document/route.ts` | Main send endpoint (auth, validation, send, record, schedule) |
| `app/api/emails/webhook/route.ts` | Mailtrap delivery webhook handler (HMAC verified) |
| `app/api/emails/validate-email/route.ts` | DNS MX record validation |
| `app/api/emails/generate-message/route.ts` | AI-generated personal message (sanitized inputs) |
| `app/api/emails/schedules/route.ts` | GET/DELETE follow-up schedule management |
| `app/api/emails/track-view/route.ts` | Document view tracking (public, 60s throttle) |
| `app/api/emails/view-document/route.ts` | Public document view for email recipients |
| `components/send-email-dialog.tsx` | 2-step send dialog component |
| `supabase/migrations/document_emails.sql` | `document_emails` table with RLS |
| `supabase/migrations/email_schedules.sql` | `email_schedules` table for follow-ups |

### Database Schema

```sql
-- document_emails: tracks every email sent
CREATE TABLE document_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice','contract','quotation','proposal')),
  personal_message TEXT,
  mailtrap_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent','delivered','opened','bounced','failed')),
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: users SELECT/INSERT own records; webhook uses service role for UPDATE

-- email_schedules: automated follow-up reminders
CREATE TABLE email_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  document_type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sequence_step INTEGER NOT NULL DEFAULT 1,
  sequence_type TEXT NOT NULL DEFAULT 'followup'
    CHECK (sequence_type IN ('pre_due','due_today','followup','final')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled','failed')),
  sent_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Environment Variables Required

```bash
MAILTRAP_API_KEY=your_mailtrap_api_key
MAILTRAP_WEBHOOK_SIGNATURE_KEY=your_webhook_secret  # recommended
```

### Process Followed

1. **Spec-driven development** — Full requirements (11 requirements, 50+ acceptance criteria), design (10 correctness properties, architecture diagram, data models), and tasks documents in `.kiro/specs/email-sending/`
2. **Mailtrap chosen over Resend** — Plain `fetch()` required for Cloudflare Workers; Mailtrap REST API works without any npm packages
3. **Mobile-first email template** — Reduced outer padding, system font stack, buttons stack vertically on mobile, tested in Gmail/Outlook/Apple Mail
4. **Security-first** — Burst rate limiting, UUID validation, HMAC webhook verification, prompt injection prevention on AI message generation
5. **4 security audit passes** — 17 vulnerabilities found and fixed across the codebase during implementation

---

## Remaining Gaps (Build These Next)

### 3. 🟠 Quotation Accept/Decline Flow

**The problem:** Quotations are sent as PDFs. Clients have no way to accept or decline online.

**What to build:**
- Shareable quotation link (reuse `/pay/[sessionId]` pattern)
- On the viewer page: Accept / Decline / Request Changes buttons
- On Accept: record acceptance, notify user, optionally auto-generate invoice
- On Decline: record decline with optional reason, notify user
- On Request Changes: client types a message, user gets notified

**Estimated effort:** 3-4 days. Reuses the public page infrastructure from payment links.

---

### 4. 🟡 E-Signature Upgrade — Legal Compliance & Audit Trail

**The problem:** Current signature system captures drawn signatures but lacks the legal audit trail required for contracts to be enforceable.

**What to build:**
- Consent checkbox before signing
- Document fingerprint (SHA-256 hash stored before signing)
- Certificate page auto-appended to signed PDF
- Multi-party signing workflow (Party A → Party B)
- Signing deadline with expiry
- Verification URL: `clorefy.com/verify/[hash]`

**Option A (Recommended):** Integrate [DocuSeal](https://www.docuseal.com/) API — open-source, free tier, returns signed PDF with audit trail.

**Estimated effort:** 4-5 days.

---

### 5. 🟡 Recurring Invoices

**The problem:** Freelancers with retainer clients manually create the same invoice every month.

**What to build:**
- "Make Recurring" toggle on any invoice
- Frequency: weekly / monthly / quarterly / annually
- Auto-generate invoice on schedule
- Auto-send to client email (optional)
- Auto-create payment link (optional)
- Recurring invoice dashboard

**Estimated effort:** 4-5 days.

---

## Important Integrations

### 6. 🔗 Accounting Software Integration

**Phase 1 — Export only:**
- Export invoices in Tally-compatible format (XML) — huge for India
- Export in QuickBooks IIF format
- Export in Xero CSV format

**Phase 2 — Sync:**
- Tally Prime integration (via Tally XML gateway)
- QuickBooks Online OAuth integration

**Why Tally matters:** 90% of Indian SMBs use Tally. Direct export makes Clorefy indispensable.

---

### 7. 🔗 Stripe & Cashfree Payment Links

**Current state:** Razorpay payment links are fully implemented. Stripe and Cashfree gateway settings exist in the UI, but payment link creation only works with Razorpay.

**What to build:**
- Stripe Checkout Session creation for payment links
- Cashfree Payment Links API integration
- Gateway auto-selection based on user's connected gateway

**Estimated effort:** 2-3 days per gateway.

---

## Quick Wins (< 1 day each)

### ✅ DONE: WhatsApp Share Button
- `wa.me` deep link with pre-filled message including platform link

### ✅ DONE: Copy Payment Link Button
- One-click copy of the platform link, shows "Copied!" toast

### ✅ DONE: Invoice Status Tracking
- Status badges: Draft → Sent → Paid
- Filter documents by status on documents page

### ✅ DONE: Duplicate Document (via linked sessions)
- Document linking creates new sessions with seed data pre-filled

### 8. Bulk PDF Download
- Select multiple documents → "Download All as ZIP"
- Useful for accountants at month-end
- **Estimated effort:** 4-6 hours

---

## Updated Priority Order

### ✅ Month 1 — Complete the Revenue Loop (DONE)
1. ✅ Email integration (Mailtrap) — send invoices/documents directly from Clorefy
2. ✅ Send invoice via email — "Send" button with branded template + payment link
3. ✅ Invoice payment reminders — automated follow-up sequence
4. ✅ Security hardening — 4 audit passes, 17 vulnerabilities fixed

### Month 2 — Close Deals Faster
5. **Quotation accept/decline flow** — online acceptance with notifications
6. **Proposal engagement features** — web viewer + accept/decline + tracking
7. **Stripe payment links** — expand beyond Razorpay
8. **Cashfree payment links** — complete multi-gateway support

### Month 3 — Retention & Stickiness
9. **E-signature upgrade** (DocuSeal API) — legal compliance
10. **Recurring invoices** — retainer clients
11. **Tally export** — India accounting integration

### Month 4+ — Ecosystem
12. **Interactive proposal pricing** — client selects add-ons
13. **Custom domain for share links** — white-label
14. **Multi-party signing workflow** — contracts

---

## Competitive Positioning (Current State)

| | Wave | FreshBooks | PandaDoc | Proposify | **Clorefy (now)** |
|--|------|-----------|----------|-----------|-------------------|
| AI generation | ❌ | ❌ | ❌ | ❌ | ✅ |
| 11 countries | ❌ | Partial | ❌ | ❌ | ✅ |
| Payment links | ✅ | ✅ | ✅ | ❌ | ✅ |
| Public pay page | ❌ | ❌ | ❌ | ❌ | ✅ |
| WhatsApp share | ❌ | ❌ | ❌ | ❌ | ✅ |
| View tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| E-signature | ❌ | ❌ | ✅ | ✅ | Partial |
| Proposal tracking | ❌ | ❌ | ✅ | ✅ | ❌ |
| Quote acceptance | ❌ | ❌ | ✅ | ✅ | ❌ |
| Recurring invoices | ✅ | ✅ | ❌ | ❌ | ❌ |
| Email sending | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment reminders | ✅ | ✅ | ✅ | ❌ | ✅ |
| Price | Free/$16 | $8.40+ | $19+ | $49+ | **$9-$59** |

**Current pitch:** "Generate, send, track, and get paid — all from one AI-powered platform. For 11 countries, at half the price of PandaDoc." ✅ **ACHIEVED**

---

## Technical Notes

### Email: Mailtrap (IMPLEMENTED)
- Plain `fetch()` — no npm packages, Cloudflare Workers compatible
- Webhook for delivery events (sent, delivered, bounced, opened)
- Free: 1,000 emails/month; paid plans from $15/mo
- [mailtrap.io](https://mailtrap.io)

### E-Sign: DocuSeal (Month 3)
```
POST https://api.docuseal.com/submissions
Authorization: Token YOUR_API_KEY
```
- Free sandbox, $20/mo production
- Returns signed PDF with audit trail
- [docuseal.com/signing-api](https://www.docuseal.com/signing-api)

### Payment Links: Razorpay (IMPLEMENTED)
```
POST https://api.razorpay.com/v1/payment_links
```
- Uses user's own Razorpay API keys (stored encrypted in `user_payment_settings`)
- Webhook per user: `/api/razorpay/webhook/[userId]`
- Signature verification using user's webhook secret

---

*Content was researched from: [ironcladapp.com](https://ironcladapp.com/journal/electronic-signature-guide), [docuseal.com](https://www.docuseal.com/), [razorpay.com](https://razorpay.com/payment-links/), [copyprogramming.com](https://copyprogramming.com/howto/create-proposals), [invoicemojo.com](https://invoicemojo.com/invoicing/invoice-follow-up-sequences/), [sendnow.live](https://sendnow.live/blog/how-to-track-client-proposals), [signnow.com](https://shop.signnow.com/blog/electronic-signature-best-practices/)*
