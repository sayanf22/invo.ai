# Requirements Document: Chat-First Document Flow
## Introduction

Today, every prompt from the start screen immediately creates a document session and opens the split-screen interface (chat + live preview + editor). This is fast for users who already know what they want, but it has two weaknesses:

1. **Forces a document on ambiguous intent.** If a user types "what should I send a client after onboarding?" — a question, not a generation request — the system still opens a blank document and burns the UX on an empty preview. Users who aren't sure what document they need can't discover the answer inside our product.
2. **Consumes a document quota slot too early.** The session is created on the start-screen submit; tier limits trigger before the user has decided what they want to generate.

This spec redesigns the entry flow around a **chat-first** experience. A new chat-only screen sits between the start screen and the existing split-screen. The AI behaves intelligently: it goes direct to document creation when the user is explicit ("invoice $1,500 to ACME"), enters a conversational chat when the user is asking questions or unsure, and redirects mismatched requests to an educational chat (e.g., "create a contract for a $1k payment" → "for collecting payment you actually want an invoice — should I create one?"). The split-screen only materialises when a document is actually created, and only then is a document quota slot consumed.

Tier consumption rule (definitive): **quota is consumed at promotion time** — when a chat-only session converts into an invoice/contract/quotation/proposal. Chat-only conversations do not count against the document quota. Messages within a chat-only session do not count against the per-session message cap (the cap only starts applying once the session has a document type).

## Glossary

- **Start screen**: The existing home hero where the user types their first prompt (`components/app-shell.tsx`, the `view === "start"` branch).
- **Chat-only screen**: The NEW intermediate screen this spec introduces. A full-width monochromatic chat with no document preview. Renders between the start screen and the split-screen.
- **Split-screen** / **Document screen**: The existing `components/prompt-screen.tsx` layout with chat + editor + live preview.
- **Chat-only session**: A `document_sessions` row with `document_type = 'chat'` (new allowed value) and `status = 'active'`. It holds messages but no document context. It never counts against the monthly document quota.
- **Typed session**: A `document_sessions` row with `document_type` in `('invoice', 'contract', 'quotation', 'proposal')`. It is what counts against the document quota.
- **Promotion**: The one-way transition from a chat-only session to a typed session. Triggered when the user clicks the Create card in chat OR types an explicit create request like "create invoice for X". After promotion, the session carries over its message history, gains a document context, and the split-screen opens.
- **Direct-create path**: The flow where the user's first prompt is so explicit (strong generation verb + clear doc type + concrete subject) that we skip the chat-only screen and go straight to the split-screen, exactly like today.
- **Smart redirect**: A server-side behavior where the AI detects a user asked for the wrong document type for their goal (e.g., contract for a payment), refuses to create it, and responds in chat with an explanation and an alternative Create card.
- **Create card**: An inline chat card rendered beneath an AI message when the AI has suggested a specific document type and the user has confirmed. Contains a summary of what will be created and a single primary "Create [type]" button.
- **Split-animation**: The ultra-smooth visual transition from chat-only layout (full width) to split-screen (chat left ~420px, preview right flex) when a document is promoted. Chat messages must not jump or re-render.
- **Monochromatic styling**: The chat-only screen uses a neutral grayscale palette (foreground / muted-foreground / border / background tokens only). No accent colors, gradients, or brand tints inside the chat surface. This visually distinguishes pre-document conversation from the typed document experience.

## Requirements

### Requirement 1: Chat-only screen renders between start and split-screen

**User Story:** As a user with an ambiguous or conversational prompt, I want the first prompt to open a chat-only surface where I can ask questions and get recommendations before any document is created, so that I don't burn a quota slot on an empty document I don't need.

#### Acceptance Criteria

1. WHEN the user submits a prompt from the start screen THEN the system SHALL classify the intent server-side before deciding which screen to render.
2. IF the classified intent is `chat` or `ambiguous` THEN the system SHALL transition from the start screen to a new chat-only screen, not to the split-screen.
3. IF the classified intent is `document-explicit` (explicit generation verb + recognizable document type + a subject beyond the doc type itself) THEN the system SHALL bypass the chat-only screen and open the split-screen directly, preserving today's behavior for explicit users.
4. THE chat-only screen SHALL render a full-width chat column with the AI conversation and a text input. It SHALL NOT render the document preview, editor panel, or share/download toolbar.
5. THE chat-only screen SHALL use monochromatic styling throughout: only `background`, `foreground`, `muted`, `muted-foreground`, `border`, and `card` design tokens. Accent/primary colors SHALL NOT appear in the chat bubbles, input, or surrounding chrome.
6. THE chat-only screen SHALL show the existing header (back button + InvoLogo + hamburger menu) so users can exit to the start screen or navigate to other areas.
7. WHEN the user clicks the back button on the chat-only screen THEN the system SHALL return to the start screen and abandon the in-progress chat-only session (unpromoted sessions remain in history but no document quota is consumed).

