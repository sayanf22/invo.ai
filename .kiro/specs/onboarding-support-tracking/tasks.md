# Implementation Plan: Onboarding Support Tracking

## Overview

This plan implements a three-part feature: (1) a user-facing support button in the onboarding flow, (2) server-side onboarding progress tracking, and (3) enhanced admin dashboard pages for support, errors, and onboarding visibility. Tasks are ordered so each builds on the previous, starting with the database schema, then API routes, then UI components, and finally admin pages.

## Tasks

- [x] 1. Database migration for onboarding support tracking
  - [x] 1.1 Create the migration SQL file at `supabase/migrations/onboarding_support_tracking.sql`
    - Create the `onboarding_progress` table with columns: `id`, `user_id` (unique FK to profiles), `current_phase` (CHECK constraint for upload/chat/logo/payments/completed), `used_extraction` (boolean), `fields_completed` (integer 0–12), phase timestamp columns (`upload_started_at`, `chat_started_at`, `logo_started_at`, `payments_started_at`, `completed_at`), `created_at`, `updated_at`
    - Add indexes on `user_id`, `current_phase`, and `updated_at DESC`
    - Enable RLS on `onboarding_progress` with a deny-all policy for anon/authenticated (service role bypasses)
    - Add `onboarding_phase` TEXT column to `support_messages` with CHECK constraint for valid phases or NULL
    - Add `metadata` JSONB column to `support_messages`
    - _Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4_

- [x] 2. Shared utility functions for onboarding tracking logic
  - [x] 2.1 Create `lib/onboarding-utils.ts` with pure utility functions
    - Implement `validateSupportMessage(message: string): boolean` — returns true if trimmed length is 3–2000 chars
    - Implement `computeOnboardingStatus(profile, progress): 'completed' | 'in-progress' | 'dropped-off'` — uses the logic from the design document
    - Implement `getFieldCompletion(business): { fields: Record<string, boolean>, count: number }` — checks each of the 12 tracked fields against the businesses table column mapping
    - Implement `filterByEmailSearch(records, search): records` — case-insensitive partial match on email field
    - Implement `filterErrorsByContext(errors, contextFilter): errors` — filters error logs by onboarding phase or non-onboarding
    - Implement `applyOnboardingFilters(records, filters): records` — combines status, phase, error, and search filters with AND logic
    - Export `ONBOARDING_PHASES` constant array and `TRACKED_FIELDS` mapping
    - _Requirements: 2.2, 5.2, 5.3, 5.4, 6.2, 10.4, 10.5, 11.1, 11.2, 11.3_

  - [x] 2.2 Write property test: support message length validation (Property 1)
    - **Property 1: Support message length validation**
    - Generate random strings with fast-check, verify `validateSupportMessage` accepts iff trimmed length is 3–2000
    - **Validates: Requirements 2.2**

  - [x] 2.3 Write property test: onboarding status computation (Property 5)
    - **Property 5: Onboarding status computation correctness**
    - Generate random profile/progress combinations with fast-check, verify `computeOnboardingStatus` returns correct status
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [x] 2.4 Write property test: field completion detection (Property 6)
    - **Property 6: Field completion detection accuracy**
    - Generate random business records with fast-check, verify `getFieldCompletion` correctly classifies all 12 fields and count matches
    - **Validates: Requirements 6.2, 5.1**

  - [x] 2.5 Write property test: case-insensitive email search (Property 9)
    - **Property 9: Case-insensitive email search filtering**
    - Generate random email lists and search strings, verify `filterByEmailSearch` returns correct subset
    - **Validates: Requirements 10.4, 11.4**

  - [x] 2.6 Write property test: combined filters AND logic (Property 10)
    - **Property 10: Combined filters use AND logic**
    - Generate random onboarding data and filter combinations, verify every result satisfies all active filters
    - **Validates: Requirements 10.5**

  - [x] 2.7 Write property test: error context filtering (Property 11)
    - **Property 11: Error context filtering correctness**
    - Generate random error logs and filter selections, verify correct filtering behavior for each filter option
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Support submission API route
  - [x] 4.1 Create `app/api/support/submit/route.ts`
    - Implement POST handler with `authenticateRequest()` for auth
    - Validate request body: `message` (string, 3–2000 trimmed chars), optional `onboarding_phase` (must be one of upload/chat/logo/payments), optional `metadata` (object)
    - Insert into `support_messages` with `user_id`, `message`, `status: 'unread'`, `onboarding_phase`, and `metadata`
    - Return `{ success: true }` on success, appropriate error responses on failure
    - _Requirements: 2.3, 2.6, 12.1, 12.2, 12.3_

