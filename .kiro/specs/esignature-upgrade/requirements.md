# Requirements Document

## Introduction

This feature upgrades CLOREFY.COM's existing e-signature system from a basic signature capture into a legally defensible, audit-trailed signing workflow. It also adds an online Accept / Decline / Request Changes flow for quotations.

The current system (`app/sign/[token]/page.tsx`, `app/api/signatures/`) captures a drawn signature and stores it, but produces no document fingerprint, no certificate page, no verification URL, and sends no notifications back to the document owner. Clients receiving quotations have no online way to respond — they must reply by email.

This upgrade builds everything in-house (no external e-signature APIs) on top of the existing Next.js 16 / Supabase / Mailtrap stack, and must integrate cleanly with the existing signing token flow, the public view page (`/view/[sessionId]`), the send-email flow, and the notifications system.

### Legal Context

Electronic signatures are legally valid across all 11 supported countries:
- **USA** — ESIGN Act (2000) + UETA: requires intent to sign, consent to electronic business, association of signature with the record, and record retention.
- **EU (Germany, France, Netherlands)** — eIDAS Regulation: Simple Electronic Signatures (SES) are valid for most commercial documents; the audit trail is the key evidence.
- **UK** — Electronic Communications Act 2000 + eIDAS (retained): same SES standard applies.
- **India** — IT Act 2000 (amended 2008): electronic signatures carry the same legal weight as handwritten signatures when authentication and integrity requirements are met.
- **UAE, Singapore, Philippines, Canada, Australia** — each has equivalent national e-signature legislation recognising SES for commercial contracts, invoices, and quotations.

The four universal pillars required for legal enforceability are: **Intent**, **Consent**, **Attribution** (audit trail), and **Record Integrity** (document fingerprint).

---

## Glossary

- **Signing_System**: The upgraded e-signature subsystem of Invo.ai, covering token generation, the signing page, audit trail recording, certificate generation, and verification.
- **Document_Fingerprint**: A SHA-256 hash of the canonical document JSON at the moment the signing request is created, stored immutably and used to prove the document was not altered after signing.
- **Audit_Trail**: The immutable, timestamped log of every event in a document's lifecycle (created, sent, viewed, signed, declined, completed).
- **Certificate_Page**: A PDF page appended to the signed document summarising all signers, timestamps, IP addresses, the Document_Fingerprint, and the Verification_URL.
- **Verification_URL**: A public URL (e.g. `https://clorefy.com/verify/[signatureId]`) where anyone can confirm a signature's authenticity without logging in.
- **Signing_Token**: The existing `sign_[uuid]` token that grants a specific signer access to the signing page.
- **Quotation_Response**: A client action on a quotation — one of Accept, Decline, or Request Changes.
- **Notification_System**: The existing `notifications` table and page (`/notifications`) used to surface in-app alerts to document owners.
- **Document_Owner**: The authenticated Invo.ai user who created and sent the document.
- **Signer**: The external recipient who receives a signing link and signs the document.
- **Client**: The external recipient of a quotation who responds via the public view page.
- **Mailtrap**: The email delivery service already integrated in the platform.
- **R2**: Cloudflare R2 object storage already used for signature images.
- **Signing_Page**: The existing public page at `/sign/[token]` where signers draw their signature.
- **Public_View_Page**: The existing public page at `/view/[sessionId]` where email recipients view documents.
- **Document_Session**: A row in the `document_sessions` table representing a generated document.

---

## Requirements

### Requirement 1: Document Fingerprinting

**User Story:** As a Document_Owner, I want a tamper-proof fingerprint of my document to be recorded at the moment I send it for signing, so that I can prove in a dispute that the document was not altered after the signer agreed to it.

#### Acceptance Criteria

1. WHEN a signing request is created via `POST /api/signatures`, THE Signing_System SHALL compute a SHA-256 hash of the canonical document JSON (the `context` field of the Document_Session) and store it in the `document_hash` column of the `signatures` table.
2. THE Signing_System SHALL compute the Document_Fingerprint before any signing token is issued, so the hash reflects the document state at the time of the request.
3. WHEN a signer submits their signature, THE Signing_System SHALL recompute the SHA-256 hash of the current document JSON and compare it to the stored Document_Fingerprint.
4. IF the recomputed hash does not match the stored Document_Fingerprint, THEN THE Signing_System SHALL reject the signing submission with a 409 error and record a `signature.tamper_detected` event in the Audit_Trail.
5. THE Signing_System SHALL store the Document_Fingerprint as a lowercase hex string of exactly 64 characters.
6. FOR ALL valid signing requests, the stored Document_Fingerprint SHALL remain unchanged between creation and completion of the signing flow.

