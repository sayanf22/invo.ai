# Implementation Plan: Compliance RAG Implementation

## Overview

Replace the hardcoded country-specific compliance blocks in `DUAL_MODE_SYSTEM_PROMPT` (~3,860 tokens across 11 countries) with a dynamic RAG system. The implementation creates a new `lib/compliance-rag.ts` module with dual retrieval modes (deterministic SQL for document generation, semantic vector search for conversational queries), extends the `compliance_knowledge` table with `vector(3072)` embeddings via OpenAI `text-embedding-3-large`, and integrates the RAG pipeline into the existing stream route. A one-time embedding script populates vectors for all ~500 compliance rules.

## Tasks

- [x] 1. Database schema extension for vector embeddings
  - [x] 1.1 Create SQL migration adding `embedding vector(3072)` column, HNSW index, and `match_compliance_knowledge` function
    - Add `embedding vector(3072)` column to `compliance_knowledge` table with `IF NOT EXISTS` guard
    - Create HNSW index on `embedding` column using `vector_cosine_ops` with `m = 16`, `ef_construction = 64`, with `IF NOT EXISTS` guard
    - Create or replace `match_compliance_knowledge` function accepting query embedding, country filter, document type filter, similarity threshold (default 0.65), and match count (default 8)
    - Function returns matching rows with cosine similarity scores, filtered by `embedding IS NOT NULL` and similarity > threshold
    - Ensure migration preserves all existing data and indexes
    - Save migration to `supabase/migrations/compliance_rag_vector.sql`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Core RAG module — `lib/compliance-rag.ts`
  - [x] 2.1 Implement country normalization and document type normalization
    - Create `COUNTRY_MAP` with ISO alpha-2 codes (IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL), full names, and common variants mapping to `compliance_knowledge` table format
    - Implement `normalizeCountry(country: string): string | null` with case-insensitive lookup
    - Implement `normalizeDocumentType(docType: string): string` with case-insensitive lowercase normalization
    - Return `null` from `normalizeCountry` for unsupported country values
    - _Requirements: 3.2, 3.3, 10.1, 10.2, 10.3_

  - [x] 2.2 Write property test for country normalization (Property 3)
    - **Property 3: Country normalization is consistent and case-insensitive**
    - For any supported country identifier in any case combination, `normalizeCountry` returns the same canonical name
    - For any unsupported string, returns `null`
    - **Validates: Requirements 3.2, 10.2**

  - [x] 2.3 Write property test for document type normalization (Property 4)
    - **Property 4: Document type normalization is case-insensitive**
    - For any valid document type string in any case variation, normalization returns the lowercase version
    - **Validates: Requirements 3.3**

  - [x] 2.4 Implement deterministic retrieval function
    - Create `getDeterministicRules(supabase, country, documentType): Promise<ComplianceRule[]>`
    - Query `compliance_knowledge` table with exact SQL filters on `country` and `document_type`
    - Filter results to include only rules where `effective_date` is null or on/before current date
    - Make zero calls to OpenAI embeddings API
    - _Requirements: 3.1, 3.4, 3.6_

  - [x] 2.5 Write property test for effective date filtering (Property 5)
    - **Property 5: Effective date filtering excludes future rules**
    - For any set of rules with varying effective dates, the filter returns only rules where `effective_date` is null or ≤ today
    - **Validates: Requirements 3.4**

  - [x] 2.6 Implement semantic retrieval function
    - Create `getSemanticRules(supabase, country, documentType, query): Promise<ComplianceRule[]>`
    - Generate vector embedding of user query via OpenAI `text-embedding-3-large` (3072 dimensions)
    - Call `match_compliance_knowledge` DB function with query embedding, country, document type, threshold 0.65, match count 8
    - Retrieve OpenAI API key using `getSecret("OPENAI_API_KEY")` from `lib/secrets.ts`
    - Set 5-second timeout on OpenAI API call using `AbortController`
    - Fall back to deterministic mode on API error or timeout
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 8.2, 8.4_

  - [x] 2.7 Implement compliance context formatting
    - Create `formatComplianceContext(rules, country, documentType, mode): string`
    - Format deterministic results with header identifying country and document type, rules grouped by category (`tax_rates`, `mandatory_fields`, `legal_requirements`, `formatting`, `deadlines`)
    - Format semantic results with same structure plus similarity score annotation per rule
    - Limit total formatted context to max 2,000 tokens (estimated as character count / 4)
    - When exceeding limit, truncate by removing lowest-priority categories: `deadlines` first, then `formatting`, preserving `tax_rates`, `mandatory_fields`, `legal_requirements`
    - _Requirements: 3.5, 7.1, 7.2, 7.3, 7.4_

  - [x] 2.8 Write property test for deterministic formatting (Property 6)
    - **Property 6: Deterministic formatting preserves all rules with structure**
    - For any non-empty set of rules, formatted output contains header with country and document type, and contains category, requirement_key, and description of every input rule
    - **Validates: Requirements 3.5, 7.1**

  - [x] 2.9 Write property test for semantic formatting ordering (Property 7)
    - **Property 7: Semantic formatting orders by descending similarity**
    - For any set of rules with distinct similarity scores, formatted output lists rules in strictly descending similarity order with score annotations
    - **Validates: Requirements 4.3, 7.2**

  - [x] 2.10 Write property test for token limit (Property 8)
    - **Property 8: Formatted context respects token limit**
    - For any set of rules (including 50+ rules), formatted output does not exceed 2,000 tokens (char count / 4)
    - **Validates: Requirements 7.3**

  - [x] 2.11 Write property test for truncation priority (Property 9)
    - **Property 9: Truncation preserves high-priority categories**
    - For any set of rules exceeding the token limit, truncated output always contains `tax_rates`, `mandatory_fields`, and `legal_requirements` (if present in input), removing `deadlines` before `formatting`
    - **Validates: Requirements 7.4**

  - [x] 2.12 Implement fallback context and main `getComplianceContext` entry point
    - Create `getFallbackContext(): string` returning generic compliance guidance (taxRate=0, ask user to confirm)
    - Create `getComplianceContext(supabase, country, documentType, userMessage?): Promise<ComplianceContext>`
    - Determine retrieval mode: if `userMessage` is provided → semantic mode, otherwise → deterministic mode
    - Normalize country and document type; return fallback if country is unsupported
    - Wrap all operations in try/catch; return fallback context on any error
    - Log errors with `console.error` including operation, country, document type, and error details
    - Never surface errors to the user
    - _Requirements: 3.7, 4.4, 8.1, 8.2, 8.3, 8.5_

