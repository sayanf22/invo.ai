# Design Document

## Overview

This design addresses the payment link flow redesign for Clorefy, fixing the broken editor panel toggle, replacing raw gateway links with platform links (`clorefy.com/pay/[sessionId]`), creating a public document view page, and improving the payment lifecycle UX.

The core architectural change is introducing a **platform link layer** between the user and the payment gateway. Instead of sharing raw Razorpay/Stripe/Cashfree URLs, users share `clorefy.com/pay/[sessionId]` links. Clients see the invoice first, then click "Pay Now" to be redirected to the gateway. This improves trust, branding, and gives Clorefy control over the payment experience.

### Key Design Decisions

1. **Platform link is derived from sessionId** — no new DB column needed. The platform link is always `{NEXT_PUBLIC_APP_URL}/pay/{sessionId}`.
2. **The `/pay/[sessionId]` page is a new Server Component** — fetches data server-side using the service role key (no auth required), then hydrates a client component for PDF rendering and payment interaction.
3. **The editor toggle bug is fixed by introducing a `showPaymentLinkInPdf` boolean** — decoupling the "embed in PDF" intent from the actual `paymentLink` URL, which should never be cleared by the toggle.
4. **Gateway-agnostic design** — the `invoice_payments` table already stores `short_url` (gateway link). The `/pay` page reads this and redirects to whichever gateway was used.
5. **Document lock on `paid` status** — when payment is confirmed, `document_sessions.status` is updated to `"paid"`, which the editor checks to disable all inputs.

## Architecture

```mermaid
flowchart TD
    A[User creates invoice] --> B[Clicks "Get Payment Link"]
    B --> C[POST /api/payments/create-link]
    C --> D[Gateway API creates link]
    D --> E[Store gateway_url in invoice_payments]
    E --> F[Return platform_link = /pay/sessionId]
    F --> G[User copies/shares platform_link]
    G --> H[Client opens /pay/sessionId]
    H --> I[Public page renders invoice PDF]
    I --> J[Client clicks "Pay Now"]
    J --> K[Redirect to gateway_url]
    K --> L[Gateway webhook fires]
    L --> M[Update invoice_payments.status = paid]
    M --> N[Update document_sessions.status = paid]
```

### Route Architecture

```
/pay/[sessionId]          — NEW public page (no auth)
/view/[sessionId]         — EXISTING authenticated view (no changes)
/api/payments/create-link — MODIFIED to return platform_link
/api/payments/status      — NEW endpoint for public status check
```

## Components and Interfaces

### 1. Editor Panel Toggle Fix (`components/editor-panel.tsx`)

**Problem:** The toggle currently clears `paymentLink` when turned off, but cannot restore it when turned on (the URL is lost). This makes the toggle one-way.

**Solution:** Add a new `showPaymentLinkInPdf` boolean field to `InvoiceData`. The toggle controls this field instead of clearing/setting `paymentLink`.

```typescript
// New field in InvoiceData
showPaymentLinkInPdf?: boolean  // Controls PDF embedding, independent of paymentLink URL
```

**Toggle behavior:**
- ON → `onChange({ showPaymentLinkInPdf: true })`
- OFF → `onChange({ showPaymentLinkInPdf: false })`
- Visual state driven by `data.showPaymentLinkInPdf` (not `data.paymentLink`)
- The `paymentLink` field is never modified by the toggle

### 2. Payment Link Button Changes (`components/payment-link-button.tsx`)

**Changes:**
- `handleCopy` copies platform link (`/pay/${sessionId}`) instead of `paymentLink.shortUrl`
- `handleWhatsApp` uses platform link in message
- `onPaymentLinkChange` callback sends platform link to parent
- Add tooltip to lock indicator explaining why editing is disabled
- Refresh button shows error toast on failure (currently silent)

**Platform link construction:**
```typescript
const platformLink = `${window.location.origin}/pay/${sessionId}`
```

### 3. Public Document View Page (`app/pay/[sessionId]/page.tsx`)

**New server component** that:
1. Fetches `document_sessions.context` and `invoice_payments` using service role (no auth)
2. Validates the session exists and has a payment link
3. Passes data to a client component for rendering

**Client component renders:**
- Business name, document reference, total amount
- Read-only PDF preview (reuses existing `buildPdfBlob` pattern)
- "Pay Now" button → redirects to `invoice_payments.short_url` (gateway link)
- QR code for the gateway link
- Status badges (Paid, Pending, Expired, Cancelled)
- Responsive layout for mobile

**Security:** No user data is exposed beyond what's in the document itself. The session ID acts as an unguessable token (UUID v4).

### 4. Payment Status API (`app/api/payments/status/route.ts`)

**New public endpoint** (no auth required):
```
GET /api/payments/status?sessionId=xxx
```

Returns only: `{ status, amount, currency, amountPaid }`. No gateway URLs or user data exposed.

Used by the `/pay/[sessionId]` page to refresh payment status client-side.

### 5. Webhook Enhancement

**Existing webhooks** (`/api/razorpay/webhook/[userId]`, `/api/stripe/webhook/[userId]`, `/api/cashfree/webhook/[userId]`) already update `invoice_payments.status`.

**New behavior:** After updating `invoice_payments.status` to `"paid"`, also update `document_sessions.status` to `"paid"`.

### 6. Payment Method Dropdown (`hooks/use-payment-methods.ts`)

Already correctly implemented — the `usePaymentMethods` hook fetches connected gateways and only shows those options. The editor panel already shows a "Connect a payment gateway" link when none are connected. No changes needed to the hook itself.

