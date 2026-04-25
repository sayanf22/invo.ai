# Design Document: E-Signature Upgrade

## Overview

This document describes the technical design for upgrading Clorefy's e-signature system from a basic signature-capture flow into a legally defensible, audit-trailed signing workflow. It also adds an online Accept / Decline / Request Changes flow for quotations.

The upgrade is built entirely in-house on the existing Next.js 16 / Supabase / Cloudflare R2 / Mailtrap stack. No external e-signature APIs are used.

### Key Design Decisions

- **Document fingerprinting** uses server-side SHA-256 of the canonical document JSON (`document_sessions.context`), computed before the signing token is issued and re-verified at submission time.
- **Audit trail** is an append-only table (`signature_audit_events`) with RLS enforcing INSERT-only for the service role.
- **Certificate page** is generated with `@react-pdf/renderer` (consistent with `lib/pdf-templates.tsx`) and stored in R2.
- **Verification page** (`/verify/[signatureId]`) is fully public and exposes only non-sensitive fields.
- **Notifications**: owners receive in-app notifications only; signers/clients receive emails only.
- **Quotation responses** are recorded in a new `quotation_responses` table with public INSERT access (no auth required for clients).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Owner (authenticated)                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Document Preview Toolbar                                │   │
│  │  [Get Signature] → Modal → POST /api/signatures          │   │
│  │  [Download Signed PDF] → GET /api/signatures/download/…  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │ creates signing request                │ downloads
         ▼                                        ▼
┌─────────────────────┐              ┌────────────────────────────┐
│  POST /api/         │              │  GET /api/signatures/      │
│  signatures         │              │  download/[sessionId]       │
│  - compute hash     │              │  - generate original PDF   │
│  - create record    │              │  - fetch certificate PDF   │
│  - send email       │              │  - merge & serve           │
│  - record audit     │              └────────────────────────────┘
└─────────────────────┘
         │ sends signing invitation email
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Signer (unauthenticated, token-based)                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /sign/[token]                                           │   │
│  │  - GET /api/signatures?token= (load + record viewed)     │   │
│  │  - POST /api/signatures/sign (submit + verify hash)      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │ on completion
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Post-Signing Pipeline                                          │
│  - Record audit events                                          │
│  - Generate certificate page (react-pdf → R2)                  │
│  - Send completion email to signer                             │
│  - Create in-app notification for owner                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Public Verification                                            │
│  /verify/[signatureId]  ←  anyone, no auth                     │
│  - Shows: name, email, timestamp, truncated hash, status       │
│  - Does NOT show: full hash, IP, signature image URL           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Client (unauthenticated, quotation flow)                       │
│  /view/[sessionId]  (quotation type only)                       │
│  - Accept / Decline / Request Changes buttons                   │
│  - POST /api/quotations/respond                                 │
│  - Owner receives in-app notification                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### New API Routes

#### `POST /api/signatures` (modified)
Creates a signing request. Now also:
- Computes SHA-256 document fingerprint from `document_sessions.context`
- Stores hash in `signatures.document_hash`
- Records `signature.request_created` audit event
- Sends signing invitation email to signer via Mailtrap
- Creates in-app notification for owner (not needed at creation — owner initiated it)

Request body:
```typescript
{
  sessionId: string        // document_sessions.id (replaces documentId)
  signerEmail: string
  signerName: string
  party?: string           // defaults to "Client"
  personalMessage?: string // optional, included in email
}
```

Response:
```typescript
{
  success: true
  signature: SignatureRow
  signingUrl: string       // https://clorefy.com/sign/[token]
  expiresAt: string        // ISO 8601
}
```

#### `GET /api/signatures` (modified)
Token lookup now also:
- Records `signature.viewed` audit event (first view only, idempotent)
- Creates `signature_viewed` in-app notification for owner (first view only)
- Returns business info (name, logo) for the signing page

#### `POST /api/signatures/sign` (modified)
Signature submission now also:
- Re-computes document hash and compares to stored value (409 + audit event on mismatch)
- Enforces `attempt_count` ≤ 5 (increments on each call, rejects at 6th)
- Validates token format: `sign_[32 hex chars]`
- Records `signature.signed` audit event
- On all-signed: records `signature.completed`, generates certificate page, sends completion email to signer, creates in-app notifications for owner

#### `GET /verify/[signatureId]` (new — page route, not API)
Public page at `app/verify/[signatureId]/page.tsx`. Server component that:
- Fetches signature by ID using service role client
- Returns 200 with `verified: true/false`
- Exposes only: signer name, email, signed_at, document type, hash (first 16 chars), status
- Never exposes: full hash, IP address, signature image URL

