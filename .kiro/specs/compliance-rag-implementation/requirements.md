# Requirements Document

## Introduction

This feature replaces the hardcoded country-specific compliance rules in the `DUAL_MODE_SYSTEM_PROMPT` (lines 242–549 of `lib/deepseek.ts`, ~3,860 tokens across 11 countries × 4 document types) with a dynamic Retrieval-Augmented Generation (RAG) system. The RAG system uses two retrieval modes: deterministic SQL lookup for document generation (free, exact match on country + document type) and semantic vector search via OpenAI `text-embedding-3-large` embeddings (3072 dimensions, MTEB 64.6) + pgvector for conversational compliance questions. This reduces per-call input tokens by ~23% (from ~10,666 to ~8,235), improves compliance accuracy by surfacing only relevant rules, and enables updating tax rates and legal requirements via database rows without code deployments. The same OpenAI API key already in Supabase Vault (used by `app/api/ai/analyze-file/route.ts`) is used for embeddings — no separate key needed.

## Glossary

- **RAG_System**: The Retrieval-Augmented Generation module (`lib/compliance-rag.ts`) that fetches compliance rules from the `compliance_knowledge` table using either deterministic or semantic retrieval modes before injecting them into the AI system prompt.
- **Deterministic_Mode**: A retrieval strategy that uses exact SQL `WHERE` filters on `country` and `document_type` columns to fetch compliance rules. Used for document generation (invoices, contracts, quotations, proposals). No embedding call required — always free.
- **Semantic_Mode**: A retrieval strategy that generates a vector embedding of the user's query via OpenAI `text-embedding-3-large` (3072 dimensions, highest accuracy), then performs cosine similarity search against pre-computed embeddings in the `compliance_knowledge` table using pgvector. Used for conversational compliance questions.
- **Compliance_Knowledge_Table**: The existing `compliance_knowledge` PostgreSQL table seeded with ~500 rules across 11 countries × 4 document types, to be extended with a `vector(3072)` embedding column.
- **Embedding_Script**: A one-time Node.js script (`scripts/embed-compliance-rules.ts`) that reads all rows from `compliance_knowledge`, generates embeddings via OpenAI `text-embedding-3-large`, and writes the vectors back to the `embedding` column.
- **Stream_Route**: The Next.js API route at `app/api/ai/stream/route.ts` that handles streaming document generation and conversational AI responses.
- **System_Prompt**: The `DUAL_MODE_SYSTEM_PROMPT` constant in `lib/deepseek.ts` containing all AI behavior instructions, currently including hardcoded compliance blocks for all 11 countries.
- **Country_Blocks**: Lines 242–549 of `lib/deepseek.ts` containing hardcoded compliance rules for India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, and Netherlands (~3,860 tokens).
- **getTaxApplyRule**: The existing helper function in `lib/deepseek.ts` that determines tax registration status and apply rules per country. This function is NOT affected by RAG and continues to operate independently.
- **HNSW_Index**: A Hierarchical Navigable Small World index on the `embedding` column for approximate nearest neighbor search, providing fast vector similarity lookups.
- **Similarity_Threshold**: The minimum cosine similarity score (default 0.65) required for a semantic search result to be considered relevant.
- **Fallback_Context**: A minimal set of generic compliance instructions injected into the system prompt when RAG retrieval returns no results, ensuring the AI can still generate compliant documents.

## Requirements

### Requirement 1: Database Schema Extension for Vector Embeddings

**User Story:** As a platform operator, I want the `compliance_knowledge` table to support vector embeddings, so that semantic similarity search can be performed against compliance rules.

#### Acceptance Criteria

1. THE Database_Migration SHALL add a `embedding` column of type `vector(3072)` to the `compliance_knowledge` table.
2. THE Database_Migration SHALL create an HNSW index on the `embedding` column using `vector_cosine_ops` with parameters `m = 16` and `ef_construction = 64`.
3. THE Database_Migration SHALL create or replace a `match_compliance_knowledge` function that accepts a query embedding, country filter, document type filter, similarity threshold (default 0.65), and match count (default 8), and returns matching rows with their cosine similarity scores.
4. THE Database_Migration SHALL preserve all existing data and indexes in the `compliance_knowledge` table.
5. IF the `embedding` column already exists, THEN THE Database_Migration SHALL skip the column addition without error.
6. IF the HNSW index already exists, THEN THE Database_Migration SHALL skip the index creation without error.

---

### Requirement 2: Embedding Generation Script

**User Story:** As a platform operator, I want a script that generates vector embeddings for all compliance rules, so that semantic search can find relevant rules by meaning.

