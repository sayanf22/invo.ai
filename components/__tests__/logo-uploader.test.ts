import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { validateLogoFile } from "@/components/logo-uploader"

/**
 * Property 6: Logo validation accepts only valid image types within size limit
 *
 * For any file with a MIME type and size, the Logo Uploader validation SHALL
 * accept the file if and only if the MIME type is one of `image/png`,
 * `image/jpeg`, `image/webp`, `image/gif` AND the file size does not exceed
 * 5 MB (5,242,880 bytes).
 *
 * **Validates: Requirements 6.2, 6.3, 7.5, 9.3**
 */

const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024 // 5,242,880

// -- Generators --

const validTypeArb = fc.constantFrom(...VALID_IMAGE_TYPES)

const invalidTypeArb = fc
  .string({ minLength: 1 })
  .filter((s) => !(VALID_IMAGE_TYPES as readonly string[]).includes(s))

const validSizeArb = fc.integer({ min: 0, max: MAX_SIZE_BYTES })

const oversizeArb = fc.integer({ min: MAX_SIZE_BYTES + 1, max: MAX_SIZE_BYTES * 10 })

describe("Property 6: Logo validation accepts only valid image types within size limit", () => {
  it("accepts files with a valid image type and size within the 5 MB limit", () => {
    fc.assert(
      fc.property(validTypeArb, validSizeArb, (type, size) => {
        const result = validateLogoFile({ type, size })
        expect(result).toEqual({ valid: true })
      }),
      { numRuns: 100 }
    )
  })

  it("rejects files with an invalid MIME type regardless of size", () => {
    fc.assert(
      fc.property(
        invalidTypeArb,
        fc.integer({ min: 0, max: MAX_SIZE_BYTES }),
        (type, size) => {
          const result = validateLogoFile({ type, size })
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
          expect(result.error).toContain("Invalid file type")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("rejects files with a valid type but size exceeding 5 MB", () => {
    fc.assert(
      fc.property(validTypeArb, oversizeArb, (type, size) => {
        const result = validateLogoFile({ type, size })
        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toContain("File too large")
      }),
      { numRuns: 100 }
    )
  })
})
