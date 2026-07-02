# PDF Export Formatting Fixes — Bugfix Design

## Overview

Several PDF exports render incorrectly because of two encoding defects, one structural
defect, and one presentation defect — all confined to `lib/pdf-templates.tsx` and the four
PDF download/render entry points that each carry their own hand-rolled template-selection
`switch`.

The four defect families are:

1. **Mojibake bullet glyphs** — three renderers (`ContractPDF` parsed-body bullets, `SOWPDF`
   Assumptions, `NDAPDF` Exclusions) and the `parseContractBody()` detection regex contain the
   literal three-byte mojibake sequence `â€¢` instead of the real `•` (U+2022). The corrupted
   regex also fails to detect real `•`-prefixed lines authored by the AI.
2. **Raw-JSX escape text nodes** — six places write a `\uXXXX` escape directly between `>` and
   `<` in JSX, so the literal six characters `\u2022` / `\u2014` print instead of the glyph
   (JSX does not interpret escape sequences in raw text nodes).
3. **Wrong template on download/render** — four entry points fall through to `InvoicePDF`/
   `ReceiptPDF` for `sow`, `change_order`, `nda`, `client_onboarding_form`, `payment_followup`,
   and (for the pay page) `receipt`, because their `switch` statements are missing those cases.
   The resulting filenames also read like "invoice" for these non-core types.
4. **Empty "(ID: )" parenthetical** — `ChangeOrderPDF` always prints "(ID: )" even when the
   change order has no linked parent document.

The fix strategy is **surgical and connected**: correct each glyph/escape at its site using one
consistent, mojibake-proof convention; introduce two small shared helpers so all four broken
entry points resolve the correct template and filename the same way (eliminating the divergent-
`switch` class of bug for good); and guard the change-order parenthetical. No branding wording,
pricing, layout, or the two already-correct entry points (`components/pdf-download-button.tsx`,
`components/document-preview.tsx`) are touched.

## Glossary

- **Bug_Condition (C)**: The predicate `isBugCondition(X)` from `bugfix.md` — true when a render
  or download operation hits one of the four defect families (mojibake bullet, raw-JSX escape,
  wrong template/filename, or empty change-order ID parenthetical).
- **Property (P)**: The desired post-fix behavior — correct `•`/`—` glyphs, correct per-type
  template, reference-number-based filenames, and no dangling "(ID: )".
- **Preservation**: All behavior for inputs where `isBugCondition` is false — correctly-working
  sibling glyph usages, `-`-prefixed bullet detection, core-type (invoice/contract/quote/
  proposal) template + filename selection, the two already-correct entry points, and change
  orders that *do* have a parent — must be byte-for-byte unchanged.
- **F / F'**: The code before / after the fix.
- **`parseContractBody`**: Module-local pure function in `lib/pdf-templates.tsx` (~line 1720+)
  that splits a contract description string into `heading` / `bullet` / `paragraph` blocks.
- **`resolvePdfComponent` / `resolvePdfTemplateKey`**: New shared helpers (proposed) that map a
  document type + data to the correct PDF component, replacing the duplicated `switch` logic.
- **`buildPdfFilename` / `resolveDocumentReference`**: New shared helper (proposed) that derives
  the filename reference segment (referenceNumber → invoiceNumber → type default) so non-invoice
  types never produce an "invoice" filename.
- **Raw-JSX text node**: JSX content written directly between `>` and `<` (e.g.
  `<Text>\u2014</Text>`), where escape sequences are NOT interpreted, versus an expression node
  (`<Text>{"\u2014"}</Text>`) or a string-literal prop, where they are.
- **Mojibake `â€¢`**: The byte sequence U+00E2 U+20AC U+00A2 — a `•` (UTF-8 `E2 80 A2`) that was
  decoded as Windows-1252/Latin-1 and re-saved.

## Bug Details

### Bug Condition

