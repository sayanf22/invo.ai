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

/** Known valid-parent relationships sourced from the registry design. */
const EXPECTED_VALID_PARENTS: Record<DocumentType, DocumentType[]> = {
  invoice: [],
  contract: [],
  quote: [],
  proposal: [],
  sow: ["contract"],
  change_order: ["sow", "contract"],
  nda: [],
  client_onboarding_form: [],
  payment_followup: ["invoice"],
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

  it("sow has exactly ['contract'] as validParentTypes", () => {
    const config = getDocumentTypeConfig("sow")
    expect(config).not.toBeNull()
    expect(config!.validParentTypes).toEqual(["contract"])
  })

  it("change_order has exactly ['sow', 'contract'] as validParentTypes", () => {
    const config = getDocumentTypeConfig("change_order")
    expect(config).not.toBeNull()
    expect(config!.validParentTypes).toContain("sow")
    expect(config!.validParentTypes).toContain("contract")
    expect(config!.validParentTypes).toHaveLength(2)
  })

  it("payment_followup has exactly ['invoice'] as validParentTypes", () => {
    const config = getDocumentTypeConfig("payment_followup")
    expect(config).not.toBeNull()
    expect(config!.validParentTypes).toEqual(["invoice"])
  })

  it.each([
    "invoice",
    "contract",
    "quote",
    "proposal",
    "nda",
    "client_onboarding_form",
    "recurring_invoice",
  ] as DocumentType[])(
    "%s has an empty validParentTypes (no valid parent required)",
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

const SIGNATURE_SUPPORTED_TYPES = new Set<DocumentType>(["contract", "nda", "sow", "change_order"])

describe("Property 8: Signature capability correctness", () => {
  /**
   * Property-based: for any type in ALL_DOCUMENT_TYPES,
   * supports_signature must be true iff type ∈ {contract, nda, sow, change_order}.
   */
  it("supports_signature is true iff type is in {contract, nda, sow, change_order}", () => {
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
  it.each(["contract", "nda", "sow", "change_order"] as DocumentType[])(
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
    "quote",
    "proposal",
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
