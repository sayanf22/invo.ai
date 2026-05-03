/**
 * Property test: Compliance commentary produces valid activity event (Property 2)
 * Feature: kimi-rag-orchestrator, Task 3.7
 *
 * Generates random compliance rule summaries with fast-check, calls
 * COMPLIANCE_COMMENTARY_PROMPT() with the rules, and verifies the returned
 * prompt string contains the country and rule count. Verifies zero rules
 * produces a "no compliance data" message.
 *
 * **Validates: Requirements 2.1**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { COMPLIANCE_COMMENTARY_PROMPT } from "@/lib/bedrock"

// ── Arbitraries ───────────────────────────────────────────────────────────────

const categoryArb = fc.oneof(
    fc.constant("tax_rates"),
    fc.constant("mandatory_fields"),
    fc.constant("currency_requirements"),
    fc.constant("legal_requirements"),
    fc.string({ minLength: 1, maxLength: 20 })
)

const nonZeroRulesArb = fc.record({
    country: fc.string({ minLength: 1, maxLength: 30 }),
    ruleCount: fc.integer({ min: 1, max: 50 }),
    categories: fc.array(categoryArb, { minLength: 1, maxLength: 5 }),
    keyValues: fc.string({ minLength: 1, maxLength: 200 }),
})

const zeroRulesArb = fc.record({
    country: fc.string({ minLength: 1, maxLength: 30 }),
    ruleCount: fc.constant(0),
    categories: fc.constant([] as string[]),
    keyValues: fc.constant(""),
})

// ── Property Tests ────────────────────────────────────────────────────────────

describe("Compliance commentary prompt (Property 2)", () => {
    /**
     * Property: For any non-zero rule count, the prompt contains the country
     * and rule count, and is a non-empty string.
     * Validates: Requirement 2.1
     */
    it("prompt contains country and rule count for non-zero rules", () => {
        fc.assert(
            fc.property(nonZeroRulesArb, (rules) => {
                const prompt = COMPLIANCE_COMMENTARY_PROMPT(rules)

                // Must be a non-empty string
                expect(typeof prompt).toBe("string")
                expect(prompt.length).toBeGreaterThan(0)

                // Must contain the country
                expect(prompt).toContain(rules.country)

                // Must contain the rule count as a string
                expect(prompt).toContain(String(rules.ruleCount))
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: For zero rules, the prompt produces a "no compliance data" message
     * containing the country name.
     * Validates: Requirement 2.1
     */
    it("zero rules produces a 'no compliance data' message with country", () => {
        fc.assert(
            fc.property(zeroRulesArb, (rules) => {
                const prompt = COMPLIANCE_COMMENTARY_PROMPT(rules)

                // Must be a non-empty string
                expect(typeof prompt).toBe("string")
                expect(prompt.length).toBeGreaterThan(0)

                // Must contain the country
                expect(prompt).toContain(rules.country)

                // Must indicate no compliance data
                expect(prompt.toLowerCase()).toContain("no compliance data")
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: For non-zero rules, the prompt contains the categories.
     * Validates: Requirement 2.1
     */
    it("prompt contains categories for non-zero rules", () => {
        fc.assert(
            fc.property(nonZeroRulesArb, (rules) => {
                const prompt = COMPLIANCE_COMMENTARY_PROMPT(rules)

                // Each category should appear in the prompt
                for (const cat of rules.categories) {
                    expect(prompt).toContain(cat)
                }
            }),
            { numRuns: 100 }
        )
    })
})
