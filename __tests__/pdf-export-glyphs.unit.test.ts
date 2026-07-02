import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Bug condition exploration tests for F1 (mojibake bullet glyphs) and F2
 * (raw-JSX \uXXXX escape text nodes) in `lib/pdf-templates.tsx`.
 *
 * IMPORTANT: These tests are EXPECTED TO FAIL against the current (unfixed)
 * source. A failure here is the SUCCESS case for this exploration task — it
 * proves defects F1/F2 exist. Do NOT modify `lib/pdf-templates.tsx` to make
 * these pass; task 4 owns the fix.
 */

const PDF_TEMPLATES_PATH = join(__dirname, "..", "lib", "pdf-templates.tsx")

function readPdfTemplatesSource(): string {
  return readFileSync(PDF_TEMPLATES_PATH, "utf-8")
}

describe("PDF export glyph defects (F1/F2) — bug condition exploration", () => {
  /**
   * **Validates: Requirements 1.1, 1.2**
   *
   * Design Property 1: Mojibake bullet glyphs render as U+2022.
   *
   * Source-scan variant: `lib/pdf-templates.tsx` must contain ZERO occurrences
   * of the three-byte mojibake sequence "â€¢" (U+00E2 U+20AC U+00A2), which is
   * a "•" (U+2022) that was corrupted through a Latin-1/UTF-8 round trip.
   *
   * FAILS now: the mojibake sequence is present at the `parseContractBody`
   * bullet-detection regex (~1743-1746), `ContractPDF`'s parsed-body bullet
   * marker (~1829), `SOWPDF`'s Assumptions marker (~2977), and `NDAPDF`'s
   * Exclusions marker (~3272).
   */
  it("F1: source contains zero occurrences of the bullet mojibake sequence", () => {
    const source = readPdfTemplatesSource()
    const mojibakeBullet = "\u00e2\u20ac\u00a2" // â€¢

    const occurrences = source.split(mojibakeBullet).length - 1

    expect(occurrences).toBe(0)
  })

  /**
   * **Validates: Requirements 1.3**
   *
   * Design Property 3: Raw-JSX escapes render the intended glyph.
   *
   * Source-scan variant: no raw text-node escape matching `>\s*\\u20(22|14)\s*<`
   * should exist at the six named sites (ProposalPDF budget row ~2271,
   * InvoicePDF/PaymentSection partial-payment note ~206, ContractPDF party
   * labels ~1784/1790, PaymentReceiptPDF subtitle ~2740 and footer ~2823).
   *
   * FAILS now: all six sites currently write the escape directly as raw JSX
   * text (e.g. `Party A \u2014 Provider` as bare text, not inside a string
   * expression), so the literal backslash-u sequence renders instead of the
   * glyph.
   */
  it("F2: source has no raw-JSX text-node \\u2022/\\u2014 escapes", () => {
    const source = readPdfTemplatesSource()

    // Matches a raw JSX text node containing a literal \u2022 or \u2014
    // escape sequence directly between tag boundaries, e.g. `>\u2014<` or
    // `>Party A \u2014 Provider<`.
    const rawJsxEscapeRe = />[^<>{}]*\\u20(22|14)[^<>{}]*</g

    const matches = source.match(rawJsxEscapeRe) ?? []

    expect(matches).toEqual([])
  })
})

/**
 * Preservation source-scan tests (design Property 7 / Req 3.1, 3.3):
 * confirm the already-correct sibling glyph usages named in bugfix.md/
 * design.md are PRESENT and UNCHANGED in the current (unfixed) source.
 *
 * Every string below was read directly from `lib/pdf-templates.tsx` at the
 * referenced line before writing this assertion (see task notes) — this is
 * NOT an assumption, it reflects the actual observed source text:
 *
 *   ~line 414  (ItemRow bulletLines):
 *     <Text style={{ fontSize: 8.5, color: c.pri, marginRight: 5, marginTop: 0.5, fontWeight: 700 }}>•</Text>
 *   ~line 2136 (ProposalPDF correct bullet expression):
 *     <Text style={{fontSize:9.5,color:c.pri,marginRight:5,fontWeight:700}}>{"\u2022"}</Text>
 *   ~line 111  (fmtDate):
 *     if (!d) return "\u2014"
 *   ~lines 516-517 (getDocumentConfig fromLabel/toLabel):
 *     fromLabel: "Party A \u2014 Provider",
 *     toLabel: "Party B \u2014 Client",
 *   ~line 2263 (tLns.join):
 *     const tStr = tLns.join(" \u2014 ") || dRaw
 *   `|| "\u2014"` fallback cells (data.paymentMethod, d.acceptanceCriteria,
 *   m.description, party.address, data.clientEmail, data.clientPhone,
 *   data.clientAddress — at least 5 distinct fallback-cell occurrences).
 *
 * These tests encode CURRENT correct behavior and MUST PASS against the
 * unfixed code right now — they are the baseline the task 4 fix must not
 * break (the fix must leave every one of these strings byte-for-byte
 * identical).
 */
