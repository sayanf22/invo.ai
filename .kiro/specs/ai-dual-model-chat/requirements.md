# Requirements Document

## Introduction

This feature implements a dual-model AI architecture where Kimi K2.5 (via Amazon Bedrock Mantle) handles all conversational chat responses and DeepSeek handles all document generation (invoices, contracts, quotations, proposals). The system includes robust model routing, seamless fallback from Kimi to DeepSeek, real-time agentic thinking UI with activity tracking, and proper cost/error handling for both models. The implementation must be edge-runtime compatible for Cloudflare Workers deployment.

## Glossary

- **Router**: The server-side logic in `app/api/ai/stream/route.ts` that determines whether a user message should be handled by the Chat_Model or the Document_Model.
- **Chat_Model**: Kimi K2.5 accessed via Amazon Bedrock Mantle's OpenAI-compatible endpoint (`moonshotai.kimi-k2.5`), used for conversational responses.
- **Document_Model**: DeepSeek accessed via the DeepSeek API, used for structured document generation. Uses `deepseek-chat` in fast mode and `deepseek-v4-pro` in thinking mode.
- **Fallback_Handler**: The mechanism that detects Chat_Model failures (auth errors, rate limits, timeouts, network errors) and transparently reroutes the request to the Document_Model.
- **Activity_Stream**: The sequence of SSE events with `type: "activity"` sent from the server to the client during request processing, representing real operations (reading profile, searching compliance, generating).
- **Thinking_Block**: The `AgenticThinkingBlock` UI component that renders the Activity_Stream as an expandable timeline in the chat interface.
- **SSE**: Server-Sent Events protocol used for streaming AI responses from server to client.
- **Reasoning_Token**: Chain-of-thought tokens emitted by DeepSeek's thinking model (`deepseek-v4-pro`) via the `reasoning_content` field, displayed in the Thinking_Block.
- **Thinking_Mode**: A user-togglable setting (`fast` or `thinking`) that controls whether the Document_Model uses reasoning tokens.
- **Edge_Runtime**: The Cloudflare Workers execution environment where the application runs in production.

## Requirements

### Requirement 1: Model Routing

**User Story:** As a user, I want my chat questions answered by a fast conversational model and my document requests handled by a specialized generation model, so that I get the best response quality for each type of interaction.

#### Acceptance Criteria

1. WHEN a user message matches document generation intent (contains verbs like "create", "generate", "make", "build", "draft", "prepare", "change", "update", "add", "remove", "modify" combined with document context), THE Router SHALL route the request to the Document_Model.
2. WHEN a user message matches conversational intent (contains question words like "what", "how", "why", "explain", "tell me" without document generation verbs), THE Router SHALL route the request to the Chat_Model.
3. WHEN a user message is ambiguous and does not clearly match either document generation or conversational intent, THE Router SHALL default to the Chat_Model for a conversational response.
4. WHEN a user message contains both question words and document generation verbs (e.g., "can you create an invoice"), THE Router SHALL prioritize document generation intent and route to the Document_Model.
5. THE Router SHALL evaluate intent classification on every incoming message independently, without relying on prior message classifications in the session.

### Requirement 2: Kimi K2.5 Chat Integration

**User Story:** As a user, I want fast and accurate conversational responses from Kimi K2.5, so that my business questions are answered quickly without unnecessary document generation overhead.

#### Acceptance Criteria

1. WHEN the Router classifies a message as conversational, THE Chat_Model SHALL receive the DUAL_MODE_SYSTEM_PROMPT as the system message and the user-context prompt built by `buildPrompt()` as the user message.
2. WHEN the Chat_Model streams a response, THE Chat_Model SHALL emit SSE events with `type: "chunk"` containing incremental text content parsed from the OpenAI-compatible streaming format.
3. WHEN the Chat_Model finishes streaming, THE Chat_Model SHALL emit a single SSE event with `type: "complete"` containing the full accumulated response text.
4. THE Chat_Model SHALL use the Bedrock Mantle endpoint at `https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions` with model identifier `moonshotai.kimi-k2.5`.
5. THE Chat_Model SHALL send requests with `max_tokens: 2000`, `temperature: 0.3`, and `stream: true` parameters.
6. THE Chat_Model SHALL authenticate using the `amazon_beadrocl_key` API key passed via the Authorization Bearer header.

### Requirement 3: DeepSeek Document Generation

**User Story:** As a user, I want my document generation requests handled by DeepSeek with structured JSON output, so that invoices, contracts, quotations, and proposals are generated accurately with proper compliance data.

#### Acceptance Criteria

