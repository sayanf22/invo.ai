# Design Document

## Overview

This design covers seven improvements to the existing e-signature workflow in Clorefy. All changes build on the existing signature infrastructure — no new external services or major architectural changes are needed. The design focuses on UI state management in the Document_Preview toolbar, new UI panels in the Documents page, enhanced data returned from existing API endpoints, a new cancel API endpoint, a new evidence package download endpoint, and improvements to the signing page and email template.

---

## Architecture

### Component Changes

```
components/document-preview.tsx    — Modify toolbar: conditional button states, cancel flow
components/get-signature-modal.tsx — Add editable email message preview textarea
components/signature-cancel-dialog.tsx — New: confirmation dialog for cancelling signature requests
app/documents/page.tsx             — Add signature badges to DocCard, add SignatureDetailsPanel
app/sign/[token]/page.tsx          — Add document content preview section
app/notifications/page.tsx         — Already handles signature notification types (no changes needed)
```

### API Changes

```
GET  /api/signatures?sessionId=    — Extend response to include ip_address, verification_url
POST /api/signatures/cancel        — New: cancel a pending signature request
GET  /api/signatures/evidence/[sessionId] — New: generate and download evidence package PDF
```

### Database Changes

No new tables required. The existing `signatures` table already has `signer_action` column which will accept a new value `'cancelled'`. The existing `signature_audit_events` table will record `signature.cancelled` events.

---

## Detailed Design

### 1. Prevent Duplicate Signature Requests and Cancel Flow

**Toolbar State Machine:**

The Document_Preview toolbar signature button has four states based on the fetched signatures array:

| State | Condition | Button Display |
|-------|-----------|----------------|
| `idle` | No signatures, or all cancelled/declined/revision_requested | "Request Signature" (enabled, violet) |
| `pending` | At least one signature with `signed_at IS NULL` and `signer_action IS NULL` | "Cancel Request" (enabled, red/destructive) |
| `signed` | All signatures have `signed_at IS NOT NULL` | Hidden — show "Signed" badge + "Download Signed PDF" |
| `actionable` | Has declined or revision_requested but no pending | "Request Signature" (enabled, violet) |

**Cancel Flow:**

1. User clicks "Cancel Request" button in toolbar
2. `SignatureCancelDialog` opens with signer name and confirmation message
3. On confirm, calls `POST /api/signatures/cancel` with `{ signatureId }`
4. Backend sets `signer_action = 'cancelled'`, records audit event
5. Frontend refetches signatures, toolbar transitions to `idle` state

**Cancel API (`POST /api/signatures/cancel`):**

```typescript
// Request body
{ signatureId: string }

// Validations:
// - Authenticate user via authenticateRequest()
// - Verify signature belongs to a session owned by the user
// - Verify signature is pending (signed_at IS NULL, signer_action IS NULL)
// - Set signer_action = 'cancelled'
// - Record signature.cancelled audit event
// - Return { success: true }
```

**Affected files:**
- `components/document-preview.tsx` — Modify toolbar button logic
- `components/signature-cancel-dialog.tsx` — New component
- `app/api/signatures/cancel/route.ts` — New API route

### 2. Signature Status Display in My Documents

**Data Fetching:**

The Documents_Page `loadSessions` function will be extended to fetch signature data for each session. A single batch query fetches all signatures for the loaded session IDs:

```sql
SELECT id, session_id, signer_name, signer_email, signed_at, signer_action, created_at
FROM signatures
WHERE session_id IN (...)
```

The results are grouped by `session_id` and attached to each `DocSession` object as a `signatures` array.

**Badge Rendering in DocCard:**

A new `SignatureBadge` component renders based on the signature state:
- Pending: amber badge with clock icon, shows signer name
- Signed: green badge with checkmark icon
- Declined: red badge with X icon, shows signer name
- Revision Requested: amber badge with message icon, shows signer name

Badges are placed in the same row as existing payment/email badges.

**Affected files:**
- `app/documents/page.tsx` — Extend `DocSession` interface, modify `loadSessions`, add `SignatureBadge` component, modify `DocCard`

### 3. Signature Event Notifications

The backend already creates notifications for `signature_signed`, `signature_declined`, and `signature_revision_requested` events (verified in `app/api/signatures/sign/route.ts` and `app/api/signatures/respond/route.ts`). The notifications page already has `TYPE_CONFIG` entries for all these types with appropriate icons and colours.

