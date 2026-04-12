/**
 * Property-based tests for mapExtractedToDbUpdate
 * Feature: profile-update-ai-improvements
 * 
 * Tests validate correctness properties from the design document.
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { mapExtractedToDbUpdate, ProfileData } from "@/components/profile-update-chat"

// ─── Arbitraries ───────────────────────────────────────────────────────────────

const nonEmptyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)

const profileArb: fc.Arbitrary<ProfileData> = fc.record({
  name: fc.option(nonEmptyString, { nil: undefined }),
  business_type: fc.option(nonEmptyString, { nil: undefined }),
  owner_name: fc.option(nonEmptyString, { nil: undefined }),
  email: fc.option(nonEmptyString, { nil: undefined }),
  phone: fc.option(nonEmptyString, { nil: undefined }),
  country: fc.option(fc.stringMatching(/^[A-Z]{2}$/), { nil: undefined }),
  state_province: fc.option(nonEmptyString, { nil: undefined }),
  address: fc.option(
    fc.record({
      street: nonEmptyString,
      city: nonEmptyString,
      state: nonEmptyString,
      postal_code: nonEmptyString,
    }),
    { nil: undefined }
  ),
  tax_ids: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), nonEmptyString, { minKeys: 1, maxKeys: 5 }),
    { nil: undefined }
  ),
  client_countries: fc.option(
    fc.array(fc.stringMatching(/^[A-Z]{2}$/), { minLength: 1, maxLength: 10 }),
    { nil: undefined }
  ),
  default_currency: fc.option(fc.stringMatching(/^[A-Z]{3}$/), { nil: undefined }),
  default_payment_terms: fc.option(nonEmptyString, { nil: undefined }),
  default_payment_instructions: fc.option(nonEmptyString, { nil: undefined }),
  additional_notes: fc.option(nonEmptyString, { nil: undefined }),
  payment_methods: fc.option(
    fc.record({
      bank: fc.record({
        bankName: nonEmptyString,
        accountNumber: nonEmptyString,
      }),
    }),
    { nil: undefined }
  ),
})

// ─── Property 1: Top-level field preservation on merge ─────────────────────────

describe("Property 1: Top-level field preservation on merge", () => {
  it("should NOT include top-level fields in output when extracted values are null/undefined/empty", () => {
    fc.assert(
      fc.property(
        profileArb.filter(p => !!(p.name || p.email || p.phone || p.business_type || p.owner_name)),
        fc.constantFrom(null, undefined, ""),
        (profile, emptyVal) => {
          const extracted: Record<string, unknown> = {
            businessName: emptyVal,
            businessType: emptyVal,
            ownerName: emptyVal,
            email: emptyVal,
            phone: emptyVal,
            country: emptyVal,
            defaultCurrency: emptyVal,
            paymentTerms: emptyVal,
            paymentInstructions: emptyVal,
            additionalNotes: emptyVal,
          }

          const result = mapExtractedToDbUpdate(extracted, profile)

          // None of these fields should appear in the result
          expect(result).not.toHaveProperty("name")
          expect(result).not.toHaveProperty("business_type")
          expect(result).not.toHaveProperty("owner_name")
          expect(result).not.toHaveProperty("email")
          expect(result).not.toHaveProperty("phone")
          expect(result).not.toHaveProperty("country")
          expect(result).not.toHaveProperty("default_currency")
          expect(result).not.toHaveProperty("default_payment_terms")
          expect(result).not.toHaveProperty("default_payment_instructions")
          expect(result).not.toHaveProperty("additional_notes")
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 2: Nested object deep merge preserves existing sub-fields ────────

describe("Property 2: Nested object deep merge preserves existing sub-fields", () => {
  it("should preserve existing address sub-fields when extracted has empty/missing sub-fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          street: nonEmptyString,
          city: nonEmptyString,
          state: nonEmptyString,
          postal_code: nonEmptyString,
        }),
        (existingAddress) => {
          const profile: ProfileData = {
            address: existingAddress,
            country: "US",
          }

          // Extracted address with only one sub-field set
          const extracted = {
            address: { state: "California" },
          }

          const result = mapExtractedToDbUpdate(extracted, profile)
          const addr = result.address as Record<string, string>

          // Existing sub-fields should be preserved
          expect(addr.street).toBe(existingAddress.street)
          expect(addr.city).toBe(existingAddress.city)
          // The extracted state should overwrite
          expect(addr.state).toBe("California")
          expect(addr.postal_code).toBe(existingAddress.postal_code)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should preserve existing bank detail sub-fields when extracted has partial bank data", () => {
    fc.assert(
      fc.property(
        fc.record({
          bankName: nonEmptyString,
          accountNumber: nonEmptyString,
          ifscCode: nonEmptyString,
        }),
        nonEmptyString,
        (existingBank, newBankName) => {
          const profile: ProfileData = {
            payment_methods: { bank: existingBank },
          }

          const extracted = {
            bankDetails: { bankName: newBankName },
          }

          const result = mapExtractedToDbUpdate(extracted, profile)
          const bank = (result.payment_methods as any)?.bank

          // Existing sub-fields preserved
          expect(bank.accountNumber).toBe(existingBank.accountNumber)
          expect(bank.ifscCode).toBe(existingBank.ifscCode)
          // New value applied
          expect(bank.bankName).toBe(newBankName)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 3: Tax IDs shallow merge preserves existing keys ─────────────────

describe("Property 3: Tax IDs shallow merge preserves existing keys", () => {
  it("should preserve all existing tax_ids keys when adding a new taxId", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), nonEmptyString, { minKeys: 1, maxKeys: 5 }),
        nonEmptyString,
        (existingTaxIds, newTaxIdValue) => {
          const profile: ProfileData = {
            tax_ids: existingTaxIds,
          }

          const extracted = { taxId: newTaxIdValue }

          const result = mapExtractedToDbUpdate(extracted, profile)
          const mergedTaxIds = result.tax_ids as Record<string, string>

          // All original keys preserved with original values
          for (const [key, value] of Object.entries(existingTaxIds)) {
            expect(mergedTaxIds[key]).toBe(value)
          }
          // New key added
          expect(mergedTaxIds.tax_id).toBe(newTaxIdValue)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── Property 4: Client countries deduplicated union ───────────────────────────

describe("Property 4: Client countries deduplicated union", () => {
  it("should produce exactly the set union with no duplicates and no lost elements", () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[A-Z]{2}$/), { minLength: 0, maxLength: 15 }),
        fc.array(fc.stringMatching(/^[A-Z]{2}$/), { minLength: 1, maxLength: 15 }),
        (existingCountries, newCountries) => {
          const profile: ProfileData = {
            client_countries: existingCountries,
          }

          const extracted = { clientCountries: newCountries }

          const result = mapExtractedToDbUpdate(extracted, profile)
          const merged = result.client_countries as string[]

          // Expected: set union
          const expectedSet = new Set([...existingCountries, ...newCountries])

          // No duplicates
          expect(merged.length).toBe(new Set(merged).size)
          // Exact set union
          expect(new Set(merged)).toEqual(expectedSet)
          // No lost elements from existing
          for (const c of existingCountries) {
            expect(merged).toContain(c)
          }
          // No lost elements from new
          for (const c of newCountries) {
            expect(merged).toContain(c)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
