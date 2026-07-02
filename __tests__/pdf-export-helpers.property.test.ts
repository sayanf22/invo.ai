import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { resolvePdfTemplateKey, resolveDocumentReference, buildPdfFilename } from "@/lib/pdf-export-helpers"
import { getInitialInvoiceData, type InvoiceData } from "@/lib/invoice-types"

/**
 * Bug condition exploration tests for F3 (wrong template + "invoice"-only
 * filenames for non-core document types) in `lib/pdf-export-helpers.ts`.
 *
 * IMPORTANT: These tests are EXPECTED TO FAIL against the current (unfixed)
 * helpers, which deliberately mirror `app/documents/page.tsx`'s CURRENT
 * incomplete switch (task 1.1). A failure here is the SUCCESS case for this
 * exploration task — it proves the F3 defect exists. Do NOT modify
 * `lib/pdf-export-helpers.ts` to make these pass; task 6 owns the fix.
 */

// The six non-core document types named in bugfix.md/design.md Family 3,
// mapped to their correct template key. "receipt" is not part of the
// canonical ALL_DOCUMENT_TYPES registry (it is a special-cased documentType
// used only by the PDF download entry points), so it is listed explicitly
// here alongside the five registry types, per design Property 4's scope.
const NON_CORE_TYPE_TO_TEMPLATE_KEY = {
  sow: "SOWPDF",
  change_order: "ChangeOrderPDF",
  nda: "NDAPDF",
  client_onboarding_form: "ClientOnboardingFormPDF",
  payment_followup: "PaymentFollowupPDF",
  receipt: "ReceiptPDF",
} as const

type NonCoreType = keyof typeof NON_CORE_TYPE_TO_TEMPLATE_KEY

const NON_CORE_TYPES = Object.keys(NON_CORE_TYPE_TO_TEMPLATE_KEY) as NonCoreType[]

/**
 * `resolveDocumentReference`/`buildPdfFilename`'s "never contains the word
 * 'invoice'" guarantee is scoped to the five types whose reference field is
 * NOT invoiceNumber-first per design.md's `resolveDocumentReference` decision
 * ("invoice/receipt: invoiceNumber || referenceNumber || <typeDefault>" —
 * receipt is intentionally grouped with invoice and is expected to use
 * invoiceNumber, so it is excluded from the filename property, matching the
 * already-correct `pdf-download-button.tsx` pattern
 * `nameSegment = cleanedData.invoiceNumber || "receipt"`).
 */
const NON_INVOICE_FILENAME_TYPES = NON_CORE_TYPES.filter((t) => t !== "receipt")

/** Minimal valid InvoiceData fixture for a given document type + reference number. */
function makeFixture(documentType: string, referenceNumber: string): InvoiceData {
  return {
    ...getInitialInvoiceData(),
    documentType,
    referenceNumber,
    invoiceNumber: "", // ensure the non-core types don't accidentally pass via a leftover invoiceNumber
  }
}

/** Arbitrary reference numbers resembling realistic per-type document numbers. */
const referenceNumberArb = fc
  .tuple(
    fc.constantFrom("SOW", "CO", "NDA", "COF", "PF", "REC"),
    fc.integer({ min: 1, max: 999 }).map((n) => String(n).padStart(3, "0")),
  )
  .map(([prefix, num]) => `${prefix}-2026-07-${num}`)

describe("resolvePdfTemplateKey — F3 template resolution (bug condition exploration)", () => {
  /**
   * **Validates: Requirements 1.4**
   *
   * Design Property 4: for any of the six non-core document types,
   * `resolvePdfTemplateKey` SHALL return that type's real template key
   * rather than falling through to InvoicePDF/ReceiptPDF.
   *
   * FAILS now: the current switch only handles contract/quote/proposal;
   * everything else (including all six types here) falls to `default`,
   * which resolves to InvoicePDF (since the fixture sets no
   * `design.layout`/`design.templateId` of "receipt").
   */
  it("F3: non-core document types resolve to their real template key", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NON_CORE_TYPES), referenceNumberArb, (docType, refNum) => {
        const data = makeFixture(docType, refNum)
        const expectedKey = NON_CORE_TYPE_TO_TEMPLATE_KEY[docType]

        const result = resolvePdfTemplateKey(docType, data)

        expect(result).toBe(expectedKey)
      }),
      { numRuns: 100 },
    )
  })
})

