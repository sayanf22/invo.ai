# Implementation Plan: Onboarding Document Upload

## Overview

Add a document upload screen to the onboarding flow, positioned before the existing Q&A chat. Users upload business documents (PDFs, images), the system extracts business info via the existing `/api/ai/analyze-file` endpoint, and passes extracted data to `OnboardingChat` as `initialData` to reduce questions. All uploads go directly from the client to Supabase Storage; file analysis calls go directly from the client to the API route.

## Tasks

- [x] 1. Create UploadScreen component with file validation and UI
  - [x] 1.1 Create `components/upload-screen.tsx` with the `UploadScreen` component
    - Define `UploadScreenProps` interface with `onContinue` and `onSkip` callbacks
    - Define `UploadedFile` interface with `id`, `file`, `status`, `storagePath`, `extractedData`, `fieldsFound`, `error`
    - Implement file validation function: accept only `application/pdf`, `image/png`, `image/jpeg` and reject files over 10MB
    - Render drag-and-drop zone with `onDragOver`, `onDragLeave`, `onDrop` handlers and a click-to-browse button via hidden file input
    - Display instructional text explaining users can upload catalogues, business cards, letterheads, invoices
    - Support adding multiple files to the upload list
    - Render file list showing each file's name, formatted size, and status (pending, uploading, analyzing, complete, failed)
    - For files with status `"complete"`, display the `fieldsFound` count
    - Show extracted fields summary section when any data has been extracted
    - Include a "Continue" button that is enabled only when at least one file has status `"complete"`
    - Include a "Skip" button that calls `onSkip` to proceed without uploads
    - Ensure responsive layout for desktop and mobile
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 1.2 Write property test for file validation logic (Property 1)
    - **Property 1: File validation accepts only allowed types and sizes**
    - Extract the validation function as a pure, testable function
    - Use `fast-check` to generate random `{ type: string, size: number }` objects
    - Assert validation accepts iff type ∈ `["application/pdf", "image/png", "image/jpeg"]` AND size ≤ 10MB
    - **Validates: Requirements 2.1, 2.3, 2.4, 8.3**

  - [ ]* 1.3 Write property test for filename generation (Property 2)
    - **Property 2: Filename generation produces unique values**
    - Extract the filename generation function as a pure, testable function
    - Use `fast-check` to generate N filenames with the same userId
    - Assert all N filenames are distinct (Set size === N)
    - **Validates: Requirements 3.2**

- [x] 2. Implement file upload to Supabase Storage and AI extraction
  - [x] 2.1 Implement client-side Supabase Storage upload in `UploadScreen`
    - Use the Supabase browser client from `lib/supabase.ts` to upload files
    - Upload to path `onboarding-uploads/{userId}/{uuid}.{ext}`
    - Generate unique filenames using `crypto.randomUUID()` to prevent collisions
    - Include the user's auth token in the upload request
    - Update file status to `"uploading"` during upload, then `"analyzing"` on success
    - On upload failure, set file status to `"failed"` with error message and allow retry
    - _Requirements: 3.1, 3.2, 3.3, 7.1, 8.2_

  - [x] 2.2 Implement client-side file analysis via `/api/ai/analyze-file`
    - After successful storage upload, create `FormData` with the `File` object
    - Send directly from client to `/api/ai/analyze-file` (same pattern as existing `onboarding-chat.tsx`)
    - Get auth token from Supabase session and include in `Authorization` header
    - On success, update file status to `"complete"`, store `extractedData` and `fieldsFound`
    - On HTTP 429, wait 5 seconds and retry once before showing error
    - On other errors, set file status to `"failed"` with error message; do not block other files
    - _Requirements: 4.1, 4.2, 4.5, 7.2, 7.3_

  - [x] 2.3 Implement multi-file data merge with last-write-wins semantics
    - Maintain a merged `CollectedData` state across all uploaded files
    - When a file extraction completes, merge its `extractedData` into the accumulated state
    - Use last-write-wins: later uploads override conflicting fields from earlier uploads
    - Handle nested objects (`address`, `bankDetails`) with shallow merge
    - Map special fields: `additionalContext` → `additionalNotes`, `phone2` → append to notes, `services` and `paymentTerms` as direct fields
    - _Requirements: 4.3, 4.4_

  - [ ]* 2.4 Write property test for multi-file data merge (Property 3)
    - **Property 3: Multi-file data merge follows last-write-wins semantics**
    - Extract the merge function as a pure, testable function
    - Use `fast-check` to generate random sequences of `Partial<CollectedData>` objects
    - Merge in order and assert each field equals the value from the last object that defined it
    - **Validates: Requirements 4.3**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Modify onboarding page to support upload → chat phase transition
  - [x] 4.1 Update `app/onboarding/page.tsx` with phase state management
    - Add `phase` state: `"upload" | "chat"` defaulting to `"upload"`
    - Add `extractedData` state of type `CollectedData`
    - When `phase === "upload"`, render `<UploadScreen>` with `onContinue` and `onSkip` handlers
    - `onContinue` receives extracted `CollectedData`, stores it in `extractedData` state, sets phase to `"chat"`
    - `onSkip` sets phase to `"chat"` with empty extracted data
    - When `phase === "chat"`, render existing `<OnboardingChat>` with new `initialData={extractedData}` prop
    - Keep existing header with Clorefy logo and "Business Setup" label visible in both phases
    - Keep existing "Skip for now" button in header functional in both phases
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.4, 8.1_

  - [ ]* 4.2 Write property test for Continue button enablement (Property 5)
    - **Property 5: Continue button enablement logic**
    - Use `fast-check` to generate random `UploadedFile[]` arrays with varying statuses
    - Assert Continue button enabled iff at least one file has status `"complete"`
    - **Validates: Requirements 6.4**

- [x] 5. Modify OnboardingChat to accept and use initialData
  - [x] 5.1 Add `initialData` prop to `OnboardingChat` component
    - Add optional `initialData?: CollectedData` to `OnboardingChatProps` interface
    - On mount, if `initialData` is provided and has fields, merge it into `collectedData` state
    - The merged data will be sent to DeepSeek via `/api/ai/onboarding` in the initial greeting call
    - DeepSeek will see pre-filled fields and skip those questions, informing the user which fields were pre-filled
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 5.2 Write property test for file list rendering metadata (Property 4)
    - **Property 4: File list rendering includes all metadata**
    - Use `fast-check` to generate random `UploadedFile[]` arrays
    - Assert rendered output contains name, formatted size, and status for every file
    - Assert files with status `"complete"` also show `fieldsFound` count
    - **Validates: Requirements 6.2, 6.3, 4.2**

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All file uploads go directly from the client to Supabase Storage (no API route proxying) per Cloudflare Workers constraints
- File analysis calls go directly from the client to `/api/ai/analyze-file` using FormData
- The existing `CollectedData` interface is reused without changes
- Property tests use `fast-check` and validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
