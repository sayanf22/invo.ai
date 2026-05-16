# Bugfix Requirements Document

## Introduction

A cluster of eight related production defects in the document/contract flow is degrading the perceived
quality of the app and breaking core flows (sending, signing, previewing, plan enforcement). Several of
these have been reported and patched before but the patches did not address the root cause, so the
symptoms keep returning. This spec captures every distinct defect as its own bug condition `C(X)` so
each one can be diagnosed at the root, fixed, and independently verified, with explicit preservation
goals to make sure no fix breaks anything that currently works.

The eight defects, each treated as an independent bug:

1. Mojibake on contract party labels (`â€"` instead of `—`) in preview, PDF, and the public sign page
2. Cancelled documents are still openable via their signing link
3. The "Full screen" preview button is text instead of an icon and throws an error when clicked
4. The signature on/off toggle is not exposed in the editor panel for several document types
5. The lock state in the UI does not clear after a document is cancelled
6. Tier limits (documents/month, messages/session) are not consistently enforced across plans
7. The message-limit-reached UI shows incorrect upgrade copy and does not list every document type
   available on the user's plan
8. The same mojibake appears on the public `/sign/[token]` page

## Bug Analysis

### Current Behavior (Defect)

#### Bug 1 — Mojibake on contract party labels in preview and PDF

The labels rendered for the two parties on a contract are displayed as `PARTY A â€" PROVIDER` and
`PARTY B â€" CLIENT` (the literal three-character UTF-8 mojibake `â€"` instead of the em dash `—`).
The intended source string is `Party A \u2014 Provider` (`Party A — Provider`), which is correct
in TypeScript. The corruption is introduced somewhere along the rendering path (HTML response
charset, PDF font/encoding, DB round-trip, or AI-generated payload).

1.1 WHEN a contract document is rendered in the in-app preview component THEN the system displays
    `PARTY A â€" PROVIDER` and `PARTY B â€" CLIENT` instead of `PARTY A — PROVIDER` and `PARTY B
    — CLIENT`
1.2 WHEN a contract PDF is exported via `lib/pdf-templates.tsx` THEN the system embeds the same
    mojibake `â€"` sequence in place of the em dash
1.3 WHEN a contract is previewed inside the editor (live preview) THEN the same mojibake is shown
1.4 WHEN AI-generated contract content containing an em dash is round-tripped through the database
    or the streaming API response THEN the em dash bytes are reinterpreted as Latin-1 and stored or
    served as `â€"`

#### Bug 2 — Cancelled document is still accessible via the public signing link

After the document owner cancels a sent document, the signing token URL still resolves to a working
sign page where the recipient can view and sign the document.

2.1 WHEN a user cancels a previously sent document AND a recipient subsequently visits the signing
    URL `/sign/[token]` THEN the system returns the signing UI with a usable signature pad instead
    of a cancellation notice
2.2 WHEN the signature-fetch API endpoint receives a token whose parent document is cancelled THEN
    the system returns the signature payload with HTTP 200 instead of HTTP 410 Gone with
    `{ cancelled: true }`
2.3 WHEN the recipient submits a signature against a token whose parent document is cancelled THEN
    the system accepts the signature and writes it to the database

#### Bug 3 — Fullscreen document button is text and errors on click

The control to expand the document preview to fullscreen is rendered as a text button labelled
"Full screen" rather than a recognisable icon, and clicking it throws an error instead of opening
the fullscreen view.

3.1 WHEN the document preview panel is rendered THEN the fullscreen control displays the literal
    text `Full screen` rather than a Lucide `Maximize` / `Maximize2` icon with an `aria-label`
3.2 WHEN the user clicks the fullscreen control on a contract or other document type THEN the
    handler throws a runtime error and the fullscreen modal does not open
3.3 WHEN the fullscreen control is hovered or focused THEN the system shows no tooltip or accessible
    label describing the action

#### Bug 4 — Signature on/off toggle missing in editor panel

The signature step in `editor-panel.tsx` is supposed to expose a toggle for "Show signature block on
document" so the user can hide the signature section from the PDF and preview. The toggle is missing
or not surfaced for some signable document types (contract, NDA, SOW, change order, proposal,
quotation), so users cannot turn the signature block off for those document types.

