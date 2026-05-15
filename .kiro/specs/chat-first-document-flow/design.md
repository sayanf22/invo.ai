# Chat-First Document Flow — Technical Design

## Overview

This document describes the technical design for the chat-first document flow. The implementation inserts a new **chat-only screen** between the existing start screen and the existing split-screen (`PromptScreen`). The split-screen and all downstream document generation logic remain unchanged. The new screen is a pure conversation surface that promotes itself into the split-screen when the user decides to create a document.

## Architecture

### High-level flow

```
Start Screen (app-shell.tsx)
    │
    ├─ intent = "document-explicit"  ──────────────────────────────► PromptScreen (unchanged)
    │
    └─ intent = "chat" | "ambiguous" | "mismatch"
           │
           ▼
    ChatOnlyScreen (NEW: components/chat-only-screen.tsx)
           │
           │  user confirms / explicit create message
           │  → POST /api/sessions/promote  (NEW)
           │
           ▼
    PromptScreen (unchanged, receives sessionId + initialPrompt)
```

**Key principle:** `PromptScreen` is never modified beyond a single `isAnimating` prop. The chat-only screen is a self-contained component that hands off to `PromptScreen` via the existing `AppShell` view state machine.

### View State Machine (AppShell)

`AppShell` currently manages two views: `"start"` and `"prompt"`. We add a third:

```typescript
type View = "start" | "chat-only" | "prompt"
```

### Transition table

| From | Event | To |
|------|-------|----|
| `start` | submit prompt, intent = `document-explicit` | `prompt` |
| `start` | submit prompt, intent = `chat` / `ambiguous` / `mismatch` | `chat-only` |
| `chat-only` | user clicks Create card OR types explicit create | `prompt` (via promotion) |
| `chat-only` | back button | `start` |
| `prompt` | back button | `start` (unchanged) |

The `chat-only` → `prompt` transition passes:
- `selectedSessionId`: the promoted session's id (same row, now with a real `document_type`)
- `initialPrompt`: the first user message from the chat-only session (so `InvoiceChat` auto-sends it)
- `initialCategory`: the promoted document type (capitalized)

---

## Components and Interfaces

#### Intent Classifier Extension

### File: `lib/intent-router.ts`

Extend `classifyIntent` to return a richer type:

```typescript
export type IntentRoute = "document-explicit" | "chat" | "ambiguous"

export interface IntentResult {
  route: IntentRoute
  suggestedType?: "invoice" | "contract" | "quotation" | "proposal"
  confidence: number
}

export function classifyIntentFull(prompt: string, selectedCategory?: string): IntentResult
```

**Classification logic:**

| Condition | Route |
|-----------|-------|
| Strong generation verb (`create\|generate\|make\|draft\|prepare\|build\|new`) + unambiguous doc type keyword OR `selectedCategory` set + concrete subject (>3 words beyond doc type) | `document-explicit` |
| Question words (`what\|how\|why\|which\|when\|can you\|should I\|do I`) without strong generation verb | `chat` |
| Doc type keyword present but no concrete subject, OR prompt is just a doc type name | `ambiguous` |
| Everything else | `chat` |

The existing `classifyIntent()` binary function is kept unchanged for backward compatibility with `/api/ai/stream`.

### File: `app/api/ai/detect-type/route.ts` (extend existing)

Add a new response field `route` to the existing endpoint:

```typescript
// New response shape (backward compatible — adds fields, doesn't remove)
{
  success: true,
  type: "invoice" | "contract" | "quotation" | "proposal",
  confidence: number,
  reasoning: string,
  message: string,
  route: "direct-create" | "chat-only",   // NEW
  mismatch?: {                              // NEW — only when mismatch detected
    requestedType: string,
    suggestedType: string,
    reason: string
  }
}
```

**Mismatch detection** runs inside this endpoint (pure regex, no AI call):

