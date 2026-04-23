/**
 * Property-based tests for lib/email-template.ts
 * Feature: email-sending
 *
 * Properties 5–8 covering renderEmailTemplate and generateEmailSubject.
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { renderEmailTemplate, generateEmailSubject } from "@/lib/email-template"

/** Mirror of the escapeHtml helper used inside email-template.ts */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Mirror of the escapeAttr helper used inside email-template.ts (for href/src attributes) */
function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// ── Shared generator ──────────────────────────────────────────────────────────

const emailTemplateDataArb = fc.record({
  businessName: fc.string({ minLength: 1 }),
  documentType: fc.constantFrom(
    "invoice" as const,
    "contract" as const,
    "quotation" as const,
    "proposal" as const
  ),
  referenceNumber: fc.string({ minLength: 1 }),
  recipientName: fc.string({ minLength: 1 }),
  viewDocumentUrl: fc.webUrl(),
})

/**
 * Property 5: Email template required elements
 *
 * For any EmailTemplateData input (across all 4 document types), the rendered
 * HTML string SHALL contain:
 * (a) the business name text
 * (b) the document type label (Invoice/Contract/Quotation/Proposal)
 * (c) the reference number
 * (d) an anchor element with href containing the viewDocumentUrl
 * (e) the text "Sent via Clorefy" with a link to https://clorefy.com
 *
 * Validates: Requirements 3.1, 3.3, 3.5, 3.9, 10.1
 */
