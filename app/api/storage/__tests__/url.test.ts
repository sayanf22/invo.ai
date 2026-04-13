/**
 * Property-based tests for Download API ownership verification
 * Feature: cloudflare-r2-storage, Property 5: Download API ownership verification
 *
 * Validates: Requirements 3.2, 3.3, 10.5
 *
 * Tests the actual GET handler from /api/storage/url.
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi } from "vitest"
import * as fc from "fast-check"

// ── Constants ─────────────────────────────────────────────────────────

const CATEGORIES = ["logos", "documents", "uploads"] as const
const EXTENSIONS = ["png", "jpeg", "webp", "gif", "pdf"] as const

// ── Mocks ─────────────────────────────────────────────────────────────

const mockAuthUser = { id: "default-user-id" }

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn().mockImplementation(async () => ({
    user: mockAuthUser,
    supabase: {},
    error: null,
  })),
}))

// Mock R2 getObject to return a fake R2ObjectBody
vi.mock("@/lib/r2", () => ({
  getObject: vi.fn().mockImplementation(async () => ({
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    }),
    httpMetadata: { contentType: "image/png" },
    size: 3,
  })),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}))

// ── Import the handler under test ─────────────────────────────────────

import { GET } from "@/app/api/storage/url/route"

// ── Arbitraries ───────────────────────────────────────────────────────

const uuidArb = fc.uuid().map((u) => u.replace(/-/g, "").slice(0, 32))
const userIdArb = fc.uuid()
const categoryArb = fc.constantFrom(...CATEGORIES)
const extArb = fc.constantFrom(...EXTENSIONS)

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
  it("returns 200 when the key's user ID matches the authenticated user", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, categoryArb, uuidArb, extArb, async (userId, cat, uuid, ext) => {
        mockAuthUser.id = userId
        const key = `${cat}/${userId}/${uuid}.${ext}`
        const req = buildGetRequest(key)

        const res = await GET(req as any)

        // The response is now a file stream, not JSON
        expect(res.status).toBe(200)
        expect(res.headers.get("Content-Type")).toBe("image/png")
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

  it("returns 200 for signature keys regardless of user ID", async () => {
    await fc.assert(
      fc.asyncProperty(userIdArb, uuidArb, async (userId, uuid) => {
        mockAuthUser.id = userId
        const key = `signatures/${uuid}_${Date.now()}.png`
        const req = buildGetRequest(key)

        const res = await GET(req as any)

        expect(res.status).toBe(200)
      }),
      { numRuns: 100 },
    )
  })
})
