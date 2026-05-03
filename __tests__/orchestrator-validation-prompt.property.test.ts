/**
 * Property test: Validation prompt includes document data and RAG rules (Property 3)
 * Feature: kimi-rag-orchestrator, Task 3.8
 *
 * Generates random document JSON and RAG rules with fast-check, calls
 * RAG_VALIDATION_PROMPT() with the data, and verifies the returned prompt
 * string contains both the document data and RAG rules.
 *
 * **Validates: Requirements 3.1**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { RAG_VALIDATION_PROMPT } from "@/lib/bedrock"

// ── Arbitraries ───────────────────────────────────────────────────────────────

const documentJsonArb = fc.record({
    taxRate: fc.double({ min: 0, max: 50, noNaN: true }),
    currency: fc.oneof(
        fc.constant("USD"),
        fc.constant("INR"),
        fc.constant("EUR"),
        fc.constant("GBP"),
        fc.string({ minLength: 3, maxLength: 3 })
    ),
    invoiceNumber: fc.string({ minLength: 5, maxLength: 20 }),
    total: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
}).map((doc) => JSON.stringify(doc))

const ragRulesArb = fc.array(
    fc.record({
        category: fc.oneof(
            fc.constant("tax_rates"),
            fc.constant("mandatory_fields"),
            fc.constant("currency_requirements")
        ),
        description: fc.string({ minLength: 1, maxLength: 50 }),
        value: fc.string({ minLength: 1, maxLength: 30 }),
    }),
    { minLength: 1, maxLength: 5 }
).map((rules) =>
    rules.map((r) => `${r.category}: ${r.description} (${r.value})`).join("\n")
)

// ── Property Tests ────────────────────────────────────────────────────────────

describe("Validation prompt includes document data and RAG rules (Property 3)", () => {
    /**
     * Property: For any valid document JSON and RAG rules, the prompt contains
     * both the document data and the RAG rules.
     * Validates: Requirement 3.1
     */
    it("prompt contains both document JSON and RAG rules", () => {
        fc.assert(
            fc.property(documentJsonArb, ragRulesArb, (docJson, ragRules) => {
                const prompt = RAG_VALIDATION_PROMPT({
                    documentJson: docJson,
                    ragRules: ragRules,
                })

                // Must be a non-empty string
                expect(typeof prompt).toBe("string")
                expect(prompt.length).toBeGreaterThan(0)

                // Must contain the document JSON
                expect(prompt).toContain(docJson)

                // Must contain the RAG rules
                expect(prompt).toContain(ragRules)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: The prompt mentions compliance-related comparison instructions.
     * Validates: Requirement 3.1
     */
    it("prompt contains compliance comparison instructions", () => {
        fc.assert(
            fc.property(documentJsonArb, ragRulesArb, (docJson, ragRules) => {
                const prompt = RAG_VALIDATION_PROMPT({
                    documentJson: docJson,
                    ragRules: ragRules,
                })

                // Should mention tax rate, mandatory fields, and currency
                expect(prompt.toLowerCase()).toContain("tax rate")
                expect(prompt.toLowerCase()).toContain("mandatory fields")
                expect(prompt.toLowerCase()).toContain("currency")
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: The prompt contains both section markers for document and rules.
     * Validates: Requirement 3.1
     */
    it("prompt contains section markers for document and rules", () => {
        fc.assert(
            fc.property(documentJsonArb, ragRulesArb, (docJson, ragRules) => {
                const prompt = RAG_VALIDATION_PROMPT({
                    documentJson: docJson,
                    ragRules: ragRules,
                })

                // Should have clear section markers
                expect(prompt).toContain("Generated Document")
                expect(prompt).toContain("RAG Compliance Rules")
            }),
            { numRuns: 100 }
        )
    })
})
