import { describe, it, expect } from "vitest"
import { changeOrderIdSuffix } from "@/lib/pdf-templates"

/**
 * Bug condition exploration test for F4 (empty "(ID: )" parenthetical) via
 * `changeOrderIdSuffix`, exported from `lib/pdf-templates.tsx` in task 1.3.
 *
 * IMPORTANT: This test is EXPECTED TO FAIL against the current (unfixed)
 * `changeOrderIdSuffix`, which unconditionally returns
 * `" (ID: " + (parentDocumentId ?? "") + ")"`. A failure here is the
 * SUCCESS case for this exploration task — it proves the F4 defect exists.
 * Do NOT modify `lib/pdf-templates.tsx` to make it pass; task 5 owns the fix.
 */
describe("changeOrderIdSuffix — F4 empty parenthetical (bug condition exploration)", () => {
  /**
   * **Validates: Requirements 1.6**
   *
   * Design Property 6: for an empty string `parentDocumentId`,
   * `changeOrderIdSuffix` SHALL return `""` (no dangling "(ID: )").
   *
   * FAILS now: returns `" (ID: )"`.
   */
  it("F4: changeOrderIdSuffix('') returns an empty string", () => {
    const result = changeOrderIdSuffix("")

    expect(result).toBe("")
  })

  /**
   * **Validates: Requirements 1.6**
   *
   * Design Property 6: for an undefined `parentDocumentId`,
   * `changeOrderIdSuffix` SHALL return `""` (no dangling "(ID: )").
   *
   * FAILS now: returns `" (ID: )"`.
   */
  it("F4: changeOrderIdSuffix(undefined) returns an empty string", () => {
    const result = changeOrderIdSuffix(undefined)

    expect(result).toBe("")
  })
})

/**
 * Preservation unit test (design Property 8 / Req 3.6): a change order
 * WITH a populated `parentDocumentId` must CONTINUE to render
 * " (ID: <parentDocumentId>)" exactly as today.
 *
 * Observed on the unfixed `changeOrderIdSuffix` (task 1.3's unconditional
 * `" (ID: " + (parentDocumentId ?? "") + ")"` form): PASSES today, since a
 * non-empty `parentDocumentId` produces the same suffix under both the
 * unconditional and the eventual guarded implementation.
 */
describe("changeOrderIdSuffix — preservation (bug condition does NOT hold)", () => {
  it("preserves the ' (ID: <id>)' suffix for a populated parentDocumentId", () => {
    const result = changeOrderIdSuffix("CTR-1")

    expect(result).toBe(" (ID: CTR-1)")
  })
})