#### `POST /api/quotations/respond` (new)
Public endpoint (no auth). Records a quotation response:
```typescript
{
  sessionId: string
  responseType: "accepted" | "declined" | "changes_requested"
  clientName: string
  clientEmail: string
  reason?: string  // required for changes_requested, optional for declined
}
```
- Validates `sessionId` corresponds to a `quotation` document type
- Inserts into `quotation_responses`
- Creates in-app notification for owner

#### `GET /api/signatures/download/[sessionId]` (new)
Authenticated. Generates and serves the signed PDF:
- Verifies all signatures are complete
- Generates original document PDF via `@react-pdf/renderer`
- Fetches certificate PDF from R2 (or regenerates if missing)
- Merges PDFs using `pdf-lib`
- Streams the merged PDF with filename `[referenceNumber]_signed_[YYYY-MM-DD].pdf`

### New/Modified Pages

#### `app/sign/[token]/page.tsx` (modified)
Upgraded signing page:
- Displays document preview (PDF viewer, read-only)
- Shows business name/logo from `businesses` table
- Shows document reference, type, expiry date
- Consent checkbox with exact legal text
- On success: shows confirmation screen with timestamp and verification URL
- Handles expired token (no signature pad rendered)
- Handles already-signed state

#### `app/verify/[signatureId]/page.tsx` (new)
Public verification page. Server component:
- No auth required
- Shows verification status card
- Displays non-sensitive signature details
- Shows `verified: true` badge (green) or `verified: false` (red)

#### `app/view/[sessionId]/page.tsx` (modified)
Adds quotation response UI for `quotation` document type:
- Three action buttons: Accept (green), Decline (outlined), Request Changes (outlined)
- Dialogs for each action collecting required fields
- Shows response status if already responded

### New Components

#### `components/get-signature-modal.tsx`
Modal triggered from document preview toolbar:
- Fields: signer name, signer email, party (default "Client"), optional personal message
- Email validation before submission
- Success state with signing URL + copy button

#### `components/certificate-page.tsx`
`@react-pdf/renderer` component for the certificate page. Exported as `CertificatePDF`.

#### `components/quotation-response-buttons.tsx`
Client component for the three quotation response buttons and their dialogs.

### Modified Components

#### `components/document-preview.tsx`
Toolbar additions:
- "Get Signature" button (for contract, quotation, proposal types)
- "Pending Signature" status badge
- "Signed" status badge
- "Download Signed PDF" button (when all signatures complete)

---

## Data Models

### Modified: `signatures` table

New columns added via migration:

```sql
ALTER TABLE signatures
  ADD COLUMN document_hash    TEXT,           -- SHA-256 hex, 64 chars
  ADD COLUMN attempt_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN verification_url TEXT,           -- https://clorefy.com/verify/[id]
  ADD COLUMN session_id       UUID REFERENCES document_sessions(id);
  -- Note: existing document_id references documents.id; session_id is the new FK
```

### New: `signature_audit_events` table

```sql
CREATE TABLE signature_audit_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id  UUID        REFERENCES signatures(id) ON DELETE RESTRICT,
  document_id   UUID        REFERENCES documents(id) ON DELETE RESTRICT,
  session_id    UUID        REFERENCES document_sessions(id) ON DELETE RESTRICT,
  action        TEXT        NOT NULL,
  -- action values: signature.request_created | signature.viewed |
  --                signature.signed | signature.completed |
  --                signature.expired | signature.tamper_detected |
  --                signature.abuse_detected | signature.r2_fallback
  actor_email   TEXT,       -- signer email or owner email
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB,      -- flexible extra fields per event type
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only enforcement via RLS (see Security section)
-- No UPDATE, no DELETE allowed for any role
```

### New: `quotation_responses` table

```sql
CREATE TABLE quotation_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  response_type TEXT        NOT NULL CHECK (response_type IN ('accepted', 'declined', 'changes_requested')),
  client_name   TEXT        NOT NULL,
  client_email  TEXT        NOT NULL,
  reason        TEXT,       -- required for changes_requested, optional for declined
  ip_address    TEXT,
  user_agent    TEXT,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Existing: `notifications` table

New notification types added (no schema change needed — `type` is TEXT):
- `signature_viewed`
- `signature_signed`
- `signature_completed`
- `signature_expired`
- `quotation_accepted`
- `quotation_declined`
- `quotation_changes_requested`

Notification rows follow the existing pattern:
```typescript
{
  user_id: string          // document owner's user_id
  type: string             // one of the types above
  title: string
  message: string
  read: boolean            // default false
  metadata: {
    session_id?: string
    signature_id?: string
    signer_name?: string
    document_type?: string
    reference_number?: string
    verification_url?: string
  }
}
```

---

## Document Fingerprinting Logic

The fingerprint is computed server-side in `lib/document-fingerprint.ts`:

```typescript
import { createHash } from "crypto"

