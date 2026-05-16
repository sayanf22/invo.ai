# Implementation Plan: Document Flow Critical Fixes

## Overview

Eight production defects in the document/contract flow are fixed surgically in this plan. The fixes are grouped by file and dependency: a shared encoding utility is created first (Task 1), then PDF template and streaming header fixes consume it (Tasks 2–3), followed by independent UI and API fixes for signing, fullscreen preview, signature toggles, lock state, tier enforcement, and banner copy (Tasks 4–9). Each task targets only the files and functions identified in the design's Fix Implementation section and references the corresponding bug condition requirements.

## Tasks

- [x] 1. Create shared encoding utility
  - Create `lib/encoding.ts` as a new file with two named exports
  - Implement `fixEncoding(str: string): string` that replaces mojibake sequences with correct Unicode: `â€"` → `—` (U+2014), `â€"` → `–` (U+2013), `â€œ` → `"` (U+201C), `â€` → `"` (U+201D), `â€˜` → `'` (U+2018), `â€™` → `'` (U+2019) using regex `.replace()` chains
  - Implement `isCleanUtf8(str: string): boolean` that returns `false` when the pattern `/[\u00e2][\u0080][\u0094\u0093\u009c\u009d\u0098\u0099]/` is found in the string, `true` otherwise
  - Write unit tests: `fixEncoding("â€"")` → `"—"`, `fixEncoding("hello world")` → `"hello world"` (identity on ASCII), `isCleanUtf8("—")` → `true`, `isCleanUtf8("â€"")` → `false`
  - _Requirements: 1.2, 1.4, 8.2_

- [x] 2. Fix mojibake in PDF templates (Bugs 1 & 8)
  - In `lib/pdf-templates.tsx`: import `fixEncoding` from `@/lib/encoding` at the top of the file
  - Locate the `fmtDate` function and change its no-date fallback return from the raw `"—"` glyph to `"\u2014"` (Unicode escape)
  - Search `lib/pdf-templates.tsx` for any remaining string literals containing a raw `—` glyph and replace each with `"\u2014"`
  - Verify that `getDocumentConfig("contract").fromLabel` and `toLabel` already use `\u2014`; if any use raw glyphs, replace them with `"\u2014"`
  - In the `ContractPDF` component, wrap all AI-generated text fields (at minimum `description`, `scope`, and any other prose fields rendered inside `<Text>` nodes) through `fixEncoding()` before rendering: e.g. `<Text>{fixEncoding(data.description ?? "")}</Text>`
  - Write unit test: `fmtDate(undefined)` returns a string matching `/\u2014/` and not matching `/â€"/`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2_
  - _Depends on: 1_

- [x] 3. Fix streaming response charset header (Bugs 1 & 8)
  - In `app/api/ai/stream/route.ts`: find the `new Response(stream, { headers: { ... } })` call that creates the SSE response
  - Change the `Content-Type` header value from `"text/event-stream"` to `"text/event-stream; charset=utf-8"`
  - Confirm `Cache-Control: no-cache` and `Connection: keep-alive` are also present in the headers object; add them if missing
  - This prevents the browser from re-interpreting UTF-8 em dashes in AI-generated streaming content as Latin-1
  - _Requirements: 1.4, 8.3_

- [x] 4. Fix cancelled document signing link (Bug 2)
  - In `app/api/signatures/route.ts` GET handler: after fetching the signature row by token, extract `session_id` from the signature row; query `document_sessions` with `select("status").eq("id", session_id).single()`; if `status === "cancelled"`, return `NextResponse.json({ error: "This document has been cancelled by the owner.", cancelled: true }, { status: 410 })` before any further processing
  - Locate the document cancel handler (the code path that sets `document_sessions.status = "cancelled"`, likely in a cancel API route or hook action); after updating the session, add: `await supabase.from("signatures").update({ signer_action: "cancelled" }).eq("session_id", sessionId).is("signed_at", null)` to atomically revoke all unsigned signature rows
  - Write unit test: GET with a token whose parent session has `status="cancelled"` but `signer_action=null` → assert HTTP 410 with body `{ cancelled: true }`
  - Write unit test: GET with a token whose parent session has `status="sent"` → assert HTTP 200 (no regression on valid tokens)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4, 3.11_

