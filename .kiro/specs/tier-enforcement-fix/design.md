# Tier Enforcement Fix — Bugfix Design

## Overview

Three related bugs allow free-tier users to bypass subscription limits in Invo.ai: (1) AI profile editing is available to all tiers instead of being gated to starter+, (2) session creation skips document limit and document type checks, and (3) no upgrade prompt is shown when limits are hit. The fix adds tier checks at both the API and UI layers, using the existing `checkDocumentLimit()`, `checkDocumentTypeAllowed()`, and `getTierLimits()` functions in `lib/cost-protection.ts`, and introduces an upgrade modal component for clear user feedback.

## Glossary

- **Bug_Condition (C)**: A request or UI interaction where a free-tier user accesses a feature restricted to paid tiers, or any user exceeds their tier's document limit, without being blocked
- **Property (P)**: The system correctly enforces tier restrictions — blocking disallowed actions with appropriate HTTP status codes and showing an upgrade prompt to the user
- **Preservation**: Existing behavior for paid-tier users, within-limit usage, onboarding AI, and successful API responses must remain unchanged
- **UserTier**: One of `free`, `starter`, `pro`, `agency` — fetched from the `subscriptions` table (`plan` column)
- **SectionChatBar**: The inline AI chat component rendered inside each profile section when editing — should be hidden for free-tier users
- **checkDocumentLimit()**: Existing function in `lib/cost-protection.ts` that returns a 429 `NextResponse` if the user's monthly document count exceeds their tier limit
- **checkDocumentTypeAllowed()**: Existing function in `lib/cost-protection.ts` that returns a 403 `NextResponse` if the requested document type is not in the user's tier's `allowedDocTypes`

## Bug Details

### Bug Condition

The bugs manifest across three enforcement points: the profile page UI renders AI editing for all tiers, the session creation API skips limit/type checks, and the frontend doesn't surface upgrade prompts when the API returns 429/403 tier-related errors.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action, userTier, documentCount, tierLimit, documentType, allowedTypes, apiStatus }
  OUTPUT: boolean

  // Bug 1: Free-tier user sees AI chat bar on profile edit
  IF input.action == "profile_edit_ai" AND input.userTier == "free"
    RETURN true

  // Bug 2: Free-tier user calls profile-update API
  IF input.action == "api_profile_update" AND input.userTier == "free"
    RETURN true

  // Bug 3: User creates session exceeding document limit
  IF input.action == "api_session_create" AND input.documentCount >= input.tierLimit AND input.tierLimit > 0
    RETURN true

  // Bug 4: Free-tier user creates restricted document type
  IF input.action == "api_session_create" AND input.documentType NOT IN input.allowedTypes
    RETURN true

  // Bug 5: Frontend receives 429/403 but shows no upgrade prompt
  IF input.action == "frontend_error_handling" AND input.apiStatus IN [429, 403] AND input.apiStatus has tier info
    RETURN true

  RETURN false
