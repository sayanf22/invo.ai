# Requirements Document

## Introduction

This feature adds Kimi K2.5 as an orchestrator/supervisor layer for document generation in THINKING mode. After DeepSeek generates a document, Kimi reviews the output and validates key compliance fields (tax rate, mandatory fields, currency) against the RAG compliance data retrieved from the `compliance_knowledge` table. Each orchestration step produces brief commentary visible in the agentic thinking UI's expandable sections. FAST mode remains unchanged with zero additional API calls.

## Glossary

- **Kimi_Orchestrator**: The Kimi K2.5 model (via Amazon Bedrock Mantle) acting as a supervisor that reviews DeepSeek output and validates it against RAG compliance data.
- **DeepSeek_Generator**: The DeepSeek model responsible for generating document JSON from user prompts.
- **RAG_Compliance_Data**: Country-specific compliance rules stored in the `compliance_knowledge` Supabase table, retrieved via deterministic or semantic search in `lib/compliance-rag.ts`.
- **Thinking_Mode**: The document generation mode (`thinkingMode: "thinking"`) that enables DeepSeek reasoning tokens and Kimi orchestration.
- **Fast_Mode**: The document generation mode (`thinkingMode: "fast"`) that skips reasoning and Kimi orchestration for speed.
- **Thinking_UI**: The `AgenticThinkingBlock` component that displays step-by-step activity events with expandable detail sections.
- **Activity_Event**: An SSE event of type `"activity"` sent from the route handler to the client, rendered as a step in the Thinking_UI.
- **Validation_Warning**: A mismatch detected between DeepSeek-generated document fields and RAG_Compliance_Data, displayed as a warning in the Thinking_UI.
- **Commentary**: A brief (50–100 token) text note from Kimi_Orchestrator summarizing what happened at a given orchestration step, displayed in the expandable section of an Activity_Event.
- **Stream_Route**: The API route handler at `app/api/ai/stream/route.ts` that orchestrates the SSE stream.

## Requirements

### Requirement 1: Kimi Orchestrator Commentary After Business Profile Read

**User Story:** As a user in thinking mode, I want to see Kimi's brief commentary about my business profile after it is read, so that I can confirm the system understood my business context correctly.

#### Acceptance Criteria

1. WHILE Thinking_Mode is active AND a document generation intent is detected, WHEN the business profile has been read successfully, THE Kimi_Orchestrator SHALL generate a brief commentary (50–100 tokens) summarizing the business context and send it as an Activity_Event with the `reasoningText` field populated.
2. WHILE Fast_Mode is active, THE Stream_Route SHALL NOT make any calls to the Kimi_Orchestrator for business profile commentary.
3. IF the Kimi_Orchestrator call fails or times out (30-second limit), THEN THE Stream_Route SHALL continue document generation without commentary and log the error server-side.
4. THE Kimi_Orchestrator commentary call SHALL use a maximum of 100 `max_tokens` to keep responses brief and cost-effective.

### Requirement 2: Kimi Orchestrator Commentary After Compliance Rules Fetch

**User Story:** As a user in thinking mode, I want to see Kimi's brief commentary about the compliance rules fetched for my country, so that I understand what regulations are being applied to my document.

#### Acceptance Criteria

1. WHILE Thinking_Mode is active AND RAG_Compliance_Data has been retrieved with one or more rules, WHEN the compliance search step completes, THE Kimi_Orchestrator SHALL generate a brief commentary (50–100 tokens) summarizing the key compliance rules found and send it as an Activity_Event with the `reasoningText` field populated.
2. WHILE Fast_Mode is active, THE Stream_Route SHALL NOT make any calls to the Kimi_Orchestrator for compliance commentary.
3. IF RAG_Compliance_Data retrieval returns zero rules or fails, THEN THE Kimi_Orchestrator SHALL generate commentary noting that no compliance data was available and advising the user to verify tax and regulatory requirements.
4. THE Kimi_Orchestrator commentary call SHALL use a maximum of 100 `max_tokens`.

### Requirement 3: RAG Validation After Document Generation

**User Story:** As a user in thinking mode, I want the system to validate DeepSeek's generated document against RAG compliance data, so that I can see warnings if the document contains incorrect tax rates, missing mandatory fields, or wrong currency.

#### Acceptance Criteria

1. WHILE Thinking_Mode is active AND DeepSeek_Generator has completed document generation, WHEN RAG_Compliance_Data is available, THE Kimi_Orchestrator SHALL compare the generated document's tax rate, mandatory fields, and currency against the RAG_Compliance_Data and produce a validation result.
2. WHEN the Kimi_Orchestrator detects a mismatch between the generated document and RAG_Compliance_Data (tax rate differs, mandatory field missing, or currency incorrect), THE Stream_Route SHALL emit a Validation_Warning Activity_Event with action `"validate"` that includes the mismatch details in the `reasoningText` field.
3. WHEN the Kimi_Orchestrator finds no mismatches, THE Stream_Route SHALL emit a validation Activity_Event confirming compliance with the `reasoningText` field containing a brief confirmation note.
4. WHILE Fast_Mode is active, THE Stream_Route SHALL NOT perform any RAG validation calls to the Kimi_Orchestrator.
5. IF the Kimi_Orchestrator validation call fails or times out, THEN THE Stream_Route SHALL skip validation, log the error, and continue delivering the document to the user without blocking.
6. THE Kimi_Orchestrator validation call SHALL use a maximum of 200 `max_tokens` to allow for detailed mismatch descriptions.

