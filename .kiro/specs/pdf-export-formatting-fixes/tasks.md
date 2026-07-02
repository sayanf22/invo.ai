# Implementation Plan

## Overview

This plan follows the exploratory bugfix workflow: build the testable seams first, write
property/unit tests that FAIL on the unfixed code to prove each defect, then apply surgical fixes
and re-run the same tests to confirm the fix while property-based preservation tests guarantee
nothing that already works breaks.

Bug families (from `design.md`):
- **F1** Mojibake bullet glyphs (`â€¢`) in `ContractPDF`/`SOWPDF`/`NDAPDF` + `parseContractBody` regex.
- **F2** Six raw-JSX `\uXXXX` escape text nodes rendering literal characters.
- **F3** Wrong template + filename for non-core types across four entry points.
- **F4** Empty `(ID: )` parenthetical in `ChangeOrderPDF`.

Glyph convention for every touched site (Design decision A): the `\uXXXX` escape in a **valid
syntactic position** — `{"\u2022"}` / `{"\u2014"}` in JSX text positions, and `\u2022` inside
regex/string literals. The correct literal `•` at ~line 414 is deliberately left as-is.

## Tasks

- [x] 1. Extract testability seams from the UNFIXED code (no behavior change yet)

  Create the pure seams the tests target, each mirroring the CURRENT (still-buggy) logic so the
  exploration tests in task 2 fail for the right reason and the preservation tests in task 3 pass.
  This task must NOT change any runtime behavior — it only relocates/exports existing logic.

  - [x] 1.1 Create `lib/pdf-export-helpers.ts` mirroring the current incomplete `switch` (buggy)
    - Plain `.ts` file, NO `@react-pdf/renderer` import (keeps it out of eager bundles + trivially testable).
    - Export `type PdfTemplateKey` (the 10 keys from design).
    - `resolvePdfTemplateKey(documentType, data)`: for now reproduce the CURRENT `documents/page.tsx`
      switch exactly — `contract→ContractPDF`, `quote→QuotationPDF`, `proposal→ProposalPDF`,
      `default→ (design.layout/templateId==="receipt" ? "ReceiptPDF" : "InvoicePDF")`. Run
      `normalizeDocumentType` first. **Deliberately leave `sow`/`change_order`/`nda`/
      `client_onboarding_form`/`payment_followup` falling through to default** so the Property 4
      test fails on this task's output (confirms F3 root cause).
    - `resolvePdfComponent(templates, documentType, data)`: thin adapter → `templates[resolvePdfTemplateKey(...)]`.
    - `resolveDocumentReference(data, documentType)`: reproduce the CURRENT documents-page fallback
      (`invoiceNumber || "invoice"`-style) so Property 5 fails now.
    - `buildPdfFilename(data, documentType)`: `${labelPrefix}_${sanitize(resolveDocumentReference)}_${YYYY-MM-DD}.pdf`.
    - _Bug_Condition: isBugCondition(X) where X.kind = "pdfDownload" (F3)_
    - _Requirements: 1.4, 1.5_

  - [x] 1.2 Export `parseContractBody` (unchanged) from `lib/pdf-templates.tsx`
    - Add `export` to the existing pure `parseContractBody` (~line 1710). Keep the current mojibake
      regex `/^[-â€¢]\s+/` untouched so Property 2 (real `•` detection) fails now while Property 7
      (`-` detection) passes now.
    - _Bug_Condition: isBugCondition(X) where X.kind = "bulletDetectionRegex", source = "parseContractBody" (F1)_
    - _Requirements: 1.2_

  - [x] 1.3 Add and export `changeOrderIdSuffix` with the CURRENT unconditional logic
    - Add `export function changeOrderIdSuffix(parentDocumentId?: string): string` to
      `lib/pdf-templates.tsx`, initially returning `" (ID: " + (parentDocumentId ?? "") + ")"`
      (i.e. the current unconditional behavior) so Property 6 fails on empty input now.
    - Do NOT wire it into `ChangeOrderPDF` yet (that is task 5) — this keeps runtime output identical.
    - _Bug_Condition: isBugCondition(X) where X.kind = "changeOrderReferenceBlock" (F4)_
    - _Requirements: 1.6_

  - [x] 1.4 Verify no behavior change and it compiles
    - Run `pnpm lint`; confirm the app still builds. The exports/relocations must be byte-neutral
      to runtime output (entry points still use their own switches at this point).
    - _Requirements: 3.4, 3.5_

