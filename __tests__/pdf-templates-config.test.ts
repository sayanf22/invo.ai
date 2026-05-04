import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { getDocumentConfig, getTheme, getSignatureDisplayMode, type Tpl, type SignatureDisplayMode } from "@/lib/pdf-templates"
import { getInitialInvoiceData, type InvoiceData } from "@/lib/invoice-types"

// ─── Helpers ───────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = ["invoice", "contract", "quotation", "proposal"] as const

const THEMES: Tpl[] = [
  "modern",
  "classic",
  "bold",
  "minimal",
  "elegant",
  "corporate",
  "creative",
  "warm",
  "geometric",
]

/** Arbitrary that produces a minimal InvoiceData with a random theme layout */
const invoiceDataArb = fc
  .record({
    layout: fc.constantFrom(...THEMES),
    font: fc.constantFrom(
      "Inter" as const,
      "Lora" as const,
      "Roboto Mono" as const,
    ),
  })
  .map(({ layout, font }): InvoiceData => ({
    ...getInitialInvoiceData(),
    design: {
      templateId: layout,
      font,
      headerColor: "",
      tableColor: "",
      layout,
    },
  }))

/** Generate all unique pairs from an array */
function allPairs<T>(arr: readonly T[]): [T, T][] {
  const pairs: [T, T][] = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]])
    }
  }
  return pairs
}

// ─── Property Tests ────────────────────────────────────────────────────────

