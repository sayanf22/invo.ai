# Requirements Document

## Introduction

Email sending enables Clorefy users to deliver documents (invoices, contracts, quotations, proposals) directly to clients via email from within the platform. The system uses the Mailtrap Email API with plain `fetch()` for Cloudflare Workers compatibility, stores email history in Supabase for audit trails, and tracks delivery status via webhooks. Emails are sent from the verified `clorefy.com` domain with dynamic sender names reflecting each user's business identity.

## Glossary

- **Email_Service**: The server-side utility module (`lib/mailtrap.ts`) that sends transactional emails via the Mailtrap REST API using plain `fetch()`.
- **Send_Document_API**: The authenticated API endpoint (`POST /api/emails/send-document`) that orchestrates email composition and dispatch for any document type.
- **Send_Dialog**: The client-side modal component where users enter recipient email, optional personal message, and confirm sending.
- **Email_Template_Renderer**: The server-side module that generates branded HTML email content from document session data.
- **Webhook_Handler**: The API endpoint (`POST /api/emails/webhook`) that receives delivery status callbacks from Mailtrap.
- **Email_History_Store**: The Supabase `document_emails` table that persists all sent email records with delivery status.
- **Document_Session**: An existing Supabase record representing a generated document (invoice, contract, quotation, or proposal) with its context data.
- **Payment_Link**: An existing Razorpay/Stripe/Cashfree short URL attached to an invoice for online payment collection.
- **Mailtrap_API**: The external email delivery service at `https://send.api.mailtrap.io/api/send`, authenticated via Bearer token.

## Requirements

### Requirement 1: Email Service Utility

**User Story:** As a developer, I want a reusable email sending utility that communicates with the Mailtrap REST API using plain `fetch()`, so that emails can be sent from Cloudflare Workers without Node.js-only dependencies.

#### Acceptance Criteria

1. THE Email_Service SHALL send emails by making a POST request to `https://send.api.mailtrap.io/api/send` with a Bearer token from the `MAILTRAP_API_KEY` environment variable.
2. THE Email_Service SHALL set the sender address to `no-reply@clorefy.com` on every outgoing email.
3. WHEN a user's business name is available, THE Email_Service SHALL set the sender display name to "{BusinessName} via Clorefy".
4. IF the `MAILTRAP_API_KEY` environment variable is missing, THEN THE Email_Service SHALL throw a descriptive error indicating the API key is not configured.
5. IF the Mailtrap API returns an HTTP status code of 429, THEN THE Email_Service SHALL return a structured error object containing the retry-after duration.
6. IF the Mailtrap API returns an HTTP status code outside the 2xx range (excluding 429), THEN THE Email_Service SHALL return a structured error object containing the HTTP status code and the response body.
7. THE Email_Service SHALL use only the `fetch()` API with no npm packages for HTTP communication.
8. THE Email_Service SHALL accept recipient email, subject, HTML body, and sender display name as parameters.

### Requirement 2: Send Document API Endpoint

**User Story:** As a user, I want to send my documents to clients via a secure API endpoint, so that emails are dispatched reliably with proper authentication and validation.

#### Acceptance Criteria

1. THE Send_Document_API SHALL require authentication via the existing `authenticateRequest()` helper and return HTTP 401 for unauthenticated requests.
2. THE Send_Document_API SHALL validate that the provided session ID belongs to the authenticated user before sending.
3. THE Send_Document_API SHALL validate the recipient email format using the existing `sanitizeEmail()` function.
4. THE Send_Document_API SHALL accept a `sessionId`, `recipientEmail`, and optional `personalMessage` in the request body.
5. WHEN a valid request is received, THE Send_Document_API SHALL fetch the document session data, render the email HTML template, and dispatch the email via the Email_Service.
6. WHEN the email is dispatched successfully, THE Send_Document_API SHALL insert a record into the Email_History_Store with the sender user ID, recipient email, session ID, document type, and a status of "sent".
7. WHEN the email is dispatched successfully, THE Send_Document_API SHALL return HTTP 200 with the email record ID.
8. IF the document session is not found or does not belong to the authenticated user, THEN THE Send_Document_API SHALL return HTTP 404.
9. IF the Mailtrap API returns a rate limit error (HTTP 429), THEN THE Send_Document_API SHALL return HTTP 429 with a user-facing message indicating the daily email limit has been reached.
10. THE Send_Document_API SHALL enforce rate limiting using the existing `checkRateLimit()` function with a dedicated "email" category.
11. THE Send_Document_API SHALL sanitize the optional personal message using the existing `sanitizeText()` function before including it in the email body.
12. THE Send_Document_API SHALL log the email send action to the audit log using the existing `logAudit()` function.