### Requirement 4: Thinking UI Displays Kimi Commentary and Validation Warnings

**User Story:** As a user, I want to see Kimi's commentary and validation warnings in the thinking UI's expandable sections, so that I can review the orchestrator's observations at each step.

#### Acceptance Criteria

1. WHEN an Activity_Event with a populated `reasoningText` field from the Kimi_Orchestrator is received, THE Thinking_UI SHALL display the commentary text in the expandable section of the corresponding step.
2. WHEN a Validation_Warning Activity_Event with action `"validate"` is received, THE Thinking_UI SHALL display the step with a warning visual indicator (distinct icon and/or color) to differentiate it from informational steps.
3. WHEN a Validation_Warning indicates a mismatch, THE Thinking_UI SHALL display the mismatch details (expected value from RAG vs. actual value from document) in the expandable `reasoningText` section.
4. THE Thinking_UI SHALL support a new `"validate"` action type in the `ActivityItem` interface with an appropriate icon.

### Requirement 5: Fast Mode Remains Unchanged

**User Story:** As a user in fast mode, I want document generation to behave exactly as it does today with no additional latency, so that I get the fastest possible experience.

#### Acceptance Criteria

1. WHILE Fast_Mode is active, THE Stream_Route SHALL make zero calls to the Kimi_Orchestrator during the entire document generation flow.
2. WHILE Fast_Mode is active, THE Stream_Route SHALL NOT emit any Kimi commentary or validation Activity_Events.
3. THE Stream_Route SHALL determine the active mode by reading the `thinkingMode` field from the request body, resolved via the existing `resolveThinkingMode` function.

### Requirement 6: Long Session Timeout Handling

**User Story:** As a user in thinking mode, I want the UI to handle longer generation times gracefully without timing out, so that Kimi orchestration steps can complete without errors.

#### Acceptance Criteria

1. WHILE Thinking_Mode is active, THE Stream_Route SHALL allow up to 120 seconds total for the complete orchestrated flow (business profile commentary + compliance commentary + document generation + validation).
2. THE Kimi_Orchestrator SHALL enforce a 30-second timeout per individual Kimi API call, consistent with the existing Bedrock client timeout.
3. IF any individual Kimi_Orchestrator call exceeds 30 seconds, THEN THE Stream_Route SHALL abort that call, skip the step, and continue with the next step in the flow.
4. THE Thinking_UI SHALL continue displaying the spinner/pulse animation on the current step until either a completion event or an error event is received, with no client-side timeout.

### Requirement 7: RAG Data Availability Indicator

**User Story:** As a user, I want to see in the thinking UI when RAG compliance data could not be retrieved, so that I know the document may not have been validated against the latest regulations.

#### Acceptance Criteria

1. IF RAG_Compliance_Data retrieval fails or returns zero rules, THEN THE Stream_Route SHALL emit an Activity_Event indicating that compliance data is unavailable, with the `detail` field set to "Unavailable" or a descriptive status.
2. WHEN RAG_Compliance_Data is unavailable AND Thinking_Mode is active, THE Kimi_Orchestrator SHALL include in its commentary a note advising DeepSeek_Generator output should be manually verified for compliance.
3. WHEN RAG_Compliance_Data is unavailable, THE Stream_Route SHALL skip the RAG validation step (Requirement 3) entirely and emit no Validation_Warning events.

### Requirement 8: Kimi Orchestrator Cost Constraints

**User Story:** As a platform operator, I want Kimi orchestrator calls to be strictly limited in token usage and call count, so that the feature remains cost-effective.

#### Acceptance Criteria

1. WHILE Thinking_Mode is active during a single document generation request, THE Stream_Route SHALL make at most 3 calls to the Kimi_Orchestrator: one for business profile commentary, one for compliance commentary, and one for RAG validation.
2. THE Kimi_Orchestrator business profile commentary call SHALL use a `max_tokens` value of 100.
3. THE Kimi_Orchestrator compliance commentary call SHALL use a `max_tokens` value of 100.
4. THE Kimi_Orchestrator RAG validation call SHALL use a `max_tokens` value of 200.
5. THE Kimi_Orchestrator SHALL use the existing Bedrock API key (`amazon_beadrocl_key`) from the environment, making no additional key configuration necessary.
6. WHILE Fast_Mode is active, THE Stream_Route SHALL make zero calls to the Kimi_Orchestrator, incurring no additional cost.
