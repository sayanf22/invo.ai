# Clorefy — Product Roadmap

> Last updated: April 2026

---

## What's Built

- ✅ AI document generation (invoice, contract, quotation, proposal) — 11 countries
- ✅ Country-compliant tax rules (GST, VAT, USt, TVA, etc.)
- ✅ Digital signatures — legally defensible with document fingerprinting (SHA-256), audit trail, certificate page, verification URL (`/verify/[signatureId]`), Decline + Request Revision via signing link
- ✅ Quotation Accept / Decline / Request Changes flow — clients respond directly from the public view page, owner gets in-app notifications
- ✅ Client management (CRUD, CSV import/export, AI chat)
- ✅ Document linking (invoice → contract → quotation chain)
- ✅ 9 PDF templates, multi-format export (PDF, DOCX, Image)
- ✅ Razorpay subscription billing
- ✅ Admin dashboard — users, revenue, AI usage, security, email stats per user and platform-wide
- ✅ Session history
- ✅ Payment links on invoices (Razorpay, Stripe, Cashfree)
- ✅ Public payment page (`/pay/[sessionId]`) — clients pay without logging in
- ✅ WhatsApp share + copy payment link
- ✅ Invoice status tracking (Draft → Sent → Paid)
- ✅ Document view tracking (how many times client opened the link)
- ✅ Paid document lock (permanently read-only after payment)
- ✅ Send Invoice/Document via Email — all 4 document types
- ✅ Automated payment reminders (day +3, +7, +14, +30 — stops on payment)
- ✅ Email delivery tracking (sent → delivered → opened → bounced)
- ✅ Email follow-up management (stop reminders, view history per document)
- ✅ Tier-based email limits enforced (Free: 5/mo, Starter: 100/mo, Pro: 250/mo, Agency: unlimited)
- ✅ Custom logo & branding available on all tiers (Free, Starter, Pro, Agency)
- ✅ Session history: 30 days on Free & Starter, 1 year on Pro, Forever on Agency
- ✅ Auto-send invoice on contract signing — toggle in Send dialog (off for free, on for paid), signer sees notice before signing, invoice auto-sent on completion
- ✅ Stripe & Cashfree payment links for invoices — gateway auto-selected by currency (Razorpay for INR, Stripe for global, Cashfree as INR fallback)
- ✅ Security hardening (4 audit passes, 17 vulnerabilities fixed)
- ✅ Consistent loading screens and back navigation fixes

---

## ✅ How the E-Signature Upgrade Was Implemented

The goal was to turn the basic drawn-signature capture into a legally defensible signing workflow that satisfies ESIGN (USA), eIDAS (EU), IT Act (India), and equivalent laws in all 11 supported countries.

### What the user experiences

A "Get Signature" button appears in the document toolbar for contracts, quotations, and proposals. Clicking it opens a modal where the owner enters the signer's name, email, party/role, and an optional personal message. On submit, a signing invitation email is sent to the signer — if the email fails, the signature record is never created (atomic operation). The toolbar then shows a "Pending Signature" amber badge. When all parties have signed, it switches to a green "Signed" badge and a "Download Signed PDF" button appears.

Signers receive a branded email with a "Sign Document" button. The signing page shows the document preview, the business logo, the expiry date, and a consent checkbox with exact legal text. After signing, a confirmation screen shows the signing timestamp and a verification URL.

**Decline and Request Revision**: The signing page also has "Decline" and "Request Changes" buttons. Declining sends a notification to the owner with an optional reason. Requesting changes requires a description — the owner is notified and can send a revised version.

### How it works under the hood

**Document fingerprinting**: At signing request creation, a SHA-256 hash of the canonical document JSON (`document_sessions.context`, keys sorted recursively) is computed server-side and stored in `signatures.document_hash`. At submission time, the hash is recomputed and compared — a mismatch returns 409 and records a `signature.tamper_detected` audit event.