### Requirement 3: Email HTML Template

**User Story:** As a user, I want my emailed documents to look professional and branded, so that my clients receive a polished communication that reflects my business identity.

#### Acceptance Criteria

1. THE Email_Template_Renderer SHALL include the sender's business name in the email header.
2. WHEN the sender's business has a logo URL stored in the `businesses` table, THE Email_Template_Renderer SHALL include the logo image in the email header.
3. THE Email_Template_Renderer SHALL display the document type (Invoice, Contract, Quotation, or Proposal) and the reference number or invoice number.
4. WHEN the document type is "invoice" or "quotation", THE Email_Template_Renderer SHALL display the total amount with the correct currency symbol.
5. THE Email_Template_Renderer SHALL include a "View Document" button that links to `/view/{sessionId}`.
6. WHEN the document type is "invoice" and an active payment link exists (status is "created" or "partially_paid"), THE Email_Template_Renderer SHALL include a "Pay Now" button that links to `/pay/{sessionId}`.
7. WHEN the document type is not "invoice" or no active payment link exists, THE Email_Template_Renderer SHALL omit the "Pay Now" button.
8. WHEN the sender includes a personal message, THE Email_Template_Renderer SHALL display the message in a visually distinct section of the email body.
9. THE Email_Template_Renderer SHALL include a Clorefy branding footer with the text "Sent via Clorefy" and a link to `https://clorefy.com`.
10. THE Email_Template_Renderer SHALL produce valid HTML that renders correctly in Gmail, Outlook, and Apple Mail by using inline CSS styles and table-based layout.

### Requirement 4: Send Dialog UI

**User Story:** As a user, I want a simple modal dialog to compose and send document emails, so that I can quickly deliver documents to my clients without leaving the document preview.

#### Acceptance Criteria

1. WHEN the user clicks the "Send" button in the document preview toolbar, THE Send_Dialog SHALL open as a modal overlay.
2. THE Send_Dialog SHALL display a required email input field pre-populated with the client's email from the document's `toEmail` field when available.
3. THE Send_Dialog SHALL display an optional multi-line text input for a personal message with a maximum length of 500 characters.
4. THE Send_Dialog SHALL display a "Send" confirmation button and a "Cancel" button.
5. THE Send_Dialog SHALL validate the email format on the client side before enabling the "Send" button.
6. WHEN the user clicks "Send", THE Send_Dialog SHALL make an authenticated POST request to the Send_Document_API using the existing `authFetch` pattern.
7. WHILE the email is being sent, THE Send_Dialog SHALL display a loading spinner on the "Send" button and disable all form inputs.
8. WHEN the API returns a success response, THE Send_Dialog SHALL close the modal and display a success toast notification using Sonner.
9. IF the API returns an error, THEN THE Send_Dialog SHALL display the error message as an error toast notification and keep the modal open.
10. THE Send_Dialog SHALL be accessible with proper ARIA labels, keyboard navigation, and focus management.

### Requirement 5: Send Button in Document Preview Toolbar

**User Story:** As a user, I want a visible "Send" button in the document preview toolbar, so that I can easily find and use the email sending feature.

#### Acceptance Criteria

1. THE Document_Preview toolbar SHALL display a "Send" button with a mail icon positioned between the Share button and the Print button.
2. THE "Send" button SHALL be visible only when a valid `sessionId` is available for the current document.
3. WHEN the user clicks the "Send" button, THE Document_Preview SHALL open the Send_Dialog.
4. THE "Send" button SHALL follow the existing toolbar button styling conventions (rounded-xl, border, hover states).

### Requirement 6: Email History Tracking

**User Story:** As a user, I want a record of every email I send, so that I have an audit trail of client communications.

#### Acceptance Criteria

1. THE Email_History_Store SHALL persist each sent email with the following fields: sender user ID, recipient email, session ID, document type, personal message (if provided), Mailtrap message ID, delivery status, and timestamps for created, delivered, opened, and bounced events.
2. THE Email_History_Store SHALL enforce Row Level Security so that users can only read their own email records.
3. THE Email_History_Store SHALL enforce a foreign key relationship between the session ID column and the `document_sessions` table.
4. WHEN a new email record is inserted, THE Email_History_Store SHALL set the initial status to "sent" and the `created_at` timestamp to the current time.

### Requirement 7: Delivery Status Webhooks

**User Story:** As a user, I want to know whether my emails were delivered, opened, or bounced, so that I can follow up with clients when needed.

#### Acceptance Criteria

