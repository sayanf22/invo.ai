/**
 * Property-Based Tests for Compliance RAG Module
 *
 * Feature: compliance-rag-implementation
 * Uses: vitest + fast-check
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { normalizeCountry, normalizeDocumentType, filterByEffectiveDate, formatComplianceContext, COUNTRY_MAP, CATEGORY_PRIORITY } from "@/lib/compliance-rag"
import type { ComplianceRule } from "@/lib/compliance-rag"

// ── Helpers ────────────────────────────────────────────────────────────

/** All keys in COUNTRY_MAP (already uppercased) */
const SUPPORTED_KEYS = Object.keys(COUNTRY_MAP)

/** All canonical country values in COUNTRY_MAP */
const CANONICAL_VALUES = [...new Set(Object.values(COUNTRY_MAP))]

/**
 * Arbitrary that picks a random supported key and applies a random
 * case transformation to each character.
 */
const supportedCountryArb = fc
  .constantFrom(...SUPPORTED_KEYS)
  .chain((key) =>
    fc.array(fc.boolean(), { minLength: key.length, maxLength: key.length }).map(
      (flags) =>
        key
          .split("")
          .map((ch, i) => (flags[i] ? ch.toLowerCase() : ch.toUpperCase()))
          .join("")
    )
  )

/**
 * Arbitrary that generates strings guaranteed NOT to be in COUNTRY_MAP.
 * We filter out any string whose uppercased + trimmed form matches a key.
 */
const unsupportedStringArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !SUPPORTED_KEYS.includes(s.trim().toUpperCase()))

// ── Property 3: Country normalization is consistent and case-insensitive ──