- [x] 3. Checkpoint — Verify RAG module compiles and unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Embedding generation script — `scripts/embed-compliance-rules.ts`
  - [x] 4.1 Create the one-time embedding script
    - Read all rows from `compliance_knowledge` where `embedding IS NULL`
    - Construct text representation for each row: `{country} {document_type} {category} {requirement_key}: {description}`
    - Call OpenAI embeddings API with model `text-embedding-3-large` to generate 3072-dimensional vectors
    - Process rows in batches of up to 100
    - Write generated embedding vectors back to each row's `embedding` column
    - Retry failed batches up to 3 times with exponential backoff
    - Retrieve OpenAI API key using `getSecret("OPENAI_API_KEY")` from `lib/secrets.ts`
    - Log progress: total rows, current batch number, errors encountered
    - Log completion summary: total processed, successfully embedded, failed
    - Usage: `npx tsx scripts/embed-compliance-rules.ts`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 4.2 Write property test for embedding text representation (Property 1)
    - **Property 1: Embedding text representation contains all source fields**
    - For any rule with non-null country, document_type, category, requirement_key, and description, the text representation contains all five field values as substrings
    - **Validates: Requirements 2.2**

  - [x] 4.3 Write property test for batching (Property 2)
    - **Property 2: Batching produces complete, bounded partitions**
    - For any array of N items, batching into groups of 100 produces `ceil(N/100)` batches, each with ≤ 100 items, and concatenation of all batches equals the original array
    - **Validates: Requirements 2.5**

