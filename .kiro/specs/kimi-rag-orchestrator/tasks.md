# Implementation Plan: Kimi RAG Orchestrator

## Overview

This plan implements Kimi K2.5 as an orchestrator/supervisor layer for document generation in Thinking Mode. The implementation adds a non-streaming `callBedrockBrief()` function, orchestrator prompt constants, and orchestration logic in the stream route that produces brief commentary and RAG validation — all gated behind `thinkingMode: "thinking"` with zero impact on Fast Mode.

## Tasks

- [x] 1. Add `callBedrockBrief()` function and orchestrator prompts to `lib/bedrock.ts`
  - [x] 1.1 Implement `callBedrockBrief()` non-streaming function
    - Add a new exported async function that makes a non-streaming POST to `BEDROCK_MANTLE_URL` with `stream: false`
    - Accept parameters: `systemPrompt`, `userPrompt`, `apiKey`, `maxTokens` (default 100)
    - Use `temperature: 0.2` for deterministic commentary
    - Enforce 30-second timeout via `AbortController`
    - Return the response text as `string | null` — return `null` on any error (timeout, HTTP error, parse failure)
    - Log errors to `console.error` with structured context (never throw)
    - _Requirements: 1.4, 2.4, 3.6, 6.2, 8.2, 8.3, 8.4_

  - [x] 1.2 Add orchestrator prompt constants
    - Add `ORCHESTRATOR_SYSTEM_PROMPT` — establishes Kimi as a brief, factual document reviewer (not a chatbot), instructs ≤3 sentences for commentary
    - Add `BUSINESS_PROFILE_COMMENTARY_PROMPT` — template accepting interpolated business profile fields (name, country, currency, tax status, business type), instructs Kimi to summarize what it understands about the business context
    - Add `COMPLIANCE_COMMENTARY_PROMPT` — template accepting interpolated compliance rules summary (country, rule count, categories, key values), instructs Kimi to summarize key regulations being applied
    - Add `RAG_VALIDATION_PROMPT` — template accepting interpolated document JSON fields (tax rate, currency, mandatory fields) and RAG rules, instructs Kimi to compare and report mismatches in ≤5 sentences using ✅/⚠️ format
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 3.3_

  - [ ]* 1.3 Write unit tests for `callBedrockBrief()`
    - Test successful response returns text string
    - Test HTTP error returns `null` and logs error
    - Test timeout returns `null` and logs error
    - Test empty/invalid API key returns `null`
    - Test JSON parse failure returns `null`
    - _Requirements: 1.3, 3.5, 6.2_

- [x] 2. Update `ActivityItem` interface and `AgenticThinkingBlock` component
  - [x] 2.1 Add `"validate"` action type to `ActivityItem` interface
    - Extend the `action` union type in `components/ui/agentic-thinking-block.tsx` to include `"validate"`
    - Import `ShieldCheck` from `lucide-react`
    - Add `validate: <ShieldCheck className="w-3.5 h-3.5" />` to the `ACTION_ICONS` map
    - _Requirements: 4.2, 4.4_

  - [ ]* 2.2 Write unit test for validate action icon rendering
    - Verify `ACTION_ICONS["validate"]` maps to `ShieldCheck` icon
    - Verify the `AgenticThinkingBlock` renders a validate activity item with the correct icon
    - _Requirements: 4.2, 4.4_

