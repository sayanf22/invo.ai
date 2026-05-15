/**
 * Property-based tests for document Zod schemas.
 *
 * This file covers Property 10: Schema validation for generated data.
 *
 * For any randomly generated valid data conforming to a schema,
 * `schema.parse(data)` succeeds; for data missing required fields, it throws ZodError.
 *
 * **Validates: Requirements 11.1–11.7**
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { z } from "zod"
import {
  sowSchema,
  changeOrderSchema,
  ndaSchema,
  clientOnboardingFormSchema,
  paymentFollowupSchema,
  recurringInvoiceContextSchema,
} from "@/lib/document-schemas"

// ─── Representative valid minimal data ───────────────────────────────────────

const VALID_SOW = {
  documentType: "sow" as const,
  title: "Website Redesign",
  referenceNumber: "SOW-001",
  projectOverview: "Complete website redesign project",
  scopeItems: [{ id: "1", title: "Design", description: "Create designs", included: true }],
  deliverables: [],
  milestones: [],
  assumptions: [],
  fromName: "Provider Co",
  fromEmail: "provider@test.com",
  fromAddress: "123 Main St",
  toName: "Client Co",
  toEmail: "client@test.com",
  toAddress: "456 Oak Ave",
  effectiveDate: "2026-01-01",
}

const VALID_CHANGE_ORDER = {
  documentType: "change_order" as const,
  changeOrderNumber: "CO-001",
  referenceNumber: "REF-001",
  parentDocumentId: "00000000-0000-0000-0000-000000000001",
  parentDocumentType: "sow" as const,
  description: "Additional feature",
  additions: [],
  removals: [],
  modifications: [],
  effectiveDate: "2026-01-01",
  fromName: "Provider",
  fromEmail: "p@test.com",
  fromAddress: "Addr",
  toName: "Client",
  toEmail: "c@test.com",
  toAddress: "Addr2",
}

const VALID_NDA = {
  documentType: "nda" as const,
  referenceNumber: "NDA-001",
  parties: [
    { name: "Party A", role: "disclosing" as const },
    { name: "Party B", role: "receiving" as const },
  ],
  confidentialInfoDefinition: "All technical documentation",
  obligations: ["Maintain confidentiality"],
  exclusions: [],
  termStart: "2026-01-01",
  termDuration: 2,
  termUnit: "years" as const,
  governingLaw: "California",
  fromName: "Party A",
  fromEmail: "a@test.com",
  fromAddress: "Addr A",
  toName: "Party B",
  toEmail: "b@test.com",
  toAddress: "Addr B",
}

const VALID_CLIENT_ONBOARDING = {
  documentType: "client_onboarding_form" as const,
  referenceNumber: "ONB-001",
  clientName: "Acme Corp",
  projectName: "New Website",
  projectDescription: "Build a new website",
  requirements: [],
  customQuestions: [],
  fromName: "Agency",
  fromEmail: "agency@test.com",
  fromAddress: "Agency Addr",
}

const VALID_PAYMENT_FOLLOWUP = {
  documentType: "payment_followup" as const,
  referenceNumber: "REM-001",
  linkedInvoiceId: "00000000-0000-0000-0000-000000000002",
  invoiceNumber: "INV-001",
  invoiceAmount: 1500,
  invoiceCurrency: "USD",
  dueDate: "2026-01-01",
  daysOverdue: 7,
  reminderTone: "polite" as const,
  customMessage: "Please remit payment at your earliest convenience.",
  fromName: "Provider",
  fromEmail: "p@test.com",
  fromAddress: "Addr",
  toName: "Client",
  toEmail: "c@test.com",
  toAddress: "Addr2",
}

const VALID_RECURRING_INVOICE_CONTEXT = {
  recurrenceFrequency: "monthly" as const,
  recurrenceStartDate: "2026-01-01",
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Non-empty string arbitrary (avoids violating min(1) constraints). */
const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 })