The bug manifests across four independent families. A render/download context `X` triggers a
bug when it renders a mojibake bullet, renders a raw-JSX escape text node, resolves a template/
filename for a non-core document type through one of the four incomplete `switch` statements, or
renders the change-order reference block with an empty `parentDocumentId`.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type PdfRenderOrDownloadContext
  OUTPUT: boolean

  RETURN
    // Family 1: mojibake bullet glyph / detection
    (X.kind = "bulletGlyph" AND X.template IN {"ContractPDF", "SOWPDF", "NDAPDF"})
    OR (X.kind = "bulletDetectionRegex" AND X.source = "parseContractBody")

    // Family 2: literal escaped-unicode written as a raw JSX text node
    OR (X.kind = "rawJsxEscape" AND X.location IN {
          "ProposalPDF.budgetBreakdownRow (\u2022)",   // ~2271
          "InvoicePDF.partialPaymentNote (\u2014)",    // ~206
          "ContractPDF.partyALabel (\u2014)",          // ~1784
          "ContractPDF.partyBLabel (\u2014)",          // ~1790
          "PaymentReceiptPDF.subtitle (\u2014)",       // ~2740
          "PaymentReceiptPDF.footer (\u2014)"          // ~2823
        })

    // Family 3: wrong template / filename on download/render
    OR (X.kind = "pdfDownload"
        AND X.entryPoint IN {
              "documents/page.tsx",
              "share-button.tsx",
              "view/[sessionId]/page.tsx",
              "pay/[sessionId]/pay-document-view.tsx"
            }
        AND X.documentType IN {"sow","change_order","nda",
                               "client_onboarding_form","payment_followup","receipt"})

    // Family 4: empty "(ID: )" parenthetical
    OR (X.kind = "changeOrderReferenceBlock"
        AND (X.parentDocumentId IS EMPTY OR X.parentDocumentId IS UNDEFINED))
END FUNCTION

// Only the three real download entry points produce a saved filename.
FUNCTION producesFilename(entryPoint)
  RETURN entryPoint IN {"documents/page.tsx","share-button.tsx","view/[sessionId]/page.tsx"}
END FUNCTION
```

### Examples

- **Mojibake bullet (1.1)**: A signed contract whose `description` contains a bullet line renders
  `â€¢ Deliverable X` (a garbled 3-char prefix) instead of `• Deliverable X`. Expected: `•`.
- **Broken detection (1.2)**: The AI authors a line `• Milestone 1` in a contract body.
  `parseContractBody`'s regex `/^[-â€¢]\s+/` fails to match the real `•`, so the line renders as a
  plain paragraph instead of a bullet list item. Expected: detected + rendered as a bullet.
- **Raw-JSX escape (1.3)**: `ProposalPDF`'s budget-breakdown row renders the literal text
  `\u2022` (six visible characters) before each deliverable, and `ContractPDF` prints
  `Party A \u2014 Provider`. Expected: `•` and `Party A — Provider`.
- **Wrong template (1.4)**: Downloading an SOW from the Documents list produces an *invoice*-shaped
  PDF (`InvoicePDF`) instead of `SOWPDF`. Expected: `SOWPDF`.
- **Wrong filename (1.5)**: That same SOW downloads as `invoice-….pdf` instead of a name built
  from `SOW-2026-07-002`. Expected: filename contains the reference number, never "invoice".
- **Empty parenthetical (1.6)**: A standalone change order with no linked parent renders
  "This change order amends Contract (ID: )". Expected: "This change order amends Contract" with
  no dangling parenthetical.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Correctly-working sibling glyph usages must render exactly as today. These include:
  - `ItemRow`'s `bulletLines` renderer at ~line 414 (literal `•` — kept as-is).
  - `ProposalPDF`'s correct expression bullet at ~line 2136 (`{"\u2022"}`).
  - `parseContractBody`-style string-literal escapes elsewhere: `fmtDate`'s `return "\u2014"`
    (~line 111), `getDocumentConfig` `fromLabel`/`toLabel` (`"... \u2014 ..."`, ~lines 516–517),
    `tLns.join(" \u2014 ")` (~line 2263), the `... || "\u2014"` fallback cells, and the
    `/^[-\u2022*]\s+/` detection regex at ~line 2259.
- `parseContractBody` must **continue** to detect `- `-prefixed lines as bullets (in addition to
  gaining `•` detection).
- Core document types (`invoice`, `contract`, `quote`/`quotation`, `proposal`) must continue to
  resolve to the same template AND the same filename in all four entry points.
- `components/pdf-download-button.tsx` and `components/document-preview.tsx` must not change —
  they already implement the correct logic and are the behavioral reference for the shared
  helpers, not a target of this fix.
- A change order that **has** a `parentDocumentId` must continue to render
  "This change order amends <Type> (ID: <parentDocumentId>)" exactly as today.
- All branding/wording (the "Generated by Clorefy" footer, the `PaymentReceiptPDF`
  "Clorefy — AI Document Platform" subtitle and "Clorefy — clorefy.com" footer), pricing,
  totals, and layout are unchanged. The only permitted change inside the receipt subtitle/footer
  is correcting the `\u2014` escape so the dash *renders* — the visible copy is identical.

**Scope:**
All inputs where `isBugCondition(X)` is false must satisfy `F(X) = F'(X)`. This explicitly
includes every non-buggy glyph, every core-type download, both already-correct entry points, and
every parented change order.