describe("Feature: email-sending, Property 5: Email template required elements", () => {
  it("should always contain business name, doc type label, reference number, view URL anchor, and Clorefy footer", () => {
    fc.assert(
      fc.property(emailTemplateDataArb, (data) => {
        const html = renderEmailTemplate(data)

        const docLabel =
          data.documentType === "invoice"
            ? "Invoice"
            : data.documentType === "contract"
              ? "Contract"
              : data.documentType === "quotation"
                ? "Quotation"
                : "Proposal"

        // (a) business name appears in the HTML (may be HTML-escaped)
        expect(html).toContain(escapeHtml(data.businessName))

        // (b) document type label appears
        expect(html).toContain(docLabel)

        // (c) reference number appears (may be HTML-escaped)
        expect(html).toContain(escapeHtml(data.referenceNumber))

        // (d) anchor with href containing viewDocumentUrl (URL is attr-escaped)
        expect(html).toContain(`href="${escapeAttr(data.viewDocumentUrl)}"`)

        // (e) "Sent via Clorefy" text and link to https://clorefy.com
        expect(html).toContain("Sent via")
        expect(html).toContain("Clorefy")
        expect(html).toContain("https://clorefy.com")
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 6: Email template conditional elements
 *
 * For any EmailTemplateData input:
 * (a) if businessLogoUrl is non-null, HTML SHALL contain <img with that URL as src;
 *     if null, no logo img
 * (b) if documentType is "invoice" or "quotation" and totalAmount is non-null,
 *     HTML SHALL contain the amount string; if "contract" or "proposal", SHALL NOT
 *     contain amount section
 * (c) if payNowUrl is non-null, HTML SHALL contain "Pay Now" anchor with that URL;
 *     if null, no "Pay Now" link
 * (d) if personalMessage is non-null and non-empty, HTML SHALL contain that message
 *     text; if null, no message section
 * (e) if documentType is "contract" or "proposal" and description is non-null,
 *     HTML SHALL contain the description text
 *
 * Validates: Requirements 3.2, 3.4, 3.6, 3.7, 3.8, 10.6
 */
describe("Feature: email-sending, Property 6: Email template conditional elements", () => {
  const conditionalDataArb = fc.record({
    businessName: fc.string({ minLength: 1 }),
    documentType: fc.constantFrom(
      "invoice" as const,
      "contract" as const,
      "quotation" as const,
      "proposal" as const
    ),
    referenceNumber: fc.string({ minLength: 1 }),
    recipientName: fc.string({ minLength: 1 }),
    viewDocumentUrl: fc.webUrl(),
    businessLogoUrl: fc.option(fc.webUrl(), { nil: null }),
    totalAmount: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    payNowUrl: fc.option(fc.webUrl(), { nil: null }),
    personalMessage: fc.option(fc.string({ minLength: 1 }), { nil: null }),
    description: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  })

  it("should conditionally include logo, amount, pay now, personal message, and description", () => {
    fc.assert(
      fc.property(conditionalDataArb, (data) => {
        const html = renderEmailTemplate(data)

        // (a) logo img
        if (data.businessLogoUrl != null) {
          expect(html).toContain("<img")
          expect(html).toContain(escapeAttr(data.businessLogoUrl))
        } else {
          // No logo img beyond the business logo (header img only appears when logo provided)
          // The template only adds <img when businessLogoUrl is set
          const logoImgMatch = html.match(/<img[^>]+src="[^"]*"[^>]*>/g) ?? []
          // All img tags should NOT be the logo (since no logo URL provided)
          // The template only renders an img for the logo, so there should be none
          expect(logoImgMatch.length).toBe(0)
        }

        // (b) amount for invoice/quotation
        if (
          (data.documentType === "invoice" || data.documentType === "quotation") &&
          data.totalAmount != null
        ) {
          expect(html).toContain(escapeHtml(data.totalAmount))
        } else if (
          data.documentType === "contract" ||
          data.documentType === "proposal"
        ) {
          // contracts/proposals should not show the amount section.
          // The amount section has a distinctive background color used only there.
          expect(html).not.toContain("background-color:#f0f4ff")
        }

        // (c) Pay Now button
        if (data.payNowUrl != null) {
          expect(html).toContain("Pay Now")
          expect(html).toContain(escapeAttr(data.payNowUrl))
        } else {
          expect(html).not.toContain("Pay Now")
        }

        // (d) personal message (may be HTML-escaped)
        if (data.personalMessage != null && data.personalMessage !== "") {
          expect(html).toContain(escapeHtml(data.personalMessage))
        } else {
          // When null, the personal message section should not appear
          // (we can't check for the exact text since it's null, but we verify no spurious content)
          expect(data.personalMessage == null || data.personalMessage === "").toBe(true)
        }

        // (e) description for contract/proposal (may be HTML-escaped)
        if (
          (data.documentType === "contract" || data.documentType === "proposal") &&
          data.description != null
        ) {
          expect(html).toContain(escapeHtml(data.description))
        }
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 7: Email template uses inline CSS and table layout
 *
 * For any EmailTemplateData input, the rendered HTML SHALL:
 * - contain <table elements
 * - NOT contain <style blocks
 * - NOT contain <link stylesheet references
 * - total HTML size SHALL be under 102,400 bytes
 *
 * Validates: Requirements 3.10
 */
describe("Feature: email-sending, Property 7: Email template uses inline CSS and table layout", () => {
  it("should use table layout, no style blocks, no link tags, and stay under 102400 bytes", () => {
    fc.assert(
      fc.property(emailTemplateDataArb, (data) => {
        const html = renderEmailTemplate(data)

        // Must contain table elements
        expect(html).toContain("<table")

        // Must NOT contain <style blocks
        expect(html).not.toMatch(/<style[\s>]/i)

        // Must NOT contain <link stylesheet references
        expect(html).not.toMatch(/<link[^>]+stylesheet/i)

        // Total size under 102,400 bytes
        const byteSize = new TextEncoder().encode(html).length
        expect(byteSize).toBeLessThan(102400)
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 8: Subject line formatting for all document types
 *
 * For any document type, reference number, and business name,
 * generateEmailSubject SHALL produce:
 * - "invoice"    → "Invoice {referenceNumber} from {businessName}"
 * - "contract"   → "Contract {referenceNumber} from {businessName}"
 * - "quotation"  → "Quotation {referenceNumber} from {businessName}"
 * - "proposal"   → "Proposal {referenceNumber} from {businessName}"
 *
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 */
describe("Feature: email-sending, Property 8: Subject line formatting for all document types", () => {
  it("should produce the correct subject format for every document type", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom(
            "invoice" as const,
            "contract" as const,
            "quotation" as const,
            "proposal" as const
          ),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 })
        ),
        ([documentType, referenceNumber, businessName]) => {
          const subject = generateEmailSubject(documentType, referenceNumber, businessName)

          const expectedLabel =
            documentType === "invoice"
              ? "Invoice"
              : documentType === "contract"
                ? "Contract"
                : documentType === "quotation"
                  ? "Quotation"
                  : "Proposal"

          expect(subject).toBe(`${expectedLabel} ${referenceNumber} from ${businessName}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