END FUNCTION
```

### Examples

- A free-tier user clicks "Edit" on the Business Information section → the `SectionChatBar` AI input renders, allowing them to type "change my business name to X" and have AI process it. **Expected**: AI chat bar should be hidden; only manual form fields shown.
- A free-tier user has created 3 documents this month (their limit) and calls `POST /api/sessions/create` → the session is created successfully and document count becomes 4. **Expected**: API returns 429 with `{ error: "Monthly document limit reached", currentUsage: 3, limit: 3, tier: "free" }`.
- A free-tier user calls `POST /api/sessions/create` with `documentType: "quotation"` → the session is created. **Expected**: API returns 403 with `{ error: "Document type not available on your plan", requestedType: "quotation", allowedTypes: ["invoice", "contract"] }`.
- The `/api/ai/stream` endpoint returns a 429 with tier info → `InvoiceChat` shows a plain text message but no upgrade modal. **Expected**: An upgrade dialog appears with current usage, plan limits, and a link to the billing page.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Users on starter, pro, or agency tiers MUST continue to see the `SectionChatBar` AI chat component when editing profile sections
- The `/api/ai/onboarding` endpoint MUST continue to allow AI-powered profile setup for ALL tiers (free included)
- Session creation MUST continue to succeed for users within their tier's monthly document limit
- Free-tier users MUST continue to create `invoice` and `contract` sessions within their 3-document monthly limit
- Paid-tier users MUST continue to create any of the 4 document types (invoice, contract, quotation, proposal)
- Successful AI responses (200 status) MUST continue to display generated content normally without any upgrade prompt
- The existing per-session message limit handling in `/api/ai/stream` (429 → `MessageLimitBanner`) MUST continue to work as before

**Scope:**
All inputs that do NOT involve tier-restricted actions or limit-exceeded states should be completely unaffected by this fix. This includes:
- Normal document generation within limits
- All paid-tier user workflows
- Onboarding flow for any tier
- Manual profile editing (form fields) for any tier
- File upload and analysis features
- Document export/download functionality

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing tier check in profile page UI**: `app/profile/page.tsx` renders `SectionChatBar` unconditionally inside each `Card` when `isEditing(section)` is true. There is no user tier state fetched or checked. The component needs to fetch the user's tier from the `subscriptions` table and conditionally render `SectionChatBar` only for `starter`+ tiers.

2. **Missing tier check in profile-update API**: `app/api/ai/profile-update/route.ts` calls `authenticateRequest()` and `checkCostLimit()` but never fetches the user's subscription tier to distinguish free from paid. The `checkCostLimit()` call defaults to `userTier = "free"` which delegates to `checkDocumentLimit()` — but this checks document count, not whether AI profile editing is allowed. A separate explicit tier check is needed.

3. **Missing `checkDocumentLimit()` call in session creation**: `app/api/sessions/create/route.ts` inserts the session row and calls `incrementDocumentCount()` without first calling `checkDocumentLimit()`. The function exists in `lib/cost-protection.ts` and is ready to use — it just isn't called.

4. **Missing `checkDocumentTypeAllowed()` call in session creation**: Same route validates `documentType` is one of the 4 valid strings but doesn't call `checkDocumentTypeAllowed()` to check tier-based restrictions. The function exists and is ready to use.

5. **No upgrade modal in frontend**: `components/invoice-chat.tsx` handles 429 for message limits specifically (checking `errorData.error === "Session message limit reached"`) but has no handling for document-limit 429s or tier-restriction 403s. There is no upgrade modal component in the codebase.

## Correctness Properties

Property 1: Bug Condition — AI Profile Editing Blocked for Free Tier

_For any_ user where the subscription tier is "free", the profile page SHALL NOT render the `SectionChatBar` component in any section, AND the `POST /api/ai/profile-update` endpoint SHALL return a 403 response with an upgrade message, preventing AI-assisted profile editing.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Session Creation Enforces Document Limits

_For any_ user whose current monthly document count is greater than or equal to their tier's `documentsPerMonth` limit (and the limit is not 0/unlimited), the `POST /api/sessions/create` endpoint SHALL return a 429 response with usage info and an upgrade message, preventing session creation.

**Validates: Requirements 2.3**

Property 3: Bug Condition — Session Creation Enforces Document Type Restrictions

_For any_ user whose tier's `allowedDocTypes` does not include the requested `documentType`, the `POST /api/sessions/create` endpoint SHALL return a 403 response indicating the document type is not available on their plan.

**Validates: Requirements 2.4**

Property 4: Bug Condition — Upgrade Modal Shown on Tier Errors

_For any_ API response with status 429 (document limit) or 403 (tier restriction) that includes tier information, the frontend SHALL display an upgrade modal/dialog showing current usage, plan limits, and a call-to-action linking to the billing page.

**Validates: Requirements 2.5**

Property 5: Preservation — Paid Tier AI Profile Editing Unchanged

_For any_ user where the subscription tier is in {starter, pro, agency}, the profile page SHALL continue to render the `SectionChatBar` component when editing, AND the `POST /api/ai/profile-update` endpoint SHALL continue to process requests normally, preserving all existing AI profile editing functionality.

**Validates: Requirements 3.1, 3.2**

Property 6: Preservation — Within-Limit Session Creation Unchanged

_For any_ user whose current monthly document count is below their tier's limit, AND whose requested document type is in their tier's `allowedDocTypes`, the `POST /api/sessions/create` endpoint SHALL continue to create the session successfully and increment the document count, preserving existing session creation behavior.

**Validates: Requirements 3.3, 3.4, 3.5**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `app/profile/page.tsx`

**Changes**:
1. **Fetch user tier**: Add state for `userTier` and fetch it from the `subscriptions` table on mount (alongside the existing profile fetch). Default to `"free"` if no subscription row exists.
2. **Gate SectionChatBar rendering**: Wrap each `SectionChatBar` render in a condition: only render when `userTier !== "free"`. The 6 instances (business, contact, address, tax, payment, notes) all follow the pattern `{isEditing("section") && <SectionChatBar ... />}` — add `&& userTier !== "free"` to each.
3. **Gate "Update with AI" button**: Hide the top-level "Update with AI" button (which opens the `ProfileUpdateChat` dialog) for free-tier users, since that dialog also uses AI.

**File**: `app/api/ai/profile-update/route.ts`

**Function**: `POST` handler

**Changes**:
1. **Fetch user tier**: After `authenticateRequest()`, query the `subscriptions` table for the user's `plan`. Default to `"free"`.
2. **Block free-tier users**: If tier is `"free"`, return a 403 response: `{ error: "AI profile editing requires a paid plan", tier: "free", message: "Upgrade to Starter to use AI-powered profile editing" }`. This check must come before the DeepSeek API call.
3. **Preserve onboarding**: This change does NOT affect `/api/ai/onboarding/route.ts` — that endpoint remains open to all tiers.

**File**: `app/api/sessions/create/route.ts`

**Function**: `POST` handler

**Changes**:
1. **Fetch user tier**: After `authenticateRequest()`, query the `subscriptions` table for the user's `plan`. Default to `"free"`.
2. **Call `checkDocumentTypeAllowed()`**: Before the insert, call `checkDocumentTypeAllowed(body.documentType, userTier)`. If it returns a `NextResponse`, return it immediately (403).
3. **Call `checkDocumentLimit()`**: Before the insert, call `await checkDocumentLimit(auth.supabase, auth.user.id, userTier)`. If it returns a `NextResponse`, return it immediately (429).
4. **Order**: Type check first (fast, no DB query), then limit check (requires DB query), then insert + increment.

**File**: `components/invoice-chat.tsx`

**Changes**:
1. **Handle 429 document-limit errors**: In the `sendMessage` function's error handling for `response.status === 429`, add a branch for `errorData.error === "Monthly document limit reached"` that triggers the upgrade modal.
2. **Handle 403 tier-restriction errors**: Add handling for `response.status === 403` where `errorData.error` contains tier info, triggering the upgrade modal.
3. **Add upgrade modal state**: Add `showUpgradeModal` and `upgradeInfo` state to track when to show the modal and what data to display.
4. **Render UpgradeModal**: Import and render the new `UpgradeModal` component, passing usage info and a link to `/billing`.

**New File**: `components/upgrade-modal.tsx`

**Changes**:
1. **Create UpgradeModal component**: A shadcn `Dialog` component that displays:
   - Current plan name and usage (e.g., "Free Plan — 3/3 documents used")
   - What the next tier offers (e.g., "Upgrade to Starter for 50 documents/month")
   - A primary CTA button linking to `/billing` or `/pricing`
   - A secondary dismiss button
2. **Props**: `open`, `onOpenChange`, `tier`, `currentUsage`, `limit`, `errorType` (limit vs type restriction), `message`
3. **Styling**: Use existing shadcn Dialog, consistent with the app's rounded-2xl, shadow-sm design language

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that simulate tier-restricted requests and verify the current (broken) behavior allows them through. Run these tests on the UNFIXED code to observe the bugs.

**Test Cases**:
1. **Profile AI Chat Bar Test**: Render `ProfilePage` with a free-tier user mock and verify `SectionChatBar` is present in the DOM (will pass on unfixed code, confirming the bug)
2. **Profile Update API Test**: Call `POST /api/ai/profile-update` with a free-tier user and verify it returns 200 instead of 403 (will succeed on unfixed code, confirming the bug)
3. **Session Over-Limit Test**: Set up a free-tier user with 3 documents used, call `POST /api/sessions/create` and verify it returns 200 instead of 429 (will succeed on unfixed code, confirming the bug)
4. **Session Restricted Type Test**: Call `POST /api/sessions/create` with `documentType: "quotation"` as a free-tier user and verify it returns 200 instead of 403 (will succeed on unfixed code, confirming the bug)

**Expected Counterexamples**:
- All four tests will succeed (200 responses) on unfixed code, demonstrating the missing enforcement
- Root cause confirmed: no tier fetch + no guard calls in the relevant routes and components

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected blocking behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedHandler(input)
  IF input.action == "profile_edit_ai" AND input.userTier == "free"
    ASSERT SectionChatBar NOT IN rendered_output
  IF input.action == "api_profile_update" AND input.userTier == "free"
    ASSERT result.status == 403
  IF input.action == "api_session_create" AND input.documentCount >= input.tierLimit
    ASSERT result.status == 429
  IF input.action == "api_session_create" AND input.documentType NOT IN input.allowedTypes
    ASSERT result.status == 403
  IF input.action == "frontend_error_handling" AND result.status IN [429, 403]
    ASSERT upgradeModal IS visible
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT fixedHandler(input) == originalHandler(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of tier × document type × usage count automatically
- It catches edge cases like agency tier with 0 limit (unlimited), starter tier at exactly limit-1, etc.
- It provides strong guarantees that non-buggy paths are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for paid-tier users and within-limit scenarios, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Paid Tier Profile AI Preservation**: For any tier in {starter, pro, agency}, verify `SectionChatBar` renders when editing and `/api/ai/profile-update` returns 200
2. **Within-Limit Session Preservation**: For any tier where `documentCount < tierLimit`, verify `POST /api/sessions/create` returns 200 with a valid session
3. **Allowed Type Session Preservation**: For any tier × documentType where the type is in `allowedDocTypes`, verify session creation succeeds
4. **Onboarding AI Preservation**: Verify `POST /api/ai/onboarding` continues to work for free-tier users
5. **Successful Response Display Preservation**: Verify that 200 responses from `/api/ai/stream` display content normally without upgrade prompts

### Unit Tests

- Test `checkDocumentLimit()` returns null for within-limit users and 429 for over-limit users across all tiers
- Test `checkDocumentTypeAllowed()` returns null for allowed types and 403 for restricted types across all tiers
- Test the new tier-fetch logic defaults to "free" when no subscription row exists
- Test `UpgradeModal` renders correct content for different error types (limit vs type restriction)

### Property-Based Tests

- Generate random `(tier, documentCount)` pairs and verify `checkDocumentLimit()` returns the correct result based on `TIER_LIMITS`
- Generate random `(tier, documentType)` pairs and verify `checkDocumentTypeAllowed()` returns the correct result based on `allowedDocTypes`
- Generate random tiers and verify the profile page conditionally renders `SectionChatBar` correctly

### Integration Tests

- Test full session creation flow: authenticate → tier check → type check → limit check → insert → increment
- Test profile page end-to-end: load page as free user → click Edit → verify no AI chat bar → verify manual editing works
- Test upgrade modal flow: trigger a 429/403 in InvoiceChat → verify modal appears → click upgrade → verify navigation to billing
