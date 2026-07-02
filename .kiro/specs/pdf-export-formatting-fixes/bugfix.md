# Bugfix Requirements Document

## Introduction

PDF exports for several document types (Client Onboarding Form, Change Order, NDA, Statement of Work, Proposal, and others) currently look unprofessional and, in some cases, are functionally wrong. Confirmed defects in `lib/pdf-templates.tsx` and the PDF download/render entry points (`app/documents/page.tsx`, `components/share-button.tsx`, `app/view/[sessionId]/page.tsx`, and `app/pay/[sessionId]/pay-document-view.tsx`) cause: garbled bullet characters instead of proper bullet glyphs, literal escaped-unicode strings printed instead of glyphs (a "•" bullet in the Proposal budget table plus five "—" em-dashes across the Invoice, Contract, and Payment Receipt templates), downloaded/rendered PDFs using the wrong template with filenames that always read "invoice" for non-core document types, and an awkward empty "(ID: )" reference line on Change Orders that aren't linked to a parent document. This fix corrects all of these defects without touching unrelated branding wording, pricing, or layout choices.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `ContractPDF` renders a parsed-body bullet item (around line 1829 of `lib/pdf-templates.tsx`), OR `SOWPDF` renders an Assumptions list item (around line 2977), OR `NDAPDF` renders an Exclusions list item (around line 3272) THEN the system renders the literal three-character mojibake sequence "â€¢" instead of the "•" (U+2022) bullet glyph.

1.2 WHEN `parseContractBody()` (around lines 1743-1746 of `lib/pdf-templates.tsx`) scans a line for a bullet marker THEN the system's bullet-detection regex character class contains the mojibake bytes "â€¢" instead of the real "•" character, causing lines that start with an actual "•" bullet (as typed by the AI) to NOT be detected as bullets and fall back to being rendered as plain paragraphs.

1.3 WHEN any PDF template writes a Unicode escape sequence as raw JSX text content (directly between a `>` and a `<`, rather than inside a JavaScript string or `{...}` expression) THEN the system renders the literal backslash-escape characters as visible PDF text instead of the intended glyph, because JSX does NOT interpret escape sequences in raw text nodes. This defect occurs at the following six locations in `lib/pdf-templates.tsx`:
   - Around line 2271 — `ProposalPDF` budget-breakdown table row bullet: renders the literal 6-character text "\u2022" instead of a "•" bullet glyph.
   - Around line 206 — `InvoicePDF` / `PaymentSection` partial-payment note ("Partial payment received \u2014 balance still due"): renders the literal "\u2014" instead of an em-dash "—".
   - Around line 1784 — `ContractPDF` "Party A \u2014 Provider" label: renders the literal "\u2014" instead of an em-dash "—".
   - Around line 1790 — `ContractPDF` "Party B \u2014 Client" label: renders the literal "\u2014" instead of an em-dash "—".
   - Around line 2740 — `PaymentReceiptPDF` subtitle ("Clorefy \u2014 AI Document Platform"): renders the literal "\u2014" instead of an em-dash "—".
   - Around line 2823 — `PaymentReceiptPDF` footer ("Clorefy \u2014 clorefy.com"): renders the literal "\u2014" instead of an em-dash "—".

1.4 WHEN a user downloads or views a PDF for a document of type "sow", "change_order", "nda", "client_onboarding_form", "payment_followup", or "receipt" from the Documents/History list (`app/documents/page.tsx`'s `downloadDocument`), OR from the share menu (`components/share-button.tsx`'s `generatePdfBlob`), OR from the shared document view page (`app/view/[sessionId]/page.tsx`'s `buildPdfBlob`), OR from the payment page (`app/pay/[sessionId]/pay-document-view.tsx`'s `buildPdfBlob`, switch at around lines 52-64) THEN the system falls through to the `default` case and renders the document using `InvoicePDF` (or `ReceiptPDF`/`InvoiceNumber`-based logic) instead of the document type's real template (e.g. `SOWPDF`, `ChangeOrderPDF`, `NDAPDF`, `ClientOnboardingFormPDF`, `PaymentFollowupPDF`, `ReceiptPDF`). The `pay-document-view.tsx` switch only handles `contract`, `quote`/`quotation`, `proposal`, and `receipt`, and is MISSING `sow`, `change_order`, `nda`, `client_onboarding_form`, and `payment_followup`. A payment page realistically only ever shows payable documents, so this branch is unlikely to be hit in practice — but the switch is structurally incomplete and should be made complete/correct for consistency with the other entry points and to be safe against future reuse.

1.5 WHEN the downloaded filename is generated for one of those same non-core document types in any of the download entry points that produce a filename (`app/documents/page.tsx`, `components/share-button.tsx`, `app/view/[sessionId]/page.tsx`) THEN the system uses a fallback derived from `invoiceNumber` (which these types never populate) and produces a filename containing the literal word "invoice" instead of the document's actual `referenceNumber` (e.g. "SOW-2026-07-002"). (Note: `app/pay/[sessionId]/pay-document-view.tsx` renders the PDF for inline viewing and does not produce a download filename, so the filename defect does not apply there — only the wrong-template defect in 1.4 does.)