#### Acceptance Criteria

1. THE Embedding_Script SHALL read all rows from the `compliance_knowledge` table that have a `NULL` embedding value.
2. THE Embedding_Script SHALL construct a text representation for each row by concatenating the `country`, `document_type`, `category`, `requirement_key`, and `description` fields.
3. THE Embedding_Script SHALL call the OpenAI embeddings API with model `text-embedding-3-large` to generate a 3072-dimensional vector for each text representation.
4. THE Embedding_Script SHALL write the generated embedding vector back to the corresponding row's `embedding` column.
5. THE Embedding_Script SHALL process rows in batches of up to 100 to respect OpenAI API rate limits.
6. THE Embedding_Script SHALL log progress to the console, including the total number of rows to embed, the current batch number, and any errors encountered.
7. IF the OpenAI API returns an error for a batch, THEN THE Embedding_Script SHALL retry that batch up to 3 times with exponential backoff before logging the failure and continuing with the next batch.
8. THE Embedding_Script SHALL retrieve the OpenAI API key using the same `getSecret` mechanism used by `app/api/ai/analyze-file/route.ts`.
9. WHEN the Embedding_Script completes, THE Embedding_Script SHALL log a summary showing the total rows processed, total rows successfully embedded, and total rows that failed.

---

### Requirement 3: Deterministic Compliance Rule Retrieval

**User Story:** As a document generation user, I want the AI to receive only the compliance rules for my country and document type, so that generated documents are accurate and the system prompt is smaller.

#### Acceptance Criteria

1. WHEN a document generation request is received, THE RAG_System SHALL query the `compliance_knowledge` table using exact SQL filters on `country` and `document_type` matching the user's business profile country and the requested document type.
2. THE RAG_System SHALL map country names between the business profile format (e.g., "India", "IN") and the `compliance_knowledge` table format (e.g., "India") using a normalization function.
3. THE RAG_System SHALL map document type values between the session format (e.g., "invoice", "Invoice") and the `compliance_knowledge` table format (e.g., "invoice") using case-insensitive normalization.
4. THE RAG_System SHALL filter results to include only rules where `effective_date` is null or on or before the current date.
5. THE RAG_System SHALL format retrieved rules into a structured text block suitable for injection into the AI system prompt, including the category, requirement key, and description for each rule.
6. THE RAG_System SHALL make zero calls to the OpenAI embeddings API when operating in Deterministic_Mode.
7. IF no rules are found for the given country and document type combination, THEN THE RAG_System SHALL return the Fallback_Context containing generic compliance guidance.

---

### Requirement 4: Semantic Compliance Rule Retrieval

**User Story:** As a user asking conversational compliance questions, I want the AI to find the most relevant compliance rules by meaning, so that I get accurate answers about tax rules, thresholds, and legal requirements.

#### Acceptance Criteria

1. WHEN a conversational query about compliance is received, THE RAG_System SHALL generate a vector embedding of the user's query using OpenAI `text-embedding-3-large`.
2. THE RAG_System SHALL call the `match_compliance_knowledge` database function with the query embedding, the user's country, the current document type, a Similarity_Threshold of 0.65, and a match count of 8.
3. THE RAG_System SHALL format the returned rules into a structured text block suitable for injection into the AI system prompt, ordered by descending similarity score.
4. IF no results exceed the Similarity_Threshold, THEN THE RAG_System SHALL fall back to Deterministic_Mode for the user's country and document type.
5. THE RAG_System SHALL retrieve the OpenAI API key using the existing `getSecret` function from `lib/secrets.ts`.
6. IF the OpenAI embeddings API call fails, THEN THE RAG_System SHALL fall back to Deterministic_Mode and log the error.

---

### Requirement 5: Stream Route Integration

**User Story:** As a user generating documents or asking compliance questions, I want the RAG system to automatically provide relevant compliance context to the AI, so that responses are accurate without me needing to specify my country's rules.

#### Acceptance Criteria

1. THE Stream_Route SHALL invoke the RAG_System after fetching the business profile and before calling `streamGenerateDocument`.
2. WHEN the user's business profile includes a country, THE Stream_Route SHALL pass the country and document type to the RAG_System.
3. THE Stream_Route SHALL inject the RAG-retrieved compliance context into the `AIGenerationRequest` so that it is included in the prompt sent to DeepSeek.
4. IF the RAG_System returns an error or empty result, THEN THE Stream_Route SHALL continue with document generation using the Fallback_Context, and SHALL NOT return an error to the user.
5. THE Stream_Route SHALL track RAG embedding usage via the existing `trackUsage` function in `lib/cost-protection.ts` with operation type `embedding` when Semantic_Mode is used.