- [x] 3. Implement orchestration logic in `app/api/ai/stream/route.ts`
  - [x] 3.1 Add orchestration gate and imports
    - Import `callBedrockBrief`, `ORCHESTRATOR_SYSTEM_PROMPT`, `BUSINESS_PROFILE_COMMENTARY_PROMPT`, `COMPLIANCE_COMMENTARY_PROMPT`, `RAG_VALIDATION_PROMPT` from `@/lib/bedrock`
    - After existing mode resolution, compute `shouldOrchestrate` flag: `isThinkingMode && isDocGeneration && bedrockKey && bedrockKey.length > 10`
    - Ensure Fast Mode makes zero calls to `callBedrockBrief` (the flag is `false`)
    - _Requirements: 5.1, 5.2, 5.3, 8.1, 8.6_

  - [x] 3.2 Add business profile commentary step (parallel with compliance fetch)
    - After business profile is read successfully AND `shouldOrchestrate` is true, fire `callBedrockBrief()` with `BUSINESS_PROFILE_COMMENTARY_PROMPT` interpolated with profile data, `max_tokens: 100`
    - Run this call in parallel with the compliance rules fetch using `Promise.allSettled()`
    - If `callBedrockBrief()` returns non-null, update the existing "Reading business profile" activity event's `content` field with the Kimi commentary
    - If it returns `null` (failure/timeout), continue without commentary — log error server-side
    - _Requirements: 1.1, 1.3, 1.4, 8.2_

  - [x] 3.3 Add compliance rules commentary step
    - After compliance rules fetch completes AND `shouldOrchestrate` is true, fire `callBedrockBrief()` with `COMPLIANCE_COMMENTARY_PROMPT` interpolated with rules summary, `max_tokens: 100`
    - If rules array is empty or retrieval failed, adjust prompt to note "no compliance data available" and advise manual verification
    - If `callBedrockBrief()` returns non-null, update the compliance search activity event's `content` field with the Kimi commentary
    - If it returns `null`, continue without commentary
    - _Requirements: 2.1, 2.3, 2.4, 7.1, 7.2, 8.3_

  - [x] 3.4 Add RAG validation step after document generation
    - After DeepSeek completes document generation AND `shouldOrchestrate` is true AND compliance rules were found (non-empty array), fire `callBedrockBrief()` with `RAG_VALIDATION_PROMPT` interpolated with document JSON and RAG rules, `max_tokens: 200`
    - Emit a new activity event with `action: "validate"`, `label: "Validating compliance"`, and the Kimi response as `content`
    - If no compliance rules were found, skip validation entirely — emit no validate event
    - If `callBedrockBrief()` returns `null` (failure/timeout), skip validation and continue delivering the document
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 7.3, 8.4_

  - [ ]* 3.5 Write property test: Orchestrator call count invariant (Property 4)
    - **Property 4: Orchestrator call count invariant**
    - For any document generation request with `thinkingMode: "thinking"`, verify total `callBedrockBrief()` invocations ≤ 3
    - For any request with `thinkingMode: "fast"`, verify count is exactly 0
    - Use `fast-check` with minimum 100 iterations
    - Mock `callBedrockBrief` and count invocations across varied inputs
    - **Validates: Requirements 8.1, 5.1, 8.6**

  - [ ]* 3.6 Write property test: Business profile commentary produces valid activity event (Property 1)
    - **Property 1: Business profile commentary produces valid activity event**
    - For any valid business profile (varying name, country, currency, tax registration, business type), when `callBedrockBrief()` returns non-null, verify the emitted SSE activity event has `action: "read"` and non-empty `content` field
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 1.1**

  - [ ]* 3.7 Write property test: Compliance commentary produces valid activity event (Property 2)
    - **Property 2: Compliance commentary produces valid activity event**
    - For any non-empty array of `ComplianceRule` objects (varying countries, categories, requirement values), when `callBedrockBrief()` returns non-null, verify the emitted SSE activity event has `action: "search"` and non-empty `content` field
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 2.1**

  - [ ]* 3.8 Write property test: Validation prompt includes document data and RAG rules (Property 3)
    - **Property 3: Validation prompt includes document data and RAG rules**
    - For any valid document JSON (varying tax rates, currencies, mandatory fields) and any non-empty `ComplianceRule[]`, verify the user prompt constructed for RAG validation contains both the document's tax rate/currency values and the compliance rules' requirement values, and the emitted event has `action: "validate"`
    - Use `fast-check` with minimum 100 iterations
    - **Validates: Requirements 3.1**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update SSE consumer in `components/invoice-chat.tsx`
  - [x] 5.1 Handle `"validate"` action type in SSE consumer
    - In the activity event handler within the SSE stream reader, ensure `"validate"` action events are processed identically to other activity events (already handled generically)
    - Verify that `reasoningText` / `content` from validate events renders in the expandable section of the `AgenticThinkingBlock`
    - No structural changes needed — the existing generic handler already supports new action types
    - _Requirements: 4.1, 4.3_

  - [ ]* 5.2 Write integration test for full thinking mode flow (mocked Bedrock)
    - Mock `callBedrockBrief` to return predefined commentary strings
    - Verify all 3 orchestrator calls fire in correct order
    - Verify activity events are emitted with correct action types and content
    - Verify Fast Mode makes zero orchestrator calls
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2, 8.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation language is TypeScript (matching the existing codebase)
- Property tests validate universal correctness properties from the design document
- All orchestrator calls are non-blocking — failures never prevent document delivery
- Fast Mode is completely unaffected (zero additional API calls or latency)
