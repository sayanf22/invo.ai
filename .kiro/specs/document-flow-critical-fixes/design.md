# Document Flow Critical Fixes — Bugfix Design

## Overview

Eight production defects are degrading the document/contract flow. They share two root-cause
families: encoding corruption in the rendering pipeline (Bugs 1 & 8), and state/gate logic that
doesn't account for the `cancelled` document status (Bugs 2, 5). The remaining four are isolated
regressions in specific components (Bugs 3, 4, 6, 7). Each fix is surgical — it touches only the
paths required to close the bug condition, and every change is guarded by a preservation
requirement that proves existing happy paths are unchanged.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs/states that trigger a specific defect.
- **Property (P)**: The desired output or behaviour for inputs in C.
- **Preservation**: Existing correct behaviour that must not change after applying any fix.
- **isBugCondition(input)**: Pseudocode predicate that returns `true` when input falls in C.
- **F**: The original (unfixed) function/component.
- **F'**: The fixed function/component.
- **mojibake**: Character corruption that occurs when a UTF-8 byte sequence is decoded as Latin-1, turning `—` (U+2014, 3 bytes: `E2 80 94`) into `â€"`.
- **resolveEffectiveTier**: Function in `lib/cost-protection.ts` that reads the canonical subscriptions row and returns the real tier, downgrading expired/cancelled subscriptions to `"free"`.
- **checkDocumentLimit / checkMessageLimit / checkDocumentTypeAllowed**: Gate functions in `lib/cost-protection.ts` that return `null` (allowed) or a `NextResponse` 4xx (denied).
- **externallyUnlocked**: Prop on `DocumentPreview` that forces the local lock state to clear when the parent component signals an unlock.
- **signer_action**: Column on the `signatures` table (`null` | `"cancelled"` | `"declined"` | `"revision_requested"`).

---

## Bug Details

### Bug 1 & 8 — Mojibake on Contract Party Labels

#### Bug Condition

The em dash `—` (U+2014) is stored as a literal UTF-8 byte sequence in source string literals
inside `lib/pdf-templates.tsx`. Some surrounding string literals (`fmtDate`'s fallback return,
comments, helper labels) contain the raw byte triplet `\xE2\x80\x94`. When the TypeScript
compiler, the bundler, or the `@react-pdf/renderer` font subsystem subsequently reads these
bytes as Latin-1 or Windows-1252, the three bytes are individually decoded as `â`, `€`, `"` —
producing the observed `â€"` corruption. Bug 8 is the same root cause surfacing on
`app/sign/[token]/page.tsx` because both paths call the same `ContractPDF` component from
`lib/pdf-templates.tsx` and the same `DocumentPreview` for the HTML preview.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { documentType: string; renderPath: "preview" | "pdf" | "sign-page" }
  OUTPUT: boolean

  RETURN input.documentType === "contract"
         AND input.renderPath IN ["preview", "pdf", "sign-page"]
         AND partyLabelContainsLiteralUtf8EmDash(input)
END FUNCTION
```

**Concrete examples:**
- `getDocumentConfig("contract").fromLabel` returns `"Party A \u2014 Provider"` — this Unicode
  escape is safe. However `fmtDate(undefined)` returns the string literal `"—"` (raw UTF-8 bytes),
  which mojibakes when the PDF font subsystem reads the buffer as Latin-1. Any other string
  literal in the file using a raw `—` glyph is similarly affected.
- The comments in `pdf-templates.tsx` already show mojibake (`â"€â"€â"€ Signature Block Error`),
  confirming the file is being read back as Latin-1 somewhere in the toolchain.
- Bug 8: `app/sign/[token]/page.tsx` uses the identical `ContractPDF` component via
  `lib/pdf-templates.tsx`; the `SigningDocumentPreview` component also renders the HTML preview
  using `DocumentPreview` or an equivalent path, so it inherits the same corruption.

---

### Bug 2 — Cancelled Documents Still Accessible via Signing Link

#### Bug Condition

The `GET /api/signatures?token=X` handler only checks `signer_action === "cancelled"` on
the **signature row itself**. It does NOT check whether the **parent document session** has
`status = "cancelled"`. When a document owner cancels a sent document, the session row's
`status` is updated to `"cancelled"`, but the corresponding `signatures` rows still have
`signer_action = null`. The GET handler sees `null`, skips the 410 branch, and returns HTTP 200
with the full signing payload.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { token: string; sessionStatus: string; signerAction: string | null }
  OUTPUT: boolean

  RETURN sessionStatus === "cancelled"
         AND signerAction !== "cancelled"
