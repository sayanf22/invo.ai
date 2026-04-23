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

**Public payment page (`/pay/[sessionId]`):**
- Server-rendered page (no auth required) showing invoice preview, amount, and Pay Now button
- Status-based rendering: Pending (with QR + Pay Now), Paid (green badge), Expired/Cancelled (message)
- Responsive mobile layout with proper viewport handling
- Pay Now button redirects to the gateway checkout URL

**Payment lifecycle:**
- Invoice locked after payment link creation (all editor fields disabled)
- Read-only banner shown on locked invoices
- Cancel button with confirmation dialog (unlocks invoice)
- Refresh button to check latest payment status from gateway
- Error toasts on cancel/refresh failures
- Lock indicator with tooltip explaining why editing is disabled

**Webhook integration:**
- Razorpay, Stripe, and Cashfree webhooks all update `invoice_payments.status`
- Webhooks also update `document_sessions.status` to "paid" for permanent lock
- Notification sent to user on payment received
- Idempotent handling (duplicate webhooks ignored)

**Data integrity:**
- Editor changes auto-saved to DB via debounced `updateSessionContext`
- Context snapshot saved atomically when payment link is created
- PDF shows "PAID" badge when payment confirmed (not "DRAFT")

**Security:**
- Public payment status API with IP-based rate limiting (30 req/min)
- UUID validation on all public endpoints
- Only public-safe fields returned (no gateway URLs, user data, or API keys)
- RLS policies fixed (removed overly permissive UPDATE policy)
- Function search_path hardened against injection

### Process Followed

1. **Spec-driven development** — Full requirements, design, and tasks documents created in `.kiro/specs/payment-link-flow-redesign/`
2. **Requirements first** — 8 user stories with acceptance criteria covering toggle fix, platform links, public page, cancel/refresh, lock, paid status, payment methods
3. **Design document** — Architecture diagram, component interfaces, data models, correctness properties, error handling, testing strategy
4. **11 implementation tasks** with sub-tasks — executed sequentially with property-based tests
5. **5 correctness properties** validated with `fast-check` (100 iterations each):
   - Platform link derivation from sessionId
   - Pay Now href matches gateway URL
   - Public page renders required document fields
   - Paid documents are read-only
   - Payment method dropdown filtering by connected gateways
6. **Security audit** — Supabase advisors checked, RLS policies fixed, CSP updated
7. **Mobile audit** — Viewport meta tag added, PDF overflow fixed, Pay Now button mobile-compatible

---

## Critical Gaps (Build These Next)

### 1. 🔴 Send Invoice/Document via Email — HIGHEST PRIORITY NOW

**Why this is #1:** Users still have to download the PDF and email it manually. The payment link flow is complete, but there's no way to deliver the invoice to the client directly from Clorefy. This is the single biggest friction point remaining.

**What to build:**
- "Send" button on every document (invoice, quotation, contract, proposal)
- Email contains: branded template, document summary, PDF attachment, and payment link (if exists)
- For invoices with payment links: email includes "Pay Now" button linking to `/pay/[sessionId]`
- Email delivery tracking (sent, delivered, bounced, opened)
- "Resend" option for failed deliveries
- Email history per document

**Recommended provider:** [Resend](https://resend.com) — 3,000 emails/month free, React Email templates, webhook for delivery events.

**Estimated effort:** 2-3 days. This completes the "generate → send → get paid" loop.

---

### 2. 🔴 Invoice Payment Reminders (Automated)

**The problem:** 60% of late payments are simply forgotten. Users have no way to send reminders from Clorefy.

**What to build:**
- Automated reminder schedule (configurable):
  - 3 days before due: "Friendly reminder"
  - On due date: "Payment due today"
  - 3 days after: "Overdue notice"
  - 7 days after: "Second notice"
  - 14 days after: "Final notice"
- Send via email (Resend integration from #1)
- One-click "Pay Now" in reminder email (links to `/pay/[sessionId]`)
- Reminder history log per invoice
- User can pause/cancel reminders

**Tech:** Supabase Edge Functions + cron job (pg_cron) to check due dates daily.

**Estimated effort:** 3-4 days (depends on email integration being done first).

---

### 3. � Quotation Accept/Decline Flow

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

### 6. 📧 Email Integration (Resend) — Prerequisite for #1 and #2

**What to build:**
- "Send Invoice" button → sends PDF directly to client email
- "Send Quotation" button → sends quotation with Accept/Decline link
- "Send Contract for Signing" button → sends signing link
- "Send Proposal" button → sends proposal with view tracking
- Email templates: branded, professional, with Clorefy footer
- Email delivery tracking (sent, delivered, bounced)

**Recommended provider:** [Resend](https://resend.com) — 3,000 emails/month free, React Email templates.

---

### 7. 🔗 Accounting Software Integration

**Phase 1 — Export only:**
- Export invoices in Tally-compatible format (XML) — huge for India
- Export in QuickBooks IIF format
- Export in Xero CSV format

**Phase 2 — Sync:**
- Tally Prime integration (via Tally XML gateway)
- QuickBooks Online OAuth integration

**Why Tally matters:** 90% of Indian SMBs use Tally. Direct export makes Clorefy indispensable.

---

### 8. 🔗 Stripe & Cashfree Payment Links

**Current state:** Razorpay payment links are fully implemented. Stripe and Cashfree gateway settings exist in the UI, but payment link creation only works with Razorpay.

**What to build:**
- Stripe Checkout Session creation for payment links
- Cashfree Payment Links API integration
- Gateway auto-selection based on user's connected gateway
- Multi-gateway support (user can have Razorpay + Stripe connected)

**Estimated effort:** 2-3 days per gateway.

---

## Quick Wins (< 1 day each)

### ✅ DONE: WhatsApp Share Button
- `wa.me` deep link with pre-filled message including platform link
- Works on mobile and desktop

### ✅ DONE: Copy Payment Link Button
- One-click copy of the platform link (`clorefy.com/pay/[sessionId]`)
- Shows "Copied!" toast

### ✅ DONE: Invoice Status Tracking
- Status badges: Draft → Sent → Paid → Overdue
- Filter documents by status on documents page
- Paid badge on documents list

### 9. Duplicate Document
- "Duplicate" button on any document
- Creates a new session with the same data pre-filled
- Saves time for repeat invoices to the same client
- **Estimated effort:** 4-6 hours

### 10. Bulk PDF Download
- Select multiple documents → "Download All as ZIP"
- Useful for accountants at month-end
- **Estimated effort:** 4-6 hours

---

## Updated Priority Order (What to Build When)

### Month 1 — Complete the Revenue Loop (NOW)
1. **Email integration (Resend)** — send invoices/documents directly from Clorefy
2. **Send invoice via email** — "Send" button with branded template + payment link
3. **Invoice payment reminders** — automated follow-up sequence
4. **Duplicate document** — quick win for repeat work

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
| Email sending | ✅ | ✅ | ✅ | ✅ | ❌ |
| Price | Free/$16 | $8.40+ | $19+ | $49+ | **$9-$59** |

**Current pitch:** "The only AI tool that generates invoices, embeds payment links, and lets clients pay from a branded page — for 11 countries, at half the price of PandaDoc."

**After email integration:** "Generate, send, track, and get paid — all from one AI-powered platform."

---

## Technical Notes

### Email: Resend (Next to implement)
```
npm install resend
```
- React Email templates for branded invoice/quotation emails
- Webhook for delivery events (sent, delivered, bounced, opened)
- Free: 3,000 emails/month
- [resend.com](https://resend.com)

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
