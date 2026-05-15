# Implementation Plan: Chat-First Document Flow

## Overview

Implements the chat-first document flow: a new chat-only screen sits between the start screen and the existing split-screen. The AI classifies intent on every start-screen submission — explicit create requests go straight to the split-screen (unchanged behavior), while questions, ambiguous prompts, and mismatched requests route through the new chat-only screen. Chat-only sessions are persisted to the DB, shown in history, and promoted to typed document sessions (consuming 1 quota slot) when the user confirms creation.

## Tasks

- [x] 1. Database migration and intent classifier extension
  - [x] 1.1 Create `supabase/migrations/chat_session_type.sql` — add index on `document_sessions` for `document_type = 'chat'` and add column comment
  - [x] 1.2 Apply migration to Supabase project via `mcp_supabase_apply_migration`
  - [x] 1.3 Extend `lib/intent-router.ts` — add `IntentRoute` type, `IntentResult` interface, and `classifyIntentFull()` function returning `document-explicit | chat | ambiguous` with `suggestedType` and `confidence`
  - [x] 1.4 Add mismatch detection rules array `MISMATCH_RULES` to `lib/intent-router.ts` and export `detectMismatch(prompt, requestedType)` function covering the 4 patterns from requirements §4
  - [x] 1.5 Write unit tests for `classifyIntentFull` and `detectMismatch` covering: 3 explicit-create prompts, 3 question prompts, 3 ambiguous prompts, and all 4 mismatch patterns

- [x] 2. New API endpoints
  - [x] 2.1 Create `app/api/sessions/create-chat/route.ts` — POST endpoint that creates a `document_sessions` row with `document_type = 'chat'`, skips all quota checks, saves optional `initialPrompt` as first `chat_messages` row, returns `{ success, session }`
  - [x] 2.2 Create `app/api/sessions/promote/route.ts` — POST endpoint that atomically runs `checkDocumentLimit`, `checkDocumentTypeAllowed`, updates `document_sessions.document_type` from `'chat'` to target type, calls `incrementDocumentCount`, returns `{ success, session }` or existing 429/403 error shapes
  - [x] 2.3 Extend `app/api/ai/detect-type/route.ts` — add `route: "direct-create" | "chat-only"` and optional `mismatch: { requestedType, suggestedType, reason }` fields to the response, using `classifyIntentFull` and `detectMismatch`

- [x] 3. Stream endpoint changes
  - [x] 3.1 In `app/api/ai/stream/route.ts`, add handling for `documentType === 'chat'`: skip `checkDocumentLimit`, `checkMessageLimit`, `checkDocumentTypeAllowed`; use chat-only system prompt; route to conversational model; do not generate document JSON; do not call `incrementDocumentCount`
  - [x] 3.2 In `app/api/ai/stream/route.ts`, add mismatch pre-flight check using `detectMismatch` — when mismatch fires, emit `{ type: "mismatch-redirect", requestedType, suggestedType, reason, initialMessage }` SSE event and close stream without calling AI
  - [x] 3.3 Define the chat-only system prompt constant — instructs AI to respond conversationally, suggest doc types, include `[CREATE_CARD:{...}]` signal on confirmation, redirect mismatches

- [x] 4. Create card component
  - [x] 4.1 Create `components/chat-create-card.tsx` — renders document type icon, summary line, and "Create [Type]" button; accepts `documentType`, `summary`, `isCreating`, `onConfirm` props; uses monochromatic styling (`bg-foreground text-background` button, no accent colors); shows spinner + "Creating…" while `isCreating`

- [x] 5. Chat-only screen component
  - [x] 5.1 Create `components/chat-only-screen.tsx` — full-width chat surface with header (back button + InvoLogo + HamburgerMenu), scrollable message list, and text input; accepts `initialPrompt`, `onBack`, `onPromote`, optional `resumeSessionId` props
  - [x] 5.2 Implement session lifecycle in `ChatOnlyScreen`: on mount call `POST /api/sessions/create-chat` (or load `resumeSessionId` from DB), store `sessionId`, send `initialPrompt` to `/api/ai/stream` with `documentType = 'chat'`
  - [x] 5.3 Implement message sending in `ChatOnlyScreen`: save user message to `chat_messages` via Supabase client, stream to `/api/ai/stream`, parse `[CREATE_CARD:{...}]` signal from AI response, strip signal from displayed text, set `createCard` on message object
  - [x] 5.4 Implement confirmation detection in `ChatOnlyScreen`: when previous AI message contained a doc suggestion and user message matches `CONFIRMATION_TOKENS`, append hint to prompt sent to AI
  - [x] 5.5 Implement `mismatch-redirect` SSE event handling in `ChatOnlyScreen`: render the `initialMessage` from the event as the first AI message (with embedded Create card if present)
  - [x] 5.6 Implement Create card click handler in `ChatOnlyScreen`: set `isCreating = true`, call `POST /api/sessions/promote`, on success call `onPromote({ sessionId, documentType, initialPrompt })`, on 429/403 render inline upgrade card in chat
  - [x] 5.7 Apply monochromatic styling throughout `ChatOnlyScreen`: only `background`, `foreground`, `muted`, `muted-foreground`, `border`, `card` tokens; no accent/primary colors in chat bubbles, input, or chrome
  - [x] 5.8 Implement explicit mid-chat create detection: when user types a message matching strong generation verb + doc type keyword, call `POST /api/sessions/promote` immediately without waiting for Create card