1.6 WHEN `ChangeOrderPDF` renders its Reference/parent-document block (around lines 3059-3068 of `lib/pdf-templates.tsx`) AND `data.parentDocumentId` is empty or undefined (the change order has no linked parent document) THEN the system still renders the trailing text "(ID: )" with a dangling empty parenthetical, following the phrase "This change order amends Contract" (or "Statement of Work").

### Expected Behavior (Correct)

2.1 WHEN `ContractPDF` renders a parsed-body bullet item, OR `SOWPDF` renders an Assumptions list item, OR `NDAPDF` renders an Exclusions list item THEN the system SHALL render the correct "•" (U+2022) bullet glyph, consistent with the correctly-working pattern already used in `ItemRow`'s `bulletLines` renderer (around line 414 of `lib/pdf-templates.tsx`).

2.2 WHEN `parseContractBody()` scans a line for a bullet marker THEN the system SHALL detect lines starting with the real "•" (U+2022) character (in addition to "-") as bullets, so AI-authored bullet lists render as bulleted lists rather than plain paragraphs.

2.3 WHEN any of the six raw-JSX escape locations listed in 1.3 renders THEN the system SHALL render the intended real glyph — a "•" bullet for the `ProposalPDF` budget-breakdown row, and a real em-dash "—" for the `InvoicePDF` partial-payment note, the two `ContractPDF` party labels, and the two `PaymentReceiptPDF` subtitle/footer lines — by wrapping the escape in a string/expression (e.g. `{"\u2022"}` / `{"\u2014"}`) or using the literal glyph character directly. This SHALL be consistent with the many correctly-working sibling usages already present in the same file where the escape lives inside a string literal or expression (e.g. `ProposalPDF` around line 2136, `fmtDate` `return "\u2014"` at line 111, the `getDocumentConfig` `fromLabel`/`toLabel` string literals at lines 516-517, and `tLns.join(" \u2014 ")` at line 2263).

2.4 WHEN a user downloads or views a PDF for a document of type "sow", "change_order", "nda", "client_onboarding_form", "payment_followup", or "receipt" from the Documents/History list, the share menu, the shared document view page, or the payment page THEN the system SHALL select the correct PDF template for that document type (`SOWPDF`, `ChangeOrderPDF`, `NDAPDF`, `ClientOnboardingFormPDF`, `PaymentFollowupPDF`, or `ReceiptPDF` respectively), matching the correct template-selection logic already implemented in `components/pdf-download-button.tsx` and `components/document-preview.tsx`. For `app/pay/[sessionId]/pay-document-view.tsx`, the `buildPdfBlob` switch SHALL be made structurally complete so every supported document type maps to its real template rather than falling through to `ReceiptPDF`/`InvoicePDF`.

2.5 WHEN the downloaded filename is generated for one of those same non-core document types, from any of the download entry points that produce a filename (Documents/History list, share menu, shared document view page) THEN the system SHALL derive the filename from `data.referenceNumber` (falling back to `data.invoiceNumber`, then a type-specific default word) so the filename never contains the literal word "invoice" for a non-invoice document type, matching the correct logic already implemented in `components/pdf-download-button.tsx`.