describe("PDF export glyph correct-sibling preservation (bug condition does NOT hold)", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * `ItemRow`'s `bulletLines` renderer (~line 414) uses the correct literal
   * "•" glyph directly as JSX text content. This is deliberately left
   * as-is by the fix (Design decision A) and must remain present.
   */
  it("preserves the literal '•' bullet glyph in ItemRow.bulletLines (~line 414)", () => {
    const source = readPdfTemplatesSource()

    expect(source).toContain(
      '<Text style={{ fontSize: 8.5, color: c.pri, marginRight: 5, marginTop: 0.5, fontWeight: 700 }}>\u2022</Text>',
    )
  })

  /**
   * **Validates: Requirements 3.1**
   *
   * `ProposalPDF`'s correct expression-form bullet (~line 2136) wraps the
   * escape in a string expression `{"\u2022"}`, which IS a valid syntactic
   * position (unlike the six raw-JSX F2 defect sites), so it already
   * renders correctly and must remain unchanged.
   */
  it("preserves the correct '{\"\\u2022\"}' expression bullet in ProposalPDF (~line 2136)", () => {
    const source = readPdfTemplatesSource()

    expect(source).toContain(
      '<Text style={{fontSize:9.5,color:c.pri,marginRight:5,fontWeight:700}}>{"\\u2022"}</Text>',
    )
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * `fmtDate`'s `return "\u2014"` (~line 111) is a string-literal escape in
   * a valid syntactic position and must remain unchanged.
   */
  it("preserves fmtDate's string-literal '\\u2014' fallback (~line 111)", () => {
    const source = readPdfTemplatesSource()

    expect(source).toContain('if (!d) return "\\u2014"')
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * `getDocumentConfig`'s `fromLabel`/`toLabel` string literals
   * (~lines 516-517) already use the correct escape-in-string-literal form
   * and must remain unchanged.
   */
  it("preserves getDocumentConfig's fromLabel/toLabel string literals (~lines 516-517)", () => {
    const source = readPdfTemplatesSource()

    expect(source).toContain('fromLabel: "Party A \\u2014 Provider",')
    expect(source).toContain('toLabel: "Party B \\u2014 Client",')
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * `tLns.join(" \u2014 ")` (~line 2263) already uses the correct
   * escape-in-string-literal form and must remain unchanged.
   */
  it('preserves the tLns.join(" \\u2014 ") string-literal escape (~line 2263)', () => {
    const source = readPdfTemplatesSource()

    expect(source).toContain('tLns.join(" \\u2014 ")')
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * The `... || "\u2014"` fallback-cell pattern (data.paymentMethod,
   * d.acceptanceCriteria, m.description, party.address, data.clientEmail,
   * data.clientPhone, data.clientAddress, etc.) already uses the correct
   * escape-in-string-literal form. At least 5 distinct occurrences were
   * observed in the current source and must remain present.
   */
  it('preserves the \'|| "\\u2014"\' fallback-cell pattern (multiple sites)', () => {
    const source = readPdfTemplatesSource()

    const fallbackPattern = /\|\|\s*"\\u2014"/g
    const matches = source.match(fallbackPattern) ?? []

    expect(matches.length).toBeGreaterThanOrEqual(5)

    // Spot-check a few of the specific fallback sites named in bugfix.md.
    expect(source).toContain('data.paymentMethod || "\\u2014"')
    expect(source).toContain('d.acceptanceCriteria || "\\u2014"')
    expect(source).toContain('m.description || "\\u2014"')
    expect(source).toContain('party.address || "\\u2014"')
  })
})
