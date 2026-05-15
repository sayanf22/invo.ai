/**
 * Property-based tests for CREATE_CARD signal parsing in chat-only prompts.
 *
 * This file covers Property 7: CREATE_CARD signal parsing for all types.
 *
 * **Validates: Requirements 5.7, 5.8**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  parseCreateCardSignal,
  CREATE_CARD_SIGNAL_REGEX,
} from "@/lib/chat-only-prompts"
import { ALL_DOCUMENT_TYPES, type DocumentType } from "@/lib/document-type-registry"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a well-formed CREATE_CARD signal string from type and summary. */
function buildSignal(type: string, summary: string): string {
  return `[CREATE_CARD:{"type":"${type}","summary":"${summary}"}]`
}

/** Arbitrary that picks any canonical DocumentType. */
const anyDocumentType = fc.constantFrom(...ALL_DOCUMENT_TYPES)

/**
 * Arbitrary for a single printable ASCII char that is safe inside a JSON string
 * (no double-quote, no backslash, no control characters).
 * Uses integer → String.fromCharCode to avoid fc.char() which doesn't exist in v4.
 */
const safeSummaryChar = fc
  .integer({ min: 32, max: 126 })
  .filter((code) => code !== 34 /* " */ && code !== 92 /* \ */)
  .map((code) => String.fromCharCode(code))

/**
 * Arbitrary for a valid summary: non-empty string, up to 200 chars,
 * using printable ASCII characters that are safe inside a JSON string.
 */
const validSummary = fc
  .array(safeSummaryChar, { minLength: 1, maxLength: 200 })
  .map((chars) => chars.join(""))

// ─── Property 7: CREATE_CARD signal parsing for all types ────────────────────

describe("Property 7: CREATE_CARD signal parsing for all types", () => {
  /**
   * For any type in ALL_DOCUMENT_TYPES and any valid summary (non-empty,
   * up to 200 chars), a well-formed CREATE_CARD signal parses successfully
   * and returns the correct type.
   *
   * **Validates: Requirements 5.7, 5.8**
   */
  it("parses successfully for any type in ALL_DOCUMENT_TYPES with a valid summary", () => {
    fc.assert(
      fc.property(anyDocumentType, validSummary, (type, summary) => {
        const signal = buildSignal(type, summary)
        const result = parseCreateCardSignal(signal)

        expect(result).not.toBeNull()
        expect(result!.type).toBe(type)
        expect(result!.summary).toBe(summary)
      }),
      { numRuns: 500 }
    )
  })

  /**
   * The returned type always exactly matches the input type.
   *
   * **Validates: Requirements 5.7, 5.8**
   */
  it("returned type always matches the input type", () => {
    fc.assert(
      fc.property(anyDocumentType, validSummary, (type, summary) => {
        const result = parseCreateCardSignal(buildSignal(type, summary))
        expect(result).not.toBeNull()
        expect(result!.type).toBe(type)
      }),
      { numRuns: 300 }
    )
  })

  // ─── Specific type assertions ─────────────────────────────────────────────

  it.each(ALL_DOCUMENT_TYPES as readonly DocumentType[])(
    "parses correctly for type '%s'",
    (docType) => {
      const summary = `Test summary for ${docType}`
      const signal = buildSignal(docType, summary)
      const result = parseCreateCardSignal(signal)

      expect(result).not.toBeNull()
      expect(result!.type).toBe(docType)
      expect(result!.summary).toBe(summary)
    }
  )

  // ─── Negative cases ───────────────────────────────────────────────────────

  /**
   * The legacy "quotation" type must not parse — it has been replaced by "quote".
   *
   * **Validates: Requirement 5.8**
   */
  it('does not parse the old "quotation" type (legacy alias, replaced by "quote")', () => {
    const signal = buildSignal("quotation", "A price quote for services")
    const result = parseCreateCardSignal(signal)
    expect(result).toBeNull()
  })

  /**
   * Unknown / invalid type strings must not parse.
   */
  it("does not parse unknown/invalid type strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !(ALL_DOCUMENT_TYPES as readonly string[]).includes(s) && s !== "quotation"
        ),
        validSummary,
        (unknownType, summary) => {
          const signal = buildSignal(unknownType, summary)
          const result = parseCreateCardSignal(signal)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * An empty summary must not parse.
   */
  it("does not parse a signal with an empty summary", () => {
    for (const type of ALL_DOCUMENT_TYPES) {
      const signal = buildSignal(type, "")
      const result = parseCreateCardSignal(signal)
      expect(result).toBeNull()
    }
  })

  /**
   * A summary exceeding 200 characters must not parse.
   *
   * **Validates: Requirements 5.7, 5.8**
   */
  it("does not parse a signal when summary is longer than 200 characters", () => {
    fc.assert(
      fc.property(
        anyDocumentType,
        fc
          .array(safeSummaryChar, { minLength: 201, maxLength: 400 })
          .map((chars) => chars.join("")),
        (type, longSummary) => {
          const signal = buildSignal(type, longSummary)
          const result = parseCreateCardSignal(signal)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * CREATE_CARD_STRIP_REGEX-like check: the regex accepts all 10 types.
   */
  it("CREATE_CARD_SIGNAL_REGEX matches all 10 types in ALL_DOCUMENT_TYPES", () => {
    for (const type of ALL_DOCUMENT_TYPES) {
      const signal = buildSignal(type, "Valid summary text")
      expect(signal).toMatch(CREATE_CARD_SIGNAL_REGEX)
    }
  })

  /**
   * CREATE_CARD_SIGNAL_REGEX does not match the legacy "quotation" type.
   */
  it('CREATE_CARD_SIGNAL_REGEX does not match the "quotation" legacy type', () => {
    const signal = buildSignal("quotation", "Valid summary text")
    expect(signal).not.toMatch(CREATE_CARD_SIGNAL_REGEX)
  })

  /**
   * Malformed signals (missing fields, wrong structure) must not parse.
   */
  it("does not parse malformed signals missing required fields", () => {
    const malformed = [
      "[CREATE_CARD:]",
      "[CREATE_CARD:{}]",
      '[CREATE_CARD:{"type":"invoice"}]',
      '[CREATE_CARD:{"summary":"some text"}]',
      'CREATE_CARD:{"type":"invoice","summary":"test"}',
      '[CREATE_CARD:{"type":"invoice","summary":"test"}',
    ]
    for (const signal of malformed) {
      expect(parseCreateCardSignal(signal)).toBeNull()
    }
  })

  /**
   * parseCreateCardSignal returns null for empty or non-signal strings.
   */
  it("returns null for arbitrary strings with no CREATE_CARD signal", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("[CREATE_CARD:")),
        (text) => {
          expect(parseCreateCardSignal(text)).toBeNull()
        }
      ),
      { numRuns: 200 }
    )
  })
})
