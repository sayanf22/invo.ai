# Implementation Plan: E-Signature Upgrade

## Overview

Implement a legally defensible e-signature system with document fingerprinting, audit trail, certificate generation, verification page, quotation response flow, and upgraded signing/owner UIs. Tasks are ordered by dependency: database → shared utilities → API layer → frontend.

`pdf-lib` is a new dependency required for PDF merging (task 10). Install before executing that task:
```bash
pnpm add pdf-lib
```

---

## Tasks

- [x] 1. Database migration — new columns, new tables, RLS policies
  - Add columns to `signatures`: `document_hash TEXT`, `attempt_count INTEGER NOT NULL DEFAULT 0`, `verification_url TEXT`, `session_id UUID REFERENCES document_sessions(id)`
  - Create `signature_audit_events` table with columns: `id UUID PK`, `signature_id UUID REFERENCES signatures(id) ON DELETE RESTRICT`, `document_id UUID REFERENCES documents(id) ON DELETE RESTRICT`, `session_id UUID REFERENCES document_sessions(id) ON DELETE RESTRICT`, `action TEXT NOT NULL`, `actor_email TEXT`, `ip_address TEXT`, `user_agent TEXT`, `metadata JSONB`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Create `quotation_responses` table with columns: `id UUID PK`, `session_id UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE`, `response_type TEXT NOT NULL CHECK (response_type IN ('accepted','declined','changes_requested'))`, `client_name TEXT NOT NULL`, `client_email TEXT NOT NULL`, `reason TEXT`, `ip_address TEXT`, `user_agent TEXT`, `responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - RLS on `signature_audit_events`: INSERT for service_role only; SELECT for document owner via `session_id IN (SELECT id FROM document_sessions WHERE user_id = auth.uid())`; no UPDATE or DELETE policies (append-only)
  - RLS on `quotation_responses`: INSERT for `anon` and `authenticated` with CHECK that `session_id` belongs to a `quotation` document type; SELECT for document owner only
  - Enable RLS on both new tables
  - _Requirements: 2.6, 2.7, 2.8, 8.3, 10.8, 10.9_

- [x] 2. `lib/document-fingerprint.ts` — SHA-256 fingerprint utility
  - Export `computeDocumentFingerprint(context: Record<string, unknown>): string`
  - Serialize with `JSON.stringify(context, Object.keys(context).sort())` for deterministic canonical form
  - Compute with Node.js `crypto.createHash("sha256").update(canonical, "utf8").digest("hex")`
  - Return value is always a 64-char lowercase hex string
  - _Requirements: 1.1, 1.5_

- [x] 3. `lib/signature-audit.ts` — audit event recording helper
  - Export `AuditAction` union type covering all 8 action strings: `signature.request_created | signature.viewed | signature.signed | signature.completed | signature.expired | signature.tamper_detected | signature.abuse_detected | signature.r2_fallback`
  - Export `recordAuditEvent(supabase: SupabaseClient, event: { action: AuditAction; signature_id?: string; document_id?: string; session_id?: string; actor_email?: string; ip_address?: string; user_agent?: string; metadata?: Record<string, unknown> }): Promise<void>`
  - Use service-role client only; never throw — catch and log errors silently
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

- [x] 4. Middleware update — add `/verify` to `PUBLIC_PATHS`
  - In `middleware.ts`, add `"/verify"` to the `PUBLIC_PATHS` array
  - No other middleware changes needed
  - _Requirements: 3.5_

- [x] 5. `POST /api/signatures` — compute fingerprint, record audit event, send signing invitation email
  - [x] 5.1 Accept `sessionId` (replacing `documentId`) in request body alongside `signerEmail`, `signerName`, `party` (default `"Client"`), `personalMessage`
    - Fetch `document_sessions` row by `sessionId`, verify `user_id === auth.user.id`
    - Resolve `document_id` from `document_sessions.document_id`
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 5.2 Compute document fingerprint and store in `signatures.document_hash`
    - Call `computeDocumentFingerprint(session.context)` before inserting the signature row
    - Store result in `document_hash`; set `session_id` on the new signature row
    - Set `expires_at` to exactly `created_at + 7 days` (604800 seconds)
    - Set `verification_url` to `https://clorefy.com/verify/[newSignatureId]`
    - _Requirements: 1.1, 1.2, 10.5_
  - [x] 5.3 Record `signature.request_created` audit event via `recordAuditEvent`
    - Include `signature_id`, `document_id`, `session_id`, `actor_email` (signer email), `ip_address` (requester), metadata with `signer_name`, `party`, `document_hash`
    - _Requirements: 2.1_
  - [x] 5.4 Send signing invitation email to signer via existing `sendEmail` / `renderEmailTemplate` pattern
    - Fetch business name and logo from `businesses` table via `document_sessions.user_id`
    - Subject: `[Business Name] requests your signature on [Document Type] [Reference Number]`
    - Body: business logo, document type + reference, "Sign Document" CTA button linking to `/sign/[token]`, expiry date, security notice "This signing link is unique to you. Do not share it.", plain-text URL fallback
    - If email send fails, return 500 and do NOT persist the signature record (atomic: email must succeed first)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 5.5 Write unit tests for `POST /api/signatures` happy path and email-failure rollback
    - Test that signature record is not created when email fails
    - Test that `document_hash` is set and `verification_url` is correct
    - _Requirements: 1.1, 9.5_