---

### Requirement 6: System Prompt Modification

**User Story:** As a platform operator, I want the hardcoded country compliance blocks removed from the system prompt, so that token usage is reduced and compliance rules are managed dynamically.

#### Acceptance Criteria

1. THE System_Prompt SHALL have the Country_Blocks (lines 242–549 covering all 11 countries) removed from the `DUAL_MODE_SYSTEM_PROMPT` constant.
2. THE System_Prompt SHALL retain a placeholder section stating that country-specific compliance rules are provided dynamically via RAG context in the user prompt.
3. THE System_Prompt SHALL retain the `getTaxApplyRule` function and all TAX_REGISTRATION_STATUS handling logic unchanged.
4. THE System_Prompt SHALL retain the clarification question priority table unchanged.
5. THE System_Prompt SHALL retain all non-compliance sections: math rules, content rules, core rules, business understanding, smart extraction, template detection, payment terms, output schemas, output format, legal disclaimer, and prompt injection defense.
6. WHEN RAG context is injected into the user prompt, THE System_Prompt SHALL instruct the AI to use the dynamically provided compliance rules as the authoritative source for country-specific tax rates, mandatory fields, legal requirements, and formatting rules.

---

### Requirement 7: Compliance Context Formatting

**User Story:** As a platform operator, I want RAG-retrieved compliance rules formatted consistently, so that the AI can reliably parse and apply them.

#### Acceptance Criteria

1. THE RAG_System SHALL format deterministic results as a structured block with a header identifying the country and document type, followed by rules grouped by category (tax_rates, mandatory_fields, legal_requirements, formatting, deadlines).
2. THE RAG_System SHALL format semantic results with the same structure as deterministic results, with an additional similarity score annotation for each rule.
3. THE RAG_System SHALL limit the total formatted context to a maximum of 2,000 tokens to prevent prompt bloat.
4. IF the formatted context exceeds 2,000 tokens, THEN THE RAG_System SHALL truncate by removing the lowest-priority categories (deadlines first, then formatting) while preserving tax_rates, mandatory_fields, and legal_requirements.

---

### Requirement 8: Fallback and Error Handling

**User Story:** As a user, I want document generation to work even when the RAG system encounters errors, so that I am never blocked from creating documents.

#### Acceptance Criteria

1. IF the `compliance_knowledge` table query fails, THEN THE RAG_System SHALL return the Fallback_Context and log the error.
2. IF the OpenAI embeddings API is unreachable or returns an error, THEN THE RAG_System SHALL fall back to Deterministic_Mode and log the error.
3. IF the user's country is not found in the `compliance_knowledge` table, THEN THE RAG_System SHALL return the Fallback_Context containing a generic instruction for the AI to apply no tax and ask the user for country-specific details.
4. THE RAG_System SHALL set a timeout of 5 seconds for the OpenAI embeddings API call, falling back to Deterministic_Mode if the timeout is exceeded.
5. THE Fallback_Context SHALL instruct the AI to set `taxRate` to 0 and include a message asking the user to confirm their country's tax requirements.

---

### Requirement 9: Cost Tracking for Embedding Operations

**User Story:** As a platform operator, I want embedding API costs tracked alongside other AI costs, so that I can monitor total AI spending.

#### Acceptance Criteria

1. WHEN the RAG_System makes an OpenAI embeddings API call in Semantic_Mode, THE RAG_System SHALL call `trackUsage` with operation type `embedding` and the number of tokens used.
2. THE Cost_Protection module SHALL include an `embedding` operation type with an estimated cost of $0.00001 per call.
3. THE RAG_System SHALL NOT make any embeddings API calls in Deterministic_Mode, resulting in zero additional cost for document generation.

---

### Requirement 10: Country Name Normalization

**User Story:** As a developer, I want country identifiers normalized between different formats used across the codebase, so that RAG lookups work regardless of whether the business profile stores "India", "IN", or "india".

#### Acceptance Criteria

1. THE RAG_System SHALL maintain a mapping between ISO 3166-1 alpha-2 codes (IN, US, GB, DE, CA, AU, SG, AE, PH, FR, NL) and the full country names used in the `compliance_knowledge` table (India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands).
2. WHEN a country value is provided, THE RAG_System SHALL normalize it to the `compliance_knowledge` table format by checking the mapping in a case-insensitive manner.
3. IF the provided country value does not match any entry in the mapping, THEN THE RAG_System SHALL return the Fallback_Context.