```typescript
const MISMATCH_RULES: Array<{
  requestedType: DocumentType,
  triggerPattern: RegExp,
  suggestedType: DocumentType,
  reason: string
}> = [
  {
    requestedType: "contract",
    triggerPattern: /\b(payment|bill|invoice|charge|amount due|pay me|collect payment)\b/i,
    suggestedType: "invoice",
    reason: "For collecting payment, an invoice is the right document. Contracts are for agreements and terms."
  },
  {
    requestedType: "invoice",
    triggerPattern: /\b(agreement|terms|employment|hire|freelance agreement|consulting agreement|scope of work)\b/i,
    suggestedType: "contract",
    reason: "For formalizing an agreement or terms, a contract is more appropriate than an invoice."
  },
  {
    requestedType: "quotation",
    triggerPattern: /\b(already agreed|final price|payment due|invoice for|bill for)\b/i,
    suggestedType: "invoice",
    reason: "If the work is already agreed and you need to request payment, use an invoice instead of a quotation."
  },
  {
    requestedType: "proposal",
    triggerPattern: /\b(price list|line items|unit price|per hour|per unit|rate card)\b/i,
    suggestedType: "quotation",
    reason: "For itemized pricing, a quotation is more appropriate than a proposal."
  }
]
```

---

## Data Models

### Data Models

### Allow `document_type = 'chat'` in `document_sessions`

The `document_sessions.document_type` column is a `TEXT` field with no CHECK constraint in the main table (the CHECK constraints are only on child tables like `document_emails` and `email_schedules`). We can insert `'chat'` without a migration.

However, to make the intent explicit and prevent accidental queries, add a migration comment and update the TypeScript types:

**Migration: `supabase/migrations/chat_session_type.sql`**
```sql
-- Allow 'chat' as a document_type value in document_sessions.
-- This is a soft type — no CHECK constraint change needed since the column
-- is unconstrained TEXT. This migration documents the intent and adds an index.
CREATE INDEX IF NOT EXISTS idx_document_sessions_chat_type
  ON document_sessions(user_id, created_at DESC)
  WHERE document_type = 'chat';

COMMENT ON COLUMN document_sessions.document_type IS
  'Document type: invoice | contract | quotation | proposal | chat. '
  'chat = pre-document advisory conversation, never counts against quota.';
```

### Session Promotion Endpoint

**New file: `app/api/sessions/promote/route.ts`**

```typescript
// POST /api/sessions/promote
// Body: { sessionId: string, targetType: "invoice"|"contract"|"quotation"|"proposal" }
// 
// Atomically:
//   1. checkDocumentLimit(supabase, userId, userTier)
//   2. checkDocumentTypeAllowed(targetType, userTier)
//   3. UPDATE document_sessions SET document_type = targetType WHERE id = sessionId AND document_type = 'chat'
//   4. incrementDocumentCount(supabase, userId)
//
// Returns: { success: true, session: { id, documentType, status } }
// On limit/type error: returns existing 429/403 shape
```

The promotion is a single server round-trip. The client does NOT call `/api/sessions/create` — the existing chat-only session row is mutated in place.

### Chat-Only Session API

**New file: `app/api/sessions/create-chat/route.ts`**

```typescript
// POST /api/sessions/create-chat
// Body: { initialPrompt?: string }
//
// Creates a document_sessions row with document_type = 'chat', status = 'active'.
// Does NOT call checkDocumentLimit or incrementDocumentCount.
// Saves initialPrompt as first chat_messages row if provided.
//
// Returns: { success: true, session: { id, documentType: 'chat', status } }
```

This is a thin wrapper around a direct Supabase insert — no tier checks, no quota.

---

### Components and Interfaces

### Chat-Only Screen Component

### File: `components/chat-only-screen.tsx`

```typescript
interface ChatOnlyScreenProps {
  initialPrompt: string          // The prompt from the start screen
  onBack: () => void             // Navigate back to start screen
  onPromote: (params: {          // Navigate to split-screen after promotion
    sessionId: string
    documentType: string
    initialPrompt: string
  }) => void
}
```