## Hypothesized Root Cause

1. **Encoding corruption (Families 1 & 2)**: `lib/pdf-templates.tsx` carries a UTF-8 BOM and was
   at some point opened/saved through a Latin-1/Windows-1252 layer. Non-ASCII glyphs that had been
   typed as literals (`•`, box-drawing `─` in comments) were re-encoded into mojibake (`â€¢`,
   `â”€`). Separately, several `\uXXXX` escapes were pasted into **raw JSX text positions** where
   they are inert. The abundance of *correct* siblings using the `\uXXXX` escape inside string
   literals / `{...}` expressions (e.g. ~lines 111, 516–517, 2136, 2259, 2263) confirms the
   intended convention was the escape form — the broken sites simply landed in the wrong syntactic
   position, and the literal glyphs that survived (line 414) did so by luck of the editing history.
   **Conclusion:** literal non-ASCII glyphs in this file are demonstrably fragile; the ASCII
   `\uXXXX` escape form is the mojibake-proof convention and already dominant.

2. **Copy-paste `switch` drift (Family 3)**: Template selection was copied into six+ locations.
   Two copies (`pdf-download-button.tsx`, `document-preview.tsx`) were extended when the five new
   document types shipped; the four other copies were not, so they silently fall through to
   `default → InvoicePDF`. The filename logic drifted the same way, keying off `invoiceNumber`
   (empty for these types) and defaulting to the literal word "invoice".

3. **Unguarded interpolation (Family 4)**: `ChangeOrderPDF` interpolates
   `(ID: {data.parentDocumentId})` unconditionally, unlike the sibling `Re: {parentDocumentType}`
   line at ~3033 which is guarded with `{data.parentDocumentType && ...}`. When `parentDocumentId`
   is empty the parentheses render with nothing inside.

## Correctness Properties

Property 1: Bug Condition — Mojibake bullet glyphs render as U+2022

_For any_ render where the bug condition holds with `kind = "bulletGlyph"` (a `ContractPDF`
parsed-body bullet, an `SOWPDF` Assumptions item, or an `NDAPDF` Exclusions item), the fixed
function SHALL render the bullet marker as the real `•` (U+2022) glyph and SHALL NOT contain the
mojibake sequence `â€¢`.

**Validates: Requirements 2.1**

Property 2: Bug Condition — parseContractBody detects the real "•" bullet

_For any_ line beginning with a real `•` (U+2022) followed by whitespace, the fixed
`parseContractBody` SHALL classify it as a `bullet` block and strip the `•` marker, producing the
same block shape it produces today for a `-`-prefixed line.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Raw-JSX escapes render the intended glyph

_For any_ of the six raw-JSX escape locations, the fixed function SHALL render the intended real
glyph (`•` for the `ProposalPDF` budget row; `—` for the `InvoicePDF` partial-payment note, the
two `ContractPDF` party labels, and the two `PaymentReceiptPDF` subtitle/footer lines) via a
string/expression form (`{"\u2022"}` / `{"\u2014"}`), and the rendered text SHALL NOT contain the
literal character sequences `\u2022` or `\u2014`.

**Validates: Requirements 2.3**

Property 4: Bug Condition — Correct template resolution for non-core types