---

### Requirement 2: Audit Trail Recording

**User Story:** As a Document_Owner, I want a complete, timestamped record of every action taken on my document, so that I have legally defensible evidence of the signing process.

#### Acceptance Criteria

1. WHEN a signing request is created, THE Signing_System SHALL record an `audit_event` with action `signature.request_created`, including: `signature_id`, `document_id`, `signer_email`, `signer_name`, `party`, `document_hash`, `ip_address` of the requester, and `created_at` timestamp.
2. WHEN a signer opens the Signing_Page (i.e. the token is fetched via `GET /api/signatures?token=`), THE Signing_System SHALL record an `audit_event` with action `signature.viewed`, including: `signature_id`, `ip_address` of the signer, `user_agent`, and `viewed_at` timestamp.
3. WHEN a signer successfully submits their signature, THE Signing_System SHALL record an `audit_event` with action `signature.signed`, including: `signature_id`, `ip_address`, `user_agent`, `signed_at` timestamp, and `signature_image_key` (R2 object key).
4. WHEN all required signers for a document have signed, THE Signing_System SHALL record an `audit_event` with action `signature.completed`, including: `document_id`, `completed_at` timestamp, and the list of all `signature_id` values.
5. IF a signer's token has expired when they attempt to open the Signing_Page, THEN THE Signing_System SHALL record an `audit_event` with action `signature.expired`, including: `signature_id` and `attempted_at` timestamp.
6. THE Signing_System SHALL store all audit events in a dedicated `signature_audit_events` table with a non-nullable `created_at` column defaulting to `NOW()`.
7. THE Signing_System SHALL never delete or update audit event rows — the table SHALL be append-only, enforced by a Supabase RLS policy that permits INSERT but denies UPDATE and DELETE for all roles.
8. FOR ALL audit events, THE Signing_System SHALL record the UTC timestamp with millisecond precision.

---

### Requirement 3: Verification URL

**User Story:** As a Signer or third party, I want to verify the authenticity of a signed document using a public URL, so that I can confirm the signature is genuine without needing an Invo.ai account.

#### Acceptance Criteria

1. THE Signing_System SHALL generate a Verification_URL in the format `https://clorefy.com/verify/[signatureId]` for every completed signature.
2. WHEN a GET request is made to `/verify/[signatureId]`, THE Signing_System SHALL display a public verification page showing: signer name, signer email, signed timestamp, Document_Fingerprint (truncated to first 16 chars for display), document type, and signing status.
3. WHEN a GET request is made to `/verify/[signatureId]` for a valid completed signature, THE Signing_System SHALL return HTTP 200 with a `verified: true` indicator.
4. IF the `signatureId` does not exist or the signature has not been completed, THEN THE Signing_System SHALL return a page with `verified: false` and a clear explanation.
5. THE Signing_System SHALL NOT require authentication to access the verification page.
6. THE Signing_System SHALL include the Verification_URL in the Certificate_Page appended to the signed PDF.
7. WHILE a verification page is being served, THE Signing_System SHALL NOT expose the full Document_Fingerprint hash, the signer's IP address, or the signature image URL to unauthenticated visitors.

---

### Requirement 4: Certificate Page

**User Story:** As a Document_Owner, I want a certificate page automatically appended to the signed PDF, so that the document is self-contained and legally defensible without needing to reference an external system.

#### Acceptance Criteria

