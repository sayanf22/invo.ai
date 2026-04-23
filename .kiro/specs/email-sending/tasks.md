# Implementation Plan: Email Sending

## Overview

Implement email sending for Clorefy, enabling users to deliver invoices, contracts, quotations, and proposals to clients via the Mailtrap REST API. The implementation covers the email service utility, API endpoint, HTML template renderer, UI components (send button, dialog, share integration), database schema with RLS, webhook handler for delivery tracking, and email status display on the documents page.

## Tasks

- [x] 1. Database schema and rate limiter setup
  - [x] 1.1 Create `document_emails` table migration
    - Create SQL migration with `document_emails` table, indexes, and RLS policies as defined in the design
    - Include columns: id, user_id, session_id, recipient_email, document_type, personal_message, mailtrap_message_id, status, subject, created_at, delivered_at, opened_at, bounced_at, updated_at
    - Add CHECK constraints for document_type and status
    - Add foreign keys to auth.users and document_sessions
    - Add RLS policies for SELECT (own records) and INSERT (own records)
    - Add indexes on user_id, session_id, mailtrap_message_id, and status
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.2 Add "email" category to rate limiter
    - Add `"email"` to the `RouteCategory` type in `lib/rate-limiter.ts`
    - Add `email: { maxRequests: 15, windowSeconds: 60 }` to `RATE_LIMITS`
    - _Requirements: 2.10_

  - [x] 1.3 Add email audit actions to audit log
    - Add `"email.send"`, `"email.resend"`, and `"email.webhook"` to the `AuditAction` type in `lib/audit-log.ts`
    - Add `"email"` to the `ResourceType` type
    - _Requirements: 2.12_