- [x] 5. Fix fullscreen preview button (Bug 3)
  - In `components/document-preview.tsx`: add `const [isFullscreen, setIsFullscreen] = useState(false)` to the `DocumentPreview` component's state declarations
  - Add a new `ToolbarBtn` in the centre toolbar section with the `Maximize2` icon, `title="Open document fullscreen"`, and `onClick={() => setIsFullscreen(true)}`; this must be a separate button from the existing fit-to-width button — do not replace the fit-to-width button
  - At the end of the component JSX return (after all other elements), add a conditional fullscreen overlay: when `isFullscreen` is `true`, render a `<div className="fixed inset-0 z-50 bg-background flex flex-col" role="dialog" aria-modal="true" aria-label="Document fullscreen preview">` element
  - Inside the modal, render a toolbar row with existing zoom-out, zoom-level, and zoom-in `ToolbarBtn` elements (reuse `handleZoomOut`, `handleZoomIn`, `canZoomOut`, `canZoomIn`, `zoom`), plus a close button: `<button type="button" autoFocus onClick={() => setIsFullscreen(false)} aria-label="Close fullscreen"><X className="w-4 h-4" /></button>`
  - Inside the modal scrollable content area, render `<LivePDFPreview data={data} zoom={zoom} onPageCount={setPageCount} locked={isDocumentLocked} lockReason={lockReason} />` so all required props are passed without throwing
  - Add a `useEffect` that attaches a `keydown` listener when `isFullscreen` is `true`; close the modal when `e.key === "Escape"`; clean up the listener in the effect's return function or when `isFullscreen` becomes `false`
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 6. Fix signature toggle for all signable document types (Bug 4)
  - In `components/editor-panel.tsx`: locate `ClientOnboardingFormEditor`; add `const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"` near the top of the component function body
  - In `ClientOnboardingFormEditor`, add a new `<Step>` at the end of the steps list with an appropriate sequential step number, `title="Signature"`, and render `<SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />` as its child
  - Locate `PaymentFollowupEditor`; apply the same two changes: add the `isSent` const and add a final `<Step>` containing `<SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />`
  - In `LegacyEditorPanel`: extract `const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"` as a named const at the component body level; replace any inline expression in JSX that previously computed this inline with a reference to the `isSent` const
  - Confirm `SignatureStep` is already imported at the top of `editor-panel.tsx`; add the import if missing
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.6_

- [x] 7. Fix lock state clearing on document cancel (Bug 5)
  - In `components/document-preview.tsx`: add `documentStatus?: string` to the `DocumentPreviewProps` interface (or equivalent props type definition)
  - Add a `useEffect` inside `DocumentPreview` that watches `documentStatus`: when `documentStatus === "cancelled"`, call `setSentAt(null)`, `setManualPaid(false)`, and update the `signatures` state to map every entry where `signed_at === null` to `{ ...s, signer_action: "cancelled" as const }`
  - In `components/prompt-screen.tsx` and/or `components/invoice-chat.tsx` (whichever renders `<DocumentPreview>`): pass `documentStatus={session?.status}` as a prop; add a default of `""` at the call site if `session` may be undefined to avoid regressions at call sites that don't yet have the prop
  - Verify the cancel flow already calls `updateSessionStatus("cancelled")` after a successful cancel API response in `hooks/use-document-session.ts`; no change to the hook itself should be needed
  - Write unit test: `DocumentPreview` with `documentStatus="cancelled"` and a seed non-null `sentAt` → assert the component derives `isDocumentLocked === false`
  - Write unit test: `DocumentPreview` with `documentStatus="sent"` and non-null `sentAt` and `externallyUnlocked=false` → assert `isDocumentLocked === true` (regression check)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 3.3, 3.12_