#### Layout

```
┌─────────────────────────────────────────────────────────┐
│  ← [back]   [InvoLogo]                    [HamburgerMenu]│  ← header (same as PromptScreen)
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │  [AI message bubble]                            │  │
│   │  [User message bubble]                          │  │
│   │  [AI message bubble]                            │  │
│   │  [Create Card] ← appears after confirmation    │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │  [text input]                        [Send →]   │  │
│   └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### Monochromatic styling rules

All colors use only these Tailwind tokens:
- `bg-background`, `bg-card`, `bg-muted`, `bg-muted/40`
- `text-foreground`, `text-muted-foreground`
- `border-border`, `border-border/50`
- `ring-border`

No `text-primary`, `bg-primary`, `text-blue-*`, `text-amber-*`, etc. inside the chat surface. The Create card button uses `bg-foreground text-background` (monochromatic inverse) rather than `bg-primary`.

#### State

```typescript
type ChatOnlyMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  createCard?: {
    documentType: "invoice" | "contract" | "quotation" | "proposal"
    summary: string          // e.g. "Invoice for Acme Corp • $1,500 • web design"
    isCreating: boolean      // true while promotion is in flight
  }
}

const [messages, setMessages] = useState<ChatOnlyMessage[]>([])
const [sessionId, setSessionId] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState(false)
const [isPromoting, setIsPromoting] = useState(false)
```

#### Session lifecycle

1. On mount: call `POST /api/sessions/create-chat` with `initialPrompt`. Store returned `sessionId`.
2. Send `initialPrompt` to `/api/ai/stream` with `documentType = 'chat'` and `sessionId`. The stream endpoint handles chat-type sessions as pure conversational responses (no document JSON generated).
3. Each user message: save to `chat_messages` via Supabase client, then stream to `/api/ai/stream`.
4. Parse AI response for `createCard` signal (see §6).
5. On Create card click: call `POST /api/sessions/promote`, then call `onPromote(...)`.

#### Confirmation detection (client-side)

```typescript
const CONFIRMATION_TOKENS = /\b(yes|sure|ok|okay|do it|go ahead|create it|sounds good|please|let's do it|proceed|yep|yeah|absolutely|definitely)\b/i

function detectConfirmation(userMessage: string): boolean {
  return CONFIRMATION_TOKENS.test(userMessage.toLowerCase())
}
```

When the previous AI message contained a document suggestion AND the user's next message matches `CONFIRMATION_TOKENS`, the client sends a hint to the AI: `[HINT: user confirmed, include create_card in response]`. The AI then returns a response with the `create_card` JSON signal.

---

#### AI Response Protocol for Chat-Only Sessions

### System prompt addition for `document_type = 'chat'`

When `/api/ai/stream` receives a request with `documentType = 'chat'`, it uses a specialized system prompt:

```
You are a smart document advisor for Invo.ai. Your job is to help users understand what document they need and guide them toward creating it.

RULES:
1. Answer questions conversationally. Never generate document JSON in this mode.
2. On your FIRST response, always suggest a specific document type if the user's situation calls for one.
3. After the user confirms they want to create a document, include a JSON signal at the END of your response:
   [CREATE_CARD:{"type":"invoice","summary":"Invoice for Acme Corp • $1,500 • web design"}]
4. If the user asks for the wrong document type for their goal, explain why and suggest the correct one.
5. If the user explicitly says "create invoice for X" or similar mid-chat, include the CREATE_CARD signal immediately.
6. Keep responses concise — 2-4 sentences max unless explaining a complex concept.
```

### `CREATE_CARD` signal parsing

The client parses the AI's streamed text for the `[CREATE_CARD:{...}]` pattern:

```typescript
const CREATE_CARD_REGEX = /\[CREATE_CARD:(\{[^}]+\})\]/

