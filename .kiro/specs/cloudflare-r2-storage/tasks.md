# Implementation Plan: Cloudflare R2 Storage

## Overview

Migrate all file storage from Supabase Storage to Cloudflare R2 and add business logo upload. Tasks are ordered by dependency: foundational R2 service first, then API routes, then UI components, then migration of existing code.

## Tasks

- [x] 1. Install dependencies and create R2 Storage Service
  - [x] 1.1 Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` via pnpm
    - Run `pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
    - _Requirements: 1.1_

  - [x] 1.2 Create `lib/r2.ts` Storage Service module
    - Initialize `S3Client` with endpoint `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`, credentials from `getSecret()`
    - Use lazy singleton pattern (`getR2Client()`) with descriptive error on missing credentials
    - Export `generatePresignedPutUrl(objectKey, contentType, maxSizeBytes?)` — 300s expiry, includes `ContentType` in `PutObjectCommand`
    - Export `generatePresignedGetUrl(objectKey)` — 3600s expiry
    - Export `deleteObject(objectKey)`
    - Export `getBucketName()` helper
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.2, 10.6, 10.7_

  - [x] 1.3 Write property tests for R2 Storage Service
    - **Property 1: Object key generation follows the correct pattern**
    - **Validates: Requirements 2.4, 10.4**
    - **Property 4: Presigned PUT URL includes the exact content type from the request**
    - **Validates: Requirements 2.5, 10.8**
    - Test file: `lib/__tests__/r2.test.ts`