**Audit trail**: Every lifecycle event (request_created, viewed, signed, completed, expired, tamper_detected, abuse_detected, r2_fallback, declined, revision_requested) is written to `signature_audit_events` — an append-only table enforced by RLS (INSERT for service_role only, no UPDATE/DELETE policies).

**Certificate page**: When all signers complete, a `CertificatePDF` react-pdf component generates a certificate page with signer table (name, email, party, signed_at UTC, masked IP), full SHA-256 hash, verification URL, and legal statement. It's stored in R2 at `certificates/[documentId]_certificate.pdf`.

**Signed PDF download**: `GET /api/signatures/download/[sessionId]` generates the original document PDF via react-pdf, fetches the certificate from R2, and merges them using `pdf-lib`. The filename follows `[ref]_signed_[YYYY-MM-DD].pdf`.

**Verification page**: `/verify/[signatureId]` is a public server component that shows signer name, email, signed_at, document type, hash (first 16 chars), and a verified/not-verified badge. It never exposes the full hash, IP address, or signature image URL.

**Security**: Token format validated with `^sign_[0-9a-f]{32}$` before any DB lookup. Attempt count enforced (max 5 before 410 + abuse_detected event). Expiry is exactly `created_at + 604800 seconds`.

### Quotation response flow

Accept / Decline / Request Changes buttons appear on the public view page for quotation documents. Each action opens a dialog collecting client name, email, and optional/required reason. Responses are stored in `quotation_responses` (public INSERT, owner SELECT only via RLS). The owner receives in-app notifications with the full reason in metadata.

---

## ✅ How Recurring Invoices Were Implemented

Freelancers with retainer clients can mark any invoice as recurring directly from the My Documents page or during the Send Email flow.

### What the user experiences

Every invoice card in My Documents has a loop (↻) icon button. Clicking it expands a panel with an on/off toggle and a frequency selector (Weekly / Monthly / Quarterly). When active, the next run date is shown. The same toggle appears in the Send Email confirm step for invoices.

### How it works under the hood

A `recurring_invoices` table stores the schedule per invoice session. A daily cron job (`POST /api/recurring/process`, protected by `CRON_SECRET`) finds all active recurring invoices due today and:
- Creates a new linked `document_sessions` with an auto-incremented invoice number (INV-001 → INV-002) and updated issue/due dates
- Creates a `document_links` record with `relationship: 'recurring'`
- Updates `next_run_at`, `last_run_at`, `run_count`
- Sends the owner an in-app notification

---

## ✅ How Auto-Invoice on Contract Signing Was Implemented

When a contract is sent, the owner can enable "Auto-send invoice on signing" in the Send Email confirm step. This is off by default for free tier and on by default for paid tiers.

### What the user experiences

In the Send Email dialog (confirm step), contracts show an "Auto-send invoice on signing" toggle with a green indicator when active. Free tier users see the toggle disabled with a "Paid" badge. When enabled, the signer sees a blue notice on the signing page: "By signing this contract, an invoice will be automatically generated and sent to your email address." After signing, the confirmation screen confirms the invoice was sent.

### How it works under the hood

The setting is stored as `auto_invoice_on_sign` and `invoice_recipient_email` on `document_sessions`. When all signers complete a contract (`POST /api/signatures/sign`), the `triggerAutoInvoice()` function:
- Creates a linked invoice session copying client data, items, and currency from the contract
- Sets invoice number, issue date (today), due date (Net 30)
- Sends the invoice email via Mailtrap
- Creates a `document_links` record with `relationship: 'auto_invoice'`
- Notifies the owner: "Invoice INV-XXXX was automatically sent to client@email.com after contract signing"

The `GET /api/signatures?token=` endpoint returns `autoInvoiceOnSign` so the signing page can show the notice before the signer commits.

---

## ✅ How Payment Links Were Implemented

The goal was to let users collect payments directly from their invoices without any manual steps.

### What the user experiences

