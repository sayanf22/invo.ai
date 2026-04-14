# Design Document: Country-Compliant Document Generation

## Overview

This feature extends the existing `DUAL_MODE_SYSTEM_PROMPT` and `buildPrompt()` function in `lib/deepseek.ts` to provide comprehensive, state/province/region-level tax and legal compliance for all 11 supported countries across all 4 document types (Invoice, Quotation, Contract, Proposal).

The entire implementation is a single-file change. No new files, no database migrations, no API route changes. The AI model (DeepSeek) already receives the business profile via `buildPrompt()` and already has a `COUNTRY-SPECIFIC COMPLIANCE` section in the system prompt. This design replaces that section with a far more detailed version and enhances `buildPrompt()` to inject an explicit `TAX_REGISTRATION_STATUS` block.

### Goals

- Correct tax labels and rates at the state/province/emirate level for all 11 countries
- Mandatory compliance fields (GSTIN, ABN, TRN, SIRET, KvK, etc.) always present when registered
- Threshold-awareness notes for unregistered businesses in every country
- Clarification questions that never block document generation (at most 1 per response)
- Country-specific contract legal references and jurisdiction clauses
- Correct local document titles for quotations (Angebot, Devis, Offerte)

---

## Architecture

The system is a single AI prompt pipeline:

```
User Prompt
    │
    ▼
buildPrompt()  ──────────────────────────────────────────────────────────────────┐
  • CURRENT DATE                                                                  │
  • DOCUMENT TYPE                                                                 │
  • BUSINESS PROFILE (from Supabase, injected server-side)                       │
  • TAX_REGISTRATION_STATUS block  ◄── NEW: explicit registration summary        │
  • BUSINESS SERVICES & PRICING INFO                                              │
  • CONVERSATION HISTORY                                                          │
  • EXISTING DOCUMENT DATA                                                        │
  • PARENT CONTEXT                                                                │
  • USER'S MESSAGE                                                                │
    │                                                                             │
    ▼                                                                             │
DUAL_MODE_SYSTEM_PROMPT  ◄───────────────────────────────────────────────────────┘
  • Response mode detection
  • Conversational behavior
  • Document generation behavior (math, content rules, etc.)
  • COUNTRY-SPECIFIC COMPLIANCE  ◄── REPLACED: expanded with state/province rules
  • Document schemas
  • Output format
    │
    ▼
DeepSeek API (deepseek-chat, temperature 0.3)
    │
    ▼
{ "document": {...}, "message": "..." }
```

The `app/api/ai/stream/route.ts` route is unchanged — it fetches the business profile server-side and passes it to `streamGenerateDocument()`, which calls `buildPrompt()` and sends the result to DeepSeek.

---

## Components and Interfaces

### 1. `DUAL_MODE_SYSTEM_PROMPT` — Compliance Section Replacement

The existing `## COUNTRY-SPECIFIC COMPLIANCE` section (covering ~60 lines) is replaced with a new `## COUNTRY-SPECIFIC COMPLIANCE` section of approximately 300–400 lines. The new section is organized into clearly delimited country blocks using a consistent structure:

```
### [COUNTRY_CODE] — [Country Name]
**Tax System:** ...
**Registered — Tax Rate & Label:** ...
**Registered — Mandatory Fields:** ...
**Registered — Document Notes Must Include:** ...
**Registered — Clarification Questions (priority order):** ...
**Unregistered — Tax Rate:** taxRate: 0
**Unregistered — Document Notes Must Include:** ...
**Unregistered — Threshold Note (message only):** ...
**Invoice Numbering:** ...
**Quotation Title:** ...
**Contract References:** ...
```

This structure ensures the AI can reliably parse and apply rules for any country × registration status × document type combination without ambiguity.

#### Clarification Question Priority Order

The AI must ask at most 1 clarification question per response (Requirement 15.4). When multiple fields are missing, the AI follows this priority order per country:

| Country | Priority 1 | Priority 2 | Priority 3 |
|---------|-----------|-----------|-----------|
| IN | Intra/inter-state (determines CGST+SGST vs IGST) | HSN/SAC code | — |
| US | Client state (determines tax rate) | Explicit rate confirmation | — |
| GB | Client VAT number (B2B) | EU client reverse charge | — |
| DE | EU B2B confirmation | — | — |
| CA | Client province (determines HST/GST+PST/QST) | QST registration (QC only) | — |
| AU | Buyer ABN (invoices ≥ AUD $1,000) | — | — |
| SG | Client GST number (B2B) | — | — |
| AE | Emirate (free zone treatment) | Client TRN (B2B > AED 10,000) | — |
| PH | Client TIN | — | — |
| FR | EU VAT number (B2B) | — | — |
| NL | EU VAT number (B2B) | — | — |

