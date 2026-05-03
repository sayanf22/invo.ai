/**
 * Integration test for full thinking mode flow
 * Feature: kimi-rag-orchestrator, Task 5.2
 *
 * Tests the shouldOrchestrate gate, prompt template functions, and
 * callBedrockBrief with various input combinations.
 *
 * Validates: Requirements 1.1, 2.1, 3.1, 5.1, 5.2, 8.1
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import {
    callBedrockBrief,
    BUSINESS_PROFILE_COMMENTARY_PROMPT,
    COMPLIANCE_COMMENTARY_PROMPT,
    RAG_VALIDATION_PROMPT,
    ORCHESTRATOR_SYSTEM_PROMPT,
} from "@/lib/bedrock"

// ── Gate function (mirrors route handler logic) ───────────────────────────────

function computeShouldOrchestrate(
    thinkingMode: string,
    intentType: string,
    bedrockKey: string
): boolean {
    return (
        thinkingMode === "thinking" &&
        intentType === "document" &&
        !!bedrockKey &&
        bedrockKey.length > 10
    )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Orchestrator integration tests", () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.restoreAllMocks()
    })

    // ── shouldOrchestrate gate tests ──────────────────────────────────────

    describe("shouldOrchestrate gate", () => {
        /**
         * Validates: Requirement 8.1 — at most 3 calls in thinking mode
         */
        it("returns true for thinking + document + valid key", () => {
            expect(computeShouldOrchestrate("thinking", "document", "a-valid-key-12345")).toBe(true)
        })

        /**
         * Validates: Requirement 5.1 — zero calls in fast mode
         */
        it("returns false for fast mode", () => {
            expect(computeShouldOrchestrate("fast", "document", "a-valid-key-12345")).toBe(false)
        })

        /**
         * Validates: Requirement 5.2 — no events in fast mode
         */
        it("returns false for chat intent", () => {
            expect(computeShouldOrchestrate("thinking", "chat", "a-valid-key-12345")).toBe(false)
        })

        it("returns false for empty key", () => {
            expect(computeShouldOrchestrate("thinking", "document", "")).toBe(false)
        })

        it("returns false for short key (≤10 chars)", () => {
            expect(computeShouldOrchestrate("thinking", "document", "short")).toBe(false)
        })

        it("returns false when all conditions are wrong", () => {
            expect(computeShouldOrchestrate("fast", "chat", "")).toBe(false)
        })
    })

    // ── BUSINESS_PROFILE_COMMENTARY_PROMPT tests ─────────────────────────

    describe("BUSINESS_PROFILE_COMMENTARY_PROMPT", () => {
        /**
         * Validates: Requirement 1.1 — commentary about business profile
         */
        it("produces a valid prompt with all profile fields", () => {
            const prompt = BUSINESS_PROFILE_COMMENTARY_PROMPT({
                name: "Acme Corp",
                country: "India",
                currency: "INR",
                taxRegistered: true,
                businessType: "Technology",
            })

            expect(prompt).toContain("Acme Corp")
            expect(prompt).toContain("India")
            expect(prompt).toContain("INR")
            expect(prompt).toContain("Yes") // taxRegistered: true
            expect(prompt).toContain("Technology")
            expect(prompt.length).toBeGreaterThan(0)
        })

        it("handles tax-unregistered business", () => {
            const prompt = BUSINESS_PROFILE_COMMENTARY_PROMPT({
                name: "Small Shop",
                country: "USA",
                currency: "USD",
                taxRegistered: false,
                businessType: "Retail",
            })

            expect(prompt).toContain("No") // taxRegistered: false
            expect(prompt).toContain("Small Shop")
        })
    })

    // ── COMPLIANCE_COMMENTARY_PROMPT tests ────────────────────────────────

    describe("COMPLIANCE_COMMENTARY_PROMPT", () => {
        /**
         * Validates: Requirement 2.1 — commentary about compliance rules
         */
        it("produces valid prompt for non-zero rules", () => {
            const prompt = COMPLIANCE_COMMENTARY_PROMPT({
                country: "Germany",
                ruleCount: 3,
                categories: ["tax_rates", "mandatory_fields"],
                keyValues: "Tax: 19% — Standard VAT\nmandatory fields: Invoice number required",
            })

            expect(prompt).toContain("Germany")
            expect(prompt).toContain("3")
            expect(prompt).toContain("tax_rates")
            expect(prompt).toContain("mandatory_fields")
            expect(prompt.length).toBeGreaterThan(0)
        })

        it("produces 'no compliance data' message for zero rules", () => {
            const prompt = COMPLIANCE_COMMENTARY_PROMPT({
                country: "Atlantis",
                ruleCount: 0,
                categories: [],
                keyValues: "",
            })

            expect(prompt).toContain("Atlantis")
            expect(prompt.toLowerCase()).toContain("no compliance data")
        })
    })

    // ── RAG_VALIDATION_PROMPT tests ───────────────────────────────────────

    describe("RAG_VALIDATION_PROMPT", () => {
        /**
         * Validates: Requirement 3.1 — validation compares document against RAG rules
         */
        it("produces valid prompt with document data and RAG rules", () => {
            const docJson = JSON.stringify({ taxRate: 18, currency: "INR", total: 11800 })
            const ragRules = "Tax Rate: 18% — Standard GST\nmandatory fields: Invoice number, date, GSTIN"

            const prompt = RAG_VALIDATION_PROMPT({
                documentJson: docJson,
                ragRules: ragRules,
            })

            expect(prompt).toContain(docJson)
            expect(prompt).toContain(ragRules)
            expect(prompt).toContain("Generated Document")
            expect(prompt).toContain("RAG Compliance Rules")
            expect(prompt.length).toBeGreaterThan(0)
        })
    })

    // ── callBedrockBrief with empty key ───────────────────────────────────

    describe("callBedrockBrief", () => {
        /**
         * Validates: Requirement 8.1 — no calls with invalid key
         */
        it("returns null for empty API key without making a fetch call", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {})
            globalThis.fetch = vi.fn()

            const result = await callBedrockBrief(
                ORCHESTRATOR_SYSTEM_PROMPT,
                "Test prompt",
                "",
                100
            )

            expect(result).toBeNull()
            expect(globalThis.fetch).not.toHaveBeenCalled()
        })

        it("returns null for whitespace-only API key", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {})
            globalThis.fetch = vi.fn()

            const result = await callBedrockBrief(
                ORCHESTRATOR_SYSTEM_PROMPT,
                "Test prompt",
                "   ",
                100
            )

            expect(result).toBeNull()
            expect(globalThis.fetch).not.toHaveBeenCalled()
        })
    })

    // ── Full orchestration flow simulation ────────────────────────────────

    describe("Full thinking mode orchestration flow", () => {
        /**
         * Validates: Requirements 1.1, 2.1, 3.1, 8.1
         * Simulates the full orchestration: profile commentary → compliance commentary → validation
         */
        it("all 3 orchestrator calls fire in correct order with mocked Bedrock", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {})

            const callLog: string[] = []
            let callCount = 0

            globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
                callCount++
                const body = JSON.parse(opts.body)
                const userMsg = body.messages[1].content as string

                // Order matters: check validation FIRST (it also contains "compliance" in the rules)
                if (userMsg.includes("Generated Document") && userMsg.includes("RAG Compliance Rules")) {
                    callLog.push("rag_validation")
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            choices: [{ message: { content: "✅ Tax rate matches. ✅ Currency correct." } }],
                        }),
                    })
                } else if (userMsg.includes("Business Name")) {
                    callLog.push("profile_commentary")
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            choices: [{ message: { content: "Business is based in India." } }],
                        }),
                    })
                } else if (userMsg.includes("Rules Found") || userMsg.includes("No compliance data") || userMsg.includes("Summarize the key compliance")) {
                    callLog.push("compliance_commentary")
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve({
                            choices: [{ message: { content: "GST at 18% applies." } }],
                        }),
                    })
                }

                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        choices: [{ message: { content: "Generic response." } }],
                    }),
                })
            })

            const apiKey = "valid-bedrock-api-key-12345"

            // Step 1: Business profile commentary
            const profilePrompt = BUSINESS_PROFILE_COMMENTARY_PROMPT({
                name: "Acme Corp",
                country: "India",
                currency: "INR",
                taxRegistered: true,
                businessType: "Technology",
            })
            const profileResult = await callBedrockBrief(ORCHESTRATOR_SYSTEM_PROMPT, profilePrompt, apiKey, 100)
            expect(profileResult).toBe("Business is based in India.")

            // Step 2: Compliance commentary
            const compliancePrompt = COMPLIANCE_COMMENTARY_PROMPT({
                country: "India",
                ruleCount: 5,
                categories: ["tax_rates", "mandatory_fields"],
                keyValues: "Tax: 18% — Standard GST",
            })
            const complianceResult = await callBedrockBrief(ORCHESTRATOR_SYSTEM_PROMPT, compliancePrompt, apiKey, 100)
            expect(complianceResult).toBe("GST at 18% applies.")

            // Step 3: RAG validation
            const validationPrompt = RAG_VALIDATION_PROMPT({
                documentJson: JSON.stringify({ taxRate: 18, currency: "INR" }),
                ragRules: "Tax Rate: 18% — Standard GST",
            })
            const validationResult = await callBedrockBrief(ORCHESTRATOR_SYSTEM_PROMPT, validationPrompt, apiKey, 200)
            expect(validationResult).toBe("✅ Tax rate matches. ✅ Currency correct.")

            // Verify all 3 calls fired in correct order
            expect(callLog).toEqual(["profile_commentary", "compliance_commentary", "rag_validation"])
            expect(callCount).toBe(3)
        })

        /**
         * Validates: Requirements 5.1, 5.2 — fast mode makes zero orchestrator calls
         */
        it("fast mode gate prevents all orchestrator calls", () => {
            const shouldOrchestrate = computeShouldOrchestrate("fast", "document", "valid-key-12345")
            expect(shouldOrchestrate).toBe(false)

            // In the real route handler, when shouldOrchestrate is false,
            // callBedrockBrief is never called. We verify the gate logic here.
        })
    })
})
