# Requirements Document

## Introduction

Redesign the payment link flow in Clorefy to fix the broken editor toggle, replace raw Razorpay links with platform links (`clorefy.com/pay/[sessionId]`), create a public document view page for clients, and improve the payment lifecycle UX (cancel, refresh, lock, paid status). The goal is a seamless experience where clients see the invoice first, then pay — rather than being sent a raw payment gateway URL.

## Glossary

- **Editor_Panel**: The right-side editing panel in the document builder (Step 4: Payment & Notes section) implemented in `components/editor-panel.tsx`
- **Payment_Toggle**: The switch in the Editor_Panel that controls whether a payment link and QR code are embedded in the exported PDF
- **Payment_Link_Button**: The toolbar component (`components/payment-link-button.tsx`) that creates, displays, copies, and manages payment links
- **Platform_Link**: A Clorefy-hosted URL in the format `clorefy.com/pay/[sessionId]` that shows the document to the client with an embedded pay button
- **Gateway_Link**: The raw payment gateway URL (e.g., `rzp.io/...`, Stripe checkout URL, Cashfree link) used to collect payment
- **Public_View_Page**: A publicly accessible page at `/pay/[sessionId]` that renders the document and payment controls without requiring authentication
- **Payment_Gateway**: An external payment processor (Razorpay, Stripe, or Cashfree) connected by the user in Settings → Payments
- **Invoice_Payment**: A record in the `invoice_payments` Supabase table tracking payment link state for a document session
- **Document_Session**: A record in the `document_sessions` Supabase table containing the document context (InvoiceData) and metadata
- **Lock_State**: A condition where the document cannot be edited because an active payment link exists
- **Payment_Status**: One of `created`, `paid`, `partially_paid`, `expired`, or `cancelled` as tracked in Invoice_Payment

## Requirements

### Requirement 1: Fix Payment Link Toggle in Editor Panel

**User Story:** As a user, I want the payment link toggle in the Editor_Panel to correctly enable and disable payment link embedding in the PDF, so that I can control whether the payment URL and QR code appear on my exported document.

#### Acceptance Criteria

1. WHEN the Payment_Toggle is turned off while a payment link exists, THE Editor_Panel SHALL clear the `paymentLink` and `paymentLinkStatus` fields from InvoiceData
2. WHEN the Payment_Toggle is turned on while no payment link exists, THE Editor_Panel SHALL set a flag indicating the user intends to embed a payment link in the PDF
3. WHILE the Payment_Toggle is in the off state, THE Editor_Panel SHALL display the toggle in the inactive visual style (muted background, knob at left position)
4. WHILE the Payment_Toggle is in the on state, THE Editor_Panel SHALL display the toggle in the active visual style (primary background, knob at right position)
5. IF the Payment_Toggle onClick handler is invoked but no state change occurs, THEN THE Editor_Panel SHALL still allow subsequent toggle interactions without requiring a page refresh

### Requirement 2: Platform Link Instead of Gateway Link

**User Story:** As a user, I want the "Copy" button to copy a Clorefy Platform_Link instead of the raw Gateway_Link, so that my clients see the invoice document first before paying.

#### Acceptance Criteria

1. WHEN the user clicks the "Copy" button on the Payment_Link_Button, THE Payment_Link_Button SHALL copy the Platform_Link in the format `clorefy.com/pay/[sessionId]` to the clipboard
2. WHEN the user clicks the "WhatsApp" share button, THE Payment_Link_Button SHALL compose the message using the Platform_Link instead of the Gateway_Link
3. THE Payment_Link_Button SHALL store the Gateway_Link in the Invoice_Payment record for backend payment processing
4. THE Payment_Link_Button SHALL display the Platform_Link in the link preview area of the toolbar and Editor_Panel
5. WHEN a payment link is created, THE API SHALL generate and return both the Gateway_Link and the Platform_Link derived from the session ID

### Requirement 3: Public Document View Page

**User Story:** As a client receiving a payment link, I want to see the invoice document in a clean read-only view with a "Pay Now" button, so that I can review what I am paying for before completing payment.

#### Acceptance Criteria