The priority order is encoded directly in the system prompt instructions for each country block.

### 2. `buildPrompt()` — TAX_REGISTRATION_STATUS Block

A new `TAX_REGISTRATION_STATUS` block is injected into the prompt immediately after the `BUSINESS PROFILE` block. This block explicitly summarizes the business's tax registration status, their tax IDs, and their country — removing any ambiguity the AI might have from inferring registration status from scattered fields.

**Format injected into prompt:**

```
TAX_REGISTRATION_STATUS:
- Country: IN
- Registered: YES
- Tax IDs: {"gstin": "27AABCU9603R1ZX"}
- Apply Rule: REGISTERED — use CGST+SGST or IGST, include GSTIN in fromTaxId, ask intra/inter-state if unknown
```

Or for unregistered:

```
TAX_REGISTRATION_STATUS:
- Country: IN
- Registered: NO
- Tax IDs: none
- Apply Rule: UNREGISTERED — set taxRate=0, include threshold note in message only
```

This block is generated by `buildPrompt()` from the existing `businessContext.taxRegistered`, `businessContext.taxIds`, and `businessContext.country` fields — no new data is needed.

### 3. Threshold Note Injection

Threshold notes are instructed to appear **only in the `message` field**, never in any document field. The system prompt explicitly states:

> "THRESHOLD NOTES: Include threshold notes ONLY in the `message` field. NEVER include threshold note text in `notes`, `terms`, `description`, or any item field. Threshold notes are informational messages for the user, not document content."

This is reinforced by the existing `## CRITICAL: DOCUMENT CONTENT RULES` section which already prohibits meta-commentary in document fields.

---

## Data Models

No new data models are introduced. The feature operates entirely within the existing `AIGenerationRequest` and `AIGenerationResponse` interfaces, and the existing `InvoiceData` type.

### Relevant Existing Fields

```typescript
// AIGenerationRequest.businessContext
businessContext?: {
    country?: string          // ISO code: "IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"
    taxRegistered?: boolean   // true = registered, false/undefined = not registered
    taxIds?: Record<string, string>  // e.g. { gstin: "...", pan: "..." }
    // ... other fields unchanged
}

// InvoiceData (output) — relevant compliance fields
taxRate: number              // 0 for unregistered, country-specific rate for registered
taxLabel: string             // "GST", "CGST+SGST", "IGST", "VAT", "USt", "TVA", "BTW", "HST", etc.
fromTaxId: string            // GSTIN, ABN, TRN, SIRET, BTW-nummer, etc.
toTaxId: string              // Client's tax ID when applicable
notes: string                // Compliance notes (ABN display, VAT Reg No, Leistungsdatum, etc.)
invoiceNumber: string        // Country-specific format (INV/2025-26/001, RE-2025-001, FACT-2025-001)
```

### Country-to-Tax-Rate Mapping (encoded in system prompt)

| Country | Registered Rate | Label | Unregistered Rate | Threshold |
|---------|----------------|-------|-------------------|-----------|
| IN | 18% (default) | CGST+SGST / IGST | 0% | Rs. 20L / Rs. 10L |
| US | State-specific | Sales Tax | 0% | $100K / 200 txns |
| GB | 20% | VAT | 0% | £90,000 |
| DE | 19% | USt | 0% | EUR 22,000 |
| CA | Province-specific | HST / GST+PST / GST+QST | 0% | CAD $30,000 |
| AU | 10% | GST | 0% | AUD $75,000 |
| SG | 9% | GST | 0% | SGD $1,000,000 |
| AE | 5% | VAT | 0% | AED 375,000 |
| PH | 12% | VAT | 0% | PHP 3,000,000 |
| FR | 20% | TVA | 0% | EUR 36,800 (svc) |
| NL | 21% | BTW | 0% | EUR 20,000 |

### US State Sales Tax Rates (encoded in system prompt)

Full table of 50 states + DC with base rates. Zero-tax states (OR, NH, MT, DE, AK) explicitly listed. Any unlisted state defaults to 0% with a note to verify.

