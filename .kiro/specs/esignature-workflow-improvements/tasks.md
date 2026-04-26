# Tasks

## Task 1: Cancel Signature API and Audit Event

- [x] 1.1 Create `app/api/signatures/cancel/route.ts` with POST handler: authenticate user, validate signatureId, verify ownership via session.user_id, verify signature is pending (signed_at IS NULL, signer_action IS NULL), set signer_action = 'cancelled', record `signature.cancelled` audit event in signature_audit_events
- [x] 1.2 Add `'signature.cancelled'` to the `AuditAction` type union in `lib/signature-audit.ts`
- [x] 1.3 Create `components/signature-cancel-dialog.tsx` — confirmation dialog component using shadcn/ui AlertDialog pattern with signer name, warning message, "Keep Request" and "Cancel Request" buttons

## Task 2: Prevent Duplicate Signature Requests — Toolbar State Machine

- [x] 2.1 Modify `components/document-preview.tsx` toolbar: compute button state from signatures array (idle/pending/signed/actionable), show "Cancel Request" button when pending, hide button when all signed, show "Request Signature" when idle or actionable
- [x] 2.2 Wire cancel button to open `SignatureCancelDialog`, on confirm call `POST /api/signatures/cancel`, refetch signatures on success
- [x] 2.3 Ensure `GetSignatureModal` cannot open when a pending signature exists (guard the `setGetSignatureModalOpen(true)` call)

## Task 3: Signature Status Badges in My Documents

- [x] 3.1 Extend `DocSession` interface in `app/documents/page.tsx` to include `signatures?: Array<{ id: string; signer_name: string; signer_email: string; signed_at: string | null; signer_action: string | null; created_at: string }>` field
- [x] 3.2 Modify `loadSessions` in `app/documents/page.tsx` to batch-fetch signatures for loaded session IDs and attach to each DocSession
- [x] 3.3 Create `SignatureBadge` component in `app/documents/page.tsx` that renders pending (amber/clock), signed (green/check), declined (red/X), or revision_requested (amber/message) badges with signer name
- [x] 3.4 Add `SignatureBadge` rendering to `DocCard` component alongside existing payment and quotation badges

## Task 4: Document Content Preview on Signing Page

- [x] 4.1 Extend `GET /api/signatures?token=` response in `app/api/signatures/route.ts` to include `sessionContext` (the session.context object) and `documentType` (session.document_type) in the token lookup branch
- [x] 4.2 Create `DocumentContentPreview` component in `app/sign/[token]/page.tsx` — collapsible card showing from/to parties, description, line items table, total, terms, notes; defaults expanded on desktop, collapsed on mobile
- [x] 4.3 Integrate `DocumentContentPreview` into the signing page between the existing document card and signer info fields, with fallback message when context is empty

## Task 5: Editable Signing Invitation Email

- [x] 5.1 Modify `components/get-signature-modal.tsx` to add an auto-generated email message textarea below the signer email field, pre-filled with "Hi [Name], [Business] is requesting your electronic signature on [DocType] [Ref]. Please review and sign using the secure link below."
- [x] 5.2 Pass the edited message as `personalMessage` in the POST body to `/api/signatures`
- [x] 5.3 Update the signing URL display in `buildSigningInvitationEmail` in `app/api/signatures/route.ts` to show a short label "Sign at clorefy.com" in the visible link text while keeping the full URL in the href

## Task 6: Signature Details Panel in My Documents

- [x] 6.1 Extend `GET /api/signatures?sessionId=` select in `app/api/signatures/route.ts` to include `ip_address` and `verification_url` fields for authenticated requests
- [x] 6.2 Create `SignatureDetailsPanel` component in `app/documents/page.tsx` — expandable panel showing each signer's name, email, party, status, signed_at timestamp, IP address, verification URL link, and decline/revision reason if present
- [x] 6.3 Add signature icon toggle button to DocCard action row (visible when session has signatures), wire to expand/collapse SignatureDetailsPanel using the same grid animation pattern as PaymentPanel

## Task 7: Legal Evidence Package Download

- [x] 7.1 Create `app/api/signatures/evidence/[sessionId]/route.ts` — authenticated endpoint that verifies ownership, fetches session + signatures + audit events, generates cover page + original document + certificate + audit trail PDFs using @react-pdf/renderer, merges with pdf-lib, returns as downloadable PDF
- [x] 7.2 Add "Evidence Package" download link to DocCard in `app/documents/page.tsx` next to existing "Signed PDF" link, visible only when session.status === "signed"
