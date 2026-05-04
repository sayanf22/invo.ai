# Implementation Plan: Document Template Redesign

## Overview

Refactor `lib/pdf-templates.tsx` to give each document type (Invoice, Contract, Quotation, Proposal) a distinct visual identity through a configuration-driven architecture with shared section components. All changes stay within the single file. ReceiptPDF and PaymentReceiptPDF are untouched. The implementation is ordered so that nothing breaks at any step — existing templates continue to work throughout.

## Tasks

- [x] 1. Add the DocumentConfig interface and getDocumentConfig factory function
  - Define the `DocumentConfig` interface with all fields specified in the design (title, refPrefix, showStatusBadge, dateFields, fromLabel, toLabel, tableSectionTitle, tableColumns, tableHeaderUsesAccent, grandTotalLabel, section flags)
  - Implement `getDocumentConfig(documentType: string): DocumentConfig` returning the correct config for "invoice", "contract", "quotation", "proposal", defaulting to invoice config for unknown types
  - Place these directly above the existing template components in `lib/pdf-templates.tsx`, below the existing utilities and helpers
  - Do NOT modify any existing code in this step — only add new code
  - _Requirements: 1.1–1.8, 2.1–2.8, 3.1–3.8, 4.1–4.9, 6.2_

- [x] 1.1 Write property tests for DocumentConfig (Properties 1, 2, 3)
  - Create `__tests__/pdf-templates-config.test.ts`
  - **Property 1: Document type configs are mutually distinct** — For all pairs of document types from {"invoice", "contract", "quotation", "proposal"}, verify getDocumentConfig returns configs differing in title, fromLabel, toLabel, and grandTotalLabel
  - **Validates: Requirements 1.8, 2.8, 3.8, 4.9**
  - **Property 2: Theme completeness across all palettes** — For all 9 themes and sample InvoiceData, verify getTheme returns an object with all required color fields (pri, priDk, acc, accDk, bg, txt, mut, bdr) and font fields (font, fontB), each non-empty string
  - **Validates: Requirements 5.1, 5.4**
  - **Property 3: Custom header color override** — For any valid hex color string differing from the theme default, verify getTheme returns that color as the pri field
  - **Validates: Requirements 5.3**

- [x] 2. Build shared section components (no wiring yet)
  - [x] 2.1 Implement HeaderSection component
    - Create the `HeaderSection` internal component that renders document title, reference number, logo, and optional status badge
    - Accept `HeaderSectionProps` (data, logoUrl, tpl, c, config)
    - Implement the distinct decorative accents per document type × theme variant (modern/classic/bold) as specified in the design table
    - Invoice: top bar + corner shape; Contract: left sidebar; Quotation: corner accent top-left; Proposal: top bar + right shape
    - _Requirements: 1.1, 1.8, 2.1, 2.7, 2.8, 3.1, 3.7, 3.8, 4.1, 4.9_

  - [x] 2.2 Implement DateStrip component
    - Create the `DateStrip` internal component that renders date fields from `config.dateFields` in a horizontal row
    - Use the config's dateFields array to dynamically render the correct labels and values per document type
    - _Requirements: 1.2, 2.2, 3.2, 4.2_

  - [x] 2.3 Implement PartyBlocks component
    - Create the `PartyBlocks` internal component that renders two-column party info using `config.fromLabel` and `config.toLabel`
    - _Requirements: 1.3, 2.3, 3.3, 4.3_

  - [x] 2.4 Implement ItemTable component
    - Create the `ItemTable` internal component that renders the line-item table using `config.tableColumns` for column headers and `config.tableSectionTitle` for the optional section title
    - Use `config.tableHeaderUsesAccent` to switch between `c.pri` and `c.acc` background for the table header (Proposal uses accent)
    - Use `config.skipEmptyItems` to filter out empty items for Contract and Proposal
    - Reuse the existing `ItemRow` component for individual rows
    - _Requirements: 1.4, 2.5, 3.5, 4.5, 4.8, 7.1_

  - [x] 2.5 Implement TotalsBox component
    - Create the `TotalsBox` internal component that renders the financial summary using `config.grandTotalLabel` for the grand total line
    - Reuse existing `calc()`, `fmt()`, `getItemDiscountTotal()` utilities
    - _Requirements: 1.5, 7.4_

  - [x] 2.6 Implement SignatureRow component
    - Create the `SignatureRow` internal component for dual signature blocks (Party A / Party B)
    - Handle sender drawn signature image when `showSenderSignature !== false` AND `senderSignatureDataUrl` is truthy
    - Handle client signature image from `signatureImages[0].imageDataUrl`
    - Handle "Electronically Signed" fallback when `signedAt` is truthy or `signatureImages` has entries but no `imageDataUrl`
    - Fall back to signature line placeholder otherwise
    - _Requirements: 2.6, 3.6, 4.7, 7.5, 8.2, 8.5, 8.6, 8.7_

  - [x] 2.7 Implement NotesSection and FooterBar components
    - Create `NotesSection` for rendering Notes and Terms & Conditions blocks
    - Create `FooterBar` for rendering the page footer with "Generated by Clorefy" and page numbers
    - _Requirements: 6.5_