### Canadian Province Tax Rates (encoded in system prompt)

| Province | Tax Type | Rate |
|----------|----------|------|
| ON | HST | 13% |
| NB, NS, PE, NL | HST | 15% |
| AB, YT, NT, NU | GST | 5% |
| BC | GST+PST | 12% (5%+7%) |
| SK | GST+PST | 11% (5%+6%) |
| MB | GST+PST | 12% (5%+7%) |
| QC | GST+QST | 14.975% (5%+9.975%) |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Indian GST tax label correctness

*For any* Indian GST-registered business, the generated invoice's `taxLabel` must be either "CGST+SGST" (when the supply is intra-state) or "IGST" (when the supply is inter-state) — never plain "GST" or any other value.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: Indian unregistered business produces zero tax

*For any* Indian business that is NOT tax-registered, the generated document must have `taxRate = 0`, and the `message` field must contain the GST registration threshold (Rs. 20 lakh / Rs. 10 lakh for special category states).

**Validates: Requirements 1.8, 14.1**

---

### Property 3: US state tax rate correctness

*For any* US invoice where the client state is known, the `taxRate` in the generated document must exactly match the base state sales tax rate for that state as defined in the compliance table (e.g., CA=7.25, TX=6.25, OR=0, NH=0).

**Validates: Requirements 2.2, 2.3, 2.4**

---

### Property 4: Canadian province tax rate correctness

*For any* Canadian invoice where the client province is known, the `taxRate` in the generated document must exactly match the combined provincial tax rate for that province (e.g., ON=13, QC=14.975, AB=5, BC=12).

**Validates: Requirements 5.2, 5.3**

---

### Property 5: Tax-registered businesses always have fromTaxId populated

*For any* tax-registered business in any of the 11 supported countries, the generated document must have a non-empty `fromTaxId` field containing the appropriate tax identifier (GSTIN for India, ABN for Australia, TRN for UAE, SIRET for France, BTW-nummer for Netherlands, etc.).

**Validates: Requirements 1.5, 3.2, 4.2, 5.4, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2**

---

### Property 6: Unregistered businesses always produce zero tax rate

*For any* business in any of the 11 supported countries that is NOT tax-registered, the generated document must have `taxRate = 0`, regardless of document type (invoice, quotation, contract, proposal).

**Validates: Requirements 1.8, 3.6, 4.8, 5.5, 6.6, 7.7, 8.7, 9.7, 10.7, 11.7, 13.4**

---

### Property 7: Threshold notes never appear in document fields

