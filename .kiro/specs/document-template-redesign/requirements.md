# Requirements Document

## Introduction

The PDF export system in Clorefy currently renders all four document types (Invoice, Contract, Quotation, Proposal) with nearly identical visual layouts — same table structure, same party info blocks, same header patterns, and same footer. Each document type should have a distinct, modern, and professional visual identity that reflects what that document type represents in real-world business usage. This redesign will give each document type its own layout, section structure, and visual style while preserving full backward compatibility with the existing 9-theme system, shared utilities, and the InvoiceData interface. Receipt and PaymentReceipt templates are excluded from this redesign.

## Glossary

- **Template_Renderer**: The set of exported React components (`InvoicePDF`, `ContractPDF`, `QuotationPDF`, `ProposalPDF`) in `lib/pdf-templates.tsx` that produce PDF documents via `@react-pdf/renderer`
- **Theme_System**: The `getTheme()` function and its 10 color palettes (modern, classic, bold, minimal, elegant, corporate, creative, warm, geometric, receipt) that supply colors and font families to each template
- **InvoiceData**: The shared TypeScript interface in `lib/invoice-types.ts` that carries all document field values to the Template_Renderer
- **Shared_Utilities**: The common helper functions (`fmt`, `fmtDate`, `calc`, `ItemRow`, `PdfLogo`, `PaymentSection`, `getItemDiscountTotal`, border helpers) used across all templates
- **Document_Type**: One of the four primary document categories: Invoice, Contract, Quotation, or Proposal
- **Layout_Identity**: The combination of header design, section ordering, decorative elements, table column structure, and footer style that makes a Document_Type visually distinct
- **Consumer_Component**: Any React component that imports and renders a Template_Renderer component (e.g., `document-preview.tsx`, `pdf-download-button.tsx`, `share-button.tsx`)

## Requirements

### Requirement 1: Distinct Invoice Layout

**User Story:** As a business owner, I want my invoices to have a professional, payment-focused layout with clear financial details, so that clients can quickly identify the amount owed and payment instructions.

#### Acceptance Criteria

1. THE Template_Renderer SHALL render InvoicePDF with a header section containing the document title "INVOICE", invoice number, and a status badge (PAID/DRAFT/SENT/OVERDUE)
2. THE Template_Renderer SHALL render InvoicePDF with a date strip containing Issue Date, Due Date, and Payment Terms as three distinct fields
3. THE Template_Renderer SHALL render InvoicePDF with party blocks labeled "From" and "Bill To"
4. THE Template_Renderer SHALL render InvoicePDF with an item table using columns: Description, Qty, Rate, and Amount
5. THE Template_Renderer SHALL render InvoicePDF with a totals box showing Subtotal, Discounts, Tax, Shipping, and Total Due
6. THE Template_Renderer SHALL render InvoicePDF with a Payment Information section when payment method or instructions are provided
7. THE Template_Renderer SHALL render InvoicePDF with the PaymentSection component when an active payment link exists
8. WHEN the Invoice layout is compared to the Contract, Quotation, or Proposal layouts, THE Template_Renderer SHALL produce a visually distinct header shape, decorative accent placement, and section ordering for InvoicePDF

### Requirement 2: Distinct Contract Layout

**User Story:** As a business owner, I want my contracts to have a formal, legal-document layout with clear party identification and signature areas, so that both parties can easily review terms and sign.

#### Acceptance Criteria

1. THE Template_Renderer SHALL render ContractPDF with a header section containing the document title "CONTRACT" and a reference number
2. THE Template_Renderer SHALL render ContractPDF with date fields labeled "Effective Date" and "End Date"
3. THE Template_Renderer SHALL render ContractPDF with party blocks labeled "Party A — Provider" and "Party B — Client"
4. THE Template_Renderer SHALL render ContractPDF with a "Scope & Terms" section when a description is provided
5. THE Template_Renderer SHALL render ContractPDF with a "Deliverables & Pricing" table using columns: Deliverable, Qty, Rate, and Amount
6. THE Template_Renderer SHALL render ContractPDF with dual signature blocks for Party A and Party B, each containing a signature line or image, name, and title
7. THE Template_Renderer SHALL render ContractPDF with a sidebar accent element in the modern theme variant that is not present in InvoicePDF
8. WHEN the Contract layout is compared to the Invoice, Quotation, or Proposal layouts, THE Template_Renderer SHALL produce a visually distinct header shape, decorative accent placement, and section ordering for ContractPDF

### Requirement 3: Distinct Quotation Layout

**User Story:** As a business owner, I want my quotations to have a clean, estimate-focused layout with clear pricing and validity dates, so that prospective clients can quickly evaluate the offer.

#### Acceptance Criteria

1. THE Template_Renderer SHALL render QuotationPDF with a header section containing the document title "QUOTATION" and a reference number
2. THE Template_Renderer SHALL render QuotationPDF with date fields labeled "Quote Date", "Valid Until", and "Payment Terms"
3. THE Template_Renderer SHALL render QuotationPDF with party blocks labeled "From" and "Quote For"
4. THE Template_Renderer SHALL render QuotationPDF with a description box when a description is provided
5. THE Template_Renderer SHALL render QuotationPDF with an item table using columns: Item / Service, Qty, Unit Price, and Amount
6. THE Template_Renderer SHALL render QuotationPDF with dual signature blocks for Party A and Party B
7. THE Template_Renderer SHALL render QuotationPDF with a corner accent element in the modern theme variant that is not present in InvoicePDF or ContractPDF
8. WHEN the Quotation layout is compared to the Invoice, Contract, or Proposal layouts, THE Template_Renderer SHALL produce a visually distinct header shape, decorative accent placement, and section ordering for QuotationPDF