1. THE Public_View_Page SHALL be accessible at the route `/pay/[sessionId]` without requiring authentication
2. WHEN a valid session ID is provided, THE Public_View_Page SHALL render the document in a read-only PDF preview
3. THE Public_View_Page SHALL display a "Pay Now" button that redirects the client to the Gateway_Link for the connected Payment_Gateway
4. WHEN the Payment_Status is `paid`, THE Public_View_Page SHALL display a "Paid" badge and hide the "Pay Now" button
5. WHEN the Payment_Status is `created` or `partially_paid`, THE Public_View_Page SHALL display a QR code for the Gateway_Link
6. WHEN the Payment_Status is `cancelled` or `expired`, THE Public_View_Page SHALL display a message indicating the payment link is no longer active and hide the "Pay Now" button
7. IF an invalid or non-existent session ID is provided, THEN THE Public_View_Page SHALL display a "Document not found" message
8. THE Public_View_Page SHALL display the seller's business name, document reference number, total amount, and currency
9. THE Public_View_Page SHALL be responsive and render correctly on mobile devices

### Requirement 4: Cancel Button Behavior

**User Story:** As a user, I want the cancel (X) button to safely cancel a payment link with proper safeguards, so that I do not accidentally cancel a completed payment or lose track of payment state.

#### Acceptance Criteria

1. WHILE the Payment_Status is `paid`, THE Payment_Link_Button SHALL NOT render the cancel (X) button
2. WHEN the user clicks the cancel (X) button, THE Payment_Link_Button SHALL display a confirmation dialog before proceeding with cancellation
3. WHEN the user confirms cancellation, THE Payment_Link_Button SHALL call the cancel-link API and update the Payment_Status to `cancelled`
4. WHEN cancellation is confirmed and succeeds, THE Payment_Link_Button SHALL invoke the `onLockChange` callback with `false` to unlock the document for editing
5. IF the cancellation API call fails, THEN THE Payment_Link_Button SHALL display an error toast and retain the current Payment_Status

### Requirement 5: Refresh Payment Status

**User Story:** As a user, I want the refresh button to fetch the latest payment status from the gateway, so that I can see if my client has paid without leaving the editor.

#### Acceptance Criteria

1. WHEN the user clicks the refresh (circular arrow) button, THE Payment_Link_Button SHALL fetch the latest Payment_Status from the server
2. WHILE the refresh request is in progress, THE Payment_Link_Button SHALL display a spinning animation on the refresh icon
3. WHEN the refreshed Payment_Status is `paid`, THE Payment_Link_Button SHALL update the UI to show the paid state and invoke `onPaymentLinkChange` with the updated status
4. IF the refresh API call fails, THEN THE Payment_Link_Button SHALL display an error toast and retain the previously known Payment_Status

### Requirement 6: Lock Indicator

**User Story:** As a user, I want a clear visual indicator that my invoice is locked while a payment link is active, so that I understand why I cannot edit the document.

#### Acceptance Criteria

1. WHILE the Payment_Status is `created` or `partially_paid`, THE Payment_Link_Button SHALL display a lock icon with a "Locked" label
2. WHEN the Payment_Status changes to `cancelled` or `expired`, THE Payment_Link_Button SHALL remove the lock indicator and invoke `onLockChange(false)`
3. THE Lock indicator SHALL include a tooltip or descriptive text explaining that the invoice cannot be edited while a payment link is active

### Requirement 7: Document Status After Payment

**User Story:** As a user, I want the document status to permanently change to "paid" when payment is completed, so that I have a clear record and the document cannot be accidentally modified.

#### Acceptance Criteria

1. WHEN the Payment_Status changes to `paid` via webhook or status refresh, THE system SHALL update the Document_Session status to `paid`
2. WHILE the Document_Session status is `paid`, THE system SHALL prevent editing of the document content
3. WHILE the Document_Session status is `paid`, THE Payment_Link_Button SHALL NOT render the cancel (X) button
4. THE documents list page SHALL display a "Paid" badge next to documents with a `paid` status
5. WHEN a document has `paid` status, THE Editor_Panel SHALL display a read-only indicator and disable all input fields

### Requirement 8: Payment Method Dropdown Filtering

**User Story:** As a user, I want the payment method dropdown to only show gateways I have actually connected, so that I do not select a payment method that is not configured.

#### Acceptance Criteria

1. THE Editor_Panel SHALL display base payment methods (Bank Transfer, UPI, Cash, Check, Wire Transfer) for all users
2. THE Editor_Panel SHALL display gateway-specific methods (Razorpay, Stripe, Cashfree) only when the corresponding Payment_Gateway is connected in Settings → Payments
3. WHEN no Payment_Gateway is connected, THE Editor_Panel SHALL display a link to Settings → Payments prompting the user to connect a gateway
4. WHEN the user selects a gateway-specific payment method, THE Editor_Panel SHALL update the `paymentMethod` field in InvoiceData accordingly
