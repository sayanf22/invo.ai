# Implementation Plan: Service Business Document Workflow

## Overview

This plan implements the expansion of Clorefy from 4 document types to 10, covering the full client-work lifecycle for service businesses. The implementation follows a registry-driven architecture where a centralized document type registry serves as the single source of truth, and all existing modules are extended via this registry. The approach is incremental: core registry first, then tier/classification updates, then schemas, then UI/PDF/export extensions.

## Tasks

- [x] 1. Create centralized document type registry
  - [x] 1.1 Create `lib/document-type-registry.ts` with `ALL_DOCUMENT_TYPES` constant, `DocumentType` type, `DocumentTypeConfig` interface, and `DOCUMENT_TYPE_REGISTRY` record mapping all 10 types to their metadata (label, icon, color, bgColor, description, capabilities)
    - Define `normalizeDocumentType(type: string): DocumentType | null` that maps "quotation" → "quote" and validates all 10 types
    - Define `getDocumentTypeLabel(type: string): string` for display labels
    - Define `getDocumentTypeConfig(type: string): DocumentTypeConfig | null` for full config lookup
    - Set `validParentTypes` for each type (SOW → contract; Change Order → sow, contract; Payment Follow-up → invoice)
    - Set capabilities: `supports_signature` true for contract, nda, sow, change_order only; `supports_payment_link` true for invoice, recurring_invoice only
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test: Type normalization consistency (Property 1)
    - **Property 1: Type normalization consistency**
    - For any string input, `normalizeDocumentType` returns a valid DocumentType or null; "quotation" always returns "quote"; normalization is idempotent
    - **Validates: Requirements 1.3, 16.1, 16.2, 16.5**

  - [x] 1.3 Write property test: Registry completeness (Property 2)
    - **Property 2: Registry completeness**
    - For any type in ALL_DOCUMENT_TYPES, `getDocumentTypeConfig(type)` returns non-null with all required fields populated
    - **Validates: Requirements 1.4, 1.5**

  - [x] 1.4 Write property test: Signature capability correctness (Property 8)
    - **Property 8: Signature capability correctness**
    - For any type in ALL_DOCUMENT_TYPES, `supports_signature` is true iff type is in {"contract", "nda", "sow", "change_order"}
    - **Validates: Requirements 6.1, 6.5**

  - [x] 1.5 Write property test: Payment link capability correctness (Property 12)
    - **Property 12: Payment link capability correctness**
    - For any type in ALL_DOCUMENT_TYPES, `supports_payment_link` is true iff type is in {"invoice", "recurring_invoice"}
    - **Validates: Requirements 14.1, 14.2**

  - [x] 1.6 Write property test: Document linking parent validation (Property 9)
    - **Property 9: Document linking parent validation**
    - For any child/parent type pair, linking is allowed iff parent is in `validParentTypes` for that child
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 2. Update tier access control
  - [x] 2.1 Update `TIER_LIMITS` in `lib/cost-protection.ts` to set Free tier `allowedDocTypes` to `["invoice", "contract", "quote"]` and Starter/Pro/Agency to all 10 types
    - Import `ALL_DOCUMENT_TYPES` from the registry
    - Ensure `checkDocumentTypeAllowed()` function signature remains unchanged
    - Handle "quotation" → "quote" normalization before tier check via `normalizeDocumentType`
    - **Invoice invariant**: Add a short-circuit at the top of `checkDocumentTypeAllowed` that returns `null` (allowed) immediately when the normalized type is `"invoice"`, before consulting `allowedDocTypes`. This ensures `invoice` can never be denied by configuration drift.
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

  - [x] 2.2 Write property test: Tier access control enforcement (Property 3)
    - **Property 3: Tier access control enforcement**
    - For any (documentType, userTier) pair, `checkDocumentTypeAllowed` returns null when type normalizes to `"invoice"` (invoice invariant, independent of tier), OR when the type is in that tier's `allowedDocTypes`. Otherwise returns 403. The invoice invariant takes precedence.
    - **Validates: Requirements 2.1, 2.2**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend intent classifier and mismatch detection
  - [x] 4.1 Update `lib/intent-router.ts` to extend `DocumentType` union and `TYPE_KEYWORDS` array with patterns for all 10 types
    - Update "quotation" pattern to map to "quote"
    - Add SOW pattern: `/\b(statement of work|sow|deliverables|milestones|timeline|phases|project scope)\b/i`
    - Add Change Order pattern: `/\b(change order|amendment|scope change|modification|revision|addendum|extra work)\b/i`
    - Add NDA pattern: `/\b(nda|non-disclosure|confidentiality|confidential|secret|proprietary)\b/i`
    - Add Client Onboarding Form pattern: `/\b(onboarding|intake|client details|questionnaire|client form|project requirements)\b/i`
    - Add Payment Follow-up pattern: `/\b(reminder|follow.?up|overdue|payment reminder|past due|outstanding|unpaid)\b/i`
    - Add Recurring Invoice pattern: `/\b(recurring|monthly invoice|weekly billing|subscription billing|repeat invoice|monthly billing)\b/i`
    - **Multi-suggestion return type**: Change the return type of `classifyIntentFull` from a single type to `IntentResult` with a ranked `suggestions: IntentSuggestion[]` array. When more than one type pattern matches, all candidates above the confidence gap threshold are included, sorted by descending confidence. `suggestedType` remains as a convenience accessor equal to `suggestions[0]?.type`.
    - _Requirements: 3.1, 3.2, 3.3, 3.3a, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

  - [x] 4.2 Add mismatch detection rules to `lib/intent-router.ts` for new type confusions
    - Proposal → SOW when deliverables/milestones/acceptance criteria mentioned
    - Contract → Change Order when amendment/scope change mentioned
    - Invoice → Payment Follow-up when reminder/overdue mentioned
    - Contract → NDA when only confidentiality needed
    - Quote → Invoice when work already agreed and payment collection needed
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 4.6 Add disambiguation UI to calling layer (prompt screen / chat screen)
    - When `classifyIntentFull` returns `suggestions.length >= 2`, render a disambiguation card inline in the chat listing each candidate with its label and description from the registry
    - Include a "Something else" escape hatch that falls through to AI chat
    - The user's selection becomes the confirmed `documentType` for tier check, generation, and storage
    - When `suggestions.length <= 1`, behaviour is unchanged — no UX change for unambiguous prompts
    - _Requirements: 3.3a_

  - [x] 4.3 Write property test: Intent classifier keyword detection (Property 4)
    - **Property 4: Intent classifier keyword detection**
    - For any type and prompt containing only that type's keywords, `classifyIntentFull` returns that type as suggestedType
    - **Validates: Requirements 3.1–3.11**

  - [x] 4.4 Write property test: Classification function determinism (Property 6)
    - **Property 6: Classification function determinism**
    - For any prompt, calling `classifyIntentFull` multiple times returns the same result; same for `detectMismatch`
    - **Validates: Requirements 3.12, 13.7**

  - [x] 4.5 Write property test: Mismatch detection correctness (Property 11)
    - **Property 11: Mismatch detection correctness**
    - For any mismatch rule and prompt matching its triggerPattern with the rule's requestedType, `detectMismatch` returns the rule's suggestedType
    - **Validates: Requirements 13.1–13.6**