- [x] 6. AppShell view state machine update
  - [x] 6.1 Add `"chat-only"` to the `View` type in `components/app-shell.tsx`; add `chatOnlyPrompt` and `chatOnlySessionId` state
  - [x] 6.2 Update `handlePromptSubmit` in `AppShell`: use the new `route` field from `/api/ai/detect-type` response — if `"direct-create"` proceed as today, if `"chat-only"` set `chatOnlyPrompt` and `setView("chat-only")`
  - [x] 6.3 Add `handlePromote` callback in `AppShell`: receives `{ sessionId, documentType, initialPrompt }`, sets `selectedSessionId`, `selectedCategory`, `initialPrompt`, increments `promptKey`, calls `setView("prompt")`
  - [x] 6.4 Update `handleSessionSelect` in `AppShell`: after loading session type, if `document_type === 'chat'` set `chatOnlySessionId` and `setView("chat-only")`; otherwise existing behavior
  - [x] 6.5 Render `ChatOnlyScreen` in `AppShell` when `view === "chat-only"`, passing all required props

- [x] 7. Split-animation
  - [x] 7.1 Add `isAnimating` prop to `PromptScreen` and apply CSS transition to the desktop chat column width (starts at `100%` when `isAnimating`, transitions to `420px` over 450ms with `cubic-bezier(0.32,0.72,0,1)`)
  - [x] 7.2 Apply simultaneous `opacity` + `translateX` transition to the preview panel in `PromptScreen` (starts hidden, fades in as chat column shrinks)
  - [x] 7.3 In `AppShell`, set `isAnimating = true` when transitioning from `chat-only` to `prompt`, then set `isAnimating = false` after 450ms

- [x] 8. History sidebar update
  - [x] 8.1 Add `"Chat"` to the `FILTERS` array in `components/session-history-sidebar.tsx`
  - [x] 8.2 Add `MessageSquare` icon and muted color entry for `chat` document type in `DOC_ICONS` and `DOC_COLORS`
  - [x] 8.3 Render chat sessions with `"Chat"` badge in muted style; use first user message (truncated to 40 chars) as title fallback
  - [x] 8.4 When user clicks a chat-type session in history, route to `chat-only` view via `AppShell` — currently `handleSessionSelect` in `PromptScreen` does not check `document_type`; clicking a chat session from within the split-screen will load it as a typed session instead of routing back to chat-only view

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.3", "4.1"],
      "description": "Foundation: DB migration, intent classifier, Create card component"
    },
    {
      "wave": 2,
      "tasks": ["1.2", "1.4", "3.3"],
      "description": "Apply migration, mismatch rules, chat-only system prompt"
    },
    {
      "wave": 3,
      "tasks": ["1.5", "2.1", "2.3", "3.1"],
      "description": "Tests, create-chat endpoint, detect-type extension, stream chat handling"
    },
    {
      "wave": 4,
      "tasks": ["2.2", "3.2"],
      "description": "Promote endpoint, mismatch redirect in stream"
    },
    {
      "wave": 5,
      "tasks": ["5.1"],
      "description": "Chat-only screen scaffold"
    },
    {
      "wave": 6,
      "tasks": ["5.2", "5.7"],
      "description": "Session lifecycle and monochromatic styling"
    },
    {
      "wave": 7,
      "tasks": ["5.3", "5.4", "5.5"],
      "description": "Message sending, confirmation detection, mismatch handling"
    },
    {
      "wave": 8,
      "tasks": ["5.6", "5.8"],
      "description": "Create card promotion, explicit mid-chat create"
    },
    {
      "wave": 9,
      "tasks": ["6.1", "7.1", "8.1"],
      "description": "AppShell state, animation scaffold, history filter"
    },
    {
      "wave": 10,
      "tasks": ["6.2", "6.3", "7.2", "8.2", "8.3"],
      "description": "AppShell routing, animation panels, history rendering"
    },
    {
      "wave": 11,
      "tasks": ["6.4", "6.5", "7.3", "8.4"],
      "description": "History session routing, render ChatOnlyScreen, animation timing, history click routing"
    }
  ]
}
```

## Notes

- `components/prompt-screen.tsx`, `components/invoice-chat.tsx`, `components/document-preview.tsx`, and `components/editor-panel.tsx` are NOT modified except for the `isAnimating` prop addition to `PromptScreen` in task 7.1.
- The existing `classifyIntent()` binary function in `lib/intent-router.ts` is kept unchanged for backward compatibility with `/api/ai/stream`.
- Chat-only sessions (`document_type = 'chat'`) never increment `user_usage.documents_count`. The increment happens only in the promote endpoint (task 2.2).
- The `document_sessions.document_type` column has no CHECK constraint in the main table, so inserting `'chat'` requires no schema change — only the index and comment migration (task 1.1).
- Mismatch detection is pure regex — no AI call, no latency, no cost.