END FUNCTION
```

**Concrete examples:**
- Document owner sends document → session `status = "sent"`, `signer_action = null`.
- Owner cancels → session `status = "cancelled"`, `signer_action` stays `null`.
- Recipient visits `/sign/[token]` → API returns HTTP 200 + signing pad. Bug active.
- If owner had cancelled the signature request (not the document), `signer_action = "cancelled"` → API correctly returns 410. Bug NOT active.

---

### Bug 3 — Fullscreen Preview Button Is Text and Throws Error

#### Bug Condition

In `components/document-preview.tsx`, the `Maximize2` icon button in the centre toolbar is
wired to `handleFitWidth` (zoom reset to 100%), NOT to a fullscreen action. There is no separate
fullscreen modal state or `<dialog>` implementation in the component. The `Maximize2` import
exists and is used, but only for fit-to-width. Any "Full screen" text button seen in the UI
must come from a different or older code path that was not replaced with a `ToolbarBtn`.
Additionally, a fullscreen modal, if implemented naively, would fail because the inner
`LivePDFPreview` requires `data` and other props that are not threaded through.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { controlClicked: "fullscreen" }
  OUTPUT: boolean

  RETURN controlClicked === "fullscreen"
         AND (rendersAsTextInsteadOfIcon OR throwsOnClick)
END FUNCTION
```

**Concrete examples:**
- Toolbar shows "Full screen" text label rather than a `Maximize2` icon with `aria-label`.
- Clicking the control throws a runtime error (missing `data` / `sessionId` props on the inner preview component).
- No keyboard-accessible close path (Escape, X button, backdrop) for the modal.

---

### Bug 4 — Signature On/Off Toggle Missing for Some Document Types

#### Bug Condition

`SignatureStep` is rendered in `LegacyEditorPanel` (invoice, contract, quote, proposal) and in
`SOWEditor`, `ChangeOrderEditor`, `NDAEditor`. However `ClientOnboardingFormEditor` and
`PaymentFollowupEditor` derive `isPaid` but never call `isSent` and never render `SignatureStep`,
leaving those document types without any signature toggle UI. Additionally in `LegacyEditorPanel`,
the `isSent` flag is only computed **inline** as a JSX prop — it is never a standalone `const`,
making it invisible to the rest of the editor for controlling field `disabled` states.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { documentType: string }
  OUTPUT: boolean

  RETURN documentType IN ["client_onboarding_form", "payment_followup"]
         AND SignatureStep NOT rendered for this type
END FUNCTION
```

**Concrete examples:**
- User opens Client Onboarding Form editor → no "Show signature block" toggle visible.
- User opens Payment Followup editor → no "Show signature block" toggle visible.
- `LegacyEditorPanel`: `isSent` is not extracted as a `const`, so the "Document has been sent" lock banner logic exists only inside `SignatureStep`, not re-usable by surrounding field controls.

---

### Bug 5 — Lock State Doesn't Clear After Cancel

#### Bug Condition

`document-preview.tsx` derives `isDocumentLocked` from **local state** (`sentAt`, `manualPaid`,
`signatures`, `paymentLinkStatus`) — NOT from the session `status` prop. When a document is
cancelled, `updateSessionStatus("cancelled")` is called in the hook but `sentAt` is still
populated (it was fetched from the DB on session load), so `isDocumentLocked` evaluates to
`true` because `!!sentAt === true`. The `externallyUnlocked` prop clears `sentAt` but is only
set to `true` by the chat "Unlock Document" card, not by the cancel action.

In `LegacyEditorPanel`, `isPaid = documentStatus === "paid"` and `isSent` (inline) equals
`documentStatus === "sent" || ...` — both correctly evaluate to `false` for `cancelled`. So
editor fields themselves are editable after cancel, but the lock badge/overlay on the PDF
preview persists because it comes from `DocumentPreview`'s own local state.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { documentStatus: string; sentAt: string | null }
  OUTPUT: boolean

  RETURN documentStatus === "cancelled"
         AND sentAt !== null
         AND externallyUnlocked === false
END FUNCTION
```

**Concrete examples:**
- Document was sent (fills `sentAt`), then cancelled → session `status = "cancelled"` but `sentAt` is not cleared in `DocumentPreview` → lock badge remains.
- AI chat correctly reports "unlocked/draft" but the preview overlay shows "Locked".

---

### Bug 6 — Tier Limits Not Consistently Enforced

#### Bug Condition

`/api/ai/onboarding/route.ts` calls `checkCostLimit(supabase, userId, "onboarding")` without
passing the `userTier` argument, so it defaults to `"free"` for all tier checks — it never
fetches the subscription row and never calls `resolveEffectiveTier`. The route also does not
call `checkDocumentTypeAllowed` or `checkMessageLimit`. All other checked routes
(`/api/ai/stream`, `/api/sessions/create`) do fetch the subscription and use
`resolveEffectiveTier` correctly.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { route: string; userTier: UserTier }
  OUTPUT: boolean

  RETURN route === "/api/ai/onboarding"
         AND userTier IN ["free"]    // effective tier not resolved, always treated as free
         OR (route === "/api/ai/onboarding" AND checkDocumentTypeAllowed NOT called)
         OR (route === "/api/ai/onboarding" AND checkMessageLimit NOT called)
END FUNCTION
```

**Concrete examples:**
- Starter-tier user sending 31st onboarding message is NOT blocked (limit = 30).
- Free-tier user hitting onboarding is compared against the correct document limit but the wrong tier context is passed (defaults to `"free"` regardless of subscription).
- Steering docs reference "3 docs / 25 messages" (old values) — canonical source is `lib/cost-protection.ts`.

---

### Bug 7 — Message-Limit-Reached UI Shows Wrong Copy

#### Bug Condition

`components/message-limit-banner.tsx` hard-codes upgrade strings (`"Upgrade to Starter for 30
messages/session"`) instead of deriving them from `getTierLimits`. For Pro and Agency users
hitting the cap, `upgradeMsg` is `null` (no upgrade link shown) but the CTA text still says
"Start a new document" instead of "Start a new session". The doc-type cards already correctly
use `getTierLimits(parsedTier).allowedDocTypes` — this part is fine.