1. WHEN the Router classifies a message as document generation, THE Document_Model SHALL receive the full DUAL_MODE_SYSTEM_PROMPT and user-context prompt including business profile, compliance context, and document number.
2. WHEN Thinking_Mode is set to "fast", THE Document_Model SHALL use the `deepseek-chat` model with `temperature: 0.3` and no reasoning tokens.
3. WHEN Thinking_Mode is set to "thinking", THE Document_Model SHALL use the `deepseek-v4-pro` model with `reasoning_effort: "low"` and SHALL emit Reasoning_Tokens as SSE events with `type: "reasoning"`.
4. THE Document_Model SHALL emit SSE events with `type: "chunk"` for incremental content and `type: "complete"` for the final cleaned response.
5. THE Document_Model SHALL strip markdown code fences (`\`\`\`json` and `\`\`\``) from the final response before emitting the `complete` event.

### Requirement 4: Fallback Mechanism

**User Story:** As a user, I want my chat requests to still work when Kimi K2.5 is unavailable, so that I always get a response regardless of individual model availability.

#### Acceptance Criteria

1. WHEN the Chat_Model returns an HTTP 401 or 403 status code, THE Fallback_Handler SHALL reroute the request to the Document_Model without user intervention.
2. WHEN the Chat_Model returns an HTTP 429 status code (rate limit), THE Fallback_Handler SHALL reroute the request to the Document_Model without user intervention.
3. WHEN the Chat_Model API key is missing or has fewer than 10 characters, THE Router SHALL skip the Chat_Model entirely and route directly to the Document_Model.
4. WHEN the Chat_Model encounters a network error or throws an exception during streaming, THE Fallback_Handler SHALL reroute the request to the Document_Model.
5. WHEN the Fallback_Handler activates, THE Activity_Stream SHALL emit an activity event updating the "Responding" label detail from "Kimi K2.5" to "DeepSeek (fallback)" so the user sees which model is responding.
6. WHEN the Fallback_Handler reroutes to the Document_Model, THE Fallback_Handler SHALL discard any partial content received from the Chat_Model before starting the Document_Model stream.

### Requirement 5: Real-Time Activity Stream

**User Story:** As a user, I want to see what the AI is doing in real-time (reading my profile, searching compliance rules, generating), so that I understand the process and trust the output.

#### Acceptance Criteria

1. WHEN the server begins processing a request, THE Activity_Stream SHALL emit an activity event with `action: "read"` and `label: "Business profile"` before fetching the business profile from Supabase.
2. WHEN the business profile fetch completes, THE Activity_Stream SHALL update the activity event with a `detail` field containing the business name or "Not found".
3. WHEN the server fetches compliance rules for a known country, THE Activity_Stream SHALL emit an activity event with `action: "search"` and `label` containing the country name and "compliance rules".
4. WHEN compliance rule fetching completes, THE Activity_Stream SHALL update the activity event with a `detail` field containing the number of rules found and the tax rate if available.
5. WHEN the server generates a document number, THE Activity_Stream SHALL emit an activity event with `action: "generate"` and `label: "Document number"` with the generated number as `detail`.
6. WHEN the server begins streaming from either model, THE Activity_Stream SHALL emit an activity event with `action: "generate"` and `label` indicating the operation ("Generating document" or "Responding") with `detail` indicating the model name ("DeepSeek", "Kimi K2.5", or "DeepSeek (fallback)").
7. THE Activity_Stream SHALL only emit events for operations that are actually being performed; the server SHALL NOT emit hardcoded or simulated activity events.

### Requirement 6: Agentic Thinking Block UI

**User Story:** As a user, I want to see a collapsible activity timeline in the chat that persists after generation completes, so that I can review what the AI did at any time.

#### Acceptance Criteria

1. WHEN the Activity_Stream emits events during processing, THE Thinking_Block SHALL render each activity as a row with an icon, label, and optional detail text.
2. WHILE the server is still processing (no `complete` or `error` event received), THE Thinking_Block SHALL show a pulse animation on the last activity row to indicate ongoing work.
3. WHEN the server emits a `complete` or `error` event, THE Thinking_Block SHALL stop the pulse animation and set `isWorking` to false.
4. WHEN processing completes, THE Thinking_Block SHALL remain visible in the chat history as a collapsible element above the assistant's response message.
5. WHEN a "think" activity contains Reasoning_Tokens, THE Thinking_Block SHALL allow expanding that row to reveal the reasoning text with a streaming cursor while tokens are still arriving.
6. THE Thinking_Block SHALL use monochromatic styling with `text-muted-foreground` for icons and `bg-muted/50` for icon backgrounds, with no colored icons.
7. THE Thinking_Block SHALL render a vertical dotted connecting line between activity rows when more than one activity is present.

### Requirement 7: Thinking Mode Toggle