- [x] 5. Modify `lib/deepseek.ts` — Remove hardcoded country blocks and add RAG integration
  - [x] 5.1 Remove country compliance blocks and add RAG placeholder
    - Remove lines 242–549 (all 11 country blocks: IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL) from `DUAL_MODE_SYSTEM_PROMPT`
    - Replace with a placeholder section: "Country-specific compliance rules are provided dynamically in the COMPLIANCE CONTEXT section of the user prompt. Use these as the authoritative source for tax rates, mandatory fields, legal requirements, and formatting rules."
    - Retain `getTaxApplyRule()` function and all TAX_REGISTRATION_STATUS handling logic unchanged
    - Retain all non-compliance sections: math rules, content rules, core rules, business understanding, smart extraction, template detection, payment terms, output schemas, legal disclaimer, prompt injection defense
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.2 Add `complianceContext` field to `AIGenerationRequest` and update `buildPrompt`
    - Add optional `complianceContext?: string` field to the `AIGenerationRequest` interface
    - Update `buildPrompt()` to inject `complianceContext` into the user prompt after the business profile section and before conversation history
    - Wrap compliance context in a `COMPLIANCE CONTEXT` header block for clear AI parsing
    - _Requirements: 5.3, 6.6_

- [x] 6. Modify `app/api/ai/stream/route.ts` — Integrate RAG retrieval
  - [x] 6.1 Add RAG retrieval call after business profile fetch
    - Import `getComplianceContext` from `@/lib/compliance-rag`
    - After business profile fetch and before `streamGenerateDocument`, call `getComplianceContext` with the user's country, document type, and optionally the user's message (for semantic mode)
    - Determine retrieval mode: if conversation history exists and prompt doesn't match document generation patterns → pass `userMessage` for semantic mode; otherwise → deterministic mode
    - Set `body.complianceContext = complianceResult.formattedContext`
    - If RAG returns error or empty result, continue with fallback context (never block the user)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Add embedding cost tracking for semantic mode
    - When `complianceResult.mode === "semantic"`, call `trackUsage(auth.supabase, auth.user.id, "embedding", 100)` to track embedding API usage
    - No tracking call for deterministic mode (zero cost)
    - _Requirements: 5.5, 9.1, 9.3_

- [x] 7. Update `lib/cost-protection.ts` — Add embedding operation type
  - Verify `OPERATION_COSTS` already includes `embedding: 0.00001` (already present in current code)
  - Ensure `trackUsage` accepts `"embedding"` as a valid operation type
  - _Requirements: 9.2_

- [x] 8. Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Write unit tests for RAG module integration and error handling
  - [x] 9.1 Write unit tests for deterministic mode
    - Test deterministic mode returns correct rules for India + invoice
    - Test deterministic mode makes zero OpenAI API calls
    - Test `COUNTRY_MAP` contains all 11 ISO codes
    - _Requirements: 3.1, 3.6, 10.1_

  - [x] 9.2 Write unit tests for semantic mode fallbacks
    - Test semantic mode falls back to deterministic on API error
    - Test semantic mode falls back when no results above threshold
    - Test OpenAI timeout (>5s) triggers deterministic fallback
    - _Requirements: 4.4, 4.6, 8.2, 8.4_

  - [x] 9.3 Write unit tests for system prompt changes
    - Test system prompt no longer contains country blocks (IN, US, GB, etc.)
    - Test system prompt retains `getTaxApplyRule` reference
    - Test system prompt retains all non-compliance sections
    - _Requirements: 6.1, 6.3, 6.5_

  - [x] 9.4 Write unit tests for fallback and cost tracking
    - Test fallback context contains taxRate=0 instruction
    - Test stream route continues on RAG failure
    - Test cost tracking called with "embedding" for semantic mode
    - Test `OPERATION_COSTS` includes "embedding" at $0.00001
    - _Requirements: 8.1, 8.5, 9.1, 9.2_

  - [x] 9.5 Write unit tests for embedding script
    - Test embedding script retries on API error (up to 3×)
    - Test embedding script logs summary on completion
    - _Requirements: 2.7, 2.9_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (9 properties total)
- Unit tests validate specific examples, edge cases, and integration points
- The `embedding` operation type already exists in `OPERATION_COSTS` in `lib/cost-protection.ts` — task 7 is a verification step
- The same OpenAI API key already in Supabase Vault is used for embeddings — no separate key configuration needed
- All code uses TypeScript, matching the existing project stack (Next.js 16 + Supabase + Vitest + fast-check)
