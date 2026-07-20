/**
 * Property-based tests for the document type registry.
 *
 * This file covers Property 9: Document linking parent validation.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  ALL_DOCUMENT_TYPES,
  getDocumentTypeConfig,
  type DocumentType,
} from "@/lib/document-type-registry"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Arbitrary that picks any canonical DocumentType. */
const anyDocumentType = fc.constantFrom(...ALL_DOCUMENT_TYPES)

/**
 * Known valid-parent relationships sourced from the registry design.
 *
 * Flexible linking: every document type can be created as a follow-up to any
 * other document type, so every entry is empty (no restriction).
 */
const EXPECTED_VALID_PARENTS: Record<DocumentType, DocumentType[]> = {
  invoice: [],
  contract: [],
  quote: [],
  estimate: [],
  proposal: [],
  sow: [],
  change_order: [],
  nda: [],
  client_onboarding_form: [],
  payment_followup: [],
  recurring_invoice: [],
}

// ─── Property 9: Document linking parent validation ───────────────────────────

describe("Property 9: Document linking parent validation", () => {
  /**
   * For any child/parent type pair from ALL_DOCUMENT_TYPES,
   * a parent is allowed iff it appears in validParentTypes for that child.
   *
   * **Validates: Requirements 7.1, 7.2, 7.3**
   */
  it("linking is allowed iff parent is in validParentTypes for that child", () => {
    fc.assert(
      fc.property(anyDocumentType, anyDocumentType, (childType, parentType) => {
        const config = getDocumentTypeConfig(childType)
        expect(config).not.toBeNull()

        const validParents = config!.validParentTypes
        const isAllowed = validParents.includes(parentType)
        const expectedParents = EXPECTED_VALID_PARENTS[childType]
        const expectedAllowed = expectedParents.includes(parentType)

        expect(isAllowed).toBe(expectedAllowed)
      }),
      { numRuns: 500 }
    )
  })

  /**
   * For any child type, validParentTypes contains only valid DocumentType values.
   *
   * **Validates: Requirements 7.1**
   */
  it("validParentTypes contains only values from ALL_DOCUMENT_TYPES", () => {
    fc.assert(
      fc.property(anyDocumentType, (childType) => {
        const config = getDocumentTypeConfig(childType)
        expect(config).not.toBeNull()

        for (const parent of config!.validParentTypes) {
          expect(ALL_DOCUMENT_TYPES as readonly string[]).toContain(parent)
        }
      })
    )
  })

  // ─── Specific relationship assertions ────────────────────────────────────────
  // Flexible linking: every document type has an empty validParentTypes, so
  // every type can be linked as a follow-up to every other type without
  // restriction.

  it.each(ALL_DOCUMENT_TYPES)(
    "%s has an empty validParentTypes (flexible linking — no restriction)",
    (docType) => {
      const config = getDocumentTypeConfig(docType)
      expect(config).not.toBeNull()
      expect(config!.validParentTypes).toEqual([])
    }
  )
})

// ─── Property 8: Signature capability correctness ────────────────────────────

/**
 * Property 8: Signature capability correctness
 *
 * For any type in ALL_DOCUMENT_TYPES, `supports_signature` is true iff the type
 * is in {"contract", "nda", "sow", "change_order"}.
 *
 * **Validates: Requirements 6.1, 6.5**
 */

const SIGNATURE_SUPPORTED_TYPES = new Set<DocumentType>([
  "contract",
  "nda",
  "sow",
  "change_order",
  "quote",
  "proposal",
  "estimate",
])

describe("Property 8: Signature capability correctness", () => {
  /**
   * Property-based: for any type in ALL_DOCUMENT_TYPES,
   * supports_signature must be true iff type ∈ {contract, nda, sow, change_order, quote, proposal, estimate}.
   */
  it("supports_signature is true iff type is in {contract, nda, sow, change_order, quote, proposal, estimate}", () => {
    fc.assert(
      fc.property(anyDocumentType, (docType) => {
        const config = getDocumentTypeConfig(docType)
        expect(config).not.toBeNull()

        const supportsSignature = config!.capabilities.supports_signature
        const shouldSupport = SIGNATURE_SUPPORTED_TYPES.has(docType)

        expect(supportsSignature).toBe(shouldSupport)
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Explicit assertion: types that MUST have supports_signature = true.
   */
  it.each([
    "contract",
    "nda",
    "sow",
    "change_order",
    "quote",
    "proposal",
    "estimate",
  ] as DocumentType[])(
    "%s has supports_signature = true",
    (docType) => {
      const config = getDocumentTypeConfig(docType)
      expect(config).not.toBeNull()
      expect(config!.capabilities.supports_signature).toBe(true)
    }
  )

  /**
   * Explicit assertion: types that MUST have supports_signature = false.
   */
  it.each([
    "invoice",
    "client_onboarding_form",
    "payment_followup",
    "recurring_invoice",
  ] as DocumentType[])(
    "%s has supports_signature = false",
    (docType) => {
      const config = getDocumentTypeConfig(docType)
      expect(config).not.toBeNull()
      expect(config!.capabilities.supports_signature).toBe(false)
    }
  )
})
