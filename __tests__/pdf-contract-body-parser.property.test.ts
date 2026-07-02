import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { parseContractBody } from "@/lib/pdf-templates"

/**
 * Bug condition exploration test for F1 detection (design Property 2):
 * `parseContractBody` must classify a line starting with a real "•"
 * (U+2022) bullet as a `bullet` block, stripping the marker.
 *
 * IMPORTANT: This test is EXPECTED TO FAIL against the current (unfixed)
 * `parseContractBody`, whose detection regex uses the mojibake sequence
 * "â€¢" instead of the real "•" character. A failure here is the SUCCESS
 * case for this exploration task — it proves the F1 detection defect
 * exists. Do NOT modify `lib/pdf-templates.tsx` to make it pass; task 4
 * owns the fix.
 *
 * NOTE (per task 2 scope): only the F1 detection property is added here.
 * Task 3 will append the `-` bullet / heading / paragraph preservation
 * properties (design Property 7) to this same file.
 */

/**
 * Arbitrary for the bullet body text following "• ". Constrained so the
 * expected block text can be compared directly to the generated value:
 * - non-empty after trim (so the assertion isn't testing an empty string)
 * - no leading/trailing whitespace (so `.trim()` inside the parser is a
 *   no-op and `block.text === text` holds exactly)
 * - single line (no `\n`/`\r`), since a newline would split the input into
 *   multiple parseContractBody lines
 * - printable ASCII, so we don't need to reason about other control chars
 */
const bulletBodyTextArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s) => {
    if (s.trim() !== s) return false // no leading/trailing whitespace
    if (s.length === 0) return false // non-empty
    if (/[\r\n]/.test(s)) return false // single line only
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f]/.test(s)) return false // no other control characters
    return true
  })

describe("parseContractBody — F1 detection (bug condition exploration)", () => {
  /**
   * **Validates: Requirements 1.2**
   *
   * Design Property 2: For any line "• " + text (a real U+2022 bullet),
   * `parseContractBody` returns a single `bullet` block whose text equals
   * `text` (marker stripped, trimmed).
   *
   * FAILS now: the current regex `/^[-â€¢]\s+/` does not match a real "•"
   * character, so the line falls through to the paragraph buffer and is
   * returned as a `paragraph` block instead of a `bullet` block.
   */
  it("F1: a real bullet ('\u2022 ' prefix) line is detected as a bullet block", () => {
    fc.assert(
      fc.property(bulletBodyTextArb, (text) => {
        const line = `\u2022 ${text}`
        const blocks = parseContractBody(line)

        expect(blocks).toHaveLength(1)
        expect(blocks[0]).toEqual({ kind: "bullet", text })
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Preservation property test for F1 (design Property 7 / Req 3.2):
 * `parseContractBody` must CONTINUE to detect "- "-prefixed lines as
 * bullets, and non-bullet lines must CONTINUE to be classified as
 * `paragraph`/`heading` as appropriate.
 *
 * This test encodes CURRENT correct behavior and MUST PASS against the
 * unfixed code right now — it is the baseline the task 4 fix must not
 * break.
 */
describe("parseContractBody — preservation (bug condition does NOT hold)", () => {
  /**
   * **Validates: Requirements 3.2**
   *
   * Design Property 7: for any line "- " + text, `parseContractBody`
   * returns a single `bullet` block whose text equals `text` (marker
   * stripped). Observed on the unfixed code: PASSES today (the "-" branch
   * of the `/^[-â€¢]\s+/` regex already works), so this must continue to
   * pass after the fix.
   */
  it("preserves '-'-prefixed bullet detection", () => {
    fc.assert(
      fc.property(bulletBodyTextArb, (text) => {
        const line = `- ${text}`
        const blocks = parseContractBody(line)

        expect(blocks).toHaveLength(1)
        expect(blocks[0]).toEqual({ kind: "bullet", text })
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 3.2**
   *
   * A plain prose line (no leading "- ", "• ", or numbered-heading
   * pattern) must continue to be classified as a `paragraph` block with
   * its trimmed text preserved.
   */
  it("preserves plain-prose lines as paragraph blocks", () => {
    // Constrain to text that cannot accidentally look like a bullet or a
    // numbered heading (e.g. must not start with a digit followed by "."/")"
    // and must not itself begin with "-" or "•").
    const paragraphTextArb = bulletBodyTextArb.filter(
      (s) => !/^[-\u2022]/.test(s) && !/^\d{1,2}[.)]\s/.test(s),
    )

    fc.assert(
      fc.property(paragraphTextArb, (text) => {
        const blocks = parseContractBody(text)

        expect(blocks).toHaveLength(1)
        expect(blocks[0]).toEqual({ kind: "paragraph", text })
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 3.2**
   *
   * A numbered-heading line ("1. Scope of Work", no terminal punctuation)
   * must continue to be classified as a `heading` block with the
   * "<n>. <title>" text preserved.
   */
  it("preserves numbered-heading lines as heading blocks", () => {
    const titleArb = fc
      .string({ minLength: 2, maxLength: 60 })
      .filter((s) => {
        if (s.trim() !== s) return false
        if (s.length < 2) return false
        if (/[\r\n]/.test(s)) return false
        // eslint-disable-next-line no-control-regex
        if (/[\x00-\x1f]/.test(s)) return false
        if (/[.!?]$/.test(s)) return false // no terminal punctuation
        return true
      })

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99 }), fc.constantFrom(".", ")"), titleArb, (n, punct, title) => {
        const line = `${n}${punct} ${title}`
        const blocks = parseContractBody(line)

        expect(blocks).toHaveLength(1)
        expect(blocks[0]).toEqual({ kind: "heading", text: `${n}. ${title}` })
      }),
      { numRuns: 100 },
    )
  })
})
