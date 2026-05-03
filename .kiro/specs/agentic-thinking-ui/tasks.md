# Tasks: Agentic Thinking UI

## Task 1: Rewrite AgenticThinkingBlock Component
> Requirement: 1, 3

- [x] 1.1 Rewrite `components/ui/agentic-thinking-block.tsx` with new `ThinkingStep` interface (`id`, `label`, `status`) and `AgenticThinkingBlockProps` (`steps`, `isComplete`, `className`)
- [x] 1.2 Implement collapsible header with ChevronDown toggle, summary text ("Worked on your document"), and step count ("N steps")
- [x] 1.3 Implement expanded state rendering steps as clean bullet points — Loader2 spinner for active, Check icon for completed, monochromatic colors only
- [x] 1.4 Implement auto-collapse behavior: collapse 800ms after `isComplete` transitions to true, with cleanup on unmount
- [x] 1.5 Remove all colored icon classes (emerald, green, violet) and card/border/shadow styling — use only foreground/muted-foreground

## Task 2: Add Fast/Thinking Mode Toggle to Input
> Requirement: 4

- [x] 2.1 Add `thinkingMode` and `onThinkingModeChange` props to `AIInputWithLoadingProps` interface in `components/ui/ai-input-with-loading.tsx`
- [x] 2.2 Render icon-only toggle button (Zap for fast, Brain for thinking) positioned between the attach button and the send button
- [x] 2.3 Implement smooth crossfade animation (200ms opacity transition) between Zap and Brain icons on toggle
- [x] 2.4 Apply monochromatic styling (muted-foreground default, foreground on hover/active) and disabled state when isLoading or isUploading

## Task 3: Integrate Thinking Messages into InvoiceChat
> Requirement: 1, 4, 6

- [x] 3.1 Extend the messages type in `components/invoice-chat.tsx` to include `role: "thinking"`, `thinkingSteps`, and `thinkingComplete` fields
- [x] 3.2 Add `thinkingMode` state (default "fast") and pass it to `AIInputWithLoading` as props
- [x] 3.3 In `sendMessage`, insert a thinking message into the messages array immediately after the user message, before the API call
- [x] 3.4 Update SSE progress event handler to find the active thinking message and update its `thinkingSteps` array (mark previous active as completed, append new active step)
- [x] 3.5 On stream complete or error, mark the thinking message as `thinkingComplete: true` and mark all active steps as completed
- [x] 3.6 Remove the old conditional rendering of `AgenticThinkingBlock` (the `isLoading || agenticSteps.length > 0` block) and render thinking messages inline in the messages loop
- [x] 3.7 Remove the standalone `agenticSteps` state variable since steps are now stored in the messages array
- [x] 3.8 Include `thinkingMode` in the API request body sent to `/api/ai/stream`

## Task 4: Server-Side Contextual Progress Messages
> Requirement: 2, 5

- [x] 4.1 Add `thinkingMode` optional field to `AIGenerationRequest` interface in `lib/deepseek.ts`
- [x] 4.2 Implement `extractContextFromPrompt()` function in `app/api/ai/stream/route.ts` that extracts country (from businessContext), document type, and client name (from prompt regex) 
- [x] 4.3 Replace the three generic `sendEvent` progress calls in the stream route with contextual labels using extracted country, docType, and clientName
- [x] 4.4 Implement `getModelConfig()` function that maps thinkingMode to DeepSeek model/temperature/reasoning_effort configuration
- [x] 4.5 Update `streamGenerateDocument` in `lib/deepseek.ts` to accept and use the thinkingMode parameter for model selection, with server-side validation defaulting invalid values to "fast"
