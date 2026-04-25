# Clorefy — Product Roadmap

> Last updated: April 2026

---

## What's Built

- ✅ AI document generation (invoice, contract, quotation, proposal) — 11 countries
- ✅ Country-compliant tax rules (GST, VAT, USt, TVA, etc.)
- ✅ Digital signatures (token-based, drawn signature)
- ✅ Client management (CRUD, CSV import/export, AI chat)
- ✅ Document linking (invoice → contract → quotation chain)
- ✅ 9 PDF templates, multi-format export (PDF, DOCX, Image)
- ✅ Razorpay subscription billing
- ✅ Admin dashboard
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
- ✅ Tier-based email limits (Free: 5, Starter: 100, Pro: 250, Agency: unlimited)
- ✅ Security hardening (4 audit passes, 17 vulnerabilities fixed)
- ✅ Consistent loading screens and back navigation fixes

---

## ✅ How Email Sending Was Implemented

The goal was to close the full loop: **generate → send → track → get paid** — all without leaving Clorefy.

### What the user experiences

A "Send via Email" button sits in the document toolbar and the Share dropdown. Clicking it opens a 2-step dialog: first you compose (recipient email, subject, optional personal message), then you confirm and send. The personal message can be AI-generated or typed manually. For invoices, a "Pay Now" button is automatically included in the email. If no payment link exists yet, one is auto-created at send time using the user's connected Razorpay account.

### How it works under the hood

Emails are sent via the **Mailtrap REST API** using plain `fetch()` — no npm packages needed, which keeps it compatible with Cloudflare Workers. The email template is built with inline CSS and table-based layout so it renders correctly in Gmail, Outlook, and Apple Mail on both desktop and mobile.

When an email is sent, the system records it in the database, locks the document as "finalized," and schedules automated follow-up reminders. The reminder schedule follows industry standard: day +3, +7, +14, and +30. These run via a **Supabase Edge Function** triggered daily by a cron job. If the invoice gets paid at any point, all pending reminders are cancelled automatically.

Delivery status (sent → delivered → opened → bounced) is tracked via **Mailtrap webhooks**. Every incoming webhook is signature-verified before processing. The My Documents page shows email stats inline — how many were sent, how many opened — and lets users stop reminders or cancel the payment link directly from the document list.

### Security

Every send is authenticated, rate-limited (burst: 3 per minute, monthly: tier-based), and the session ownership is verified before anything is sent. All user-provided inputs are sanitized before being injected into the AI prompt or email body. Webhook endpoints verify HMAC signatures. Public document view pages only serve documents that have actually been sent.

---

## What's Next

### 🟠 Quotation Accept/Decline Flow
Clients currently receive quotations as PDFs with no way to respond online. The plan is to add Accept / Decline / Request Changes buttons to the public quotation view page, with notifications back to the user and optional auto-invoice generation on acceptance.

### 🟡 E-Signature Upgrade
The current signature system works but lacks a legal audit trail. The upgrade would add a document fingerprint, a certificate page appended to the signed PDF, and a verification URL — using the DocuSeal API.

### 🟡 Recurring Invoices
Freelancers with retainer clients need to create the same invoice every month. A "Make Recurring" toggle with configurable frequency (weekly/monthly/quarterly) would auto-generate and optionally auto-send invoices on schedule.

### 🔵 Accounting Software Export
Tally XML export for Indian SMBs, QuickBooks IIF, and Xero CSV. 90% of Indian businesses use Tally — this would make Clorefy indispensable for that market.

### 🔵 Stripe & Cashfree Payment Links
Razorpay payment links are fully working. Stripe and Cashfree are connected for subscriptions but not yet for invoice payment links. Extending support to both gateways is the next step.

---

## Competitive Position

| | Wave | FreshBooks | PandaDoc | Proposify | **Clorefy** |
|--|------|-----------|----------|-----------|-------------|
| AI generation | ❌ | ❌ | ❌ | ❌ | ✅ |
| 11 countries | ❌ | Partial | ❌ | ❌ | ✅ |
| Payment links | ✅ | ✅ | ✅ | ❌ | ✅ |
| Public pay page | ❌ | ❌ | ❌ | ❌ | ✅ |
| Email sending | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment reminders | ✅ | ✅ | ✅ | ❌ | ✅ |
| View tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| E-signature | ❌ | ❌ | ✅ | ✅ | Partial |
| Quote acceptance | ❌ | ❌ | ✅ | ✅ | ❌ |
| Recurring invoices | ✅ | ✅ | ❌ | ❌ | ❌ |
| Price | Free/$16 | $8.40+ | $19+ | $49+ | **$9–$59** |

**Pitch:** Generate, send, track, and get paid — all from one AI-powered platform. For 11 countries, at half the price of PandaDoc.