```
FUNCTION isBugCondition(input)
  INPUT: input of type { tier: UserTier; currentMessages: number; limit: number }
  OUTPUT: boolean

  RETURN (tier === "pro" OR tier === "agency")
         AND ctaBannerText CONTAINS "Start a new document"
         AND ctaBannerText NOT CONTAINS "Start a new session"
  OR    upgradeCopyIsHardcodedNotDerivedFromGetTierLimits
END FUNCTION
```

**Concrete examples:**
- Pro user at 50/50 messages → banner says "Upgrade to…" or shows empty upgrade path → should say "Start a new session to continue".
- Agency user cannot hit the cap (limit = 0 = unlimited) → banner should never appear.
- `"Start a new document"` label is misleading — it starts a new session (conversation) not a new document export.

---

## Expected Behavior

### Preservation Requirements

The following behaviours must remain exactly unchanged after every fix:

- **3.1** Non-contract document types (`invoice`, `quote`, `proposal`, etc.) continue to render their existing party labels (`From / Bill To`, `Prepared By / Prepared For`, etc.) — only the mojibake byte sequence changes, not the human-readable label text itself.
- **3.2** Documents with ASCII-only text render byte-for-byte identically before and after the encoding fix.
- **3.3** Documents with `status` `draft`, `sent`, `signed`, `paid`, `finalized` continue to derive `isLocked` from existing rules — only `cancelled` changes.
- **3.4** Signing links for non-cancelled documents (`pending`, `sent`, `viewed`, `signed`, `expired`) continue to behave exactly as today.
- **3.5** Preview toolbar controls other than the fullscreen button (download, share, send, zoom) are unaffected.
- **3.6** `showSenderSignature === undefined` (legacy default) continues to be treated as `true`.
- **3.7** Starter/Pro/Agency users within their document and message caps continue to generate documents without any new friction.
- **3.8** Free-tier users generating invoices and contracts within their 5-document cap continue to succeed.
- **3.9** The message-limit banner is hidden when the session is under the cap — the chat UI is unchanged on the happy path.
- **3.10** Rate limiting, CSRF, body-size validation, audit logging, and cost-tracking calls are unaffected by tier-limit plumbing changes.
- **3.11** Historical signature rows for cancelled documents are retained (only marked `revoked` / `cancelled`, never deleted).
- **3.12** Documents finalised by download continue to lock the editor; the cancel-clears-lock fix applies only to `cancelled` status.

---

## Hypothesized Root Cause

### Bugs 1 & 8 — Encoding

1. **Literal UTF-8 bytes in TypeScript string literals**: `pdf-templates.tsx` contains raw
   em dash glyphs (`—`) as literal characters in strings (e.g., in `fmtDate`'s fallback
   `"—"`, and potentially in label strings). The TypeScript source is UTF-8, but the
   `@react-pdf/renderer` font subsystem or the Node.js string encoding layer treats the byte
   stream as Latin-1 when embedding text into the PDF binary.
2. **Missing `charset=utf-8` on streaming responses**: The `/api/ai/stream` route sends SSE
   text. If the browser reads the response without an explicit `charset` header, em dash
   characters in AI-generated content may arrive double-encoded.
3. **Shared component between in-app and sign-page**: Both surfaces call the same
   `ContractPDF` export from `lib/pdf-templates.tsx`, so fixing the source fixes both bugs.

### Bug 2 — Cancelled-but-active signing token

1. **Signature row `signer_action` not updated atomically on cancel**: The cancel handler
   updates the session `status` to `cancelled` but relies on a separate code path to
   invalidate signature requests. If that second update fails or is not implemented, the
   signature rows retain `signer_action = null`.
2. **GET handler checks only `signer_action`**: The signature fetch route checks
   `signer_action === "cancelled"` but does not join or check the parent session/document
   `status`, leaving a window where the parent is cancelled but the signature row is not.

### Bug 3 — Fullscreen button

1. **Maximize2 re-used for fit-to-width**: The `Maximize2` icon in the toolbar triggers
   `handleFitWidth`, not a fullscreen action.
2. **No fullscreen modal state**: `DocumentPreview` has no `isFullscreen` state variable,
   no `<dialog>` or overlay implementation, and the inner `LivePDFPreview` requires `data`
   and zoom state props that would not be automatically available in a modal.

### Bug 4 — Missing signature toggle

1. **`ClientOnboardingFormEditor` and `PaymentFollowupEditor` never render `SignatureStep`**:
   These two specialized editors were built without including the signature step.
2. **`isSent` not extracted as a const in `LegacyEditorPanel`**: Makes it harder to reuse
   the derived flag to disable other fields for sent contracts/quotes/proposals.

### Bug 5 — Stale lock state

