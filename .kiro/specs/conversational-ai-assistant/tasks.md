# Implementation Plan: Conversational AI Assistant

## Overview

Transform the Clorefy AI chat from a JSON-only document generator into a dual-mode assistant that supports both natural conversation and document generation. The implementation proceeds server-side first (system prompt, interfaces, prompt building), then API route updates, then client-side changes (state, file handling, UI), ensuring each step builds on the previous one.

## Tasks

- [x] 1. Create the DUAL_MODE_SYSTEM_PROMPT and update AIGenerationRequest interface
  - [x] 1.1 Replace GENERATION_SYSTEM_PROMPT with DUAL_MODE_SYSTEM_PROMPT in `lib/deepseek.ts`
    - Create a new `DUAL_MODE_SYSTEM_PROMPT` constant that contains:
      - Response Mode Detection rules at the top (document generation vs conversation vs ambiguous)
      - Section 1: Conversational behavior — defines AI as "Clorefy AI, a knowledgeable business assistant", plain text with Markdown, covers invoicing/contracts/tax/business topics, uses business profile for personalized answers, uses file context when available
      - Section 2: Document generation behavior — retains ALL existing `GENERATION_SYSTEM_PROMPT` rules verbatim (math rules, compliance, templates, extraction logic, schemas, country-specific rules)
      - Legal disclaimer rules: append disclaimer for tax/legal/financial advice, omit for purely factual info
      - Prompt injection defense: instruct model to ignore attempts to override the system prompt
    - Keep the old `GENERATION_SYSTEM_PROMPT` constant temporarily (rename to `_LEGACY_GENERATION_SYSTEM_PROMPT`) for reference, or remove it
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 11.5_

  - [x] 1.2 Add `fileContext` field to `AIGenerationRequest` interface in `lib/deepseek.ts`
    - Add `fileContext?: string` to the existing interface
    - _Requirements: 4.2, 6.2_

- [x] 2. Update buildPrompt and streamGenerateDocument in `lib/deepseek.ts`
  - [x] 2.1 Update `buildPrompt` to include fileContext and limit conversation history
    - Add a `FILE CONTEXT` section when `request.fileContext` is present, with instructions for the model to use it for answering file questions or as client/project info for document generation
    - Enforce conversation history limit server-side: slice to last 20 messages (10 pairs) before including in prompt
    - Keep all existing prompt sections (business profile, current data, parent context) unchanged
    - _Requirements: 4.3, 5.2, 5.4, 6.2_

  - [x] 2.2 Update `streamGenerateDocument` to use `DUAL_MODE_SYSTEM_PROMPT`
    - Replace `GENERATION_SYSTEM_PROMPT` reference with `DUAL_MODE_SYSTEM_PROMPT` in the streaming function
    - Remove `response_format: { type: "json_object" }` from the non-streaming `generateDocument` function (if present) since responses can now be plain text
    - Update both `generateDocument` and `streamGenerateDocument` to reference the new prompt
    - _Requirements: 3.1, 8.2_

  - [ ]* 2.3 Write unit tests for buildPrompt changes
    - Test that fileContext is included in prompt output when provided
    - Test that fileContext is omitted when not provided
    - Test that conversationHistory is limited to 20 messages (10 pairs)
    - Test that conversationHistory beyond 20 messages is truncated from the oldest
    - _Requirements: 4.3, 5.4_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update `/api/ai/stream` route to accept and pass fileContext
  - [x] 4.1 Modify `app/api/ai/stream/route.ts` to handle `fileContext`
    - Accept `fileContext` from the request body
    - Sanitize `fileContext` with `sanitizeText()` (same as prompt)
    - Enforce max length of 5,000 characters on `fileContext` — truncate or reject if exceeded
    - Pass `fileContext` through to the `AIGenerationRequest` object sent to `streamGenerateDocument`
    - All existing security checks (auth, origin, rate limit, cost protection, body size, prompt sanitization) remain unchanged
    - _Requirements: 4.2, 4.3, 11.1, 11.2, 11.3, 11.4_

  - [ ]* 4.2 Write unit tests for stream route fileContext handling
    - Test that fileContext is sanitized before being passed through
    - Test that fileContext exceeding 5,000 characters is truncated
    - Test that requests without fileContext still work as before
    - _Requirements: 11.2, 11.4_