- [x] 5. Onboarding tracking API route
  - [x] 5.1 Create `app/api/onboarding/track/route.ts`
    - Implement POST handler with `authenticateRequest()` for auth
    - Validate request body: `phase` (required, one of upload/chat/logo/payments/completed), optional `fields_completed` (integer 0–12), optional `used_extraction` (boolean)
    - Upsert `onboarding_progress` record for the user: set `current_phase`, update the corresponding `{phase}_started_at` timestamp, update `fields_completed` and `used_extraction` if provided, set `completed_at` when phase is `completed`, update `updated_at`
    - Update `profiles.last_active_at` to current timestamp
    - Silently handle errors (return success even if tracking fails to not block onboarding)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 13.1, 13.2, 13.3_

- [x] 6. Support button and form components
  - [x] 6.1 Create `components/onboarding-support-button.tsx`
    - Render a fixed-position button in the bottom-right corner using Lucide `HelpCircle` icon
    - Style: monochromatic, 40×40px visible area, 44×44px touch target (min-w-[44px] min-h-[44px])
    - On click, open the `SupportForm` sheet
    - Accept `currentPhase` and `userEmail` props
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 6.2 Create `components/onboarding-support-form.tsx`
    - Render as a Sheet overlay (shadcn/ui Sheet component)
    - Display pre-filled email (read-only) from authenticated session
    - Textarea with placeholder, min 3 chars / max 2000 chars validation using `validateSupportMessage`
    - Submit button that POSTs to `/api/support/submit` with message, `onboarding_phase`, and metadata (email, fields completed)
    - On success: show success toast via sonner, auto-close sheet after 2 seconds
    - On error: show error message, keep form open with text preserved
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 7. Integrate support button and tracking into onboarding page
  - [x] 7.1 Modify `app/onboarding/page.tsx` to render `SupportButton`
    - Import and render `SupportButton` component inside the onboarding page, passing `currentPhase` and `userEmail`
    - Position it so it appears on all 4 phases but does not overlap primary content
    - Remove the button when onboarding completes (before redirect)
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 7.2 Add phase transition tracking calls to `app/onboarding/page.tsx`
    - Call POST `/api/onboarding/track` whenever `setPhase` transitions between phases (upload→chat, chat→logo, logo→payments)
    - Track `used_extraction` based on whether the user uploaded a file in the upload phase
    - Use fire-and-forget pattern (don't await, don't block the UI)
    - _Requirements: 7.1, 7.2_

  - [x] 7.3 Add field completion tracking to `app/onboarding/page.tsx`
    - After the chat phase updates `collectedData`, call the tracking endpoint with updated `fields_completed` count
    - Track completion on the `handleFinalSave` success path with phase `completed`
    - _Requirements: 7.3, 7.4_

  - [x] 7.4 Enhance error logging in `app/onboarding/page.tsx` with onboarding context
    - Update existing `logErrorToDatabase` calls to use `onboarding_{phase}` as the error context
    - Include `onboarding_phase`, `fields_completed` count, and `used_extraction` in error metadata
    - Add error logging for AI API non-200 responses with context `onboarding_chat_ai_error` including HTTP status code
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Admin support API routes
  - [x] 9.1 Create `app/api/admin/support/route.ts` with GET and PATCH handlers
    - GET: `verifyAdminSession()` auth, query params for `status`, `search` (email), `page` (default 1, 25 per page)
    - Fetch `support_messages` joined with `profiles` (email, full_name), include `onboarding_phase` and `metadata`
    - Apply filters: status filter, email search (case-insensitive ilike), sort by `created_at` DESC
    - Return paginated results with total count
    - PATCH: `verifyAdminSession()` auth, body `{ id, status?, admin_notes? }`
    - Update `support_messages` record with new status and/or admin_notes
    - Return updated record or error
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