2.6 WHEN `ChangeOrderPDF` renders its Reference/parent-document block AND `data.parentDocumentId` is empty or undefined THEN the system SHALL NOT render the empty "(ID: )" parenthetical — it SHALL either omit the ID parenthetical while still naming the amended document type, or omit the entire Reference block when there is no linked parent document at all, based on the field semantics of `parentDocumentId` / `parentDocumentType` in `lib/document-schemas.ts` (`ChangeOrderData`).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `ContractPDF`, `SOWPDF`, or `NDAPDF` render bullet lists for data that does not go through the mojibake code paths (e.g. `ItemRow`'s `bulletLines`, or any other already-correct bullet renderer) THEN the system SHALL CONTINUE TO render those bullets exactly as it does today.

3.2 WHEN `parseContractBody()` processes a line starting with "- " THEN the system SHALL CONTINUE TO detect it as a bullet and render it as a bulleted list item.

3.3 WHEN the many correctly-working escape-sequence usages elsewhere in `lib/pdf-templates.tsx` render — i.e. any `\u2022` or `\u2014` escape that already lives inside a JavaScript string literal or `{...}` expression rather than a raw JSX text node (e.g. `ProposalPDF` around line 2136, `fmtDate`'s `return "\u2014"` at line 111, the `getDocumentConfig` `fromLabel`/`toLabel` at lines 516-517, `tLns.join(" \u2014 ")` at line 2263, the `data.paymentMethod || "\u2014"` and other `|| "\u2014"` fallback cells, and any numbered-list / plain-paragraph line in the same parsers) THEN the system SHALL CONTINUE TO render them exactly as it does today.

3.4 WHEN a user downloads or views a PDF for a document of type "invoice", "contract", "quote"/"quotation", or "proposal" from the Documents/History list, the share menu, the shared document view page, or the payment page THEN the system SHALL CONTINUE TO select the same template and derive the same filename it does today.

3.5 WHEN a user downloads a PDF via `components/pdf-download-button.tsx` or `components/document-preview.tsx` for any document type THEN the system SHALL CONTINUE TO behave exactly as it does today (these entry points already implement the correct template and filename logic and are NOT being changed).

3.6 WHEN `ChangeOrderPDF` renders its Reference block AND `data.parentDocumentId` IS populated (the change order is linked to a real parent document) THEN the system SHALL CONTINUE TO render "This change order amends <Type> (ID: <parentDocumentId>)" exactly as it does today.

3.7 WHEN any PDF template renders the "Generated by Clorefy" footer branding, the `PaymentReceiptPDF` "Clorefy — clorefy.com" footer, the `PaymentReceiptPDF` "Clorefy — AI Document Platform" subtitle, pricing/totals content, or any other layout element not named in this document THEN the system SHALL CONTINUE TO render the same WORDING, branding text, and layout unchanged. The ONLY change permitted within the `PaymentReceiptPDF` subtitle (line ~2740) and footer (line ~2823) is correcting the literal "\u2014" escape so it renders as a real em-dash "—" glyph (per 1.3/2.3); the visible branding wording and copy do NOT change — only the dash renders correctly instead of the literal characters "\u2014".

### Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type PdfRenderOrDownloadContext
  OUTPUT: boolean

  RETURN
    // Bug 1: mojibake bullet glyphs
    (X.kind = "bulletGlyph" AND X.template IN {"ContractPDF", "SOWPDF", "NDAPDF"})
    OR (X.kind = "bulletDetectionRegex" AND X.source = "parseContractBody")
    // Bug 2: literal escaped-unicode text written as raw JSX text nodes
    OR (X.kind = "rawJsxEscape" AND X.location IN {
          "ProposalPDF.budgetBreakdownRow (\u2022)",       // ~line 2271
          "InvoicePDF.partialPaymentNote (\u2014)",        // ~line 206
          "ContractPDF.partyALabel (\u2014)",              // ~line 1784
          "ContractPDF.partyBLabel (\u2014)",              // ~line 1790
          "PaymentReceiptPDF.subtitle (\u2014)",           // ~line 2740
          "PaymentReceiptPDF.footer (\u2014)"              // ~line 2823
        })
    // Bug 3: wrong template on download/render
    OR (X.kind = "pdfDownload"
        AND X.entryPoint IN {
              "documents/page.tsx",
              "share-button.tsx",
              "view/[sessionId]/page.tsx",
              "pay/[sessionId]/pay-document-view.tsx"     // 4th entry point, buildPdfBlob switch ~lines 52-64
            }
        AND X.documentType IN {"sow", "change_order", "nda", "client_onboarding_form", "payment_followup", "receipt"})
    // Bug 4: empty "(ID: )" parenthetical
    OR (X.kind = "changeOrderReferenceBlock" AND (X.parentDocumentId IS EMPTY OR X.parentDocumentId IS UNDEFINED))
END FUNCTION

// Helper: only the three download entry points produce a saved filename.
// The payment page (pay/[sessionId]/pay-document-view.tsx) renders inline for
// viewing and has no download filename, so the filename property is scoped out.
FUNCTION producesFilename(entryPoint)
  RETURN entryPoint IN {"documents/page.tsx", "share-button.tsx", "view/[sessionId]/page.tsx"}
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← F'(X)
  ASSERT
    (X.kind = "bulletGlyph" IMPLIES result.renderedText = "\u2022")
    AND (X.kind = "bulletDetectionRegex" IMPLIES result.detectsRealBulletChar = true)
    AND (X.kind = "rawJsxEscape" IMPLIES
          result.renderedGlyph = intendedGlyphFor(X.location)   // "•" for the bullet, "—" for the five em-dashes
          AND result.renderedText DOES_NOT_CONTAIN "\u2022"      // no literal backslash-u text
          AND result.renderedText DOES_NOT_CONTAIN "\u2014")
    AND (X.kind = "pdfDownload" IMPLIES
          result.templateUsed = correctTemplateFor(X.documentType)
          AND (producesFilename(X.entryPoint) IMPLIES
                (result.filename DOES_NOT_CONTAIN "invoice"
                 AND result.filename CONTAINS (X.referenceNumber OR type_specific_default))))
    AND (X.kind = "changeOrderReferenceBlock" IMPLIES result.renderedText DOES_NOT_CONTAIN "(ID: )")
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Key Definitions:**
- **F**: The current code in `lib/pdf-templates.tsx`, `app/documents/page.tsx`, `components/share-button.tsx`, `app/view/[sessionId]/page.tsx`, and `app/pay/[sessionId]/pay-document-view.tsx` before the fix.
- **F'**: The code after applying the fix.