function parseCreateCard(text: string): { type: string; summary: string } | null {
  const match = text.match(CREATE_CARD_REGEX)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}
```

The signal is stripped from the displayed message text. The `createCard` field is set on the message object, which renders the Create card UI below the message bubble.

### Mismatch redirect from `/api/ai/stream`

When `/api/ai/stream` detects a mismatch (via the same `MISMATCH_RULES` array), it returns a special SSE event before streaming:

```typescript
sendEvent({
  type: "mismatch-redirect",
  requestedType: "contract",
  suggestedType: "invoice",
  reason: "For collecting payment, an invoice is the right document.",
  initialMessage: "I see you want to create a contract for collecting a $1k payment. For collecting payment, an invoice is actually the right document — contracts are for agreements and terms. Should I create an invoice instead?\n\n[CREATE_CARD:{\"type\":\"invoice\",\"summary\":\"Invoice for payment collection\"}]"
})
```

The client handles `mismatch-redirect` by:
1. If currently on the start screen → route to `chat-only` view with the `initialMessage` pre-loaded as the first AI message.
2. If already on the chat-only screen → render the `initialMessage` as the next AI message (with Create card).

---

#### Create Card Component

### File: `components/chat-create-card.tsx`

```typescript
interface ChatCreateCardProps {
  documentType: "invoice" | "contract" | "quotation" | "proposal"
  summary: string
  isCreating: boolean
  onConfirm: () => void
}
```

#### Visual design (monochromatic)

```
┌──────────────────────────────────────────────────────┐
│  📄  Invoice                                         │
│      Invoice for Acme Corp • $1,500 • web design     │
│                                                      │
│  [  Create Invoice  ]                                │
└──────────────────────────────────────────────────────┘
```

- Container: `bg-card border border-border rounded-2xl p-4 shadow-sm`
- Icon: neutral `FileText` / `ScrollText` / `ClipboardList` / `Lightbulb` from Lucide, `text-foreground`
- Type label: `text-sm font-semibold text-foreground`
- Summary: `text-xs text-muted-foreground`
- Button: `bg-foreground text-background rounded-xl px-4 py-2.5 text-sm font-semibold` (monochromatic inverse)
- While `isCreating`: button shows spinner + "Creating…" text, disabled

---

#### Split-Animation

### Mechanism

The animation is a CSS `width` transition on the chat column, coordinated with a `opacity + translateX` transition on the preview panel. Both transitions run simultaneously.

`AppShell` manages an `animating` boolean. When `chat-only` → `prompt` transition fires:

1. `AppShell` sets `view = "prompt"` and `animating = true` simultaneously.
2. `PromptScreen` mounts with `chatColumnWidth = "full"` (100vw) and `previewVisible = false`.
3. On next frame (via `requestAnimationFrame`), set `chatColumnWidth = "420px"` and `previewVisible = true`.
4. CSS transitions handle the rest. After 450ms, set `animating = false`.

```typescript
// In PromptScreen, the desktop left panel:
<div
  className="hidden md:flex bg-card shrink-0 flex-col relative z-10 transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
  style={{
    width: animating ? "100%" : "420px",  // starts full, animates to 420px
    borderRight: "1px solid hsl(var(--border) / 0.6)",
    boxShadow: "2px 0 20px -4px rgba(0,0,0,0.1)",
  }}
>
```

```typescript
// Preview panel:
<div
  className="hidden md:flex flex-1 bg-background overflow-hidden flex-col transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
  style={{
    opacity: animating ? 0 : 1,
    transform: animating ? "translateX(40px)" : "translateX(0)",
  }}