**User Story:** As a user, I want to switch between fast mode and thinking mode, so that I can choose between speed and deeper reasoning for document generation.

#### Acceptance Criteria

1. WHEN the user selects "fast" mode, THE system SHALL send `thinkingMode: "fast"` to the server, and the Document_Model SHALL use `deepseek-chat` with no reasoning tokens.
2. WHEN the user selects "thinking" mode, THE system SHALL send `thinkingMode: "thinking"` to the server, and the Document_Model SHALL use `deepseek-v4-pro` with reasoning tokens streamed to the client.
3. WHEN Reasoning_Tokens are received from the Document_Model in thinking mode, THE Thinking_Block SHALL display them in an expandable "Think" activity row with live-updating text.
4. WHEN the user is in "fast" mode, THE server SHALL NOT emit any `type: "reasoning"` SSE events.
5. THE Thinking_Mode toggle SHALL persist its state within the current browser session and default to "fast" on initial load.

### Requirement 8: Error Handling

**User Story:** As a user, I want clear error messages when something goes wrong with either AI model, so that I understand the issue and know what to do next.

#### Acceptance Criteria

1. WHEN the Chat_Model returns an HTTP 401 or 403 error and the Fallback_Handler also fails, THE system SHALL display an error message indicating the API key is invalid or expired.
2. WHEN the Document_Model returns an HTTP 402 error (insufficient credits), THE system SHALL display an error message indicating insufficient credits with a link to the DeepSeek platform.
3. WHEN the Document_Model returns an HTTP 429 error (rate limit), THE system SHALL display an error message asking the user to wait and try again.
4. IF both the Chat_Model and the Document_Model fail for the same request, THEN THE system SHALL display a single consolidated error message from the last model that attempted the request.
5. WHEN an error occurs during streaming after partial content has been received, THE system SHALL discard the partial content and display the error message instead of showing incomplete output.
6. THE system SHALL log all model errors to the server console with the model name, error type, and status code for debugging purposes.

### Requirement 9: Cost Tracking

**User Story:** As a user on a tiered plan, I want my AI usage tracked accurately across both models, so that my usage limits are enforced fairly regardless of which model handles my request.

#### Acceptance Criteria

1. WHEN a request completes successfully via either the Chat_Model or the Document_Model, THE system SHALL call `trackUsage()` to record the generation in the user's monthly usage.
2. WHEN a request completes successfully, THE system SHALL call `incrementDocumentCount()` to count the document toward the user's tier limit.
3. WHEN a request completes successfully, THE system SHALL call `logAIGeneration()` to create an audit log entry with the document type and request metadata.
4. WHEN the Fallback_Handler reroutes from the Chat_Model to the Document_Model, THE system SHALL track usage only once for the successful model response, not for the failed attempt.
5. THE system SHALL enforce tier-based document limits (`checkCostLimit`) and message limits (`checkMessageLimit`) before routing to either model.

### Requirement 10: Edge Runtime Compatibility

**User Story:** As a developer, I want the dual-model implementation to work on Cloudflare Workers, so that the application deploys and runs correctly in the production environment.

#### Acceptance Criteria

1. THE Router, Chat_Model client, Document_Model client, and Fallback_Handler SHALL use only the Web Fetch API for HTTP requests, with no dependency on Node.js-specific modules (http, https, net, tls).
2. THE SSE streaming implementation SHALL use `ReadableStream` with `TextEncoder` for response construction, compatible with the Cloudflare Workers runtime.
3. THE system SHALL access the Bedrock API key via `process.env.amazon_beadrocl_key` or the Cloudflare Workers global scope (`globalThis`), supporting both local development and production deployment.
4. THE system SHALL NOT use Node.js `Buffer`, `crypto`, or `stream` modules in any code path executed during request handling.
5. THE system SHALL handle the Bedrock API key environment variable name `amazon_beadrocl_key` (with the existing typo preserved) consistently across all environments.

### Requirement 11: SSE Protocol Compliance

**User Story:** As a developer, I want the SSE streaming to handle edge cases correctly, so that responses are never corrupted or lost due to network chunking.

#### Acceptance Criteria

1. THE SSE parser on both server (for upstream model responses) and client (for downstream responses) SHALL buffer incomplete lines across TCP chunks before attempting JSON parsing.
2. WHEN an SSE line contains `data: [DONE]`, THE parser SHALL treat it as end-of-stream and not attempt JSON parsing.
3. WHEN an SSE line contains malformed JSON, THE parser SHALL skip that line and continue processing subsequent lines without throwing an error.
4. THE server SHALL set response headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive` on all streaming responses.
5. THE server SHALL close the ReadableStream controller in a `finally` block to ensure cleanup occurs even when errors are thrown during processing.
