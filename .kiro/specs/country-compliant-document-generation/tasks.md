# Implementation Plan: Country-Compliant Document Generation

## Overview

All changes are confined to `lib/deepseek.ts`. The implementation enhances `buildPrompt()` with an explicit `TAX_REGISTRATION_STATUS` block and replaces the existing `## COUNTRY-SPECIFIC COMPLIANCE` section in `DUAL_MODE_SYSTEM_PROMPT` with a comprehensive, state/province/region-level version covering all 11 countries and all 4 document types.

## Tasks

- [x] 1. Enhance `buildPrompt()` with TAX_REGISTRATION_STATUS block
  - In `lib/deepseek.ts`, locate the `buildPrompt()` function
  - After the existing `BUSINESS PROFILE` block (after the `additionalNotes` section), inject a new `TAX_REGISTRATION_STATUS:` block
  - The block must include: `Country`, `Registered` (YES/NO), `Tax IDs` (from `businessContext.taxIds` or "none"), and `Apply Rule` (a one-line instruction summarising the correct compliance path for that country × registration status)
  - When `taxRegistered` is true and `taxIds` is empty/undefined, set Tax IDs to "none" and set Apply Rule to instruct the AI to set `fromTaxId: ""` and ask for the tax ID in `message`
  - When `businessContext` is absent or `country` is absent, omit the block entirely
  - _Requirements: 1.1–1.8, 2.1–2.6, 3.1–3.8, 4.1–4.8, 5.1–5.6, 6.1–6.7, 7.1–7.7, 8.1–8.8, 9.1–9.7, 10.1–10.8, 11.1–11.8_

- [x] 2. Replace COUNTRY-SPECIFIC COMPLIANCE — India (IN)
  - In `DUAL_MODE_SYSTEM_PROMPT`, replace the existing `### India` block inside `## COUNTRY-SPECIFIC COMPLIANCE` with the expanded IN block
  - Registered rules: CGST+SGST for intra-state, IGST for inter-state; default to IGST if unknown; include GSTIN in `fromTaxId`; ask intra/inter-state as Priority 1 clarification; ask HSN/SAC as Priority 2; include Place of Supply with two-digit state code in notes; use invoice numbering format INV/YYYY-YY/NNN; note e-way bill requirement when amount exceeds Rs. 50,000
  - Unregistered rules: taxRate 0; include Threshold_Note in `message` only (Rs. 20L / Rs. 10L for special category states)
  - Quotation: same tax rules; notes must include "Quotation" as title
  - Contract: description must reference "Indian Contract Act 1872"; include jurisdiction clause; note stamp duty
  - _Requirements: 1.1–1.8, 12.1, 13.1–13.4, 14.1_

- [x] 3. Replace COUNTRY-SPECIFIC COMPLIANCE — USA (US)
  - Replace the existing `### United States` block with the expanded US block
  - Registered rules: apply correct base state sales tax rate from the full 50-state + DC table; zero-tax states (OR, NH, MT, DE, AK) → taxRate 0, no tax line; taxLabel "Sales Tax"; ask client state as Priority 1 clarification; default to taxRate 0 if state unknown; note in `message` that most US states do not tax pure services
  - Unregistered rules: taxRate 0; Threshold_Note in `message` ($100K / 200 transactions economic nexus)
  - Contract: description must reference applicable US state law; include governing law and dispute resolution clauses
  - _Requirements: 2.1–2.6, 12.2, 13.1–13.4, 14.2_

- [x] 4. Replace COUNTRY-SPECIFIC COMPLIANCE — UK (GB)
  - Replace the existing `### United Kingdom` block with the expanded GB block
  - Registered rules: taxRate 20 (standard), 5 (reduced), 0 (zero-rated); taxLabel "VAT"; include VAT Reg No (GB + 9 digits) in `fromTaxId` and in notes as "VAT Reg No: [number]"; include Tax_Point in notes; show net/VAT/gross breakdown in notes; ask client VAT number (B2B) as Priority 1 clarification; note UK-to-EU reverse charge in `message` when client appears EU-based
  - Unregistered rules: taxRate 0; Threshold_Note in `message` (£90,000)
  - Contract: description must reference VAT Act 1994 and UK GDPR; include England & Wales jurisdiction clause
  - _Requirements: 3.1–3.8, 12.3, 13.1–13.4, 14.3_