>
```

### Chat message continuity

The `ChatOnlyScreen` component is NOT unmounted during the transition. `AppShell` renders both `ChatOnlyScreen` and `PromptScreen` simultaneously during the animation, with `ChatOnlyScreen` positioned absolutely behind `PromptScreen`. After the animation completes, `ChatOnlyScreen` is unmounted.

Actually, a simpler approach: `PromptScreen` receives the `chatOnlyMessages` as `initialMessages` prop, and `InvoiceChat` renders them immediately without a loading state. The `ChatOnlyScreen` is unmounted after the animation. This avoids keeping two chat instances alive.

**Revised approach:**

```typescript
// AppShell passes chat history to PromptScreen
<PromptScreen
  ...
  chatOnlySessionId={promotedSessionId}  // InvoiceChat loads this session's messages
  initialPrompt={firstUserMessage}        // auto-sent to trigger generation
/>
```

`InvoiceChat` already handles `selectedSessionId` — it loads the session's existing messages from the DB. Since the promoted session has all the chat-only messages in `chat_messages`, they appear immediately when `InvoiceChat` mounts. No special prop needed beyond `selectedSessionId`.

---

#### History Sidebar Changes

### File: `components/session-history-sidebar.tsx`

#### New filter pill

Add `"Chat"` to the `FILTERS` array:

```typescript
const FILTERS = ["All", "Invoice", "Contract", "Quotation", "Proposal", "Chat"] as const
```

#### Chat session rendering

```typescript
// In DOC_ICONS:
chat: MessageSquare  // from lucide-react