- [x] 6. `GET /api/signatures` — record `signature.viewed` audit event + owner in-app notification (first view only)
  - [x] 6.1 On token lookup, check if a `signature.viewed` audit event already exists for this `signature_id`
    - If no prior `signature.viewed` event: call `recordAuditEvent` with `signature.viewed`, `ip_address`, `user_agent`
    - If no prior `signature.viewed` event: insert a `signature_viewed` notification row for the document owner (`user_id` from `document_sessions`)
    - Notification: `type: "signature_viewed"`, `title: "Document Viewed"`, `message: "[Signer Name] viewed your [document type] for signing."`, `metadata: { session_id, signature_id, signer_name, document_type }`
    - _Requirements: 2.2, 6.1_
  - [x] 6.2 Also return `business` info (name, logo_url) in the response for the signing page to display
    - Join `document_sessions → businesses` via `user_id`
    - _Requirements: 5.2_
  - [x] 6.3 On expired token, record `signature.expired` audit event and create `signature_expired` owner notification
    - Notification: `type: "signature_expired"`, `title: "Signing Link Expired"`, `message: "The signing link for [Signer Name] on [document type] [reference number] has expired."`
    - _Requirements: 2.5, 6.4_

- [x] 7. `POST /api/signatures/sign` — hash verification, attempt_count, audit events, certificate trigger, emails, notifications
  - [x] 7.1 Validate token format with regex `^sign_[0-9a-f]{32}$` before any DB lookup; return 400 on mismatch
    - _Requirements: 10.3_
  - [x] 7.2 Enforce `attempt_count` limit: increment `attempt_count` on every call; if `attempt_count` reaches 6, record `signature.abuse_detected` audit event and return 410
    - Use a DB update with `attempt_count = attempt_count + 1` before processing
    - _Requirements: 10.1_
  - [x] 7.3 Re-compute document fingerprint from `document_sessions.context` and compare to `signatures.document_hash`
    - On mismatch: record `signature.tamper_detected` audit event, return 409
    - _Requirements: 1.3, 1.4_
  - [x] 7.4 On successful signature: record `signature.signed` audit event with `ip_address`, `user_agent`, `signed_at`, `signature_image_key`
    - _Requirements: 2.3_
  - [x] 7.5 Check if all signers for the session have signed; if so: record `signature.completed` audit event, trigger certificate generation (call `generateAndStoreCertificate`), send completion email to signer, create owner in-app notifications
    - `signature.completed` metadata: `document_id`, `completed_at`, list of `signature_id` values
    - Completion email subject: `You signed [Document Type] [Reference Number] — [Business Name]`; body: document reference, signing timestamp (UTC), verification URL
    - Owner notifications: `signature_signed` (for this signer) + `signature_completed` (when all done)
    - `signature_signed`: `title: "Document Signed"`, `message: "[Signer Name] signed your [document type] [reference number]."`
    - `signature_completed`: `title: "All Signatures Complete"`, `message: "Your [document type] [reference number] has been fully signed by all parties."`
    - _Requirements: 2.4, 4.1, 6.2, 6.3, 9.6, 9.7_
  - [x] 7.6 Return `verificationUrl` in the success response so the signing page can display it
    - _Requirements: 5.5_
  - [x] 7.7 Write property test for attempt_count enforcement (Property 14)
    - **Property 14: Attempt count enforcement**
    - Generate tokens with attempt_count values 1–5; verify 6th attempt is rejected with 410 and `signature.abuse_detected` is recorded
    - **Validates: Requirements 10.1**
  - [x] 7.8 Write property test for token format validation (Property 12)
    - **Property 12: Token format validation**
    - Generate arbitrary strings; verify only strings matching `^sign_[0-9a-f]{32}$` pass validation
    - **Validates: Requirements 10.3**
  - [x] 7.9 Write property test for token expiry invariant (Property 13)
    - **Property 13: Token expiry invariant**
    - Generate arbitrary creation timestamps; verify `expires_at` is always exactly `created_at + 604800 seconds`
    - **Validates: Requirements 10.5**