1. **`sentAt` survives the cancel action**: `DocumentPreview` loads `sentAt` from the DB
   once on mount. The cancel flow calls `updateSessionStatus("cancelled")` in the hook but
   does not reset `sentAt` in `DocumentPreview` (which is a sibling component, not a child
   of the hook).
2. **`externallyUnlocked` only set by chat unlock**: The cancel UI path never sets
   `externallyUnlocked = true`.

### Bug 6 — Onboarding route missing tier resolution

1. **Legacy `checkCostLimit` call without tier**: The onboarding route calls
   `checkCostLimit(supabase, userId, "onboarding")` — the 4th `userTier` argument is
   omitted, so it defaults to `"free"`. No subscription fetch happens before this call.
2. **No `checkDocumentTypeAllowed` or `checkMessageLimit`**: Onboarding is a simple
   conversational flow, but it still consumes AI quota and should respect tier gates for
   consistency and abuse prevention.

### Bug 7 — Hardcoded banner copy

1. **Upgrade strings hardcoded**: `upgradeMsg` is a literal string that duplicates the
   session-limit numbers from `getTierLimits`, creating a maintenance hazard and the
   current discrepancy.
2. **"Start a new document" instead of "Start a new session"**: The CTA calls
   `onCreateDocument(type)` which creates a new session — the label should reflect that.

---

## Correctness Properties

Property 1: Bug Condition — Em Dash Renders as U+2014 End-to-End

_For any_ contract document rendered via `ContractPDF`, the in-app `DocumentPreview`, or the
public `SigningDocumentPreview`, the fixed render path SHALL produce the Unicode character
U+2014 (em dash `—`) wherever an em dash appears in party labels, date fallbacks, or
AI-generated content. The generated PDF binary SHALL NOT contain the three-byte Latin-1
mojibake sequence `\xC3\xA2\xE2\x82\xAC` (the UTF-8 for `â€"`) in place of U+2014.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 8.1, 8.2**

Property 2: Bug Condition — Cancelled Document Returns 410 on Signing Route

_For any_ HTTP GET to `/api/signatures?token=T` where the parent document session has
`status = "cancelled"`, the fixed API SHALL return HTTP 410 with body
`{ cancelled: true }`, regardless of the value of `signer_action` on the signature row.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 3: Bug Condition — Fullscreen Button Renders as Icon and Opens Modal

_For any_ render of `DocumentPreview` with non-empty `data`, the fullscreen toolbar button
SHALL render as a `ToolbarBtn` wrapping a `Maximize2` icon (not a text string), clicking it
SHALL open a fullscreen modal that receives all required props without throwing, and the
modal SHALL be closeable via Escape, an X button, or backdrop click.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 4: Bug Condition — Signature Toggle Visible for All Signable Document Types

_For any_ signable document type (`contract`, `nda`, `sow`, `change_order`, `proposal`,
`quotation`, `client_onboarding_form`, `payment_followup`) rendered in its editor panel,
the fixed `EditorPanel` SHALL render a `SignatureStep` containing both the
`showSignatureFields` toggle and the `showSenderSignature` toggle.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

Property 5: Bug Condition — Lock State Clears on Cancel

_For any_ `DocumentPreview` rendered with a `documentStatus` of `"cancelled"`, the fixed
component SHALL derive `isDocumentLocked = false`, hide the lock badge, and treat `sentAt`
as effectively `null`, regardless of what `sentAt` is in local DB state.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

Property 6: Bug Condition — Onboarding Route Enforces Tier Gates

_For any_ request to `/api/ai/onboarding`, the fixed route SHALL fetch the user's
subscription row, call `resolveEffectiveTier`, and check `checkMessageLimit` before
consuming AI quota. Requests that exceed the limit SHALL return HTTP 429.

**Validates: Requirements 6.1, 6.4**

Property 7: Bug Condition — Message-Limit Banner Shows Tier-Derived Copy

_For any_ `MessageLimitBanner` rendered with `tier = "pro"` or `tier = "agency"`, the
fixed component SHALL NOT render an "Upgrade to…" call to action, SHALL display a "Start
a new session" primary label, and SHALL derive all numeric limits from `getTierLimits`.

**Validates: Requirements 7.1, 7.3**

Property 8: Preservation — Non-Cancelled Documents Remain Locked

_For any_ `DocumentPreview` rendered with `documentStatus` in
`["sent", "signed", "paid", "finalized"]` AND `sentAt` is non-null AND `externallyUnlocked`
is `false`, the fixed component SHALL produce `isDocumentLocked = true`, identical to
pre-fix behaviour.

**Validates: Requirements 3.3, 3.12**

Property 9: Preservation — Non-Buggy Signing Tokens Unaffected

_For any_ HTTP GET to `/api/signatures?token=T` where the parent document session has
`status` NOT equal to `"cancelled"`, the fixed handler SHALL return the same HTTP status
and body as the original handler.

**Validates: Requirements 3.4**

Property 10: Preservation — Within-Limit AI Requests Succeed

_For any_ request to `/api/ai/onboarding` where the user's message count for the session
is strictly less than `getTierLimits(userTier).messagesPerSession`, the fixed route SHALL
process the request normally and return a successful response.