describe("Feature: compliance-rag-implementation, Property 3: Country normalization is consistent and case-insensitive", () => {
  /**
   * **Validates: Requirements 3.2, 10.2**
   *
   * For any supported country key from COUNTRY_MAP, applying random case
   * transformations should still return the same canonical value.
   */
  it("returns the same canonical name for any case variation of a supported country identifier", () => {
    fc.assert(
      fc.property(supportedCountryArb, (input) => {
        const result = normalizeCountry(input)
        const expected = COUNTRY_MAP[input.trim().toUpperCase()]
        expect(result).toBe(expected)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.2, 10.2**
   *
   * For any random string NOT in the map, normalizeCountry should return null.
   */
  it("returns null for any unsupported string", () => {
    fc.assert(
      fc.property(unsupportedStringArb, (input) => {
        const result = normalizeCountry(input)
        expect(result).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.2, 10.2**
   *
   * normalizeCountry should be idempotent — normalizing the output should
   * give the same result (or null if the canonical value isn't itself a key).
   */
  it("is idempotent — normalizing the output yields the same result", () => {
    fc.assert(
      fc.property(supportedCountryArb, (input) => {
        const first = normalizeCountry(input)
        expect(first).not.toBeNull()
        // Normalizing the canonical output should return the same canonical value
        const second = normalizeCountry(first!)
        expect(second).toBe(first)
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 4 Helpers ─────────────────────────────────────────────────

/** Valid document types used in the compliance_knowledge table */
const VALID_DOC_TYPES = ["invoice", "contract", "quotation", "proposal"] as const

/**
 * Arbitrary that picks a random valid document type and applies a random
 * case transformation to each character, producing strings like
 * "INVOICE", "iNvOiCe", "Contract", etc.
 */
const caseVariedDocTypeArb = fc
  .constantFrom(...VALID_DOC_TYPES)
  .chain((docType) =>
    fc.array(fc.boolean(), { minLength: docType.length, maxLength: docType.length }).map(
      (flags) =>
        docType
          .split("")
          .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
          .join("")
    )
  )

// ── Property 4: Document type normalization is case-insensitive ───────

describe("Feature: compliance-rag-implementation, Property 4: Document type normalization is case-insensitive", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any of the valid document types ("invoice", "contract", "quotation",
   * "proposal") in any case variation, normalizeDocumentType returns the
   * lowercase version.
   */
  it("returns the lowercase version for any case variation of a valid document type", () => {
    fc.assert(
      fc.property(caseVariedDocTypeArb, (input) => {
        const result = normalizeDocumentType(input)
        expect(result).toBe(input.toLowerCase())
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.3**
   *
   * The output of normalizeDocumentType should always be entirely lowercase,
   * regardless of the input casing.
   */
  it("output is always entirely lowercase regardless of input casing", () => {
    fc.assert(
      fc.property(caseVariedDocTypeArb, (input) => {
        const result = normalizeDocumentType(input)
        expect(result).toBe(result.toLowerCase())
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 5 Helpers ─────────────────────────────────────────────────

/** Categories used in ComplianceRule */
const CATEGORIES = ["tax_rates", "mandatory_fields", "legal_requirements", "formatting", "deadlines"] as const

/**
 * Arbitrary that generates a random ComplianceRule with a controlled
 * effective_date: past, today, future, or null.
 */
const complianceRuleArb = (effectiveDateArb: fc.Arbitrary<string | null>): fc.Arbitrary<ComplianceRule> =>
  fc.record({
    id: fc.uuid(),
    country: fc.constantFrom("India", "USA", "UK", "Germany"),
    document_type: fc.constantFrom("invoice", "contract", "quotation", "proposal"),
    category: fc.constantFrom(...CATEGORIES),
    requirement_key: fc.string({ minLength: 1, maxLength: 30 }),
    requirement_value: fc.constant({ value: true }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    effective_date: effectiveDateArb,
  }) as fc.Arbitrary<ComplianceRule>

/** Returns an ISO date string for N days from today (negative = past) */
function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

/** Arbitrary that generates a past date string (1–1000 days ago) */
const pastDateArb = fc.integer({ min: 1, max: 1000 }).map((n) => daysFromToday(-n))

/** Arbitrary that generates today's date string */
const todayDateArb = fc.constant(daysFromToday(0))

/** Arbitrary that generates a future date string (1–1000 days from now) */
const futureDateArb = fc.integer({ min: 1, max: 1000 }).map((n) => daysFromToday(n))

/** Arbitrary that generates a random effective_date: past, today, future, or null */
const mixedEffectiveDateArb = fc.oneof(
  pastDateArb,
  todayDateArb,
  futureDateArb,
  fc.constant(null as string | null)
)

// ── Property 5: Effective date filtering excludes future rules ────────

describe("Feature: compliance-rag-implementation, Property 5: Effective date filtering excludes future rules", () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * For any set of rules with varying effective_date values (past, today,
   * future, null), the filter returns only rules where effective_date is
   * null or ≤ today.
   */
  it("returns only rules where effective_date is null or ≤ today", () => {
    const rulesArb = fc.array(complianceRuleArb(mixedEffectiveDateArb), { minLength: 0, maxLength: 30 })

    fc.assert(
      fc.property(rulesArb, (rules) => {
        const result = filterByEffectiveDate(rules)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        for (const rule of result) {
          if (rule.effective_date !== null && rule.effective_date !== undefined) {
            const effectiveDate = new Date(rule.effective_date)
            effectiveDate.setHours(0, 0, 0, 0)
            expect(effectiveDate.getTime()).toBeLessThanOrEqual(today.getTime())
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.4**
   *
   * No rule with a future effective_date should appear in the output.
   */
  it("excludes every rule with a future effective_date", () => {
    const rulesArb = fc.array(complianceRuleArb(mixedEffectiveDateArb), { minLength: 1, maxLength: 30 })

    fc.assert(
      fc.property(rulesArb, (rules) => {
        const result = filterByEffectiveDate(rules)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const futureIds = new Set(
          rules
            .filter((r) => {
              if (r.effective_date === null || r.effective_date === undefined) return false
              const d = new Date(r.effective_date)
              d.setHours(0, 0, 0, 0)
              return d.getTime() > today.getTime()
            })
            .map((r) => r.id)
        )

        for (const rule of result) {
          expect(futureIds.has(rule.id)).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.4**
   *
   * All rules with null effective_date should always be included in the output.
   */
  it("always includes rules with null effective_date", () => {
    const rulesArb = fc.array(complianceRuleArb(mixedEffectiveDateArb), { minLength: 1, maxLength: 30 })

    fc.assert(
      fc.property(rulesArb, (rules) => {
        const result = filterByEffectiveDate(rules)
        const resultIds = new Set(result.map((r) => r.id))

        const nullDateRules = rules.filter((r) => r.effective_date === null)
        for (const rule of nullDateRules) {
          expect(resultIds.has(rule.id)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 6 Helpers ─────────────────────────────────────────────────

/**
 * Arbitrary that generates a ComplianceRule with short, controlled content
 * to stay well under the 2000 token limit (that's tested separately in Property 8).
 */
const smallComplianceRuleArb: fc.Arbitrary<ComplianceRule> = fc.record({
  id: fc.uuid(),
  country: fc.constantFrom("India", "USA", "UK", "Germany"),
  document_type: fc.constantFrom("invoice", "contract", "quotation", "proposal"),
  category: fc.constantFrom(...CATEGORIES),
  requirement_key: fc.string({ minLength: 1, maxLength: 20 }),
  requirement_value: fc.constant({ value: true }),
  description: fc.string({ minLength: 1, maxLength: 60 }),
  effective_date: fc.constant(null as string | null),
}) as fc.Arbitrary<ComplianceRule>

// ── Property 6: Deterministic formatting preserves all rules with structure ──

describe("Feature: compliance-rag-implementation, Property 6: Deterministic formatting preserves all rules with structure", () => {
  /**
   * **Validates: Requirements 3.5, 7.1**
   *
   * For any non-empty set of rules, the formatted output contains the
   * country and document type in the header.
   */
  it("formatted output contains the country and document type in the header", () => {
    const countryArb = fc.constantFrom("India", "USA", "UK", "Germany", "Canada", "Australia")
    const docTypeArb = fc.constantFrom("invoice", "contract", "quotation", "proposal")
    const rulesArb = fc.array(smallComplianceRuleArb, { minLength: 1, maxLength: 10 })

    fc.assert(
      fc.property(rulesArb, countryArb, docTypeArb, (rules, country, documentType) => {
        const output = formatComplianceContext(rules, country, documentType, "deterministic")
        expect(output).toContain(country)
        expect(output).toContain(documentType)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.5, 7.1**
   *
   * For any non-empty set of rules, the formatted output contains the
   * category, requirement_key, and description of every input rule.
   */
  it("formatted output contains category, requirement_key, and description of every input rule", () => {
    const rulesArb = fc.array(smallComplianceRuleArb, { minLength: 1, maxLength: 10 })

    fc.assert(
      fc.property(rulesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "deterministic")

        for (const rule of rules) {
          // Category appears as an uppercase header
          expect(output).toContain(rule.category.toUpperCase())
          // requirement_key appears in the rule line
          expect(output).toContain(rule.requirement_key)
          // description appears in the rule line (description is non-null in our arb)
          if (rule.description !== null) {
            expect(output).toContain(rule.description)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 3.5, 7.1**
   *
   * Rules are grouped by category — all rules of the same category appear
   * in a contiguous block under their category header.
   */
  it("rules are grouped by category", () => {
    const rulesArb = fc.array(smallComplianceRuleArb, { minLength: 2, maxLength: 15 })

    fc.assert(
      fc.property(rulesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "deterministic")
        const lines = output.split("\n")

        // For each category present in the rules, find all rule lines belonging
        // to that category and verify they appear between the category header
        // and the next category header (i.e., contiguous).
        const presentCategories = [...new Set(rules.map((r) => r.category))]

        for (const category of presentCategories) {
          const categoryHeader = `## ${category.toUpperCase()}`
          const headerIndex = lines.findIndex((line) => line.includes(categoryHeader))
          expect(headerIndex).toBeGreaterThanOrEqual(0)

          // Collect the requirement_keys for this category
          const categoryRuleKeys = rules
            .filter((r) => r.category === category)
            .map((r) => r.requirement_key)

          // All rule keys for this category should appear after the header
          // and before the next ## header (or end of output)
          const nextHeaderIndex = lines.findIndex(
            (line, idx) => idx > headerIndex && line.startsWith("## ")
          )
          const sectionEnd = nextHeaderIndex === -1 ? lines.length : nextHeaderIndex
          const sectionText = lines.slice(headerIndex, sectionEnd).join("\n")

          for (const key of categoryRuleKeys) {
            expect(sectionText).toContain(key)
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 7 Helpers ─────────────────────────────────────────────────

/** Regex to extract all [similarity: X.XXXX] annotations from formatted output */
const SIMILARITY_ANNOTATION_REGEX = /\[similarity:\s*([\d.]+)\]/g

/**
 * Arbitrary that generates an array of ComplianceRule objects, each with a
 * distinct similarity score. Uses integer-based scores divided by 10000 to
 * avoid floating-point precision issues with toFixed(4). All rules share
 * the same category so ordering verification is straightforward.
 */
const rulesWithDistinctSimilaritiesArb: fc.Arbitrary<ComplianceRule[]> = fc
  .tuple(
    fc.uniqueArray(fc.integer({ min: 6500, max: 10000 }), {
      minLength: 2,
      maxLength: 10,
    }),
    fc.constantFrom(...CATEGORIES),
  )
  .map(([scores, category]) =>
    scores.map((score, i) => ({
      id: `00000000-0000-1000-8000-${String(i).padStart(12, "0")}`,
      country: "India",
      document_type: "invoice",
      category,
      requirement_key: `rule_${i}`,
      requirement_value: { value: true },
      description: `Test rule number ${i}`,
      effective_date: null,
      similarity: score / 10000,
    })) as ComplianceRule[]
  )

// ── Property 7: Semantic formatting orders by descending similarity ───

describe("Feature: compliance-rag-implementation, Property 7: Semantic formatting orders by descending similarity", () => {
  /**
   * **Validates: Requirements 4.3, 7.2**
   *
   * For any set of rules with distinct similarity scores in the same category,
   * the formatted output lists rules with similarity annotations in strictly
   * descending order.
   */
  it("formatted output lists rules in strictly descending similarity order", () => {
    fc.assert(
      fc.property(rulesWithDistinctSimilaritiesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "semantic")

        // Extract all similarity scores from annotations in order of appearance
        const matches = [...output.matchAll(SIMILARITY_ANNOTATION_REGEX)]
        const extractedScores = matches.map((m) => parseFloat(m[1]))

        // We should have at least as many annotations as rules
        expect(extractedScores.length).toBeGreaterThanOrEqual(rules.length)

        // Verify strictly descending order
        for (let i = 1; i < extractedScores.length; i++) {
          expect(extractedScores[i - 1]).toBeGreaterThan(extractedScores[i])
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 4.3, 7.2**
   *
   * Each rule in semantic mode has a `[similarity: X.XXXX]` annotation
   * in the formatted output.
   */
  it("each rule in semantic mode has a similarity annotation", () => {
    fc.assert(
      fc.property(rulesWithDistinctSimilaritiesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "semantic")

        // Extract all similarity annotations
        const matches = [...output.matchAll(SIMILARITY_ANNOTATION_REGEX)]
        const extractedScores = matches.map((m) => parseFloat(m[1]))

        // Every rule's similarity score should appear as an annotation
        for (const rule of rules) {
          expect(rule.similarity).toBeDefined()
          const scoreStr = rule.similarity!.toFixed(4)
          expect(output).toContain(`[similarity: ${scoreStr}]`)
        }

        // The number of annotations should equal the number of rules
        expect(extractedScores.length).toBe(rules.length)
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 8 Helpers ─────────────────────────────────────────────────

/** Maximum token limit as defined in the design (char count / 4) */
const MAX_TOKEN_LIMIT = 2_000
const CHARS_PER_TOKEN = 4

/**
 * Arbitrary that generates a ComplianceRule with longer descriptions
 * to stress the token limit. Descriptions range from 50–200 chars to
 * simulate realistic compliance rule text.
 */
const largeComplianceRuleArb: fc.Arbitrary<ComplianceRule> = fc.record({
  id: fc.uuid(),
  country: fc.constantFrom("India", "USA", "UK", "Germany"),
  document_type: fc.constantFrom("invoice", "contract", "quotation", "proposal"),
  category: fc.constantFrom(...CATEGORIES),
  requirement_key: fc.stringMatching(/^[a-z_]{3,25}$/),
  requirement_value: fc.constant({ value: true }),
  description: fc.string({ minLength: 50, maxLength: 200 }),
  effective_date: fc.constant(null as string | null),
}) as fc.Arbitrary<ComplianceRule>

/**
 * Arbitrary that generates a ComplianceRule with a similarity score,
 * for testing semantic mode token limits.
 */
const largeSemanticRuleArb: fc.Arbitrary<ComplianceRule> = fc.record({
  id: fc.uuid(),
  country: fc.constantFrom("India", "USA", "UK", "Germany"),
  document_type: fc.constantFrom("invoice", "contract", "quotation", "proposal"),
  category: fc.constantFrom(...CATEGORIES),
  requirement_key: fc.stringMatching(/^[a-z_]{3,25}$/),
  requirement_value: fc.constant({ value: true }),
  description: fc.string({ minLength: 50, maxLength: 200 }),
  effective_date: fc.constant(null as string | null),
  similarity: fc.double({ min: 0.65, max: 1.0, noNaN: true }),
}) as fc.Arbitrary<ComplianceRule>

// ── Property 8: Formatted context respects token limit ────────────────

describe("Feature: compliance-rag-implementation, Property 8: Formatted context respects token limit", () => {
  /**
   * **Validates: Requirements 7.3**
   *
   * For any set of rules (small and large, up to 60 rules), the formatted
   * output in deterministic mode does not exceed 2,000 tokens (char count / 4).
   */
  it("deterministic mode output does not exceed 2,000 tokens for any rule set (1-60 rules)", () => {
    const rulesArb = fc.array(largeComplianceRuleArb, { minLength: 1, maxLength: 60 })
    const countryArb = fc.constantFrom("India", "USA", "UK", "Germany")
    const docTypeArb = fc.constantFrom("invoice", "contract", "quotation", "proposal")

    fc.assert(
      fc.property(rulesArb, countryArb, docTypeArb, (rules, country, documentType) => {
        const output = formatComplianceContext(rules, country, documentType, "deterministic")
        const tokenCount = output.length / CHARS_PER_TOKEN
        expect(tokenCount).toBeLessThanOrEqual(MAX_TOKEN_LIMIT)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.3**
   *
   * For any set of rules (small and large, up to 60 rules) with similarity
   * scores, the formatted output in semantic mode does not exceed 2,000 tokens.
   */
  it("semantic mode output does not exceed 2,000 tokens for any rule set (1-60 rules)", () => {
    const rulesArb = fc.array(largeSemanticRuleArb, { minLength: 1, maxLength: 60 })
    const countryArb = fc.constantFrom("India", "USA", "UK", "Germany")
    const docTypeArb = fc.constantFrom("invoice", "contract", "quotation", "proposal")

    fc.assert(
      fc.property(rulesArb, countryArb, docTypeArb, (rules, country, documentType) => {
        const output = formatComplianceContext(rules, country, documentType, "semantic")
        const tokenCount = output.length / CHARS_PER_TOKEN
        expect(tokenCount).toBeLessThanOrEqual(MAX_TOKEN_LIMIT)
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 9 Helpers ─────────────────────────────────────────────────

/** All five categories used in compliance rules */
const ALL_CATEGORIES = ["tax_rates", "mandatory_fields", "legal_requirements", "formatting", "deadlines"] as const

/** High-priority categories that must be preserved during truncation */
const HIGH_PRIORITY_CATEGORIES = ["tax_rates", "mandatory_fields", "legal_requirements"] as const

/**
 * Arbitrary that generates a ComplianceRule with a long description
 * for a specific category. Descriptions are 150–300 chars to ensure
 * that a set of 50+ rules across all categories will exceed the
 * 2,000 token limit (8,000 characters).
 */
const longRuleForCategoryArb = (category: typeof ALL_CATEGORIES[number]): fc.Arbitrary<ComplianceRule> =>
  fc.record({
    id: fc.uuid(),
    country: fc.constant("India"),
    document_type: fc.constant("invoice"),
    category: fc.constant(category),
    requirement_key: fc.stringMatching(/^[a-z_]{5,20}$/),
    requirement_value: fc.constant({ value: true }),
    description: fc.string({ minLength: 150, maxLength: 300 }),
    effective_date: fc.constant(null as string | null),
  }) as fc.Arbitrary<ComplianceRule>

/**
 * Arbitrary that generates a set of rules guaranteed to exceed the
 * 2,000 token limit. Produces 10–15 rules per category across all 5
 * categories, totaling 50–75 rules with long descriptions.
 */
const overflowingRulesArb: fc.Arbitrary<ComplianceRule[]> = fc
  .tuple(
    fc.array(longRuleForCategoryArb("tax_rates"), { minLength: 10, maxLength: 15 }),
    fc.array(longRuleForCategoryArb("mandatory_fields"), { minLength: 10, maxLength: 15 }),
    fc.array(longRuleForCategoryArb("legal_requirements"), { minLength: 10, maxLength: 15 }),
    fc.array(longRuleForCategoryArb("formatting"), { minLength: 10, maxLength: 15 }),
    fc.array(longRuleForCategoryArb("deadlines"), { minLength: 10, maxLength: 15 }),
  )
  .map(([taxRates, mandatoryFields, legalReqs, formatting, deadlines]) => [
    ...taxRates,
    ...mandatoryFields,
    ...legalReqs,
    ...formatting,
    ...deadlines,
  ])

// ── Property 9: Truncation preserves high-priority categories ─────────

describe("Feature: compliance-rag-implementation, Property 9: Truncation preserves high-priority categories", () => {
  /**
   * **Validates: Requirements 7.4**
   *
   * For any set of rules that exceeds the 2,000 token limit, the truncated
   * output always contains `tax_rates`, `mandatory_fields`, and
   * `legal_requirements` categories (if they were present in the input).
   */
  it("truncated output always contains high-priority categories (tax_rates, mandatory_fields, legal_requirements)", () => {
    fc.assert(
      fc.property(overflowingRulesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "deterministic")

        // Verify the output was actually produced
        expect(output.length).toBeGreaterThan(0)

        // All three high-priority category headers must be present
        for (const category of HIGH_PRIORITY_CATEGORIES) {
          expect(output).toContain(`## ${category.toUpperCase()}`)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 7.4**
   *
   * If truncation occurs, `deadlines` is removed before `formatting`.
   * That is, if `formatting` is absent from the output, then `deadlines`
   * must also be absent. Equivalently, if `deadlines` is present, then
   * `formatting` must also be present.
   */
  it("removes deadlines before formatting when truncation occurs", () => {
    fc.assert(
      fc.property(overflowingRulesArb, (rules) => {
        const output = formatComplianceContext(rules, "India", "invoice", "deterministic")

        const hasDeadlines = output.includes(`## ${("deadlines").toUpperCase()}`)
        const hasFormatting = output.includes(`## ${("formatting").toUpperCase()}`)

        // If deadlines is present, formatting must also be present
        // (deadlines is lower priority, so it gets removed first)
        if (hasDeadlines) {
          expect(hasFormatting).toBe(true)
        }

        // Equivalently: if formatting is absent, deadlines must also be absent
        if (!hasFormatting) {
          expect(hasDeadlines).toBe(false)
        }
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 1 Helpers ─────────────────────────────────────────────────

import { buildEmbeddingText } from "@/scripts/embed-compliance-rules"

/**
 * Arbitrary that generates a compliance row with non-null string fields
 * for country, document_type, category, requirement_key, and description.
 * Uses alphanumeric strings with spaces to simulate realistic field values.
 */
const embeddingRowArb = fc.record({
  id: fc.uuid(),
  country: fc.stringMatching(/^[A-Za-z ]{2,30}$/),
  document_type: fc.stringMatching(/^[a-z_]{3,20}$/),
  category: fc.stringMatching(/^[a-z_]{3,25}$/),
  requirement_key: fc.stringMatching(/^[a-z_]{3,30}$/),
  description: fc.string({ minLength: 1, maxLength: 200 }),
})

// ── Property 1: Embedding text representation contains all source fields ──

describe("Feature: compliance-rag-implementation, Property 1: Embedding text representation contains all source fields", () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any rule with non-null country, document_type, category,
   * requirement_key, and description, the text representation produced
   * by buildEmbeddingText contains all five field values as substrings.
   */
  it("text representation contains all five field values as substrings", () => {
    fc.assert(
      fc.property(embeddingRowArb, (row) => {
        const text = buildEmbeddingText(row)

        expect(text).toContain(row.country)
        expect(text).toContain(row.document_type)
        expect(text).toContain(row.category)
        expect(text).toContain(row.requirement_key)
        expect(text).toContain(row.description)
      }),
      { numRuns: 100 }
    )
  })
})


// ── Property 2 Helpers ─────────────────────────────────────────────────

import { batchArray } from "@/scripts/embed-compliance-rules"

// ── Property 2: Batching produces complete, bounded partitions ─────────

describe("Feature: compliance-rag-implementation, Property 2: Batching produces complete, bounded partitions", () => {
  /**
   * **Validates: Requirements 2.5**
   *
   * For any array of N items, batching into groups of 100 produces
   * `ceil(N/100)` batches.
   */
  it("produces ceil(N/100) batches for any array of N items", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),
        (items) => {
          const batches = batchArray(items, 100)
          const expectedCount = items.length === 0 ? 0 : Math.ceil(items.length / 100)
          expect(batches.length).toBe(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.5**
   *
   * Each batch has at most 100 items.
   */
  it("each batch has at most 100 items", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),
        (items) => {
          const batches = batchArray(items, 100)
          for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(100)
            expect(batch.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Validates: Requirements 2.5**
   *
   * Concatenation of all batches equals the original array,
   * preserving order and completeness.
   */
  it("concatenation of all batches equals the original array", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 500 }),
        (items) => {
          const batches = batchArray(items, 100)
          const concatenated = batches.flat()
          expect(concatenated).toEqual(items)
        }
      ),
      { numRuns: 100 }
    )
  })
})