- [x] 5. Extend document type detector
  - [x] 5.1 Update `lib/server/document-type-detector.ts` to support all 10 types
    - Update `DocumentType` export to include all 10 types
    - Add keyword patterns with weights for SOW, Change Order, NDA, Client Onboarding Form, Payment Follow-up, Recurring Invoice
    - Map "quotation" detection to "quote" in the output
    - Update `scores` record to include all 10 types
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 5.2 Write property test: Document type detector keyword detection (Property 5)
    - **Property 5: Document type detector keyword detection**
    - For any type and prompt containing only that type's keywords, `detectDocumentType` returns that type; "quotation" keywords detect as "quote"
    - **Validates: Requirements 4.1–4.7, 4.9**

- [ ] 6. Update chat system prompts and CREATE_CARD parsing
  - [x] 6.1 Update `lib/chat-only-prompts.ts` to list all 10 document types with descriptions and recommendation guidance
    - Add descriptions for SOW, Change Order, NDA, Client Onboarding Form, Payment Follow-up, Recurring Invoice
    - Add document linking suggestions to the prompt
    - Instruct AI to recommend appropriate types based on user context
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.9_

  - [x] 6.2 Update `CREATE_CARD_SIGNAL_REGEX` and `ParsedCreateCard` type to accept all 10 type values
    - Update regex pattern to match all 10 type strings
    - Update TypeScript type union for `ParsedCreateCard.type`
    - _Requirements: 5.7, 5.8_

  - [-] 6.3 Write property test: CREATE_CARD signal parsing for all types (Property 7)
    - **Property 7: CREATE_CARD signal parsing for all types**
    - For any type in ALL_DOCUMENT_TYPES and any valid summary string, a well-formed CREATE_CARD signal is successfully parsed
    - **Validates: Requirements 5.7, 5.8**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create Zod data schemas for new document types
  - [x] 8.1 Create `lib/document-schemas.ts` with Zod schemas and TypeScript interfaces for SOW, Change Order, NDA, Client Onboarding Form, Payment Follow-up, and Recurring Invoice context
    - Define `sowSchema` with title, projectOverview, scopeItems, deliverables, milestones, assumptions, parentContractId, shared fields
    - Define `changeOrderSchema` with changeOrderNumber, parentDocumentId, parentDocumentType, additions, removals, modifications, costImpact, timelineImpact
    - Define `ndaSchema` with parties, confidentialInfoDefinition, obligations, exclusions, termStart, termDuration, termUnit, governingLaw
    - Define `clientOnboardingFormSchema` with clientName, projectName, requirements, customQuestions
    - Define `paymentFollowupSchema` with linkedInvoiceId, invoiceNumber, invoiceAmount, daysOverdue, reminderTone, customMessage
    - Define `recurringInvoiceContextSchema` with recurrenceFrequency, recurrenceStartDate, recurrenceEndDate, maxOccurrences, autoSend
    - Export `AnyDocumentData` union type
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [x] 8.2 Write property test: Schema validation for generated data (Property 10)
    - **Property 10: Schema validation for generated data**
    - For any randomly generated valid data conforming to a schema, `schema.parse(data)` succeeds; for data missing required fields, it throws ZodError
    - **Validates: Requirements 11.1–11.7**