4.1 WHEN a user opens the editor panel for a signable document type other than invoice THEN the
    system does not render a clearly-labelled `Switch`/toggle control for "Show signature block"
    in the signature step
4.2 WHEN the user toggles the existing per-template signature toggle for one document type and then
    switches to another signable document type THEN the new document type does not honour or expose
    the same toggle in its editor step
4.3 WHEN the user has set `showSenderSignature = false` or `showSignatureFields = false` and the
    document is downloaded as PDF or rendered on the public sign page THEN the signature block is
    still present in at least one of those render paths

#### Bug 5 — Document lock state does not clear after cancel

When a document is cancelled (status transitions to `cancelled` from `sent`/`signed`/`finalized`),
the UI continues to show the document as locked: editor fields are read-only, the chat input is
disabled, the lock badge is visible, and the user cannot edit the document. The chat AI itself
correctly reports that the document is unlocked and in draft status, confirming a state desync
between the server's view and the client's view.

5.1 WHEN a document's `status` transitions to `cancelled` AND the user views the document in the
    editor panel THEN the system continues to render editor fields as `disabled` and shows the
    "locked" badge
5.2 WHEN a document's `status` is `cancelled` AND the chat input is rendered THEN the system keeps
    the chat input disabled
5.3 WHEN a document's `status` is `cancelled` AND `use-document-session` returns the session state
    to the UI THEN the derived `isLocked`/`isSent`/`isPaid` flags remain `true`
5.4 WHEN the chat AI message reports "your contract is currently unlocked and in draft status"
    AND the editor still renders disabled controls THEN the UI is showing a stale lock state from
    before the cancel

#### Bug 6 — Tier limits not applied consistently across plans

Per `lib/cost-protection.ts` and `docs/pricing-model.md` the canonical tier table is:

| Tier    | Docs/month | Messages/session | Doc types                       |
|---------|-----------:|-----------------:|----------------------------------|
| Free    |          5 |               10 | invoice, contract, quote        |
| Starter |         50 |               30 | All                              |
| Pro     |        150 |               50 | All                              |
| Agency  |  Unlimited |        Unlimited | All                              |

The defects:

6.1 WHEN a request to any AI route (`/api/ai/generate`, `/api/ai/stream`, `/api/ai/onboarding`)
    arrives AND the user's tier should be enforced THEN at least one of those routes does not
    invoke `checkDocumentLimit` / `checkMessageLimit` / `checkDocumentTypeAllowed` before
    consuming AI quota
6.2 WHEN session creation (`/api/sessions/create`) is called AND the user has exhausted their
    monthly document quota THEN the system creates the session anyway (the limit is checked only
    on the AI route, not on session creation, so a user can spawn unlimited empty sessions)
6.3 WHEN a Free-tier user requests a paid-only document type (e.g. proposal, NDA, SOW) THEN the
    system returns a generic 500 or proceeds with generation instead of returning a 403 with the
    `restrictionType: "document_type"` payload
6.4 WHEN tier resolution happens THEN at least one route uses the raw `profile.tier` column
    instead of `resolveEffectiveTier(subscription)`, so an expired/cancelled subscription continues
    to grant paid features
6.5 WHEN `lib/cost-protection.ts` is read THEN the per-session message caps in code (10 / 30 / 50)
    disagree with the values quoted in `.kiro/steering/security.md` and
    `.kiro/steering/implementation-guide.md` (3 docs, 25 messages for Starter), so steering
    documentation is out of sync with the enforced limits

#### Bug 7 — Message-limit-reached UI shows wrong copy and incomplete doc list

`components/message-limit-banner.tsx` and the surrounding limit-reached screen show inaccurate
upgrade copy and do not list every document type available on the user's current plan.

7.1 WHEN the message-limit-reached banner is shown to a Free-tier user THEN the system shows
    `Upgrade to Starter for 30 messages/session` even though the upsell should clearly call out
    Starter's full benefit (50 docs/month + all 4 doc types + 30 msgs/session) and link to
    `/billing` or `/pricing`