### Requirement 2: Direct-create path for explicit requests

**User Story:** As a power user who already knows exactly what I want, I want "invoice $1,500 to ACME for web design" to open the document immediately, so that the chat-only screen doesn't slow me down.

#### Acceptance Criteria

1. WHEN the start-screen prompt is submitted THEN the system SHALL call the intent classifier with inputs: the raw prompt, the currently selected category pill (if any), and the user's tier (for type-allowed check).
2. THE intent classifier SHALL return `document-explicit` when ALL of the following are true: (a) prompt contains a strong generation verb (`create|generate|make|draft|prepare|build|new`), (b) prompt contains an unambiguous document-type keyword OR a category pill is selected, (c) prompt contains at least one concrete subject token beyond the doc-type name (e.g., a client name, amount, or description longer than 3 words).
3. IF the classifier returns `document-explicit` AND the detected type is allowed for the user's tier THEN the system SHALL create a typed session with the prompt as `initialPrompt`, increment the document counter on generation success, and open the split-screen — matching today's behavior.
4. IF the classifier returns `document-explicit` AND the detected type is NOT allowed for the user's tier THEN the system SHALL still route to the chat-only screen and the AI SHALL explain the tier restriction and suggest an allowed alternative (e.g., "Quotations need Starter. Want me to create an invoice instead?").
5. THE classifier SHALL return `chat` when the prompt is a question (starts with or contains `what|how|why|which|when|can you|should I|do I`) without a strong generation verb, OR asks about documents in general ("what should I send my client?").
6. THE classifier SHALL return `ambiguous` and route to chat-only when the prompt mentions a document type but is missing subject details (e.g., "invoice", "I need a contract", "help me with an invoice"), so that the AI can gather the missing context conversationally.

### Requirement 3: Chat-only AI behavior — suggest, discuss, then create

**User Story:** As a user who is unsure what I need, I want the AI to understand my situation, suggest the right document, and only create one after I explicitly confirm, so that I feel guided rather than forced into generation.

#### Acceptance Criteria

1. WHEN the chat-only screen sends its first user message to the AI THEN the AI response SHALL include: (a) a direct answer to the user's question or situation, (b) a natural-language recommendation of which document type (if any) fits the situation. THE first response SHALL NOT include a Create card.
2. WHEN the user responds to the AI's recommendation with clear agreement tokens (`yes|sure|ok|okay|do it|go ahead|create it|sounds good|please|lets do it|proceed`) THEN the AI's next response SHALL include a Create card beneath its message text.
3. WHEN the user responds to the AI's recommendation with a decline or a new question THEN the AI SHALL continue the conversation without rendering a Create card.
4. WHILE the chat-only session has no document type THE Create card SHALL be the ONLY way to trigger document creation from within the chat screen other than typing a new explicit-create message.
5. WHEN the user types an explicit create message mid-chat (e.g., "ok just create the invoice for $500 to John") THEN the system SHALL treat it as a direct create action: promote the chat-only session to a typed session, seed the document with whatever context the AI has gathered, and open the split-screen without requiring a Create card click.
6. THE Create card SHALL display: the detected document type, a short one-line summary of what will be created (e.g., "Invoice for Acme Corp • $1,500 • web design"), and a single primary button labeled "Create [Type]".
7. WHEN the user clicks the Create card button THEN the system SHALL promote the session (see Requirement 5) and trigger the split-animation (see Requirement 6).

### Requirement 4: Smart-redirect for mismatched document requests

**User Story:** As a new user who doesn't know invoicing terminology, I want the AI to catch it when I ask for the wrong document ("contract for a $1k payment"), explain the correct choice, and offer to create that instead, so that I end up with a useful document and learn in the process.

#### Acceptance Criteria