**Validates: Requirements 3.7, 3.10**

---

## Fix Implementation

### Shared Utility: `lib/encoding.ts` (new file)

Create a small helper module with two exports:

```typescript
/**
 * Replace literal mojibake sequences with their correct Unicode equivalents.
 * Handles the most common case: UTF-8 em dash read as Latin-1.
 *
 * Call this on any string that may have passed through a Latin-1 decode layer.
 */
export function fixEncoding(str: string): string {
  return str
    .replace(/\u00e2\u0080\u0094/g, "\u2014")  // â€" → —
    .replace(/\u00e2\u0080\u0093/g, "\u2013")  // â€" → –
    .replace(/\u00e2\u0080\u009c/g, "\u201c")  // â€œ → "
    .replace(/\u00e2\u0080\u009d/g, "\u201d")  // â€  → "
    .replace(/\u00e2\u0080\u0098/g, "\u2018")  // â€˜ → '
    .replace(/\u00e2\u0080\u0099/g, "\u2019")  // â€™ → '
}

/**
 * Ensure all Unicode escape sequences in a JS string are preserved as-is.
 * Use this to validate that a string round-tripped correctly.
 * Returns true if no mojibake byte patterns are detected.
 */
export function isCleanUtf8(str: string): boolean {
  return !/[\u00e2][\u0080][\u0094\u0093\u009c\u009d\u0098\u0099]/.test(str)
}
```

---

### Bug 1 & 8 — `lib/pdf-templates.tsx`

**Changes Required:**