**Verification of existing implementation:**
- `signature_signed` → PenLine icon, green — ✅ exists
- `signature_declined` → XCircle icon, red — ✅ exists
- `signature_revision_requested` → MessageSquare icon, amber — ✅ exists
- Click navigation to `/view/[session_id]` — ✅ exists (via `n.metadata?.session_id`)
- Decline reason display — ✅ exists
- Revision reason display — ✅ exists

**No code changes needed for this requirement.** The existing implementation already satisfies all acceptance criteria. This will be verified during testing.

### 4. Document Content Preview on Signing Page

**API Change:**

The `GET /api/signatures?token=` endpoint already returns the full signature record. We need to also return the session context so the signing page can render document content. The endpoint will be extended to include `sessionContext` in the response when fetching by token:

```typescript
// In the token lookup branch of GET /api/signatures
// After fetching the session for audit/notification purposes:
const sessionContext = session?.context ?? null
const documentType = session?.document_type ?? null

return NextResponse.json({
  signature,
  business,
  autoInvoiceOnSign: !!sessionData?.auto_invoice_on_sign,
  sessionContext,  // NEW: document content for preview
  documentType,    // NEW: for rendering
})
```

**Signing Page Component:**

A new `DocumentContentPreview` section is added between the existing document card and the signer info fields. It renders key fields from the session context:

- From/To parties (names, addresses, emails)
- Description/scope
- Line items table (if present): description, quantity, rate, amount
- Total amount with currency
- Terms, notes, payment terms
- Dates (issue date, due date)

The section is wrapped in a collapsible `<details>` element:
- Desktop: defaults to `open`
- Mobile (< 640px): defaults to closed

**Affected files:**
- `app/api/signatures/route.ts` — Extend token lookup response
- `app/sign/[token]/page.tsx` — Add `DocumentContentPreview` component

### 5. Editable Signing Invitation Email with Clean Design

**GetSignatureModal Changes:**

After the signer name and email fields, add a new "Email Message" section:

```
┌─────────────────────────────────────┐
│ Signer Name *                       │
│ [Jane Smith                       ] │
│                                     │
│ Signer Email *                      │
│ [jane@example.com                 ] │
│                                     │
│ Email Message (editable)            │
│ ┌─────────────────────────────────┐ │
│ │ Hi Jane,                        │ │
│ │                                 │ │
│ │ [Business] is requesting your   │ │
│ │ electronic signature on         │ │
│ │ Contract REF-001.               │ │
│ │                                 │ │
│ │ Please review and sign using    │ │
│ │ the secure link below.          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Send Signing Request]              │
└─────────────────────────────────────┘
```

The message auto-generates when signer name changes and is stored in component state. On submit, it's passed as `personalMessage` to the API.

**Email Template Improvements:**

The existing `buildSigningInvitationEmail` function in `app/api/signatures/route.ts` already produces a responsive HTML email. Improvements:
- Ensure body text uses `font-size: 15px` minimum (currently 15px ✅)
- Ensure CTA button has `min-height: 44px` padding (currently `padding: 13px 28px` ✅)
- The signing URL displayed in the email will show a shortened label like "Sign at clorefy.com" rather than the full token URL
- Keep the full URL in the `href` and plain-text fallback

**Affected files:**
- `components/get-signature-modal.tsx` — Add message textarea, auto-generate default message
- `app/api/signatures/route.ts` — Minor email template tweaks for link display

### 6. Signature Details Panel in My Documents

**API Change:**

Extend the `GET /api/signatures?sessionId=` authenticated endpoint to return additional fields:

```typescript
// Current select:
.select("id, signer_name, signer_email, party, signed_at, signer_action, signer_reason, created_at")

// Updated select:
.select("id, signer_name, signer_email, party, signed_at, signer_action, signer_reason, created_at, ip_address, verification_url")
```

**SignatureDetailsPanel Component:**

A new expandable panel component within DocCard, following the same pattern as `PaymentPanel` and `EmailHistoryPanel`:

