/**
 * Property-based tests for R2 Storage Service
 * Feature: cloudflare-r2-storage
 *
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ─── Constants matching the design spec ───
const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const
type Category = (typeof VALID_CATEGORIES)[number]

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
}

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Generates an object key following the design spec pattern:
 * {category}/{user_id}/{uuid}.{ext}
 *
 * This mirrors the logic that the Upload API (task 2.1) will use.
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
const contentTypeArb = fc.constantFrom(...ALLOWED_CONTENT_TYPES)

// ─── Property 1: Object key generation follows the correct pattern ───

describe("Property 1: Object key generation follows the correct pattern", () => {
  /**
   * Validates: Requirements 2.4, 10.4
   *
   * For any valid category, user ID, and file name with a valid extension,
   * the generated object key SHALL match the pattern {category}/{user_id}/{uuid}.{ext}
   * where the user ID segment equals the authenticated user's ID and the UUID is a valid v4 UUID.
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

          // Must have exactly 3 segments: category / userId / filename
          expect(parts).toHaveLength(3)

          // First segment is the category
          expect(parts[0]).toBe(category)

          // Second segment is the user ID
          expect(parts[1]).toBe(userId)

          // Third segment is {uuid}.{ext}
          const filePart = parts[2]
          const dotIndex = filePart.lastIndexOf(".")
          expect(dotIndex).toBeGreaterThan(0)

          const uuid = filePart.substring(0, dotIndex)
          const ext = filePart.substring(dotIndex + 1)

          // UUID must be a valid v4 UUID
          expect(uuid).toMatch(UUID_V4_REGEX)

          // Extension must match the original file's extension
          const originalExt = fileName.split(".").pop()!
          expect(ext).toBe(originalExt)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 4: Presigned PUT URL includes the exact content type ───

// Track PutObjectCommand calls
const putObjectCalls: any[] = []

vi.mock("@aws-sdk/client-s3", () => {
  class MockPutObjectCommand {
    input: any
    constructor(input: any) {
      this.input = input
      putObjectCalls.push(input)
    }
  }
  class MockGetObjectCommand {
    input: any
    constructor(input: any) { this.input = input }
  }
  class MockDeleteObjectCommand {
    input: any
    constructor(input: any) { this.input = input }
  }
  class MockS3Client {
    constructor(_config: any) {}
    send(_command: any) { return Promise.resolve({}) }
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
  }
})

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://fake-presigned-url.example.com"),
}))

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockImplementation((name: string) => {
    const secrets: Record<string, string> = {
      R2_ACCOUNT_ID: "fake-account-id",
      R2_ACCESS_KEY_ID: "fake-access-key",
      R2_SECRET_ACCESS_KEY: "fake-secret-key",
      R2_BUCKET_NAME: "test-bucket",
    }
    return Promise.resolve(secrets[name] || "")
  }),
}))

describe("Property 4: Presigned PUT URL includes the exact content type from the request", () => {
  beforeEach(() => {
    putObjectCalls.length = 0
  })

  /**
   * Validates: Requirements 2.5, 10.8
   *
   * For any allowed content type, when generating a presigned PUT URL,
   * the PutObjectCommand SHALL include a ContentType parameter equal to
   * the requested content type, ensuring R2 rejects uploads with mismatched types.
   */
  it("PutObjectCommand receives the exact ContentType from the request", async () => {
    const { generatePresignedPutUrl } = await import("@/lib/r2")

    await fc.assert(
      fc.asyncProperty(
        contentTypeArb,
        categoryArb,
        userIdArb,
        async (contentType, category, userId) => {
          putObjectCalls.length = 0

          const objectKey = `${category}/${userId}/${crypto.randomUUID()}.${EXTENSION_MAP[contentType]}`
          await generatePresignedPutUrl(objectKey, contentType)

          // Exactly one PutObjectCommand should have been created
          expect(putObjectCalls).toHaveLength(1)

          const input = putObjectCalls[0]
          // ContentType must exactly match the requested content type
          expect(input.ContentType).toBe(contentType)
          // Key must match
          expect(input.Key).toBe(objectKey)
          // Bucket must be set
          expect(input.Bucket).toBe("test-bucket")
        }
      ),
      { numRuns: 100 }
    )
  })
})