1. **Replace all literal em dash glyphs with `\u2014`** in string literals throughout the file.
   The two confirmed locations are:
   - `fmtDate` fallback: `return "—"` → `return "\u2014"`
   - Any other inline `—` in labels, comments used as string values (comments can stay as-is
     since they are stripped at compile time and don't affect output).

2. **`getDocumentConfig("contract").fromLabel`** is already `"Party A \u2014 Provider"` — no
   change needed here. Verify `toLabel` is also using `\u2014`.

3. **Add `fixEncoding` guard on AI-generated text fields**: In `ContractPDF` and any component
   that renders the `description` field (the body of the contract generated by the AI), wrap
   the string through `fixEncoding(data.description ?? "")` before rendering in a `<Text>`
   node. This catches any mojibake that arrives from the AI streaming layer.

4. **File-level**: Ensure the file starts with `// @ts-check` or a BOM-free UTF-8 declaration.
   The simplest fix is to replace the BOM prefix `` (visible in the raw file) with nothing
   and ensure the TypeScript compiler handles it as UTF-8 (it already does for `\u` escapes).

**File**: `lib/pdf-templates.tsx`  
**Functions**: `fmtDate`, `getDocumentConfig`, `ContractPDF`

---

### Bug 1 & 8 — Streaming Response Headers

**File**: `app/api/ai/stream/route.ts`

**Change**: Ensure the `ReadableStream` response includes `Content-Type: text/event-stream; charset=utf-8`. Currently the response likely omits `; charset=utf-8`:

```typescript
// Before (inferred):
new Response(stream, { headers: { "Content-Type": "text/event-stream" } })

// After:
new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  }
})
```

---

### Bug 2 — `app/api/signatures/route.ts` (GET handler)

**Changes Required:**

1. **In the token-based GET path**, after fetching the signature row, check the parent
   document session status. The existing query already joins `documents(id, type, data, status)`
   via the `documents` foreign key. Add an additional check on the parent session:

```typescript
// After fetching signature and before the existing signer_action check:
// Check if the parent DOCUMENT SESSION is cancelled
const sessionId = (signature as any).session_id
if (sessionId) {
  const { data: parentSession } = await serviceSupabase
    .from("document_sessions")
    .select("status")
    .eq("id", sessionId)
    .single()
  if (parentSession?.status === "cancelled") {
    return NextResponse.json(
      { error: "This document has been cancelled by the owner.", cancelled: true },
      { status: 410 }
    )
  }
}
```

2. **Atomically mark signature rows on document cancel**: In the cancel handler
   (wherever `document_sessions` is updated to `status = "cancelled"`), also update the
   corresponding signature rows:

```typescript
await supabase
  .from("signatures")
  .update({ signer_action: "cancelled" })
  .eq("session_id", sessionId)
  .is("signed_at", null) // only revoke unsigned rows
```

   This ensures future token fetches hit the existing `signer_action === "cancelled"` check
   (belt-and-suspenders with the new session-status check above).

**File**: `app/api/signatures/route.ts`  
**Function**: `GET` handler (token lookup branch)

---

### Bug 3 — `components/document-preview.tsx`

**Changes Required:**

1. **Add fullscreen state**:
```typescript
const [isFullscreen, setIsFullscreen] = useState(false)
```

2. **Replace the existing `Maximize2` toolbar button** (currently wired to `handleFitWidth`)
   with two separate buttons:
   - Fit-to-width: `RotateCcw`-style reset (keep existing)  
   - Fullscreen: new `ToolbarBtn` with `Maximize2` and `title="Open fullscreen"`:

```tsx
<ToolbarBtn
  onClick={() => setIsFullscreen(true)}
  title="Open document fullscreen"
>
  <Maximize2 className="w-4 h-4" />
</ToolbarBtn>
```

3. **Implement the fullscreen modal** as a portal/overlay rendered at the end of the
   component return, passing all required `LivePDFPreview` props:

```tsx
{isFullscreen && (
  <div
    className="fixed inset-0 z-50 bg-background flex flex-col"
    role="dialog"
    aria-modal="true"
    aria-label="Document fullscreen preview"
  >
    {/* Toolbar */}
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
      <span className="text-sm font-semibold">Preview</span>
      <div className="flex items-center gap-2">
        {/* zoom controls */}
        <ToolbarBtn onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </ToolbarBtn>
        <span className="text-xs font-semibold min-w-[40px] text-center">{zoom}%</span>
        <ToolbarBtn onClick={handleZoomIn} disabled={!canZoomIn} title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </ToolbarBtn>
        <button
          type="button"
          autoFocus
          onClick={() => setIsFullscreen(false)}
          className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/60 transition-colors"
          aria-label="Close fullscreen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
    {/* Backdrop click closes */}
    <div
      className="flex-1 overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false) }}
    >
      <LivePDFPreview
        data={data}
        zoom={zoom}
        onPageCount={setPageCount}
        locked={isDocumentLocked}
        lockReason={lockReason}
      />
    </div>
  </div>
)}
```

4. **Keyboard Escape handler**:
```typescript
useEffect(() => {
  if (!isFullscreen) return
  const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false) }
  document.addEventListener("keydown", handler)
  return () => document.removeEventListener("keydown", handler)
}, [isFullscreen])
```

**File**: `components/document-preview.tsx`  
**Functions**: `DocumentPreview` (new state + modal), toolbar JSX

---

### Bug 4 — `components/editor-panel.tsx`

**Changes Required:**

1. **`ClientOnboardingFormEditor`**: Add `isSent` derivation and a Signature step:
```typescript
const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
```
Then add a final `<Step>` at the bottom of the editor:
```tsx
<Step number={N} title="Signature" isComplete={data.signatureName.trim().length > 0} ...>
  <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
</Step>
```

2. **`PaymentFollowupEditor`**: Same change — add `isSent` derivation and `SignatureStep` step.

3. **`LegacyEditorPanel`**: Extract `isSent` as a proper `const` so it can be used by field
   `disabled` props:
```typescript
const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
```
   Update `SignatureStep` call to use the const rather than the inline expression.

**File**: `components/editor-panel.tsx`  
**Functions**: `ClientOnboardingFormEditor`, `PaymentFollowupEditor`, `LegacyEditorPanel`

---

### Bug 5 — `components/document-preview.tsx` + `components/editor-panel.tsx`

**Changes Required:**

1. **`DocumentPreview` props**: Add `documentStatus?: string` to `DocumentPreviewProps`.

2. **Clear lock state when `documentStatus === "cancelled"`**:
```typescript
useEffect(() => {
  if (documentStatus === "cancelled") {
    setSentAt(null)
    setManualPaid(false)
    setSignatures(prev =>
      prev.map(s => s.signed_at === null ? { ...s, signer_action: "cancelled" } : s)
    )
  }
}, [documentStatus])
```

3. **`LegacyEditorPanel`**: Update `isPaid` and `isSent` derivation to exclude `cancelled`:
```typescript
const isPaid = documentStatus === "paid" && documentStatus !== "cancelled"
const isSent = (documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized")
               && documentStatus !== "cancelled"
```
   (The `&& documentStatus !== "cancelled"` guard is technically redundant since `"cancelled"`
   never equals `"paid"` / `"sent"` / etc., but it makes the intent explicit and documents the
   decision for future readers.)

4. **Pass `documentStatus` from the parent** (wherever `DocumentPreview` is instantiated,
   typically `prompt-screen.tsx`): thread the session status through.

5. **`use-document-session.ts`**: Ensure `updateSessionStatus("cancelled")` is called
   immediately after the cancel API responds successfully (it likely is already, but verify
   the cancel flow in `document-preview.tsx`'s `handleCancelSignature` and the broader
   cancel document action). No change needed to the hook itself — `updateSessionStatus` is
   already implemented and correctly sets local session state.

**Files**: `components/document-preview.tsx`, `components/editor-panel.tsx`, parent page that renders both

---

### Bug 6 — `app/api/ai/onboarding/route.ts`

**Changes Required:**

Fetch the subscription row and resolve tier before the cost check:

```typescript
// After authenticateRequest and before checkCostLimit:
const { data: subscription } = await (auth.supabase as any)
  .from("subscriptions")
  .select("plan, status, current_period_end")
  .eq("user_id", auth.user.id)
  .single()
const userTier = resolveEffectiveTier(subscription as any)

// Replace existing:
// const costError = await checkCostLimit(auth.supabase, auth.user.id, "onboarding")
// With:
const costError = await checkCostLimit(auth.supabase, auth.user.id, "onboarding", userTier)
if (costError) return costError

// Add message limit check (onboarding has no sessionId in current impl, so skip if absent):
const sessionId = body.sessionId as string | undefined
if (sessionId) {
  const limitError = await checkMessageLimit(auth.supabase, auth.user.id, sessionId, userTier)
  if (limitError) return limitError
}
```

**Also**: Update `.kiro/steering/security.md` and `.kiro/steering/implementation-guide.md` to
reference the canonical tier table from `lib/cost-protection.ts` (Free 5/10, Starter 50/30,
Pro 150/50, Agency unlimited). The steering docs currently say "3 docs / 25 messages for Starter"
which is stale.

**File**: `app/api/ai/onboarding/route.ts`  
**Also**: `.kiro/steering/security.md`, `.kiro/steering/implementation-guide.md`

---

### Bug 7 — `components/message-limit-banner.tsx` + `lib/cost-protection.ts`

**Changes Required:**

1. **Add `nextTierUpgrade` helper to `lib/cost-protection.ts`**:
```typescript
export function nextTierUpgrade(currentTier: UserTier): {
  nextTier: UserTier | null
  label: string | null
  messagesPerSession: number | null
} {
  switch (currentTier) {
    case "free":    return { nextTier: "starter", label: "Starter", messagesPerSession: TIER_LIMITS.starter.messagesPerSession }
    case "starter": return { nextTier: "pro",     label: "Pro",     messagesPerSession: TIER_LIMITS.pro.messagesPerSession }
    case "pro":
    case "agency":  return { nextTier: null, label: null, messagesPerSession: null }
  }
}
```

2. **Update `MessageLimitBanner`**:
```typescript
const { nextTier, label: nextLabel, messagesPerSession } = nextTierUpgrade(parsedTier)

const upgradeMsg = nextTier
  ? `Upgrade to ${nextLabel} for ${messagesPerSession} messages/session`
  : null

const ctaLabel = nextTier
  ? "Start a new session or upgrade"
  : "Start a new session to continue"
```

3. **Replace hardcoded body text** `"Start a new document"` → `"Start a new session"`:
```tsx
<p className="text-xs text-amber-700 dark:text-amber-300 mb-2.5 ml-8">
  Start a new session to continue chatting
</p>
```

4. The doc-type cards already use `getTierLimits(parsedTier).allowedDocTypes` — **no change
   needed** for that section.

**File**: `components/message-limit-banner.tsx`, `lib/cost-protection.ts`

---

## Testing Strategy

### Validation Approach

The testing strategy follows the bug condition methodology: first write **exploratory tests** that
run on unfixed code and surface counterexamples, then write **fix-checking tests** that pass only
after the fix, and finally **preservation tests** that verify no regression on non-buggy inputs.

---

### Exploratory Bug Condition Checking

**Goal**: Confirm the root cause before implementing each fix. Run these on the unfixed codebase.

**Plan per Bug:**

| Bug | Test | Expected failure on unfixed code |
|-----|------|----------------------------------|
| 1 & 8 | Call `fmtDate(undefined)` → assert result is `"\u2014"` | Returns `"â€"` |
| 1 & 8 | Render `ContractPDF` → extract text from PDF bytes → assert `\u2014` present | PDF text contains `â€"` |
| 2 | Fetch `GET /api/signatures?token=T` for a token whose session has `status=cancelled` but `signer_action=null` → assert HTTP 410 | Returns HTTP 200 |
| 3 | Render `DocumentPreview` → assert toolbar contains a button with `aria-label="Open document fullscreen"` | No such button found |
| 4 | Render `ClientOnboardingFormEditor` → assert it contains a toggle with `aria-label="Toggle signature fields visibility"` | Toggle absent |
| 5 | Render `DocumentPreview` with `documentStatus="cancelled"` and non-null `sentAt` → assert `isDocumentLocked` is `false` | `isDocumentLocked` is `true` |
| 6 | POST to `/api/ai/onboarding` as a Free-tier user at 11 messages (limit = 10) → assert HTTP 429 | Returns HTTP 200 |
| 7 | Render `MessageLimitBanner` with `tier="pro"` → assert no "Upgrade to" text | "Upgrade to…" visible |

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces
the expected behaviour.

```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT property(result)
END FOR
```

**Per-bug fix checks:**

- **Bugs 1 & 8**: For all strings returned by `fmtDate`, `getDocumentConfig`, and
  `ContractPDF` text nodes, assert `isCleanUtf8(result) === true`.
- **Bug 2**: For any token whose parent session is `cancelled`, API returns HTTP 410 with
  `{ cancelled: true }`. Submit-signature endpoint returns HTTP 410 for cancelled sessions.
- **Bug 3**: Click the fullscreen `ToolbarBtn` → modal opens, `LivePDFPreview` receives
  `data` without throwing, Escape closes modal.
- **Bug 4**: All 8 signable doc types have `SignatureStep` in their editor.
- **Bug 5**: `DocumentPreview` with `documentStatus="cancelled"` + non-null `sentAt` →
  `isDocumentLocked === false`.
- **Bug 6**: Onboarding route with a session at the message limit returns HTTP 429.
- **Bug 7**: `MessageLimitBanner` with `tier="pro"` shows "Start a new session" CTA and no
  "Upgrade to" string.

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code
produces the same result as the original code.

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT F(input) = F'(input)
END FOR
```

Property-based testing is recommended for preservation because it generates many test cases
automatically across the input domain, catching edge cases manual tests miss.

**Preservation test plan:**

| Area | Approach | What to check |
|------|----------|---------------|
| Encoding | PBT: generate random ASCII-only strings → pass through `fixEncoding` → assert unchanged | ASCII strings round-trip unchanged |
| Signing tokens | PBT: generate tokens with `status` ∈ `["sent","viewed","signed","expired"]` → assert API returns same status code as before | No regression on valid tokens |
| Lock state | PBT: `documentStatus` ∈ `["sent","paid","signed","finalized"]` + non-null `sentAt` → assert `isDocumentLocked=true` | Cancel fix doesn't affect other statuses |
| Tier limits | PBT: generate random message counts within limit → assert onboarding route returns 200 | Within-limit requests unblocked |
| Banner doc types | Property: `MessageLimitBanner` for any tier → assert `visibleTypes ⊆ getTierLimits(tier).allowedDocTypes` | Doc-type cards always match tier |

---

### Unit Tests

- `fixEncoding("â€"")` → `"—"` (U+2014)
- `fixEncoding("hello world")` → `"hello world"` (identity on ASCII)
- `isCleanUtf8("—")` → `true`; `isCleanUtf8("â€"")` → `false`
- `fmtDate(undefined)` → string matching `/\u2014/`
- `GET /api/signatures?token=T` with cancelled session → 410 `{ cancelled: true }`
- `GET /api/signatures?token=T` with non-cancelled session → 200
- `DocumentPreview` with `documentStatus="cancelled"` → `isDocumentLocked=false`
- `DocumentPreview` with `documentStatus="sent"` and `externallyUnlocked=false` → `isDocumentLocked=true`
- `nextTierUpgrade("free")` → `{ nextTier: "starter", label: "Starter", messagesPerSession: 30 }`
- `nextTierUpgrade("agency")` → `{ nextTier: null, label: null, messagesPerSession: null }`
- `MessageLimitBanner` with `tier="pro"` → contains "Start a new session", no "Upgrade to"
- `MessageLimitBanner` with `tier="free"` → contains "Upgrade to Starter for 30 messages/session"

### Property-Based Tests

- **Property 1**: For any string `s` where `isCleanUtf8(s) === true`, `fixEncoding(s) === s` (identity on clean strings).
- **Property 2**: For any signing token with `sessionStatus !== "cancelled"`, the GET handler response status is identical before and after the fix.
- **Property 3**: For any `documentStatus` in `["sent", "paid", "signed", "finalized"]` and any non-null `sentAt`, `DocumentPreview` `isDocumentLocked` is `true` after the fix.
- **Property 4**: For any `tier` value, `MessageLimitBanner` doc-type cards are a strict subset of `getTierLimits(parseTier(tier)).allowedDocTypes`.
- **Property 5**: For any message count `n < getTierLimits(userTier).messagesPerSession`, the onboarding route returns a non-429 response.

### Integration Tests

- Full contract PDF generation → download → verify no mojibake in rendered text via `pdfjs-dist` text extraction.
- Public sign page renders contract → verify em dash in `"Party A — Provider"` label.
- Document cancel flow → visit signing URL → confirm 410 cancelled screen.
- Open fullscreen from `DocumentPreview` → interact with zoomed PDF → close via Escape.
- Open Client Onboarding Form editor → locate and toggle "Show signature block" → verify preview updates.
- Cancel a sent document → re-open editor → verify fields are editable and lock badge is hidden.
- Onboarding route: user at message limit → receives 429.

---

## Risk and Regression Analysis

| Fix | Risk Level | Regression Risk | Mitigation |
|-----|-----------|-----------------|------------|
| Encoding: replace `"—"` with `"\u2014"` | Low | None — pure string substitution | Unit test all replaced strings |
| Encoding: `fixEncoding` guard on AI text | Low | None — only applies to string output | Identity property test (ASCII unchanged) |
| Signing: session status check on GET | Low | Low — new early-exit path | Preservation property test on non-cancelled tokens |
| Signing: atomically revoke signatures on cancel | Medium | Medium — affects signature audit rows | Test that `signed_at !== null` rows are NOT updated |
| Fullscreen modal: new `isFullscreen` state | Low | None — additive | Existing toolbar buttons untouched |
| Fullscreen: `Maximize2` repurposed | Low | None — only adds new button, fit-to-width still present | Verify fit-to-width still works |
| Signature toggle: add to 2 editors | Low | None — additive | Verify existing editors unchanged |
| Lock state: `documentStatus` prop on preview | Medium | Medium — threads new prop through parent | Add default `documentStatus=""` to avoid regressions on call sites that don't pass it |
| Lock state: `isPaid`/`isSent` guard | Low | None — `cancelled` never matched those values anyway | Explicit test that non-cancelled statuses still lock |
| Onboarding tier check | Low | Low — new validation path only rejects over-limit | Within-limit requests confirmed unblocked by PBT |
| Banner copy: `nextTierUpgrade` helper | Low | None — isolated to banner component | Snapshot test for each tier |
| Steering doc updates | None | N/A | Documentation only |
