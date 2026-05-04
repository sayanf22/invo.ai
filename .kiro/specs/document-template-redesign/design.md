# Design Document: Document Template Redesign

## Overview

This design transforms the four primary PDF templates (Invoice, Contract, Quotation, Proposal) in `lib/pdf-templates.tsx` from near-identical layouts into visually distinct, professionally styled documents — each reflecting real-world conventions for its document category. The redesign preserves full backward compatibility with the existing 9-theme system, shared utilities, `InvoiceData` interface, and all consumer components.

### Research Summary

Professional document design conventions informed the layout decisions:

- **Invoices** prioritize payment clarity: total due and due date should be the most prominent elements, followed by payment instructions and a line-item table. Status badges (PAID/DRAFT) and payment links are standard in modern invoicing tools like Stripe, FreshBooks, and Zoho. ([invoicequickly.com](https://invoicequickly.com/guides/invoice-design-guide), [invoicemaster.org](https://invoicemaster.org/blog/post/invoice-templates-streamline-invoicing))
- **Contracts** follow legal document conventions: formal tone, clear party identification (Party A / Party B), scope of work sections, and dual signature blocks. Readability and structure matter more than visual flair. ([adobe.com](https://www.adobe.com/sign/hub/document-types/formatting-legal-documents), [juro.com](https://juro.com/learn/contract-design))
- **Quotations** emphasize pricing transparency and validity: prominent "Valid Until" dates, clean item tables with unit pricing, and a professional but approachable tone.
- **Proposals** are persuasive documents: executive summary up front, budget breakdown, and a clear call-to-action ("Next Steps"). Research shows 3-5 page proposals with ~6 sections perform best. ([betterproposals.io](https://betterproposals.io/blog/ideal-proposal-layout/), [pandadoc.com](https://www.pandadoc.com/blog/how-to-write-a-proposal/))

### Design Goals

1. Give each document type a distinct visual identity through unique header shapes, decorative accents, section labels, table column names, and section ordering
2. Extract duplicated code into shared sub-components and style factory functions
3. Maintain identical exported function signatures and Props interface
4. Ensure all 9 themes work with all 4 document types
5. Leave ReceiptPDF and PaymentReceiptPDF untouched

## Architecture

### High-Level Structure

The redesigned `lib/pdf-templates.tsx` file follows a layered architecture:

```
┌─────────────────────────────────────────────────────┐
│  Exported Template Components (public API)          │
│  InvoicePDF, ContractPDF, QuotationPDF, ProposalPDF │
│  ReceiptPDF, PaymentReceiptPDF (unchanged)          │
├─────────────────────────────────────────────────────┤
│  Document-Type Layout Configs                       │
│  getDocumentConfig(type) → labels, sections, order  │
├─────────────────────────────────────────────────────┤
│  Shared Section Components                          │
│  HeaderSection, DateStrip, PartyBlocks,             │
│  ItemTable, TotalsBox, SignatureRow, NotesSection,   │
│  FooterBar                                          │
├─────────────────────────────────────────────────────┤
│  Existing Shared Utilities (unchanged)              │
│  fmt, fmtDate, calc, ItemRow, PdfLogo,              │
│  PaymentSection, getItemDiscountTotal,              │
│  border helpers, getTheme, bold, getFontFamily      │
└─────────────────────────────────────────────────────┘
```

### Architectural Decisions

**Decision 1: Internal shared components, not a separate file.**
All shared section components remain inside `lib/pdf-templates.tsx`. This avoids changing import paths in consumer components and keeps the PDF rendering self-contained. The file is large (~1500 lines) but splitting it would require updating imports in `document-preview.tsx`, `pdf-download-button.tsx`, and `share-button.tsx`.

**Decision 2: Configuration-driven layout differentiation.**
Each document type defines a `DocumentConfig` object that specifies its unique labels, section ordering, decorative accent type, and table column headers. The shared section components read from this config, so visual identity is driven by data rather than duplicated JSX.

**Decision 3: Theme system unchanged.**
The existing `getTheme()` function and its 10 palettes remain as-is. Document-type differentiation comes from layout structure and decorative elements, not from color changes. Themes continue to control colors and fonts only.

### Section Ordering by Document Type

```
Invoice:    Header → DateStrip → PartyBlocks → ItemTable → TotalsBox → PaymentInfo → PaymentSection → Notes → Footer
Contract:   Header → DateStrip → PartyBlocks → ScopeTerms → ItemTable → TotalsBox → SignatureRow → Notes → Footer
Quotation:  Header → DateStrip → PartyBlocks → DescriptionBox → ItemTable → TotalsBox → SignatureRow → Notes → Footer
Proposal:   Header → DateStrip → PartyBlocks → ExecutiveSummary → ItemTable → TotalsBox → NextStepsCTA → SignatureRow → Notes → Footer
```

## Components and Interfaces

### Shared Section Components (internal, not exported)

These components encapsulate the repeated layout patterns currently duplicated across all four templates.

#### 1. `HeaderSection`

Renders the document title, reference number, logo, and optional status badge. Each document type has a unique decorative accent:

| Document Type | Modern Accent | Bold Accent | Classic Accent |
|---|---|---|---|
| Invoice | Top bar + corner shape (top-right) | Full-width colored header with angled shape | Double line |
| Contract | Left sidebar (6px vertical bar) | Full-width header with circle overlay | Double line (thick + thin) |
| Quotation | Corner accent (top-left square) | Full-width header with curved shape | Border frame |
| Proposal | Top bar + right shape (curved bottom-left) | Full-width header with shape + circle | Single line |

```typescript
interface HeaderSectionProps {
  data: InvoiceData
  logoUrl?: string | null
  tpl: Tpl
  c: ReturnType<typeof getTheme>
  config: DocumentConfig
}
```

#### 2. `DateStrip`

Renders date fields in a horizontal row. Labels vary by document type:

| Document Type | Field 1 | Field 2 | Field 3 |
|---|---|---|---|
| Invoice | Issue Date | Due Date | Payment Terms |
| Contract | Effective Date | End Date | — |
| Quotation | Quote Date | Valid Until | Payment Terms |
| Proposal | Date | Valid Until | Payment (optional) |

```typescript
interface DateStripProps {
  data: InvoiceData
  tpl: Tpl
  c: ReturnType<typeof getTheme>
  config: DocumentConfig
}
```

#### 3. `PartyBlocks`

Renders the two-column "From" / "To" party information. Labels vary:

| Document Type | Left Label | Right Label |
|---|---|---|
| Invoice | From | Bill To |
| Contract | Party A — Provider | Party B — Client |
| Quotation | From | Quote For |
| Proposal | Prepared By | Prepared For |

```typescript
interface PartyBlocksProps {
  data: InvoiceData
  tpl: Tpl
  c: ReturnType<typeof getTheme>
  config: DocumentConfig
}
```

#### 4. `ItemTable`

Renders the line-item table with document-specific column headers and optional section title:

| Document Type | Section Title | Col 1 | Col 2 | Col 3 | Col 4 |
|---|---|---|---|---|---|
| Invoice | *(none)* | Description | Qty | Rate | Amount |
| Contract | Deliverables & Pricing | Deliverable | Qty | Rate | Amount |
| Quotation | *(none)* | Item / Service | Qty | Unit Price | Amount |
| Proposal | Budget Breakdown | Deliverable / Phase | Qty | Rate | Amount |

The Proposal table header uses `c.acc` (accent) background instead of `c.pri` (primary), distinguishing it from Invoice and Contract.

```typescript
interface ItemTableProps {
  data: InvoiceData
  tpl: Tpl
  c: ReturnType<typeof getTheme>
  config: DocumentConfig
  styles: { tHead: any; tRow: any; tRowAlt: any; cD: any; cQ: any; cR: any; cA: any }
}
```

#### 5. `TotalsBox`

Renders the financial summary (Subtotal, Discounts, Tax, Shipping, Total). The grand total label varies:

| Document Type | Grand Total Label |
|---|---|
| Invoice | Total Due |
| Contract | Total Value |
| Quotation | Total |
| Proposal | Total Investment |

```typescript
interface TotalsBoxProps {
  data: InvoiceData
  c: ReturnType<typeof getTheme>
  config: DocumentConfig
  styles: { totBox: any; totRow: any; gRow: any }
}
```

#### 6. `SignatureRow`

Renders dual signature blocks for Contract, Quotation, and Proposal. Handles:
- Sender drawn signature image (Party A) when `showSenderSignature` is true
- Client signature image (Party B) from `signatureImages` array
- "Electronically Signed" fallback when `signedAt` is set but no image

```typescript
interface SignatureRowProps {
  data: InvoiceData
  c: ReturnType<typeof getTheme>
  styles: { sigRow: any; sigBlk: any; sigLine: any }
}
```

#### 7. `NotesSection`

Renders Notes and Terms & Conditions blocks. Shared across all document types.

#### 8. `FooterBar`

Renders the page footer with "Generated by Clorefy" and page numbers.

### DocumentConfig Interface

```typescript
interface DocumentConfig {
  // Header
  title: string                    // "INVOICE", "CONTRACT", "QUOTATION", "PROPOSAL"
  refPrefix: string                // "INV", "CTR", "QUO", "PROP"
  showStatusBadge: boolean         // true only for Invoice

  // Date fields
  dateFields: Array<{
    label: string                  // "Issue Date", "Effective Date", etc.
    getValue: (data: InvoiceData) => string
    required: boolean
  }>

  // Party labels
  fromLabel: string                // "From", "Party A — Provider", "Prepared By"
  toLabel: string                  // "Bill To", "Party B — Client", "Quote For", "Prepared For"

  // Table
  tableSectionTitle?: string       // "Deliverables & Pricing", "Budget Breakdown", or undefined
  tableColumns: { desc: string; qty: string; rate: string; amount: string }
  tableHeaderUsesAccent: boolean   // true for Proposal, false for others

  // Totals
  grandTotalLabel: string          // "Total Due", "Total Value", "Total", "Total Investment"

  // Sections
  hasPaymentInfo: boolean          // true only for Invoice
  hasPaymentSection: boolean       // true only for Invoice
  hasSignatureRow: boolean         // true for Contract, Quotation, Proposal
  hasScopeSection: boolean         // true for Contract (uses description field)
  hasDescriptionBox: boolean       // true for Quotation (uses description field)
  hasExecutiveSummary: boolean     // true for Proposal (uses description field)
  hasNextStepsCTA: boolean         // true only for Proposal
  skipEmptyItems: boolean          // true for Contract and Proposal (skip items with no description and rate=0)
}
```

### Factory Function

```typescript
function getDocumentConfig(documentType: string): DocumentConfig
```

Returns the appropriate config for each document type. Defaults to Invoice config for unknown types.

## Data Models

### No Schema Changes

The `InvoiceData` interface remains unchanged. All four document types continue to use the same interface. The redesign reinterprets existing fields differently per document type:

| InvoiceData Field | Invoice | Contract | Quotation | Proposal |
|---|---|---|---|---|
| `invoiceDate` | Issue Date | Effective Date | Quote Date | Date |
| `dueDate` | Due Date | End Date | Valid Until | Valid Until |
| `description` | *(unused)* | Scope & Terms | Description box | Executive Summary |
| `paymentInstructions` | Payment info | *(unused)* | *(unused)* | Next Steps text |
| `paymentTerms` | Payment Terms | *(unused)* | Payment Terms | Payment (optional) |
| `status` | Status badge | *(unused)* | *(unused)* | *(unused)* |

### Theme System (unchanged)

```typescript
type Tpl = "modern" | "classic" | "bold" | "minimal" | "elegant" | "corporate" | "creative" | "warm" | "geometric" | "receipt"
```

The `getTheme()` function continues to return the same color/font object. No changes needed.

### Props Interface (unchanged)

```typescript
interface Props {
  data: InvoiceData
  logoUrl?: string | null
  paymentQrCode?: string | null
}
```

All four exported components maintain this exact signature.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document type configs are mutually distinct

*For any* two distinct document type strings from {"invoice", "contract", "quotation", "proposal"}, calling `getDocumentConfig` on each should return configs that differ in at least `title`, `fromLabel`, `toLabel`, and `grandTotalLabel`.

**Validates: Requirements 1.8, 2.8, 3.8, 4.9**

### Property 2: Theme completeness across all palettes

*For any* valid theme name from the 9 supported themes (modern, classic, bold, minimal, elegant, corporate, creative, warm, geometric) and *for any* valid InvoiceData, `getTheme(theme, data)` should return an object containing all required color fields (`pri`, `priDk`, `acc`, `accDk`, `bg`, `txt`, `mut`, `bdr`) and font fields (`font`, `fontB`), each being a non-empty string.

**Validates: Requirements 5.1, 5.4**

### Property 3: Custom header color override

*For any* valid hex color string provided as `data.design.headerColor` that differs from the theme's default primary color, `getTheme(theme, data)` should return that custom color as the `pri` field.

**Validates: Requirements 5.3**

### Property 4: Signature display mode selection

*For any* InvoiceData with varying combinations of `showSenderSignature`, `senderSignatureDataUrl`, `signatureImages`, and `signedAt`, the signature rendering logic should select exactly one display mode per signature block:
- Party A: show drawn image when `showSenderSignature !== false` AND `senderSignatureDataUrl` is truthy; otherwise show signature line
- Party B: show drawn image when `signatureImages[0].imageDataUrl` is truthy; show "Electronically Signed" when `signedAt` is truthy OR `signatureImages` has entries but no `imageDataUrl`; otherwise show signature line

**Validates: Requirements 8.2, 8.5, 8.6, 8.7**

## Error Handling

### Graceful Degradation

The templates already handle missing/empty data gracefully. The redesign preserves this behavior:

| Scenario | Behavior |
|---|---|
| Missing `invoiceDate` or `dueDate` | `fmtDate()` returns "—" |
| Empty `description` | Scope/Summary/Description sections are not rendered |
| No line items with content | Contract and Proposal skip the table entirely (`skipEmptyItems: true`) |
| Missing `fromName` / `toName` | Falls back to "Your Business" / "[Client Name]" |
| Missing `logoUrl` or `showLogo: false` | `PdfLogo` returns null |
| Missing `paymentLink` or paid/expired status | `PaymentSection` returns null |
| Missing `signatureImages` | Shows signature line placeholder |
| `showSignatureFields: false` | Entire signature row is hidden |
| Unknown document type | `getDocumentConfig` defaults to Invoice config |
| Unknown theme | `getTpl` defaults to "modern" |

### No New Error States

The redesign introduces no new error conditions. All new code paths (config lookup, shared components) use the same defensive patterns as the existing code: conditional rendering with `&&` and `?:` operators, fallback values for missing strings.

## Testing Strategy

### Unit Tests (Example-Based)

Unit tests verify specific config values and rendering behavior for each document type:

1. **Config correctness per document type** — Verify `getDocumentConfig("invoice")` returns the exact expected labels, flags, and column headers. Repeat for contract, quotation, proposal. (~4 tests)
2. **Default config for unknown type** — Verify `getDocumentConfig("unknown")` returns Invoice config
3. **Date field mapping** — Verify each config's `dateFields` array has the correct labels and value extractors
4. **Section flag exclusivity** — Verify `hasPaymentSection` is true only for invoice, `hasSignatureRow` is true only for contract/quotation/proposal, `hasNextStepsCTA` is true only for proposal
5. **Table header accent** — Verify `tableHeaderUsesAccent` is true only for proposal
6. **Font family mapping** — Verify `getFontFamily` maps Playfair→Lora, Courier→Roboto Mono, Inter→Inter, etc.

### Property-Based Tests

Property-based tests use `fast-check` to verify universal properties across generated inputs. Each test runs a minimum of 100 iterations.

1. **Feature: document-template-redesign, Property 1: Document type configs are mutually distinct** — Generate all pairs of document types, verify config fields differ
2. **Feature: document-template-redesign, Property 2: Theme completeness** — Generate random theme × InvoiceData combinations, verify getTheme returns complete objects
3. **Feature: document-template-redesign, Property 3: Custom header color override** — Generate random hex colors and themes, verify pri field matches custom color
4. **Feature: document-template-redesign, Property 4: Signature display mode selection** — Generate random InvoiceData with varying signature fields, verify exactly one display mode is selected per block

### Integration Tests

1. **Build verification** — Run `pnpm build` to verify no TypeScript compilation errors in consumer components
2. **PDF render smoke test** — Render each of the 4 document types with a sample InvoiceData and verify a valid PDF blob is produced (no runtime errors)
3. **Theme × document type matrix** — Render all 36 combinations (9 themes × 4 types) and verify no crashes

### What Is NOT Tested

- Visual appearance (pixel-level layout, spacing, colors) — requires manual review or visual regression tools
- ReceiptPDF and PaymentReceiptPDF — explicitly excluded from this redesign
- Consumer component behavior — those components are unchanged and have their own tests