- [x] 2. Write bug condition exploration tests (BEFORE any fix)
  - **Property 1: Bug Condition** — PDF export formatting defects (F1–F4)
  - **CRITICAL**: These tests MUST FAIL on the current/unfixed code — the failures confirm the bugs exist.
  - **DO NOT fix the tests or the code when they fail** — document the counterexamples instead.
  - **NOTE**: These tests encode the expected post-fix behavior; they validate the fix once they pass.
  - **GOAL**: Surface concrete counterexamples for every defect family, mapping to design Properties 1–6.
  - **Scoped PBT approach**: the mojibake/raw-JSX defects are deterministic source-level facts, so
    scope those properties to source-scan assertions over the exact named sites; the parser,
    resolver, and suffix defects are exercised as true properties over generated inputs (`numRuns: 100`).
  - Create the following test files under `__tests__/` (vitest + fast-check):
    - `__tests__/pdf-export-glyphs.property.test.ts` (design test (d)) + extend
      `__tests__/pdf-templates-config.test.ts`'s mojibake pattern into a dedicated
      `__tests__/pdf-export-glyphs.unit.test.ts`:
      - **F1 mojibake source scan** — assert `lib/pdf-templates.tsx` source contains ZERO
        occurrences of the bullet mojibake `"\u00e2\u20ac\u00a2"` (`â€¢`). *(Design Property 1.)*
        FAILS now at the `parseContractBody` regex, `ContractPDF` ~1829, `SOWPDF` ~2977, `NDAPDF` ~3272.
      - **F2 raw-JSX escape scan** — assert the source has no raw text-node escapes matching
        `>\s*\\u20(22|14)\s*<` at the six named sites (~2271, ~206, ~1784, ~1790, ~2740, ~2823).
        *(Design Property 3.)* FAILS now.
    - `__tests__/pdf-contract-body-parser.property.test.ts`:
      - **F1 detection** — for any line `"• " + text`, `parseContractBody` returns a `bullet` block
        whose text equals `text` (marker stripped). *(Design Property 2.)* FAILS now (real `•` unmatched).
    - `__tests__/pdf-export-helpers.property.test.ts`:
      - **F3 template** — property over `ALL_DOCUMENT_TYPES` (+ legacy `"quotation"`):
        `resolvePdfTemplateKey` returns the correct key for `sow`/`change_order`/`nda`/
        `client_onboarding_form`/`payment_followup`/`receipt`. *(Design Property 4.)* FAILS now
        (they resolve to `InvoicePDF`/`ReceiptPDF`).
      - **F3 filename** — for every non-invoice type, `resolveDocumentReference`/`buildPdfFilename`
        never contains the literal word `"invoice"` and contains the reference number when present.
        *(Design Property 5.)* FAILS now.
    - `__tests__/pdf-export-helpers.unit.test.ts` (change-order slice):
      - **F4 suffix** — `changeOrderIdSuffix("")` and `changeOrderIdSuffix(undefined)` return `""`
        (no `"(ID: )"`). *(Design Property 6.)* FAILS now (returns `" (ID: )"`).
  - Run all of the above on the UNFIXED code.
  - **EXPECTED OUTCOME**: every assertion above FAILS (proves F1–F4 exist).
  - Document the counterexamples (e.g. `â€¢` present in source; `parseContractBody("• x")` →
    `paragraph`; `resolvePdfTemplateKey("sow", …)` → `"InvoicePDF"`; `changeOrderIdSuffix("")` → `" (ID: )"`).
  - Mark complete when tests are written, run, and the failures are documented.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Write preservation property tests (BEFORE any fix)
  - **Property 2: Preservation** — already-correct glyphs, `-` bullets, core-type templates/filenames,
    correct entry points, and parented change orders stay byte-for-byte identical.
  - **IMPORTANT**: Follow observation-first methodology — observe the UNFIXED output, then encode it.
  - Property-based testing is used deliberately: it samples the whole input domain (all document
    types, both bullet prefixes, present/absent parent IDs), giving strong "nothing broke" guarantees.
  - Add to the same test files (`{ numRuns: 100 }`):
    - `__tests__/pdf-contract-body-parser.property.test.ts`:
      - **`-` bullet preserved** — `parseContractBody("- " + text)` → `bullet` block `text`; non-bullet
        lines stay `paragraph`/`heading`. Observe on unfixed → PASSES. *(Design Property 7 / Req 3.2.)*
    - `__tests__/pdf-export-helpers.property.test.ts`:
      - **Core-type template preserved** — for `invoice`/`contract`/`quote`/`quotation`/`proposal`,
        `resolvePdfTemplateKey` returns the same key the current `documents/page.tsx` switch returns,
        and the `design.layout==="receipt"` path still yields `"ReceiptPDF"`. *(Design Property 8 / Req 3.4.)*
      - **Core-type filename preserved** — for a realistic invoice with `invoiceNumber` set,
        `resolveDocumentReference` returns `invoiceNumber` (matches today). *(Req 3.4.)*
    - `__tests__/pdf-export-helpers.unit.test.ts`:
      - **Parented change order preserved** — `changeOrderIdSuffix("CTR-1")` returns `" (ID: CTR-1)"`.
        *(Design Property 8 / Req 3.6.)*
    - `__tests__/pdf-export-glyphs.unit.test.ts`:
      - **Correct sibling escapes untouched** — source scan confirms the literal `•` at ~414, the
        `{"\u2022"}` at ~2136, and the string-literal `\u2014` escapes (~111, ~516–517, ~2263, and the
        `|| "\u2014"` fallbacks) are present and unchanged. *(Design Property 7 / Req 3.1, 3.3.)*
  - Run on the UNFIXED code.
  - **EXPECTED OUTCOME**: all preservation tests PASS (establishes the baseline to protect).
  - Mark complete when tests are written, run, and passing on unfixed code.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 4. Fix glyph & encoding defects in `lib/pdf-templates.tsx` (F1 & F2)

  Apply the `\uXXXX`-in-valid-position convention (Design decision A). Preserve every correct
  sibling glyph — especially the literal `•` at ~414.

  - [x] 4.1 Fix `parseContractBody` bullet-detection + strip regex (F1)
    - ~lines 1743–1746: `/^[-â€¢]\s+/` → `/^[-\u2022]\s+/` in BOTH the `.test(line)` and the
      `.replace(...)`. Restores real `•` detection while keeping `-`.
    - _Bug_Condition: isBugCondition(X), X.kind = "bulletDetectionRegex"_
    - _Expected_Behavior: result.detectsRealBullet = true (design Property 2)_
    - _Preservation: `-`-prefixed lines still detected (design Property 7)_
    - _Requirements: 2.2, 3.2_

  - [x] 4.2 Fix mojibake bullet markers in `ContractPDF`/`SOWPDF`/`NDAPDF` (F1)
    - `ContractPDF` parsed-body marker ~1829: `<Text …>â€¢</Text>` → `<Text …>{"\u2022"}</Text>`.
    - `SOWPDF` Assumptions marker ~2977: `â€¢` → `{"\u2022"}`.
    - `NDAPDF` Exclusions marker ~3272: `â€¢` → `{"\u2022"}`.
    - Do NOT touch `ItemRow`'s literal `•` at ~414.
    - _Bug_Condition: isBugCondition(X), X.kind = "bulletGlyph", template ∈ {ContractPDF, SOWPDF, NDAPDF}_
    - _Expected_Behavior: result.marker = "\u2022"; source has no `â€¢` (design Property 1)_
    - _Preservation: line 414 literal `•` unchanged (design Property 7)_
    - _Requirements: 2.1, 3.1_

  - [x] 4.3 Fix the six raw-JSX `\uXXXX` escape text nodes (F2)
    - `ProposalPDF` budget row ~2271: `>\u2022<` → `>{"\u2022"}<`.
    - `InvoicePDF`/`PaymentSection` partial-payment note ~206: render the dash via `{"\u2014"}`
      (e.g. `{"Partial payment received \u2014 balance still due"}`).
    - `ContractPDF` party labels ~1784 / ~1790: `Party A \u2014 Provider` / `Party B \u2014 Client`
      → string-expression form `{"Party A \u2014 Provider"}` / `{"Party B \u2014 Client"}`.
    - `PaymentReceiptPDF` subtitle ~2740 and footer ~2823: correct ONLY the `\u2014` escape to a
      string expression; wording stays identical ("Clorefy — AI Document Platform" / "Clorefy — clorefy.com").
    - _Bug_Condition: isBugCondition(X), X.kind = "rawJsxEscape" at the six named locations_
    - _Expected_Behavior: renders intended glyph; text has no literal `\u2022`/`\u2014` (design Property 3)_
    - _Preservation: branding wording unchanged; correct sibling escapes untouched (Req 3.3, 3.7)_
    - _Requirements: 2.3, 3.3, 3.7_

  - [x] 4.4 Preservation check after glyph fixes
    - Re-run the task 3 preservation tests + the sibling-escape source scan. Confirm `-` detection,
      line 414 literal, `{"\u2022"}` at 2136, and all string-literal `\u2014` escapes are unchanged.
    - _Requirements: 3.1, 3.2, 3.3, 3.7_