```
┌─────────────────────────────────────────────┐
│ 🖊 Signature Details                        │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Jane Smith (Client)                     │ │
│ │ jane@example.com                        │ │
│ │ ✅ Signed · Jan 15, 2025 3:42 PM UTC   │ │
│ │ IP: 192.168.1.xxx                       │ │
│ │ 🔗 Verify signature                    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ For declined/revision:                      │
│ ┌─────────────────────────────────────────┐ │
│ │ John Doe (Client)                       │ │
│ │ john@example.com                        │ │
│ │ ❌ Declined                             │ │
│ │ Reason: "Terms are not acceptable"      │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

The panel is toggled via a PenLine icon button in the DocCard action row, visible only when the session has signatures.

**Affected files:**
- `app/api/signatures/route.ts` — Extend sessionId query select
- `app/documents/page.tsx` — Add `SignatureDetailsPanel` component, add toggle button to DocCard

### 7. Legal Evidence Package Download

**New API Endpoint: `GET /api/signatures/evidence/[sessionId]`**

This endpoint generates a merged PDF containing three sections:

1. **Cover Page** — Document reference, type, all signer names/statuses, document fingerprint, generation timestamp, legal statement
2. **Original Document** — Generated from session context using `@react-pdf/renderer` (same approach as existing download endpoint)
3. **Certificate Page** — Fetched from R2 (or regenerated on demand)
4. **Audit Trail Page** — All `signature_audit_events` for the session, rendered as a table

**Audit Trail PDF Generation:**

```typescript
// Fetch all audit events for the session
const { data: auditEvents } = await supabase
  .from("signature_audit_events")
  .select("*")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: true })

// Render using @react-pdf/renderer
// Each event row: [Timestamp] [Action Label] [Actor] [IP] [Details]
```

**Action Label Mapping:**
| Action | Label |
|--------|-------|
| `signature.request_created` | Signing Request Created |
| `signature.viewed` | Document Viewed by Signer |
| `signature.signed` | Document Signed |
| `signature.completed` | All Signatures Complete |
| `signature.expired` | Signing Link Expired |
| `signature.tamper_detected` | Tamper Attempt Detected |
| `signature.abuse_detected` | Abuse Detected |
| `signature.cancelled` | Signing Request Cancelled |

**PDF Merging:**

Uses `pdf-lib` (already a dependency in the download endpoint) to merge:
1. Cover page PDF (generated via @react-pdf/renderer)
2. Original document PDF
3. Certificate PDF (from R2)
4. Audit trail PDF (generated via @react-pdf/renderer)

**DocCard Integration:**

A "Download Evidence" button appears next to the existing "Signed PDF" link when `session.status === "signed"`:

```tsx
{session.status === "signed" && (
  <div className="flex items-center gap-2 mt-1">
    <a href={`/api/signatures/download/${session.id}`} className="...">
      <Download size={10} /> Signed PDF
    </a>
    <a href={`/api/signatures/evidence/${session.id}`} className="...">
      <FileText size={10} /> Evidence Package
    </a>
  </div>
)}
```

**Affected files:**
- `app/api/signatures/evidence/[sessionId]/route.ts` — New API route
- `app/documents/page.tsx` — Add evidence download link to DocCard

---

## Correctness Properties

### Property 1: Toolbar State Consistency (Requirement 1)

Given any combination of signature records for a session, the toolbar button state must be deterministic:
- If any signature is pending (no signed_at, no signer_action) → button shows "Cancel Request"
- If all signatures are signed → button is hidden
- If no pending and has declined/revision/cancelled → button shows "Request Signature"
- If no signatures → button shows "Request Signature"

**Test:** For a set of signature states, verify the computed toolbar state matches the expected state from the state machine.

### Property 2: Cancel Idempotency (Requirement 1)

Cancelling an already-cancelled signature request returns an error and does not create duplicate audit events. The cancel operation is idempotent in effect — calling it twice on the same signature does not change the final state.

**Test:** Call cancel twice on the same signature. Verify the second call returns an error and the signature record has exactly one `signature.cancelled` audit event.

### Property 3: Signature Badge Correctness (Requirement 2)

For any document session, the displayed signature badge must reflect the actual signature state:
- Badge type matches the most significant signature status (signed > pending > declined > revision)
- Badge signer name matches the actual signer name from the signature record

**Test:** Given a session with known signature records, verify the rendered badge type and content.

### Property 4: Evidence Package Completeness (Requirement 7)

For any fully signed session, the evidence package PDF must contain at least 3 sections (cover + original + certificate) and the page count must be >= 3. If audit events exist, the page count must be >= 4.

**Test:** Generate an evidence package for a signed session and verify the merged PDF page count.

### Property 5: Document Preview Data Integrity (Requirement 4)

The session context returned to the signing page must match the context stored in the database. The signing page must not receive any fields that are not in the original session context.

**Test:** Fetch signature by token, verify `sessionContext` matches the stored session context exactly.

### Property 6: Cancel Authorization (Requirement 1)

Only the Document_Owner can cancel a signature request. Attempting to cancel a signature belonging to another user's session must return 403.

**Test:** Create a signature for user A's session, attempt to cancel as user B, verify 403 response.
