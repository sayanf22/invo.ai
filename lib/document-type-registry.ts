/**
 * Centralized document type registry.
 * Single source of truth for all 10 supported document types and their metadata.
 * All modules (intent classifier, tier system, UI, PDF templates, etc.) should
 * import from here rather than hardcoding type metadata.
 *
 * Note: A recurring invoice reuses the regular invoice's line-item structure
 * (InvoiceData) but is a distinct document type so the intent classifier,
 * detector, editor, and PDF renderer can surface recurrence scheduling and
 * treat it as a first-class type. The recurrence schedule itself is stored in
 * the `recurring_invoices` table / session context.
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
  "recurring_invoice",
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
  /**
   * Reference number prefix — single source of truth for document numbering.
   * Used by the stream route to inject the deterministic document number into
   * the AI prompt, and by the persist layer to coerce any AI-produced
   * referenceNumber/invoiceNumber to the right prefix.
   *
   * Format: `<PREFIX>-<YYYY>-<MM>-<NNN>` (e.g. `INV-2026-05-001`).
   */
  prefix: string
  capabilities: {
    /**
     * Whether this document type supports e-signatures.
     * When true AND showSignatureFields is NOT false, the send card shows
     * "Send & Sign", creates a signature request, and the /sign/[token] page
     * is used by the recipient.
     *
     * Types that MUST be signed: contract, sow, change_order, nda
     * Types that CAN optionally be signed: quote, proposal (user chooses via
     * the showSignatureFields toggle in the editor)
     */
    supports_signature: boolean
    /**
     * Whether recipients can respond to this document with Accept / Decline /
     * Request Changes (soft acceptance without a legally-binding signature).
     *
     * Industry standard:
     *   - quote: YES — recipient accepts/declines the price offer
     *   - proposal: YES — recipient accepts/declines the scope/approach
     *   - All others: NO — binding docs require signature, not soft acceptance
     *
     * When supports_client_response is true AND showSignatureFields is false
     * (user turned off the signature toggle), the /view page shows the
     * accept/decline UI instead of the signature pad.
     * When showSignatureFields is true, the signature pad takes priority.
     */
    supports_client_response: boolean
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
    prefix: "INV",
    capabilities: {
      supports_signature: false,
      supports_client_response: false,
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
    prefix: "CTR",
    capabilities: {
      // Contracts MUST be signed — they are legally binding agreements.
      // No accept/decline soft flow: both parties sign or negotiate terms.
      supports_signature: true,
      supports_client_response: false,
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
    prefix: "QUO",
    capabilities: {
      // Quotes can optionally be signed (showSignatureFields toggle) OR just
      // accepted/declined/changed (supports_client_response). When the
      // signature toggle is off, the recipient sees Accept / Decline /
      // Request Changes. When on, they see the signature pad.
      supports_signature: true,
      supports_client_response: true,
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
    prefix: "PROP",
    capabilities: {
      // Proposals typically use soft acceptance (Accept/Decline/Changes) when
      // in the pitch stage. They can optionally include a counter-signature
      // block if the user wants the acceptance to be legally binding.
      // showSignatureFields toggle controls which mode is active.
      supports_signature: true,
      supports_client_response: true,
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
    prefix: "SOW",
    capabilities: {
      // SOWs are legally binding amendments to contracts — must be signed.
      // No soft accept/decline: both parties execute the document.
      supports_signature: true,
      supports_client_response: false,
      supports_payment_link: false,
      supports_linking: true,
      supports_recurring: false,
    },
    // A Statement of Work most formally sits under a signed contract, but in
    // service businesses it commonly follows an accepted proposal or quote
    // (where the signed SOW itself becomes the binding agreement).
    validParentTypes: ["contract", "proposal", "quote"],
  },

  change_order: {
    type: "change_order",
    label: "Change Order",
    description:
      "An amendment to an existing SOW or contract documenting additions, removals, or modifications to agreed scope.",
    icon: "GitMerge",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    prefix: "CO",
    capabilities: {
      // Change orders are legally binding scope amendments — must be signed.
      // No soft accept/decline: both parties execute the change order.
      supports_signature: true,
      supports_client_response: false,
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
    prefix: "NDA",
    capabilities: {
      // NDAs are legally binding confidentiality agreements — must be signed.
      // No soft accept/decline: both parties execute the document.
      supports_signature: true,
      supports_client_response: false,
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
    prefix: "ONB",
    capabilities: {
      // Onboarding forms are intake documents — no signature or acceptance needed.
      supports_signature: false,
      supports_client_response: false,
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
    prefix: "PF",
    capabilities: {
      // Payment reminders are informational — no signature or acceptance needed.
      supports_signature: false,
      supports_client_response: false,
      supports_payment_link: false,
      supports_linking: true,
      supports_recurring: false,
    },
    validParentTypes: ["invoice"],
  },

  recurring_invoice: {
    type: "recurring_invoice",
    label: "Recurring Invoice",
    description:
      "An invoice configured to repeat automatically on a schedule (weekly, monthly, quarterly, etc.) for retainers and subscription billing.",
    icon: "Repeat",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    prefix: "REC",
    capabilities: {
      // Recurring invoices are billing documents like regular invoices — no
      // signature or soft acceptance. They support payment links (Req 14.1)
      // and are the only type flagged as recurring.
      supports_signature: false,
      supports_client_response: false,
      supports_payment_link: true,
      supports_linking: false,
      supports_recurring: true,
    },
    validParentTypes: [],
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

// ─── Reference Number Helpers ─────────────────────────────────────────────────

/**
 * Get the canonical reference number prefix for a document type.
 * Falls back to "DOC" for unknown types so callers always get a non-empty string.
 */
export function getPrefixForType(type: string): string {
  const config = getDocumentTypeConfig(type)
  return config?.prefix ?? "DOC"
}

/**
 * Build a deterministic reference number for a document.
 * Format: `<PREFIX>-<YYYY>-<MM>-<NNN>` (e.g. `INV-2026-05-001`).
 *
 * @param type - Document type (legacy aliases accepted).
 * @param sequence - 1-based count among the user's documents of this type.
 * @param now - Optional date for testing; defaults to today.
 */
export function formatReferenceNumber(
  type: string,
  sequence: number,
  now: Date = new Date()
): string {
  const prefix = getPrefixForType(type)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const padded = String(Math.max(1, Math.floor(sequence))).padStart(3, "0")
  return `${prefix}-${year}-${month}-${padded}`
}

/**
 * Check whether a reference number string starts with the correct prefix
 * for the given document type. Case-sensitive on the prefix; the prefix is
 * always uppercase by convention. Empty/missing strings are considered invalid.
 */
export function isReferenceNumberValid(ref: string | null | undefined, type: string): boolean {
  if (!ref || typeof ref !== "string") return false
  const prefix = getPrefixForType(type)
  return ref.startsWith(`${prefix}-`)
}

/**
 * Coerce an AI-produced reference number to the correct prefix for the
 * given document type. If the AI hallucinated `REM-2026-05-001` for an
 * invoice, this returns `INV-2026-05-001`. If the prefix already matches
 * (or the value is empty/invalid in a way we can't safely fix), returns
 * the original value untouched.
 *
 * Used at persist time so the database always reflects a reference number
 * whose prefix matches the session's `document_type` — regardless of
 * whether the AI assigned it correctly.
 */
export function coerceReferenceNumber(ref: string | null | undefined, type: string): string | null {
  if (!ref || typeof ref !== "string") return ref ?? null
  const targetPrefix = getPrefixForType(type)
  // Strip any leading prefix matching `<LETTERS>-` and replace with the target
  // prefix. We only rewrite when the leading token is alphabetic — leaves
  // arbitrary user-typed numbers like `2026/04` unchanged.
  const match = ref.match(/^([A-Z]{2,6})-(.*)$/i)
  if (!match) return ref
  const currentPrefix = match[1].toUpperCase()
  if (currentPrefix === targetPrefix) return ref
  return `${targetPrefix}-${match[2]}`
}