- [x] 5. Fix `ChangeOrderPDF` empty parenthetical using `changeOrderIdSuffix` (F4)

  - [x] 5.1 Harden `changeOrderIdSuffix` and wire it into the reference block
    - Update `changeOrderIdSuffix` (added in 1.3) to its FIXED form:
      `return parentDocumentId && parentDocumentId.trim().length > 0 ? \` (ID: ${parentDocumentId})\` : ""`.
    - `ChangeOrderPDF` reference block ~3059–3068: replace `{" "}(ID: {data.parentDocumentId})`
      with `{changeOrderIdSuffix(data.parentDocumentId)}`, keeping the "This change order amends
      <bold>{Type}</bold>" sentence. Mirrors the guarded `{data.parentDocumentType && …}` at ~3033.
    - _Bug_Condition: isBugCondition(X), X.kind = "changeOrderReferenceBlock", parentDocumentId empty/undefined_
    - _Expected_Behavior: result.text does NOT contain "(ID: )" (design Property 6)_
    - _Preservation: populated parentDocumentId still renders " (ID: <id>)" (design Property 8)_
    - _Requirements: 2.6, 3.6_

  - [x] 5.2 Preservation check for parented change orders
    - Confirm `changeOrderIdSuffix("CTR-1")` → `" (ID: CTR-1)"` and the rendered sentence for a
      parented change order is identical to today.
    - _Requirements: 3.6_