- [x] 10. Enhanced admin support page with client component
  - [x] 10.1 Create `app/clorefy-ctrl-8x2m/(dashboard)/support/support-client.tsx`
    - Client component receiving initial messages data as props
    - Display each message with sender full name, email, onboarding phase badge (Upload/Chat/Logo/Payments), and creation time
    - Show "Anonymous" for messages without a user profile
    - Color-coded status indicators: unread (primary), read (muted), resolved (green)
    - Status toggle buttons to change message status (calls PATCH `/api/admin/support`)
    - Optimistic UI update with revert on error and error toast
    - Inline admin notes editing with save functionality
    - Search input for filtering by email
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 10.2 Update `app/clorefy-ctrl-8x2m/(dashboard)/support/page.tsx` to use client component
    - Keep as server component that fetches initial data via service role client
    - Include `onboarding_phase` and `metadata` in the select query
    - Pass data to `SupportClient` for interactive rendering
    - _Requirements: 3.1, 3.4_

- [x] 11. Admin onboarding tracking API route
  - [x] 11.1 Create `app/api/admin/onboarding/route.ts`
    - GET handler with `verifyAdminSession()` auth
    - Query params: `status` (all/completed/in-progress/dropped-off), `phase` (all/upload/chat/logo/payments), `errors` (all/with-errors/without-errors), `search` (email), `page` (default 1, 25 per page)
    - Join `profiles` with `onboarding_progress` and `businesses` using service role client
    - Compute `onboarding_status` for each user using `computeOnboardingStatus`
    - Compute `fields_completed` from business data using `getFieldCompletion`
    - Apply all filters with AND logic using the shared utility functions
    - For error filter: check if user has entries in `error_logs` with onboarding context
    - Return paginated results with total count
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. Admin onboarding tracking page
  - [x] 12.1 Create `app/clorefy-ctrl-8x2m/(dashboard)/onboarding/page.tsx`
    - Server component with `requireAdmin()` auth
    - Fetch initial onboarding data via service role client
    - Pass data to `OnboardingTrackingClient`
    - _Requirements: 5.1_

  - [x] 12.2 Create `app/clorefy-ctrl-8x2m/(dashboard)/onboarding/onboarding-client.tsx`
    - Client component with filter dropdowns: Status (All/Completed/In Progress/Dropped Off), Phase (All/Upload/Chat/Logo/Payments), Errors (All/With Errors/Without Errors)
    - Search input for email (case-insensitive partial match)
    - Paginated table (25 per page) with columns: Email, Name, Status badge, Phase badge, Fields (X/12 with progress indicator), Last Active (relative time via date-fns)
    - Pagination controls (previous/next)
    - Fetch filtered data from `/api/admin/onboarding` when filters change
    - _Requirements: 5.1, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 12.3 Add expandable row detail view to `OnboardingTrackingClient`
    - On row click, expand to show per-field completion status for all 12 tracked fields (completed vs pending)
    - Show current/last onboarding phase reached
    - Show whether user used document extraction or typed manually
    - When user has a business record, display actual field values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Enhanced admin errors page
  - [x] 13.1 Create `app/api/admin/errors/route.ts`
    - GET handler with `verifyAdminSession()` auth
    - Query params: `context_filter` (all/upload/chat/logo/payments/non-onboarding), `search` (email), `page` (default 1, 25 per page)
    - Fetch `error_logs` joined with `profiles` (email, full_name) using service role client
    - Apply context filter using `filterErrorsByContext` logic
    - Apply email search filter
    - Sort by `created_at` DESC, paginate at 25 per page
    - Return paginated results with total count
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 11.2, 11.3, 11.4_

  - [x] 13.2 Create `app/clorefy-ctrl-8x2m/(dashboard)/errors/errors-client.tsx`
    - Client component receiving initial error data as props
    - Display each error with user email, full name (or "System / Anonymous"), error context, message, metadata, status, and time
    - Show onboarding phase badge when `error_context` starts with "onboarding"
    - Filter dropdown for error context: All, Upload, Chat, Logo, Payments, Non-Onboarding
    - Search input for filtering by user email
    - Fetch filtered data from `/api/admin/errors` when filters change
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 11.2, 11.3, 11.4_

  - [x] 13.3 Update `app/clorefy-ctrl-8x2m/(dashboard)/errors/page.tsx` to use client component
    - Keep as server component that fetches initial data via service role client
    - Pass data to `ErrorsClient` for interactive rendering
    - _Requirements: 8.1_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1, 5, 6, 9, 10, 11)
- Unit tests validate specific examples and edge cases
- All admin API routes use the service role client to bypass RLS, consistent with existing admin dashboard patterns
- The onboarding tracking API uses fire-and-forget calls to avoid blocking the user's onboarding flow