7.2 WHEN the limit-reached UI renders the "what you can create" doc-type cards for any tier THEN
    the system renders only a hard-coded subset of doc types instead of every type allowed by the
    user's tier per `getTierLimits(tier).allowedDocTypes`
7.3 WHEN a Pro or Agency user hits the per-session message cap THEN the upsell copy still says
    "Upgrade to …" instead of "Start a new session to continue", because the banner does not
    branch on tier
7.4 WHEN the banner is rendered THEN the doc-type cards do not show locked/unlocked indicators
    based on the current tier, so users on paid tiers cannot see which types they have access to

#### Bug 8 — Same mojibake on the public `/sign/[token]` page

The signing page renders the document preview and the generated PDF. Both surfaces show the same
`PARTY A â€" PROVIDER` corruption as the in-app preview, confirming that the corruption is in
either the source data or a shared render component, not just the in-app PDF path.

8.1 WHEN the public sign page `/sign/[token]` renders the document preview THEN the system
    displays `PARTY A â€" PROVIDER` and `PARTY B â€" CLIENT`
8.2 WHEN the public sign page renders the embedded PDF (via `react-pdf` + `lib/pdf-templates.tsx`)
    THEN the same mojibake appears in the PDF
8.3 WHEN the contract is sent by email and the recipient opens the email-rendered preview THEN
    the same mojibake appears in the email body / preview image

### Expected Behavior (Correct)

#### Bug 1 — Em dash renders correctly everywhere a contract is shown

1.1 WHEN a contract document is rendered in the in-app preview component THEN the system SHALL
    display `PARTY A — PROVIDER` and `PARTY B — CLIENT` with a real Unicode em dash (`U+2014`)
1.2 WHEN a contract PDF is exported via `lib/pdf-templates.tsx` THEN the system SHALL embed the
    em dash glyph correctly using a font that supports `U+2014` (Inter / Lora / Roboto Mono are
    already registered) and the resulting PDF SHALL pass a byte-level check that the rendered
    text contains `\u2014` and not the three-byte sequence `\xE2\x80\x9D` re-decoded as Latin-1
1.3 WHEN a contract is previewed inside the editor (live preview) THEN the em dash SHALL render
    correctly, identical to the standalone preview
1.4 WHEN AI-generated content is round-tripped through the database and a streaming API response
    THEN the system SHALL preserve the em dash bytes as UTF-8 end-to-end, with explicit
    `Content-Type: text/plain; charset=utf-8` (or `application/json; charset=utf-8`) on every
    response that emits document text

#### Bug 2 — Cancelled documents return 410 Gone and a clear cancellation screen

2.1 WHEN a user cancels a previously sent document AND a recipient subsequently visits
    `/sign/[token]` THEN the system SHALL render the existing `isCancelled` state UI (already
    present in `app/sign/[token]/page.tsx`) without a signature pad
2.2 WHEN the signature-fetch endpoint receives a token whose parent document is cancelled THEN
    the system SHALL return HTTP 410 with body `{ cancelled: true }` so the client triggers the
    cancellation screen
2.3 WHEN the recipient attempts to submit a signature against a cancelled document THEN the
    system SHALL reject the submission with HTTP 410 and SHALL NOT write any signature row
2.4 WHEN a document is cancelled THEN the system SHALL atomically (in the cancel handler) flip
    the corresponding `signature_requests` / `signatures` rows to `revoked`/`cancelled` so a
    later read on the public route consistently returns 410

#### Bug 3 — Fullscreen control is an icon, accessible, and works on every document type

3.1 WHEN the document preview panel is rendered THEN the fullscreen control SHALL be a
    Lucide `Maximize2` icon button with a visible-on-hover/focus tooltip, an `aria-label` of
    "Open document fullscreen", and a focus ring that meets WCAG AA contrast
3.2 WHEN the user clicks the fullscreen control on any document type THEN the system SHALL open
    a modal/dialog containing the same preview component without throwing, by passing every
    prop the inner preview needs (data, signature URLs, business profile, template, doc type)
3.3 WHEN the fullscreen modal is open THEN the user SHALL be able to close it via Escape, an
    `X` close button, or clicking the backdrop, and focus SHALL return to the originating
    button on close