_For any_ document type in {`sow`, `change_order`, `nda`, `client_onboarding_form`,
`payment_followup`, `receipt`} rendered/downloaded from any of the four entry points, the fixed
resolver SHALL select that type's real template (`SOWPDF`, `ChangeOrderPDF`, `NDAPDF`,
`ClientOnboardingFormPDF`, `PaymentFollowupPDF`, `ReceiptPDF` respectively) rather than falling
through to `InvoicePDF`/`ReceiptPDF`.

**Validates: Requirements 2.4**

Property 5: Bug Condition — Filename never reads "invoice" for non-invoice types

_For any_ non-invoice document type downloaded from an entry point that produces a filename
(Documents list, share menu, shared view page), the fixed filename SHALL be derived from
`referenceNumber` (falling back to `invoiceNumber`, then a type-specific default word), SHALL
contain the reference number when present, and SHALL NOT contain the literal word "invoice".

**Validates: Requirements 2.5**

Property 6: Bug Condition — Change-order reference never emits "(ID: )"

_For any_ `ChangeOrderPDF` render where `parentDocumentId` is empty or undefined, the fixed
function SHALL NOT render the substring "(ID: )"; it renders the "amends <Type>" sentence with no
dangling parenthetical (or omits the reference block entirely when there is no parent context).

**Validates: Requirements 2.6**

Property 7: Preservation — Existing bullet detection and correct sibling glyphs unchanged

_For any_ input where the bug condition does NOT hold — a `-`-prefixed line into
`parseContractBody`, or any already-correct glyph usage (line 414 literal `•`, line 2136
`{"\u2022"}`, string-literal escapes at ~111/516–517/2259/2263 and the `|| "\u2014"` fallbacks) —
the fixed code SHALL produce exactly the same result as the original, preserving all
currently-correct bullet detection and glyph rendering.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 8: Preservation — Core-type templates/filenames, correct entry points, and parented change orders unchanged

_For any_ input where the bug condition does NOT hold — a core-type (`invoice`, `contract`,
`quote`/`quotation`, `proposal`) download from the four entry points, any download through
`pdf-download-button.tsx`/`document-preview.tsx`, or a `ChangeOrderPDF` render with a populated
`parentDocumentId` — the fixed code SHALL select the same template, derive the same filename, and
render the same "(ID: <parentDocumentId>)" text as the original.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Design decision A — one consistent, mojibake-proof glyph convention

**Decision: use the `\uXXXX` escape form everywhere the fix touches, placed in a valid syntactic
position** — `{"\u2022"}` / `{"\u2014"}` in JSX text positions, and `\u2022` inside regex and
string literals. **Rationale:** the root cause of Families 1 & 2 is that literal non-ASCII bytes
in this file are fragile (they were corrupted into mojibake once already), whereas the many
correct siblings already use the ASCII escape form. Pure-ASCII source cannot be re-corrupted by a
Latin-1/UTF-8 round-trip, and it matches the file's dominant convention. We deliberately do **not**
switch the correct literal `•` at line 414 to an escape (that would violate preservation 3.1/3.3);
the minor resulting inconsistency (one literal vs. escapes elsewhere) is the correct tradeoff for
"never break what works."

### Family 1 & 2 — bullet glyphs and detection (Requirements 2.1, 2.2)

**File**: `lib/pdf-templates.tsx`

1. **`parseContractBody` regex (~lines 1743–1746)**: replace both the detection test and the strip
   replace `/^[-â€¢]\s+/` → `/^[-\u2022]\s+/`. This restores `•` detection while keeping `-`.
2. **`ContractPDF` parsed-body bullet marker (~line 1829)**: `<Text ...>â€¢</Text>` →
   `<Text ...>{"\u2022"}</Text>`.
3. **`SOWPDF` Assumptions item (~line 2977)** and **`NDAPDF` Exclusions item (~line 3272)**:
   replace the `â€¢` marker text with `{"\u2022"}`.

### Family 2 — raw-JSX escape text nodes (Requirement 2.3)

**File**: `lib/pdf-templates.tsx` — wrap each raw escape in an expression:
- `ProposalPDF` budget row (~2271): `>\u2022<` → `>{"\u2022"}<`.
- `InvoicePDF`/`PaymentSection` partial-payment note (~206): `... \u2014 balance ...` raw text →
  split into `{"... \u2014 balance still due"}` (single string expression) or interpolate the dash
  as `{"\u2014"}`.