/**
 * Compute a SHA-256 fingerprint of the canonical document JSON.
 * The input is the `context` JSONB field from document_sessions.
 * Keys are sorted to ensure deterministic serialization.
 */
export function computeDocumentFingerprint(context: Record<string, unknown>): string {
  const canonical = JSON.stringify(context, Object.keys(context).sort())
  return createHash("sha256").update(canonical, "utf8").digest("hex")
  // Returns a 64-char lowercase hex string
}
```

Key properties:
- Computed **before** the signing token is issued (in `POST /api/signatures`)
- Re-computed **at submission time** (in `POST /api/signatures/sign`) and compared
- The client never supplies or influences the hash value
- Stored as a 64-char lowercase hex string in `signatures.document_hash`

---

## Audit Trail Recording

All audit events are written via a shared helper `lib/signature-audit.ts`:

```typescript
export async function recordAuditEvent(
  supabase: SupabaseClient,  // service role client
  event: {
    action: AuditAction
    signature_id?: string
    document_id?: string
    session_id?: string
    actor_email?: string
    ip_address?: string
    user_agent?: string
    metadata?: Record<string, unknown>
  }
): Promise<void>
```

The 8 event types and when they fire:

| Action | Trigger |
|--------|---------|
| `signature.request_created` | `POST /api/signatures` succeeds |
| `signature.viewed` | `GET /api/signatures?token=` (first view) |
| `signature.signed` | `POST /api/signatures/sign` succeeds |
| `signature.completed` | All signers for a document have signed |
| `signature.expired` | Token lookup finds expired token |
| `signature.tamper_detected` | Hash mismatch at submission time |
| `signature.abuse_detected` | `attempt_count` exceeds 5 |
| `signature.r2_fallback` | R2 upload fails, base64 fallback used |

---

## Certificate Page Generation

The `CertificatePDF` component in `components/certificate-page.tsx` uses `@react-pdf/renderer` and follows the same font/style conventions as `lib/pdf-templates.tsx`.

Content layout:
1. Header: Clorefy logo + "Signature Certificate" title
2. Document info block: title/reference, type, signing request date
3. Signer table: one row per signer with name, email, party, signed_at (UTC), masked IP
4. Signature images: each signer's drawn signature rendered as `<Image>`
5. Fingerprint block: full 64-char SHA-256 hex
6. Verification URL: clickable link
7. Legal statement: "This document was electronically signed via Invo.ai..."
8. Footer: "Generated by Clorefy"

Storage: `certificates/[documentId]_certificate.pdf` in Cloudflare R2.

Generation is triggered in `POST /api/signatures/sign` when all signers have signed. If R2 upload fails, a `signature.r2_fallback` audit event is recorded and the certificate is regenerated on-demand at download time.

---

## Signed PDF Download

The download endpoint (`GET /api/signatures/download/[sessionId]`) uses `pdf-lib` to merge PDFs:

```
1. Generate original document PDF (react-pdf, same as view page)
2. Fetch certificate PDF from R2 (presigned URL, 1-hour expiry)
   └─ If not found: regenerate certificate, upload to R2, then fetch
3. Load both PDFs with pdf-lib
4. Copy all pages from certificate PDF into original PDF document
5. Stream merged PDF to client
   └─ Content-Disposition: attachment; filename="[ref]_signed_[date].pdf"