- [x] 6. Fix the template/filename resolver and adopt it in the four entry points (F3)

  - [x] 6.1 Complete the resolver in `lib/pdf-export-helpers.ts`
    - Extend `resolvePdfTemplateKey` with the missing cases: `sow→"SOWPDF"`,
      `change_order→"ChangeOrderPDF"`, `nda→"NDAPDF"`, `client_onboarding_form→"ClientOnboardingFormPDF"`,
      `payment_followup→"PaymentFollowupPDF"`, `receipt→"ReceiptPDF"`. Keep the core branches and the
      invoice/receipt-layout default EXACTLY as-is (modeled on `pdf-download-button.tsx`).
    - Fix `resolveDocumentReference`: invoice/receipt → `invoiceNumber || referenceNumber || <typeDefault>`;
      all other types → `referenceNumber || invoiceNumber || <typeDefault>`. Add the `<typeDefault>`
      map (`sow→"sow"`, `change_order→"change-order"`, `nda→"nda"`, `client_onboarding_form→…`, etc.).
    - Ensure `labelPrefix` in `buildPdfFilename` derives from `getDocumentTypeConfig(documentType)?.label`
      (matches `pdf-download-button.tsx`).
    - _Bug_Condition: isBugCondition(X), X.kind = "pdfDownload", non-core documentType_
    - _Expected_Behavior: correct templateKey per type; filename has no "invoice", contains ref (design Props 4, 5)_
    - _Preservation: core-type key + filename identical to today (design Property 8)_
    - _Requirements: 2.4, 2.5, 3.4_

  - [x] 6.2 Adopt helpers in `app/documents/page.tsx` (`downloadDocument`, ~1577–1588)
    - Replace the 4-case `switch` with `resolvePdfComponent(templates, docType, cleanedData)`; set
      `filePrefix` from `resolveDocumentReference(cleanedData, docType)`. Keep the existing
      signature-image loading and the `${filePrefix}_${YYYY-MM-DD}.pdf` format.
    - **Verify after this file only**: download a core invoice + contract (unchanged template/filename)
      AND an SOW/NDA (now correct template + reference-based filename).
    - _Bug_Condition / _Expected_Behavior / _Preservation: as 6.1_
    - _Requirements: 2.4, 2.5, 3.4_

  - [x] 6.3 Adopt helpers in `components/share-button.tsx` (`generatePdfBlob` + `getFileName`)
    - `generatePdfBlob` uses `resolvePdfComponent`; `getFileName` uses `resolveDocumentReference` for
      the `ref` segment, keeping its existing `${type}-${safe}.pdf` shape.
    - **Verify after this file only**: share menu produces correct template + non-"invoice" filename
      for a non-core type; core types unchanged.
    - _Requirements: 2.4, 2.5, 3.4_

  - [x] 6.4 Adopt helpers in `app/view/[sessionId]/page.tsx` (`buildPdfBlob` + `handleDownload`)
    - `buildPdfBlob` uses `resolvePdfComponent`; `handleDownload`'s `a.download` uses
      `resolveDocumentReference`. Preserve the `payment.status==="paid"` `{ ...docData, status:"paid" }`
      behavior and the QR logic.
    - **Verify after this file only**: shared view download of a non-core type is correct; core unchanged.
    - _Requirements: 2.4, 2.5, 3.4_

  - [x] 6.5 Adopt helper in `app/pay/[sessionId]/pay-document-view.tsx` (`buildPdfBlob`, ~52–64)
    - Use `resolvePdfComponent` so the switch is structurally complete. NO filename change (view-only,
      per 1.5). Do NOT alter QR/response/polling behavior.
    - **Verify after this file only**: pay page still renders payable core types identically; non-core
      types now map to their real template.
    - _Requirements: 2.4, 3.4_

  - [x] 6.6 Confirm the two correct entry points are untouched
    - Verify `components/pdf-download-button.tsx` and `components/document-preview.tsx` have NO diffs.
      They remain the behavioral reference, not a target (Req 3.5).
    - _Requirements: 3.5_

