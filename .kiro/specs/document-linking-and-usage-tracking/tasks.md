# Implementation Plan: Document Linking and Usage Tracking

## Overview

Wire together the existing cost-protection, chain navigation, and session linking infrastructure. The work covers: updating tier message limits, adding server-side message limit enforcement to the stream route, building a MessageLimitBanner component, adding document count tracking to session creation routes, and handling the limit-reached flow in InvoiceChat. All changes are minimal — modifying existing files and creating one new component.

## Tasks

- [x] 1. Update tier limits and add getSessionMessageCount helper
  - [x] 1.1 Update TIER_LIMITS in `lib/cost-protection.ts`
    - Change `starter.messagesPerSession` from 25 to 30
    - Change `pro.messagesPerSession` from 30 to 50
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Add `getSessionMessageCount` export to `lib/cost-protection.ts`
    - Query `chat_messages` table with `count: "exact", head: true` filtered by `session_id` and `role = "user"`
    - Return 0 on error (fail-open)
    - _Requirements: 8.3_
  - [x] 1.3 Write property test: Message limit enforcement returns structured 429
    - **Property 1: Message limit enforcement returns structured 429**
    - Generate random `(tier, messageCount)` pairs where count >= tier limit; mock Supabase; assert `checkMessageLimit` returns 429 with `error`, `currentMessages`, `limit`, `tier`, `message` fields. For agency tier, assert null for any count.
    - **Validates: Requirements 2.2, 1.1, 1.2, 1.3, 1.4**
  - [x] 1.4 Write property test: Message counting counts only user-role messages
    - **Property 2: Message counting counts only user-role messages**
    - Generate random arrays of `{role, content}` messages; mock Supabase count query; call `getSessionMessageCount`; assert result equals `messages.filter(m => m.role === "user").length`.
    - **Validates: Requirements 2.3, 8.3**

- [x] 2. Add message limit enforcement to stream route
  - [x] 2.1 Add message limit check to `app/api/ai/stream/route.ts`
    - Import `checkMessageLimit` and `UserTier` from `@/lib/cost-protection`
    - Parse `sessionId` from request body
    - Fetch user's subscription tier from `subscriptions` table (default to `"free"`)
    - Call `checkMessageLimit(auth.supabase, auth.user.id, sessionId, userTier)` before AI generation
    - If limit error returned, return it immediately (429 response)
    - If `sessionId` is missing, skip the check (backward compatibility)
    - _Requirements: 2.1, 2.2, 2.3, 8.1, 8.2_

- [x] 3. Add document count tracking to session creation routes
  - [x] 3.1 Add `incrementDocumentCount` call to `app/api/sessions/create/route.ts`
    - Import `incrementDocumentCount` from `@/lib/cost-protection`
    - Call `await incrementDocumentCount(auth.supabase, auth.user.id)` after successful session insert
    - _Requirements: 7.1_
  - [x] 3.2 Add `incrementDocumentCount` call to `app/api/sessions/create-linked/route.ts`
    - Import `incrementDocumentCount` from `@/lib/cost-protection`
    - Call `await incrementDocumentCount(auth.supabase, auth.user.id)` after successful linked session insert
    - _Requirements: 7.2_

- [x] 4. Checkpoint
  - Ensure all backend changes compile without errors. Run `pnpm lint` to verify. Ask the user if questions arise.

- [x] 5. Create MessageLimitBanner component
  - [x] 5.1 Create `components/message-limit-banner.tsx`
    - Accept props: `currentMessages`, `limit`, `tier`, `currentDocType`, `hasChain`, `parentSessionId`, `onCreateDocument`
    - Display "You've reached the message limit for this session" with `{currentMessages}/{limit} messages used`
    - Render four document type buttons (Invoice, Contract, Quotation, Proposal) using same icon mapping as NextStepsBar (FileText, ScrollText, ClipboardList, Lightbulb from lucide-react)
    - Style with `bg-amber-50 border-amber-200` (light) / `dark:bg-amber-950/20 dark:border-amber-800` (dark)
    - Call `onCreateDocument(docType)` when a button is clicked
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 5.2 Write property test: MessageLimitBanner displays count and limit
    - **Property 3: MessageLimitBanner displays count and limit**
    - Generate random `(currentMessages, limit)` number pairs; render `MessageLimitBanner`; assert output contains "You've reached the message limit for this session", the `currentMessages` number, and the `limit` number.
    - **Validates: Requirements 3.2**

- [x] 6. Update InvoiceChat to handle message limits
  - [x] 6.1 Update `components/invoice-chat.tsx` with limit detection and banner rendering
    - Import `MessageLimitBanner` from `@/components/message-limit-banner`
    - Add `messageLimitReached` state (boolean) and `limitInfo` state (`{ currentMessages, limit, tier } | null`)
    - Include `sessionId: session.id` in the request body sent to `/api/ai/stream`
    - In `sendMessage` error handling: detect 429 with `"Session message limit reached"` error string
    - On 429: set `messageLimitReached` and `limitInfo`, append assistant message with limit info
    - Reset `messageLimitReached` when session changes (in the session sync effect)
    - Conditionally render `MessageLimitBanner` instead of `AIInputWithLoading` when `messageLimitReached` is true
    - Wire `onCreateDocument` to call `handleCreateLinked` (uses chain_id to decide linked vs standalone)
    - _Requirements: 3.1, 3.5, 3.6_

- [x] 7. Checkpoint
  - Ensure all frontend and backend changes compile. Run `pnpm lint`. Ask the user if questions arise.

- [x] 8. Update pricing documentation
  - [x] 8.1 Update `docs/pricing-model.md` message limits table
    - Change Starter messages/session from 25 to 30
    - Change Pro messages/session from 30 to 50
    - Update the main tier comparison table to reflect new limits
    - _Requirements: 1.1, 1.2_

- [x] 9. Final checkpoint
  - Ensure all tests pass and all files compile cleanly. Run `pnpm lint`. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per property
- Checkpoints ensure incremental validation
- All existing working components (ChainNavigator, NextStepsBar, create-linked route) are NOT recreated — only modified where specified
