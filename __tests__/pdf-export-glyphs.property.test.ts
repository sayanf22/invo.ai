import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { readFileSync } from "fs"
import { join } from "path"

/**
 * Bug condition exploration test for the design.md Testing Strategy test
 * case (d): "a source-scan property asserting the fixed rendering sites
 * contain no literal \u2022/\u2014 raw text nodes and no â€¢ mojibake."
 *
 * The underlying defects (F1 mojibake, F2 raw-JSX escapes) are deterministic
 * source-level facts about a single file, not properties over generated
 * input space. Per tasks.md task 2's guidance, we scope this property to
 * source-scan assertions over the exact named sites, using fast-check only
 * to iterate the fixed set of named site locators (so the property
 * vocabulary/shape matches the rest of the suite) rather than to generate
 * arbitrary strings.
 *
 * IMPORTANT: This test is EXPECTED TO FAIL against the current (unfixed)
 * source. A failure here is the SUCCESS case for this exploration task.
 * Do NOT modify `lib/pdf-templates.tsx` to make it pass; task 4 owns the fix.
 */

const PDF_TEMPLATES_PATH = join(__dirname, "..", "lib", "pdf-templates.tsx")

function readPdfTemplatesSource(): string {
  return readFileSync(PDF_TEMPLATES_PATH, "utf-8")
}

// The six named raw-JSX escape sites from bugfix.md / design.md (Family 2),
// identified by a short description for failure-message readability. Each
// site's approximate line number is retained purely for documentation.
const RAW_JSX_ESCAPE_SITES = [
  { location: "ProposalPDF.budgetBreakdownRow (\\u2022)", approxLine: 2271 },
  { location: "InvoicePDF.partialPaymentNote (\\u2014)", approxLine: 206 },
  { location: "ContractPDF.partyALabel (\\u2014)", approxLine: 1784 },
  { location: "ContractPDF.partyBLabel (\\u2014)", approxLine: 1790 },
  { location: "PaymentReceiptPDF.subtitle (\\u2014)", approxLine: 2740 },
  { location: "PaymentReceiptPDF.footer (\\u2014)", approxLine: 2823 },
] as const

describe("PDF export glyph defects (F1/F2) — source-scan property (design test (d))", () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * Design Property 1 & 3 (source-scan variant): for each of the six named
   * raw-JSX escape sites, and for the file as a whole re: mojibake, the fixed
   * source SHALL contain no `â€¢` mojibake and no raw `\u2022`/`\u2014` text
   * node at that site.
   *
   * FAILS now for every site — the source currently contains raw `\u2022`/
   * `\u2014` JSX text nodes at all six locations, and the mojibake bullet
   * sequence at the ContractPDF/SOWPDF/NDAPDF/parseContractBody sites.
   */
  it("no named site contains a raw \\u2022/\\u2014 JSX text node or â€¢ mojibake", () => {
    const source = readPdfTemplatesSource()
    const mojibakeBullet = "\u00e2\u20ac\u00a2" // â€¢
    const rawJsxEscapeRe = />[^<>{}]*\\u20(22|14)[^<>{}]*</g

    fc.assert(
      fc.property(fc.constantFrom(...RAW_JSX_ESCAPE_SITES), (_site) => {
        // The mojibake check is global (file-wide), matching design Property 1.
        const hasMojibake = source.includes(mojibakeBullet)
        // The raw-JSX escape check is also evaluated against the whole file
        // since each site is a fixed, named location within it (design
        // Property 3) — per-site line-range slicing is unnecessary because
        // the assertion is "zero occurrences anywhere the fix touches".
        const rawEscapeMatches = source.match(rawJsxEscapeRe) ?? []

        expect(hasMojibake).toBe(false)
        expect(rawEscapeMatches).toEqual([])
      }),
      { numRuns: 100 },
    )
  })
})
