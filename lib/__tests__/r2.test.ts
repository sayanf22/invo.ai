/**
 * Property-based tests for R2 Storage Service (Native Bindings)
 * Feature: cloudflare-r2-storage
 *
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ─── Constants matching the design spec ───
const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const
type Category = (typeof VALID_CATEGORIES)[number]

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Generates an object key following the design spec pattern:
 * {category}/{user_id}/{uuid}.{ext}
 */
function generateObjectKey(
  category: Category,
  userId: string,
  fileName: string
): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()! : "bin"
  const uuid = crypto.randomUUID()
  return `${category}/${userId}/${uuid}.${ext}`
}

// ─── Arbitraries ───
const categoryArb = fc.constantFrom(...VALID_CATEGORIES)
const userIdArb = fc.uuid()
const fileNameArb = fc.tuple(
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/),
  fc.constantFrom("png", "jpeg", "webp", "gif", "pdf")
).map(([name, ext]) => `${name}.${ext}`)

// ─── Property 1: Object key generation follows the correct pattern ───

describe("Property 1: Object key generation follows the correct pattern", () => {
  /**
   * Validates: Requirements 2.4, 10.4
   */
  it("generated key matches {category}/{userId}/{uuid}.{ext} pattern", () => {
    fc.assert(
      fc.property(
        categoryArb,
        userIdArb,
        fileNameArb,
        (category, userId, fileName) => {
          const key = generateObjectKey(category, userId, fileName)
          const parts = key.split("/")

          expect(parts).toHaveLength(3)
          expect(parts[0]).toBe(category)
          expect(parts[1]).toBe(userId)

          const filePart = parts[2]
          const dotIndex = filePart.lastIndexOf(".")
          expect(dotIndex).toBeGreaterThan(0)

          const uuid = filePart.substring(0, dotIndex)
          const ext = filePart.substring(dotIndex + 1)

          expect(uuid).toMatch(UUID_V4_REGEX)

          const originalExt = fileName.split(".").pop()!
          expect(ext).toBe(originalExt)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 4: putObject receives the exact content type ───

// Track putObject calls via mock R2 bucket
const putCalls: any[] = []

const mockBucket = {
  put: vi.fn().mockImplementation(async (key: string, body: any, options: any) => {
    putCalls.push({ key, body, options })
  }),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
}

// Mock the R2 bucket binding on process.env
vi.stubGlobal("process", {
  ...process,
  env: {
    ...process.env,
    R2_BUCKET: mockBucket,
  },
})

describe("Property 4: putObject includes the exact content type from the request", () => {
  const ALLOWED_CONTENT_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ] as const

  const contentTypeArb = fc.constantFrom(...ALLOWED_CONTENT_TYPES)

  beforeEach(() => {
    putCalls.length = 0
    mockBucket.put.mockClear()
  })

  /**
   * Validates: Requirements 2.5, 10.8
   */
  it("bucket.put receives the exact ContentType in httpMetadata", async () => {
    const { putObject } = await import("@/lib/r2")

    await fc.assert(
      fc.asyncProperty(
        contentTypeArb,
        categoryArb,
        userIdArb,
        async (contentType, category, userId) => {
          putCalls.length = 0
          mockBucket.put.mockClear()

          const objectKey = `${category}/${userId}/${crypto.randomUUID()}.png`
          const body = new Uint8Array(64)
          await putObject(objectKey, body, contentType)

          expect(mockBucket.put).toHaveBeenCalledTimes(1)
          const call = putCalls[0]
          expect(call.key).toBe(objectKey)
          expect(call.options.httpMetadata.contentType).toBe(contentType)
        }
      ),
      { numRuns: 100 }
    )
  })
})
