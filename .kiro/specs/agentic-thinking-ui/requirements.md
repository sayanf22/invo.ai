# Requirements: Agentic Thinking UI

## Requirement 1: Persistent Thinking Message in Chat History

### User Story
As a user generating a document, I want to see what the AI worked on as a permanent message in the chat so that I can review the steps taken even after generation completes.

### Acceptance Criteria
- 1.1 When the user sends a message that triggers an API call, a thinking message with `role: "thinking"` is inserted into the messages array immediately after the user message. **[Property: for every API-triggered user message, a thinking message exists in the array and is never removed]**
- 1.2 The thinking message persists in the chat after generation completes — it is NOT removed when `isLoading` transitions to false. **[Property: thinking messages are never filtered out of the messages array regardless of loading state]**
- 1.3 The thinking block auto-collapses 800ms after `isComplete` becomes true, providing a smooth visual transition from active to completed state.
- 1.4 The user can expand or collapse the thinking block at any time by clicking the chevron toggle in the header.
- 1.5 As SSE progress events arrive from the server, the thinking message's `thinkingSteps` array is updated in real-time — each new step is appended with status "active" and all previously active steps transition to "completed". **[Property: at most one step has status "active" at any point in time]**
- 1.6 The AI's actual response (document data or conversational text) appears as a separate assistant message immediately following the thinking message in the chat. **[Property: in the messages array, a thinking message is always followed by an assistant message, never by another thinking message or user message]**

## Requirement 2: Contextual Progress Messages

### User Story
As a user, I want the thinking steps to show what the AI is actually doing with my specific request (country, document type, client name) so that the progress feels relevant and informative.

### Acceptance Criteria
- 2.1 The server extracts the country name from the business profile and includes it in the compliance progress label (e.g., "Loading India compliance rules" instead of "Loading compliance rules").
- 2.2 The server includes the document type in the analysis progress label (e.g., "Analyzing invoice request" instead of "Analyzing your request").
- 2.3 When a client name can be extracted from the user's prompt, it is included in the progress labels (e.g., "Analyzing invoice request for Acme Corp"). When no client name is found, the label remains valid without it.
- 2.4 The `extractContextFromPrompt` function correctly extracts client names from common prompt patterns including "for [Name]", "to [Name]", and "[Name]'s invoice". **[Property: the function always returns a valid object with country, docType, and clientName fields — never throws]**

## Requirement 3: Monochromatic Thinking Block UI

### User Story
As a user, I want the thinking block to look like a native part of the chat with a clean, minimal design so that it doesn't distract from the conversation.

### Acceptance Criteria
- 3.1 The `AgenticThinkingBlock` component uses only `foreground`, `muted-foreground`, and their opacity variants for all text and icon colors. No color utility classes (green, emerald, violet, blue, red, etc.) are present in the component. **[Property: the component's rendered class names contain no color-specific Tailwind classes]**
- 3.2 Active steps display a small spinner icon (`Loader2`, w-3 h-3) and completed steps display a small check icon (`Check`, w-3 h-3).
- 3.3 The collapsed state displays a summary header: "Worked on your {docType}" on the left and "N steps" on the right, with a chevron indicator.
- 3.4 The thinking block has no border, no card background (`bg-card`), and no box shadow — it blends seamlessly into the chat background.

## Requirement 4: Fast/Thinking Mode Toggle

### User Story
As a user, I want to switch between fast mode and thinking mode in the chat input so that I can choose speed vs. quality for my document generation.

### Acceptance Criteria
- 4.1 The input area displays an icon-only toggle button: Zap (lightning) icon for fast mode, Brain icon for thinking mode.
- 4.2 Clicking the toggle switches between "fast" and "thinking" modes, calling `onThinkingModeChange` with the new mode value.
- 4.3 The toggle uses monochromatic styling: `text-muted-foreground` by default, `text-foreground` when hovered or active. A smooth crossfade animation (200ms opacity transition) plays when switching icons.
- 4.4 The toggle is disabled (visually dimmed, non-interactive) when `isLoading` or `isUploading` is true.
- 4.5 The `thinkingMode` state in `InvoiceChat` is included in the request body sent to `/api/ai/stream`. **[Property: the thinkingMode value in the UI state always matches the value in the most recent API request body]**

## Requirement 5: Server-Side Model Selection

### User Story
As a developer, I want the server to select the correct DeepSeek model and configuration based on the thinkingMode parameter so that fast mode uses the chat model and thinking mode uses the reasoning model.

### Acceptance Criteria
- 5.1 When `thinkingMode` is "fast" or undefined, the server uses `deepseek-chat` with `temperature: 0.3`.
- 5.2 When `thinkingMode` is "thinking", the server uses `deepseek-v4-pro` with `reasoning_effort: "low"` and no explicit temperature.
- 5.3 The server validates the `thinkingMode` parameter and defaults to "fast" for any unexpected or invalid values.
- 5.4 The `AIGenerationRequest` interface in `lib/deepseek.ts` includes an optional `thinkingMode` field of type `"fast" | "thinking"`.

## Requirement 6: Error Handling for Thinking Messages

### User Story
As a user, I want the thinking block to handle errors gracefully so that a failed generation doesn't leave the UI in a broken state.

### Acceptance Criteria
- 6.1 If the SSE stream errors after some progress events, all active steps are marked "completed", `thinkingComplete` is set to true, and the error message appears as the next assistant message. The thinking block remains visible showing the steps that completed.
- 6.2 If no progress events are received before an error, the thinking message remains in the array with an empty steps list and `thinkingComplete: true`. It renders as a minimal collapsed block that doesn't distract.
