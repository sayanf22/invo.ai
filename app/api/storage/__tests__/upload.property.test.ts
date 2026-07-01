/**
 * Property-based tests for R2 Storage Security Hardening
 * Feature: security-hardening
 *
 * Property 10: File upload MIME type and size validation
 * Property 11: R2 object key ownership verification
 *
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ── Constants matching the upload route ────────────────────────────────

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const

// Common disallowed MIME types for generating realistic invalid inputs
const DISALLOWED_MIME_SAMPLES = [
  "text/html",
  "text/plain",
  "application/javascript",
  "application/json",
  "application/xml",
  "application/zip",
  "application/x-executable",
  "image/svg+xml",
  "image/bmp",
  "video/mp4",
  "audio/mpeg",
  "application/octet-stream",
  "text/css",
  "application/x-sh",
  "application/x-php",
] as const

// ── Mocks ─────────────────────────────────────────────────────────────

const mockAuthUser = { id: "test-user-id-00000000" }

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn().mockImplementation(async () => ({
    user: mockAuthUser,
    supabase: {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: async () => ({ data: [{ user_id: mockAuthUser.id }], error: null }),
          }),
        }),
        insert: () => ({ then: (cb: () => void) => Promise.resolve().then(cb) }),
      }),
    },
    error: null,
  })),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/r2", () => ({
  uploadToR2: vi.fn().mockResolvedValue(undefined),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  generatePresignedPutUrl: vi.fn().mockResolvedValue("https://fake-presigned.example.com/upload"),
  generatePresignedGetUrl: vi.fn().mockResolvedValue("https://fake-presigned.example.com/download"),
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("fake-secret-value"),
}))

// ── Helpers ───────────────────────────────────────────────────────────

// Leading magic bytes per allowed content type. Accept-case files start with
// the correct signature so the route's magic-byte validation passes; size is
// tracked separately so oversize cases don't require huge byte payloads.
const MAGIC_BYTES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "image/gif": [0x47, 0x49, 0x46, 0x38, 0x39],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
}

function makeFileLike(name: string, type: string, size: number): File {
  const leading = MAGIC_BYTES[type] ?? [0x00]
  const buffer = new Uint8Array(leading).buffer
  return {
    name,
    type,
    size,
    arrayBuffer: async () => buffer,
  } as unknown as File
}

function buildUploadRequest(body: {
  fileName: string
  fileSize: number
  contentType: string
  category: string
}): Request {
  const formData = new Map<string, unknown>()
  formData.set("file", makeFileLike(body.fileName, body.contentType, body.fileSize))
  formData.set("category", body.category)
  return { formData: async () => formData } as unknown as Request
}

function buildGetUrlRequest(key: string): Request {
  const url = new URL("http://localhost:3000/api/storage/url")
  url.searchParams.set("key", key)
  return new Request(url.toString(), { method: "GET" })
}

// ── Import handlers under test ────────────────────────────────────────

import { POST } from "@/app/api/storage/upload/route"
import { GET } from "@/app/api/storage/url/route"

// ── Arbitraries ───────────────────────────────────────────────────────

/** Valid MIME type from the whitelist */
const validMimeArb = fc.constantFrom(...ALLOWED_CONTENT_TYPES)

/** Invalid MIME type — either from known-bad samples or random strings */
const invalidMimeArb = fc.oneof(
  fc.constantFrom(...DISALLOWED_MIME_SAMPLES),
  fc.string({ minLength: 1, maxLength: 80 }).filter(
    (s) => !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(s),
  ),
)

/** Valid file size: 1 byte to 10 MB */
const validSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE })

/** Invalid file size: over 10 MB */
const oversizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 5 })

/** Valid category */
const categoryArb = fc.constantFrom(...VALID_CATEGORIES)

/** UUID-like string */
const uuidArb = fc.uuid()

/** User ID (UUID format) */
const userIdArb = fc.uuid()

/** File extension */
const extArb = fc.constantFrom("png", "jpg", "webp", "gif", "pdf")

/** Non-signature categories for ownership tests */
const nonSigCategoryArb = fc.constantFrom("logos", "documents", "uploads")

// ══════════════════════════════════════════════════════════════════════
// Property 10: File upload MIME type and size validation
// ══════════════════════════════════════════════════════════════════════

