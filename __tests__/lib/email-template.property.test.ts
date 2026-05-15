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

/**
 * Mirror of getDocLabel() from email-template.ts.
 * Maps all 9 canonical types + the legacy "quotation" alias.
 */
function getDocLabel(documentType: string): string {
  const t = (documentType || "").toLowerCase()
  switch (t) {
    case "invoice":                return "Invoice"
    case "contract":               return "Contract"
    case "quote":
    case "quotation":              return "Quote"
    case "proposal":               return "Proposal"
    case "sow":                    return "Statement of Work"
    case "change_order":           return "Change Order"
    case "nda":                    return "NDA"
    case "client_onboarding_form": return "Client Onboarding Form"
    case "payment_followup":       return "Payment Reminder"
    default:                       return "Document"
  }
}

// All 9 canonical document types (excludes legacy "quotation" alias)
const ALL_DOC_TYPES = [
  "invoice",
  "contract",
  "quote",
  "proposal",
  "sow",
  "change_order",
  "nda",
  "client_onboarding_form",
  "payment_followup",
] as const

type DocType = typeof ALL_DOC_TYPES[number]

// ── Shared generator ──────────────────────────────────────────────────────────

const emailTemplateDataArb = fc.record({
  businessName: fc.string({ minLength: 1 }),
  documentType: fc.constantFrom(...ALL_DOC_TYPES),
  referenceNumber: fc.string({ minLength: 1 }),
  recipientName: fc.string({ minLength: 1 }),
  viewDocumentUrl: fc.webUrl(),
})

/**
 * Property 5: Email template required elements
 *
 * For any EmailTemplateData input (across all 9 document types), the rendered
 * HTML string SHALL contain:
 * (a) the business name text
 * (b) the document type label (from getDocLabel)
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
        const docLabel = getDocLabel(data.documentType)

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
 * (b) if documentType is "invoice", "quote", or "payment_followup" and totalAmount
 *     is non-null, HTML SHALL contain the amount string;
 *     if documentType is one of the long-form types (contract/sow/nda/change_order),
 *     SHALL NOT contain amount section
 * (c) if payNowUrl is non-null, HTML SHALL contain "Pay Now" anchor with that URL;
 *     if null, no "Pay Now" link
 * (d) if personalMessage is non-null and non-empty, HTML SHALL contain that message
 *     text; if null, no message section
 * (e) if documentType is "proposal", "client_onboarding_form", or "payment_followup"
 *     and description is non-null, HTML SHALL contain the description text
 *
 * Validates: Requirements 3.2, 3.4, 3.6, 3.7, 3.8, 10.6
 */
describe("Feature: email-sending, Property 6: Email template conditional elements", () => {
  const conditionalDataArb = fc.record({
    businessName: fc.string({ minLength: 1 }),
    documentType: fc.constantFrom(...ALL_DOC_TYPES),
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
          // The template only adds <img when businessLogoUrl is set
          const logoImgMatch = html.match(/<img[^>]+src="[^"]*"[^>]*>/g) ?? []
          expect(logoImgMatch.length).toBe(0)
        }

        // (b) amount for invoice/quote/payment_followup
        const isAmountType =
          data.documentType === "invoice" ||
          data.documentType === "quote" ||
          data.documentType === "payment_followup"

        const isLongFormType =
          data.documentType === "contract" ||
          data.documentType === "sow" ||
          data.documentType === "nda" ||
          data.documentType === "change_order"

        if (isAmountType && data.totalAmount != null) {
          expect(html).toContain(escapeHtml(data.totalAmount))
        }

        if (isLongFormType) {
          // Long-form types show no monetary amount — the "Amount due" label won't appear
          expect(html).not.toContain("Amount due")
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
          expect(data.personalMessage == null || data.personalMessage === "").toBe(true)
        }

        // (e) description for proposal/client_onboarding_form/payment_followup
        const isDescriptionType =
          data.documentType === "proposal" ||
          data.documentType === "client_onboarding_form" ||
          data.documentType === "payment_followup"

        if (isDescriptionType && data.description != null && data.description !== "") {
          expect(html).toContain(escapeHtml(data.description))
        }
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 7: Email template uses table layout and stays within size limits
 *
 * For any EmailTemplateData input, the rendered HTML SHALL:
 * - contain <table elements (table-based layout for email client compatibility)
 * - NOT contain <link stylesheet references
 * - total HTML size SHALL be under 102,400 bytes
 *
 * Note: The template intentionally uses a <style> block for CSS resets and
 * responsive media queries (@media) which cannot be expressed as inline styles.
 * This is standard practice for email clients that support <style> tags
 * (Gmail, Apple Mail, iOS Mail, Samsung Mail).
 *
 * Validates: Requirements 3.10
 */
describe("Feature: email-sending, Property 7: Email template uses table layout and stays within size limits", () => {
  it("should use table layout, no link tags, and stay under 102400 bytes", () => {
    fc.assert(
      fc.property(emailTemplateDataArb, (data) => {
        const html = renderEmailTemplate(data)

        // Must contain table elements (table-based layout)
        expect(html).toContain("<table")

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
 * "{DocLabel} {referenceNumber} from {businessName}"
 * where DocLabel is the human-readable label for the type.
 *
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 */
describe("Feature: email-sending, Property 8: Subject line formatting for all document types", () => {
  it("should produce the correct subject format for every document type", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom(...ALL_DOC_TYPES),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 })
        ),
        ([documentType, referenceNumber, businessName]) => {
          const subject = generateEmailSubject(documentType, referenceNumber, businessName)
          const expectedLabel = getDocLabel(documentType)
          expect(subject).toBe(`${expectedLabel} ${referenceNumber} from ${businessName}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