1. WHEN the AI receives a create-intent prompt THEN the server SHALL run a mismatch check that evaluates whether the requested doc type fits the user's described goal.
2. THE mismatch check SHALL recognize the following patterns at minimum: (a) contract requested + payment/bill/invoice/charge keywords present → suggest invoice, (b) invoice requested + agreement/terms/employment/freelance-agreement keywords present → suggest contract, (c) quotation requested + already-agreed/final-price/payment-due keywords → suggest invoice, (d) proposal requested + simple-pricing/line-items/quote keywords → suggest quotation.
3. IF the mismatch check fires THEN the system SHALL route to the chat-only screen (even if the user submitted from the start screen) and the AI's response SHALL: (a) acknowledge what the user asked for, (b) explain why the other document type is a better fit, (c) render a Create card for the suggested type.
4. IF the user rejects the suggestion and re-confirms the original request ("no, I really want a contract") THEN the AI SHALL respect the user's explicit choice on the next turn and render a Create card for the originally requested type.
5. THE mismatch check SHALL run on both the start-screen entry path AND on messages typed inside the chat-only screen, so that a user cannot bypass it by typing the mismatch mid-chat.
6. THE mismatch check SHALL NOT fire when the user's request is internally consistent (e.g., "create an invoice for $1k") — a consistent invoice-for-payment request SHALL go straight to the direct-create path.

### Requirement 5: Chat-only session persistence and promotion

**User Story:** As a user who chats with the AI and then decides to create a document, I want my conversation to be preserved and the same session to carry forward, so that the AI uses my earlier context and my history shows the full journey in one place.

#### Acceptance Criteria

1. WHEN the chat-only screen opens with a new prompt THEN the system SHALL create a `document_sessions` row with `document_type = 'chat'` and `status = 'active'` before sending the first message to the AI.
2. THE chat-only session row SHALL be saved to the database immediately, allowing the session to appear in the history sidebar and survive page refreshes.
3. CREATING a chat-only session SHALL NOT increment the `user_usage.documents_count` counter, SHALL NOT run `checkDocumentLimit()`, and SHALL NOT run `checkDocumentTypeAllowed()`. Chat-only sessions are free to create.
4. WHILE the session remains chat-only THE per-session message cap SHALL NOT apply. The user may exchange any number of messages with the AI for free.
5. WHEN the session is promoted (via Create card click OR explicit mid-chat create message) THEN the system SHALL, in a single server-side transaction: (a) run `checkDocumentLimit()` against the user's tier, (b) run `checkDocumentTypeAllowed()` against the target type, (c) on success, update the session's `document_type` from `chat` to the target type, (d) increment `user_usage.documents_count` by 1, (e) seed the session `context` with any document data the AI has already gathered.
6. IF the promotion check in 5.(a) or 5.(b) fails THEN the system SHALL return the existing 429/403 error to the chat UI, keep the session as chat-only, and render an inline upgrade prompt in chat. The session SHALL NOT be partially promoted.
7. AFTER promotion THE same session id SHALL be used in the split-screen. Chat messages from the chat-only phase SHALL remain visible as the history of the new typed session.
8. IF the user is in a chat-only session and manually clicks "New conversation" THEN the current chat-only session SHALL be marked `status = 'completed'` (or similar terminal state) and a fresh chat-only session SHALL replace it. No quota is consumed either way.

### Requirement 6: Ultra-smooth split-animation on promotion

**User Story:** As a user who just clicked Create, I want the transition from chat-only to split-screen to feel like one continuous motion, so that the product feels polished and my chat history never appears to disappear or reload.

#### Acceptance Criteria

1. WHEN promotion succeeds THEN the chat column SHALL animate from full-width to the split-screen chat width (~420px desktop, ~460px large desktop, full-width on mobile with tab switcher) in a single CSS transform transition.
2. THE preview panel SHALL slide/fade in from the right simultaneously with the chat column width change. Total animation duration SHALL be between 350–500ms using an ease-out or `cubic-bezier(0.32, 0.72, 0, 1)` curve.
3. THE chat messages SHALL NOT unmount, remount, or re-render during the animation. The same React component tree that rendered the chat-only screen SHALL continue to render the chat column on the split-screen.
4. THE last AI message's Create card SHALL transition to a "Creating..." state during the animation and SHALL show the generation progress/activity block once streaming begins.
5. WHILE the animation is in progress THE chat input SHALL remain enabled (so a fast user can type the next instruction while the preview settles).
6. ON mobile (< 768px) the split-animation SHALL instead transition the active tab from "Chat" to auto-select "Preview" once generation starts, and back to "Chat" when generation completes. The chat column itself SHALL NOT shrink on mobile.
7. IF the user navigates away during the animation (back button, closing tab) THEN the promotion transaction from Requirement 5 SHALL already have completed server-side — the session's document_type is committed. No partial-state rollback is needed.

