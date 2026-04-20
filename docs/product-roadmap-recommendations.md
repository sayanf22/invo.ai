# Clorefy — Product Roadmap & Feature Recommendations

> Research-backed recommendations for what to build next to make Clorefy a no-brainer choice over Wave, FreshBooks, PandaDoc, and Proposify.
> Based on competitor analysis, industry best practices, and gap analysis of the current product.

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

---

## Critical Gaps (Build These First)

### 1. 🔴 Payment Links on Invoices — HIGHEST PRIORITY

**The problem:** Users generate invoices but have no way to collect payment through Clorefy. They have to manually share bank details or UPI IDs. This is the #1 reason users churn to FreshBooks or Wave.

**What to build:**
- "Add Payment Link" button on every invoice
- Razorpay Payment Links API integration — generate a payment link tied to the invoice amount
- Embed the payment link in the PDF and in the shareable invoice URL
- Webhook: when payment is received, mark invoice as **Paid** with timestamp
- Payment status badge on invoice: `Unpaid` → `Partially Paid` → `Paid`
- Payment history log per invoice

**Why it matters:** Razorpay Payment Links API is already available (you use Razorpay for subscriptions). This is a 2-3 day integration that transforms Clorefy from a document tool into a payment collection tool. Competitors like Wave and FreshBooks charge $0 for this — it's table stakes.

