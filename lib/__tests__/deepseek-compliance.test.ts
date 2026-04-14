/**
 * Tests for buildPrompt() — TAX_REGISTRATION_STATUS block
 *
 * Property-Based Tests (Task 15) and Unit Tests (Task 16)
 * for country-compliant document generation.
 */

import fc from "fast-check"
import { describe, it, expect } from "vitest"
import { buildPrompt } from "@/lib/deepseek"
import type { AIGenerationRequest } from "@/lib/deepseek"

// Helper to build a minimal AIGenerationRequest
function makeRequest(
  overrides: Partial<AIGenerationRequest["businessContext"]> & { country?: string }
): AIGenerationRequest {
  return {
    prompt: "create an invoice",
    documentType: "invoice",
    businessContext: {
      name: "Test Business",
      ...overrides,
    },
  }
}

// ── Property-Based Tests (Task 15) ────────────────────────────────────────────

describe("Property-Based Tests", () => {
  /**
   * Property 5: Tax-registered businesses always have TAX_REGISTRATION_STATUS
   * with Registered: YES
   *
   * Validates: Requirements 1.5, 3.2, 4.2, 5.4, 6.2, 7.2, 8.2, 9.2, 10.2, 11.2
   */
  it("Property 5: registered businesses always produce Registered: YES in TAX_REGISTRATION_STATUS", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"),
        fc.record({ taxId: fc.string({ minLength: 5, maxLength: 20 }) }),
        (country, taxIds) => {
          const prompt = buildPrompt(makeRequest({ country, taxRegistered: true, taxIds }))
          expect(prompt).toContain("TAX_REGISTRATION_STATUS:")
          expect(prompt).toContain("Registered: YES")
          expect(prompt).toContain(`Country: ${country}`)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Unregistered businesses always produce Registered: NO
   *
   * Validates: Requirements 1.8, 3.6, 4.8, 5.5, 6.6, 7.7, 8.7, 9.7, 10.7, 11.7, 13.4
   */
  it("Property 6: unregistered businesses always produce Registered: NO in TAX_REGISTRATION_STATUS", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"),
        (country) => {
          const prompt = buildPrompt(makeRequest({ country, taxRegistered: false }))
          expect(prompt).toContain("TAX_REGISTRATION_STATUS:")
          expect(prompt).toContain("Registered: NO")
          expect(prompt).toContain(`Country: ${country}`)
          // Apply Rule must instruct taxRate=0
          expect(prompt).toContain("taxRate=0")
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: TAX_REGISTRATION_STATUS block is absent when businessContext is missing
   *
   * Validates: Requirement 16.3
   */
  it("Property: TAX_REGISTRATION_STATUS block is absent when businessContext is missing", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (prompt) => {
          const result = buildPrompt({
            prompt,
            documentType: "invoice",
            // no businessContext
          })
          expect(result).not.toContain("TAX_REGISTRATION_STATUS:")
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: TAX_REGISTRATION_STATUS block is absent when businessContext has no country
   *
   * Validates: Requirement 16.3
   */
  it("Property: TAX_REGISTRATION_STATUS block is absent when businessContext has no country", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (businessName) => {
          const result = buildPrompt({
            prompt: "create invoice",
            documentType: "invoice",
            businessContext: { name: businessName },
          })
          expect(result).not.toContain("TAX_REGISTRATION_STATUS:")
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ── Unit Tests (Task 16) ──────────────────────────────────────────────────────

describe("Unit Tests", () => {
  /**
   * 16.1: Indian registered business — TAX_REGISTRATION_STATUS block format
   * Validates: Requirements 1.2, 1.3, 1.5
   */
  it("16.1: Indian registered business — TAX_REGISTRATION_STATUS block format", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "IN",
        taxRegistered: true,
        taxIds: { gstin: "27AABCU9603R1ZX" },
      })
    )
    expect(prompt).toContain("Country: IN")
    expect(prompt).toContain("Registered: YES")
    expect(prompt).toContain('"gstin":"27AABCU9603R1ZX"')
    expect(prompt).toContain("CGST+SGST")
    expect(prompt).toContain("IGST")
  })

  /**
   * 16.2: Indian unregistered business — zero tax and threshold note instruction
   * Validates: Requirements 1.8, 14.1
   */
  it("16.2: Indian unregistered business — zero tax and threshold note instruction", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "IN",
        taxRegistered: false,
      })
    )
    expect(prompt).toContain("Registered: NO")
    expect(prompt).toContain("taxRate=0")
    expect(prompt).toContain("Rs. 20L")
  })

  /**
   * 16.3: Canadian Quebec registered business — province rate
   * Validates: Requirements 5.2, 5.3
   */
  it("16.3: Canadian Quebec registered business — province rate", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "CA",
        taxRegistered: true,
        taxIds: { bn: "123456789RT0001" },
      })
    )
    expect(prompt).toContain("Registered: YES")
    // The apply rule lists QC 14.975% — check for the rate
    expect(prompt).toContain("14.975")
    // Also check QC is mentioned in the province table
    expect(prompt).toContain("QC")
  })

  /**
   * 16.4: German Kleinunternehmer — unregistered note instruction
   * Validates: Requirement 4.8
   */
  it("16.4: German Kleinunternehmer — unregistered note instruction", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "DE",
        taxRegistered: false,
      })
    )
    expect(prompt).toContain("Registered: NO")
    expect(prompt).toContain("§ 19 UStG")
    expect(prompt).toContain("taxRate=0")
  })

  /**
   * 16.5: UAE registered business — TRN and emirate clarification
   * Validates: Requirements 8.2, 8.8
   */
  it("16.5: UAE registered business — TRN and emirate clarification", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "AE",
        taxRegistered: true,
        taxIds: { trn: "100123456700003" },
      })
    )
    expect(prompt).toContain("Registered: YES")
    expect(prompt).toContain("TRN")
    expect(prompt).toContain("emirate")
  })

  /**
   * 16.6: Australian registered business — ABN formatting
   * Validates: Requirements 6.2, 6.7
   */
  it("16.6: Australian registered business — ABN formatting", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "AU",
        taxRegistered: true,
        taxIds: { abn: "51824753556" },
      })
    )
    expect(prompt).toContain("Registered: YES")
    expect(prompt).toContain("ABN")
    expect(prompt).toContain("XX XXX XXX XXX")
  })

  /**
   * 16.7: US business with no client state — default to zero tax
   * Validates: Requirements 2.1, 2.3
   */
  it("16.7: US business with no client state — default to zero tax", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "US",
        taxRegistered: true,
        taxIds: { ein: "12-3456789" },
      })
    )
    expect(prompt).toContain("Registered: YES")
    expect(prompt).toContain("taxRate=0")
    expect(prompt).toContain("state")
  })

  /**
   * 16.8: Registered business with missing taxIds — ask for tax ID
   * Validates: Requirements 3.2, 15.1
   */
  it("16.8: registered business with missing taxIds — ask for tax ID in message", () => {
    const prompt = buildPrompt(
      makeRequest({
        country: "GB",
        taxRegistered: true,
        taxIds: {},
      })
    )
    expect(prompt).toContain("Tax IDs: none")
    expect(prompt).toContain('fromTaxId: ""')
    expect(prompt).toContain("ask for")
  })
})
