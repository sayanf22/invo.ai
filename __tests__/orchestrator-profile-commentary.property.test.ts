/**
 * Property test: Business profile commentary produces valid activity event (Property 1)
 * Feature: kimi-rag-orchestrator, Task 3.6
 *
 * Generates random business profiles with fast-check, calls
 * BUSINESS_PROFILE_COMMENTARY_PROMPT() with the profile, and verifies
 * the returned prompt string contains the business name, country, and currency,
 * and is a non-empty string.
 *
 * **Validates: Requirements 1.1**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { BUSINESS_PROFILE_COMMENTARY_PROMPT } from "@/lib/bedrock"

// ── Arbitraries ───────────────────────────────────────────────────────────────

const businessProfileArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    country: fc.string({ minLength: 1, maxLength: 30 }),
    currency: fc.string({ minLength: 1, maxLength: 10 }),
    taxRegistered: fc.boolean(),
    businessType: fc.string({ minLength: 1, maxLength: 30 }),
})

// ── Property Tests ────────────────────────────────────────────────────────────

describe("Business profile commentary prompt (Property 1)", () => {
    /**
     * Property: For any valid business profile, the prompt contains the business name,
     * country, and currency, and is a non-empty string.
     * Validates: Requirement 1.1
     */
    it("prompt contains business name, country, and currency for any profile", () => {
        fc.assert(
            fc.property(businessProfileArb, (profile) => {
                const prompt = BUSINESS_PROFILE_COMMENTARY_PROMPT(profile)

                // Must be a non-empty string
                expect(typeof prompt).toBe("string")
                expect(prompt.length).toBeGreaterThan(0)

                // Must contain the business name, country, and currency
                expect(prompt).toContain(profile.name)
                expect(prompt).toContain(profile.country)
                expect(prompt).toContain(profile.currency)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: The prompt includes tax registration status.
     * Validates: Requirement 1.1
     */
    it("prompt includes tax registration status", () => {
        fc.assert(
            fc.property(businessProfileArb, (profile) => {
                const prompt = BUSINESS_PROFILE_COMMENTARY_PROMPT(profile)

                if (profile.taxRegistered) {
                    expect(prompt).toContain("Yes")
                } else {
                    expect(prompt).toContain("No")
                }
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: The prompt includes the business type.
     * Validates: Requirement 1.1
     */
    it("prompt includes business type", () => {
        fc.assert(
            fc.property(businessProfileArb, (profile) => {
                const prompt = BUSINESS_PROFILE_COMMENTARY_PROMPT(profile)
                expect(prompt).toContain(profile.businessType)
            }),
            { numRuns: 100 }
        )
    })
})