- `ContractPDF` party labels (~1784, ~1790): `Party A \u2014 Provider` /
  `Party B \u2014 Client` → string-expression form, e.g. `{"Party A \u2014 Provider"}`.
- `PaymentReceiptPDF` subtitle (~2740) and footer (~2823): correct only the `\u2014` escape to a
  string expression; wording stays identical (Requirement 3.7).

### Design decision B — shared resolver helpers vs. completing each switch in place

**Decision: introduce two small shared helpers and adopt them in the four broken entry points;
leave the two already-correct entry points untouched.** **Rationale:** template selection has
already drifted across six+ copies — the exact class of bug we are fixing. A single source of
truth (DRY) is the only durable way to prevent recurrence, which is the user's stated priority.
The risk ("must not change behavior for already-correct entry points") is contained by:
(a) modeling the helper's behavior *exactly* on the two correct entry points, and (b) **not
refactoring** those two correct entry points in this fix — Requirement 3.5 marks them out of
scope, so touching them would add risk with no benefit. They remain the behavioral spec the
helper is verified against; a later cleanup can migrate them.

**New file**: `lib/pdf-export-helpers.ts` (plain `.ts`, no `@react-pdf` import, so it stays out of
eager bundles and is trivially unit/property-testable).

```
// Pure — property-testable over ALL_DOCUMENT_TYPES
export type PdfTemplateKey =
  | "InvoicePDF" | "ContractPDF" | "QuotationPDF" | "ProposalPDF" | "ReceiptPDF"
  | "SOWPDF" | "ChangeOrderPDF" | "NDAPDF" | "ClientOnboardingFormPDF" | "PaymentFollowupPDF"

export function resolvePdfTemplateKey(documentType: string, data: InvoiceData): PdfTemplateKey
  // normalizeDocumentType() first (quotation → quote)
  // contract→ContractPDF, quote→QuotationPDF, proposal→ProposalPDF, receipt→ReceiptPDF,
  // sow→SOWPDF, change_order→ChangeOrderPDF, nda→NDAPDF,
  // client_onboarding_form→ClientOnboardingFormPDF, payment_followup→PaymentFollowupPDF,
  // invoice/recurring_invoice/unknown→ (design.layout==="receipt"||templateId==="receipt")
  //                                     ? "ReceiptPDF" : "InvoicePDF"   // preserves core default

// Thin, impure adapter used by call sites that already `await import("@/lib/pdf-templates")`
export function resolvePdfComponent(templates, documentType, data)
  return templates[resolvePdfTemplateKey(documentType, data)]

// Pure — reference segment only (never the full format string), so each entry point
// keeps its own surrounding filename format and core-type output is unchanged.
export function resolveDocumentReference(data, documentType): string
  // invoice/receipt: invoiceNumber || referenceNumber || <typeDefault>
  // all other types: referenceNumber || invoiceNumber || <typeDefault>
  // <typeDefault> from a small map (sow→"sow", change_order→"change-order", nda→"nda", …)

// Optional convenience used by entry points that build a full name
export function buildPdfFilename(data, documentType): string
  // `${labelPrefix(documentType)}_${sanitize(resolveDocumentReference)}_${YYYY-MM-DD}.pdf`
  // labelPrefix derived from getDocumentTypeConfig(documentType)?.label (matches pdf-download-button)
```

**Entry-point adoption:**
- `app/documents/page.tsx` (`downloadDocument`, ~1577–1588): replace the 4-case `switch` with
  `resolvePdfComponent(templates, docType, cleanedData)` and set `filePrefix` from
  `resolveDocumentReference(cleanedData, docType)`. Keeps the existing signature-image loading and
  surrounding filename format; core types resolve identically.
- `components/share-button.tsx` (`generatePdfBlob` + `getFileName`): `generatePdfBlob` uses
  `resolvePdfComponent`; `getFileName` uses `resolveDocumentReference` for the `ref` segment
  (keeping its existing `${type}-${ref}-${client}` shape).
- `app/view/[sessionId]/page.tsx` (`buildPdfBlob` + `handleDownload`): `buildPdfBlob` uses
  `resolvePdfComponent`; `handleDownload`'s `a.download` uses `resolveDocumentReference`.