/** ISO date string arbitrary (YYYY-MM-DD) — built from integers to avoid invalid Date edge cases. */
const isoDate = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }) // max 28 to stay valid for all months
  )
  .map(([y, m, d]) => {
    const mm = String(m).padStart(2, "0")
    const dd = String(d).padStart(2, "0")
    return `${y}-${mm}-${dd}`
  })

/** Arbitrary for a scope item (required by sowSchema min(1)). */
const scopeItemArb = fc.record({
  id: nonEmptyString,
  title: nonEmptyString,
  description: nonEmptyString,
  included: fc.boolean(),
})

/** Arbitrary for an NDA party. */
const ndaPartyArb = fc.record({
  name: nonEmptyString,
  role: fc.constantFrom("disclosing", "receiving", "mutual") as fc.Arbitrary<"disclosing" | "receiving" | "mutual">,
})

/** SOW valid data arbitrary. */
const sowArb = fc.record({
  documentType: fc.constant("sow" as const),
  title: nonEmptyString,
  referenceNumber: nonEmptyString,
  projectOverview: nonEmptyString,
  scopeItems: fc.array(scopeItemArb, { minLength: 1, maxLength: 5 }),
  deliverables: fc.array(fc.record({ id: nonEmptyString, description: nonEmptyString })),
  milestones: fc.array(fc.record({ id: nonEmptyString, name: nonEmptyString, date: isoDate })),
  assumptions: fc.array(nonEmptyString),
  fromName: nonEmptyString,
  fromEmail: nonEmptyString,
  fromAddress: nonEmptyString,
  toName: nonEmptyString,
  toEmail: nonEmptyString,
  toAddress: nonEmptyString,
  effectiveDate: isoDate,
})

/** Change Order valid data arbitrary. */
const changeOrderArb = fc.record({
  documentType: fc.constant("change_order" as const),
  changeOrderNumber: nonEmptyString,
  referenceNumber: nonEmptyString,
  parentDocumentId: fc.constant("00000000-0000-0000-0000-000000000001"),
  parentDocumentType: fc.constantFrom("sow", "contract") as fc.Arbitrary<"sow" | "contract">,
  description: nonEmptyString,
  additions: fc.array(fc.record({ id: nonEmptyString, description: nonEmptyString })),
  removals: fc.array(fc.record({ id: nonEmptyString, description: nonEmptyString })),
  modifications: fc.array(fc.record({ id: nonEmptyString, original: nonEmptyString, revised: nonEmptyString })),
  effectiveDate: isoDate,
  fromName: nonEmptyString,
  fromEmail: nonEmptyString,
  fromAddress: nonEmptyString,
  toName: nonEmptyString,
  toEmail: nonEmptyString,
  toAddress: nonEmptyString,
})

/** NDA valid data arbitrary. */
const ndaArb = fc.record({
  documentType: fc.constant("nda" as const),
  referenceNumber: nonEmptyString,
  parties: fc.array(ndaPartyArb, { minLength: 2, maxLength: 4 }),
  confidentialInfoDefinition: nonEmptyString,
  obligations: fc.array(nonEmptyString, { minLength: 1 }),
  exclusions: fc.array(nonEmptyString),
  termStart: isoDate,
  termDuration: fc.integer({ min: 1, max: 60 }),
  termUnit: fc.constantFrom("months", "years") as fc.Arbitrary<"months" | "years">,
  governingLaw: nonEmptyString,
  fromName: nonEmptyString,
  fromEmail: nonEmptyString,
  fromAddress: nonEmptyString,
  toName: nonEmptyString,
  toEmail: nonEmptyString,
  toAddress: nonEmptyString,
})

/** Client Onboarding valid data arbitrary. */
const clientOnboardingArb = fc.record({
  documentType: fc.constant("client_onboarding_form" as const),
  referenceNumber: nonEmptyString,
  clientName: nonEmptyString,
  projectName: nonEmptyString,
  projectDescription: fc.string({ minLength: 0, maxLength: 200 }),
  requirements: fc.array(nonEmptyString),
  customQuestions: fc.array(fc.record({ id: nonEmptyString, question: nonEmptyString, answer: nonEmptyString })),
  fromName: nonEmptyString,
  fromEmail: nonEmptyString,
  fromAddress: nonEmptyString,
})

