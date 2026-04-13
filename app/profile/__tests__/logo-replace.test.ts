/**
 * Property-based tests for logo replacement cleanup
 * Feature: cloudflare-r2-storage, Property 7: Logo replacement deletes the previous object
 *
 * **Validates: Requirements 7.4**
 *
 * For any logo replacement operation where an old logo object key exists,
 * the system SHALL call `deleteObject` with the old object key before or
 * after uploading the new logo, ensuring no orphaned files remain in R2.
 *
 * Test approach: Call the DELETE handler at /api/storage/url with a valid
 * logo object key and a matching authenticated user, then verify that
 * `deleteObject` is called with the exact key.
 *
 * Uses fast-check for property-based testing with vitest. Minimum 100 iterations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ── Constants ─────────────────────────────────────────────────────────

const LOGO_EXTENSIONS = ["png", "jpeg", "webp", "gif"] as const

// ── Mocks ─────────────────────────────────────────────────────────────

const mockAuthUser = { id: "default-user-id" }

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn().mockImplementation(async () => ({
    user: mockAuthUser,
    supabase: {},
    error: null,
  })),
}))

const mockDeleteObject = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/r2", () => ({
  generatePresignedGetUrl: vi
    .fn()
    .mockResolvedValue("https://fake-presigned.example.com/download"),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("fake-secret-value"),
}))

// ── Import the handler under test ─────────────────────────────────────

import { DELETE } from "@/app/api/storage/url/route"

// ── Arbitraries ───────────────────────────────────────────────────────

/** Generate a valid UUID v4-like string */
const uuidArb = fc.uuid()

/** Generate a realistic user ID (UUID format) */
const userIdArb = fc.uuid()

/** Generate a logo file extension */
const logoExtArb = fc.constantFrom(...LOGO_EXTENSIONS)

/**
 * Generate a valid logo object key for a given user ID:
 * logos/{userId}/{uuid}.{ext}
 */
function logoKeyForUser(userId: string) {
  return fc.tuple(uuidArb, logoExtArb).map(
    ([uuid, ext]) => `logos/${userId}/${uuid}.${ext}`,
  )
}

// ── Helper ────────────────────────────────────────────────────────────

function buildDeleteRequest(key: string): Request {
  const url = new URL("http://localhost:3000/api/storage/url")
  url.searchParams.set("key", key)
  return new Request(url.toString(), { method: "DELETE" })
}

// ── Property 7: Logo replacement deletes the previous object ──────────

describe("Property 7: Logo replacement deletes the previous object", () => {
  beforeEach(() => {
    mockDeleteObject.mockClear()
  })

  /**
   * **Validates: Requirements 7.4**
   *
   * For any valid logo object key (logos/{userId}/{uuid}.{ext}),
   * when the DELETE handler is called with a matching authenticated user,
   * deleteObject SHALL be called exactly once with the exact old key.
   */
  it("calls deleteObject with the exact old logo key when user owns the key", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, uuidArb, logoExtArb, async (userId, uuid, ext) => {
        mockDeleteObject.mockClear()
        mockAuthUser.id = userId

        const oldLogoKey = `logos/${userId}/${uuid}.${ext}`
        const req = buildDeleteRequest(oldLogoKey)

        const res = await DELETE(req as any)
        const json = await res.json()

        // The DELETE handler should succeed
        expect(res.status).toBe(200)
        expect(json.success).toBe(true)

        // deleteObject must be called exactly once with the exact old key
        expect(mockDeleteObject).toHaveBeenCalledTimes(1)
        expect(mockDeleteObject).toHaveBeenCalledWith(oldLogoKey)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 7.4**
   *
   * For any logo replacement where the old key belongs to a different user,
   * the DELETE handler SHALL return 403 and NOT call deleteObject,
   * preventing unauthorized deletion of another user's logo.
   */
  it("does NOT call deleteObject when the key belongs to a different user", async () => {
    const distinctUserPairArb = fc
      .tuple(userIdArb, userIdArb)
      .filter(([a, b]) => a !== b)

    await fc.assert(
      fc.asyncProperty(
        distinctUserPairArb,
        uuidArb,
        logoExtArb,
        async ([keyOwner, requester], uuid, ext) => {
          mockDeleteObject.mockClear()
          mockAuthUser.id = requester

          const oldLogoKey = `logos/${keyOwner}/${uuid}.${ext}`
          const req = buildDeleteRequest(oldLogoKey)

          const res = await DELETE(req as any)
          const json = await res.json()

          // Should be denied
          expect(res.status).toBe(403)
          expect(json.error).toBeDefined()

          // deleteObject must NOT be called
          expect(mockDeleteObject).not.toHaveBeenCalled()
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 7.4**
   *
   * The key passed to deleteObject must be exactly the key from the request,
   * preserving the full path including category, user ID, UUID, and extension.
   */
  it("preserves the exact object key path when calling deleteObject", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, async (userId) => {
        mockDeleteObject.mockClear()
        mockAuthUser.id = userId

        // Use the logo key arbitrary to generate a key for this user
        const keyArb = logoKeyForUser(userId)
        const oldLogoKey = fc.sample(keyArb, 1)[0]

        const req = buildDeleteRequest(oldLogoKey)
        const res = await DELETE(req as any)

        expect(res.status).toBe(200)

        // The argument to deleteObject must be the exact key string
        const calledWith = mockDeleteObject.mock.calls[0][0]
        expect(calledWith).toBe(oldLogoKey)
        expect(calledWith).toMatch(/^logos\//)
        expect(calledWith).toContain(userId)
      }),
      { numRuns: 100 },
    )
  })
})