describe("Feature: security-hardening, Property 10: File upload MIME type and size validation", () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.7**
   *
   * For any upload request, the endpoint SHALL accept the request if and only if
   * the content type is in the whitelist (image/png, image/jpeg, image/webp,
   * image/gif, application/pdf) AND the file size is ≤ 10MB.
   * All other combinations SHALL be rejected with a 400 response.
   */

  it("accepts requests with valid MIME type AND valid file size", async () => {
    await fc.assert(
      fc.asyncProperty(
        validMimeArb,
        validSizeArb,
        categoryArb,
        async (mime, size, category) => {
          const req = buildUploadRequest({
            fileName: "test-file.png",
            fileSize: size,
            contentType: mime,
            category,
          })

          const res = await POST(req as any)
          expect(res.status).toBe(200)

          const json = await res.json()
          expect(json.objectKey).toBeDefined()
          expect(json.dataUrl).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  it("rejects requests with invalid MIME type regardless of file size", async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidMimeArb,
        validSizeArb,
        async (badMime, size) => {
          const req = buildUploadRequest({
            fileName: "test-file.bin",
            fileSize: size,
            contentType: badMime,
            category: "uploads",
          })

          const res = await POST(req as any)
          expect(res.status).toBe(400)
        },
      ),
      { numRuns: 100 },
    )
  })

  it("rejects requests with oversized files regardless of MIME type", async () => {
    await fc.assert(
      fc.asyncProperty(
        validMimeArb,
        oversizeArb,
        async (mime, bigSize) => {
          const req = buildUploadRequest({
            fileName: "big-file.png",
            fileSize: bigSize,
            contentType: mime,
            category: "uploads",
          })

          const res = await POST(req as any)
          expect(res.status).toBe(400)
        },
      ),
      { numRuns: 100 },
    )
  })

  it("rejects requests with BOTH invalid MIME type AND oversized file", async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidMimeArb,
        oversizeArb,
        async (badMime, bigSize) => {
          const req = buildUploadRequest({
            fileName: "bad-file.exe",
            fileSize: bigSize,
            contentType: badMime,
            category: "uploads",
          })

          const res = await POST(req as any)
          expect(res.status).toBe(400)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ══════════════════════════════════════════════════════════════════════
// Property 11: R2 object key ownership verification
// ══════════════════════════════════════════════════════════════════════

describe("Feature: security-hardening, Property 11: R2 object key ownership verification", () => {
  /**
   * **Validates: Requirements 6.3, 6.4**
   *
   * For any presigned GET URL request, access SHALL be granted if and only if
   * the requesting user's ID matches the user ID segment in the object key
   * (pattern: {category}/{userId}/{uuid}.{ext}), OR the key starts with
   * "signatures/". All other requests SHALL return 403.
   */

  it("grants access when the requesting user's ID matches the key's user segment", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        nonSigCategoryArb,
        uuidArb,
        extArb,
        async (userId, category, fileUuid, ext) => {
          mockAuthUser.id = userId
          const key = `${category}/${userId}/${fileUuid}.${ext}`
          const req = buildGetUrlRequest(key)

          const res = await GET(req as any)
          expect(res.status).toBe(200)

          const json = await res.json()
          expect(json.url).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  it("denies access when the requesting user's ID does NOT match the key's user segment", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(userIdArb, userIdArb).filter(([a, b]) => a !== b),
        nonSigCategoryArb,
        uuidArb,
        extArb,
        async ([keyOwner, requester], category, fileUuid, ext) => {
          mockAuthUser.id = requester
          const key = `${category}/${keyOwner}/${fileUuid}.${ext}`
          const req = buildGetUrlRequest(key)

          const res = await GET(req as any)
          expect(res.status).toBe(403)
        },
      ),
      { numRuns: 100 },
    )
  })

  it("grants access for any key starting with 'signatures/' regardless of user ID", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        uuidArb,
        async (userId, sigId) => {
          mockAuthUser.id = userId
          const key = `signatures/${sigId}_${Date.now()}.png`
          const req = buildGetUrlRequest(key)

          const res = await GET(req as any)
          expect(res.status).toBe(200)

          const json = await res.json()
          expect(json.url).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  it("denies access for keys with fewer than 3 segments (no user ID extractable)", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        fc.constantFrom("singleSegment", "two/segments"),
        async (userId, malformedKey) => {
          mockAuthUser.id = userId
          const req = buildGetUrlRequest(malformedKey)

          const res = await GET(req as any)
          expect(res.status).toBe(403)
        },
      ),
      { numRuns: 100 },
    )
  })
})