The editor panel needs a minor update: when `document_sessions.status === "paid"`, disable all input fields including the payment method dropdown.

## Data Models

### InvoiceData Changes (lib/invoice-types.ts)

```typescript
// Add to InvoiceData interface:
showPaymentLinkInPdf?: boolean  // NEW: Controls PDF embedding toggle
```

The existing `paymentLink` and `paymentLinkStatus` fields remain unchanged. The `paymentLink` field stores the platform link (changed from gateway link). The gateway link is only stored in `invoice_payments.short_url`.

### Database Changes

**No new tables needed.** Existing tables are sufficient:

- `invoice_payments` — already has `short_url` (gateway link), `status`, `amount`, `currency`
- `document_sessions` — already has `status` field (add `"paid"` as a valid value)

### API Response Changes

**POST /api/payments/create-link** — add `platformLink` to response:
```typescript
{
  success: true,
  paymentLink: {
    id: string,
    shortUrl: string,        // gateway URL (for backend use)
    platformLink: string,    // clorefy.com/pay/[sessionId] (for sharing)
    status: "created",
    razorpayId: string,
    isExisting: boolean,
  }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Platform link is correctly derived from sessionId

*For any* valid session ID, the platform link constructed for copying and sharing SHALL match the format `{origin}/pay/{sessionId}`, and any message composed for WhatsApp or other sharing channels SHALL contain this platform link rather than the raw gateway URL.

**Validates: Requirements 2.1, 2.2**

### Property 2: Pay Now button redirects to the gateway URL

*For any* session with an active payment link (status `created` or `partially_paid`), the "Pay Now" button on the public view page SHALL have an href equal to the `short_url` stored in the `invoice_payments` record for that session.

**Validates: Requirements 3.3**

### Property 3: Public page displays required document information

*For any* valid InvoiceData with non-empty `fromName`, `invoiceNumber`, items, and `currency`, the public view page SHALL render all four pieces of information: seller business name, document reference number, total amount, and currency.

**Validates: Requirements 3.8**

### Property 4: Paid documents are read-only

*For any* document session with status `"paid"`, all input fields in the editor panel SHALL be disabled, and no field update operations SHALL modify the document content.

**Validates: Requirements 7.2, 7.5**

### Property 5: Payment method dropdown shows only connected gateways plus base methods

*For any* subset of connected gateways from `{razorpay, stripe, cashfree}`, the payment method dropdown SHALL contain exactly those gateway-specific methods plus all base methods (Bank Transfer, UPI, Cash, Check, Wire Transfer), and no gateway methods for disconnected gateways.

**Validates: Requirements 8.2**

## Error Handling

### Public View Page (`/pay/[sessionId]`)
- **Invalid session ID**: Display "Document not found" with a clean 404-style page. No stack traces or internal details.
- **Session exists but no payment link**: Display the document in read-only mode without payment controls.
- **Gateway URL unavailable**: Show "Payment link unavailable" message with suggestion to contact the sender.

### Payment Link Button
- **Create link failure**: Toast with specific error message (NO_PAYMENT_SETTINGS → prompt to connect gateway, INVALID_CREDENTIALS → prompt to check keys, rate limit → retry message).
- **Cancel failure**: Toast error, retain current status. Do not unlock the document.
- **Refresh failure**: Toast error, retain previous status. Stop spinner animation.
- **Network errors**: Generic "Something went wrong" toast with retry suggestion.

### Webhook Processing
- **Duplicate webhook events**: Idempotent — if status is already `paid`, skip update. Return 200 to prevent retries.
- **Unknown session**: Log warning, return 200 (don't cause gateway retries).
- **DB update failure after status change**: Log error. The next refresh or webhook retry will catch it.

### Editor Panel
- **Paid document edit attempt**: All inputs are disabled via the `disabled` attribute. No API calls are made.
- **Toggle interaction on paid document**: Toggle is hidden or disabled when document is paid.

## Testing Strategy

### Unit Tests (Example-Based)
- Editor panel toggle: verify `showPaymentLinkInPdf` state changes correctly on toggle
- Toggle visual states: verify CSS classes for on/off states
- Cancel button visibility: hidden when status is `paid`
- Lock indicator: visible when status is `created` or `partially_paid`, includes tooltip
- Public page status rendering: correct badges and button visibility for each status
- Payment method dropdown: base methods always present, settings link when no gateways
- Refresh spinner: animation class applied during loading

### Property-Based Tests
- **Library**: `fast-check` (TypeScript PBT library)
- **Minimum iterations**: 100 per property
- Each test tagged with: `Feature: payment-link-flow-redesign, Property {N}: {title}`

Property tests to implement:
1. Platform link derivation from sessionId (Property 1)
2. Pay Now href matches gateway URL (Property 2)
3. Public page renders required document fields (Property 3)
4. Paid document inputs are all disabled (Property 4)
5. Payment method dropdown filtering by connected gateways (Property 5)

### Integration Tests
- POST `/api/payments/create-link` returns both `shortUrl` and `platformLink`
- POST `/api/payments/cancel-link` updates status and unlocks document
- GET `/api/payments/status` returns correct public-safe data
- Webhook updates both `invoice_payments` and `document_sessions` status
- `/pay/[sessionId]` route is accessible without authentication (middleware check)

### Edge Case Tests
- Toggle clicked rapidly multiple times
- Cancel API failure retains status
- Refresh API failure retains status
- Invalid/non-existent session ID on `/pay` page
- Session with no payment link on `/pay` page