```

`pdf-lib` is added as a dependency (`pdfjs-dist` is already present for the viewer but `pdf-lib` is needed for merging).

---

## Middleware Updates

`/verify` is added to `PUBLIC_PATHS` in `middleware.ts`:

```typescript
const PUBLIC_PATHS = [
  // ... existing paths ...
  "/verify",  // public signature verification — /verify/[signatureId]
]
```

No other middleware changes are needed. `/api/quotations` is already under `/api` which is public.

---

## Email Templates

Two new email templates using the existing `sendEmail` / `renderEmailTemplate` pattern:

### Signing Invitation Email
- Subject: `[Business Name] requests your signature on [Document Type] [Reference Number]`
- Content: business logo, document details, "Sign Document" CTA button, expiry date, security notice, plain-text URL fallback
- Sent to: signer only

### Signing Completion Email
- Subject: `You signed [Document Type] [Reference Number] — [Business Name]`
- Content: document reference, signing timestamp (UTC), verification URL
- Sent to: signer only

Owner receives **in-app notifications only** — no emails to owner.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document fingerprint format invariant

*For any* document JSON object (the `context` field of a document session), the computed SHA-256 fingerprint SHALL always be a string of exactly 64 lowercase hexadecimal characters.

**Validates: Requirements 1.5**

### Property 2: Document fingerprint determinism

*For any* document JSON object, computing the fingerprint twice SHALL produce identical results (deterministic, canonical serialization).

**Validates: Requirements 1.1, 1.6**

### Property 3: Tamper detection

*For any* document JSON object and any mutation of that object (changing any field value, adding a field, or removing a field), the fingerprint of the mutated object SHALL differ from the fingerprint of the original object.

**Validates: Requirements 1.3, 1.4**

### Property 4: Audit event completeness

*For any* signing lifecycle event (request_created, viewed, signed, completed, expired, tamper_detected, abuse_detected, r2_fallback), the recorded audit event row SHALL contain all required fields for that event type (non-null signature_id or document_id, non-null created_at, correct action string).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.8**

### Property 5: Audit trail append-only invariant

*For any* sequence of audit events inserted into `signature_audit_events`, the total count of rows for a given `signature_id` SHALL be monotonically non-decreasing — no rows are ever deleted or updated.

**Validates: Requirements 2.7**

### Property 6: Verification URL format

*For any* valid UUID `signatureId`, the generated verification URL SHALL match the pattern `https://clorefy.com/verify/[signatureId]` exactly.

**Validates: Requirements 3.1**

### Property 7: Verification response field safety

*For any* completed signature, the public verification page response SHALL NOT contain the full 64-char document hash, the signer's IP address, or the signature image URL or R2 key.

**Validates: Requirements 3.7**

### Property 8: Certificate page content completeness

*For any* list of one or more completed signers, the generated `CertificatePDF` SHALL contain, for each signer: full name, email address, party/role, signed_at timestamp in `DD MMM YYYY HH:mm UTC` format, and masked IP (last octet replaced with `xxx`). It SHALL also contain the full 64-char document fingerprint, the verification URL, and the legal statement.

**Validates: Requirements 4.2, 4.3, 4.8**

### Property 9: R2 certificate key format

*For any* `documentId` UUID, the R2 object key for the certificate PDF SHALL be exactly `certificates/[documentId]_certificate.pdf`.

**Validates: Requirements 4.6**

### Property 10: Notification content correctness

*For any* signing event that triggers an owner notification (viewed, signed, completed, expired), the created notification row SHALL have the correct `type`, a non-empty `title`, and a `message` that contains the signer's name and the document type.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 11: Quotation response recording completeness

*For any* quotation response submission (accepted, declined, or changes_requested), the recorded `quotation_responses` row SHALL contain: non-null `session_id`, correct `response_type`, non-empty `client_name`, valid `client_email`, non-null `responded_at`, and `reason` (required when `response_type = changes_requested`).

**Validates: Requirements 8.3, 8.5, 8.7**

### Property 12: Token format validation

*For any* string that does not match the pattern `sign_` followed by exactly 32 lowercase hexadecimal characters, the token validation function SHALL return false.

**Validates: Requirements 10.3**

### Property 13: Token expiry invariant

*For any* signing request created at time T, the `expires_at` value SHALL be exactly T + 7 days (604800 seconds), with no rounding or truncation.

**Validates: Requirements 10.5**

### Property 14: Attempt count enforcement

*For any* signing token, after 5 failed submission attempts (where `attempt_count` reaches 5), any further submission attempt SHALL be rejected with HTTP 410 and a `signature.abuse_detected` audit event SHALL be recorded.

**Validates: Requirements 10.1**

### Property 15: Email subject format

*For any* signing invitation, the email subject SHALL match the pattern `[Business Name] requests your signature on [Document Type] [Reference Number]`, with all three interpolated values non-empty.

**Validates: Requirements 9.4**

---

## Error Handling

