/**
 * Property-based tests for Upload API validation
 * Feature: cloudflare-r2-storage
 *
 * Tests the validation logic extracted from the upload route.
 * Uses fast-check for property-based testing with vitest.
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Validation constants (must match the route) ───────────────────────

const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB = 10,485,760 bytes

const VALID_CATEGORIES = ["logos", "documents", "signatures", "uploads"] as const

// ── Pure validation functions (mirror the route logic) ────────────────

function validateContentType(contentType: string): { valid: boolean; error?: string } {
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return { valid: false, error: "Unsupported file type. Allowed: PNG, JPEG, WebP, GIF, PDF." }
  }
  return { valid: true }
}

function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
  if (typeof fileSize !== "number" || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large. Maximum 10MB." }
  }
  return { valid: true }
}

function validateCategory(category: string): { valid: boolean; error?: string } {
  if (!category || !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return { valid: false, error: "Invalid upload category." }
  }
  return { valid: true }
}

// ── Property 2: Content type validation rejects disallowed types ──────

describe("Property 2: Content type validation rejects disallowed types", () => {
  /**
   * Validates: Requirements 2.2, 2.7
   */
  it("rejects any content type NOT in the allowed list", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(
          (s) => !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(s)
        ),
        (invalidContentType) => {
          const result = validateContentType(invalidContentType)
          expect(result.valid).toBe(false)
          expect(result.error).toContain("Unsupported file type")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("accepts every content type that IS in the allowed list", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_CONTENT_TYPES),
        (validContentType) => {
          const result = validateContentType(validContentType)
          expect(result.valid).toBe(true)
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
   */
  it("rejects any file size exceeding 10 MB", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }),
        (oversizedFileSize) => {
          const result = validateFileSize(oversizedFileSize)
          expect(result.valid).toBe(false)
          expect(result.error).toContain("File too large")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("accepts any positive file size at or below 10 MB", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_FILE_SIZE }),
        (validFileSize) => {
          const result = validateFileSize(validFileSize)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