describe("DocumentConfig property tests", () => {
  /**
   * **Validates: Requirements 1.8, 2.8, 3.8, 4.9**
   *
   * Property 1: Document type configs are mutually distinct
   *
   * For all pairs of document types from {"invoice", "contract", "quotation",
   * "proposal"}, getDocumentConfig returns configs that differ in title and
   * grandTotalLabel (always unique), and differ in at least one of fromLabel
   * or toLabel. Note: invoice and quotation share fromLabel "From" by design,
   * so we verify distinctness across the combination of distinguishing fields.
   */
  it("Property 1: document type configs are mutually distinct", () => {
    const pairArb = fc.constantFrom(...allPairs(DOCUMENT_TYPES))

    fc.assert(
      fc.property(pairArb, ([typeA, typeB]) => {
        const configA = getDocumentConfig(typeA)
        const configB = getDocumentConfig(typeB)

        // Title and grandTotalLabel are always unique per document type
        expect(configA.title).not.toBe(configB.title)
        expect(configA.grandTotalLabel).not.toBe(configB.grandTotalLabel)

        // At least one of fromLabel or toLabel must differ
        const fromDiffers = configA.fromLabel !== configB.fromLabel
        const toDiffers = configA.toLabel !== configB.toLabel
        expect(fromDiffers || toDiffers).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 5.1, 5.4**
   *
   * Property 2: Theme completeness across all palettes
   *
   * For all 9 themes and sample InvoiceData, getTheme returns an object with
   * all required color fields (pri, priDk, acc, accDk, bg, txt, mut, bdr) and
   * font fields (font, fontB), each non-empty string.
   */
  it("Property 2: theme completeness across all palettes", () => {
    const themeArb = fc.constantFrom(...THEMES)

    fc.assert(
      fc.property(themeArb, invoiceDataArb, (theme, data) => {
        const result = getTheme(theme, data)

        const colorFields = [
          "pri",
          "priDk",
          "acc",
          "accDk",
          "bg",
          "txt",
          "mut",
          "bdr",
        ] as const
        const fontFields = ["font", "fontB"] as const

        for (const field of colorFields) {
          expect(typeof result[field]).toBe("string")
          expect(result[field].length).toBeGreaterThan(0)
        }

        for (const field of fontFields) {
          expect(typeof result[field]).toBe("string")
          expect(result[field].length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 5.3**
   *
   * Property 3: Custom header color override
   *
   * For any valid hex color string differing from the theme default, getTheme
   * returns that color as the pri field.
   */
  it("Property 3: custom header color override", () => {
    const themeArb = fc.constantFrom(...THEMES)

    // Generate valid 6-digit hex color strings like "#a1b2c3"
    const hexDigit = fc.constantFrom(
      ..."0123456789abcdef".split(""),
    )
    const hexColorArb = fc
      .tuple(hexDigit, hexDigit, hexDigit, hexDigit, hexDigit, hexDigit)
      .map((digits) => `#${digits.join("")}`)

    fc.assert(
      fc.property(themeArb, hexColorArb, (theme, customColor) => {
        const baseData = getInitialInvoiceData()

        // First get the default pri for this theme to check if our color differs
        const defaultTheme = getTheme(theme, {
          ...baseData,
          design: {
            templateId: theme,
            font: "Inter",
            headerColor: "",
            tableColor: "",
            layout: theme,
          },
        })

        // Only test when the custom color differs from the default
        fc.pre(customColor !== defaultTheme.pri)

        const dataWithCustomColor: InvoiceData = {
          ...baseData,
          design: {
            templateId: theme,
            font: "Inter",
            headerColor: customColor,
            tableColor: "",
            layout: theme,
          },
        }

        const result = getTheme(theme, dataWithCustomColor)
        expect(result.pri).toBe(customColor)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * **Validates: Requirements 8.2, 8.5, 8.6, 8.7**
   *
   * Property 4: Signature display mode selection
   *
   * For any InvoiceData with varying combinations of showSenderSignature,
   * senderSignatureDataUrl, signatureImages, and signedAt, verify exactly one
   * display mode is selected per signature block:
   * - Party A: "drawn_image" when showSenderSignature !== false AND
   *   senderSignatureDataUrl is truthy; otherwise "signature_line"
   * - Party B: "drawn_image" when signatureImages[0].imageDataUrl is truthy;
   *   "electronically_signed" when signedAt is truthy OR signatureImages has
   *   entries but no imageDataUrl; otherwise "signature_line"
   */
  it("Property 4: signature display mode selection", () => {
    const VALID_MODES: SignatureDisplayMode[] = [
      "drawn_image",
      "electronically_signed",
      "signature_line",
    ]

    // Generate varying signature-related fields
    const signatureDataArb = fc.record({
      showSenderSignature: fc.constantFrom(true, false),
      senderSignatureDataUrl: fc.oneof(
        fc.constant(undefined),
        fc.constant(""),
        fc.constant("data:image/png;base64,abc123"),
      ),
      signedAt: fc.oneof(
        fc.constant(undefined),
        fc.constant(""),
        fc.constant("2025-01-15T10:30:00Z"),
      ),
      signatureImages: fc.oneof(
        fc.constant(undefined),
        fc.constant([] as Array<{ signerName: string; party: string; imageDataUrl: string; signedAt: string }>),
        fc.constant([{ signerName: "Client", party: "B", imageDataUrl: "", signedAt: "2025-01-15T10:30:00Z" }]),
        fc.constant([{ signerName: "Client", party: "B", imageDataUrl: "data:image/png;base64,xyz789", signedAt: "2025-01-15T10:30:00Z" }]),
      ),
    })

    fc.assert(
      fc.property(signatureDataArb, (sigFields) => {
        const data: InvoiceData = {
          ...getInitialInvoiceData(),
          showSenderSignature: sigFields.showSenderSignature,
          senderSignatureDataUrl: sigFields.senderSignatureDataUrl,
          signedAt: sigFields.signedAt,
          signatureImages: sigFields.signatureImages,
        }

        const result = getSignatureDisplayMode(data)

        // Both partyA and partyB must be exactly one of the three valid modes
        expect(VALID_MODES).toContain(result.partyA)
        expect(VALID_MODES).toContain(result.partyB)

        // Verify Party A mode selection
        if (data.showSenderSignature !== false && data.senderSignatureDataUrl) {
          expect(result.partyA).toBe("drawn_image")
        } else {
          expect(result.partyA).toBe("signature_line")
        }

        // Verify Party B mode selection
        const clientSig = data.signatureImages?.[0]
        if (clientSig?.imageDataUrl) {
          expect(result.partyB).toBe("drawn_image")
        } else if (data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) {
          expect(result.partyB).toBe("electronically_signed")
        } else {
          expect(result.partyB).toBe("signature_line")
        }
      }),
      { numRuns: 100 },
    )
  })
})

describe("InvoicePDF config unit tests", () => {
  const config = getDocumentConfig("invoice")

  it("returns correct title, fromLabel, toLabel, and grandTotalLabel", () => {
    expect(config.title).toBe("INVOICE")
    expect(config.fromLabel).toBe("From")
    expect(config.toLabel).toBe("Bill To")
    expect(config.grandTotalLabel).toBe("Total Due")
  })

  it("has hasPaymentSection true and hasSignatureRow false", () => {
    expect(config.hasPaymentSection).toBe(true)
    expect(config.hasSignatureRow).toBe(false)
  })

  it("returns correct refPrefix, showStatusBadge, hasPaymentInfo, and section flags", () => {
    expect(config.refPrefix).toBe("INV")
    expect(config.showStatusBadge).toBe(true)
    expect(config.hasPaymentInfo).toBe(true)
    expect(config.hasScopeSection).toBe(false)
    expect(config.hasDescriptionBox).toBe(false)
    expect(config.hasExecutiveSummary).toBe(false)
    expect(config.hasNextStepsCTA).toBe(false)
    expect(config.skipEmptyItems).toBe(false)
    expect(config.tableHeaderUsesAccent).toBe(false)
  })

  it("returns correct tableColumns", () => {
    expect(config.tableColumns).toEqual({
      desc: "Description",
      qty: "Qty",
      rate: "Rate",
      amount: "Amount",
    })
  })

  it("has 3 dateFields with correct labels", () => {
    expect(config.dateFields).toHaveLength(3)
    expect(config.dateFields[0].label).toBe("Issue Date")
    expect(config.dateFields[1].label).toBe("Due Date")
    expect(config.dateFields[2].label).toBe("Payment Terms")
  })

  it("returns Invoice config as default fallback for unknown type", () => {
    const fallback = getDocumentConfig("unknown")
    expect(fallback.title).toBe("INVOICE")
    expect(fallback.refPrefix).toBe("INV")
    expect(fallback.fromLabel).toBe("From")
    expect(fallback.toLabel).toBe("Bill To")
    expect(fallback.grandTotalLabel).toBe("Total Due")
    expect(fallback.hasPaymentSection).toBe(true)
    expect(fallback.hasSignatureRow).toBe(false)
  })
})

describe("ContractPDF config unit tests", () => {
  const config = getDocumentConfig("contract")

  it("returns correct title, fromLabel, toLabel, and grandTotalLabel", () => {
    expect(config.title).toBe("CONTRACT")
    expect(config.fromLabel).toBe("Party A \u2014 Provider")
    expect(config.toLabel).toBe("Party B \u2014 Client")
    expect(config.grandTotalLabel).toBe("Total Value")
  })

  it("has hasSignatureRow true, hasScopeSection true, and hasPaymentSection false", () => {
    expect(config.hasSignatureRow).toBe(true)
    expect(config.hasScopeSection).toBe(true)
    expect(config.hasPaymentSection).toBe(false)
  })

  it("returns correct refPrefix, showStatusBadge, hasPaymentInfo, and section flags", () => {
    expect(config.refPrefix).toBe("CTR")
    expect(config.showStatusBadge).toBe(false)
    expect(config.hasPaymentInfo).toBe(false)
    expect(config.hasDescriptionBox).toBe(false)
    expect(config.hasExecutiveSummary).toBe(false)
    expect(config.hasNextStepsCTA).toBe(false)
    expect(config.skipEmptyItems).toBe(true)
    expect(config.tableHeaderUsesAccent).toBe(false)
  })

  it("returns correct tableColumns", () => {
    expect(config.tableColumns).toEqual({
      desc: "Deliverable",
      qty: "Qty",
      rate: "Rate",
      amount: "Amount",
    })
  })

  it("has tableSectionTitle set to 'Deliverables & Pricing'", () => {
    expect(config.tableSectionTitle).toBe("Deliverables & Pricing")
  })

  it("has 2 dateFields with correct labels", () => {
    expect(config.dateFields).toHaveLength(2)
    expect(config.dateFields[0].label).toBe("Effective Date")
    expect(config.dateFields[1].label).toBe("End Date")
  })
})

describe("QuotationPDF config unit tests", () => {
  const config = getDocumentConfig("quotation")

  it("returns correct title, fromLabel, toLabel, and grandTotalLabel", () => {
    expect(config.title).toBe("QUOTATION")
    expect(config.fromLabel).toBe("From")
    expect(config.toLabel).toBe("Quote For")
    expect(config.grandTotalLabel).toBe("Total")
  })

  it("has hasSignatureRow true and hasDescriptionBox true", () => {
    expect(config.hasSignatureRow).toBe(true)
    expect(config.hasDescriptionBox).toBe(true)
  })

  it("returns correct refPrefix, showStatusBadge, hasPaymentInfo, and section flags", () => {
    expect(config.refPrefix).toBe("QUO")
    expect(config.showStatusBadge).toBe(false)
    expect(config.hasPaymentInfo).toBe(false)
    expect(config.hasPaymentSection).toBe(false)
    expect(config.hasScopeSection).toBe(false)
    expect(config.hasExecutiveSummary).toBe(false)
    expect(config.hasNextStepsCTA).toBe(false)
    expect(config.skipEmptyItems).toBe(false)
    expect(config.tableHeaderUsesAccent).toBe(false)
  })

  it("returns correct tableColumns", () => {
    expect(config.tableColumns).toEqual({
      desc: "Item / Service",
      qty: "Qty",
      rate: "Unit Price",
      amount: "Amount",
    })
  })

  it("has 3 dateFields with correct labels", () => {
    expect(config.dateFields).toHaveLength(3)
    expect(config.dateFields[0].label).toBe("Quote Date")
    expect(config.dateFields[1].label).toBe("Valid Until")
    expect(config.dateFields[2].label).toBe("Payment Terms")
  })
})

describe("ProposalPDF config unit tests", () => {
  const config = getDocumentConfig("proposal")

  it("returns correct title, fromLabel, toLabel, and grandTotalLabel", () => {
    expect(config.title).toBe("PROPOSAL")
    expect(config.fromLabel).toBe("Prepared By")
    expect(config.toLabel).toBe("Prepared For")
    expect(config.grandTotalLabel).toBe("Total Investment")
  })

  it("has hasSignatureRow true, hasExecutiveSummary true, hasNextStepsCTA true, and tableHeaderUsesAccent true", () => {
    expect(config.hasSignatureRow).toBe(true)
    expect(config.hasExecutiveSummary).toBe(true)
    expect(config.hasNextStepsCTA).toBe(true)
    expect(config.tableHeaderUsesAccent).toBe(true)
  })

  it("returns correct refPrefix, showStatusBadge, hasPaymentInfo, and section flags", () => {
    expect(config.refPrefix).toBe("PROP")
    expect(config.showStatusBadge).toBe(false)
    expect(config.hasPaymentInfo).toBe(false)
    expect(config.hasPaymentSection).toBe(false)
    expect(config.hasScopeSection).toBe(false)
    expect(config.hasDescriptionBox).toBe(false)
    expect(config.skipEmptyItems).toBe(true)
  })

  it("returns correct tableColumns", () => {
    expect(config.tableColumns).toEqual({
      desc: "Deliverable / Phase",
      qty: "Qty",
      rate: "Rate",
      amount: "Amount",
    })
  })

  it("has tableSectionTitle set to 'Budget Breakdown'", () => {
    expect(config.tableSectionTitle).toBe("Budget Breakdown")
  })

  it("has 3 dateFields with correct labels", () => {
    expect(config.dateFields).toHaveLength(3)
    expect(config.dateFields[0].label).toBe("Date")
    expect(config.dateFields[1].label).toBe("Valid Until")
    expect(config.dateFields[2].label).toBe("Payment")
  })
})