- [x] 2. Create Upload API route (`/api/storage/upload`)
  - [x] 2.1 Create `app/api/storage/upload/route.ts`
    - POST handler: authenticate via `authenticateRequest(request)`, rate limit via `checkRateLimit`
    - Parse body: `{ fileName, fileSize, contentType, category }`
    - Validate content type against whitelist: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`
    - Validate file size ≤ 10 MB (10,485,760 bytes)
    - Validate category is one of `logos`, `documents`, `signatures`, `uploads`
    - Generate object key: `{category}/{user.id}/{crypto.randomUUID()}.{ext}`
    - Call `generatePresignedPutUrl` with content type restriction
    - Return `{ uploadUrl, objectKey }`
    - Return 401 for unauthenticated, 400 for invalid input with descriptive messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.3, 10.4, 10.8_

  - [x] 2.2 Write property tests for Upload API validation
    - **Property 2: Content type validation rejects disallowed types**
    - **Validates: Requirements 2.2, 2.7**
    - **Property 3: File size validation enforces the 10 MB limit**
    - **Validates: Requirements 2.3, 2.7**
    - Test file: `app/api/storage/__tests__/upload.test.ts`

- [x] 3. Create Download API route (`/api/storage/url`)
  - [x] 3.1 Create `app/api/storage/url/route.ts`
    - GET handler: authenticate via `authenticateRequest(request)`
    - Extract `key` query parameter
    - Verify ownership: extract user ID segment from object key, compare with `auth.user.id`
    - For signature keys (`signatures/...`), skip user-ID check (server-side only access)
    - Call `generatePresignedGetUrl(key)` and return `{ url }`
    - Return 401 for unauthenticated, 403 for ownership mismatch, 400 for missing key
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.5_

  - [x] 3.2 Write property tests for Download API ownership verification
    - **Property 5: Download API ownership verification**
    - **Validates: Requirements 3.2, 3.3, 10.5**
    - Test file: `app/api/storage/__tests__/url.test.ts`

- [x] 4. Checkpoint — Verify core R2 infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create Logo Uploader component
  - [x] 5.1 Create `components/logo-uploader.tsx`
    - Props: `currentLogoKey`, `onUploadComplete(objectKey)`, `onRemove?`, `maxSizeMB` (default 5)
    - Drag-and-drop or click-to-browse file selection
    - Client-side validation: image types only (PNG, JPEG, WebP, GIF), max 5 MB
    - Image preview via `URL.createObjectURL` before upload
    - Upload flow: call `/api/storage/upload` with category `logos` → PUT file to R2 via presigned URL → call `onUploadComplete`
    - Display current logo by fetching presigned GET URL from `/api/storage/url`
    - Upload progress states: idle → previewing → uploading → complete
    - "Remove" button calling parent's `onRemove` callback
    - Toast notifications for errors (wrong type, too large, upload failed)
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 7.5, 9.3_

  - [x] 5.2 Write property tests for Logo Uploader validation
    - **Property 6: Logo validation accepts only valid image types within size limit**
    - **Validates: Requirements 6.2, 6.3, 7.5, 9.3**
    - Test file: `components/__tests__/logo-uploader.test.ts`

- [x] 6. Migrate onboarding document uploads to R2
  - [x] 6.1 Update `components/upload-screen.tsx` to use R2 presigned URLs
    - Replace `supabase.storage.from("onboarding-uploads").upload(...)` with: call `/api/storage/upload` with category `documents` → PUT file to R2 via presigned URL
    - Keep all existing status display (pending, uploading, analyzing, complete, failed)
    - Keep the `/api/ai/analyze-file` call for AI extraction unchanged
    - Remove all references to Supabase Storage and the `onboarding-uploads` bucket
    - Update `generateStoragePath` to use the object key returned from the Upload API
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Migrate signature image storage to R2
  - [x] 7.1 Update `app/api/signatures/sign/route.ts` to upload to R2
    - Convert base64 data URL to `Uint8Array`
    - Use `generatePresignedPutUrl` with key `signatures/{signature_id}_{timestamp}.png`
    - Upload via server-side `fetch` to the presigned URL
    - Store the object key in `signature_image_url` column
    - Keep base64 data URL fallback if R2 upload fails (matching current behavior)
    - Remove Supabase Storage `business-assets` bucket references
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. Checkpoint — Verify migrations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add logo upload to onboarding flow
  - [x] 9.1 Update `app/onboarding/page.tsx` to include Logo Uploader
    - Add a logo upload step in the onboarding flow (before final confirmation or as part of the chat completion)
    - Show `LogoUploader` component with a "Skip" option
    - On upload complete, store object key in `collectedData.logoUrl`
    - Save to `businesses.logo_url` on onboarding completion (already wired via `handleComplete`)
    - If user skips, proceed without modifying `logo_url`
    - _Requirements: 6.1, 6.5, 6.6, 6.7_

- [x] 10. Add logo upload to profile settings page
  - [x] 10.1 Update `app/profile/page.tsx` to include Logo Uploader
    - Add `LogoUploader` component in the Business Information section
    - Display current logo by passing `logo_url` from the business profile as `currentLogoKey`
    - On new upload: update `businesses.logo_url` with new object key via Supabase
    - On replacement: delete the previous logo from R2 (call `/api/storage/url` or add a delete endpoint), then upload new
    - Validate file type and size (handled by LogoUploader component)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 10.2 Write property tests for logo replacement cleanup
    - **Property 7: Logo replacement deletes the previous object**
    - **Validates: Requirements 7.4**
    - Test file: `app/profile/__tests__/logo-replace.test.ts`

- [x] 11. Update editor panel logo handling to use R2
  - [x] 11.1 Update `components/editor-panel.tsx` logo upload to use R2
    - Replace `FileReader.readAsDataURL` logo upload with: call `/api/storage/upload` with category `logos` → PUT file to R2 → update `businesses.logo_url` with object key
    - Load logo via presigned GET URL from `/api/storage/url` when `logo_url` exists
    - Validate file type (image only) and file size (max 5 MB) before upload
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 12. Configure R2 bucket CORS and update environment
  - [x] 12.1 Create CORS configuration file and document setup
    - Create `cors.json` with rules allowing PUT/GET from `https://clorefy.com` and `http://localhost:3000`, `Content-Type` header, 3600s max age
    - Add a comment/README note with the command: `npx wrangler r2 bucket cors set clorefy --file cors.json`
    - Verify `.env` has placeholder entries for `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` with comments
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 11.2, 11.3, 11.4_

- [x] 13. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all implementations use TypeScript