1. WHEN all required signers have completed signing, THE Signing_System SHALL generate a Certificate_Page and append it as the final page of the signed PDF.
2. THE Certificate_Page SHALL include the following fields for each signer: full name, email address, role/party, date and time of signing (UTC, formatted as `DD MMM YYYY HH:mm UTC`), and IP address (last octet masked, e.g. `192.168.1.xxx`).
3. THE Certificate_Page SHALL include: Document_Fingerprint (full 64-char SHA-256 hex), Verification_URL, document title or reference number, document type, date the signing request was created, and the Invo.ai platform name and logo.
4. THE Certificate_Page SHALL include a visual representation of each signer's drawn signature image.
5. THE Certificate_Page SHALL be generated using `@react-pdf/renderer` consistent with the existing PDF template system in `lib/pdf-templates.tsx`.
6. THE Certificate_Page SHALL be stored as a PDF in Cloudflare R2 under the key `certificates/[documentId]_certificate.pdf`.
7. WHEN a Document_Owner downloads the signed document, THE Signing_System SHALL serve the version with the Certificate_Page appended.
8. THE Certificate_Page SHALL include a statement: "This document was electronically signed via Invo.ai. The signatures and audit trail are legally binding under applicable electronic signature laws."
9. IF signature image upload to R2 fails, THEN THE Signing_System SHALL still generate the Certificate_Page using the base64 data URL fallback, and SHALL record a `signature.r2_fallback` audit event.

---

### Requirement 5: Signing Page Upgrade

**User Story:** As a Signer, I want a clear, trustworthy signing experience that shows me the document I am signing and explains the legal implications, so that I can sign with confidence.

#### Acceptance Criteria

1. WHEN a signer opens the Signing_Page, THE Signing_System SHALL display a read-only preview of the document being signed (rendered using the existing PDF viewer from `app/view/[sessionId]/page.tsx`).
2. THE Signing_Page SHALL display the Document_Owner's business name and logo (fetched from the `businesses` table via the document's `user_id`).
3. THE Signing_Page SHALL display the document reference number, document type, and the expiry date of the signing link.
4. THE Signing_Page SHALL require the signer to check a consent checkbox with the text: "I agree that this electronic signature is legally binding and constitutes my intent to sign this document electronically."
5. WHEN a signer submits their signature, THE Signing_System SHALL display a confirmation screen showing: the signer's name, the document reference, the exact timestamp of signing, and the Verification_URL.
6. THE Signing_Page SHALL display a "Secured by Invo.ai" trust badge with a shield icon.
7. WHILE the signing token is expired, THE Signing_Page SHALL display an expiry message and SHALL NOT render the signature pad.
8. WHILE the document has already been signed by this signer, THE Signing_Page SHALL display a "Already Signed" confirmation screen with the original signing timestamp.
9. THE Signing_Page SHALL be fully responsive and usable on mobile devices with a minimum touch target size of 44×44px for all interactive elements.

---

### Requirement 6: Owner Notifications

**User Story:** As a Document_Owner, I want to be notified immediately when a signer views, signs, or when a signing link expires, so that I can take timely action.

#### Acceptance Criteria

1. WHEN a signer opens the Signing_Page for the first time, THE Signing_System SHALL create a notification in the `notifications` table for the Document_Owner with type `signature_viewed`, title "Document Viewed", and message "[Signer Name] viewed your [document type] for signing."
2. WHEN a signer successfully submits their signature, THE Signing_System SHALL create a notification in the `notifications` table for the Document_Owner with type `signature_signed`, title "Document Signed", and message "[Signer Name] signed your [document type] [reference number]."
3. WHEN all required signers have completed signing, THE Signing_System SHALL create a notification in the `notifications` table for the Document_Owner with type `signature_completed`, title "All Signatures Complete", and message "Your [document type] [reference number] has been fully signed by all parties."
4. WHEN a signing link expires without being signed, THE Signing_System SHALL create a notification in the `notifications` table for the Document_Owner with type `signature_expired`, title "Signing Link Expired", and message "The signing link for [Signer Name] on [document type] [reference number] has expired."
5. THE Signing_System SHALL send a confirmation email to the Signer after successful signing, containing: the document reference, the signing timestamp, and the Verification_URL.
6. THE Notification_System SHALL display `signature_viewed`, `signature_signed`, `signature_completed`, and `signature_expired` notification types with distinct icons and colours in the existing `/notifications` page.
7. THE Signing_System SHALL always record in-app notifications in the `notifications` table regardless of any other failures.

---

### Requirement 7: Send-for-Signature Flow (Owner UI)

**User Story:** As a Document_Owner, I want to send any document for e-signature directly from the document preview toolbar, so that I can initiate the signing process without leaving my workflow.

#### Acceptance Criteria