/** Payment Followup valid data arbitrary. */
const paymentFollowupArb = fc.record({
  documentType: fc.constant("payment_followup" as const),
  referenceNumber: nonEmptyString,
  linkedInvoiceId: fc.constant("00000000-0000-0000-0000-000000000002"),
  invoiceNumber: nonEmptyString,
  invoiceAmount: fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true }),
  invoiceCurrency: nonEmptyString,
  dueDate: isoDate,
  daysOverdue: fc.integer({ min: 0, max: 365 }),
  reminderTone: fc.constantFrom("polite", "firm", "urgent") as fc.Arbitrary<"polite" | "firm" | "urgent">,
  customMessage: fc.string({ minLength: 0, maxLength: 500 }),
  fromName: nonEmptyString,
  fromEmail: nonEmptyString,
  fromAddress: nonEmptyString,
  toName: nonEmptyString,
  toEmail: nonEmptyString,
  toAddress: nonEmptyString,
})

/** Recurring Invoice Context valid data arbitrary. */
const recurringInvoiceContextArb = fc.record({
  recurrenceFrequency: fc.constantFrom(
    "weekly", "biweekly", "monthly", "quarterly", "annually"
  ) as fc.Arbitrary<"weekly" | "biweekly" | "monthly" | "quarterly" | "annually">,
  recurrenceStartDate: isoDate,
})

// ─── Property 10: Schema validation for generated data ────────────────────────

