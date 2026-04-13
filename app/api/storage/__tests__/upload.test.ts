/**
 * Property-based tests for Upload API validation
 * Feature: cloudflare-r2-storage
 *
 * Tests the actual POST handler from /api/storage/upload.
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"

// ── Constants matching the route ──────────────────────────────────────

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB = 10,485,760 bytes

// ── Mocks ─────────────────────────────────────────────────────────────

// Mock authenticateRequest to always return a valid user
vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn().mockResolvedValue({
    user: { id: "test-user-id-00000000" },
    supabase: {},
    error: null,
  }),
}))

// Mock checkRateLimit to always pass
vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

// Mock generatePresignedPutUrl to return a fake URL
vi.mock("@/lib/r2", () => ({
  generatePresignedPutUrl: vi.fn().mockResolvedValue("https://fake-presigned.example.com/upload"),
}))

// Mock secrets module
vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("fake-secret-value"),
}))

// ── Helper to build a NextRequest-like object for the POST handler ────

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/storage/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

// ── Import the handler under test ─────────────────────────────────────

import { POST } from "@/app/api/storage/upload/route"

// ── Property 2: Content type validation rejects disallowed types ──────

describe("Property 2: Content type validation rejects disallowed types", () => {
  /**
   * Validates: Requirements 2.2, 2.7
   *
   * For any string that is NOT in the allowed content type list,
   * the Upload API validation SHALL reject the request.
   * Conversely, for any string that IS in the allowed list,
   * validation SHALL accept it.
   */

  it("rejects any content type NOT in the allowed list", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(s)
        ),
        async (invalidContentType) => {
          const req = buildRequest({
            fileName: "test.bin",
            fileSize: 1024,
            contentType: invalidContentType,
            category: "uploads",
          })

          const res = await POST(req as any)
          const json = await res.json()

          expect(res.status).toBe(400)
          expect(json.error).toContain("Unsupported file type")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("accepts every content type that IS in the allowed list", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ALLOWED_CONTENT_TYPES),
        async (validContentType) => {
          const req = buildRequest({
            fileName: "test.png",
            fileSize: 1024,
            contentType: validContentType,
            category: "uploads",
          })

          const res = await POST(req as any)
          const json = await res.json()

          // Should succeed (200) — not rejected for content type
          expect(res.status).toBe(200)
          expect(json.uploadUrl).toBeDefined()
          expect(json.objectKey).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 3: File size validation enforces the 10 MB limit ─────────

describe("Property 3: File size validation enforces the 10 MB limit", () => {
  /**
   * Validates: Requirements 2.3, 2.7
   *
   * For any positive integer file size, the Upload API validation SHALL
   * reject the request if and only if the file size exceeds 10 MB (10,485,760 bytes).
   */

  it("rejects any file size exceeding 10 MB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }),
        async (oversizedFileSize) => {
          const req = buildRequest({
            fileName: "large.pdf",
            fileSize: oversizedFileSize,
            contentType: "application/pdf",
            category: "documents",
          })

          const res = await POST(req as any)
          const json = await res.json()

          expect(res.status).toBe(400)
          expect(json.error).toContain("File too large")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("accepts any positive file size at or below 10 MB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: MAX_FILE_SIZE }),
        async (validFileSize) => {
          const req = buildRequest({
            fileName: "doc.pdf",
            fileSize: validFileSize,
            contentType: "application/pdf",
            category: "documents",
          })

          const res = await POST(req as any)
          const json = await res.json()

          // Should succeed — not rejected for file size
          expect(res.status).toBe(200)
          expect(json.uploadUrl).toBeDefined()
          expect(json.objectKey).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