- [x] 5. Replace COUNTRY-SPECIFIC COMPLIANCE — Germany (DE)
  - Replace the existing `### Germany` block with the expanded DE block
  - Registered rules: taxRate 19 (standard), 7 (reduced); taxLabel "USt"; include Steuernummer or USt-IdNr (DE + 9 digits) in `fromTaxId`; include Leistungsdatum in notes; use German labels in notes (Nettobetrag, Umsatzsteuer, Bruttobetrag); ask EU B2B confirmation as Priority 1 clarification; when EU B2B reverse charge confirmed → taxRate 0, include "Steuerschuldnerschaft des Leistungsempfängers" in notes; use sequential numbering RE-2025-001
  - Unregistered rules (Kleinunternehmer): taxRate 0; include "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet" in document notes; Threshold_Note in `message` (EUR 22,000)
  - Quotation: notes must include "Angebot" as local title
  - Contract: description must reference BGB and GDPR; German law governs
  - _Requirements: 4.1–4.8, 12.4, 13.1–13.6, 14.4_

- [x] 6. Replace COUNTRY-SPECIFIC COMPLIANCE — Canada (CA)
  - Replace the existing `### Canada` block with the expanded CA block
  - Registered rules: apply province-specific rates (ON HST 13%, NB/NS/PE/NL HST 15%, AB/YT/NT/NU GST 5%, BC GST+PST 12%, SK GST+PST 11%, MB GST+PST 12%, QC GST+QST 14.975%); include breakdown in notes for combined-rate provinces; include GST/HST BN (9 digits + RT0001) in `fromTaxId`; ask client province as Priority 1 clarification; default to GST 5% if province unknown; note QST registration separately for QC clients as Priority 2
  - Unregistered rules: taxRate 0; Threshold_Note in `message` (CAD $30,000)
  - Contract: description must reference applicable provincial law; note bilingual requirement for Quebec
  - _Requirements: 5.1–5.6, 12.5, 13.1–13.4, 14.5_

- [x] 7. Replace COUNTRY-SPECIFIC COMPLIANCE — Australia (AU)
  - Replace the existing `### Australia` block with the expanded AU block
  - Registered rules: taxRate 10; taxLabel "GST"; include ABN (11 digits) in `fromTaxId` and display as "ABN: XX XXX XXX XXX" in notes; include "Tax Invoice" in notes when amount ≥ AUD $82.50; ask buyer ABN as Priority 1 clarification when amount ≥ AUD $1,000; show amounts excl. GST / GST amount / total incl. GST in notes
  - Unregistered rules: taxRate 0; omit "Tax Invoice" label; always include "ABN: [number]" in notes regardless of registration; Threshold_Note in `message` (AUD $75,000)
  - Contract: description must reference applicable state/territory law and Australian Consumer Law
  - _Requirements: 6.1–6.7, 12.6, 13.1–13.4, 14.6_

- [x] 8. Replace COUNTRY-SPECIFIC COMPLIANCE — Singapore (SG)
  - Replace the existing `### Singapore` block with the expanded SG block
  - Registered rules: taxRate 9; taxLabel "GST"; include GST registration number in `fromTaxId` and UEN in notes; include "Tax Invoice" in notes; include supply date in notes; ask client GST number (B2B) as Priority 1 clarification; show amounts excl. GST / GST / total incl. GST in notes
  - Unregistered rules: taxRate 0; Threshold_Note in `message` (SGD $1,000,000)
  - Contract: description must reference Singapore contract law and PDPA
  - _Requirements: 7.1–7.7, 12.7, 13.1–13.4, 14.7_

- [x] 9. Replace COUNTRY-SPECIFIC COMPLIANCE — UAE (AE)
  - Replace the existing `### UAE` block with the expanded AE block
  - Registered rules: taxRate 5; taxLabel "VAT"; include TRN (15 digits) in `fromTaxId` and display as "TRN: [number]" in notes; include supply date in notes; include bilingual note in notes; show AED amounts with VAT separately in notes; ask emirate as Priority 1 clarification; ask client TRN (B2B > AED 10,000) as Priority 2
  - Unregistered rules: taxRate 0; Threshold_Note in `message` (AED 375,000 mandatory / AED 187,500 voluntary)
  - Contract: description must reference UAE Civil Code (Federal Law No. 5 of 1985); note Arabic version requirement; include emirate courts jurisdiction clause
  - _Requirements: 8.1–8.8, 12.8, 13.1–13.4, 14.8_