describe("Property 10: Schema validation for generated data", () => {
  // ─── SOW Schema ─────────────────────────────────────────────────────────────

  describe("sowSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() => sowSchema.parse(VALID_SOW)).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(sowArb, (data) => {
          expect(() => sowSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing documentType throws ZodError", () => {
      const { documentType: _, ...missing } = VALID_SOW
      expect(() => sowSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing title throws ZodError", () => {
      const { title: _, ...missing } = VALID_SOW
      expect(() => sowSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing scopeItems throws ZodError", () => {
      const { scopeItems: _, ...missing } = VALID_SOW
      expect(() => sowSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with empty scopeItems array throws ZodError (min 1 required)", () => {
      expect(() => sowSchema.parse({ ...VALID_SOW, scopeItems: [] })).toThrow(z.ZodError)
    })

    it("data missing fromName throws ZodError", () => {
      const { fromName: _, ...missing } = VALID_SOW
      expect(() => sowSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with wrong documentType literal throws ZodError", () => {
      expect(() => sowSchema.parse({ ...VALID_SOW, documentType: "invoice" })).toThrow(z.ZodError)
    })
  })

  // ─── Change Order Schema ─────────────────────────────────────────────────────

  describe("changeOrderSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() => changeOrderSchema.parse(VALID_CHANGE_ORDER)).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(changeOrderArb, (data) => {
          expect(() => changeOrderSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing documentType throws ZodError", () => {
      const { documentType: _, ...missing } = VALID_CHANGE_ORDER
      expect(() => changeOrderSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing parentDocumentId throws ZodError", () => {
      const { parentDocumentId: _, ...missing } = VALID_CHANGE_ORDER
      expect(() => changeOrderSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with invalid parentDocumentId (not UUID) throws ZodError", () => {
      expect(() =>
        changeOrderSchema.parse({ ...VALID_CHANGE_ORDER, parentDocumentId: "not-a-uuid" })
      ).toThrow(z.ZodError)
    })

    it("data with invalid parentDocumentType throws ZodError", () => {
      expect(() =>
        changeOrderSchema.parse({ ...VALID_CHANGE_ORDER, parentDocumentType: "nda" })
      ).toThrow(z.ZodError)
    })

    it("data missing description throws ZodError", () => {
      const { description: _, ...missing } = VALID_CHANGE_ORDER
      expect(() => changeOrderSchema.parse(missing)).toThrow(z.ZodError)
    })
  })

  // ─── NDA Schema ──────────────────────────────────────────────────────────────

  describe("ndaSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() => ndaSchema.parse(VALID_NDA)).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(ndaArb, (data) => {
          expect(() => ndaSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing documentType throws ZodError", () => {
      const { documentType: _, ...missing } = VALID_NDA
      expect(() => ndaSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with fewer than 2 parties throws ZodError", () => {
      expect(() =>
        ndaSchema.parse({ ...VALID_NDA, parties: [{ name: "Solo", role: "disclosing" }] })
      ).toThrow(z.ZodError)
    })

    it("data with more than 4 parties throws ZodError", () => {
      const tooManyParties = Array.from({ length: 5 }, (_, i) => ({
        name: `Party ${i}`,
        role: "disclosing" as const,
      }))
      expect(() => ndaSchema.parse({ ...VALID_NDA, parties: tooManyParties })).toThrow(z.ZodError)
    })

    it("data with empty obligations array throws ZodError (min 1 required)", () => {
      expect(() => ndaSchema.parse({ ...VALID_NDA, obligations: [] })).toThrow(z.ZodError)
    })

    it("data missing governingLaw throws ZodError", () => {
      const { governingLaw: _, ...missing } = VALID_NDA
      expect(() => ndaSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with invalid termUnit throws ZodError", () => {
      expect(() => ndaSchema.parse({ ...VALID_NDA, termUnit: "decades" })).toThrow(z.ZodError)
    })
  })

  // ─── Client Onboarding Form Schema ──────────────────────────────────────────

  describe("clientOnboardingFormSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() => clientOnboardingFormSchema.parse(VALID_CLIENT_ONBOARDING)).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(clientOnboardingArb, (data) => {
          expect(() => clientOnboardingFormSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing documentType throws ZodError", () => {
      const { documentType: _, ...missing } = VALID_CLIENT_ONBOARDING
      expect(() => clientOnboardingFormSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing clientName throws ZodError", () => {
      const { clientName: _, ...missing } = VALID_CLIENT_ONBOARDING
      expect(() => clientOnboardingFormSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with empty clientName throws ZodError (min 1)", () => {
      expect(() =>
        clientOnboardingFormSchema.parse({ ...VALID_CLIENT_ONBOARDING, clientName: "" })
      ).toThrow(z.ZodError)
    })

    it("data missing projectName throws ZodError", () => {
      const { projectName: _, ...missing } = VALID_CLIENT_ONBOARDING
      expect(() => clientOnboardingFormSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing fromName throws ZodError", () => {
      const { fromName: _, ...missing } = VALID_CLIENT_ONBOARDING
      expect(() => clientOnboardingFormSchema.parse(missing)).toThrow(z.ZodError)
    })
  })

  // ─── Payment Follow-up Schema ────────────────────────────────────────────────

  describe("paymentFollowupSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() => paymentFollowupSchema.parse(VALID_PAYMENT_FOLLOWUP)).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(paymentFollowupArb, (data) => {
          expect(() => paymentFollowupSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing documentType throws ZodError", () => {
      const { documentType: _, ...missing } = VALID_PAYMENT_FOLLOWUP
      expect(() => paymentFollowupSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with invalid linkedInvoiceId (not UUID) throws ZodError", () => {
      expect(() =>
        paymentFollowupSchema.parse({ ...VALID_PAYMENT_FOLLOWUP, linkedInvoiceId: "not-a-uuid" })
      ).toThrow(z.ZodError)
    })

    it("data with invalid reminderTone throws ZodError", () => {
      expect(() =>
        paymentFollowupSchema.parse({ ...VALID_PAYMENT_FOLLOWUP, reminderTone: "aggressive" })
      ).toThrow(z.ZodError)
    })

    it("data missing invoiceAmount throws ZodError", () => {
      const { invoiceAmount: _, ...missing } = VALID_PAYMENT_FOLLOWUP
      expect(() => paymentFollowupSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing fromName throws ZodError", () => {
      const { fromName: _, ...missing } = VALID_PAYMENT_FOLLOWUP
      expect(() => paymentFollowupSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with invalid paymentLinkUrl throws ZodError", () => {
      expect(() =>
        paymentFollowupSchema.parse({ ...VALID_PAYMENT_FOLLOWUP, paymentLinkUrl: "not-a-url" })
      ).toThrow(z.ZodError)
    })

    it("valid paymentLinkUrl passes parse", () => {
      expect(() =>
        paymentFollowupSchema.parse({
          ...VALID_PAYMENT_FOLLOWUP,
          paymentLinkUrl: "https://pay.example.com/inv-001",
        })
      ).not.toThrow()
    })
  })

  // ─── Recurring Invoice Context Schema ────────────────────────────────────────

  describe("recurringInvoiceContextSchema", () => {
    it("valid minimal data passes parse without throwing", () => {
      expect(() =>
        recurringInvoiceContextSchema.parse(VALID_RECURRING_INVOICE_CONTEXT)
      ).not.toThrow()
    })

    it("valid randomly generated data passes parse (property-based)", () => {
      fc.assert(
        fc.property(recurringInvoiceContextArb, (data) => {
          expect(() => recurringInvoiceContextSchema.parse(data)).not.toThrow()
        }),
        { numRuns: 100 }
      )
    })

    it("data missing recurrenceFrequency throws ZodError", () => {
      const { recurrenceFrequency: _, ...missing } = VALID_RECURRING_INVOICE_CONTEXT
      expect(() => recurringInvoiceContextSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data missing recurrenceStartDate throws ZodError", () => {
      const { recurrenceStartDate: _, ...missing } = VALID_RECURRING_INVOICE_CONTEXT
      expect(() => recurringInvoiceContextSchema.parse(missing)).toThrow(z.ZodError)
    })

    it("data with invalid recurrenceFrequency throws ZodError", () => {
      expect(() =>
        recurringInvoiceContextSchema.parse({
          ...VALID_RECURRING_INVOICE_CONTEXT,
          recurrenceFrequency: "daily",
        })
      ).toThrow(z.ZodError)
    })

    it.each(["weekly", "biweekly", "monthly", "quarterly", "annually"] as const)(
      "recurrenceFrequency '%s' is valid",
      (freq) => {
        expect(() =>
          recurringInvoiceContextSchema.parse({
            ...VALID_RECURRING_INVOICE_CONTEXT,
            recurrenceFrequency: freq,
          })
        ).not.toThrow()
      }
    )
  })

  // ─── Cross-schema property: parse fails for any schema when required fields missing ─

  describe("cross-schema: missing required fields always throw ZodError", () => {
    /**
     * Property-based: for each schema, an empty object always throws ZodError.
     * This validates that schemas enforce required fields consistently.
     *
     * **Validates: Requirements 11.1–11.7**
     */
    it("empty object throws ZodError for every schema", () => {
      const schemas = [
        sowSchema,
        changeOrderSchema,
        ndaSchema,
        clientOnboardingFormSchema,
        paymentFollowupSchema,
        recurringInvoiceContextSchema,
      ]
      for (const schema of schemas) {
        expect(() => schema.parse({})).toThrow(z.ZodError)
      }
    })

    /**
     * Property-based: for any schema, null and undefined always throw ZodError.
     *
     * **Validates: Requirements 11.1–11.7**
     */
    it("null throws ZodError for every schema", () => {
      const schemas = [
        sowSchema,
        changeOrderSchema,
        ndaSchema,
        clientOnboardingFormSchema,
        paymentFollowupSchema,
        recurringInvoiceContextSchema,
      ]
      for (const schema of schemas) {
        expect(() => schema.parse(null)).toThrow(z.ZodError)
      }
    })
  })
})