#### Bug 4 — Signature on/off toggle is exposed for every signable document type

4.1 WHEN a user opens the editor panel for any signable document type (`contract`, `nda`, `sow`,
    `change_order`, `proposal`, `quotation`) THEN the system SHALL render a clearly-labelled
    Radix `Switch` for "Show signature block on document" in the signature step, wired to
    `data.showSenderSignature` (default `true`)
4.2 WHEN the toggle is flipped THEN the change SHALL be persisted to the document's stored data
    via the existing session save path AND SHALL reflect immediately in the live preview, the
    PDF export, and the public `/sign/[token]` page
4.3 WHEN `data.showSenderSignature === false` THEN the system SHALL hide the entire signature
    block (Party A and Party B) from the rendered preview, the PDF, and the public sign page,
    and SHALL NOT include a signature row by default in the database
4.4 WHEN `data.showSenderSignature === true` (default) THEN the signature block SHALL render
    with the existing `getSignaturePartyLabels(documentType)` semantics (NDA → Disclosing /
    Receiving, SOW → Client / Provider, others → Party A / Party B)

#### Bug 5 — Lock state clears immediately on cancel

5.1 WHEN a document's `status` transitions to `cancelled` THEN `use-document-session.ts` SHALL
    return derived flags `isLocked = false`, `isSent = false`, `isPaid = false` for that
    document
5.2 WHEN the editor panel renders a document whose `documentStatus === "cancelled"` THEN the
    `isSent` and `isPaid` constants in `editor-panel.tsx` SHALL evaluate to `false`, all editor
    fields SHALL become editable, and the lock badge SHALL be hidden
5.3 WHEN the chat surface renders for a cancelled document THEN the chat input SHALL be enabled
    so the user can keep iterating on the draft
5.4 WHEN the cancel action completes THEN the client cache (SWR / React Query / hook state) SHALL
    be invalidated so the lock state in the UI reflects the new server status without a hard
    refresh

#### Bug 6 — Tier limits are enforced at every entry point

6.1 WHEN any AI-quota-consuming endpoint is hit (`/api/ai/generate`, `/api/ai/stream`,
    `/api/ai/onboarding`, `/api/ai/process`, `/api/ai/profile-update`) THEN the system SHALL
    invoke `resolveEffectiveTier`, then `checkDocumentTypeAllowed`, then `checkMessageLimit`
    (when a `sessionId` is present) and finally `checkDocumentLimit` (when a new session is
    being created), in that order, and SHALL return the early 4xx response if any check fails
6.2 WHEN `/api/sessions/create` is called THEN the system SHALL invoke `checkDocumentLimit`
    BEFORE inserting a new session row so a user cannot create empty sessions to bypass the
    monthly cap
6.3 WHEN a Free-tier user requests a paid-only document type THEN the system SHALL return HTTP
    403 with body `{ error: "Document type not available on your plan", restrictionType:
    "document_type", tier: "free", allowedTypes: [...], message: "..." }` exactly as
    `checkDocumentTypeAllowed` already produces
6.4 WHEN tier is resolved for any check THEN the system SHALL use `resolveEffectiveTier(
    subscription)` against the canonical `subscriptions` row, NOT the raw `profiles.tier`
    column, so an expired or cancelled subscription downgrades the user to Free for the next
    request
6.5 WHEN `.kiro/steering/security.md` and `.kiro/steering/implementation-guide.md` reference
    tier limits THEN the values SHALL be brought back into agreement with the canonical table
    in `lib/cost-protection.ts` and `docs/pricing-model.md` (Free 5 / 10, Starter 50 / 30,
    Pro 150 / 50, Agency unlimited)

#### Bug 7 — Limit-reached UI shows accurate copy and the user's full doc-type list

7.1 WHEN the message-limit-reached banner is shown THEN the upgrade copy SHALL be derived from a
    single source of truth (`getTierLimits` + a small `nextTierUpgrade` helper) so the displayed
    "Upgrade to Starter for 30 messages/session", "Upgrade to Pro for 50 messages/session"
    string SHALL match the enforced limit byte-for-byte