- [x] 10. Replace COUNTRY-SPECIFIC COMPLIANCE — Philippines (PH)
  - Replace the existing `### Philippines` block with the expanded PH block
  - Registered rules: taxRate 12; taxLabel "VAT"; include TIN (XXX-XXX-XXX-XXX) in `fromTaxId`; designate "VAT Invoice" in notes; include "BIR Permit No.: [to be filled]" in notes; ask client TIN as Priority 1 clarification; show amounts excl. VAT / VAT / total incl. VAT in notes
  - Unregistered rules: taxRate 0; designate "Non-VAT Invoice" in notes; Threshold_Note in `message` (PHP 3,000,000)
  - Contract: description must reference Civil Code of the Philippines; note notarization requirement; include jurisdiction clause
  - _Requirements: 9.1–9.7, 12.9, 13.1–13.4, 14.9_

- [x] 11. Replace COUNTRY-SPECIFIC COMPLIANCE — France (FR)
  - Replace the existing `### France` block with the expanded FR block
  - Registered rules: taxRate 20 (standard), 10 (reduced), 5.5 (super-reduced); taxLabel "TVA"; include SIRET (14 digits) in `fromTaxId` and display as "SIRET: [number]" in notes; include TVA intracommunautaire number in notes when available; use French labels in notes (Montant HT, TVA, Montant TTC); use sequential numbering FACT-2025-001; ask EU VAT number (B2B) as Priority 1 clarification; when EU B2B reverse charge → taxRate 0, include "Autoliquidation de TVA — Article 283 du CGI" in notes
  - Unregistered rules: taxRate 0; include "TVA non applicable, art. 293 B du CGI" in document notes; Threshold_Note in `message` (EUR 36,800 services / EUR 91,900 goods)
  - Quotation: notes must include "Devis" as local title
  - Contract: description must reference Code Civil and GDPR; French law governs; prefer French language
  - _Requirements: 10.1–10.8, 12.10, 13.1–13.5, 13.7, 14.10_

- [x] 12. Replace COUNTRY-SPECIFIC COMPLIANCE — Netherlands (NL)
  - Replace the existing `### Netherlands` block with the expanded NL block
  - Registered rules: taxRate 21 (standard), 9 (reduced); taxLabel "BTW"; include BTW-nummer (NL + 9 digits + B + 2 digits) in `fromTaxId`; include KvK number in notes as "KvK: [number]"; use Dutch labels in notes (Bedrag excl. BTW, BTW, Totaal incl. BTW); note invoice issuance deadline (15th of following month) in notes; ask EU VAT number (B2B) as Priority 1 clarification; when EU B2B reverse charge → taxRate 0, include "BTW verlegd" in notes
  - Unregistered rules (KOR): taxRate 0; include "Vrijgesteld van BTW op grond van de kleineondernemersregeling" in document notes; Threshold_Note in `message` (EUR 20,000)
  - Quotation: notes must include "Offerte" as local title
  - Contract: description must reference Burgerlijk Wetboek and GDPR; Dutch law governs
  - _Requirements: 11.1–11.8, 12.11, 13.1–13.5, 13.8, 14.11_

- [x] 13. Add clarification question priority rules and threshold note placement rules to system prompt
  - Add a `## CLARIFICATION QUESTION RULES` section to `DUAL_MODE_SYSTEM_PROMPT` (after the country compliance section)
  - Rules must state: generate a complete document with reasonable defaults first, then ask at most 1 clarification question in `message`; never refuse to generate due to missing compliance info; follow the per-country priority order table (IN: intra/inter-state → HSN/SAC; US: client state; GB: client VAT; DE: EU B2B; CA: province → QST; AU: buyer ABN ≥ $1,000; SG: client GST; AE: emirate → client TRN; PH: client TIN; FR: EU VAT; NL: EU VAT)
  - Add a `## THRESHOLD NOTE RULES` section: Threshold_Notes appear ONLY in `message`; NEVER in `notes`, `terms`, `description`, or any item field
  - _Requirements: 14.12, 15.1–15.5_

