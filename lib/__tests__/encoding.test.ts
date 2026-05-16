/**
 * Unit tests for lib/encoding.ts
 *
 * Validates: Requirements 1.2, 1.4, 8.2
 */
import { describe, it, expect } from "vitest"
import { fixEncoding, isCleanUtf8 } from "@/lib/encoding"

// Mojibake sequences built from Unicode escapes so source bytes never appear
const MOJIBAKE_EM_DASH = "\u00e2\u0080\u0094"
const MOJIBAKE_EN_DASH = "\u00e2\u0080\u0093"
const MOJIBAKE_LDQUOTE = "\u00e2\u0080\u009c"
const MOJIBAKE_RDQUOTE = "\u00e2\u0080\u009d"
const MOJIBAKE_LSQUOTE = "\u00e2\u0080\u0098"
const MOJIBAKE_RSQUOTE = "\u00e2\u0080\u0099"

describe("fixEncoding", () => {
  it("replaces mojibake em dash (U+00E2 U+0080 U+0094) with the correct em dash U+2014", () => {
    expect(fixEncoding(MOJIBAKE_EM_DASH)).toBe("\u2014")
  })

  it("returns ASCII strings unchanged (identity on clean ASCII)", () => {
    expect(fixEncoding("hello world")).toBe("hello world")
  })

  it("replaces mojibake en dash with the correct en dash U+2013", () => {
    expect(fixEncoding(MOJIBAKE_EN_DASH)).toBe("\u2013")
  })

  it("replaces mojibake left double quote with U+201C", () => {
    expect(fixEncoding(MOJIBAKE_LDQUOTE)).toBe("\u201c")
  })

  it("replaces mojibake right double quote with U+201D", () => {
    expect(fixEncoding(MOJIBAKE_RDQUOTE)).toBe("\u201d")
  })

  it("replaces mojibake left single quote with U+2018", () => {
    expect(fixEncoding(MOJIBAKE_LSQUOTE)).toBe("\u2018")
  })

  it("replaces mojibake right single quote with U+2019", () => {
    expect(fixEncoding(MOJIBAKE_RSQUOTE)).toBe("\u2019")
  })

  it("replaces multiple mojibake sequences within a single string", () => {
    const input =
      "PARTY A " + MOJIBAKE_EM_DASH + " PROVIDER and PARTY B " + MOJIBAKE_EM_DASH + " CLIENT"
    const expected = "PARTY A \u2014 PROVIDER and PARTY B \u2014 CLIENT"
    expect(fixEncoding(input)).toBe(expected)
  })

  it("leaves already-correct Unicode em dashes untouched", () => {
    const clean = "PARTY A \u2014 PROVIDER"
    expect(fixEncoding(clean)).toBe(clean)
  })

  it("returns an empty string unchanged", () => {
    expect(fixEncoding("")).toBe("")
  })
})

describe("isCleanUtf8", () => {
  it("returns true for a string with a real em dash (U+2014)", () => {
    expect(isCleanUtf8("\u2014")).toBe(true)
  })

  it("returns false for a string containing a mojibake em dash sequence", () => {
    expect(isCleanUtf8(MOJIBAKE_EM_DASH)).toBe(false)
  })

  it("returns true for clean ASCII text", () => {
    expect(isCleanUtf8("hello world")).toBe(true)
  })

  it("returns false when mojibake appears mid-string", () => {
    expect(isCleanUtf8("PARTY A " + MOJIBAKE_EM_DASH + " PROVIDER")).toBe(false)
  })

  it("returns true for an empty string", () => {
    expect(isCleanUtf8("")).toBe(true)
  })
})