1. THE Document_Preview toolbar SHALL include a "Get Signature" button for documents of type contract, quotation, and proposal.
2. WHEN the Document_Owner clicks "Get Signature", THE Signing_System SHALL open a modal dialog requesting: signer name, signer email, signer role/party (defaulting to "Client"), and an optional personal message.
3. THE modal SHALL validate that the signer email is a valid email address before allowing submission.
4. WHEN the Document_Owner submits the modal, THE Signing_System SHALL call `POST /api/signatures` to create the signing request, generate the Signing_Token, and return the signing URL.
5. AFTER a signing request is created, THE Signing_System SHALL automatically send a signing invitation email to the signer via Mailtrap, containing: the Document_Owner's business name, document type and reference, a prominent "Sign Document" button linking to the Signing_Page, and the expiry date of the link.
6. THE modal SHALL display a success state showing the signing URL and a "Copy Link" button after the request is created.
7. THE Document_Preview toolbar SHALL show a "Pending Signature" status badge when a document has one or more unsigned signature requests.
8. THE Document_Preview toolbar SHALL show a "Signed" status badge when all signature requests for a document are completed.
9. WHERE a document already has a completed signature, THE Signing_System SHALL allow the Document_Owner to download the signed PDF with the Certificate_Page appended.

---

### Requirement 8: Quotation Accept / Decline / Request Changes Flow

**User Story:** As a Client receiving a quotation, I want to Accept, Decline, or Request Changes directly from the online view page, so that I can respond without sending a separate email.

#### Acceptance Criteria

1. WHEN a Client opens the Public_View_Page for a document of type `quotation`, THE Signing_System SHALL display three action buttons: "Accept Quotation" (primary, green), "Decline" (secondary, outlined), and "Request Changes" (secondary, outlined).
2. WHEN a Client clicks "Accept Quotation", THE Signing_System SHALL display a confirmation dialog asking for the Client's name and email address before recording the acceptance.
3. WHEN a Client confirms acceptance, THE Signing_System SHALL record a `quotation_response` row with: `session_id`, `response_type: "accepted"`, `client_name`, `client_email`, `ip_address`, `user_agent`, and `responded_at` timestamp.
4. WHEN a Client clicks "Decline", THE Signing_System SHALL display a dialog asking for an optional reason before recording the decline.
5. WHEN a Client confirms decline, THE Signing_System SHALL record a `quotation_response` row with `response_type: "declined"` and the optional `reason` field.
6. WHEN a Client clicks "Request Changes", THE Signing_System SHALL display a dialog with a required text area for the Client to describe the requested changes.
7. WHEN a Client submits a change request, THE Signing_System SHALL record a `quotation_response` row with `response_type: "changes_requested"` and the `reason` field containing the change description.
8. AFTER any Quotation_Response is recorded, THE Signing_System SHALL create an in-app notification for the Document_Owner with the appropriate type (`quotation_accepted`, `quotation_declined`, `quotation_changes_requested`).
9. WHEN a Client has already responded to a quotation, THE Public_View_Page SHALL display the response status ("You accepted this quotation on [date]") and SHALL hide the action buttons.
10. THE Public_View_Page SHALL display the action buttons only for documents of type `quotation` and only when the quotation has not yet received a response.
11. IF the Client's email is not already known (i.e. the quotation was not sent via the email flow), THEN THE Signing_System SHALL require the Client to enter their email in the response dialog.

---

### Requirement 9: Signing Invitation Email

**User Story:** As a Signer, I want to receive a professional, branded email with a clear call-to-action to sign the document, so that I understand what is being asked of me and can sign easily.

#### Acceptance Criteria

1. THE Signing_System SHALL send a signing invitation email to the Signer when a signing request is created, using the existing `sendEmail` function and `renderEmailTemplate` pattern from `lib/email-template.ts`.
2. THE signing invitation email SHALL include: the Document_Owner's business name and logo, the document type and reference number, a prominent "Sign Document" button linking to the Signing_Page, the expiry date of the signing link, and a plain-text fallback URL.
3. THE signing invitation email SHALL include a security notice: "This signing link is unique to you. Do not share it."
4. THE signing invitation email subject SHALL follow the pattern: "[Business Name] requests your signature on [Document Type] [Reference Number]".
5. IF the signing invitation email fails to send, THEN THE Signing_System SHALL return an error to the Document_Owner's UI and SHALL NOT create the signature record (atomic operation: email must succeed before the record is persisted).
6. THE Signing_System SHALL send a signing completion email to the Signer after they sign, containing: the document reference, the signing timestamp, and the Verification_URL.
7. THE signing completion email subject SHALL follow the pattern: "You signed [Document Type] [Reference Number] — [Business Name]".

