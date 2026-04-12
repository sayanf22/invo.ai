# Implementation Plan: Profile Update AI Improvements

## Overview

Incremental implementation of six improvements to the profile update AI chat flow: intelligent data merging, await-based follow-ups, continuous profile state via `latestProfileRef`, clarification flow guards, AIInputWithLoading UI swap, and system prompt merge instructions. Server-side changes first, then client-side data logic, then UI, then verification.

## Tasks

- [x] 1. Add merge instructions to the profile-update API system prompt
  - [x] 1.1 Add MERGE RULES section to `buildSystemPrompt` in `app/api/ai/profile-update/route.ts`
    - Append a `## MERGE RULES` block after the existing `CRITICAL EXTRACTION RULES` section in both the section-specific and general system prompt variants
    - The block must contain these four rules: (1) NEVER set a field to null or empty string if it already has a value, (2) Only include fields in extractedData that the user explicitly mentioned or extracted from a document, (3) New data supplements existing data — it does not replace it, (4) For nested objects (address, bankDetails), only include the sub-fields being changed
    - _Requirements: 6.1, 6.3_

  - [x] 1.2 Verify `buildSystemPrompt` field categorization lists filled and missing fields correctly
    - Confirm the existing `check()` helper already lists each non-null/non-empty field in "Already filled" and each null/empty field in "Missing fields"
    - No code change expected — this is a verification step; fix only if the existing logic has gaps
    - _Requirements: 6.2_

- [x] 2. Refactor `mapExtractedToDbUpdate` to a pure intelligent merge function
  - [x] 2.1 Rewrite `mapExtractedToDbUpdate` in `components/profile-update-chat.tsx`
    - Change the function signature to accept `(extracted: Record<string, unknown>, currentProfile: ProfileData)` and return `Record<string, unknown>`
    - Use a `setIfPresent` helper that only sets a field when the extracted value is non-null, non-undefined, and non-empty string
    - For `address`: deep-merge sub-fields — only overwrite sub-fields that have non-empty values in extracted, preserve all other existing sub-fields from `currentProfile.address`
    - For `bankDetails`: deep-merge into `currentProfile.payment_methods.bank` — only overwrite sub-fields with non-empty extracted values
    - For `tax_ids`: shallow-merge new key into existing `currentProfile.tax_ids`, preserving all existing keys
    - For `clientCountries`: produce a deduplicated union of `currentProfile.client_countries` and extracted array using `[...new Set([...existing, ...extracted])]`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Write property test: top-level field preservation on merge
    - **Property 1: Top-level field preservation on merge**
    - Use `fast-check` to generate random profiles with non-null top-level fields and extracted objects where those fields are null/undefined/empty
    - Assert that the output of `mapExtractedToDbUpdate` does NOT contain those fields (existing values never overwritten with empty)
    - **Validates: Requirements 1.1**

  - [x] 2.3 Write property test: nested object deep merge preserves existing sub-fields
    - **Property 2: Nested object deep merge preserves existing sub-fields**
    - Generate random address/bankDetails objects with partial extracted data
    - Assert merged output contains all existing sub-fields unchanged when not present or empty in extracted
    - **Validates: Requirements 1.2, 1.3**

  - [x] 2.4 Write property test: tax IDs shallow merge preserves existing keys
    - **Property 3: Tax IDs shallow merge preserves existing keys**
    - Generate random `tax_ids` objects with N keys and a new `taxId` value
    - Assert merged `tax_ids` contains all N original keys plus the new key, original values unchanged
    - **Validates: Requirements 1.4**

  - [x] 2.5 Write property test: client countries deduplicated union
    - **Property 4: Client countries deduplicated union**
    - Generate random country code arrays with overlaps
    - Assert merged result is exactly the set union — no lost elements, no duplicates, no extras
    - **Validates: Requirements 1.5**