- `app/pay/[sessionId]/pay-document-view.tsx` (`buildPdfBlob`, ~52–64): use `resolvePdfComponent`
  so the switch is structurally complete. No filename change (view-only, per 1.5 note).

### Family 4 — change-order empty parenthetical (Requirement 2.6)

**File**: `lib/pdf-templates.tsx`, `ChangeOrderPDF` reference block (~3059–3068).
**Decision (per 2.6):** keep the "This change order amends <Type>" sentence, drop **only** the
empty parenthetical — mirroring the guarded `{data.parentDocumentType && ...}` pattern at ~3033.

```
This change order amends <bold>{Type}</bold>
{data.parentDocumentId ? ` (ID: ${data.parentDocumentId})` : ""}
```

Extract a pure helper for testability:
```
export function changeOrderIdSuffix(parentDocumentId?: string): string
  return parentDocumentId && parentDocumentId.trim().length > 0
    ? ` (ID: ${parentDocumentId})` : ""
```
Rendered as `{changeOrderIdSuffix(data.parentDocumentId)}`. When populated the output is identical
to today (3.6); when empty it emits nothing.

### Testability changes

- **Export `parseContractBody`** from `lib/pdf-templates.tsx` (it is already pure) so Property 2/7
  can exercise both `-` and `•` prefixes. Alternatively export a `BULLET_PREFIX_RE` predicate.
- **Export `changeOrderIdSuffix`** (above) for Property 6.
- The template/filename resolvers live in the new `lib/pdf-export-helpers.ts` and are exported
  from the start.

## Testing Strategy

### Validation Approach

Two phases: first surface counterexamples on the **unfixed** code to confirm each root cause, then
verify the fix and prove preservation. Tests use the existing stack — **vitest + fast-check**,
files under `__tests__/`, naming `*.property.test.ts` / `*.unit.test.ts`, `{ numRuns: 100 }`.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate each defect BEFORE the fix and confirm/refute the root-cause analysis.

**Test Plan**: Run the property/unit tests below against the current code. Encoding and
resolver-based tests can fail immediately (they read the current source/logic); the change-order
and parser tests fail once the helpers are extracted from unfixed logic.

**Test Cases**:
1. **Mojibake source scan** (unit): assert `lib/pdf-templates.tsx` source contains zero
   occurrences of the bullet mojibake sequence `"\u00e2\u20ac\u00a2"` (`â€¢`). Fails on unfixed
   code at the `parseContractBody` regex, `ContractPDF`, `SOWPDF`, `NDAPDF` sites. *(Targets only
   the bullet mojibake; box-drawing comment mojibake is out of scope and not asserted.)*
2. **Raw-JSX escape scan** (unit): assert the source has no `>\u2022<` / `>\u2014<` raw text-node
   escapes at the six named sites (regex for `>\s*\\u20(22|14)\s*<`). Fails on unfixed
   `ProposalPDF`/`ContractPDF`/etc.
3. **Parser detection** (property): `parseContractBody("• foo")` yields a `bullet` block with text
   `"foo"`. Fails on unfixed regex (real `•` not matched).
4. **Template resolver** (property over `ALL_DOCUMENT_TYPES`): `resolvePdfTemplateKey` returns the
   correct key for every type. Fails for the five/six non-core types under the old inline switches.
5. **Change-order suffix** (property): `changeOrderIdSuffix("")` returns `""` (no "(ID: )"). Fails
   on unfixed unconditional interpolation.

**Expected Counterexamples**: mojibake bytes present; raw `\u2022`/`\u2014` text nodes present;
`•`-lines classified as `paragraph`; `sow`→`InvoicePDF`; `changeOrderIdSuffix("")` → `" (ID: )"`.

### Fix Checking