---

### Requirement 10: Security and Integrity

**User Story:** As a Document_Owner, I want the signing system to be resistant to tampering, replay attacks, and unauthorised access, so that signed documents are trustworthy.

#### Acceptance Criteria

1. THE Signing_System SHALL enforce a maximum of 5 signature submission attempts per Signing_Token before permanently invalidating the token and recording a `signature.abuse_detected` audit event.
2. THE Signing_System SHALL apply IP-based rate limiting of 10 requests per minute to the `POST /api/signatures/sign` endpoint, returning HTTP 429 when exceeded.
3. THE Signing_System SHALL validate that the Signing_Token format matches `sign_[32 hex chars]` before performing any database lookup.
4. THE Signing_System SHALL store the Document_Fingerprint using a server-side SHA-256 computation — the client SHALL NOT be able to supply or influence the hash value.
5. THE Signing_System SHALL set the `expires_at` for all Signing_Tokens to exactly 7 days from creation, and SHALL reject any signing attempt after expiry with HTTP 410.
6. THE Signing_System SHALL use the existing `createServerSupabaseClient` (service role) for all public signing endpoint database operations, ensuring RLS policies do not block legitimate signer access.
7. THE Signing_System SHALL validate that the signature image data URL is a valid `data:image/png` or `data:image/jpeg` format and does not exceed 500KB decoded size before processing.
8. THE `signature_audit_events` table SHALL have a Supabase RLS policy that allows INSERT from the service role only, and SELECT from the document owner only (via `user_id` join through `documents` → `document_sessions`).
9. THE `quotation_responses` table SHALL have a Supabase RLS policy that allows INSERT from unauthenticated users (public) and SELECT from the document owner only.
10. WHEN a Quotation_Response is submitted, THE Signing_System SHALL validate that the `session_id` corresponds to a document of type `quotation` before recording the response.

---

### Requirement 11: Signed PDF Download

**User Story:** As a Document_Owner, I want to download the final signed PDF with the Certificate_Page included, so that I have a single self-contained file for my records.

#### Acceptance Criteria

1. WHEN a Document_Owner requests a download of a fully signed document, THE Signing_System SHALL serve the PDF with the Certificate_Page appended as the final page.
2. THE Signing_System SHALL generate the signed PDF on-demand by combining the original document PDF (generated from the session context) with the Certificate_Page.
3. THE signed PDF download SHALL be available from the Document_Preview toolbar via a "Download Signed PDF" button that appears only when all signatures are complete.
4. THE signed PDF download SHALL also be available from the `/documents` page for sessions with `status: "signed"`.
5. WHEN the Certificate_Page PDF is stored in R2, THE Signing_System SHALL serve it via a presigned URL with a 1-hour expiry.
6. THE filename of the downloaded signed PDF SHALL follow the pattern: `[referenceNumber]_signed_[YYYY-MM-DD].pdf`.
7. IF the Certificate_Page has not yet been generated (e.g. due to a prior failure), THEN THE Signing_System SHALL regenerate it on-demand before serving the download.

---

### Requirement 12: Quotation Response Notifications in the UI

**User Story:** As a Document_Owner, I want to see quotation responses clearly in my notifications and on the document, so that I can act on them quickly.

#### Acceptance Criteria

1. THE Notification_System SHALL display `quotation_accepted` notifications with a green checkmark icon and the message "[Client Name] accepted your quotation [reference number]."
2. THE Notification_System SHALL display `quotation_declined` notifications with a red X icon and the message "[Client Name] declined your quotation [reference number]."
3. THE Notification_System SHALL display `quotation_changes_requested` notifications with an orange edit icon and the message "[Client Name] requested changes to your quotation [reference number]."
4. THE `/documents` page SHALL display a response status badge on quotation sessions: "Accepted", "Declined", or "Changes Requested", using the most recent `quotation_response` row.
5. WHEN a Document_Owner clicks a quotation response notification, THE Notification_System SHALL navigate to the relevant document session.
6. THE Notification_System SHALL display the full change request text in the notification detail view for `quotation_changes_requested` notifications.