- [x] 2.8 Write property test for signature display mode selection (Property 4)
  - Add to `__tests__/pdf-templates-config.test.ts`
  - **Property 4: Signature display mode selection** — For any InvoiceData with varying combinations of showSenderSignature, senderSignatureDataUrl, signatureImages, and signedAt, verify exactly one display mode is selected per signature block
  - Extract the signature logic into a testable pure function (e.g., `getSignatureDisplayMode`) that returns the mode string
  - **Validates: Requirements 8.2, 8.5, 8.6, 8.7**

- [x] 3. Checkpoint — Verify shared components compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire shared components into InvoicePDF
  - [x] 4.1 Refactor InvoicePDF to use shared components
    - Replace the inline header JSX with `HeaderSection` using the invoice config
    - Replace the inline date strip with `DateStrip`
    - Replace the inline party blocks with `PartyBlocks`
    - Replace the inline item table with `ItemTable`
    - Replace the inline totals box with `TotalsBox`
    - Replace the inline notes/terms with `NotesSection`
    - Replace the inline footer with `FooterBar`
    - Keep `PaymentSection` and Payment Information section inline (invoice-only)
    - Keep the status badge rendering (invoice-only via `config.showStatusBadge`)
    - Verify InvoicePDF still renders correctly by running `pnpm build`
    - _Requirements: 1.1–1.8, 6.1, 6.3, 6.5, 7.1, 7.2, 7.3_

  - [x] 4.2 Write unit tests for InvoicePDF config
    - Verify `getDocumentConfig("invoice")` returns correct title "INVOICE", fromLabel "From", toLabel "Bill To", grandTotalLabel "Total Due"
    - Verify `hasPaymentSection` is true, `hasSignatureRow` is false
    - _Requirements: 1.1–1.7_

- [x] 5. Wire shared components into ContractPDF
  - [x] 5.1 Refactor ContractPDF to use shared components
    - Replace inline header, date strip, party blocks, item table, totals box, signature row, notes, and footer with shared components
    - Keep the "Scope & Terms" section rendering inline (contract-only via `config.hasScopeSection`)
    - Verify ContractPDF still renders correctly by running `pnpm build`
    - _Requirements: 2.1–2.8, 6.1, 6.4, 6.5, 7.1, 7.2, 7.4, 7.5_

  - [x] 5.2 Write unit tests for ContractPDF config
    - Verify `getDocumentConfig("contract")` returns correct title "CONTRACT", fromLabel "Party A — Provider", toLabel "Party B — Client", grandTotalLabel "Total Value"
    - Verify `hasSignatureRow` is true, `hasScopeSection` is true, `hasPaymentSection` is false
    - _Requirements: 2.1–2.7_

- [x] 6. Wire shared components into QuotationPDF
  - [x] 6.1 Refactor QuotationPDF to use shared components
    - Replace inline header, date strip, party blocks, item table, totals box, signature row, notes, and footer with shared components
    - Keep the description box rendering inline (quotation-only via `config.hasDescriptionBox`)
    - Verify QuotationPDF still renders correctly by running `pnpm build`
    - _Requirements: 3.1–3.8, 6.1, 6.4, 6.5, 7.1, 7.2, 7.4, 7.5_

  - [x] 6.2 Write unit tests for QuotationPDF config
    - Verify `getDocumentConfig("quotation")` returns correct title "QUOTATION", fromLabel "From", toLabel "Quote For", grandTotalLabel "Total"
    - Verify `hasSignatureRow` is true, `hasDescriptionBox` is true
    - _Requirements: 3.1–3.6_

- [x] 7. Checkpoint — Verify three templates refactored
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Wire shared components into ProposalPDF
  - [x] 8.1 Refactor ProposalPDF to use shared components
    - Replace inline header, date strip, party blocks, item table, totals box, signature row, notes, and footer with shared components
    - Keep the "Executive Summary" section rendering inline (proposal-only via `config.hasExecutiveSummary`)
    - Keep the "Next Steps" CTA box rendering inline (proposal-only via `config.hasNextStepsCTA`)
    - Verify ProposalPDF still renders correctly by running `pnpm build`
    - _Requirements: 4.1–4.9, 6.1, 6.4, 6.5, 7.1, 7.2, 7.4, 7.5_

  - [x] 8.2 Write unit tests for ProposalPDF config
    - Verify `getDocumentConfig("proposal")` returns correct title "PROPOSAL", fromLabel "Prepared By", toLabel "Prepared For", grandTotalLabel "Total Investment"
    - Verify `hasSignatureRow` is true, `hasExecutiveSummary` is true, `hasNextStepsCTA` is true, `tableHeaderUsesAccent` is true
    - _Requirements: 4.1–4.8_

- [x] 9. Clean up duplicate code and verify ReceiptPDF/PaymentReceiptPDF untouched
  - Remove any remaining inline code from the four templates that is now handled by shared components
  - Verify `ReceiptPDF` and `PaymentReceiptPDF` are completely unchanged (no modifications)
  - Verify all existing shared utilities (`fmt`, `fmtDate`, `calc`, `ItemRow`, `PdfLogo`, `PaymentSection`, `getItemDiscountTotal`, border helpers, `getTheme`, `bold`, `getFontFamily`) remain intact
  - Verify the exported function signatures for all six components match the original Props interface
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

- [x] 10. Final checkpoint — Full build and test verification
  - Run `pnpm build` to verify no TypeScript compilation errors
  - Run `pnpm test` to verify all property-based tests and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific config values and edge cases
- ReceiptPDF and PaymentReceiptPDF are explicitly excluded from all changes
- All code stays in `lib/pdf-templates.tsx` — no file splitting
