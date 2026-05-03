# Implementation Plan: AI Dual-Model Chat

## Overview

This plan hardens and tests the existing dual-model AI architecture. Most code already exists across `app/api/ai/stream/route.ts`, `lib/bedrock.ts`, `lib/deepseek.ts`, `components/ui/agentic-thinking-block.tsx`, `components/ui/ai-input-with-loading.tsx`, and `components/invoice-chat.tsx`. Tasks focus on refining the intent router, strengthening error handling and fallback logic, ensuring activity stream correctness, verifying UI behavior, and writing comprehensive property-based and unit tests.

## Tasks

- [x] 1. Harden intent router and extract as testable function
  - [x] 1.1 Extract intent classification logic into a pure, exported function in `lib/intent-router.ts`
    - Move the regex-based `isDocGeneration` logic from `app/api/ai/stream/route.ts` into a standalone `classifyIntent(prompt: string): "document" | "chat"` function
    - Import and call it from the route handler, replacing the inline logic
    - Ensure the function is stateless and has no side effects
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Write property test for intent classification (Property 1)
    - **Property 1: Intent classification follows priority rules**
    - Generate random prompts with controlled presence of generation verbs and question words using `fast-check` string combinators
    - Verify: generation verbs without question-only patterns → `"document"`
    - Verify: question words without generation verbs → `"chat"`
    - Verify: both present → `"document"` (generation takes priority)
    - Verify: neither present → `"chat"` (default)
    - Minimum 100 iterations
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.3 Write unit tests for intent classification edge cases
    - Test empty string → `"chat"`
    - Test single word prompts ("hello", "create", "what")
    - Test mixed intent: "can you create an invoice" → `"document"`
    - Test question-only: "what is GST" → `"chat"`
    - Test ambiguous: "invoice" (no verb) → `"chat"`
    - Test long prompts with both patterns
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Harden Bedrock client error handling and fallback mechanism
  - [x] 2.1 Strengthen error handling in `lib/bedrock.ts`
    - Add handling for HTTP 500/502/503 status codes (yield error, trigger fallback)
    - Add a request timeout using `AbortController` (30 second timeout)
    - Fix the typo in the error message: "Set amazon_beadrocl_key" → keep env var name but fix the message text to say "Bedrock API key"
    - Ensure the SSE buffer is flushed after the read loop ends (process any remaining data in `sseBuffer`)
    - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.4, 11.1_

  - [x] 2.2 Harden fallback logic in `app/api/ai/stream/route.ts`
    - Ensure partial content from Kimi is discarded on fallback — verify no `chunk` events from the failed Bedrock stream reach the client by tracking a `bedrockChunksForwarded` flag and only forwarding chunks when fallback hasn't triggered
    - Expand the fallback trigger condition to also catch HTTP 500/502/503 errors and timeout errors from Bedrock
    - Update the activity stream to emit "DeepSeek (fallback)" detail when fallback activates
    - Ensure usage tracking (`trackUsage`, `incrementDocumentCount`, `logAIGeneration`) only runs once after the successful model completes
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 9.4_

  - [x] 2.3 Write property test for API key validation boundary (Property 4)
    - **Property 4: API key validation boundary at 10 characters**
    - Generate random strings of length 0–50 using `fc.string()`
    - Verify: strings with length < 10 → guard evaluates to `false` (skip Kimi)
    - Verify: strings with length >= 10 → guard evaluates to `true` (attempt Kimi)
    - Test the exact boundary: 9-char string → false, 10-char string → true
    - Minimum 100 iterations
    - **Validates: Requirements 4.3**

  - [x] 2.4 Write unit tests for fallback scenarios
    - Mock `streamBedrockChat` returning 401 error → verify fallback to DeepSeek triggers
    - Mock `streamBedrockChat` returning 429 error → verify fallback triggers
    - Mock `streamBedrockChat` throwing network error → verify fallback triggers
    - Mock both models failing → verify single error event emitted
    - Verify partial Bedrock content is not forwarded to client on fallback
    - Verify activity stream shows "DeepSeek (fallback)" after fallback
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 8.4, 8.5_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Verify and harden activity stream and SSE protocol
  - [x] 4.1 Audit activity stream events in `app/api/ai/stream/route.ts`
    - Verify each `sendEvent({ type: "activity", ... })` call corresponds to a real operation (no hardcoded/simulated events)
    - Ensure the business profile activity updates its `detail` field after fetch completes (with business name or "Not found")
    - Ensure compliance search activity only emits when `country` is non-empty
    - Ensure document number activity emits the generated number as `detail`
    - Ensure model activity emits correct model name ("DeepSeek", "Kimi K2.5", or "DeepSeek (fallback)")
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 4.2 Verify SSE protocol compliance in route handler
    - Confirm response headers include `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
    - Confirm `controller.close()` is called in the `finally` block
    - Confirm `data: [DONE]` lines are skipped in both server-side parsers (`lib/bedrock.ts` and `lib/deepseek.ts`)
    - Confirm malformed JSON lines are caught and skipped without throwing
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.3 Write property test for SSE parser chunk reassembly (Property 5)
    - **Property 5: SSE parser correctly reassembles events across arbitrary chunk boundaries**
    - Generate random arrays of valid SSE event objects, serialize them as `data: {json}\n\n`
    - Split the concatenated byte stream at random positions into chunks using `fc.array(fc.nat())`
    - Feed chunks sequentially through the SSE line-buffering parser (extract the parser logic into a testable function)
    - Verify: parsed events match the original event objects exactly
    - Intersperse malformed JSON lines and verify they are skipped without affecting valid events
    - Minimum 100 iterations
    - **Validates: Requirements 2.2, 2.3, 3.4, 11.1, 11.3**

  - [x] 4.4 Write unit tests for activity stream events
    - Test that business profile fetch emits `action: "read"` with correct label and detail
    - Test that compliance search emits `action: "search"` only when country is present
    - Test that document number emits `action: "generate"` with the number as detail
    - Test that model routing emits correct model name in activity detail
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5. Verify buildPrompt context inclusion and code fence stripping
  - [x] 5.1 Audit `buildPrompt()` in `lib/deepseek.ts` for context completeness
    - Verify business profile fields (name, country, currency, address, tax status) are included when provided
    - Verify compliance context is included when provided
    - Verify conversation history (last 20 messages) is included when provided
    - Verify file context is included when provided
    - Verify parent context is included when provided
    - Verify document type and current date are always included
    - _Requirements: 3.1_

  - [x] 5.2 Write property test for buildPrompt context inclusion (Property 2)
    - **Property 2: buildPrompt includes all provided context sections**
    - Generate random `AIGenerationRequest` objects with `fc.record()` containing non-empty business profiles, compliance context, conversation history, and file context
    - Verify: output contains business name, country, currency, and document type
    - Verify: if `complianceContext` is provided, output contains it
    - Verify: if `conversationHistory` is provided, output contains at least the last message
    - Verify: if `fileContext` is provided, output contains it
    - Minimum 100 iterations
    - **Validates: Requirements 3.1**

  - [x] 5.3 Write property test for code fence stripping (Property 3)
    - **Property 3: Code fence stripping preserves inner content**
    - Generate random non-empty content strings that do not contain "```" using `fc.string().filter(s => !s.includes('```') && s.trim().length > 0)`
    - Wrap in `` ```json\n{content}\n``` `` and `` ```\n{content}\n``` `` patterns
    - Apply the stripping logic from `lib/deepseek.ts`
    - Verify: trimmed result equals the original trimmed content
    - Minimum 100 iterations
    - **Validates: Requirements 3.5**

  - [x] 5.4 Write unit tests for thinking mode model selection
    - Test `thinkingMode: "fast"` → uses `deepseek-chat` model, no `reasoning` events
    - Test `thinkingMode: "thinking"` → uses `deepseek-v4-pro` model, emits `reasoning` events
    - Test invalid `thinkingMode` value → defaults to "fast"
    - Test `thinkingMode` undefined → defaults to "fast"
    - _Requirements: 3.2, 3.3, 7.1, 7.2, 7.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Verify AgenticThinkingBlock UI and thinking mode toggle
  - [x] 7.1 Verify monochromatic styling in `components/ui/agentic-thinking-block.tsx`
    - Confirm all icons use `text-muted-foreground` (no colored icons)
    - Confirm icon backgrounds use `bg-muted/50`
    - Confirm the vertical dotted connecting line renders only when `activities.length > 1`
    - Confirm pulse animation applies only to the last row when `isWorking` is true
    - Confirm expandable rows work for "think" activities with `reasoningText`
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7_

  - [x] 7.2 Verify thinking mode toggle in `components/ui/ai-input-with-loading.tsx`
    - Confirm the toggle switches between Zap (fast) and Brain (thinking) icons
    - Confirm the toggle is disabled during loading/uploading states
    - Confirm the toggle state is managed by the parent component and defaults to "fast"
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 7.3 Write property test for AgenticThinkingBlock row count (Property 6)
    - **Property 6: AgenticThinkingBlock renders one row per activity**
    - Generate random arrays of `ActivityItem` objects with unique ids, valid actions, and labels using `fc.array(fc.record(...))`
    - Render the component with `@testing-library/react`
    - Verify: the number of rendered activity rows (buttons) equals `activities.length`
    - Verify: each row contains its corresponding label text
    - Minimum 100 iterations
    - **Validates: Requirements 6.1**

  - [x] 7.4 Write unit tests for AgenticThinkingBlock behavior
    - Test empty activities array → renders nothing (returns null)
    - Test single activity → no vertical connecting line
    - Test multiple activities → vertical connecting line present
    - Test `isWorking: true` → last row has pulse animation
    - Test `isWorking: false` → no pulse animation
    - Test expandable "think" row → clicking toggles reasoning text visibility
    - Test persistence: component remains in DOM after `isWorking` transitions from true to false
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

