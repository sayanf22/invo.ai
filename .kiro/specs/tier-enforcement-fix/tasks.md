# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Tier Enforcement Bypass
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three enforcement gaps
  - **Scoped PBT Approach**: Scope the property to concrete failing cases for each bug:
    - Bug 1 (Profile AI gate): For `userTier = "free"`, assert `POST /api/ai/profile-update` returns 403
    - Bug 2 (Document limit): For `userTier = "free"` with `documentCount >= 3`, assert `POST /api/sessions/create` returns 429 with `{ error: "Monthly document limit reached" }`
    - Bug 3 (Document type): For `userTier = "free"` with `documentType ∈ ["quotation", "proposal"]`, assert `POST /api/sessions/create` returns 403 with `{ error: "Document type not available on your plan" }`
  - Test file: `__tests__/tier-enforcement-bug-condition.test.ts`
  - Mock Supabase client to return subscription `plan` and `user_usage.documents_count`
  - For profile-update route: call handler with free-tier user mock, assert status 403
  - For session create route: call handler with free-tier user at limit (3 docs), assert status 429
  - For session create route: call handler with free-tier user + documentType "quotation", assert status 403
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (all three requests succeed with 200 instead of being blocked — this proves the bugs exist)
  - Document counterexamples found (e.g., "free-tier user created quotation session without 403", "free-tier user at 3/3 docs created session without 429")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Paid Tier and Within-Limit Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - Paid-tier users (starter/pro/agency) calling `POST /api/ai/profile-update` → returns 200 with AI response
    - Free-tier user with 0 docs used calling `POST /api/sessions/create` with `documentType: "invoice"` → returns 200 with session
    - Free-tier user with 2 docs used calling `POST /api/sessions/create` with `documentType: "contract"` → returns 200 with session
    - Starter-tier user calling `POST /api/sessions/create` with `documentType: "quotation"` → returns 200 with session
    - Agency-tier user calling `POST /api/sessions/create` with any type → returns 200 with session
  - **Write property-based tests capturing observed behavior**:
    - Property: For all tiers in {starter, pro, agency}, `POST /api/ai/profile-update` succeeds (not 403)
    - Property: For all (tier, documentCount) where `documentCount < tierLimit` AND `tierLimit > 0`, `POST /api/sessions/create` succeeds
    - Property: For all (tier, documentType) where `documentType ∈ TIER_LIMITS[tier].allowedDocTypes`, `POST /api/sessions/create` succeeds
    - Property: Agency tier (unlimited, `documentsPerMonth = 0`) always succeeds regardless of document count
    - Property: Free-tier user with `documentCount < 3` and `documentType ∈ ["invoice", "contract"]` succeeds
  - Test file: `__tests__/tier-enforcement-preservation.test.ts`
  - Mock Supabase client to return appropriate subscription plan and usage counts
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for tier enforcement bypass across API routes and UI

  - [x] 3.1 Add tier check to `POST /api/ai/profile-update` to block free-tier users
    - Fetch user tier from `subscriptions` table after `authenticateRequest()`, default to `"free"`
    - If tier is `"free"`, return 403: `{ error: "AI profile editing requires a paid plan", tier: "free", message: "Upgrade to Starter to use AI-powered profile editing" }`
    - Place this check BEFORE the DeepSeek API call
    - Do NOT affect `/api/ai/onboarding` — that endpoint remains open to all tiers
    - _Bug_Condition: isBugCondition(input) where input.action == "api_profile_update" AND input.userTier == "free"_
    - _Expected_Behavior: Return 403 with upgrade message for free-tier users_
    - _Preservation: Paid-tier users (starter/pro/agency) continue to get 200 responses; onboarding AI unaffected_
    - _Requirements: 1.2, 2.2, 3.1, 3.2_

  - [x] 3.2 Add `checkDocumentLimit()` and `checkDocumentTypeAllowed()` to `POST /api/sessions/create`
    - Fetch user tier from `subscriptions` table after `authenticateRequest()`, default to `"free"`
    - Call `checkDocumentTypeAllowed(body.documentType, userTier)` BEFORE insert — return 403 if blocked
    - Call `await checkDocumentLimit(auth.supabase, auth.user.id, userTier)` BEFORE insert — return 429 if blocked
    - Order: type check first (fast, no DB query), then limit check (requires DB query), then insert + increment
    - Import `checkDocumentLimit`, `checkDocumentTypeAllowed`, and `UserTier` from `@/lib/cost-protection`
    - _Bug_Condition: isBugCondition(input) where (input.documentCount >= input.tierLimit) OR (input.documentType NOT IN input.allowedTypes)_
    - _Expected_Behavior: Return 429 for over-limit, 403 for restricted type, with usage info and upgrade message_
    - _Preservation: Within-limit users with allowed doc types continue to create sessions successfully_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 3.4, 3.5_

  - [x] 3.3 Gate `SectionChatBar` and "Update with AI" button for free-tier users in `app/profile/page.tsx`
    - Add `userTier` state (default `"free"`), fetch from `subscriptions` table on mount alongside profile fetch
    - Wrap each `SectionChatBar` render with `&& userTier !== "free"` (6 instances: business, contact, address, tax, payment, notes)
    - Hide the "Update with AI" button (`setAiUpdateOpen`) for free-tier users
    - _Bug_Condition: isBugCondition(input) where input.action == "profile_edit_ai" AND input.userTier == "free"_
    - _Expected_Behavior: SectionChatBar NOT rendered, "Update with AI" button hidden for free tier_
    - _Preservation: Paid-tier users continue to see SectionChatBar and "Update with AI" button_
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 3.4 Create `components/upgrade-modal.tsx` upgrade modal component
    - Create a shadcn `Dialog` component with props: `open`, `onOpenChange`, `tier`, `currentUsage`, `limit`, `errorType` ("limit" | "type_restriction" | "feature_restricted"), `message`
    - Display current plan name and usage (e.g., "Free Plan — 3/3 documents used")
    - Show what the next tier offers (e.g., "Upgrade to Starter for 50 documents/month")
    - Primary CTA button linking to `/pricing`
    - Secondary dismiss button
    - Use existing shadcn Dialog, consistent with app's rounded-2xl, shadow-sm design language
    - _Requirements: 2.5_

  - [x] 3.5 Handle 429/403 tier responses with upgrade modal in `components/invoice-chat.tsx`
    - Add `showUpgradeModal` boolean state and `upgradeInfo` state (`{ tier, currentUsage, limit, errorType, message }`)
    - In `sendMessage` error handling for `response.status === 429`: add branch for `errorData.error === "Monthly document limit reached"` → set upgrade modal state
    - Add handling for `response.status === 403` where `errorData.tier` exists → set upgrade modal state
    - Import and render `UpgradeModal` component, passing upgrade info and `/pricing` link
    - Keep existing message-limit handling (`"Session message limit reached"` → `MessageLimitBanner`) unchanged
    - _Bug_Condition: isBugCondition(input) where input.action == "frontend_error_handling" AND input.apiStatus IN [429, 403] with tier info_
    - _Expected_Behavior: Upgrade modal shown with usage info and billing link_
    - _Preservation: Existing session message limit banner continues to work; successful 200 responses display normally_
    - _Requirements: 1.5, 2.5, 3.6, 3.7_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Tier Enforcement Active
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (403 for free AI profile, 429 for over-limit, 403 for restricted type)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms all three bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Paid Tier and Within-Limit Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm both bug condition and preservation tests pass
  - Verify no regressions in existing functionality
  - Ensure all tests pass, ask the user if questions arise