Every invoice has a "Get Payment Link" button in the toolbar. Clicking it shows a confirmation dialog with the amount, client name, and a warning that the invoice will be locked. Once confirmed, a payment link is created and the invoice becomes read-only. The user gets Copy and WhatsApp share buttons, a refresh button to check payment status, and a cancel button (with its own confirmation modal listing the consequences).

Clients receive a link to `/pay/[sessionId]` — a public page that shows the invoice, the amount due, a Pay Now button, and a QR code. No login required. When the client pays, the invoice is permanently marked as paid and all email reminders stop.

### How it works under the hood

Payment links are created via the **Razorpay Payment Links API** using the user's own Razorpay keys — money goes directly to their account, not through Clorefy. The platform link (`clorefy.com/pay/[sessionId]`) is what gets shared, not the raw Razorpay URL.

Payment status updates happen via **webhooks** from Razorpay, Stripe, and Cashfree. Each user gets their own webhook endpoint so events are routed correctly. When a payment comes in, the webhook updates the invoice status, sends the user a notification, and cancels any pending email reminders.

---

## ✅ How Email Sending Was Implemented

The goal was to close the full loop: **generate → send → track → get paid** — all without leaving Clorefy.

### What the user experiences

A "Send via Email" button sits in the document toolbar and the Share dropdown. Clicking it opens a 2-step dialog: first you compose (recipient email, subject, optional personal message), then you confirm and send. The personal message can be AI-generated or typed manually. For invoices, a "Pay Now" button is automatically included in the email.

### How it works under the hood

Emails are sent via the **Mailtrap REST API** using plain `fetch()` — no npm packages needed, which keeps it compatible with Cloudflare Workers. The email template is built with inline CSS and table-based layout so it renders correctly in Gmail, Outlook, and Apple Mail on both desktop and mobile.

When an email is sent, the system records it in the database, locks the document as "finalized," and schedules automated follow-up reminders (day +3, +7, +14, +30). If the invoice gets paid at any point, all pending reminders are cancelled automatically.

Delivery status (sent → delivered → opened → bounced) is tracked via **Mailtrap webhooks**. Monthly email limits are enforced via `checkEmailLimit()` reading `user_usage.emails_count`.

---

## What's Next

### 🔵 Accounting Software Export
Tally XML export for Indian SMBs, QuickBooks IIF, and Xero CSV. 90% of Indian businesses use Tally — this would make Clorefy indispensable for that market.

### 🔵 Team Members (Agency tier)
The Agency tier advertises 3 team members but the feature isn't built yet. Shared workspace with role-based access (owner, editor, viewer) is the next major feature for the Agency tier.

### 🔵 Multi-language Documents
Currently all documents are generated in English. Adding language selection (Hindi, German, French, Dutch, Arabic) would unlock the full potential of the 11-country support.

### 🔵 Client Portal
A dedicated portal where clients can view all their documents, sign contracts, pay invoices, and respond to quotations — all in one place without needing separate links.

---

## Competitive Position

| | Wave | FreshBooks | PandaDoc | Proposify | **Clorefy** |
|--|------|-----------|----------|-----------|-------------|
| AI generation | ❌ | ❌ | ❌ | ❌ | ✅ |
| 11 countries | ❌ | Partial | ❌ | ❌ | ✅ |
| Payment links | ✅ | ✅ | ✅ | ❌ | ✅ (Razorpay + Stripe + Cashfree) |
| Public pay page | ❌ | ❌ | ❌ | ❌ | ✅ |
| Email sending | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment reminders | ✅ | ✅ | ✅ | ❌ | ✅ |
| View tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| E-signature (legal) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quote acceptance | ❌ | ❌ | ✅ | ✅ | ✅ |
| Recurring invoices | ✅ | ✅ | ❌ | ❌ | ✅ |
| Auto-invoice on sign | ❌ | ❌ | ✅ | ❌ | ✅ |
| Price | Free/$16 | $8.40+ | $19+ | $49+ | **$9–$59** |

**Pitch:** Generate, send, track, and get paid — all from one AI-powered platform. For 11 countries, at half the price of PandaDoc.