// In DOC_COLORS:
chat: { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground" }
```

Chat sessions display:
- Icon: `MessageSquare` (neutral)
- Badge: `"Chat"` in muted style
- Title: first user message truncated to 40 chars, or `"Chat conversation"` if empty

#### Clicking a chat session

When `document_type === 'chat'`, `onSessionSelect` routes to `chat-only` view (not `prompt` view). `AppShell` detects this by checking the session's `document_type` after loading.

---

### AppShell Changes Summary

```typescript
type View = "start" | "chat-only" | "prompt"

// New state
const [chatOnlyPrompt, setChatOnlyPrompt] = useState<string>("")
const [chatOnlySessionId, setChatOnlySessionId] = useState<string | undefined>()

// handlePromptSubmit changes:
// 1. Call /api/ai/detect-type (already done)
// 2. Check new `route` field in response
// 3. If route === "direct-create" → setView("prompt") as today
// 4. If route === "chat-only" → setChatOnlyPrompt(prompt), setView("chat-only")
// 5. If mismatch → setChatOnlyPrompt(prompt), setView("chat-only") with mismatch context

// handlePromote (new):
const handlePromote = useCallback(({ sessionId, documentType, initialPrompt }) => {
  setSelectedSessionId(sessionId)
  setSelectedCategory(documentType.charAt(0).toUpperCase() + documentType.slice(1))
  setInitialPrompt(initialPrompt)
  setPromptKey(prev => prev + 1)
  setView("prompt")
}, [])

// handleSessionSelect changes:
// After loading session type, if document_type === 'chat':
//   setChatOnlySessionId(sessionId), setView("chat-only")
// else:
//   existing behavior → setView("prompt")
```

---

### `/api/ai/stream` Changes

### Chat-only session handling

When `documentType === 'chat'` is received:
1. Skip `checkDocumentLimit` (chat sessions are free).
2. Skip `checkMessageLimit` (no cap on chat-only messages).
3. Skip `checkDocumentTypeAllowed`.
4. Use the chat-only system prompt (§6) instead of `DUAL_MODE_SYSTEM_PROMPT`.
5. Route to the conversational model (existing Kimi/Bedrock chat path or DeepSeek chat mode).
6. Do NOT generate document JSON. Do NOT call `incrementDocumentCount`.

### Mismatch detection

Before routing to the model, run `detectMismatch(prompt, documentType)`. If a mismatch is found, emit the `mismatch-redirect` SSE event and close the stream without calling the AI.

---

### File Inventory

### New files

| File | Purpose |
|------|---------|
| `components/chat-only-screen.tsx` | New chat-only screen component |
| `components/chat-create-card.tsx` | Create card rendered inside chat |
| `app/api/sessions/create-chat/route.ts` | Create chat-only session (no quota) |
| `app/api/sessions/promote/route.ts` | Promote chat session to typed session |
| `supabase/migrations/chat_session_type.sql` | DB index + comment for chat type |

### Modified files

| File | Change |
|------|--------|
| `components/app-shell.tsx` | Add `chat-only` view, `handlePromote`, session routing |
| `lib/intent-router.ts` | Add `classifyIntentFull()` returning `IntentResult` |
| `app/api/ai/detect-type/route.ts` | Add `route` + `mismatch` fields to response |
| `app/api/ai/stream/route.ts` | Handle `documentType = 'chat'`, mismatch detection |
| `components/session-history-sidebar.tsx` | Add `"Chat"` filter, chat session rendering |
| `lib/cost-protection.ts` | No changes — existing functions reused as-is |
| `hooks/use-document-session.ts` | No changes — works with any `document_type` value |

### Unchanged files

- `components/prompt-screen.tsx` — zero changes
- `components/invoice-chat.tsx` — zero changes
- `components/document-preview.tsx` — zero changes
- `components/editor-panel.tsx` — zero changes
- All export/PDF/signature components — zero changes

---

## 13. Security Considerations

- `POST /api/sessions/create-chat` requires authentication (same `authenticateRequest` pattern). No tier check, but user must be logged in.
- `POST /api/sessions/promote` runs all existing tier checks server-side. The client cannot bypass them.
- The `document_type = 'chat'` value is validated server-side in `/api/ai/stream` — if a client sends `documentType: 'chat'` to the stream endpoint, it gets the chat-only system prompt and no document is generated. This is safe.
- Mismatch detection is pure regex — no AI call, no cost, no latency.
- Chat-only sessions do not appear in `user_usage.documents_count` — the increment only happens in `promote`.

---

### Data Flow Diagram

```
User types "what should I send after onboarding?"
    │
    ▼
AppShell.handlePromptSubmit
    │
    ├─ POST /api/ai/detect-type
    │   └─ returns { route: "chat-only", type: "invoice", confidence: 0.3 }
    │
    ▼
setView("chat-only"), setChatOnlyPrompt(prompt)
    │
    ▼
ChatOnlyScreen mounts
    │
    ├─ POST /api/sessions/create-chat → { sessionId: "abc-123" }
    │
    ├─ POST /api/ai/stream (documentType: "chat", sessionId: "abc-123")
    │   └─ AI responds: "For post-onboarding, you'd typically send an invoice or a proposal.
    │                    An invoice works if you've agreed on a price. Should I create one?"
    │
    ▼
User types "yes, create an invoice"
    │
    ├─ POST /api/ai/stream (documentType: "chat", sessionId: "abc-123")
    │   └─ AI responds: "Great! [CREATE_CARD:{"type":"invoice","summary":"Invoice for client"}]"
    │
    ▼
ChatOnlyScreen renders Create card
    │
User clicks "Create Invoice"
    │
    ├─ POST /api/sessions/promote { sessionId: "abc-123", targetType: "invoice" }
    │   ├─ checkDocumentLimit ✓
    │   ├─ checkDocumentTypeAllowed ✓
    │   ├─ UPDATE document_sessions SET document_type = 'invoice' WHERE id = 'abc-123'
    │   └─ incrementDocumentCount
    │
    ▼
AppShell.handlePromote({ sessionId: "abc-123", documentType: "invoice", initialPrompt: "yes, create an invoice" })
    │
    ▼
setView("prompt") → PromptScreen mounts with selectedSessionId = "abc-123"
    │
    ▼
InvoiceChat loads session "abc-123" → sees existing chat messages → auto-sends initialPrompt
    │
    ▼
Document generation begins, split-screen visible
```