- [x] 2. Email service utility (`lib/mailtrap.ts`)
  - [x] 2.1 Implement `sendEmail` function
    - Create `lib/mailtrap.ts` with `SendEmailParams`, `SendEmailResult`, `SendEmailError`, and `SendEmailResponse` types
    - Implement `sendEmail()` using plain `fetch()` to POST to `https://send.api.mailtrap.io/api/send`
    - Set `from.email` to `no-reply@clorefy.com` always
    - Set `from.name` to `"{senderName} via Clorefy"` when senderName is provided
    - Use Bearer token from `MAILTRAP_API_KEY` env var
    - Throw descriptive error if `MAILTRAP_API_KEY` is missing
    - Return structured error with `retryAfter` for HTTP 429
    - Return structured error with statusCode and message for other non-2xx
    - Handle network/fetch failures gracefully
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 2.2 Write property test: Mailtrap payload construction invariants
    - **Property 1: Mailtrap payload construction invariants**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.3 Write property test: Non-2xx error response structure
    - **Property 2: Non-2xx error response structure**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 2.4 Write unit tests for sendEmail
    - Test throws when MAILTRAP_API_KEY is missing
    - Test handles 429 with retry-after header extraction
    - Test handles network failures gracefully
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 3. Email template renderer (`lib/email-template.ts`)
  - [x] 3.1 Implement `renderEmailTemplate` and `generateEmailSubject`
    - Create `lib/email-template.ts` with `EmailTemplateData` interface
    - Implement `generateEmailSubject()` with format per document type: "Invoice/Contract/Quotation/Proposal {ref} from {businessName}"
    - Implement `renderEmailTemplate()` producing inline CSS + table-based HTML
    - Include business name in header; include logo img when businessLogoUrl is provided
    - Display document type label and reference number
    - Show total amount + currency for invoices/quotations; show description for contracts/proposals
    - Include "View Document" button linking to viewDocumentUrl
    - Include "Pay Now" button only when payNowUrl is provided (invoices with active payment link)
    - Display personal message in visually distinct section when provided
    - Include "Sent via Clorefy" footer with link to https://clorefy.com
    - Use max 600px content width, all inline styles, no `<style>` blocks, keep under 102KB
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.2 Write property test: Email template required elements
    - **Property 5: Email template required elements**
    - **Validates: Requirements 3.1, 3.3, 3.5, 3.9, 10.1**

  - [x] 3.3 Write property test: Email template conditional elements
    - **Property 6: Email template conditional elements**
    - **Validates: Requirements 3.2, 3.4, 3.6, 3.7, 3.8, 10.6**

  - [x] 3.4 Write property test: Email template inline CSS and table layout
    - **Property 7: Email template uses inline CSS and table layout**
    - **Validates: Requirements 3.10**

  - [x] 3.5 Write property test: Subject line formatting for all document types
    - **Property 8: Subject line formatting for all document types**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Send Document API endpoint (`app/api/emails/send-document/route.ts`)
  - [x] 5.1 Implement POST handler for sending document emails
    - Create `app/api/emails/send-document/route.ts`
    - Authenticate via `authenticateRequest()` → 401 if unauthenticated
    - Apply `checkRateLimit(userId, "email")` → 429 if exceeded
    - Validate `recipientEmail` via `sanitizeEmail()` → 400 if invalid
    - Sanitize `personalMessage` via `sanitizeText()`, enforce 500 char max → 400 if too long
    - Validate required fields (sessionId, recipientEmail) → 400 if missing
    - Fetch document_sessions where id = sessionId AND user_id = userId → 404 if not found
    - Fetch businesses for sender name + logo URL
    - For invoices: fetch invoice_payments for active payment link (status "created" or "partially_paid")
    - Generate subject via `generateEmailSubject()`
    - Render HTML via `renderEmailTemplate()`
    - Send via `sendEmail()` from lib/mailtrap.ts
    - Insert record into document_emails with status "sent" and mailtrap_message_id
    - Log audit via `logAudit()` with action "email.send"
    - Support `resend` flag: creates new record, pre-populates from most recent email
    - Return 200 with emailId on success
    - Handle Mailtrap 429 → return 429 with user-facing message
    - Handle other Mailtrap errors → return 502
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 8.1, 8.2, 8.3_

  - [x] 5.2 Write property test: Email input validation and sanitization
    - **Property 3: Email input validation and sanitization**
    - **Validates: Requirements 2.3, 2.11**

  - [x] 5.3 Write property test: Successful send creates email record
    - **Property 4: Successful send creates email record**
    - **Validates: Requirements 2.6, 6.1, 6.4**

  - [x] 5.4 Write unit tests for Send Document API
    - Test returns 401 without auth
    - Test returns 404 for non-owned session
    - Test returns 400 for missing required fields
    - Test returns 400 for personal message > 500 chars
    - Test resend creates a new email record
    - _Requirements: 2.1, 2.2, 2.4, 2.8, 2.11, 8.2_