- [x] 8. Verify edge runtime compatibility
  - [x] 8.1 Audit edge runtime compatibility of `lib/bedrock.ts`, `lib/deepseek.ts`, and `app/api/ai/stream/route.ts`
    - Verify no imports of Node.js-specific modules (`http`, `https`, `net`, `tls`, `crypto`, `stream`, `Buffer`)
    - Verify all HTTP requests use the Web Fetch API
    - Verify streaming uses `ReadableStream` + `TextEncoder` (not Node.js streams)
    - Verify Bedrock API key access works via both `process.env` and `globalThis` for Cloudflare Workers
    - Verify the env var name `amazon_beadrocl_key` (with typo) is used consistently
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.2 Write unit tests for edge runtime compatibility
    - Scan `lib/bedrock.ts` source for forbidden Node.js imports (`require('http')`, `require('https')`, `import ... from 'net'`, etc.)
    - Scan `lib/deepseek.ts` source for forbidden Node.js imports
    - Scan `app/api/ai/stream/route.ts` source for forbidden Node.js imports
    - Verify `ReadableStream` and `TextEncoder` are used (not `stream.Readable`)
    - _Requirements: 10.1, 10.2, 10.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Since most code already exists, tasks 1.1, 2.1, 2.2, 4.1, 4.2, 5.1, 7.1, 7.2, and 8.1 focus on verifying and hardening existing code rather than building from scratch
- The SSE parser property test (4.3) requires extracting the line-buffering logic into a testable helper function
- All tests use `vitest` + `fast-check` (both already installed and configured)