### Requirement 4: Distinct Proposal Layout

**User Story:** As a business owner, I want my proposals to have a persuasive, presentation-style layout with an executive summary and clear next steps, so that prospective clients are compelled to accept.

#### Acceptance Criteria

1. THE Template_Renderer SHALL render ProposalPDF with a header section containing the document title "PROPOSAL" and a reference number
2. THE Template_Renderer SHALL render ProposalPDF with date fields labeled "Date" and "Valid Until"
3. THE Template_Renderer SHALL render ProposalPDF with party blocks labeled "Prepared By" and "Prepared For"
4. THE Template_Renderer SHALL render ProposalPDF with an "Executive Summary" section when a description is provided
5. THE Template_Renderer SHALL render ProposalPDF with a "Budget Breakdown" table using columns: Deliverable / Phase, Qty, Rate, and Amount
6. THE Template_Renderer SHALL render ProposalPDF with a "Next Steps" call-to-action box with a left accent border
7. THE Template_Renderer SHALL render ProposalPDF with dual signature blocks for Party A and Party B
8. THE Template_Renderer SHALL render ProposalPDF with a table header that uses the accent background color instead of the primary color, distinguishing it from Invoice and Contract table headers
9. WHEN the Proposal layout is compared to the Invoice, Contract, or Quotation layouts, THE Template_Renderer SHALL produce a visually distinct header shape, decorative accent placement, and section ordering for ProposalPDF

### Requirement 5: Theme Compatibility Across All Document Types

**User Story:** As a user, I want all 9 existing template themes to work with every document type while preserving each document type's distinct identity, so that I can customize the color scheme without losing the document-specific layout.

#### Acceptance Criteria

1. THE Template_Renderer SHALL apply each of the 9 themes (modern, classic, bold, minimal, elegant, corporate, creative, warm, geometric) to InvoicePDF, ContractPDF, QuotationPDF, and ProposalPDF
2. WHEN a theme is applied, THE Template_Renderer SHALL preserve the Document_Type-specific Layout_Identity (header shape, section labels, table columns, decorative accents) while changing only colors and font families
3. THE Theme_System SHALL continue to accept custom header colors via the `design.headerColor` field in InvoiceData
4. THE Theme_System SHALL continue to support the three font families (Inter, Lora, Roboto Mono) via the `design.font` field in InvoiceData

### Requirement 6: Backward Compatibility

**User Story:** As a developer, I want the redesigned templates to maintain the same exported function signatures and InvoiceData interface, so that no Consumer_Component requires changes.

#### Acceptance Criteria

1. THE Template_Renderer SHALL export `InvoicePDF`, `ContractPDF`, `QuotationPDF`, and `ProposalPDF` with the same Props interface: `{ data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }`
2. THE Template_Renderer SHALL continue to use the existing InvoiceData interface without adding required fields
3. WHEN a Consumer_Component renders a Template_Renderer component, THE Template_Renderer SHALL produce a valid PDF document without requiring changes to the Consumer_Component
4. THE Template_Renderer SHALL preserve the existing `ReceiptPDF` and `PaymentReceiptPDF` components without modification
5. THE Template_Renderer SHALL preserve all Shared_Utilities (`fmt`, `fmtDate`, `calc`, `ItemRow`, `PdfLogo`, `PaymentSection`, `getItemDiscountTotal`, border helpers) as shared code

### Requirement 7: Code Deduplication

**User Story:** As a developer, I want duplicate layout code across the four document templates to be extracted into shared components or style factories, so that the codebase is easier to maintain.

#### Acceptance Criteria

1. THE Template_Renderer SHALL use the shared `ItemRow` component for rendering line items across all four Document_Types
2. THE Template_Renderer SHALL use the shared `PdfLogo` component for rendering logos across all four Document_Types
3. THE Template_Renderer SHALL use the shared `PaymentSection` component exclusively in InvoicePDF
4. WHEN a totals box is rendered, THE Template_Renderer SHALL use a shared totals rendering pattern across all Document_Types that display financial totals
5. WHEN a signature block is rendered, THE Template_Renderer SHALL use a shared signature rendering pattern across ContractPDF, QuotationPDF, and ProposalPDF

### Requirement 8: Professional Document Elements

**User Story:** As a business owner, I want each document type to include the standard professional elements expected for that document category, so that my documents meet industry expectations.

#### Acceptance Criteria

1. THE Template_Renderer SHALL render InvoicePDF with a status badge indicating the payment status (PAID, DRAFT, SENT, or OVERDUE)
2. THE Template_Renderer SHALL render ContractPDF with dual signature blocks that support both drawn signature images and electronic signature indicators
3. THE Template_Renderer SHALL render QuotationPDF with a "Valid Until" date field to communicate the quote expiration
4. THE Template_Renderer SHALL render ProposalPDF with an "Executive Summary" section and a "Next Steps" call-to-action section
5. WHEN sender signature data is available and `showSenderSignature` is true, THE Template_Renderer SHALL display the drawn signature image in the Party A signature block for ContractPDF, QuotationPDF, and ProposalPDF
6. WHEN a client signature image is available in `signatureImages`, THE Template_Renderer SHALL display the drawn signature image in the Party B signature block for ContractPDF, QuotationPDF, and ProposalPDF
7. IF a document has been signed but the signature image is unavailable, THEN THE Template_Renderer SHALL display an "Electronically Signed" indicator in the Party B signature block