- [x] 9. Extend signature workflow
  - [x] 9.1 Update signature-related components and API routes to check `supports_signature` from the registry
    - Gate "Request Signature" button visibility using `getDocumentTypeConfig(type).capabilities.supports_signature`
    - Update signature party labels: NDA uses "Disclosing Party"/"Receiving Party"; SOW/Change Order use "Client"/"Provider"
    - Ensure non-signable types never show signature UI
    - **Fail-closed signature block**: Implement `SignatureBlockRenderError` in `lib/pdf-templates.tsx`. When `supports_signature` is true for a type, `renderSignatureBlock` MUST throw `SignatureBlockRenderError` if the block cannot be built rather than returning an empty element. The PDF export API route catches this error and returns a 422 response. `pdf-download-button.tsx` catches the 422 and shows a descriptive toast. Never produce a PDF without the required signature section.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Implement document linking parent references
  - [x] 10.1 Update document creation flow to support parent document references
    - Store `parent_document_id` in session's `context` JSONB field for SOW, Change Order, and Payment Follow-up
    - Use existing `chain_id` mechanism for linking
    - Auto-populate Payment Follow-up fields from linked invoice (number, amount, due date, payment link)
    - Validate parent type against `validParentTypes` from registry before allowing link
    - Update chain navigator to display full document tree
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 11. Create PDF templates for new document types
  - [-] 11.1 Add SOW PDF template to `lib/pdf-templates.tsx`
    - Include sections: project overview, scope of work items, deliverables table, timeline/milestones, assumptions, signature blocks
    - Support country-specific compliance formatting
    - Omit empty sections gracefully
    - _Requirements: 8.1, 8.2, 8.8, 8.9_

  - [-] 11.2 Add Change Order PDF template to `lib/pdf-templates.tsx`
    - Include sections: change order number, parent document reference, additions/removals/modifications, cost impact, timeline impact, signature blocks
    - _Requirements: 8.1, 8.3, 8.8, 8.9_

  - [-] 11.3 Add NDA PDF template to `lib/pdf-templates.tsx`
    - Include sections: parties, confidential info definition, obligations, exclusions, term/duration, remedies, signature blocks
    - _Requirements: 8.1, 8.4, 8.8, 8.9_

  - [-] 11.4 Add Client Onboarding Form PDF template to `lib/pdf-templates.tsx`
    - Include sections: client details, project overview, requirements summary, timeline, budget, custom Q&A
    - _Requirements: 8.1, 8.5, 8.8, 8.9_

  - [-] 11.5 Add Payment Follow-up PDF template to `lib/pdf-templates.tsx`
    - Include sections: invoice reference (number, date, amount), payment status, payment link, reminder message, contact details
    - _Requirements: 8.1, 8.6, 8.8, 8.9_

  - [-] 11.6 Update existing quotation template to serve as Quote template with updated header text
    - Change header from "Quotation" to "Quote"
    - Ensure template handles both "quotation" and "quote" type values
    - _Requirements: 8.7, 16.4_

  - [-] 11.7 Add Recurring Invoice PDF template (extends invoice template with recurrence info header)
    - Add recurrence schedule display (frequency, start date, end date) above standard invoice content
    - _Requirements: 8.1, 8.8, 8.9_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Update UI components
  - [ ] 13.1 Update `components/session-history-sidebar.tsx` to display icons and colors for all 10 types from the registry
    - Import and use `getDocumentTypeConfig` for icon/color resolution
    - Add fallback to generic document icon for unknown types
    - Update filter pills to handle 10 types (top 6 visible + "More" dropdown)
    - _Requirements: 9.2, 9.4, 9.7_

  - [ ] 13.2 Update `app/history/page.tsx` to display and filter all 10 document types
    - Use registry for icons and colors
    - Implement filter pills with top 6 + expandable section for remaining types
    - Ensure "Quote" filter matches both "quote" and "quotation" values
    - _Requirements: 9.1, 9.3, 16.5_

  - [ ] 13.3 Update start screen / prompt screen category pills to show top 5-6 types with "All types" option
    - Display most common types (invoice, contract, quote, proposal, sow, nda) as primary pills
    - Add "More" or "All types" option revealing remaining types
    - _Requirements: 9.5_

  - [ ] 13.4 Update `app/documents/page.tsx` to list and filter by all 10 document types
    - Use registry for type metadata
    - _Requirements: 9.6_