### Requirement 7: History sidebar shows chat-only sessions distinctly

**User Story:** As a user reviewing my history, I want to see my chat-only conversations alongside my documents but clearly labeled as chats, so that I can return to an in-progress conversation and continue where I left off.

#### Acceptance Criteria

1. THE history sidebar SHALL list chat-only sessions (`document_type = 'chat'`) together with typed sessions, ordered by `last_message_at` descending as today.
2. A chat-only session SHALL render with a distinct icon (message bubble) and a neutral/muted label "Chat" instead of an invoice/contract/etc. badge.
3. WHEN the user clicks a chat-only session in history THEN the system SHALL open the chat-only screen with the full message history loaded, allowing the conversation to resume.
4. WHEN a chat-only session is promoted THEN its history entry SHALL immediately update to reflect the new document type and icon. The session id SHALL remain stable; no new history entry is created.
5. THE history filter pills ("All", "Invoice", "Contract", "Quotation", "Proposal") SHALL gain a "Chat" filter that shows only chat-only sessions. Selecting a specific document-type filter SHALL exclude chat-only sessions.
6. WHEN the user deletes a chat-only session from history THEN no document quota is refunded (none was consumed) and the session plus its messages SHALL be hard-deleted.

### Requirement 8: Tier enforcement boundaries

**User Story:** As a business owner operating the tier model, I want chat-only conversations to remain a free product experience while real document generation consumes quota at promotion time, so that the pricing intent matches the user's perceived value.

#### Acceptance Criteria

1. CREATING a chat-only session SHALL NOT require a tier check. A free user at their document limit (5/5 used) SHALL still be able to start chat-only conversations.
2. SENDING messages inside a chat-only session SHALL NOT be gated by the per-session message cap. The cap applies only once the session has a document type.
3. PROMOTING a session SHALL be blocked with the existing 429 response when the user has reached their monthly document limit. THE error SHALL be rendered in chat as an inline upgrade card beneath the AI message, not as a toast.
4. PROMOTING a session to a document type not allowed on the user's tier (e.g., free user trying to promote to quotation) SHALL be blocked with the existing 403 response. THE AI SHALL then automatically respond with a suggestion of an allowed alternative and a Create card for that alternative.
5. A user whose plan is downgraded or expired SHALL retain read access to existing chat-only sessions in history but SHALL be subject to tier limits at the next promotion attempt — matching the existing `resolveEffectiveTier` behavior.
6. THE existing `checkCostLimit`, `checkDocumentTypeAllowed`, and `incrementDocumentCount` primitives in `lib/cost-protection.ts` SHALL be reused unchanged; this spec only changes WHEN they are called (at promotion, not at chat-only session create).

### Requirement 9: Server-side intent and mismatch routing

**User Story:** As a developer maintaining this flow, I want intent classification and mismatch detection to run server-side, so that the UX rules cannot be bypassed by a crafted client request and the logic stays testable and consistent.

#### Acceptance Criteria

1. THE existing `lib/intent-router.ts` `classifyIntent()` function SHALL be extended (or a sibling classifier added) to return a richer result of `document-explicit | chat | ambiguous` — not just the current `document | chat` binary.
2. THE classifier SHALL be invoked from a new server endpoint (or extended existing endpoint such as `/api/ai/detect-type`) that returns `{ route: "direct-create" | "chat-only", suggestedType?: string, reason?: string }`.
3. THE mismatch check from Requirement 4 SHALL run inside `/api/ai/stream` (or a dedicated pre-flight endpoint) so that a client cannot skip the redirect by forging a `documentType` in the request.
4. WHEN `/api/ai/stream` detects a mismatch during a create request THEN it SHALL return a `redirect-to-chat` response instead of streaming document JSON. The client SHALL handle that response by routing to the chat-only screen with the AI's explanation as the first message.
5. ALL routing decisions SHALL be logged via the existing `logAIGeneration` audit helper with a `route_decision` field (`direct-create`, `chat-only-entry`, `chat-only-mid-promotion`, `mismatch-redirect`, `upgrade-blocked`) for observability.
6. THE classifier SHALL be deterministic and side-effect free so it can be unit-tested with a fixed table of prompts → expected routes. At minimum, the test table SHALL cover: 3 explicit creates, 3 questions, 3 ambiguous prompts, and the 4 mismatch patterns from Requirement 4.