- [x] 8. Property-based tests for `lib/document-fingerprint.ts`
  - [x] 8.1 Write property test for fingerprint format invariant (Property 1)
    - **Property 1: Document fingerprint format invariant**
    - Generate arbitrary JSON objects; verify output is always a 64-char lowercase hex string
    - **Validates: Requirements 1.5**
  - [x] 8.2 Write property test for fingerprint determinism (Property 2)
    - **Property 2: Document fingerprint determinism**
    - Generate arbitrary JSON objects; compute fingerprint twice; verify identical results
    - **Validates: Requirements 1.1, 1.6**
  - [x] 8.3 Write property test for tamper detection (Property 3)
    - **Property 3: Tamper detection**
    - Generate arbitrary JSON objects + arbitrary mutations (field change, add, remove); verify fingerprints differ
    - **Validates: Requirements 1.3, 1.4**

- [x] 9. `components/certificate-page.tsx` — react-pdf certificate page component
  - Export `CertificatePDF` component using `@react-pdf/renderer`, following font/style conventions from `lib/pdf-templates.tsx` (Inter font, same border helpers)
  - Layout sections (in order): header (Clorefy logo + "Signature Certificate" title), document info block (title/reference, type, signing request date), signer table (one row per signer: name, email, party, `signed_at` formatted as `DD MMM YYYY HH:mm UTC`, masked IP with last octet replaced by `xxx`), signature images (each signer's drawn signature as `<Image>`), fingerprint block (full 64-char SHA-256 hex), verification URL (as a `<Link>`), legal statement ("This document was electronically signed via Invo.ai. The signatures and audit trail are legally binding under applicable electronic signature laws."), footer ("Generated by Clorefy")
  - Props: `{ signers: SignerInfo[]; documentTitle: string; documentType: string; referenceNumber: string; requestedAt: string; documentHash: string; verificationUrl: string }`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_
  - [x] 9.1 Write property test for certificate page content completeness (Property 8)
    - **Property 8: Certificate page content completeness**
    - Generate arbitrary signer lists; verify rendered output contains name, email, party, formatted timestamp, masked IP, full hash, verification URL, and legal statement for each signer
    - **Validates: Requirements 4.2, 4.3, 4.8**
  - [x] 9.2 Write property test for R2 certificate key format (Property 9)
    - **Property 9: R2 certificate key format**
    - Generate arbitrary document ID UUIDs; verify R2 key is always `certificates/[documentId]_certificate.pdf`
    - **Validates: Requirements 4.6**

- [x] 10. `GET /api/signatures/download/[sessionId]` — signed PDF download (requires `pdf-lib` — new dependency)
  - **Install dependency before implementing:** `pnpm add pdf-lib`
  - Authenticated endpoint; verify `document_sessions.user_id === auth.user.id`
  - Verify all signatures for the session are complete; return 400 if not
  - Generate original document PDF using `@react-pdf/renderer` (same template selection logic as `components/document-preview.tsx`)
  - Fetch certificate PDF from R2 at key `certificates/[documentId]_certificate.pdf` via presigned GET URL (1-hour expiry); if not found, call `generateAndStoreCertificate` to regenerate before fetching
  - Load both PDFs with `pdf-lib`; copy all certificate pages into the original PDF document
  - Stream merged PDF with `Content-Disposition: attachment; filename="[referenceNumber]_signed_[YYYY-MM-DD].pdf"`
  - _Requirements: 11.1, 11.2, 11.5, 11.6, 11.7_

- [x] 11. `app/verify/[signatureId]/page.tsx` — public verification page
  - Server component; no auth required
  - Fetch signature by `signatureId` using service-role Supabase client
  - Display: signer name, signer email, signed_at timestamp, document type, document hash (first 16 chars only), signing status, `verified: true` (green badge) or `verified: false` (red badge)
  - Do NOT expose: full 64-char hash, signer IP address, signature image URL or R2 key
  - If `signatureId` does not exist or signature is not completed, show `verified: false` with clear explanation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  - [x] 11.1 Write property test for verification URL format (Property 6)
    - **Property 6: Verification URL format**
    - Generate arbitrary UUIDs; verify generated URL always matches `https://clorefy.com/verify/[signatureId]`
    - **Validates: Requirements 3.1**
  - [x] 11.2 Write property test for verification response field safety (Property 7)
    - **Property 7: Verification response field safety**
    - Generate arbitrary completed signatures; verify public response never contains full 64-char hash, IP address, or signature image URL/key
    - **Validates: Requirements 3.7**

- [x] 12. `POST /api/quotations/respond` — quotation response endpoint
  - Public endpoint (no auth); use service-role client for DB writes
  - Accept body: `{ sessionId, responseType, clientName, clientEmail, reason? }`
  - Validate `sessionId` corresponds to a `document_type = 'quotation'` session; return 400 otherwise
  - Validate `responseType` is one of `accepted | declined | changes_requested`; `reason` is required when `responseType = 'changes_requested'`
  - Check for existing response on this `session_id`; return 409 if already responded
  - Insert into `quotation_responses` with `ip_address` and `user_agent` from request headers
  - Create owner in-app notification: `quotation_accepted` / `quotation_declined` / `quotation_changes_requested`
    - `quotation_accepted`: `title: "Quotation Accepted"`, `message: "[Client Name] accepted your quotation [reference number]."`
    - `quotation_declined`: `title: "Quotation Declined"`, `message: "[Client Name] declined your quotation [reference number]."`
    - `quotation_changes_requested`: `title: "Changes Requested"`, `message: "[Client Name] requested changes to your quotation [reference number]."`; include full `reason` in `metadata`
  - _Requirements: 8.3, 8.5, 8.7, 8.8, 10.9, 10.10_
  - [x] 12.1 Write property test for quotation response recording completeness (Property 11)
    - **Property 11: Quotation response recording completeness**
    - Generate arbitrary response submissions; verify recorded row always has non-null `session_id`, correct `response_type`, non-empty `client_name`, valid `client_email`, non-null `responded_at`, and `reason` present when `response_type = changes_requested`
    - **Validates: Requirements 8.3, 8.5, 8.7**

- [x] 13. `app/sign/[token]/page.tsx` — upgraded signing page
  - [x] 13.1 Fetch signature data via `GET /api/signatures?token=` and display business branding (name, logo) and document info (reference, type, expiry date)
    - Show "Secured by Invo.ai" trust badge with shield icon
    - _Requirements: 5.2, 5.3, 5.6_
  - [x] 13.2 Render read-only document preview using the existing PDF viewer (same `react-pdf` Document/Page components used in `app/view/[sessionId]/page.tsx`)
    - _Requirements: 5.1_
  - [x] 13.3 Add consent checkbox with exact text: "I agree that this electronic signature is legally binding and constitutes my intent to sign this document electronically."
    - Disable the "Sign" submit button until checkbox is checked
    - _Requirements: 5.4_
  - [x] 13.4 Handle expired token state: display expiry message, do NOT render signature pad
    - Handle already-signed state: display "Already Signed" confirmation screen with original signing timestamp
    - _Requirements: 5.7, 5.8_
  - [x] 13.5 On successful submission, display confirmation screen with: signer name, document reference, exact signing timestamp (UTC), and verification URL
    - _Requirements: 5.5_
  - [x] 13.6 Ensure all interactive elements have minimum 44×44px touch targets for mobile
    - _Requirements: 5.9_

- [x] 14. `components/get-signature-modal.tsx` — "Get Signature" modal component
  - Fields: signer name (required), signer email (required, validated), party/role (default `"Client"`), optional personal message
  - On submit: call `POST /api/signatures` with `{ sessionId, signerEmail, signerName, party, personalMessage }`
  - Show loading state during submission
  - On success: display signing URL + "Copy Link" button; do not close modal automatically
  - On error: display error message inline
  - _Requirements: 7.2, 7.3, 7.4, 7.6_

- [x] 15. `components/document-preview.tsx` — toolbar additions
  - [x] 15.1 Add "Get Signature" button to the toolbar right section, visible only when `data.documentType` is `contract`, `quotation`, or `proposal` and `sessionId` is set
    - Clicking opens `<GetSignatureModal sessionId={sessionId} documentType={data.documentType} />`
    - _Requirements: 7.1_
  - [x] 15.2 Fetch signature status for the current session on mount (call `GET /api/signatures?sessionId=`) and show status badges in the toolbar
    - "Pending Signature" badge (amber) when one or more signatures exist and not all are signed
    - "Signed" badge (green) when all signatures are complete
    - _Requirements: 7.7, 7.8_
  - [x] 15.3 Add "Download Signed PDF" button, visible only when all signatures are complete
    - Links to `GET /api/signatures/download/[sessionId]`
    - _Requirements: 7.9, 11.3_

- [x] 16. `app/view/[sessionId]/page.tsx` — quotation response buttons
  - Detect `document_type === 'quotation'` from the session data
  - Check `quotation_responses` for an existing response on this `session_id`
  - If no prior response: render three action buttons — "Accept Quotation" (primary green), "Decline" (outlined), "Request Changes" (outlined)
  - Each button opens a dialog:
    - Accept: collect client name + email, confirm button calls `POST /api/quotations/respond`
    - Decline: collect optional reason, confirm button calls `POST /api/quotations/respond`
    - Request Changes: collect required reason (textarea), confirm button calls `POST /api/quotations/respond`
  - If prior response exists: display response status ("You accepted this quotation on [date]") and hide action buttons
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 8.10_

- [x] 17. `app/notifications/page.tsx` — new notification types with distinct icons/colours
  - Add rendering cases for the 7 new notification types:
    - `signature_viewed`: eye icon, blue
    - `signature_signed`: pen icon, green
    - `signature_completed`: check-circle icon, green (bold)
    - `signature_expired`: clock icon, amber
    - `quotation_accepted`: check icon, green
    - `quotation_declined`: x-circle icon, red
    - `quotation_changes_requested`: edit icon, orange
  - For `quotation_changes_requested`: display full change request text from `metadata.reason` in the notification detail/expanded view
  - Clicking a notification navigates to the relevant document session (`metadata.session_id`)
  - _Requirements: 6.6, 12.1, 12.2, 12.3, 12.5, 12.6_

- [x] 18. `app/documents/page.tsx` — response status badges on quotation sessions + "Download Signed PDF" link
  - For sessions with `document_type = 'quotation'`: fetch the most recent `quotation_responses` row and display a badge — "Accepted" (green), "Declined" (red), or "Changes Requested" (orange)
  - For sessions with `status = 'signed'`: display a "Download Signed PDF" link pointing to `GET /api/signatures/download/[sessionId]`
  - _Requirements: 11.4, 12.4_

- [x] 19. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Property-based tests for remaining correctness properties
  - [x] 20.1 Write property test for audit event completeness (Property 4)
    - **Property 4: Audit event completeness**
    - Generate arbitrary signing lifecycle events; verify each recorded row has non-null `signature_id` or `document_id`, non-null `created_at`, and correct `action` string
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.8**
  - [x] 20.2 Write property test for audit trail append-only invariant (Property 5)
    - **Property 5: Audit trail append-only invariant**
    - Insert sequences of audit events for a given `signature_id`; verify row count is monotonically non-decreasing (no deletes or updates)
    - **Validates: Requirements 2.7**
  - [x] 20.3 Write property test for notification content correctness (Property 10)
    - **Property 10: Notification content correctness**
    - Generate arbitrary signing events (viewed, signed, completed, expired); verify each notification row has correct `type`, non-empty `title`, and `message` containing signer name and document type
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - [x] 20.4 Write property test for email subject format (Property 15)
    - **Property 15: Email subject format**
    - Generate arbitrary business name / document type / reference number combinations; verify subject always matches `[Business Name] requests your signature on [Document Type] [Reference Number]` with all three values non-empty
    - **Validates: Requirements 9.4**

- [x] 21. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (TypeScript); tag each test with `// Feature: esignature-upgrade, Property N: [property text]`; minimum 100 iterations per property
- `pdf-lib` must be installed (`pnpm add pdf-lib`) before executing task 10
- All public signing endpoints (`POST /api/signatures/sign`, `POST /api/quotations/respond`) use `createServerSupabaseClient` (service role) — never the user anon client
- The `notifications` table schema requires no changes — `type` is already `TEXT`
- `signature_audit_events` is append-only by RLS design: absence of UPDATE/DELETE policies means those operations are denied by default for all roles