*For any* unregistered business in any of the 11 supported countries, the threshold note text must appear only in the `message` field and must NOT appear in any document field (`notes`, `terms`, `description`, or any item's `description`).

**Validates: Requirements 14.12, 15.3**

---

### Property 8: Clarification questions never block document generation

*For any* document generation request where required compliance information is missing (client state, province, emirate, TIN, HSN code, etc.), the AI response must always contain a valid `document` object with all required fields populated using reasonable defaults, in addition to the clarification question in `message`.

**Validates: Requirements 15.1, 15.2**

---

### Property 9: At most one clarification question per response

*For any* document generation request, the `message` field must contain at most one clarification question, even when multiple compliance fields are missing simultaneously.

**Validates: Requirement 15.4**

---

### Property 10: Quotation validity period is always 30 days

*For any* generated quotation, the `dueDate` must be exactly 30 days after `invoiceDate`, and the `notes` field must contain a statement about the 30-day validity period, unless the user explicitly specifies a different validity period.

**Validates: Requirements 13.1, 13.2**

---

### Property 11: Country-specific quotation titles in notes

*For any* quotation generated for Germany, France, or Netherlands, the document `notes` must contain the correct local title ("Angebot" for DE, "Devis" for FR, "Offerte" for NL).

**Validates: Requirement 13.5**

---

### Property 12: Contract legal references match country

*For any* contract generated for one of the 11 supported countries, the document `description` must contain the correct country-specific legal act reference (e.g., "Indian Contract Act 1872" for IN, "BGB" for DE, "Code Civil" for FR, "Burgerlijk Wetboek" for NL, "UAE Civil Code" for AE).

**Validates: Requirements 12.1–12.11**

---

### Property 13: Australian ABN always appears in notes

*For any* Australian invoice or quotation, regardless of GST registration status, the document `notes` must contain "ABN:" followed by the business's ABN number.

**Validates: Requirements 6.2, 6.7**

---

### Property 14: German Kleinunternehmer note for unregistered businesses

*For any* German business that is NOT tax-registered, the document `notes` must contain the text "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet".

**Validates: Requirement 4.8**

---

### Property 15: French unregistered businesses include TVA exemption note

*For any* French business that is NOT tax-registered, the document `notes` must contain "TVA non applicable, art. 293 B du CGI".

**Validates: Requirement 10.7**

---

### Property 16: Dutch unregistered businesses include KOR exemption note

*For any* Dutch business that is NOT tax-registered, the document `notes` must contain the KOR exemption text ("Vrijgesteld van BTW op grond van de kleineondernemersregeling").

**Validates: Requirement 11.7**

---

### Property 17: Clarification questions and threshold notes never appear in document fields

*For any* generated document, no document field (`notes`, `terms`, `description`, or any item's `description`) must contain text that is a clarification question directed at the user or a threshold registration warning.

**Validates: Requirements 15.3, 14.12**

*Note: This property consolidates and strengthens Properties 7 and 8 by covering both threshold notes and clarification questions across all document fields.*

---

## Error Handling

Since this feature is entirely prompt-based, "errors" manifest as incorrect AI outputs rather than thrown exceptions. The design addresses this through:

### Prompt Robustness

1. **Explicit fallback instructions** — Each country block ends with: "If any required field is missing from the business profile, use an empty string `""` rather than a placeholder like `[to be filled]`."

2. **Unknown country fallback** — The system prompt retains the existing rule: "If country cannot be determined or is not one of the 11 supported countries, default to no tax (taxRate: 0) and ask in your message."

3. **Conflicting signals** — The `TAX_REGISTRATION_STATUS` block in `buildPrompt()` acts as the single source of truth, preventing the AI from re-inferring registration status from scattered fields and potentially getting it wrong.

4. **Missing tax IDs** — If `taxRegistered: true` but `taxIds` is empty or missing, the `TAX_REGISTRATION_STATUS` block will reflect this, and the system prompt instructs the AI to set `fromTaxId: ""` and ask for the tax ID in `message`.

### Graceful Degradation

- If the AI cannot determine intra/inter-state for India: default to IGST (safer for compliance) and ask in message
- If the AI cannot determine US client state: default to taxRate 0 and ask in message
- If the AI cannot determine Canadian province: default to GST 5% and ask in message
- These defaults are encoded in the system prompt per country block

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are used. Unit tests cover specific examples and edge cases; property tests verify universal correctness across many generated inputs.

### Property-Based Testing

Property-based testing is applicable here because:
- The compliance logic is a pure function of (country, taxRegistered, taxIds, documentType, prompt) → document fields
- Input variation (different countries, registration statuses, document types, missing fields) reveals edge cases
- 100+ iterations can catch subtle prompt instruction failures

**Library:** `fast-check` (TypeScript PBT library, already compatible with the Next.js/TypeScript stack)

**Configuration:** Minimum 100 iterations per property test.

**Tag format:** `// Feature: country-compliant-document-generation, Property N: <property_text>`

Since the AI is non-deterministic, property tests for this feature work by:
1. Constructing a `buildPrompt()` output (the user-context string) with known inputs
2. Verifying the prompt contains the correct `TAX_REGISTRATION_STATUS` block (pure function, fully testable)
3. For AI output properties: using a mock/stub of the DeepSeek API that returns a deterministic response based on the prompt, then asserting the response fields

The `buildPrompt()` function itself is a pure function and can be tested directly without mocking.

### Unit Tests

Unit tests cover:
- `buildPrompt()` output for each country × registration status combination
- `TAX_REGISTRATION_STATUS` block format and content
- Specific examples: Indian intra-state invoice, Canadian Quebec invoice, German Kleinunternehmer quotation, UAE B2B invoice above AED 10,000
- Edge cases: missing tax IDs with `taxRegistered: true`, unknown country code, all zero-tax US states

### Integration Tests

Integration tests (1-3 examples each) cover:
- End-to-end document generation for each of the 11 countries (smoke test that the AI returns valid JSON)
- Backward compatibility: existing document types and countries continue to work after the prompt update

### Test File Location

`lib/__tests__/deepseek-compliance.test.ts` — unit and property tests for `buildPrompt()` and compliance logic.