describe("resolveDocumentReference / buildPdfFilename — F3 filename (bug condition exploration)", () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * Design Property 5: for any non-invoice document type downloaded from an
   * entry point that produces a filename, the filename SHALL be derived from
   * `referenceNumber` (never the literal word "invoice") and SHALL contain
   * the reference number when present.
   *
   * FAILS now: the current `resolveDocumentReference` default branch reads
   * `data.invoiceNumber` (empty for these types, per the fixture) and falls
   * back to the literal word "invoice", so both the reference-segment and
   * full-filename assertions fail.
   */
  it("F3: non-invoice type filenames never contain 'invoice' and contain the reference number", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NON_INVOICE_FILENAME_TYPES), referenceNumberArb, (docType, refNum) => {
        const data = makeFixture(docType, refNum)

        const reference = resolveDocumentReference(data, docType)
        const filename = buildPdfFilename(data, docType)

        expect(reference.toLowerCase()).not.toContain("invoice")
        expect(reference).toContain(refNum)

        expect(filename.toLowerCase()).not.toContain("invoice")
        expect(filename).toContain(refNum)
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Preservation property tests (design Property 8 / Req 3.4): for the core
 * document types, `resolvePdfTemplateKey` and `resolveDocumentReference`
 * must CONTINUE to return exactly what the CURRENT `app/documents/page.tsx`
 * `downloadDocument` switch returns today.
 *
 * Observed CURRENT switch (`app/documents/page.tsx` lines ~1582-1588):
 *   contract  -> ContractPDF,  filePrefix = referenceNumber || "contract"
 *   quote     -> QuotationPDF, filePrefix = referenceNumber || "quote"
 *   proposal  -> ProposalPDF,  filePrefix = referenceNumber || "proposal"
 *   default (invoice/quotation-normalized-to-quote/anything else)
 *             -> InvoicePDF, unless design.layout/templateId === "receipt"
 *                -> ReceiptPDF
 *   filePrefix (default) = invoiceNumber || "invoice"
 *
 * These tests encode that CURRENT behavior and MUST PASS against the
 * unfixed `lib/pdf-export-helpers.ts` (task 1.1 deliberately mirrors this
 * switch exactly for the core types).
 */
const CORE_TYPE_TO_TEMPLATE_KEY = {
  invoice: "InvoicePDF",
  contract: "ContractPDF",
  quote: "QuotationPDF",
  quotation: "QuotationPDF", // legacy alias, normalizes to "quote"
  proposal: "ProposalPDF",
} as const

type CoreType = keyof typeof CORE_TYPE_TO_TEMPLATE_KEY

const CORE_TYPES = Object.keys(CORE_TYPE_TO_TEMPLATE_KEY) as CoreType[]

describe("resolvePdfTemplateKey — core-type preservation (bug condition does NOT hold)", () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * Design Property 8: for invoice/contract/quote/quotation/proposal,
   * `resolvePdfTemplateKey` returns the same key the CURRENT
   * `app/documents/page.tsx` switch returns. Observed on unfixed code:
   * PASSES today.
   */
  it("preserves the current template key for every core document type", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CORE_TYPES), referenceNumberArb, (docType, refNum) => {
        const data = makeFixture(docType, refNum)
        const expectedKey = CORE_TYPE_TO_TEMPLATE_KEY[docType]

        const result = resolvePdfTemplateKey(docType, data)

        expect(result).toBe(expectedKey)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 3.4**
   *
   * The `design.layout === "receipt"` path for the invoice/default branch
   * must continue to yield "ReceiptPDF". Observed on unfixed code: PASSES
   * today (this is the `default` branch's receipt-layout check, already
   * present in `resolvePdfTemplateKey`).
   */
  it("preserves the receipt-layout override for the invoice/default branch", () => {
    const data: InvoiceData = {
      ...getInitialInvoiceData(),
      documentType: "invoice",
      design: {
        templateId: "receipt",
        font: "Helvetica",
        headerColor: "#000000",
        tableColor: "#000000",
        layout: "receipt",
      },
    }

    const result = resolvePdfTemplateKey("invoice", data)

    expect(result).toBe("ReceiptPDF")
  })
})

describe("resolveDocumentReference — core-type filename preservation (bug condition does NOT hold)", () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * Design Property 8: for a realistic invoice fixture with `invoiceNumber`
   * set, `resolveDocumentReference` returns `invoiceNumber` (matches
   * today's `default` branch: `invoiceNumber || "invoice"`). Observed on
   * unfixed code: PASSES today.
   */
  it("preserves invoiceNumber as the reference for a realistic invoice fixture", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^INV-[0-9]{4}-[0-9]{3}$/),
        (invoiceNumber) => {
          const data: InvoiceData = {
            ...getInitialInvoiceData(),
            documentType: "invoice",
            invoiceNumber,
            referenceNumber: "", // ensure the default branch is exercised via invoiceNumber
          }

          const result = resolveDocumentReference(data, "invoice")

          expect(result).toBe(invoiceNumber)
        },
      ),
      { numRuns: 100 },
    )
  })
})