- [x] 7. Verify bug condition exploration tests now pass
  - **Property 1: Expected Behavior** — PDF export formatting defects resolved (F1–F4)
  - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests.
  - Run every exploration test/file authored in task 2 against the FIXED code.
  - **EXPECTED OUTCOME**: all pass — no `â€¢` mojibake, no raw `\u2022`/`\u2014` text nodes, `•` lines
    detected as bullets, correct template key for all non-core types, filenames free of "invoice"
    and containing the reference, and `changeOrderIdSuffix("")` → `""`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 8. Verify preservation tests still pass
  - **Property 2: Preservation** — nothing that already worked has changed
  - **IMPORTANT**: Re-run the SAME tests from task 3 — do NOT write new tests.
  - **EXPECTED OUTCOME**: all pass — `-` bullets still detected, correct sibling glyphs unchanged,
    core-type templates/filenames identical, parented change orders identical, and the two correct
    entry points unmodified.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 9. Checkpoint — full verification gate
  - Run `pnpm lint` (must pass) and the full **vitest** suite including all new property/unit files
    (must be green).
  - Manual re-export smoke test of the five sample document types — **Client Onboarding Form,
    Change Order, NDA, SOW, Proposal** — from each of the four entry points, verifying: correct
    bullets (`•`), correct em-dashes (`—`), correct per-type template, reference-number-based
    filenames (no "invoice"), and no dangling "(ID: )" on a standalone change order.
  - Confirm a core-type export (invoice, contract) from the same entry points is unchanged.
  - Ask the user if any questions arise.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "description": "Extract testability seams from unfixed code (no behavior change)",
      "tasks": ["1", "1.1", "1.2", "1.3", "1.4"]
    },
    {
      "wave": 2,
      "description": "Property 1 bug-condition exploration tests — MUST FAIL on unfixed code",
      "tasks": ["2"]
    },
    {
      "wave": 3,
      "description": "Property 2 preservation tests — MUST PASS on unfixed code",
      "tasks": ["3"]
    },
    {
      "wave": 4,
      "description": "Independent surgical fixes: glyphs/encoding (F1,F2), change order (F4), resolver + one-at-a-time entry-point adoption (F3)",
      "tasks": ["4", "4.1", "4.2", "4.3", "4.4", "5", "5.1", "5.2", "6", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6"]
    },
    {
      "wave": 5,
      "description": "Re-run Property 1 (now passes) and Property 2 (still passes)",
      "tasks": ["7", "8"]
    },
    {
      "wave": 6,
      "description": "Checkpoint — pnpm lint + full vitest suite + manual smoke test",
      "tasks": ["9"]
    }
  ]
}
```

```
1. Extract testability seams (unfixed)
   ├─ 1.1 create pdf-export-helpers.ts (buggy resolver)
   ├─ 1.2 export parseContractBody (unchanged)
   ├─ 1.3 export changeOrderIdSuffix (unconditional)
   └─ 1.4 lint / no-behavior-change check
        │
        ▼