- [x] 14. Checkpoint — verify prompt structure integrity
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Write property-based tests for `buildPrompt()` in `lib/__tests__/deepseek-compliance.test.ts`
  - Create the test file; import `fast-check` and the (exported) `buildPrompt` function from `lib/deepseek.ts`
  - Export `buildPrompt` from `lib/deepseek.ts` if it is not already exported
  - [x] 15.1 Write property test for TAX_REGISTRATION_STATUS block — registered businesses
    - **Property 5: Tax-registered businesses always have fromTaxId populated**
    - Generate arbitrary `(country, taxIds)` pairs for all 11 supported countries; assert the prompt contains `Registered: YES` and the correct tax ID key/value
    - **Validates: Requirements 1.5, 3.2, 4.2, 5.4, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2**
  - [x] 15.2 Write property test for TAX_REGISTRATION_STATUS block — unregistered businesses
    - **Property 6: Unregistered businesses always produce zero tax rate**
    - Generate arbitrary `(country)` values for all 11 countries with `taxRegistered: false`; assert the prompt contains `Registered: NO` and `Apply Rule` instructs taxRate=0
    - **Validates: Requirements 1.8, 3.6, 4.8, 5.5, 6.6, 7.7, 8.7, 9.7, 10.7, 11.7, 13.4**
  - [x] 15.3 Write property test for TAX_REGISTRATION_STATUS block absent when no businessContext
    - Generate requests with no `businessContext`; assert the prompt does NOT contain `TAX_REGISTRATION_STATUS`
    - **Validates: Requirement 16.3**
  - _Requirements: 1.1–11.8, 16.1–16.5_

- [x] 16. Write unit tests for specific country examples in `lib/__tests__/deepseek-compliance.test.ts`
  - [x] 16.1 Unit test: Indian registered business — TAX_REGISTRATION_STATUS block format
    - Input: country "IN", taxRegistered true, taxIds `{ gstin: "27AABCU9603R1ZX" }`
    - Assert prompt contains `Country: IN`, `Registered: YES`, `Tax IDs: {"gstin":"27AABCU9603R1ZX"}`, and Apply Rule references CGST+SGST/IGST
    - **Validates: Requirements 1.2, 1.3, 1.5**
  - [x] 16.2 Unit test: Indian unregistered business — zero tax and threshold note instruction
    - Input: country "IN", taxRegistered false
    - Assert prompt contains `Registered: NO` and Apply Rule references taxRate=0 and threshold note
    - **Validates: Requirements 1.8, 14.1**
  - [x] 16.3 Unit test: Canadian Quebec registered business — province rate
    - Input: country "CA", taxRegistered true, taxIds `{ bn: "123456789RT0001" }`
    - Assert prompt contains `Registered: YES` and Apply Rule references QST/14.975%
    - **Validates: Requirements 5.2, 5.3**
  - [x] 16.4 Unit test: German Kleinunternehmer — unregistered note instruction
    - Input: country "DE", taxRegistered false
    - Assert prompt contains `Registered: NO` and Apply Rule references § 19 UStG
    - **Validates: Requirement 4.8**
  - [x] 16.5 Unit test: UAE registered business — TRN and emirate clarification
    - Input: country "AE", taxRegistered true, taxIds `{ trn: "100123456700003" }`
    - Assert prompt contains `Registered: YES` and Apply Rule references TRN and emirate clarification
    - **Validates: Requirements 8.2, 8.8**
  - [x] 16.6 Unit test: Australian registered business — ABN formatting
    - Input: country "AU", taxRegistered true, taxIds `{ abn: "51824753556" }`
    - Assert prompt contains `Registered: YES` and Apply Rule references ABN display format
    - **Validates: Requirements 6.2, 6.7**
  - [x] 16.7 Unit test: US business with no client state — default to zero tax
    - Input: country "US", taxRegistered true, taxIds `{ ein: "12-3456789" }`
    - Assert prompt contains Apply Rule that defaults to taxRate=0 when state unknown
    - **Validates: Requirements 2.1, 2.3**
  - [x] 16.8 Unit test: registered business with missing taxIds — ask for tax ID
    - Input: country "GB", taxRegistered true, taxIds `{}`
    - Assert prompt contains `Tax IDs: none` and Apply Rule instructs AI to set `fromTaxId: ""` and ask in message
    - **Validates: Requirements 3.2, 15.1**
  - _Requirements: 1.1–11.8, 15.1–15.5, 16.1–16.5_

- [x] 17. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tasks 2–12 each replace one country block; they are independent and can be done in any order
- `buildPrompt()` must be exported (or have a named export) for the test file to import it directly
- Property tests use `fast-check` with a minimum of 100 iterations per property
- All threshold notes must appear only in the `message` field — never in any document field
- The `TAX_REGISTRATION_STATUS` block is the single source of truth for registration status, overriding any inference the AI might make from scattered profile fields
