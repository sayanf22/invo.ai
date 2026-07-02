/**
 * PDF export helpers — template + filename resolution.
 *
 * Plain `.ts` module with NO `@react-pdf/renderer` import so it stays out of
 * eager bundles and is trivially unit/property-testable (see design.md,
 * "Design decision B").
 *
 * `resolvePdfTemplateKey` and `resolveDocumentReference` are the single
 * source of truth for template + filename-reference resolution, replacing
 * the divergent hand-rolled `switch` statements that used to live in each of
 * the four PDF download/render entry points. Their behavior is modeled on
 * `components/pdf-download-button.tsx` (the pre-existing, already-correct
 * reference implementation, which is NOT modified by this fix — see
 * design.md "Design decision B" and bugfix.md Requirement 3.5) for the core
 * types and the six non-core types (`sow`, `change_order`, `nda`,
 * `client_onboarding_form`, `payment_followup`, `receipt`).
 *
 * Fixes F3: wrong template + "invoice"-only filenames for the six non-core
 * document types across `app/documents/page.tsx`, `components/share-button.tsx`,
 * `app/view/[sessionId]/page.tsx`, and `app/pay/[sessionId]/pay-document-view.tsx`.
 *
 * Bug_Condition: isBugCondition(X) where X.kind = "pdfDownload" (F3)
 * Requirements: 2.4, 2.5, 3.4
 */

import type { InvoiceData } from "@/lib/invoice-types"
import { normalizeDocumentType, getDocumentTypeConfig } from "@/lib/document-type-registry"

/**
 * The 10 PDF template component names exported from `lib/pdf-templates.tsx`.
 * Kept in sync with the design document's `PdfTemplateKey` union.
 */
export type PdfTemplateKey =
  | "InvoicePDF"
  | "ContractPDF"
  | "QuotationPDF"
  | "ProposalPDF"
  | "ReceiptPDF"
  | "SOWPDF"
  | "ChangeOrderPDF"
  | "NDAPDF"
  | "ClientOnboardingFormPDF"
  | "PaymentFollowupPDF"

/**
 * Resolve the PDF template key for a given document type + data.
 *
 * Modeled exactly on `components/pdf-download-button.tsx`'s `handleDownload`
 * switch:
 *   contract               -> ContractPDF
 *   quote / quotation      -> QuotationPDF
 *   proposal               -> ProposalPDF
 *   receipt                -> ReceiptPDF
 *   sow                    -> SOWPDF
 *   change_order           -> ChangeOrderPDF
 *   nda                    -> NDAPDF
 *   client_onboarding_form -> ClientOnboardingFormPDF
 *   payment_followup       -> PaymentFollowupPDF
 *   default (invoice/recurring_invoice/unknown)
 *                          -> ReceiptPDF when the design layout/templateId is
 *                             "receipt", otherwise InvoicePDF
 *
 * The core branches (contract/quote/proposal/default) and the receipt-layout
 * override are unchanged from before this fix — see design Property 8 /
 * Requirement 3.4 (preservation).
 */
export function resolvePdfTemplateKey(documentType: string, data: InvoiceData): PdfTemplateKey {
  const rawType = (documentType || "invoice").toLowerCase()
  // Normalize so legacy "quotation" and canonical "quote" share the same branch
  const docType = normalizeDocumentType(rawType) ?? rawType

  switch (docType) {
    case "contract":
      return "ContractPDF"
    case "quote":
      return "QuotationPDF"
    case "proposal":
      return "ProposalPDF"
    case "receipt":
      return "ReceiptPDF"
    case "sow":
      return "SOWPDF"
    case "change_order":
      return "ChangeOrderPDF"
    case "nda":
      return "NDAPDF"
    case "client_onboarding_form":
      return "ClientOnboardingFormPDF"
    case "payment_followup":
      return "PaymentFollowupPDF"
    default:
      return data.design?.layout === "receipt" || data.design?.templateId === "receipt"
        ? "ReceiptPDF"
        : "InvoicePDF"
  }
}

/**
 * Thin adapter used by call sites that already `await import("@/lib/pdf-templates")`.
 * Resolves the template key via `resolvePdfTemplateKey` and looks it up on the
 * imported templates module.
 */
export function resolvePdfComponent<T extends Record<PdfTemplateKey, unknown>>(
  templates: T,
  documentType: string,
  data: InvoiceData,
): T[PdfTemplateKey] {
  return templates[resolvePdfTemplateKey(documentType, data)]
}

/**
 * Type-specific default fallback word used when neither `referenceNumber`
 * nor `invoiceNumber` is populated. Mirrors the literal fallback strings in
 * `components/pdf-download-button.tsx`'s `handleDownload` switch.
 */
const REFERENCE_TYPE_DEFAULT: Record<string, string> = {
  invoice: "invoice",
  contract: "contract",
  quote: "quote",
  proposal: "proposal",
  receipt: "receipt",
  sow: "sow",
  change_order: "change-order",
  nda: "nda",
  client_onboarding_form: "onboarding",
  payment_followup: "followup",
}

/**
 * Resolve the filename "reference segment" for a document.
 *
 * Modeled on `components/pdf-download-button.tsx`'s `handleDownload`
 * `nameSegment` logic:
 *   invoice / receipt (and any unrecognized type, via the `default` branch)
 *             -> invoiceNumber || referenceNumber || <typeDefault>
 *   all other types (contract, quote, proposal, sow, change_order, nda,
 *   client_onboarding_form, payment_followup)
 *             -> referenceNumber || invoiceNumber || <typeDefault>
 *
 * The core branches (contract/quote/proposal/default) are unchanged from
 * before this fix — see design Property 8 / Requirement 3.4 (preservation).
 */
export function resolveDocumentReference(data: InvoiceData, documentType: string): string {
  const rawType = (documentType || "invoice").toLowerCase()
  const docType = normalizeDocumentType(rawType) ?? rawType
  const typeDefault = REFERENCE_TYPE_DEFAULT[docType] ?? "document"

  switch (docType) {
    case "invoice":
    case "receipt":
      return data.invoiceNumber || data.referenceNumber || typeDefault
    case "contract":
    case "quote":
    case "proposal":
    case "sow":
    case "change_order":
    case "nda":
    case "client_onboarding_form":
    case "payment_followup":
      return data.referenceNumber || data.invoiceNumber || typeDefault
    default:
      return data.invoiceNumber || data.referenceNumber || typeDefault
  }
}

/** Strip characters that are unsafe in a downloaded filename. */
function sanitizeFilenameSegment(input: string): string {
  return input.replace(/[/\\:*?"<>|]/g, "_")
}

/**
 * Build a full PDF filename: `${labelPrefix}_${sanitizedReference}_${YYYY-MM-DD}.pdf`.
 * `labelPrefix` is derived from `getDocumentTypeConfig(documentType)?.label`
 * (matches `components/pdf-download-button.tsx`).
 */
export function buildPdfFilename(data: InvoiceData, documentType: string): string {
  const rawType = (documentType || "invoice").toLowerCase()
  const docType = normalizeDocumentType(rawType) ?? rawType

  const typeConfig = getDocumentTypeConfig(docType) || getDocumentTypeConfig("invoice")
  const labelPrefix = (typeConfig?.label || "Document")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")

  const referenceSegment = sanitizeFilenameSegment(resolveDocumentReference(data, documentType))
  const dateStr = new Date().toISOString().split("T")[0]

  return `${labelPrefix}_${referenceSegment}_${dateStr}.pdf`
}