2. Property 1: Bug Condition exploration tests  ── MUST FAIL on unfixed code
        │
        ▼
3. Property 2: Preservation tests               ── MUST PASS on unfixed code
        │
        ├────────────────────────────┬───────────────────────────┐
        ▼                            ▼                           ▼
4. Fix glyphs/encoding (F1,F2)   5. Fix ChangeOrder (F4)     6. Fix resolver + adopt (F3)
   ├─ 4.1 parseContractBody re     ├─ 5.1 changeOrderIdSuffix   ├─ 6.1 complete resolver
   ├─ 4.2 mojibake markers         │       + wire into PDF       ├─ 6.2 documents/page.tsx
   ├─ 4.3 six raw-JSX escapes      └─ 5.2 preservation check     ├─ 6.3 share-button.tsx
   └─ 4.4 preservation check                                     ├─ 6.4 view/[sessionId]/page.tsx
                                                                 ├─ 6.5 pay/[sessionId]/…view.tsx
                                                                 └─ 6.6 confirm 2 correct entry pts untouched
        │                            │                           │
        └────────────────────────────┴───────────────────────────┘
                                     ▼
7. Property 1: Expected Behavior  (re-run task 2 → now PASS)
                                     ▼
8. Property 2: Preservation       (re-run task 3 → still PASS)
                                     ▼
9. Checkpoint — pnpm lint + full vitest suite + manual smoke test
```

## Notes

- Tasks 4, 5, and 6 are independent of each other and may be done in any order after task 3; they
  all depend on the seams (task 1) and the tests (tasks 2–3) existing.
- Within task 6, sub-tasks 6.2–6.5 adopt the shared helper **one entry point at a time**, each with
  its own verify step, so a regression is isolated to a single file.
- `components/pdf-download-button.tsx` and `components/document-preview.tsx` are intentionally NOT
  modified (Requirement 3.5) — they are the behavioral reference for the shared helper.
- Tests use the existing stack: **vitest + fast-check**, files under `__tests__/`, naming
  `*.property.test.ts` / `*.unit.test.ts`, `{ numRuns: 100 }`.
- The verification gate (task 9) is the definition of done: `pnpm lint` green, full vitest suite
  green, and the manual re-export smoke test showing correct bullets, em-dashes, per-type templates,
  reference-based filenames, and no dangling "(ID: )".