**Goal**: For all inputs where the bug condition holds, `F'` produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := F'(X)
  ASSERT
    (X.kind="bulletGlyph"          IMPLIES result.marker = "\u2022")
    AND (X.kind="bulletDetectionRegex" IMPLIES result.detectsRealBullet = true)
    AND (X.kind="rawJsxEscape"     IMPLIES result.glyph = intendedGlyph(X.location)
                                   AND result.text NOT CONTAINS "\u2022"
                                   AND result.text NOT CONTAINS "\u2014")
    AND (X.kind="pdfDownload"      IMPLIES result.templateKey = correctKey(X.documentType)
                                   AND (producesFilename(X.entryPoint) IMPLIES
                                        result.filename NOT CONTAINS "invoice"
                                        AND result.filename CONTAINS X.referenceNumber))
    AND (X.kind="changeOrderReferenceBlock" IMPLIES result.text NOT CONTAINS "(ID: )")
END FOR
```

### Preservation Checking

**Goal**: For all inputs where the bug condition does NOT hold, `F(X) = F'(X)`.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

**Testing Approach**: Property-based testing is preferred for preservation because it samples the
whole input domain (all document types, both bullet prefixes, present/absent parent IDs) and
catches edge cases a handful of unit tests would miss.

**Test Plan**: Observe current behavior on the UNFIXED code for `-` bullets, core-type
template/filename selection, and parented change orders, then encode those observations as
properties that must still hold after the fix.

**Test Cases**:
1. **`-` bullet preserved**: `parseContractBody("- foo")` yields a `bullet` block `"foo"` — before
   and after.
2. **Core-type resolver preserved**: for `invoice`/`contract`/`quote`/`quotation`/`proposal`,
   `resolvePdfTemplateKey` returns the same key the old switch returned; the receipt-layout
   default path (`design.layout==="receipt"`) still yields `ReceiptPDF`.
3. **Core-type filename preserved**: `resolveDocumentReference` for a realistic invoice
   (`invoiceNumber` set) returns `invoiceNumber`, matching today's output.
4. **Parented change order preserved**: `changeOrderIdSuffix("CTR-1")` returns `" (ID: CTR-1)"`.
5. **Correct sibling escapes untouched**: source scan confirms line 414 literal `•`, line 2136
   `{"\u2022"}`, and the string-literal `\u2014` escapes are unchanged.

### Unit Tests

- `__tests__/pdf-export-glyphs.unit.test.ts`: source-scan for bullet mojibake and raw-JSX escapes
  at the named sites (extends the mojibake-detection pattern already in
  `__tests__/pdf-templates-config.test.ts`, which asserts `fmtDate(undefined)` is a real em dash).
- `__tests__/pdf-export-helpers.unit.test.ts`: `resolveDocumentReference` type-default words;
  `buildPdfFilename` shape; `changeOrderIdSuffix("")` / `changeOrderIdSuffix("X")`.

### Property-Based Tests

- `__tests__/pdf-export-helpers.property.test.ts`:
  - (b) `resolvePdfTemplateKey` returns the correct template for **all** `ALL_DOCUMENT_TYPES`
    (plus legacy `"quotation"`).
  - (c) `resolveDocumentReference`/`buildPdfFilename` never yields "invoice" for a non-invoice
    type, and always contains the reference number when present.
  - (e) `changeOrderIdSuffix` never emits "(ID: )" for empty/whitespace input and always emits
    "(ID: x)" for non-empty `x`.
- `__tests__/pdf-contract-body-parser.property.test.ts`:
  - (a) both `- ` and `• ` prefixes are detected as bullets and the marker is stripped;
    non-bullet lines remain `paragraph`/`heading` (preservation of 3.2).
- `__tests__/pdf-export-glyphs.property.test.ts`:
  - (d) a source-scan property asserting the fixed rendering sites contain no literal `\u2022`/
    `\u2014` raw text nodes and no `â€¢` mojibake.

### Integration Tests

- Manual re-export smoke test of the five sample document types — **Client Onboarding Form,
  Change Order, NDA, SOW, Proposal** — from each of the four entry points, verifying:
  correct bullets (`•`), correct em-dashes (`—`), correct per-type template, reference-number-based
  filenames (no "invoice"), and no empty "(ID: )" on a standalone change order.
- Confirm a core-type (invoice, contract) export from the same entry points is unchanged.

### Verification Gate

The fix is complete only when `pnpm lint` passes and the full **vitest** suite (including the new
property/unit files above) is green, and the manual re-export smoke test shows correct bullets,
em-dashes, filenames, and no dangling "(ID: )".