7.2 WHEN the limit-reached UI renders the "what you can create" cards THEN the system SHALL
    iterate over `getTierLimits(currentTier).allowedDocTypes` (not a hard-coded subset) so paid
    plans see every document type they actually have access to
7.3 WHEN a Pro user hits the per-session cap THEN the banner SHALL say "Start a new session to
    continue" with a primary "New session" CTA and SHALL omit the upgrade-to-Pro line; an
    Agency user SHALL never see this banner because their cap is unlimited
7.4 WHEN any doc-type card is rendered THEN it SHALL show a `Lock` icon and "Upgrade to <next
    tier>" hint for any type not in the user's allowed list, matching the existing behaviour
    in `next-steps-bar.tsx`

#### Bug 8 — Public sign page renders em dash correctly across preview, PDF, and email

8.1 WHEN the public sign page renders the document preview THEN the em dash SHALL render
    correctly identically to the in-app preview (single shared `DocumentPreview` component or
    a shared label-formatting helper)
8.2 WHEN the public sign page renders the embedded PDF THEN the em dash SHALL be present as
    `U+2014` in the generated PDF, verified by the same byte-level check as 1.2
8.3 WHEN the email-rendered preview is generated (`/api/emails/view-document`) THEN the em
    dash SHALL render correctly in the email body and any inline preview image

### Unchanged Behavior (Regression Prevention)

The following behaviours MUST be preserved by every fix above:

3.1 WHEN a non-contract document type (invoice, quotation, proposal, NDA, SOW, change order)
    is rendered THEN the system SHALL CONTINUE TO render its existing party labels exactly as
    today (`From / Bill To`, `Service Provider / Client`, `Disclosing Party / Receiving Party`,
    etc.) — only the mojibake is replaced, the human-readable labels themselves do not change
3.2 WHEN any document is rendered with valid ASCII text only THEN the system SHALL CONTINUE TO
    render that text byte-for-byte identically to the pre-fix output
3.3 WHEN a document with `status` `draft`, `sent`, `signed`, or `paid` (i.e. NOT `cancelled`)
    is loaded THEN the editor SHALL CONTINUE TO derive `isLocked` from the existing rules
    (`isPaid || isSent`) — only the `cancelled` branch changes
3.4 WHEN a recipient visits a signing URL whose parent document is in any non-cancelled state
    (`pending`, `sent`, `viewed`, `signed`, `expired`) THEN the system SHALL CONTINUE TO behave
    exactly as today: pending → signing pad, signed → already-signed screen, expired → expired
    screen
3.5 WHEN the user clicks any preview control other than fullscreen (download, share, send) THEN
    the system SHALL CONTINUE TO behave exactly as today
3.6 WHEN `data.showSenderSignature` is `undefined` (the default for legacy documents) THEN the
    system SHALL CONTINUE TO treat that as `true` and render the signature block, so existing
    documents are not silently changed
3.7 WHEN a Starter, Pro, or Agency user makes any AI request that is within both their monthly
    document cap and their per-session message cap THEN the system SHALL CONTINUE TO process
    the request normally — the new tier checks add early rejection paths only, they do not
    change the happy path
3.8 WHEN a Free-tier user generates an invoice or contract within their monthly cap THEN the
    system SHALL CONTINUE TO succeed because both types remain in the Free `allowedDocTypes`
    list (`invoice`, `contract`, `quote`)
3.9 WHEN the message-limit banner is NOT shown (i.e. session is under the cap) THEN the chat
    UI SHALL CONTINUE TO render exactly as today, unchanged
3.10 WHEN any rate limiter, CSRF check, body-size limit, audit log, or cost-tracking call is
     invoked THEN the system SHALL CONTINUE TO enforce them; the tier-limit fix layers on top
     of these checks and does not replace them
3.11 WHEN signatures already exist for a document AND the document is later cancelled THEN the
     system SHALL CONTINUE TO retain the historical signature rows (audit trail) — the fix
     only marks them as `revoked`/`cancelled`, it does NOT delete them
3.12 WHEN a document is finalised by download (`finalized_at` is set) AND the user has not
     cancelled it THEN the system SHALL CONTINUE TO lock the editor as today; the cancel-clears-
     lock fix only applies to the `cancelled` status, not to `finalized`