- [x] 8. Fix tier enforcement in onboarding route (Bug 6)
  - In `app/api/ai/onboarding/route.ts`: after the `authenticateRequest` call and before any AI quota consumption, fetch the subscription: `const { data: subscription } = await supabase.from("subscriptions").select("plan, status, current_period_end").eq("user_id", userId).single()`
  - Call `const userTier = resolveEffectiveTier(subscription)` — import `resolveEffectiveTier` from `@/lib/cost-protection` if not already imported
  - Replace the existing `checkCostLimit(supabase, userId, "onboarding")` call with `checkCostLimit(supabase, userId, "onboarding", userTier)`, passing `userTier` as the fourth argument; return early if the result is non-null
  - Add a message-limit check when `sessionId` is present in the request body: extract `const sessionId = body.sessionId as string | undefined`; if truthy, call `const limitError = await checkMessageLimit(supabase, userId, sessionId, userTier)` and `if (limitError) return limitError`; import `checkMessageLimit` from `@/lib/cost-protection` if not already imported
  - In `.kiro/steering/security.md`: update the Cost Protection section to reflect the canonical tier table (Free 5 docs/10 msgs, Starter 50 docs/30 msgs, Pro 150 docs/50 msgs, Agency unlimited); remove or correct the stale "3 docs / 25 messages" references
  - In `.kiro/steering/implementation-guide.md`: apply the same tier limit corrections in the Cost Protection / Security Features sections
  - _Requirements: 6.1, 6.4, 6.5, 3.7, 3.10_

- [x] 9. Fix message-limit banner copy (Bug 7)
  - In `lib/cost-protection.ts`: add a new exported function `nextTierUpgrade(currentTier: UserTier): { nextTier: UserTier | null; label: string | null; messagesPerSession: number | null }` with a switch statement: `"free"` → `{ nextTier: "starter", label: "Starter", messagesPerSession: TIER_LIMITS.starter.messagesPerSession }`, `"starter"` → `{ nextTier: "pro", label: "Pro", messagesPerSession: TIER_LIMITS.pro.messagesPerSession }`, `"pro"` and `"agency"` → `{ nextTier: null, label: null, messagesPerSession: null }`
  - In `components/message-limit-banner.tsx`: import `nextTierUpgrade` from `@/lib/cost-protection`
  - Replace any hardcoded upgrade string (e.g. `"Upgrade to Starter for 30 messages/session"`) by calling `nextTierUpgrade(parsedTier)` and constructing: `` nextTier ? `Upgrade to ${label} for ${messagesPerSession} messages/session` : null ``
  - For Pro and Agency users (`nextTier === null`): ensure the primary CTA renders "Start a new session to continue" and no "Upgrade to…" string is present anywhere in the rendered output
  - Replace all occurrences of the label text `"Start a new document"` with `"Start a new session"` throughout `message-limit-banner.tsx`
  - Write unit test: `nextTierUpgrade("free")` → `{ nextTier: "starter", label: "Starter", messagesPerSession: 30 }`
  - Write unit test: `nextTierUpgrade("agency")` → `{ nextTier: null, label: null, messagesPerSession: null }`
  - Write unit test: render `MessageLimitBanner` with `tier="pro"` → assert rendered output contains "Start a new session" and does NOT contain "Upgrade to"
  - Write unit test: render `MessageLimitBanner` with `tier="free"` → assert rendered output contains "Upgrade to Starter for 30 messages/session"
  - _Requirements: 7.1, 7.3, 3.9_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4", "5", "6", "7", "8", "9"] }
  ]
}
```

Task 1 (shared encoding utility) must complete before Task 2 (pdf-templates mojibake fix) because Task 2 imports `fixEncoding` from `lib/encoding.ts`. Tasks 3–9 are fully independent of each other and of Task 1, but are placed in the same wave as Task 2 for clarity.

## Notes

- All fixes are surgical — each task touches only the files and functions identified in the design document.
- No database schema changes are required; the `signatures.signer_action` column and `document_sessions.status` column already exist.
- The encoding fix (Tasks 1–3) addresses both Bug 1 (in-app) and Bug 8 (public sign page) because both surfaces share `lib/pdf-templates.tsx` and the same streaming route.
- Task 7 threads a new `documentStatus` prop through to `DocumentPreview`; call sites that do not yet pass this prop will get `undefined`, which is harmless since the `useEffect` only fires on `"cancelled"`.
- Steering document updates in Task 8 are documentation-only and carry zero regression risk.