**Industry data:** Invoices with embedded payment links get paid 3x faster than those without. ([Source: Razorpay docs](https://razorpay.com/payment-links/))

---

### 2. 🔴 E-Signature Upgrade — Legal Compliance & Audit Trail

**The problem:** Your current signature system captures drawn signatures but lacks the legal audit trail required for contracts to be enforceable in most jurisdictions.

**Legal requirements for a valid e-signature (ESIGN Act / eIDAS / IT Act India):**
1. **Intent to sign** — signer must actively choose to sign
2. **Consent to electronic business** — explicit consent recorded
3. **Association** — signature must be cryptographically linked to the document
4. **Record retention** — full audit trail with timestamps, IP, device

**What to build:**

**Option A (Recommended): Integrate DocuSeal API**
- [DocuSeal](https://www.docuseal.com/) — open-source, free tier, REST API
- Send contracts/agreements for signing via email link
- Signer gets a clean browser-based signing experience (no account needed)
- Returns a signed PDF with embedded certificate
- Full audit trail: timestamp, IP, email, device
- Cost: Free for low volume, $20/mo for higher volume — far cheaper than DocuSign ($120/yr)

**Option B: Build it yourself (harder)**
- Generate a document hash (SHA-256) before signing
- Store hash + signer metadata + timestamp in Supabase
- Embed certificate page in the PDF after signing
- Issue a verification URL: `clorefy.com/verify/[hash]`

**Recommended flow for contracts:**
```
Generate Contract → Share Link → Signer opens link → 
Consent checkbox → Draw/type signature → 
System records: IP, timestamp, email, document hash → 
Both parties receive signed PDF with certificate page
```

**For India specifically:** The IT Act 2000 recognizes electronic signatures. For high-value contracts, recommend users use Aadhaar-based e-sign (DigiLocker) — add a note in the UI.

---

### 3. 🔴 Invoice Payment Reminders (Automated)

**The problem:** 60% of late payments are simply forgotten. Users have no way to send reminders from Clorefy.

**What to build:**
- Set due date on invoice (already in the data model)
- Automated reminder schedule (configurable):
  - 3 days before due: "Friendly reminder"
  - On due date: "Payment due today"
  - 3 days after: "Overdue notice"
  - 7 days after: "Second notice"
  - 14 days after: "Final notice"
- Send via email (Resend/SendGrid integration)
- One-click "Mark as Paid" from reminder email
- Reminder history log per invoice
- User can pause/cancel reminders

**Industry best practice:** The optimal sequence is pre-due → due date → +3 → +7 → +14 → +30 days. Tone escalates from friendly to firm. ([Source: invoicemojo.com](https://invoicemojo.com/invoicing/invoice-follow-up-sequences/))

**Tech:** Supabase Edge Functions + cron job (pg_cron) to check due dates daily. Email via Resend (free tier: 3,000 emails/month).

---

### 4. 🟡 Document Sharing & View Tracking

**The problem:** Users send PDFs via email and have no idea if the client opened them. This is a major pain point for proposals and quotations.

**What to build:**
- "Share" button generates a unique tracked link: `clorefy.com/view/[token]`
- Client opens the link → sees the document in a clean browser viewer (no download required)
- User gets notified: "Your proposal was opened by [client] at 2:34 PM"
- Analytics per document:
  - First opened: timestamp
  - Total views: count
  - Time spent: seconds
  - Device: mobile/desktop
- For proposals: page-by-page view tracking (which sections they spent time on)
- Optional: password-protect the share link
- Optional: set link expiry date

**Why it matters:** Proposal tracking tools show 20% higher win rates because reps can follow up at the exact right moment. ([Source: copyprogramming.com](https://copyprogramming.com/howto/create-proposals))

**Tech:** Cloudflare Workers + R2 for the viewer. Track opens via a 1px pixel or JS beacon. Store events in Supabase.

---

### 5. 🟡 Quotation Accept/Decline Flow

**The problem:** Quotations are sent as PDFs. Clients have no way to accept or decline online. Users have to chase clients via email/WhatsApp.

**What to build:**
- Shareable quotation link (same as document sharing above)
- On the quotation viewer page: **Accept** / **Decline** / **Request Changes** buttons
- On Accept:
  - Record acceptance: timestamp, IP, name, email
  - Notify the user: "Your quotation was accepted by [client]!"
  - Optionally auto-generate an invoice from the accepted quotation
  - Optionally trigger contract creation
- On Decline:
  - Record decline with optional reason
  - Notify user
- On Request Changes:
  - Client types a message
  - User gets notified and can update the quotation

**This is the killer feature for freelancers.** No competitor at this price point does this well.

---

### 6. 🟡 Proposal Engagement Features

**The problem:** Proposals are static PDFs. Modern proposal tools (Proposify, PandaDoc, Qwilr) offer interactive web-based proposals that convert significantly better.

**What to build (phased):**

**Phase 1 (Quick win):**
- Web-based proposal viewer (same as document sharing)
- Accept/Decline buttons (same as quotation flow)
- View tracking

**Phase 2 (Differentiator):**
- Interactive pricing table — client can select optional add-ons
- E-signature on the proposal itself (accept = sign)
- Comments/questions section on the proposal
- Proposal expiry date with countdown

**Phase 3 (Premium):**
- Video embed in proposals (Loom/YouTube)
- Custom domain for proposal links (`proposals.yourbusiness.com`)
- Proposal analytics dashboard

---

### 7. 🟡 Recurring Invoices

**The problem:** Freelancers and agencies with retainer clients have to manually create the same invoice every month. This is a major time sink.

**What to build:**
- "Make Recurring" toggle on any invoice
- Frequency: weekly / monthly / quarterly / annually
- Auto-generate invoice on schedule
- Auto-send to client email (optional)
- Auto-create Razorpay payment link (optional)
- Pause/cancel recurring series
- Recurring invoice dashboard

**Industry data:** Recurring billing reduces manual work by 70% for retainer-based businesses. ([Source: proinvoice.co](https://proinvoice.co/recurring-invoices-for-subscription-businesses/))

---

## Important Integrations

### 8. 📧 Email Integration (Resend)

**Current state:** No email sending from Clorefy. Users have to download PDFs and email them manually.

**What to build:**
- "Send Invoice" button → sends PDF directly to client email
- "Send Quotation" button → sends quotation with Accept/Decline link
- "Send Contract for Signing" button → sends signing link
- "Send Proposal" button → sends proposal with view tracking
- Email templates: branded, professional, with Clorefy footer
- Email delivery tracking (sent, delivered, bounced)

**Recommended provider:** [Resend](https://resend.com) — developer-friendly, 3,000 emails/month free, React Email templates, excellent deliverability.

**Cost:** Free up to 3,000/month, then $20/month for 50,000. Negligible cost.

---

### 9. 🔗 WhatsApp Sharing (India-specific killer feature)

**Why:** India is your primary market. WhatsApp is how Indian businesses communicate with clients. Every competitor ignores this.

**What to build:**
- "Share on WhatsApp" button on every document
- Pre-filled message: "Hi [client name], please find your invoice #INV-001 for ₹5,000 here: [link]"
- Uses WhatsApp Web API (wa.me deep link — no API key needed)
- Works on mobile (opens WhatsApp app) and desktop (opens WhatsApp Web)

**Implementation:** 2 hours. Just a `wa.me` deep link with pre-filled text. Massive UX win for Indian users.

---

### 10. 🔗 Accounting Software Integration

**What to build (Phase 1 — Export only):**
- Export invoices in Tally-compatible format (XML) — huge for India
- Export in QuickBooks IIF format
- Export in Xero CSV format
- Export in Zoho Books format

**What to build (Phase 2 — Sync):**
- Tally Prime integration (via Tally XML gateway)
- QuickBooks Online OAuth integration
- Zoho Books API integration

**Why Tally matters:** 90% of Indian SMBs use Tally. If Clorefy can export directly to Tally, it becomes indispensable for Indian businesses.

---

### 11. 🔗 UPI Payment Integration (India)

**Current state:** Razorpay handles subscriptions. But for invoice payments, UPI is the dominant method in India.

**What to build:**
- Generate UPI payment link for each invoice (Razorpay UPI API)
- Display UPI QR code on the invoice PDF
- "Pay via UPI" button on the shareable invoice link
- Supported: GPay, PhonePe, Paytm, BHIM
- Auto-mark invoice as paid when UPI payment confirmed via webhook

---

## Document-Specific Improvements

### Contracts — E-Sign Best Practices

**Current gaps:**
- No explicit consent recording
- No document hash/certificate
- No audit trail PDF page
- No multi-party signing workflow

**What to add:**
1. **Consent checkbox** before signing: "I agree to sign this document electronically and consent to electronic business"
2. **Document fingerprint**: SHA-256 hash of the document content, stored before signing
3. **Certificate page**: Auto-appended to the signed PDF showing:
   - Signer name, email, IP address
   - Timestamp (UTC)
   - Document hash
   - Verification URL
4. **Multi-party signing**: Party A signs → Party B gets notified → Party B signs → Both get final PDF
5. **Signing deadline**: Set expiry on signing requests
6. **Decline to sign**: Signer can decline with reason

**Legal compliance by country:**
- 🇮🇳 India: IT Act 2000 — electronic signatures valid. For high-value: recommend Aadhaar e-sign
- 🇺🇸 USA: ESIGN Act + UETA — fully valid with intent + consent + record retention
- 🇬🇧 UK: Electronic Communications Act 2000 — valid
- 🇩🇪 Germany: eIDAS — SES (Simple Electronic Signature) valid for most contracts
- 🇦🇺 Australia: Electronic Transactions Act 1999 — valid
- 🇸🇬 Singapore: Electronic Transactions Act — valid
- 🇦🇪 UAE: Federal Law No. 1 of 2006 — valid for most commercial contracts

---

### Quotations — Professional Flow

**Current state:** Quotations are generated as PDFs. No online acceptance flow.

**Industry standard (PandaDoc/Proposify):**
1. Generate quotation → share link
2. Client views online → sees line items, totals, terms
3. Client clicks "Accept Quote" → enters name + email → signs
4. Both parties get confirmation email
5. Quotation auto-converts to invoice (optional)
6. Quotation has validity period (e.g., "Valid for 30 days")

**Add to quotations:**
- Validity date field (already in data model, surface it prominently)
- "Convert to Invoice" one-click button
- Online acceptance flow (see #5 above)
- Optional: allow client to request line item changes

---

### Proposals — Win Rate Features

**What top proposal tools do that Clorefy doesn't:**

| Feature | Proposify | PandaDoc | Clorefy (current) | Clorefy (target) |
|---------|-----------|----------|-------------------|------------------|
| Web viewer | ✅ | ✅ | ❌ | ✅ |
| View tracking | ✅ | ✅ | ❌ | ✅ |
| Accept/Decline | ✅ | ✅ | ❌ | ✅ |
| E-signature | ✅ | ✅ | Partial | ✅ |
| Interactive pricing | ✅ | ✅ | ❌ | Phase 2 |
| Comments | ✅ | ✅ | ❌ | Phase 2 |
| Video embed | ✅ | ❌ | ❌ | Phase 3 |
| AI generation | ❌ | ❌ | ✅ | ✅ |

**The AI generation is your moat.** No competitor generates proposals from a conversation. Build the delivery/tracking layer around it.

---

## Quick Wins (< 1 day each)

### 12. Invoice Status Tracking
- Add status field: `Draft` → `Sent` → `Viewed` → `Paid` → `Overdue`
- Show status badge on document list
- Filter documents by status

### 13. WhatsApp Share Button
- `wa.me` deep link with pre-filled message
- 2 hours to implement, massive UX win for India

### 14. Copy Invoice Link Button
- One-click copy of the shareable document URL
- Shows "Copied!" toast

### 15. Duplicate Document
- "Duplicate" button on any document
- Creates a new session with the same data pre-filled
- Saves time for repeat invoices to the same client

### 16. Invoice Notes to Client
- "Notes to client" field (separate from internal notes)
- Appears on the PDF and shareable link
- Pre-fill with payment instructions

### 17. Bulk PDF Download
- Select multiple documents → "Download All as ZIP"
- Useful for accountants at month-end

---

## Monetization Opportunities

### New Tier: "Business" ($39/mo)
Between Pro and Agency. Targets growing freelancers and small agencies.

| Feature | Pro ($24) | Business ($39) | Agency ($59) |
|---------|-----------|----------------|--------------|
| Documents | 150 | 500 | Unlimited |
| Team members | 1 | 2 | 3 |
| Payment links | ❌ | ✅ | ✅ |
| Recurring invoices | ❌ | ✅ | ✅ |
| Proposal tracking | ❌ | ✅ | ✅ |
| Custom domain | ❌ | ❌ | ✅ |

### Add-On: E-Sign Credits
- 10 signing requests = ₹99 / $1.99
- Unlimited signing = ₹499/mo / $9.99/mo add-on
- Keeps base price low while monetizing heavy users

### Add-On: Email Sending
- 100 emails/month included in paid plans
- Extra: ₹99 / $1.99 per 500 emails

---

## Priority Order (What to Build When)

### Month 1 — Revenue Impact
1. **Payment links on invoices** (Razorpay) — transforms Clorefy into a payment tool
2. **Send invoice/quotation via email** (Resend) — removes the biggest friction point
3. **WhatsApp share button** — 2 hours, huge India impact
4. **Invoice status tracking** — table stakes

### Month 2 — Retention & Stickiness
5. **Document sharing with view tracking** — "your proposal was opened"
6. **Quotation accept/decline flow** — closes deals faster
7. **Invoice payment reminders** — automated follow-up
8. **Duplicate document** — saves time for repeat work

### Month 3 — Competitive Moat
9. **E-signature upgrade** (DocuSeal API or custom) — legal compliance
10. **Recurring invoices** — retainer clients
11. **Proposal engagement features** — Phase 1

### Month 4+ — Ecosystem
12. **Tally export** — India accounting integration
13. **Interactive proposal pricing** — Phase 2
14. **Custom domain for share links** — white-label

---

## Competitive Positioning After Roadmap

| | Wave | FreshBooks | PandaDoc | Proposify | **Clorefy (target)** |
|--|------|-----------|----------|-----------|---------------------|
| AI generation | ❌ | ❌ | ❌ | ❌ | ✅ |
| 11 countries | ❌ | Partial | ❌ | ❌ | ✅ |
| Payment links | ✅ | ✅ | ✅ | ❌ | ✅ |
| E-signature | ❌ | ❌ | ✅ | ✅ | ✅ |
| Proposal tracking | ❌ | ❌ | ✅ | ✅ | ✅ |
| Quote acceptance | ❌ | ❌ | ✅ | ✅ | ✅ |
| Recurring invoices | ✅ | ✅ | ❌ | ❌ | ✅ |
| WhatsApp share | ❌ | ❌ | ❌ | ❌ | ✅ |
| Price | Free/$16 | $8.40+ | $19+ | $49+ | **$9-$59** |

**The pitch:** "The only tool that generates, sends, tracks, and gets paid — for all 4 document types, in 11 countries, at half the price of PandaDoc."

---

## Technical Notes

### Email: Resend
```
npm install resend
```
- React Email templates
- Webhook for delivery events
- Free: 3,000 emails/month
- [resend.com](https://resend.com)

### E-Sign: DocuSeal
```
POST https://api.docuseal.com/submissions
Authorization: Token YOUR_API_KEY
```
- Free sandbox, $20/mo production
- Returns signed PDF with audit trail
- [docuseal.com/signing-api](https://www.docuseal.com/signing-api)

### Payment Links: Razorpay (already integrated)
```
POST https://api.razorpay.com/v1/payment_links
{
  "amount": 500000,  // in paise
  "currency": "INR",
  "description": "Invoice #INV-001",
  "callback_url": "https://clorefy.com/api/razorpay/payment-link-webhook"
}
```

### WhatsApp Share
```typescript
const message = `Hi ${clientName}, your invoice #${invoiceNumber} for ${amount} is ready: ${shareUrl}`
const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
window.open(waUrl, '_blank')
```

### Document View Tracking
```typescript
// On document open (Edge Function or API route)
await supabase.from('document_views').insert({
  document_id: id,
  viewer_ip: request.headers.get('cf-connecting-ip'),
  user_agent: request.headers.get('user-agent'),
  viewed_at: new Date().toISOString()
})
```

---

*Content was researched from: [ironcladapp.com](https://ironcladapp.com/journal/electronic-signature-guide), [docuseal.com](https://www.docuseal.com/), [razorpay.com](https://razorpay.com/payment-links/), [copyprogramming.com](https://copyprogramming.com/howto/create-proposals), [invoicemojo.com](https://invoicemojo.com/invoicing/invoice-follow-up-sequences/), [sendnow.live](https://sendnow.live/blog/how-to-track-client-proposals), [signnow.com](https://shop.signnow.com/blog/electronic-signature-best-practices/)*
