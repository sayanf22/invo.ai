# Tasks

## Task 1: Add `showPaymentLinkInPdf` field and fix editor toggle

- [x] 1.1 Add `showPaymentLinkInPdf?: boolean` to the `InvoiceData` interface in `lib/invoice-types.ts`
- [x] 1.2 Update the payment link toggle in `components/editor-panel.tsx` to read/write `showPaymentLinkInPdf` instead of clearing `paymentLink`
- [x] 1.3 Update toggle visual state to use `data.showPaymentLinkInPdf` for active/inactive styling
- [x] 1.4 Ensure the toggle is hidden or disabled when `document_sessions.status === "paid"`

## Task 2: Replace gateway links with platform links in Payment Link Button

- [x] 2.1 Update `handleCopy` in `components/payment-link-button.tsx` to copy `${window.location.origin}/pay/${sessionId}` instead of `paymentLink.shortUrl`
- [x] 2.2 Update `handleWhatsApp` to use the platform link in the composed message
- [x] 2.3 Update `onPaymentLinkChange` callback to pass the platform link instead of the gateway URL
- [x] 2.4 Update the link preview display in the editor panel to show the platform link

## Task 3: Update create-link API to return platform link

- [x] 3.1 Modify `POST /api/payments/create-link` in `app/api/payments/create-link/route.ts` to include `platformLink` in the response (derived from sessionId)
- [x] 3.2 Modify `GET /api/payments/create-link` to also return `platformLink` in the response
- [x] 3.3 Update `PaymentLinkButton` to store `shortUrl` (gateway) internally but use `platformLink` for all user-facing operations

## Task 4: Create public payment status API

- [x] 4.1 Create `app/api/payments/status/route.ts` with a GET endpoint that accepts `sessionId` query param
- [x] 4.2 Fetch payment status from `invoice_payments` using service role key (no auth required)
- [x] 4.3 Return only public-safe fields: `status`, `amount`, `currency`, `amountPaid`
- [x] 4.4 Return 404 for non-existent sessions, rate-limit the endpoint

## Task 5: Add `/pay/[sessionId]` to middleware public paths

- [x] 5.1 Add `"/pay"` to the `PUBLIC_PATHS` array in `middleware.ts` so `/pay/[sessionId]` routes bypass authentication

## Task 6: Create public document view page (`/pay/[sessionId]`)

- [x] 6.1 Create `app/pay/[sessionId]/page.tsx` as a server component that fetches `document_sessions.context` and `invoice_payments` data using service role key
- [x] 6.2 Create a client component `PayDocumentView` that renders: business name, document reference, total amount, currency, read-only PDF preview, and payment controls
- [x] 6.3 Implement "Pay Now" button that redirects to the gateway URL (`invoice_payments.short_url`)
- [x] 6.4 Implement QR code generation for the gateway URL (reuse existing `qrcode` library pattern from `/view`)
- [x] 6.5 Implement status-based rendering: "Paid" badge (hide Pay Now), "Pending" with QR, "Expired/Cancelled" message
- [x] 6.6 Implement "Document not found" fallback for invalid/non-existent session IDs
- [x] 6.7 Ensure responsive layout for mobile devices

## Task 7: Improve cancel button behavior

- [x] 7.1 Hide the cancel (X) button when `paymentLink.status === "paid"` (already done, verify)
- [x] 7.2 Add error toast on cancel API failure (currently only shows generic toast)
- [x] 7.3 Add tooltip to lock indicator explaining "Invoice is locked while a payment link is active"

## Task 8: Improve refresh button behavior

- [x] 8.1 Add error toast on refresh API failure in `PaymentLinkButton` (currently silent on error)
- [x] 8.2 When refreshed status is `paid`, invoke `onPaymentLinkChange` with updated status

## Task 9: Update webhooks to set document session status to "paid"

- [x] 9.1 In `app/api/razorpay/webhook/[userId]/route.ts`, after updating `invoice_payments.status` to `paid`, also update `document_sessions.status` to `paid` for the linked session
- [x] 9.2 In `app/api/stripe/webhook/[userId]/route.ts`, add the same `document_sessions.status` update
- [x] 9.3 In `app/api/cashfree/webhook/[userId]/route.ts`, add the same `document_sessions.status` update

## Task 10: Lock editor when document status is "paid"

- [x] 10.1 Pass document session status to `EditorPanel` component and disable all input fields when status is `"paid"`
- [x] 10.2 Display a read-only banner at the top of the editor panel when document is paid
- [x] 10.3 Add "Paid" badge to the documents list page for documents with `paid` status

## Task 11: Write property-based tests

- [x] 11.1 Install `fast-check` as a dev dependency if not already present
- [x] 11.2 Write property test for Property 1: platform link derivation from sessionId
- [x] 11.3 Write property test for Property 2: Pay Now href matches gateway URL
- [x] 11.4 Write property test for Property 3: public page renders required document fields
- [x] 11.5 Write property test for Property 4: paid document inputs are all disabled
- [x] 11.6 Write property test for Property 5: payment method dropdown filtering by connected gateways