| Scenario | HTTP Status | Audit Event | Owner Notification |
|----------|-------------|-------------|-------------------|
| Token not found | 404 | — | — |
| Token expired | 410 | `signature.expired` | `signature_expired` |
| Already signed | 409 | — | — |
| Hash mismatch (tamper) | 409 | `signature.tamper_detected` | — |
| Attempt count exceeded | 410 | `signature.abuse_detected` | — |
| IP rate limit exceeded | 429 | — | — |
| Invalid token format | 400 | — | — |
| Signature image too large | 413 | — | — |
| Invalid image format | 400 | — | — |
| R2 upload failure | — (non-fatal) | `signature.r2_fallback` | — |
| Email send failure | 500 | — | — (atomic: no record created) |
| Invalid quotation session | 400 | — | — |
| Quotation already responded | 409 | — | — |

All error responses follow the existing pattern: `{ error: string }` with sanitized messages (no internal details exposed).

---

## Security

### RLS Policies

#### `signature_audit_events`
```sql
-- Service role only can INSERT (all public signing endpoints use service role)
CREATE POLICY "audit_events_insert_service_only"
  ON signature_audit_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Document owner can SELECT their own events (via session → document_sessions.user_id)
CREATE POLICY "audit_events_select_owner"
  ON signature_audit_events FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM document_sessions WHERE user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE for any role (append-only enforcement)
-- (No UPDATE/DELETE policies = denied by default)
```

#### `quotation_responses`
```sql
-- Anyone (including unauthenticated) can INSERT
CREATE POLICY "quotation_responses_insert_public"
  ON quotation_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Validate session is a quotation type
    session_id IN (
      SELECT id FROM document_sessions WHERE document_type = 'quotation'
    )
  );

-- Document owner can SELECT their own responses
CREATE POLICY "quotation_responses_select_owner"
  ON quotation_responses FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM document_sessions WHERE user_id = auth.uid()
    )
  );
```

### Rate Limiting

- `POST /api/signatures/sign`: IP-based, 10 requests/minute (existing `lib/rate-limiter.ts` extended for IP-based limiting)
- `POST /api/quotations/respond`: IP-based, 5 requests/minute per IP
- `POST /api/signatures`: existing user-based rate limiting (30/min general)

### Input Validation

- Token format: regex `^sign_[0-9a-f]{32}$`
- Signature image: must start with `data:image/png` or `data:image/jpeg`, decoded size ≤ 500KB
- Quotation response: `responseType` must be one of the three allowed values
- All string inputs sanitized via existing `lib/sanitize.ts`

---

## Testing Strategy

### Unit Tests

- `computeDocumentFingerprint`: determinism, format (64 hex chars), tamper detection
- `recordAuditEvent`: field completeness per event type
- Token format validation regex
- Notification message template rendering
- Email subject format generation
- Certificate R2 key format generation

### Property-Based Tests

Using a property-based testing library (e.g., `fast-check` for TypeScript):

- **Property 1 & 2**: Generate arbitrary JSON objects, verify fingerprint is always 64 lowercase hex chars and deterministic
- **Property 3**: Generate arbitrary JSON + arbitrary mutations, verify fingerprints differ
- **Property 4**: Generate arbitrary signing events, verify audit rows contain required fields
- **Property 5**: Generate sequences of audit inserts, verify count is monotonically non-decreasing
- **Property 6**: Generate arbitrary UUIDs, verify verification URL format
- **Property 7**: Generate arbitrary completed signatures, verify public response excludes sensitive fields
- **Property 8**: Generate arbitrary signer lists, verify certificate content completeness
- **Property 9**: Generate arbitrary document IDs, verify R2 key format
- **Property 10**: Generate arbitrary signing events, verify notification content
- **Property 11**: Generate arbitrary quotation responses, verify recorded row completeness
- **Property 12**: Generate arbitrary strings, verify token validation rejects non-matching strings
- **Property 13**: Generate arbitrary creation timestamps, verify expires_at is exactly +7 days
- **Property 14**: Generate signing tokens with attempt counts 1–5, verify rejection at 6th attempt
- **Property 15**: Generate arbitrary business/document/reference combinations, verify email subject format

Each property test runs a minimum of 100 iterations.

Tag format: `// Feature: esignature-upgrade, Property N: [property text]`

### Integration Tests

- Full signing flow: create request → view → sign → verify (1-2 examples)
- Tamper detection: create request → mutate document → attempt sign → expect 409
- Certificate generation and R2 storage
- Signed PDF download (original + certificate merged)
- Quotation response flow: submit → notification created
- Email delivery via Mailtrap test inbox

### Smoke Tests

- `signature_audit_events` table exists with correct schema
- RLS policies are active on `signature_audit_events` and `quotation_responses`
- `/verify/[signatureId]` returns 200 without authentication
- `/api/quotations/respond` accepts requests without authentication