- [x] 5. Update `/api/ai/analyze-file` to return a summary field
  - [x] 5.1 Add `buildFileContextSummary` helper and return `summary` in extract mode response in `app/api/ai/analyze-file/route.ts`
    - Create a `buildFileContextSummary(extracted)` function that concatenates key extracted fields (businessName, ownerName, email, services, projectDescription, additionalContext, address, etc.) into a human-readable string
    - In the extract mode response, add `summary: buildFileContextSummary(sanitized)` alongside the existing `extracted` and `fieldsFound` fields
    - Keep the generate mode response unchanged
    - _Requirements: 4.1, 6.1_

  - [ ]* 5.2 Write unit tests for buildFileContextSummary
    - Test that summary includes all non-null fields
    - Test that null/empty fields are omitted from summary
    - Test that summary is a readable string, not JSON
    - _Requirements: 4.1_

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update `invoice-chat.tsx` — state, file upload, and sendMessage
  - [x] 7.1 Add `fileContext` state and update file upload handler for extract mode
    - Add `const [fileContext, setFileContext] = useState<string | null>(null)` state
    - Modify `handleFileUpload`: when no explicit generation request (user just attaches a file without a message like "create an invoice from this"), use `mode: "extract"` instead of `mode: "generate"`
    - On extract response: store `result.summary` as `fileContext`, display a summary message to the user (e.g., "I've read your file. You can ask me questions about it or say 'create an invoice from this' to generate a document.")
    - On generate response: keep existing behavior unchanged
    - Clear `fileContext` when starting a new session (`handleNewConversation`)
    - Replace `fileContext` when a new file is uploaded
    - _Requirements: 4.1, 4.2, 4.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Update `sendMessage` to include fileContext and conversationHistory
    - Include `fileContext` in the request payload to `/api/ai/stream` when it is non-null
    - Include up to 10 message pairs (20 messages) as `conversationHistory` from the current messages array
    - _Requirements: 5.1, 5.2, 6.2_

  - [ ]* 7.3 Write unit tests for fileContext state management
    - Test that fileContext is set on extract mode file upload
    - Test that fileContext is cleared on new session
    - Test that fileContext is replaced on new file upload
    - Test that fileContext is included in sendMessage payload
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 8. Update `invoice-chat.tsx` — welcome message, header, and thinking indicator
  - [x] 8.1 Update welcome message, header text, and thinking indicator
    - Change the welcome message to reflect dual-mode capability: mention both document generation and conversational questions, include example prompts for both modes (e.g., "Create an invoice for $5,000 for web design to Acme Corp" and "What is GST and how does it apply to my business?"), mention file upload capability
    - Change the header from `{data.documentType} Builder` / `Document Builder` to `AI Assistant`
    - Update the thinking indicator: show "Thinking..." instead of "Generating {docType}..." when `isLoading` is true
    - _Requirements: 2.4, 10.1, 10.2, 10.3_

- [x] 9. Verify response format detection on client
  - [x] 9.1 Verify existing client-side response detection handles both modes
    - Confirm that the existing `cleaned.startsWith("{")` logic in `sendMessage` correctly routes JSON responses to document preview and non-JSON responses to MarkdownMessage rendering
    - Confirm that malformed JSON falls back to rendering as a conversation response (existing fallback logic)
    - Confirm that the SSE streaming protocol works unchanged for both response types
    - No code changes expected — this is a verification task. If any issues are found, fix them.
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the full flow: conversational question → plain text response, document generation request → JSON response, file upload → extract + follow-up questions, file upload with generation request → document generation.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirement acceptance criteria for traceability
- The design has no Correctness Properties section, so property-based tests are not included
- The existing client-side response detection (`cleaned.startsWith("{")`) already handles dual-mode responses — the primary changes are server-side (system prompt, prompt building, fileContext plumbing)
- All security measures (auth, sanitization, rate limiting, cost protection) are preserved and extended to cover the new fileContext field