- [x] 6. Webhook handler (`app/api/emails/webhook/route.ts`)
  - [x] 6.1 Implement POST handler for Mailtrap delivery webhooks
    - Create `app/api/emails/webhook/route.ts`
    - Accept POST requests without user authentication
    - Read raw body for signature verification
    - When `MAILTRAP_WEBHOOK_SIGNATURE_KEY` is set, verify HMAC signature → return 200 + log warning if invalid
    - Parse JSON body, extract `events` array
    - Validate required fields per event: event, message_id, event_id, timestamp
    - Check event_id for idempotency (skip duplicates)
    - Map events: "delivery" → "delivered"/delivered_at, "bounce"/"reject"/"spam" → "bounced"/bounced_at, "open" → "opened"/opened_at
    - Update document_emails where mailtrap_message_id matches
    - Return 200 for all requests (valid, invalid, missing records)
    - Log warnings for missing records, invalid payloads, invalid signatures
    - Use Supabase service role client for updates (bypasses RLS)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 6.2 Write property test: Webhook event-to-status mapping
    - **Property 9: Webhook event-to-status mapping**
    - **Validates: Requirements 7.3, 7.4, 7.5**

  - [x] 6.3 Write property test: Webhook handler always returns 200
    - **Property 10: Webhook handler always returns 200**
    - **Validates: Requirements 7.2, 7.6, 7.7**

  - [x] 6.4 Write unit tests for webhook handler
    - Test processes events array correctly
    - Test skips duplicate event_ids
    - Test rejects invalid signatures when key is configured
    - Test returns 200 for invalid JSON
    - Test returns 200 when no matching email record found
    - _Requirements: 7.2, 7.6, 7.7, 7.8, 7.9_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. UI components: Send Email Button and Dialog
  - [x] 8.1 Create `SendEmailDialog` component
    - Create `components/send-email-dialog.tsx` as a modal dialog
    - Include required email input pre-populated from `invoiceData.toEmail` or most recent email record
    - Include optional personal message textarea with 500 char max and character counter
    - Show preview of subject line
    - Include "Cancel" and "Send" buttons; disable Send until valid email
    - On send: make authenticated POST to `/api/emails/send-document` via `authFetch` pattern
    - Show loading spinner on Send button, disable all inputs while sending
    - On success: close dialog, show Sonner success toast
    - On error: show Sonner error toast, keep dialog open
    - Support resend: pre-populate email from most recent email record for the session
    - Add proper ARIA labels, keyboard navigation, and focus management
    - Style with existing Clorefy patterns (rounded-3xl, backdrop blur)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 8.4_

  - [x] 8.2 Create `SendEmailButton` toolbar component
    - Create `components/send-email-button.tsx`
    - Render mail icon button following existing toolbar button styling (rounded-xl, border, hover states)
    - Only render when `sessionId` is truthy
    - Open `SendEmailDialog` on click
    - Accept `onEmailSent` callback prop
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 8.3 Integrate Send button into DocumentPreview toolbar
    - Add `SendEmailButton` to `components/document-preview.tsx` toolbar, positioned between Share and Print buttons
    - Pass sessionId, invoiceData, and documentType props
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 8.4 Write unit tests for Send Dialog and Send Button
    - Test Send Dialog pre-populates toEmail from document data
    - Test Send Dialog pre-populates email from last sent record on resend
    - Test Send Dialog disables Send button for invalid email
    - Test Send Dialog shows loading state during send
    - Test Send Dialog shows character counter for personal message
    - _Requirements: 4.2, 4.5, 4.7, 8.4_

- [x] 9. Share button integration
  - [x] 9.1 Update ShareButton with "Send via Clorefy Email" option
    - Add `sessionId` and `onOpenSendDialog` props to `ShareButtonProps` in `components/share-button.tsx`
    - Add "Send via Clorefy Email" as first item in "Share Document" section with mail icon
    - Only show when `sessionId` is available
    - Rename existing "Send via Email" (mailto:) to "Open in Email App"
    - Wire click to `onOpenSendDialog` callback which opens SendEmailDialog
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 9.2 Wire ShareButton and SendEmailDialog in DocumentPreview
    - Update `DocumentPreview` to manage shared SendEmailDialog state
    - Pass sessionId and onOpenSendDialog to ShareButton
    - Ensure both toolbar Send button and Share dropdown "Send via Clorefy Email" open the same dialog
    - _Requirements: 9.2, 5.3_

  - [x] 9.3 Write unit tests for Share button integration
    - Test ShareButton shows "Send via Clorefy Email" when sessionId present
    - Test ShareButton hides "Send via Clorefy Email" when sessionId absent
    - Test existing "Send via Email" is renamed to "Open in Email App"
    - _Requirements: 9.1, 9.3, 9.4_

- [x] 10. Email status display on Documents page
  - [x] 10.1 Add email status badges to Documents page
    - Update `app/documents/page.tsx` to fetch latest email status per document session
    - Join or query `document_emails` alongside existing document session queries (no extra API calls per document)
    - Display "Sent" badge with timestamp when document has email records
    - Green badge for "delivered" status
    - Red "Bounced" badge for "bounced" status
    - Blue "Opened" badge for "opened" status
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 10.2 Write unit tests for email status badges
    - Test correct badge colors for delivered/bounced/opened statuses
    - Test badge shows most recent send timestamp
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout, matching the existing codebase
- All existing patterns are reused: `authenticateRequest()`, `checkRateLimit()`, `logAudit()`, `authFetch`, Sonner toasts
