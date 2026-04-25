// Feature: esignature-upgrade, Property 1: Document fingerprint format invariant
// Feature: esignature-upgrade, Property 2: Document fingerprint determinism
// Feature: esignature-upgrade, Property 3: Tamper detection

/**
 * Property-based tests for lib/document-fingerprint.ts
 *
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5, 1.6
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { computeDocumentFingerprint } from "@/lib/document-fingerprint"

// ── Generators ────────────────────────────────────────────────────────────────

/**
 * Arbitrary JSON object with string keys and JSON-safe values (no undefined).
 * Uses fc.dictionary with fc.jsonValue() to ensure all values survive JSON.stringify.
 */
const jsonObjectArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.jsonValue()
) as fc.Arbitrary<Record<string, unknown>>

/**
 * Arbitrary non-empty string key for mutations.
 */
const fieldKeyArb = fc.string({ minLength: 1, maxLength: 30 })

// ── Property 1: Document fingerprint format invariant ─────────────────────────

describe("Feature: esignature-upgrade, Property 1: Document fingerprint format invariant", () => {
  /**
   * For any document JSON object, the computed SHA-256 fingerprint SHALL always
   * be a string of exactly 64 lowercase hexadecimal characters.
   *
   * Validates: Requirements 1.5
   */
  it("should always return a 64-char lowercase hex string for any JSON object", () => {
    fc.assert(
      fc.property(jsonObjectArb, (context) => {
        const fingerprint = computeDocumentFingerprint(context)

        // Must be a string
        expect(typeof fingerprint).toBe("string")

        // Must be exactly 64 characters
        expect(fingerprint).toHaveLength(64)

        // Must match lowercase hex pattern
        expect(fingerprint).toMatch(/^[0-9a-f]{64}$/)
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 2: Document fingerprint determinism ───────────────────────────────

describe("Feature: esignature-upgrade, Property 2: Document fingerprint determinism", () => {
  /**
   * For any document JSON object, computing the fingerprint twice SHALL produce
   * identical results (deterministic, canonical serialization).
   *
   * Validates: Requirements 1.1, 1.6
   */
  it("should produce identical fingerprints when called twice on the same object", () => {
    fc.assert(
      fc.property(jsonObjectArb, (context) => {
        const first = computeDocumentFingerprint(context)
        const second = computeDocumentFingerprint(context)

        expect(first).toBe(second)
      }),
      { numRuns: 100 }
    )
  })

  it("should produce identical fingerprints regardless of key insertion order", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          { minLength: 1, maxLength: 10 }
        ),
        (entries) => {
          // Build two objects with the same key-value pairs but different insertion order
          const forward: Record<string, unknown> = {}
          const reversed: Record<string, unknown> = {}

          for (const [k, v] of entries) {
            forward[k] = v
          }
          for (const [k, v] of [...entries].reverse()) {
            reversed[k] = v
          }

          const fingerprintForward = computeDocumentFingerprint(forward)
          const fingerprintReversed = computeDocumentFingerprint(reversed)

          expect(fingerprintForward).toBe(fingerprintReversed)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Property 3: Tamper detection ──────────────────────────────────────────────

describe("Feature: esignature-upgrade, Property 3: Tamper detection", () => {
  /**
   * For any document JSON object and any mutation of that object (changing any
   * field value, adding a field, or removing a field), the fingerprint of the
   * mutated object SHALL differ from the fingerprint of the original object.
   *
   * Validates: Requirements 1.3, 1.4
   */

  it("should detect field value changes", () => {
    fc.assert(
      fc.property(
        // Object with at least one key so we can mutate a value
        fc
          .dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.jsonValue(),
            { minKeys: 1, maxKeys: 10 }
          )
          .filter((obj) => Object.keys(obj).length > 0) as fc.Arbitrary<
          Record<string, unknown>
        >,
        fc.jsonValue(),
        (original, newValue) => {
          // Pick the first existing key to mutate
          const keyToMutate = Object.keys(original)[0]
          const oldValue = original[keyToMutate]

          // Only proceed if the new value serializes differently
          if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return

          const mutated = { ...original, [keyToMutate]: newValue }

          const originalFingerprint = computeDocumentFingerprint(original)
          const mutatedFingerprint = computeDocumentFingerprint(mutated)

          expect(originalFingerprint).not.toBe(mutatedFingerprint)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should detect field additions", () => {
    fc.assert(
      fc.property(
        jsonObjectArb,
        // New key that does not exist in the original object
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.jsonValue(),
        (original, newKey, newValue) => {
          // Skip if the key already exists in the original
          if (Object.prototype.hasOwnProperty.call(original, newKey)) return

          const mutated = { ...original, [newKey]: newValue }

          const originalFingerprint = computeDocumentFingerprint(original)
          const mutatedFingerprint = computeDocumentFingerprint(mutated)

          expect(originalFingerprint).not.toBe(mutatedFingerprint)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should detect field removals", () => {
    fc.assert(
      fc.property(
        // Object with at least one key so we can remove one
        fc
          .dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.jsonValue(),
            { minKeys: 1, maxKeys: 10 }
          )
          .filter((obj) => Object.keys(obj).length > 0) as fc.Arbitrary<
          Record<string, unknown>
        >,
        (original) => {
          const keyToRemove = Object.keys(original)[0]
          const mutated = { ...original }
          delete mutated[keyToRemove]

          const originalFingerprint = computeDocumentFingerprint(original)
          const mutatedFingerprint = computeDocumentFingerprint(mutated)

          expect(originalFingerprint).not.toBe(mutatedFingerprint)
        }
      ),
      { numRuns: 100 }
    )
  })
})
