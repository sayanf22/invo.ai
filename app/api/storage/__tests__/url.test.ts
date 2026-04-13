/**
 * Property-based tests for Download API ownership verification
 * Feature: cloudflare-r2-storage, Property 5: Download API ownership verification
 *
 * Validates: Requirements 3.2, 3.3, 10.5
 *
 * Tests the actual GET handler from /api/storage/url.
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ── Constants ─────────────────────────────────────────────────────────

const CATEGORIES = ["logos", "documents", "uploads"] as const
const EXTENSIONS = ["png", "jpeg", "webp", "gif", "pdf"] as const

// ── Mocks ─────────────────────────────────────────────────────────────

// We need a mutable ref so we can change the authenticated user per test
const mockAuthUser = { id: "default-user-id" }

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn().mockImplementation(async () => ({
    user: mockAuthUser,
    supabase: {},
    error: null,
  })),
}))

vi.mock("@/lib/r2", () => ({
  generatePresignedGetUrl: vi
    .fn()
    .mockResolvedValue("https://fake-presigned.example.com/download"),
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("fake-secret-value"),
}))

// ── Import the handler under test ─────────────────────────────────────

import { GET } from "@/app/api/storage/url/route"

// ── Arbitraries ───────────────────────────────────────────────────────

/** Generate a valid UUID v4-like string */
const uuidArb = fc.uuid().map((u) => u.replace(/-/g, "").slice(0, 32))

/** Generate a realistic user ID (UUID format) */
const userIdArb = fc.uuid()

/** Generate a category from the standard set */
const categoryArb = fc.constantFrom(...CATEGORIES)

/** Generate a file extension */
const extArb = fc.constantFrom(...EXTENSIONS)

/**
 * Generate an object key with a specific user ID embedded:
 * {category}/{userId}/{uuid}.{ext}
 */
function objectKeyForUser(userId: string) {
  return fc.tuple(categoryArb, uuidArb, extArb).map(
    ([cat, uuid, ext]) => `${cat}/${userId}/${uuid}.${ext}`,
  )
}

/**
 * Generate a pair of distinct user IDs (owner vs requester).
 */
const distinctUserPairArb = fc
  .tuple(userIdArb, userIdArb)
  .filter(([a, b]) => a !== b)

// ── Helper ────────────────────────────────────────────────────────────

function buildGetRequest(key: string): Request {
  const url = new URL("http://localhost:3000/api/storage/url")
  url.searchParams.set("key", key)
  return new Request(url.toString(), { method: "GET" })
}

// ── Property 5: Download API ownership verification ───────────────────

describe("Property 5: Download API ownership verification", () => {
  /**
   * Validates: Requirements 3.2, 3.3, 10.5
   *
   * For any object key and authenticated user, the Download API SHALL
   * return a presigned GET URL if and only if the user ID segment
   * extracted from the object key matches the authenticated user's ID.
   * If they do not match, the API SHALL return 403.
   */

  it("returns 200 with { url } when the key's user ID matches the authenticated user", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, categoryArb, uuidArb, extArb, async (userId, cat, uuid, ext) => {
        // Set the authenticated user to match the key's user ID
        mockAuthUser.id = userId
        const key = `${cat}/${userId}/${uuid}.${ext}`
        const req = buildGetRequest(key)

        const res = await GET(req as any)
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.url).toBeDefined()
        expect(typeof json.url).toBe("string")
      }),
      { numRuns: 100 },
    )
  })

  it("returns 403 when the key's user ID does NOT match the authenticated user", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctUserPairArb,
        categoryArb,
        uuidArb,
        extArb,
        async ([keyOwner, requester], cat, uuid, ext) => {
          // Authenticated user is different from the key's owner
          mockAuthUser.id = requester
          const key = `${cat}/${keyOwner}/${uuid}.${ext}`
          const req = buildGetRequest(key)

          const res = await GET(req as any)
          const json = await res.json()

          expect(res.status).toBe(403)
          expect(json.error).toBeDefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  it("returns 200 for signature keys regardless of user ID (bypass ownership check)", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, uuidArb, async (userId, uuid) => {
        // Set any user — signature keys should always pass
        mockAuthUser.id = userId
        const key = `signatures/${uuid}_${Date.now()}.png`
        const req = buildGetRequest(key)

        const res = await GET(req as any)
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.url).toBeDefined()
      }),
      { numRuns: 100 },
    )
  })
})
