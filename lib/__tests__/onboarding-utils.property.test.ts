/**
 * Property-based tests for onboarding utility functions
 * Feature: onboarding-support-tracking, Property 1: Support message length validation
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { validateSupportMessage } from "@/lib/onboarding-utils"

// Feature: onboarding-support-tracking, Property 1: Support message length validation

describe("Feature: onboarding-support-tracking, Property 1: Support message length validation", () => {
  /**
   * Validates: Requirements 2.2
   *
   * For any string, validateSupportMessage SHALL accept it if and only if
   * its trimmed length is between 3 and 2000 characters inclusive.
   * Strings outside this range (including whitespace-only strings shorter
   * than 3 characters) SHALL be rejected.
   */

  it("accepts any string whose trimmed length is between 3 and 2000 inclusive", () => {
    // Generate non-whitespace core strings of valid length, optionally padded with spaces
    const validMessageArb = fc
      .integer({ min: 3, max: 2000 })
      .chain((len) =>
        fc.tuple(
          fc.stringMatching(new RegExp(`^\\S{${len}}$`)),
          fc.stringMatching(/^ {0,10}$/),
          fc.stringMatching(/^ {0,10}$/)
        )
      )
      .map(([core, leading, trailing]) => leading + core + trailing)

    fc.assert(
      fc.property(validMessageArb, (message) => {
        expect(validateSupportMessage(message)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it("rejects any string whose trimmed length is less than 3", () => {
    const shortStringArb = fc.oneof(
      // Empty string
      fc.constant(""),
      // Whitespace-only strings
      fc.stringMatching(/^ {0,20}$/),
      // 1 non-whitespace char with optional whitespace padding
      fc.tuple(
        fc.stringMatching(/^\S$/),
        fc.stringMatching(/^ {0,10}$/)
      ).map(([c, pad]) => pad + c + pad),
      // 2 non-whitespace chars with optional whitespace padding
      fc.tuple(
        fc.stringMatching(/^\S{2}$/),
        fc.stringMatching(/^ {0,10}$/)
      ).map(([core, pad]) => pad + core + pad)
    )

    fc.assert(
      fc.property(shortStringArb, (message) => {
        expect(validateSupportMessage(message)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("rejects any string whose trimmed length exceeds 2000", () => {
    const longMessageArb = fc
      .integer({ min: 2001, max: 2500 })
      .chain((len) =>
        fc.tuple(
          fc.stringMatching(new RegExp(`^\\S{${len}}$`)),
          fc.stringMatching(/^ {0,10}$/),
          fc.stringMatching(/^ {0,10}$/)
        )
      )
      .map(([core, leading, trailing]) => leading + core + trailing)

    fc.assert(
      fc.property(longMessageArb, (message) => {
        expect(validateSupportMessage(message)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  it("for any arbitrary string, result matches trimmed length being in [3, 2000]", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 3000 }), (message) => {
        const trimmedLength = message.trim().length
        const expected = trimmedLength >= 3 && trimmedLength <= 2000
        expect(validateSupportMessage(message)).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })

  it("whitespace-only strings are always rejected", () => {
    const whitespaceArb = fc.oneof(
      fc.stringMatching(/^ {0,50}$/),
      fc.stringMatching(/^\t{0,20}$/),
      fc.array(fc.oneof(fc.constant(" "), fc.constant("\t"), fc.constant("\n"), fc.constant("\r")), {
        minLength: 0,
        maxLength: 50,
      }).map((arr) => arr.join(""))
    )

    fc.assert(
      fc.property(whitespaceArb, (message) => {
        expect(validateSupportMessage(message)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: onboarding-support-tracking, Property 5: Onboarding status computation correctness

import { computeOnboardingStatus } from "@/lib/onboarding-utils"
import type { OnboardingProfile, OnboardingProgress } from "@/lib/onboarding-utils"

describe("Feature: onboarding-support-tracking, Property 5: Onboarding status computation correctness", () => {
  /**
   * Validates: Requirements 5.2, 5.3, 5.4
   *
   * For any user profile and onboarding progress record, computeOnboardingStatus SHALL return:
   * - "completed" if onboarding_complete is true and completed_at is set
   * - "in-progress" if onboarding is not complete and last_active_at is within 48 hours
   * - "dropped-off" if onboarding is not complete and last_active_at is more than 48 hours ago,
   *   or if no progress record exists
   */

  // --- Helpers for generating test data ---

  /** Arbitrary that produces an ISO date string within the last `maxHours` hours from now. */
  const recentDateArb = (maxHours: number) =>
    fc.integer({ min: 0, max: Math.floor(maxHours * 3600 * 1000) }).map((msAgo) =>
      new Date(Date.now() - msAgo).toISOString()
    )

  /** Arbitrary that produces an ISO date string more than `minHours` hours ago. */
  const oldDateArb = (minHours: number) =>
    fc.integer({ min: Math.ceil(minHours * 3600 * 1000) + 1, max: Math.ceil(minHours * 3600 * 1000) + 365 * 24 * 3600 * 1000 }).map((msAgo) =>
      new Date(Date.now() - msAgo).toISOString()
    )

  const phaseArb = fc.constantFrom("upload", "chat", "logo", "payments", "completed")

  it("returns 'completed' when onboarding_complete is true AND completed_at is set", () => {
    // Generate a profile with onboarding_complete=true and a progress with completed_at set
    const arb = fc.tuple(
      fc.oneof(
        recentDateArb(200),   // last_active_at can be anything
        fc.constant(null as string | null)
      ),
      recentDateArb(500),     // completed_at — any valid date
      phaseArb,
      fc.option(recentDateArb(500), { nil: undefined }) // updated_at
    )

    fc.assert(
      fc.property(arb, ([lastActiveAt, completedAt, currentPhase, updatedAt]) => {
        const profile: OnboardingProfile = {
          onboarding_complete: true,
          last_active_at: lastActiveAt,
        }
        const progress: OnboardingProgress = {
          current_phase: currentPhase,
          completed_at: completedAt,
          ...(updatedAt !== undefined ? { updated_at: updatedAt } : {}),
        }
        expect(computeOnboardingStatus(profile, progress)).toBe("completed")
      }),
      { numRuns: 100 }
    )
  })

  it("returns 'dropped-off' when progress is null (no progress record)", () => {
    const arb = fc.tuple(
      fc.boolean(), // onboarding_complete — can be anything
      fc.oneof(
        recentDateArb(200),
        fc.constant(null as string | null)
      )
    )

    fc.assert(
      fc.property(arb, ([onboardingComplete, lastActiveAt]) => {
        const profile: OnboardingProfile = {
          onboarding_complete: onboardingComplete,
          last_active_at: lastActiveAt,
        }
        expect(computeOnboardingStatus(profile, null)).toBe("dropped-off")
      }),
      { numRuns: 100 }
    )
  })

  it("returns 'dropped-off' when last_active_at is more than 48 hours ago", () => {
    // Generate profiles that are NOT completed (onboarding_complete=false OR completed_at=null)
    // and where last_active_at is > 48 hours ago
    const arb = fc.tuple(
      oldDateArb(48),  // last_active_at > 48 hours ago
      phaseArb,
      fc.option(recentDateArb(500), { nil: undefined }) // updated_at
    )

    fc.assert(
      fc.property(arb, ([lastActiveAt, currentPhase, updatedAt]) => {
        const profile: OnboardingProfile = {
          onboarding_complete: false,
          last_active_at: lastActiveAt,
        }
        const progress: OnboardingProgress = {
          current_phase: currentPhase,
          completed_at: null,
          ...(updatedAt !== undefined ? { updated_at: updatedAt } : {}),
        }
        expect(computeOnboardingStatus(profile, progress)).toBe("dropped-off")
      }),
      { numRuns: 100 }
    )
  })

  it("returns 'in-progress' when last_active_at is within 48 hours and not completed", () => {
    // Ensure last_active_at is well within 48 hours (use max 47 hours to avoid boundary flakiness)
    const arb = fc.tuple(
      recentDateArb(47),  // last_active_at within 47 hours (safe margin)
      phaseArb,
      fc.option(recentDateArb(500), { nil: undefined }) // updated_at
    )

    fc.assert(
      fc.property(arb, ([lastActiveAt, currentPhase, updatedAt]) => {
        const profile: OnboardingProfile = {
          onboarding_complete: false,
          last_active_at: lastActiveAt,
        }
        const progress: OnboardingProgress = {
          current_phase: currentPhase,
          completed_at: null,
          ...(updatedAt !== undefined ? { updated_at: updatedAt } : {}),
        }
        expect(computeOnboardingStatus(profile, progress)).toBe("in-progress")
      }),
      { numRuns: 100 }
    )
  })

  it("for any profile/progress combination, the result is always one of the three valid statuses", () => {
    const profileArb = fc.record({
      onboarding_complete: fc.boolean(),
      last_active_at: fc.oneof(
        recentDateArb(200),
        oldDateArb(48),
        fc.constant(null as string | null)
      ),
    })

    const progressArb = fc.oneof(
      fc.constant(null as OnboardingProgress | null),
      fc.record({
        current_phase: phaseArb,
        completed_at: fc.oneof(
          recentDateArb(500),
          fc.constant(null as string | null)
        ),
        updated_at: fc.oneof(
          recentDateArb(500),
          fc.constant(undefined as string | undefined)
        ),
      }).map((p) => {
        const result: OnboardingProgress = {
          current_phase: p.current_phase,
          completed_at: p.completed_at,
        }
        if (p.updated_at !== undefined) {
          result.updated_at = p.updated_at
        }
        return result
      })
    )

    fc.assert(
      fc.property(profileArb, progressArb, (profile, progress) => {
        const status = computeOnboardingStatus(profile, progress)
        expect(["completed", "in-progress", "dropped-off"]).toContain(status)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: onboarding-support-tracking, Property 6: Field completion detection accuracy

import { getFieldCompletion } from "@/lib/onboarding-utils"
import type { BusinessRecord, TrackedFieldName } from "@/lib/onboarding-utils"

describe("Feature: onboarding-support-tracking, Property 6: Field completion detection accuracy", () => {
  /**
   * Validates: Requirements 6.2, 5.1
   *
   * For any business record, getFieldCompletion SHALL correctly classify each
   * of the 12 tracked fields as completed or pending, and the total count
   * SHALL equal the number of fields classified as completed.
   */

  // --- Arbitraries for generating business record fields ---

  /** Non-empty string (at least 1 non-whitespace char). */
  const nonEmptyStringArb = fc
    .stringMatching(/^\S.{0,49}$/)

  /** Empty-ish string: empty, whitespace-only, null, or undefined. */
  const emptyStringArb = fc.oneof(
    fc.constant(null as string | null),
    fc.constant(undefined as string | undefined),
    fc.constant(""),
    fc.constant("   "),
    fc.constant("\t\n")
  )

  /** JSONB object with at least one non-empty string value. */
  const nonEmptyJsonValueArb = fc
    .dictionary(
      fc.stringMatching(/^[a-z]{1,10}$/),
      nonEmptyStringArb,
      { minKeys: 1, maxKeys: 5 }
    )

  /** JSONB object with at least one key (values can be anything). */
  const jsonWithKeysArb = fc
    .dictionary(
      fc.stringMatching(/^[a-z]{1,10}$/),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null)
      ),
      { minKeys: 1, maxKeys: 5 }
    )

  /** Empty-ish JSONB: null, undefined, empty object, or array. */
  const emptyJsonArb = fc.oneof(
    fc.constant(null as null),
    fc.constant(undefined as undefined),
    fc.constant({}),
    fc.constant([])
  )

  /** JSONB object with only empty/whitespace string values (has keys but no non-empty string values). */
  const jsonWithOnlyEmptyValuesArb = fc
    .dictionary(
      fc.stringMatching(/^[a-z]{1,10}$/),
      fc.oneof(fc.constant(""), fc.constant("  "), fc.constant(null)),
      { minKeys: 1, maxKeys: 5 }
    )

  /** Non-empty array of strings. */
  const nonEmptyArrayArb = fc.array(fc.string({ minLength: 1 }), {
    minLength: 1,
    maxLength: 10,
  })

  /** Empty-ish array: null, undefined, or empty array. */
  const emptyArrayArb = fc.oneof(
    fc.constant(null as string[] | null),
    fc.constant(undefined as string[] | undefined),
    fc.constant([] as string[])
  )

  // --- Helper: reference implementation for individual field checks ---

  function isNonEmptyString(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0
  }

  function hasNonEmptyJsonValue(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value !== "object" || Array.isArray(value)) return false
    const obj = value as Record<string, unknown>
    return Object.values(obj).some(
      (v) => typeof v === "string" && v.trim().length > 0
    )
  }

  function hasAtLeastOneKey(value: unknown): boolean {
    if (value === null || value === undefined) return false
    if (typeof value !== "object" || Array.isArray(value)) return false
    return Object.keys(value as Record<string, unknown>).length > 0
  }

  function isNonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0
  }

  // --- Arbitrary for a fully random business record ---

  const randomBusinessRecordArb: fc.Arbitrary<BusinessRecord> = fc.record({
    business_type: fc.oneof(nonEmptyStringArb, emptyStringArb),
    country: fc.oneof(nonEmptyStringArb, emptyStringArb),
    name: fc.oneof(nonEmptyStringArb, emptyStringArb),
    owner_name: fc.oneof(nonEmptyStringArb, emptyStringArb),
    email: fc.oneof(nonEmptyStringArb, emptyStringArb),
    phone: fc.oneof(nonEmptyStringArb, emptyStringArb),
    address: fc.oneof(nonEmptyJsonValueArb, jsonWithOnlyEmptyValuesArb, emptyJsonArb) as fc.Arbitrary<BusinessRecord["address"]>,
    tax_ids: fc.oneof(jsonWithKeysArb, emptyJsonArb) as fc.Arbitrary<BusinessRecord["tax_ids"]>,
    additional_notes: fc.oneof(nonEmptyStringArb, emptyStringArb),
    client_countries: fc.oneof(nonEmptyArrayArb, emptyArrayArb),
    default_currency: fc.oneof(nonEmptyStringArb, emptyStringArb),
    payment_methods: fc.oneof(jsonWithKeysArb, emptyJsonArb) as fc.Arbitrary<BusinessRecord["payment_methods"]>,
  })

  it("count equals the number of true values in the fields map for any random business record", () => {
    fc.assert(
      fc.property(randomBusinessRecordArb, (business) => {
        const result = getFieldCompletion(business)
        const trueCount = Object.values(result.fields).filter(Boolean).length
        expect(result.count).toBe(trueCount)
      }),
      { numRuns: 100 }
    )
  })

  it("returns count 12 when all 12 fields are populated with valid values", () => {
    const fullyPopulatedArb = fc.record({
      business_type: nonEmptyStringArb,
      country: nonEmptyStringArb,
      name: nonEmptyStringArb,
      owner_name: nonEmptyStringArb,
      email: nonEmptyStringArb,
      phone: nonEmptyStringArb,
      address: nonEmptyJsonValueArb as fc.Arbitrary<BusinessRecord["address"]>,
      tax_ids: jsonWithKeysArb as fc.Arbitrary<BusinessRecord["tax_ids"]>,
      additional_notes: nonEmptyStringArb,
      client_countries: nonEmptyArrayArb,
      default_currency: nonEmptyStringArb,
      payment_methods: jsonWithKeysArb as fc.Arbitrary<BusinessRecord["payment_methods"]>,
    })

    fc.assert(
      fc.property(fullyPopulatedArb, (business) => {
        const result = getFieldCompletion(business)
        expect(result.count).toBe(12)
        // Every field should be true
        for (const val of Object.values(result.fields)) {
          expect(val).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("returns count 0 when all fields are empty/null/undefined", () => {
    const emptyBusinessArb = fc.record({
      business_type: emptyStringArb,
      country: emptyStringArb,
      name: emptyStringArb,
      owner_name: emptyStringArb,
      email: emptyStringArb,
      phone: emptyStringArb,
      address: emptyJsonArb as fc.Arbitrary<BusinessRecord["address"]>,
      tax_ids: emptyJsonArb as fc.Arbitrary<BusinessRecord["tax_ids"]>,
      additional_notes: emptyStringArb,
      client_countries: emptyArrayArb,
      default_currency: emptyStringArb,
      payment_methods: emptyJsonArb as fc.Arbitrary<BusinessRecord["payment_methods"]>,
    })

    fc.assert(
      fc.property(emptyBusinessArb, (business) => {
        const result = getFieldCompletion(business)
        expect(result.count).toBe(0)
        // Every field should be false
        for (const val of Object.values(result.fields)) {
          expect(val).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("each individual field completion check matches the expected logic", () => {
    fc.assert(
      fc.property(randomBusinessRecordArb, (business) => {
        const result = getFieldCompletion(business)

        // String fields: completed if non-empty string after trim
        expect(result.fields.businessType).toBe(isNonEmptyString(business.business_type))
        expect(result.fields.country).toBe(isNonEmptyString(business.country))
        expect(result.fields.businessName).toBe(isNonEmptyString(business.name))
        expect(result.fields.ownerName).toBe(isNonEmptyString(business.owner_name))
        expect(result.fields.email).toBe(isNonEmptyString(business.email))
        expect(result.fields.phone).toBe(isNonEmptyString(business.phone))
        expect(result.fields.services).toBe(isNonEmptyString(business.additional_notes))
        expect(result.fields.defaultCurrency).toBe(isNonEmptyString(business.default_currency))

        // address: JSONB with at least one non-empty string value
        expect(result.fields.address).toBe(hasNonEmptyJsonValue(business.address))

        // taxDetails (tax_ids): JSONB with at least one key
        expect(result.fields.taxDetails).toBe(hasAtLeastOneKey(business.tax_ids))

        // clientCountries: non-empty array
        expect(result.fields.clientCountries).toBe(isNonEmptyArray(business.client_countries))

        // bankDetails (payment_methods): JSONB with at least one key
        expect(result.fields.bankDetails).toBe(hasAtLeastOneKey(business.payment_methods))
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: onboarding-support-tracking, Property 9: Case-insensitive email search filtering

import { filterByEmailSearch } from "@/lib/onboarding-utils"
import type { EmailRecord } from "@/lib/onboarding-utils"

describe("Feature: onboarding-support-tracking, Property 9: Case-insensitive email search filtering", () => {
  /**
   * Validates: Requirements 10.4, 11.4
   *
   * For any search string and list of records with email addresses,
   * filterByEmailSearch SHALL return only records whose email contains
   * the search string as a case-insensitive substring. Records whose
   * email does not contain the search string SHALL be excluded.
   */

  // --- Arbitraries ---

  /** Generate a realistic-ish email address. */
  const emailArb = fc.tuple(
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9._%+-]{0,15}$/),
    fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,10}$/),
    fc.constantFrom(".com", ".org", ".net", ".io", ".co.uk")
  ).map(([local, domain, tld]) => `${local}@${domain}${tld}`)

  /** Generate an EmailRecord with a valid email. */
  const emailRecordArb: fc.Arbitrary<EmailRecord> = fc.record({
    email: fc.oneof(
      emailArb,
      fc.constant(null as string | null),
      fc.constant(undefined as string | undefined)
    ),
  })

  /** Generate a list of EmailRecords. */
  const emailRecordListArb = fc.array(emailRecordArb, { minLength: 0, maxLength: 30 })

  /** Generate a non-empty search string (1-10 alphanumeric chars). */
  const searchStringArb = fc.stringMatching(/^[a-zA-Z0-9@._-]{1,10}$/)

  // --- Reference implementation for verification ---

  function referenceFilter(records: EmailRecord[], search: string): EmailRecord[] {
    if (!search || search.trim().length === 0) return records
    const lowerSearch = search.toLowerCase()
    return records.filter((r) => {
      if (!r.email) return false
      return r.email.toLowerCase().includes(lowerSearch)
    })
  }

  // --- Property tests ---

  it("every record in the result has an email containing the search string (case-insensitive)", () => {
    fc.assert(
      fc.property(emailRecordListArb, searchStringArb, (records, search) => {
        const result = filterByEmailSearch(records, search)
        const lowerSearch = search.toLowerCase()
        for (const record of result) {
          expect(record.email).toBeDefined()
          expect(record.email).not.toBeNull()
          expect(record.email!.toLowerCase()).toContain(lowerSearch)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("no record excluded from the result has an email containing the search string (case-insensitive)", () => {
    fc.assert(
      fc.property(emailRecordListArb, searchStringArb, (records, search) => {
        const result = filterByEmailSearch(records, search)
        const resultSet = new Set(result)
        const lowerSearch = search.toLowerCase()
        for (const record of records) {
          if (!resultSet.has(record)) {
            // Excluded record: either has no email, or email doesn't contain search
            if (record.email) {
              expect(record.email.toLowerCase()).not.toContain(lowerSearch)
            }
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it("empty search returns all records unchanged", () => {
    const emptySearchArb = fc.oneof(
      fc.constant(""),
      fc.constant("   "),
      fc.constant("\t"),
      fc.constant("  \n  ")
    )

    fc.assert(
      fc.property(emailRecordListArb, emptySearchArb, (records, search) => {
        const result = filterByEmailSearch(records, search)
        expect(result).toEqual(records)
        expect(result.length).toBe(records.length)
      }),
      { numRuns: 100 }
    )
  })

  it("search is case-insensitive (searching upper matches lower and vice versa)", () => {
    // Generate records with known emails and search with different casing
    const arb = fc.tuple(
      emailArb,
      fc.boolean() // whether to uppercase the search
    )

    fc.assert(
      fc.property(arb, ([email, toUpper]) => {
        // Pick a substring from the email to search for
        const start = 0
        const end = Math.min(email.length, 5)
        const substring = email.substring(start, end)
        const search = toUpper ? substring.toUpperCase() : substring.toLowerCase()

        const records: EmailRecord[] = [{ email }]
        const result = filterByEmailSearch(records, search)

        // The record should always be found regardless of case
        expect(result.length).toBe(1)
        expect(result[0].email).toBe(email)
      }),
      { numRuns: 100 }
    )
  })

  it("result matches reference implementation for any records and search", () => {
    fc.assert(
      fc.property(emailRecordListArb, fc.oneof(searchStringArb, fc.constant(""), fc.constant("  ")), (records, search) => {
        const actual = filterByEmailSearch(records, search)
        const expected = referenceFilter(records, search)
        expect(actual).toEqual(expected)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: onboarding-support-tracking, Property 10: Combined filters use AND logic

import { applyOnboardingFilters } from "@/lib/onboarding-utils"
import type { OnboardingRecord, OnboardingFilters } from "@/lib/onboarding-utils"

describe("Feature: onboarding-support-tracking, Property 10: Combined filters use AND logic", () => {
  /**
   * Validates: Requirements 10.5
   *
   * For any combination of active filters (status, phase, error presence, search)
   * applied to the onboarding tracking list, every record in the result set SHALL
   * satisfy ALL active filter conditions simultaneously. No record that fails any
   * single filter condition SHALL appear in the results.
   */

  // --- Arbitraries ---

  const statusValues = ["completed", "in-progress", "dropped-off"] as const
  const phaseValues = ["upload", "chat", "logo", "payments"] as const

  /** Generate a random OnboardingRecord. */
  const onboardingRecordArb: fc.Arbitrary<OnboardingRecord> = fc.record({
    email: fc.oneof(
      fc.tuple(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,8}$/),
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,6}$/),
        fc.constantFrom(".com", ".org", ".net", ".io")
      ).map(([local, domain, tld]) => `${local}@${domain}${tld}`),
      fc.constant(null as string | null)
    ),
    onboarding_status: fc.constantFrom(...statusValues),
    current_phase: fc.oneof(
      fc.constantFrom(...phaseValues),
      fc.constant(null as string | null)
    ),
    has_errors: fc.boolean(),
  })

  /** Generate a list of OnboardingRecords. */
  const recordListArb = fc.array(onboardingRecordArb, { minLength: 0, maxLength: 30 })

  /** Generate a random OnboardingFilters object with a mix of active and inactive filters. */
  const filtersArb: fc.Arbitrary<OnboardingFilters> = fc.record({
    status: fc.oneof(
      fc.constant("all"),
      fc.constantFrom(...statusValues)
    ),
    phase: fc.oneof(
      fc.constant("all"),
      fc.constantFrom(...phaseValues)
    ),
    errors: fc.oneof(
      fc.constant("all"),
      fc.constant("with-errors"),
      fc.constant("without-errors")
    ),
    search: fc.oneof(
      fc.constant(""),
      fc.constant("   "),
      fc.stringMatching(/^[a-zA-Z0-9@._-]{1,8}$/)
    ),
  })

  // --- Reference helpers to check individual filter conditions ---

  function matchesStatus(record: OnboardingRecord, filters: OnboardingFilters): boolean {
    if (!filters.status || filters.status === "all") return true
    return record.onboarding_status === filters.status
  }

  function matchesPhase(record: OnboardingRecord, filters: OnboardingFilters): boolean {
    if (!filters.phase || filters.phase === "all") return true
    return record.current_phase?.toLowerCase() === filters.phase.toLowerCase()
  }

  function matchesErrors(record: OnboardingRecord, filters: OnboardingFilters): boolean {
    if (!filters.errors || filters.errors === "all") return true
    if (filters.errors === "with-errors") return record.has_errors === true
    if (filters.errors === "without-errors") return record.has_errors !== true
    return true
  }

  function matchesSearch(record: OnboardingRecord, filters: OnboardingFilters): boolean {
    if (!filters.search || filters.search.trim().length === 0) return true
    if (!record.email) return false
    return record.email.toLowerCase().includes(filters.search.toLowerCase())
  }

  function matchesAllFilters(record: OnboardingRecord, filters: OnboardingFilters): boolean {
    return (
      matchesStatus(record, filters) &&
      matchesPhase(record, filters) &&
      matchesErrors(record, filters) &&
      matchesSearch(record, filters)
    )
  }

  // --- Property tests ---

  it("every record in the result satisfies ALL active filter conditions", () => {
    fc.assert(
      fc.property(recordListArb, filtersArb, (records, filters) => {
        const result = applyOnboardingFilters(records, filters)
        for (const record of result) {
          expect(matchesStatus(record, filters)).toBe(true)
          expect(matchesPhase(record, filters)).toBe(true)
          expect(matchesErrors(record, filters)).toBe(true)
          expect(matchesSearch(record, filters)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("no record excluded from the result satisfies all active filter conditions", () => {
    fc.assert(
      fc.property(recordListArb, filtersArb, (records, filters) => {
        const result = applyOnboardingFilters(records, filters)
        const resultSet = new Set(result)
        for (const record of records) {
          if (!resultSet.has(record)) {
            // Excluded record must fail at least one filter condition
            expect(matchesAllFilters(record, filters)).toBe(false)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it("when all filters are 'all' or empty, all records are returned", () => {
    const passAllFiltersArb: fc.Arbitrary<OnboardingFilters> = fc.constantFrom(
      { status: "all", phase: "all", errors: "all", search: "" },
      { status: "all", phase: "all", errors: "all", search: "   " },
      { status: undefined, phase: undefined, errors: undefined, search: undefined },
      { status: "all", phase: "all", errors: "all", search: undefined },
    ) as fc.Arbitrary<OnboardingFilters>

    fc.assert(
      fc.property(recordListArb, passAllFiltersArb, (records, filters) => {
        const result = applyOnboardingFilters(records, filters)
        expect(result.length).toBe(records.length)
        expect(result).toEqual(records)
      }),
      { numRuns: 100 }
    )
  })

  it("adding more filters never increases the result set size", () => {
    // Start with one filter, then add a NEW constraint on a previously-inactive
    // dimension — result should shrink or stay the same.
    // We use .chain() so the additional filter only activates dimensions that
    // were "all"/empty in the base filter, avoiding value-replacement which
    // can widen results.
    const singleFilterArb = fc.oneof(
      fc.record({
        status: fc.constantFrom(...statusValues),
        phase: fc.constant("all" as string),
        errors: fc.constant("all" as string),
        search: fc.constant("" as string),
      }),
      fc.record({
        status: fc.constant("all" as string),
        phase: fc.constantFrom(...phaseValues),
        errors: fc.constant("all" as string),
        search: fc.constant("" as string),
      }),
      fc.record({
        status: fc.constant("all" as string),
        phase: fc.constant("all" as string),
        errors: fc.constantFrom("with-errors", "without-errors"),
        search: fc.constant("" as string),
      }),
      fc.record({
        status: fc.constant("all" as string),
        phase: fc.constant("all" as string),
        errors: fc.constant("all" as string),
        search: fc.stringMatching(/^[a-zA-Z0-9@._-]{1,6}$/),
      })
    )

    fc.assert(
      fc.property(recordListArb, singleFilterArb, (records, baseFilter) => {
        const baseResult = applyOnboardingFilters(records, baseFilter)

        // Build a combined filter that only adds NEW constraints on dimensions
        // that are currently inactive ("all" or empty) in the base filter.
        const combinedFilter: OnboardingFilters = { ...baseFilter }
        if (baseFilter.status === "all") {
          combinedFilter.status = statusValues[0] // add a status constraint
        }
        if (baseFilter.phase === "all") {
          combinedFilter.phase = phaseValues[0] // add a phase constraint
        }
        if (baseFilter.errors === "all") {
          combinedFilter.errors = "with-errors" // add an errors constraint
        }
        if (!baseFilter.search || baseFilter.search.trim().length === 0) {
          combinedFilter.search = "a" // add a search constraint
        }

        const combinedResult = applyOnboardingFilters(records, combinedFilter)

        // Combined (strictly more restrictive) should never return MORE results
        expect(combinedResult.length).toBeLessThanOrEqual(baseResult.length)
      }),
      { numRuns: 100 }
    )
  })
})

// Feature: onboarding-support-tracking, Property 11: Error context filtering correctness

import { filterErrorsByContext } from "@/lib/onboarding-utils"
import type { ErrorLogRecord } from "@/lib/onboarding-utils"

describe("Feature: onboarding-support-tracking, Property 11: Error context filtering correctness", () => {
  /**
   * Validates: Requirements 11.1, 11.2, 11.3
   *
   * For any list of error logs and any selected context filter, the filter SHALL
   * return only error logs matching the filter criteria:
   * - "All" returns all logs unfiltered
   * - Phase-specific filters (Upload, Chat, Logo, Payments) return only logs where
   *   error_context contains "onboarding_{phase}" (case-insensitive)
   * - "Non-Onboarding" returns only logs where error_context does NOT start with "onboarding"
   */

  // --- Arbitraries ---

  const onboardingPhases = ["Upload", "Chat", "Logo", "Payments"] as const

  /** Generate an error_context that starts with "onboarding_" followed by a phase. */
  const onboardingContextArb = fc.constantFrom(
    "onboarding_upload",
    "onboarding_chat",
    "onboarding_logo",
    "onboarding_payments",
    "onboarding_chat_ai_error",
    "Onboarding_Upload",
    "ONBOARDING_CHAT",
    "onboarding_logo_timeout",
    "onboarding_payments_stripe"
  )

  /** Generate an error_context that does NOT start with "onboarding" (case-insensitive). */
  const nonOnboardingContextArb = fc.oneof(
    fc.constantFrom(
      "auth_login",
      "api_generate",
      "document_export",
      "payment_webhook",
      "system_startup",
      "database_connection",
      "rate_limit_exceeded"
    ),
    fc.stringMatching(/^[a-z]{3,15}_[a-z]{3,15}$/).filter(
      (s) => !s.toLowerCase().startsWith("onboarding")
    )
  )

  /** Generate a random error_context (mix of onboarding and non-onboarding). */
  const anyContextArb = fc.oneof(onboardingContextArb, nonOnboardingContextArb)

  /** Generate an ErrorLogRecord with a given context arbitrary. */
  const errorLogRecordArb = (contextArb: fc.Arbitrary<string>): fc.Arbitrary<ErrorLogRecord> =>
    fc.record({
      error_context: contextArb,
      message: fc.string({ minLength: 1, maxLength: 100 }),
      user_id: fc.oneof(fc.uuid(), fc.constant(null)),
    }) as fc.Arbitrary<ErrorLogRecord>

  /** Generate a list of ErrorLogRecords with mixed contexts. */
  const errorLogListArb = fc.array(errorLogRecordArb(anyContextArb), {
    minLength: 0,
    maxLength: 30,
  })

  /** Generate a phase-specific filter value. */
  const phaseFilterArb = fc.constantFrom(...onboardingPhases)

  /** Generate any valid context filter value. */
  const anyFilterArb = fc.constantFrom("All", "Upload", "Chat", "Logo", "Payments", "Non-Onboarding")

  // --- Property tests ---

  it('"All" filter returns all logs unfiltered', () => {
    fc.assert(
      fc.property(errorLogListArb, (errors) => {
        const result = filterErrorsByContext(errors, "All")
        expect(result.length).toBe(errors.length)
        expect(result).toEqual(errors)
      }),
      { numRuns: 100 }
    )
  })

  it("phase-specific filters return only logs where error_context contains 'onboarding_{phase}'", () => {
    fc.assert(
      fc.property(errorLogListArb, phaseFilterArb, (errors, filter) => {
        const result = filterErrorsByContext(errors, filter)
        const target = `onboarding_${filter.toLowerCase()}`
        for (const record of result) {
          expect(record.error_context.toLowerCase()).toContain(target)
        }
      }),
      { numRuns: 100 }
    )
  })

  it('"Non-Onboarding" returns only logs where error_context does NOT start with "onboarding"', () => {
    fc.assert(
      fc.property(errorLogListArb, (errors) => {
        const result = filterErrorsByContext(errors, "Non-Onboarding")
        for (const record of result) {
          expect(record.error_context.toLowerCase().startsWith("onboarding")).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("phase-specific and Non-Onboarding results are disjoint (no overlap)", () => {
    fc.assert(
      fc.property(errorLogListArb, phaseFilterArb, (errors, filter) => {
        const phaseResult = filterErrorsByContext(errors, filter)
        const nonOnboardingResult = filterErrorsByContext(errors, "Non-Onboarding")

        const phaseSet = new Set(phaseResult)
        for (const record of nonOnboardingResult) {
          expect(phaseSet.has(record)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("union of all phase-specific + Non-Onboarding covers all records", () => {
    fc.assert(
      fc.property(errorLogListArb, (errors) => {
        const uploadResult = filterErrorsByContext(errors, "Upload")
        const chatResult = filterErrorsByContext(errors, "Chat")
        const logoResult = filterErrorsByContext(errors, "Logo")
        const paymentsResult = filterErrorsByContext(errors, "Payments")
        const nonOnboardingResult = filterErrorsByContext(errors, "Non-Onboarding")

        // Collect all records that appear in at least one filter result
        const covered = new Set<ErrorLogRecord>()
        for (const r of uploadResult) covered.add(r)
        for (const r of chatResult) covered.add(r)
        for (const r of logoResult) covered.add(r)
        for (const r of paymentsResult) covered.add(r)
        for (const r of nonOnboardingResult) covered.add(r)

        // Every original record should be covered by at least one filter
        for (const record of errors) {
          expect(covered.has(record)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("for any filter, no matching record is excluded from the result", () => {
    fc.assert(
      fc.property(errorLogListArb, anyFilterArb, (errors, filter) => {
        const result = filterErrorsByContext(errors, filter)
        const resultSet = new Set(result)

        for (const record of errors) {
          if (!resultSet.has(record)) {
            // Excluded record must NOT match the filter criteria
            if (filter === "All") {
              // "All" should never exclude anything
              expect(true).toBe(false) // should not reach here
            } else if (filter === "Non-Onboarding") {
              // Excluded from Non-Onboarding means it starts with "onboarding"
              expect(record.error_context.toLowerCase().startsWith("onboarding")).toBe(true)
            } else {
              // Excluded from phase filter means it doesn't contain the target
              const target = `onboarding_${filter.toLowerCase()}`
              expect(record.error_context.toLowerCase()).not.toContain(target)
            }
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})
