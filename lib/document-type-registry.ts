/**
 * Centralized document type registry.
 * Single source of truth for all 9 supported document types and their metadata.
 * All modules (intent classifier, tier system, UI, PDF templates, etc.) should
 * import from here rather than hardcoding type metadata.
 *
 * Note: Recurring invoices are NOT a separate document type. Any regular
 * invoice can be made recurring via the `recurring_invoices` table and the
 * RecurringPanel UI on the invoice editor.
 */

// ─── Type Definitions ─────────────────────────────────────────────────────────

export const ALL_DOCUMENT_TYPES = [
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

export type DocumentType = (typeof ALL_DOCUMENT_TYPES)[number]

/** Legacy alias — maps to "quote" everywhere */
export type LegacyDocumentType = "quotation"

export interface DocumentTypeConfig {
  type: DocumentType
  label: string
  description: string
  /** Lucide icon name (resolved at render time) */
  icon: string
  /** Tailwind text color class */
  color: string
  /** Tailwind bg color class */
  bgColor: string
  capabilities: {
    supports_signature: boolean
    supports_payment_link: boolean
    supports_linking: boolean
    supports_recurring: boolean
  }
  /** Parent types this document can link to */
  validParentTypes: DocumentType[]
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPE_REGISTRY: Record<DocumentType, DocumentTypeConfig> = {
  invoice: {
    type: "invoice",
    label: "Invoice",
    description:
      "A bill for services rendered or products delivered, used to request payment from a client.",
    icon: "FileText",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    capabilities: {
      supports_signature: false,
      supports_payment_link: true,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  contract: {
    type: "contract",
    label: "Contract",
    description:
      "A legally binding service agreement outlining the scope, terms, obligations, and compensation between parties.",
    icon: "FileCheck",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    capabilities: {
      supports_signature: true,
      supports_payment_link: false,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  quote: {
    type: "quote",
    label: "Quote",
    description:
      "A binding price offer for specific work with line items, total, and validity period.",
    icon: "FileQuestion",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    capabilities: {
      supports_signature: false,
      supports_payment_link: false,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  proposal: {
    type: "proposal",
    label: "Proposal",
    description:
      "A persuasive document pitching your services or project approach to win new business.",
    icon: "Presentation",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    capabilities: {
      supports_signature: false,
      supports_payment_link: false,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  sow: {
    type: "sow",
    label: "Statement of Work",
    description:
      "A detailed document defining project scope, deliverables, milestones, and timeline. Typically a sub-document under a contract.",
    icon: "ClipboardList",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    capabilities: {
      supports_signature: true,
      supports_payment_link: false,
      supports_linking: true,
      supports_recurring: false,
    },
    validParentTypes: ["contract"],
  },

  change_order: {
    type: "change_order",
    label: "Change Order",
    description:
      "An amendment to an existing SOW or contract documenting additions, removals, or modifications to agreed scope.",
    icon: "GitMerge",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    capabilities: {
      supports_signature: true,
      supports_payment_link: false,
      supports_linking: true,
      supports_recurring: false,
    },
    validParentTypes: ["sow", "contract"],
  },

  nda: {
    type: "nda",
    label: "NDA",
    description:
      "A Non-Disclosure Agreement protecting confidential information shared between parties.",
    icon: "Shield",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    capabilities: {
      supports_signature: true,
      supports_payment_link: false,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  client_onboarding_form: {
    type: "client_onboarding_form",
    label: "Client Onboarding Form",
    description:
      "An intake form to collect structured client details, project requirements, and preferences at the start of an engagement.",
    icon: "ClipboardCheck",
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    capabilities: {
      supports_signature: false,
      supports_payment_link: false,
      supports_linking: false,
      supports_recurring: false,
    },
    validParentTypes: [],
  },

  payment_followup: {
    type: "payment_followup",
    label: "Payment Follow-up",
    description:
      "A polite payment reminder referencing an existing unpaid invoice and its payment link.",
    icon: "Bell",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    capabilities: {
      supports_signature: false,
      supports_payment_link: false,
      supports_linking: true,
      supports_recurring: false,
    },
    validParentTypes: ["invoice"],
  },
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Normalize a document type string to a canonical `DocumentType`.
 *
 * - Maps legacy `"quotation"` → `"quote"`.
 * - Returns `null` for any unrecognized string.
 * - Normalization is idempotent: `normalizeDocumentType(normalizeDocumentType(x)) === normalizeDocumentType(x)`.
 */
export function normalizeDocumentType(type: string): DocumentType | null {
  if (!type) return null

  // Map legacy alias
  if (type === "quotation") return "quote"

  // Check against canonical list
  if ((ALL_DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return type as DocumentType
  }

  return null
}

/**
 * Get the human-readable display label for a document type string.
 * Handles legacy `"quotation"` by normalizing first.
 * Returns a generic fallback label for unknown types.
 */
export function getDocumentTypeLabel(type: string): string {
  const normalized = normalizeDocumentType(type)
  if (!normalized) return "Document"
  return DOCUMENT_TYPE_REGISTRY[normalized].label
}

/**
 * Get the full `DocumentTypeConfig` for a type string.
 * Handles legacy `"quotation"` by normalizing first.
 * Returns `null` for unknown types.
 */
export function getDocumentTypeConfig(type: string): DocumentTypeConfig | null {
  const normalized = normalizeDocumentType(type)
  if (!normalized) return null
  return DOCUMENT_TYPE_REGISTRY[normalized]
}