- [x] 3. Checkpoint — Ensure merge logic and system prompt changes are correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add `latestProfileRef` for continuous profile state awareness
  - [x] 4.1 Add `latestProfileRef` to `ProfileUpdateChat` component in `components/profile-update-chat.tsx`
    - Create `const latestProfileRef = useRef<ProfileData>(currentProfile)`
    - Add a `useEffect` that syncs `latestProfileRef.current = currentProfile` whenever the `currentProfile` prop changes
    - _Requirements: 3.1, 3.3_

  - [x] 4.2 Update `applyUpdates` to refresh `latestProfileRef` after successful DB write
    - After the successful `supabase.from("businesses").update(...)` call, set `latestProfileRef.current = { ...latestProfileRef.current, ...updates } as ProfileData`
    - Continue calling `onProfileUpdated()` to trigger parent reload
    - _Requirements: 3.1, 3.3_

  - [x] 4.3 Update `handleSendMessage` to use `latestProfileRef.current` in API requests
    - Replace `currentProfile` with `latestProfileRef.current` in the `body` of the `authFetch("/api/ai/profile-update", ...)` call
    - This ensures every AI call receives the freshest profile state including all in-session updates
    - _Requirements: 3.2_

  - [x] 4.4 Update `handleFileUpload` to use `latestProfileRef.current` for merge and follow-up
    - Pass `latestProfileRef.current` as the second argument to `mapExtractedToDbUpdate` instead of `currentProfile`
    - Use `latestProfileRef.current` in the follow-up API call body
    - _Requirements: 3.2_

- [x] 5. Implement clarification flow guard and await-based follow-up
  - [x] 5.1 Add clarification guard to `handleSendMessage` in `components/profile-update-chat.tsx`
    - When `result.needsClarification` is `true`: display `result.message` in chat, do NOT call `applyUpdates`, do NOT apply `extractedData`
    - When `result.needsClarification` is `false` and `extractedData` is non-empty: call `mapExtractedToDbUpdate` with `latestProfileRef.current`, then `applyUpdates`, then display message
    - When neither condition: just display the message
    - Keep `inputRef.current?.focus()` in the `finally` block so input stays focused after clarification
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Write property test: clarification flag prevents data application
    - **Property 5: Clarification flag prevents data application**
    - Generate random API responses with `needsClarification: true` and arbitrary `extractedData`
    - Assert that `applyUpdates` is never called when `needsClarification` is `true`
    - **Validates: Requirements 4.1, 4.4**

  - [x] 5.3 Replace `setTimeout` follow-up with `await`-based sequential call in `handleFileUpload`
    - Remove the `setTimeout(async () => { ... }, 500)` block
    - After `await applyUpdates(dbUpdates)`, immediately `await` the follow-up `authFetch("/api/ai/profile-update", ...)` call
    - Pass `latestProfileRef.current` as `currentProfile` and `extracted` as `fileExtracted` in the follow-up body
    - Display the follow-up `result.message` in chat if present
    - Wrap the follow-up in a try/catch so failures are silently logged without breaking the upload success flow
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Checkpoint — Ensure state management and clarification flow work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Swap input UI to AIInputWithLoading in full mode
  - [x] 7.1 Import `AIInputWithLoading` in `components/profile-update-chat.tsx`
    - Add `import { AIInputWithLoading } from "@/components/ui/ai-input-with-loading"` at the top of the file
    - _Requirements: 5.1_

  - [x] 7.2 Replace the input section in the chat UI render for full mode
    - In the `{/* Input */}` section at the bottom of the component's return JSX, wrap the existing `<div className="relative flex items-center gap-2 ...">` block in a conditional
    - When `isFullMode` is true: render `<AIInputWithLoading>` with props: `value={inputValue}`, `onValueChange={setInputValue}`, `isLoading={isLoading}`, `isUploading={isUploading}`, `onSubmit` handler (if stagedFile: call handleFileUpload then clear; else call handleSendMessage), `placeholder="Tell me what to update..."`, `showAttachButton={true}`, `stagedFile={stagedFile}`, `onFileSelect={(file) => setStagedFile(file)}`, `onFileRemove={() => setStagedFile(null)}`, `statusText={isUploading ? "Analyzing file..." : undefined}`
    - When `isSectionMode` is true: keep the existing `<Input>` + `<Button>` layout (no file attach)
    - Remove the now-redundant standalone `<input type="file">`, `<Button>` with Paperclip icon, and staged file bar that were only used in full mode
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 Write unit tests for AIInputWithLoading integration
    - Verify `AIInputWithLoading` renders in full mode with correct props
    - Verify no attach button renders in section mode
    - Verify "Analyzing file..." status text appears during upload
    - _Requirements: 5.1, 5.4, 5.5_

- [x] 8. Final checkpoint — Ensure all changes work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All code is TypeScript (Next.js App Router + React 19)
- No database schema changes required — all changes operate on the existing `businesses` table
- Property tests use `fast-check` library and validate correctness properties from the design document
- Each task references specific requirements for traceability