1. THE Webhook_Handler SHALL accept POST requests from Mailtrap at the `/api/emails/webhook` endpoint without requiring user authentication.
2. THE Webhook_Handler SHALL validate incoming webhook payloads by checking for the presence of required Mailtrap event fields (`event`, `message_id`, `timestamp`, `event_id`) within the `events` array.
3. WHEN a "delivery" event is received, THE Webhook_Handler SHALL update the corresponding email record's status to "delivered" and set the `delivered_at` timestamp.
4. WHEN a "bounce" or "reject" event is received, THE Webhook_Handler SHALL update the corresponding email record's status to "bounced" and set the `bounced_at` timestamp.
5. WHEN an "open" event is received, THE Webhook_Handler SHALL update the corresponding email record's status to "opened" and set the `opened_at` timestamp.
6. IF no matching email record is found for the provided message ID, THEN THE Webhook_Handler SHALL return HTTP 200 and log a warning without failing.
7. THE Webhook_Handler SHALL return HTTP 200 for all valid webhook requests to prevent Mailtrap from retrying.
8. THE Webhook_Handler SHALL use idempotent processing by tracking the `event_id` to prevent duplicate event processing.
9. WHEN a `MAILTRAP_WEBHOOK_SIGNATURE_KEY` environment variable is configured, THE Webhook_Handler SHALL verify the webhook signature header to ensure the request originates from Mailtrap and reject requests with invalid signatures.

### Requirement 8: Resend Capability

**User Story:** As a user, I want to resend a previously sent email, so that I can re-deliver documents to clients who may have missed the original email.

#### Acceptance Criteria

1. WHEN the user triggers a resend for a document, THE Send_Document_API SHALL accept an optional `resend` flag in the request body.
2. WHEN the `resend` flag is true, THE Send_Document_API SHALL create a new email record in the Email_History_Store rather than updating the existing one.
3. THE Send_Document_API SHALL apply the same rate limiting and validation rules for resend requests as for initial send requests.
4. THE Send_Dialog SHALL pre-populate the recipient email from the most recent email record for the document session when resending.

### Requirement 9: Share Button Integration

**User Story:** As a user, I want the existing Share dropdown to include a "Send via Clorefy Email" option, so that I have a unified sharing experience with the new email sending feature integrated alongside WhatsApp, native share, and copy options.

#### Acceptance Criteria

1. THE Share_Button dropdown SHALL include a "Send via Clorefy Email" menu item with a mail icon, positioned as the first option in the "Share Document" section.
2. WHEN the user clicks "Send via Clorefy Email" in the Share dropdown, THE system SHALL open the Send_Dialog (same dialog as the toolbar Send button).
3. THE "Send via Clorefy Email" option SHALL only be visible when a valid `sessionId` is available.
4. THE existing "Send via Email" option (mailto: link) SHALL be renamed to "Open in Email App" to differentiate it from the new Clorefy email sending feature.
5. THE Share_Button SHALL work identically for all four document types: invoices, contracts, quotations, and proposals.

### Requirement 10: All Document Type Support

**User Story:** As a user, I want to send any of my documents (invoices, contracts, quotations, proposals) via email, so that I can deliver all types of business documents to my clients.

#### Acceptance Criteria

1. THE Email_Template_Renderer SHALL generate appropriate email content for all four document types: invoice, contract, quotation, and proposal.
2. WHEN the document type is "invoice", THE email subject SHALL follow the format "Invoice {invoiceNumber} from {businessName}".
3. WHEN the document type is "contract", THE email subject SHALL follow the format "Contract {referenceNumber} from {businessName}".
4. WHEN the document type is "quotation", THE email subject SHALL follow the format "Quotation {referenceNumber} from {businessName}".
5. WHEN the document type is "proposal", THE email subject SHALL follow the format "Proposal {referenceNumber} from {businessName}".
6. THE Email_Template_Renderer SHALL adapt the document summary section based on document type, showing amount and due date for invoices/quotations, and description for contracts/proposals.

### Requirement 11: Email Status Display on Documents Page

**User Story:** As a user, I want to see which documents have been emailed and their delivery status, so that I can track client communication at a glance.

#### Acceptance Criteria

1. WHEN a document has at least one associated email record, THE Documents_Page SHALL display a "Sent" badge with the most recent send timestamp next to the document entry.
2. WHEN the most recent email for a document has a status of "delivered", THE Documents_Page SHALL display the badge in a green color variant.
3. WHEN the most recent email for a document has a status of "bounced", THE Documents_Page SHALL display the badge in a red color variant with the text "Bounced".
4. WHEN the most recent email for a document has a status of "opened", THE Documents_Page SHALL display the badge in a blue color variant with the text "Opened".
5. THE Documents_Page SHALL fetch email status data alongside existing document session queries without introducing additional API calls per document.