- [ ] 14. Extend editor panel for new document types
  - Note: **Conditional mount** — the editor panel component must only be mounted while the Editor tab is active (see task 14.8). Type-specific layouts MUST NOT render while the Chat or Preview tab is active.

  - [ ] 14.1 Add SOW editor steps to `components/editor-panel.tsx`
    - Steps: Type → Parties → Scope & Deliverables → Milestones → Terms & Signature
    - Include add/remove/reorder for scope items and deliverables
    - _Requirements: 10.1, 10.2_

  - [ ] 14.2 Add Change Order editor steps to `components/editor-panel.tsx`
    - Steps: Type → Parent Reference (read-only link) → Changes (additions/removals/modifications) → Impact → Signature
    - _Requirements: 10.1, 10.3_

  - [ ] 14.3 Add NDA editor steps to `components/editor-panel.tsx`
    - Steps: Type → Parties → Confidential Info → Terms & Duration → Signature
    - _Requirements: 10.1, 10.4_

  - [ ] 14.4 Add Client Onboarding Form editor steps to `components/editor-panel.tsx`
    - Steps: Type → Client Details → Questions (add/remove/reorder) → Summary
    - _Requirements: 10.1, 10.5_

  - [ ] 14.5 Add Payment Follow-up editor steps to `components/editor-panel.tsx`
    - Steps: Type → Invoice Reference (read-only) → Reminder Settings (tone selector) → Message
    - _Requirements: 10.1, 10.6_

  - [ ] 14.6 Update Quote editor to use updated labeling and alias resolution
    - Call `normalizeDocumentType(documentType)` before resolving editor steps so both `"quote"` and `"quotation"` values route to the single `QuoteEditorSteps` layout — no separate layout for `"quotation"`
    - Update step labels from "Quotation" to "Quote"
    - _Requirements: 10.7, 16.4_

  - [ ] 14.7 Add field validation per document type before export
    - Validate required fields based on the Zod schema for each type
    - Show missing fields toast when validation fails
    - _Requirements: 10.8_

  - [ ] 14.8 Implement conditional (lazy) mount of editor panel
    - In the session view's tab container, conditionally render `<EditorPanel>` only when `activeTab === "editor"` using a ternary or `&&` gate
    - When Chat or Preview tab is active, the editor panel MUST be unmounted (not merely hidden) to prevent unnecessary Zod form instantiation for all 10 type layouts
    - _Requirements: 10.1_

