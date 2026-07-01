import { z } from "zod"
import type { InvoiceData } from "@/lib/invoice-types"

// ─── SOW Schema ───────────────────────────────────────────────────────────────

export const sowSchema = z.object({
  documentType: z.literal("sow"),
  title: z.string().min(1).max(200),
  referenceNumber: z.string(),
  projectOverview: z.string().min(1).max(5000),
  scopeItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    included: z.boolean().default(true),
  })).min(1),
  deliverables: z.array(z.object({
    id: z.string(),
    description: z.string(),
    dueDate: z.string().optional(),
    acceptanceCriteria: z.string().optional(),
  })),
  milestones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    date: z.string(),
    description: z.string().optional(),
  })),
  assumptions: z.array(z.string()),
  parentContractId: z.string().uuid().optional(),
  // Shared fields
  fromName: z.string(),
  fromEmail: z.string(),
  fromAddress: z.string(),
  toName: z.string(),
  toEmail: z.string(),
  toAddress: z.string(),
  effectiveDate: z.string(),
  endDate: z.string().optional(),
  currency: z.string().default("USD"),
  totalValue: z.number().optional(),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
})

export type SOWData = z.infer<typeof sowSchema>

// ─── Change Order Schema ───────────────────────────────────────────────────────

export const changeOrderSchema = z.object({
  documentType: z.literal("change_order"),
  changeOrderNumber: z.string(),
  referenceNumber: z.string(),
  parentDocumentId: z.string().uuid(),
  parentDocumentType: z.enum(["sow", "contract"]),
  description: z.string().min(1).max(5000),
  additions: z.array(z.object({
    id: z.string(),
    description: z.string(),
    cost: z.number().optional(),
  })),
  removals: z.array(z.object({
    id: z.string(),
    description: z.string(),
    costReduction: z.number().optional(),
  })),
  modifications: z.array(z.object({
    id: z.string(),
    original: z.string(),
    revised: z.string(),
    costImpact: z.number().optional(),
  })),
  costImpact: z.object({
    originalTotal: z.number(),
    newTotal: z.number(),
    difference: z.number(),
  }).optional(),
  timelineImpact: z.string().optional(),
  effectiveDate: z.string(),
  // Shared fields
  fromName: z.string(),
  fromEmail: z.string(),
  fromAddress: z.string(),
  toName: z.string(),
  toEmail: z.string(),
  toAddress: z.string(),
  currency: z.string().default("USD"),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
})

export type ChangeOrderData = z.infer<typeof changeOrderSchema>

// ─── NDA Schema ───────────────────────────────────────────────────────────────

export const ndaSchema = z.object({
  documentType: z.literal("nda"),
  referenceNumber: z.string(),
  parties: z.array(z.object({
    name: z.string(),
    role: z.enum(["disclosing", "receiving", "mutual"]),
    address: z.string().optional(),
    representative: z.string().optional(),
  })).min(2).max(4),
  confidentialInfoDefinition: z.string().min(1).max(5000),
  obligations: z.array(z.string()).min(1),
  exclusions: z.array(z.string()),
  termStart: z.string(),
  termDuration: z.number().min(1),
  termUnit: z.enum(["months", "years"]),
  governingLaw: z.string(),
  remedies: z.string().optional(),
  // Shared fields
  fromName: z.string(),
  fromEmail: z.string(),
  fromAddress: z.string(),
  toName: z.string(),
  toEmail: z.string(),
  toAddress: z.string(),
  signatureName: z.string().optional(),
  signatureTitle: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
})

export type NDAData = z.infer<typeof ndaSchema>

// ─── Client Onboarding Form Schema ────────────────────────────────────────────

export const clientOnboardingFormSchema = z.object({
  documentType: z.literal("client_onboarding_form"),
  referenceNumber: z.string(),
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  projectName: z.string().min(1),
  projectDescription: z.string().max(5000),
  requirements: z.array(z.string()),
  timelinePreference: z.string().optional(),
  budgetRange: z.string().optional(),
  customQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    answer: z.string(),
  })),
  // Shared fields
  fromName: z.string(),
  fromEmail: z.string(),
  fromAddress: z.string(),
  notes: z.string().optional(),
})

export type ClientOnboardingFormData = z.infer<typeof clientOnboardingFormSchema>

// ─── Payment Follow-up Schema ─────────────────────────────────────────────────

export const paymentFollowupSchema = z.object({
  documentType: z.literal("payment_followup"),
  referenceNumber: z.string(),
  linkedInvoiceId: z.string().uuid(),
  invoiceNumber: z.string(),
  invoiceAmount: z.number(),
  invoiceCurrency: z.string(),
  dueDate: z.string(),
  daysOverdue: z.number(),
  paymentLinkUrl: z.string().url().optional(),
  reminderTone: z.enum(["polite", "firm", "urgent"]),
  customMessage: z.string().max(2000),
  // Shared fields
  fromName: z.string(),
  fromEmail: z.string(),
  fromAddress: z.string(),
  toName: z.string(),
  toEmail: z.string(),
  toAddress: z.string(),
  notes: z.string().optional(),
})

export type PaymentFollowupData = z.infer<typeof paymentFollowupSchema>

// ─── Recurring Invoice Context Schema ─────────────────────────────────────────

/**
 * A recurring invoice reuses the existing `InvoiceData` interface for its
 * line-item content. The recurrence configuration itself is stored separately
 * (in the session's `context` JSONB) and validated with this schema.
 *
 * `recurrenceFrequency` and `recurrenceStartDate` are required; the remaining
 * fields are optional scheduling refinements.
 */
export const recurringInvoiceContextSchema = z.object({
  recurrenceFrequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annually"]),
  recurrenceStartDate: z.string(),
  recurrenceEndDate: z.string().optional(),
  maxOccurrences: z.number().optional(),
  autoSend: z.boolean().default(true),
})

export type RecurringInvoiceContext = z.infer<typeof recurringInvoiceContextSchema>

// ─── Union Type ───────────────────────────────────────────────────────────────

/**
 * Union of all document data shapes.
 * InvoiceData covers: invoice and quote document types. (Recurring is a
 * setting on a regular invoice, not a separate document type.)
 */
export type AnyDocumentData =
  | InvoiceData
  | SOWData
  | ChangeOrderData
  | NDAData
  | ClientOnboardingFormData
  | PaymentFollowupData