- [ ] 15. Update AI document generation for new types
  - [ ] 15.1 Update `lib/deepseek.ts` system prompt to include generation instructions for all 10 document types
    - Add output schema descriptions for SOW, Change Order, NDA, Client Onboarding Form, Payment Follow-up, Recurring Invoice
    - Add reference number prefixes: SOW-, CO-, NDA-, ONB-, REM-, RINV-
    - Include document linking context in generation when parent document is available
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [ ] 15.2 Update AI response validation in the stream/generate routes to validate against type-specific Zod schemas
    - Import schemas from `lib/document-schemas.ts`
    - Route validation to correct schema based on document type
    - Implement retry-once on schema validation failure
    - _Requirements: 12.8, 11.7_

- [ ] 16. Update payment link rules
  - [ ] 16.1 Update payment link button visibility to check `supports_payment_link` from registry
    - Gate payment link creation/display using `getDocumentTypeConfig(type).capabilities.supports_payment_link`
    - Ensure Payment Follow-up displays existing payment link from referenced invoice but does not create new ones
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 17. Ensure mobile responsiveness for all new screens
  - [ ] 17.1 Verify and fix mobile layouts for all new editor panel types
    - Test all 6 new editor layouts at viewport widths below 768px
    - Ensure start screen pills wrap gracefully (3-4 per row with horizontal scroll)
    - Ensure history filters are horizontally scrollable on mobile
    - Verify tab navigation (Chat/Preview/Editor) works for all 10 types on mobile
    - Verify signature flow works on mobile touch devices for NDA, SOW, Change Order
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ] 18. Handle quotation-to-quote migration in display layer
  - [ ] 18.1 Update all UI components to normalize "quotation" to "quote" using `normalizeDocumentType` from the registry
    - Ensure history page, sidebar, documents page all display "Quote" for legacy "quotation" records
    - Ensure new documents always store "quote" (never "quotation")
    - Ensure intent classifier treats both keywords identically
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

- [ ] 19. Update export support for all types
  - [ ] 19.1 Update PDF export to route to correct template based on document type
    - Add template routing for all 6 new types in the PDF download flow
    - **Fail-closed**: Catch `SignatureBlockRenderError` from `renderSignatureBlock`; return 422 with a user-friendly error message when signature block cannot be rendered for signable types
    - Include signatures in export for signable types
    - Include payment link in Payment Follow-up export
    - Add document type label to export filename (e.g., `SOW_ProjectName_2026-01-15.pdf`)
    - _Requirements: 17.1, 17.4, 17.5, 17.6, 6.4_

  - [ ] 19.2 Update DOCX export to support all 10 document types with appropriate section formatting
    - Add section formatting for each new type's structure
    - _Requirements: 17.2, 17.4, 17.5, 17.6_

  - [ ] 19.3 Update image export to support all 10 document types
    - Ensure document preview renders correctly for all types before capture
    - _Requirements: 17.3, 17.6_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The centralized registry (task 1.1) is the foundation — all subsequent tasks depend on it
- The existing `InvoiceData` interface is reused for invoice, quote, and recurring_invoice types
- No database schema migration is required — the TEXT column accepts any type string
- All new PDF templates use the existing `@react-pdf/renderer` infrastructure

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6", "2.1"] },
    { "id": 2, "tasks": ["2.2", "4.1", "5.1", "8.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "5.2", "6.1", "8.2"] },
    { "id": 4, "tasks": ["4.5", "4.6", "6.2", "9.1", "10.1"] },
    { "id": 5, "tasks": ["6.3", "11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4", "15.1"] },
    { "id": 7, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.8", "15.2", "16.1"] },
    { "id": 8, "tasks": ["14.7", "17.1", "18.1"] },
    { "id": 9, "tasks": ["19.1", "19.2", "19.3"] }
  ]
}
```
