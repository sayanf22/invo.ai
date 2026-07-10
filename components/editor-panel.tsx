"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  FileText,
  ScrollText,
  ClipboardList,
  Lightbulb,
  Paperclip,
  Sparkles,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  ImageIcon,
  X,
  Loader2,
  CheckCircle2,
  PenLine,
  RotateCcw,
  FileSignature,
} from "lucide-react"
import { toast } from "sonner"
import type { InvoiceData, LineItem } from "@/lib/invoice-types"
import { useLogoUrl, warmLogoCache, invalidateLogoCache } from "@/hooks/use-logo-url"
import { authFetch } from "@/lib/auth-fetch"
import {
  CURRENCIES,
  PAYMENT_TERMS,
  TAX_LABELS,
  calculateSubtotal,
  formatCurrency,
} from "@/lib/invoice-types"
import { usePaymentMethods } from "@/hooks/use-payment-methods"
import { getDocumentTypeConfig, normalizeDocumentType } from "@/lib/document-type-registry"
import {
  sowSchema,
  changeOrderSchema,
  ndaSchema,
  clientOnboardingFormSchema,
  paymentFollowupSchema,
} from "@/lib/document-schemas"
import { z } from "zod"
import { EditorContextSection } from "@/components/context-manager"
import { OnboardingClientUploads } from "@/components/onboarding-client-uploads"

// ─── Field validation per document type ──────────────────────────────────────

/**
 * Validates required fields for the given document data before export.
 * Returns an array of human-readable missing-field messages, or an empty array
 * when validation passes. Uses the Zod schema for new document types and a
 * simple rule set for the legacy InvoiceData types.
 */
export function validateDocumentForExport(data: InvoiceData): string[] {
  const docType = normalizeDocumentType(data.documentType ?? "")

  // Map the raw InvoiceData context object to each Zod schema and validate
  switch (docType) {
    case "sow": {
      const result = sowSchema.safeParse({
        documentType: "sow",
        title: (data as unknown as Record<string, unknown>).title ?? data.referenceNumber ?? "",
        referenceNumber: data.referenceNumber ?? "",
        projectOverview: (data as unknown as Record<string, unknown>).projectOverview ?? data.description ?? "",
        scopeItems: (data as unknown as Record<string, unknown>).scopeItems ?? [],
        deliverables: (data as unknown as Record<string, unknown>).deliverables ?? [],
        milestones: (data as unknown as Record<string, unknown>).milestones ?? [],
        assumptions: (data as unknown as Record<string, unknown>).assumptions ?? [],
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        fromAddress: data.fromAddress,
        toName: data.toName,
        toEmail: data.toEmail,
        toAddress: data.toAddress,
        effectiveDate: data.invoiceDate,
        currency: data.currency,
      })
      if (!result.success) return formatZodErrors(result.error)
      return []
    }

    case "change_order": {
      const rawData = data as unknown as Record<string, unknown>
      const result = changeOrderSchema.safeParse({
        documentType: "change_order",
        changeOrderNumber: rawData.changeOrderNumber ?? data.invoiceNumber ?? "",
        referenceNumber: data.referenceNumber ?? "",
        parentDocumentId: rawData.parentDocumentId ?? "00000000-0000-0000-0000-000000000000",
        parentDocumentType: rawData.parentDocumentType ?? "contract",
        parentReferenceNumber: rawData.parentReferenceNumber ?? undefined,
        description: rawData.description ?? data.description ?? "",
        additions: rawData.additions ?? [],
        removals: rawData.removals ?? [],
        modifications: rawData.modifications ?? [],
        effectiveDate: data.invoiceDate,
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        fromAddress: data.fromAddress,
        toName: data.toName,
        toEmail: data.toEmail,
        toAddress: data.toAddress,
        currency: data.currency,
      })
      if (!result.success) return formatZodErrors(result.error)
      return []
    }

    case "nda": {
      const rawData = data as unknown as Record<string, unknown>
      const result = ndaSchema.safeParse({
        documentType: "nda",
        referenceNumber: data.referenceNumber ?? "",
        parties: rawData.parties ?? [
          { name: data.fromName, role: "disclosing" },
          { name: data.toName, role: "receiving" },
        ],
        confidentialInfoDefinition: rawData.confidentialInfoDefinition ?? data.description ?? "",
        obligations: rawData.obligations ?? [],
        exclusions: rawData.exclusions ?? [],
        termStart: rawData.termStart ?? data.invoiceDate ?? "",
        termDuration: rawData.termDuration ?? 12,
        termUnit: rawData.termUnit ?? "months",
        governingLaw: rawData.governingLaw ?? "",
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        fromAddress: data.fromAddress,
        toName: data.toName,
        toEmail: data.toEmail,
        toAddress: data.toAddress,
      })
      if (!result.success) return formatZodErrors(result.error)
      return []
    }

    case "client_onboarding_form": {
      const rawData = data as unknown as Record<string, unknown>
      const result = clientOnboardingFormSchema.safeParse({
        documentType: "client_onboarding_form",
        referenceNumber: data.referenceNumber ?? "",
        clientName: data.toName,
        clientEmail: data.toEmail || undefined,
        projectName: rawData.projectName ?? data.referenceNumber ?? "",
        projectDescription: rawData.projectDescription ?? data.description ?? "",
        requirements: rawData.requirements ?? [],
        customQuestions: rawData.customQuestions ?? [],
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        fromAddress: data.fromAddress,
      })
      if (!result.success) return formatZodErrors(result.error)
      return []
    }

    case "payment_followup": {
      const rawData = data as unknown as Record<string, unknown>
      const result = paymentFollowupSchema.safeParse({
        documentType: "payment_followup",
        referenceNumber: data.referenceNumber ?? "",
        linkedInvoiceId: rawData.linkedInvoiceId ?? "00000000-0000-0000-0000-000000000000",
        invoiceNumber: rawData.invoiceNumber ?? data.invoiceNumber ?? "",
        invoiceAmount: rawData.invoiceAmount ?? 0,
        invoiceCurrency: rawData.invoiceCurrency ?? data.currency ?? "USD",
        dueDate: rawData.dueDate ?? data.dueDate ?? "",
        daysOverdue: rawData.daysOverdue ?? 0,
        paymentLinkUrl: rawData.paymentLinkUrl ?? data.paymentLink ?? undefined,
        reminderTone: rawData.reminderTone ?? "polite",
        customMessage: rawData.customMessage ?? data.description ?? "",
        fromName: data.fromName,
        fromEmail: data.fromEmail,
        fromAddress: data.fromAddress,
        toName: data.toName,
        toEmail: data.toEmail,
        toAddress: data.toAddress,
      })
      if (!result.success) return formatZodErrors(result.error)
      return []
    }

    // Legacy InvoiceData types (invoice, contract, quote, quotation, proposal)
    default: {
      const missing: string[] = []
      if (!data.fromName?.trim()) missing.push("Your name / company (From)")
      if (!data.toName?.trim()) missing.push("Client name / company (To)")
      if (!data.documentType) missing.push("Document type")
      // For invoice/quote/proposal: require at least one line item with a description
      const hasLineItems = docType !== "contract"
      if (hasLineItems) {
        const hasValidItem = data.items?.some(
          (i) => i.description?.trim().length > 0 && i.rate > 0
        )
        if (!hasValidItem) missing.push("At least one line item with description and rate")
      } else {
        // Contract: require description field
        if (!data.description?.trim()) missing.push("Contract description / scope")
      }
      return missing
    }
  }
}

/** Converts Zod validation errors into readable field labels */
function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(" › ")
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

const documentTypes = [
  { label: "Invoice", icon: FileText, description: "Bills & payment requests" },
  { label: "Contract", icon: ScrollText, description: "Legal agreements" },
  { label: "Quote", icon: ClipboardList, description: "Price quotes & estimates" },
  { label: "Proposal", icon: Lightbulb, description: "Business proposals" },
]

// ── Logo upload constants ──────────────────────────────────────────────

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const
const MAX_LOGO_SIZE_MB = 5
const MAX_LOGO_SIZE_BYTES = MAX_LOGO_SIZE_MB * 1024 * 1024

/** Returns true if the value looks like an R2 object key (not a data URL or http URL) */
function isR2ObjectKey(value: string): boolean {
  return value.length > 0 && !value.startsWith("data:") && !value.startsWith("http")
}

interface EditorPanelProps {
  data: InvoiceData
  onChange: (updates: Partial<InvoiceData>) => void
  documentStatus?: string
  /** Current document session id — scopes reference-context uploads/retrieval. */
  sessionId?: string
}

/* ─── Reusable Step accordion ─── */
function Step({
  number,
  title,
  isComplete,
  isOpen,
  onToggle,
  children,
}: {
  number: number
  title: string
  isComplete: boolean
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`border border-border rounded-2xl bg-card shadow-sm transition-all duration-200 hover:shadow-md ${isOpen ? "ring-1 ring-primary/15" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/40 active:bg-secondary/60 transition-all duration-150 rounded-2xl active:scale-[0.99]"
      >
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-all duration-200 ${isComplete
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-muted-foreground"
            }`}
        >
          {isComplete ? <Check className="w-3.5 h-3.5" /> : number}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">
          {title}
        </span>
        <div className={`transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "rotate-180" : ""}`}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>
      {/* Smooth height animation via grid-template-rows trick */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Small input field ─── */
function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  optional,
  disabled,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  optional?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1"
      >
        {label}
        {optional && (
          <span className="text-[10px] text-muted-foreground/60 font-normal">
            (optional)
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </div>
  )
}

/* ─── Select field ─── */
function SelectField({
  label,
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  options: readonly string[] | { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-xs font-medium text-muted-foreground mb-1.5 block"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none px-3 py-2 pr-9 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value
            const lab = typeof opt === "string" ? opt : opt.label
            return (
              <option key={val} value={val}>
                {lab}
              </option>
            )
          })}
        </select>
        <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  )
}

// ── Signature Step Component ──────────────────────────────────────────────────
// Handles: saved signature auto-fill, per-document signature, toggle on/off, lock after send

function SignatureStep({
  data,
  onChange,
  isPaid,
  isSent,
}: {
  data: InvoiceData
  onChange: (updates: Partial<InvoiceData>) => void
  isPaid: boolean
  isSent: boolean
}) {
  const [savedSigUrl, setSavedSigUrl] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [showDocPad, setShowDocPad] = useState(false)
  const isLocked = isPaid || isSent

  // Load saved signature from profile on mount
  useEffect(() => {
    let cancelled = false
    authFetch("/api/profile/signature")
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.signatureDataUrl) {
          setSavedSigUrl(d.signatureDataUrl)
          // Auto-fill into document if not already set and user hasn't explicitly turned it off
          // Note: showSenderSignature defaults to `true` (not undefined), so we check !== false
          if (!data.senderSignatureDataUrl && data.showSenderSignature !== false) {
            onChange({ senderSignatureDataUrl: d.signatureDataUrl })
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSaved(false) })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDocSignature = (dataUrl: string) => {
    onChange({ senderSignatureDataUrl: dataUrl, showSenderSignature: true })
    setShowDocPad(false)
  }

  const clearDocSignature = () => {
    onChange({ senderSignatureDataUrl: undefined })
    setShowDocPad(false)
  }

  const toggleShowSignature = () => {
    if (isLocked) return
    const next = data.showSenderSignature === false ? true : false
    // When hiding the signature, also clear the per-document data URL so the
    // preview disappears. The saved profile signature (savedSigUrl) is kept in
    // local state and will be re-applied if the user turns it back on.
    if (!next) {
      onChange({ showSenderSignature: false, senderSignatureDataUrl: undefined })
    } else {
      // Turning back on — re-apply the saved profile signature if available
      onChange({ showSenderSignature: true, ...(savedSigUrl ? { senderSignatureDataUrl: savedSigUrl } : {}) })
    }
  }

  // The active signature for this document
  const activeSignature = data.senderSignatureDataUrl || savedSigUrl

  return (
    <div className="flex flex-col gap-4">
      {/* Lock notice */}
      {isSent && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
          <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Document has been sent — signature is locked and cannot be changed.
          </p>
        </div>
      )}

      {/* Show/hide entire signature section */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">Show signature fields</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.showSignatureFields !== false ? "Signature section visible in PDF" : "Signature section hidden from PDF"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isLocked) return
            onChange({ showSignatureFields: data.showSignatureFields === false ? true : false })
          }}
          disabled={isLocked}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${data.showSignatureFields !== false ? "bg-primary" : "bg-muted"}`}
          aria-label="Toggle signature fields visibility"
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${data.showSignatureFields !== false ? "translate-x-[18px]" : "translate-x-0.5"}`} />
        </button>
      </div>

      {data.showSignatureFields !== false && (
        <>
          {/* Show/hide toggle */}
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <PenLine className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Show my signature on document</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {data.showSenderSignature !== false ? "Your signature will appear in the PDF" : "Signature block will show a blank line"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleShowSignature}
              disabled={isLocked}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${data.showSenderSignature !== false ? "bg-primary" : "bg-muted"}`}
              aria-label="Toggle signature visibility"
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${data.showSenderSignature !== false ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Signature preview / pad */}
          {data.showSenderSignature !== false && (
        <div className="space-y-2">
          {loadingSaved ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading saved signature...
            </div>
          ) : activeSignature && !showDocPad ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {data.senderSignatureDataUrl && data.senderSignatureDataUrl !== savedSigUrl
                  ? "Document-specific signature"
                  : "Using saved profile signature"}
              </p>
              <div className="inline-block border border-border rounded-xl p-2.5 bg-white dark:bg-white/5">
                <img src={activeSignature} alt="Your signature" className="max-w-[180px] max-h-[60px] object-contain" />
              </div>
              {!isLocked && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowDocPad(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/60 transition-colors"
                  >
                    <PenLine className="w-3 h-3" /> Sign differently for this doc
                  </button>
                  {data.senderSignatureDataUrl && data.senderSignatureDataUrl !== savedSigUrl && (
                    <button
                      type="button"
                      onClick={clearDocSignature}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Use profile signature
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : !isLocked ? (
            <div className="space-y-2">
              {!savedSigUrl && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No saved signature found. Draw one below for this document, or{" "}
                  <a href="/profile" target="_blank" className="text-primary hover:underline">save one to your profile</a> to auto-fill on all documents.
                </p>
              )}
              {showDocPad && savedSigUrl && (
                <p className="text-xs text-muted-foreground">Draw a different signature for this document only:</p>
              )}
              <div className="max-w-sm">
                {/* Inline signature pad */}
                <InlineSignaturePad
                  onSignature={handleDocSignature}
                  onCancel={showDocPad ? () => setShowDocPad(false) : undefined}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
        </>
      )}

      {/* Name and title fields */}
      <div className="space-y-2 pt-1 border-t border-border/50">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signature Block Text</p>
        <Field
          id="sig-name"
          label="Full Name"
          value={data.signatureName}
          onChange={(v) => onChange({ signatureName: v })}
          placeholder="e.g. Jane Smith"
          disabled={isLocked}
        />
        <Field
          id="sig-title"
          label="Title / Role"
          value={data.signatureTitle}
          onChange={(v) => onChange({ signatureTitle: v })}
          placeholder="e.g. CEO, Founder"
          optional
          disabled={isLocked}
        />
      </div>

      {/* Client response toggle — quotes and proposals only */}
      {(() => {
        const _normType = normalizeDocumentType(data.documentType ?? "")
        return _normType === "quote" || _normType === "proposal"
      })() && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 shrink-0 flex items-center justify-center text-muted-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Allow client response</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.allowClientResponse !== false
                  ? "Client can Accept / Decline / Request Changes"
                  : "Response buttons hidden from client"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ allowClientResponse: data.allowClientResponse === false ? true : false })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${data.allowClientResponse !== false ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle client response buttons"
          >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${data.allowClientResponse !== false ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Inline Signature Pad (compact version for editor) ─────────────────────────

function InlineSignaturePad({
  onSignature,
  onCancel,
}: {
  onSignature: (dataUrl: string) => void
  onCancel?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ("touches" in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  useEffect(() => { initCanvas() }, [initCanvas])

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    lastPos.current = getPos(e, canvas)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx || !lastPos.current) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasStrokes(true)
  }

  const endDraw = () => { setIsDrawing(false); lastPos.current = null }

  const clear = () => { initCanvas(); setHasStrokes(false) }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSignature(canvas.toDataURL("image/jpeg", 0.8))
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-border overflow-hidden bg-white" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={400}
          height={120}
          className="w-full cursor-crosshair"
          style={{ display: "block" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground/50">Draw your signature here</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!hasStrokes}
          className="flex-1 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5 inline mr-1" /> Apply Signature
        </button>
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          Clear
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Top-level dispatch for `EditorPanel`. For the 6 newer document types (sow,
 * change_order, nda, client_onboarding_form, payment_followup) we render a
 * purpose-built editor. For everything else (invoice, contract, quote,
 * quotation, proposal) we fall through to the legacy
 * layout in `LegacyEditorPanel`.
 *
 * Each branch renders a different component, so React unmounts/remounts when
 * the document type changes — no hooks-order violation.
 */
export function EditorPanel(props: EditorPanelProps) {
  const _typeForDispatch = normalizeDocumentType(
    (props.data.documentType ?? "").toLowerCase()
  )

  if (_typeForDispatch === "sow") return <SOWEditor {...props} />
  if (_typeForDispatch === "change_order") return <ChangeOrderEditor {...props} />
  if (_typeForDispatch === "nda") return <NDAEditor {...props} />
  if (_typeForDispatch === "client_onboarding_form") return <ClientOnboardingFormEditor {...props} />
  if (_typeForDispatch === "payment_followup") return <PaymentFollowupEditor {...props} />

  return <LegacyEditorPanel {...props} />
}

function LegacyEditorPanel({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const { methods: paymentMethods, connectedGateways } = usePaymentMethods()

  // Cached hook — no spinner on repeat visits, instant after upload
  const { url: logoDisplayUrl, loading: logoLoading } = useLogoUrl(data.fromLogo || null)

  // Normalize so both "Quote" and legacy "Quotation" route to the same Quote
  // layout (Task 14.6). The display label is always "Quote" — we no longer
  // surface "Quotation" in the UI.
  const _normalizedDocType = normalizeDocumentType((data.documentType ?? "").toLowerCase())
  const isInvoice = _normalizedDocType === "invoice" || data.documentType === "Invoice"
  const isContract = _normalizedDocType === "contract" || data.documentType === "Contract"
  const isQuote = _normalizedDocType === "quote"
  const isProposal = _normalizedDocType === "proposal" || data.documentType === "Proposal"
  const hasLineItems = !isContract // invoices, quotes, proposals all have items
  // Whether to render the Signature step in the editor.
  // Contracts are signable but use the no-line-items layout, so the existing
  // `hasLineItems` flag was hiding their signature step entirely.
  const supportsSignature = _normalizedDocType
    ? getDocumentTypeConfig(_normalizedDocType)?.capabilities.supports_signature === true
    : isContract // legacy fallback for raw "Contract" string
  const supportsPaymentLink = _normalizedDocType
    ? getDocumentTypeConfig(_normalizedDocType)?.capabilities.supports_payment_link === true
    : data.documentType?.toLowerCase() === "invoice" // fallback for legacy capitalized values
  const step1Complete = data.documentType !== null
  const step2Complete =
    data.fromName.trim().length > 0 && data.toName.trim().length > 0
  const step3Complete = hasLineItems
    ? data.items.some((i) => i.description.trim().length > 0 && i.rate > 0)
    : data.description.trim().length > 0
  const step4Complete = hasLineItems
    ? data.notes.trim().length > 0 ||
    data.terms.trim().length > 0 ||
    data.paymentInstructions.trim().length > 0
    : true
  const step5Complete =
    data.signatureName.trim().length > 0
  // ── Step counting ────────────────────────────────────────────────────────
  // Layouts (in order):
  //   - With line items (invoice/quote/proposal): Type, Parties, Items, Notes, Signature?, Additional
  //     → 5 steps without signature, 6 with (invoice has no signature; quote/proposal/contract do)
  //   - Without line items (contract): Type, Parties, Details, Notes & Terms, Signature?
  //     → 4 steps without signature, 5 with (contract supports signature)
  // The previous logic hard-coded "6 if hasLineItems, 4 otherwise" and ignored
  // supportsSignature, which produced "5/4 steps" for contracts (5 step booleans
  // all true, but totalSteps stuck at 4 because the signature step was hidden).
  const totalSteps = hasLineItems
    ? (supportsSignature ? 6 : 5)
    : (supportsSignature ? 5 : 4)
  const completedFlags = [step1Complete, step2Complete, step3Complete, step4Complete]
  if (supportsSignature) completedFlags.push(step5Complete)
  // Additional Details (step 6) only exists for hasLineItems layouts; its
  // completion mirrors the description field
  if (hasLineItems) completedFlags.push(data.description.trim().length > 0)
  const completedSteps = completedFlags.filter(Boolean).length

  /* ── Line item helpers ── */
  function addItem() {
    const newItem: LineItem = {
      id: String(Date.now()),
      description: "",
      quantity: 1,
      rate: 0,
    }
    onChange({ items: [...data.items, newItem] })
  }

  function removeItem(id: string) {
    if (data.items.length <= 1) return
    onChange({ items: data.items.filter((i) => i.id !== id) })
  }

  function updateItem(id: string, updates: Partial<LineItem>) {
    onChange({
      items: data.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    })
  }

  /* ── Logo upload — compress, show instantly, cache dataUrl for cross-device ── */
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPEG, WebP, or GIF.")
      return
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(`File too large. Maximum size is ${MAX_LOGO_SIZE_MB}MB.`)
      return
    }

    // Show preview immediately
    const blobUrl = URL.createObjectURL(file)

    setIsLogoUploading(true)
    try {
      // Compress before upload — reduces size 60-80%, no quality loss
      const { compressImage } = await import("@/lib/compress-image")
      const compressed = await compressImage(file)

      const formData = new FormData()
      formData.append("file", compressed)
      formData.append("category", "logos")

      const res = await authFetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed.")
      }
      const { objectKey, dataUrl } = await res.json()

      // Cache the server's dataUrl (data: URL) — required for PDF rendering
      // blob: URLs don't work with @react-pdf/renderer
      if (dataUrl) {
        warmLogoCache(objectKey, dataUrl)
      }
      onChange({ fromLogo: objectKey })
    } catch (err: unknown) {
      URL.revokeObjectURL(blobUrl)
      toast.error(err instanceof Error ? err.message : "Logo upload failed.")
    } finally {
      setIsLogoUploading(false)
    }
  }, [onChange])

  const currencyObj =
    CURRENCIES.find((c) => c.code === data.currency) ?? CURRENCIES[0]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel Header — no icon, clean */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 shrink-0 bg-card">
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Document Builder
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedSteps}/{totalSteps} steps
        </span>
      </div>

      {/* Steps — scrollable, flex-1 fills remaining height */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24 flex flex-col gap-3 min-h-0">
        {/* Read-only banner when document is paid */}
        {isPaid && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Invoice Paid</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">This document is read-only. Payment has been received.</p>
            </div>
          </div>
        )}
        {/* ═══ Reference Context (RAG) — teach the AI your document style ═══ */}
        <EditorContextSection sessionId={sessionId} disabled={isPaid || isSent} />

        {/* ═══ Step 1: Document Type, Currency, Branding ═══ */}
        <Step
          number={1}
          title="Document Type"
          isComplete={step1Complete}
          isOpen={openStep === 1}
          onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {documentTypes.map((type) => {
                // Match the active tile by normalized type so legacy "Quotation" highlights "Quote"
                const _typeNorm = normalizeDocumentType(type.label.toLowerCase())
                const isActive = data.documentType === type.label
                  || (_normalizedDocType !== null && _normalizedDocType === _typeNorm)
                return (
                  <button
                    key={type.label}
                    type="button"
                    disabled={isPaid}
                    onClick={() => {
                      if (isPaid) return
                      onChange({ documentType: isActive ? null : type.label })
                      if (!isActive) setOpenStep(2)
                    }}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${isActive
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/30"
                      } ${isPaid ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <type.icon
                      className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {type.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {type.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Currency selector */}
            <div>
              <label
                htmlFor="currency"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Currency
              </label>
              <div className="relative">
                <select
                  id="currency"
                  value={data.currency}
                  onChange={(e) => onChange({ currency: e.target.value })}
                  disabled={isPaid}
                  className="w-full appearance-none px-3 py-2 pr-9 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Logo upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Business Logo{" "}
                <span className="text-[10px] text-muted-foreground/60 font-normal">
                  (optional)
                </span>
              </label>
              {data.fromLogo ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-background">
                    {logoDisplayUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={logoDisplayUrl}
                        alt="Business logo"
                        width={40}
                        height={40}
                        className={`w-10 h-10 object-cover bg-secondary ${data.logoShape === "circle" ? "rounded-full" : "rounded-lg"}`}
                      />
                    ) : logoLoading ? (
                      <div className={`w-10 h-10 bg-secondary flex items-center justify-center ${data.logoShape === "circle" ? "rounded-full" : "rounded-lg"}`}>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 bg-secondary flex items-center justify-center ${data.logoShape === "circle" ? "rounded-full" : "rounded-lg"}`}>
                        <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      Logo uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ fromLogo: "" })}
                      disabled={isPaid}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Remove logo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Logo shape selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Shape:</span>
                    <button
                      type="button"
                      onClick={() => onChange({ logoShape: "rounded" })}
                      disabled={isPaid}
                      className={`w-7 h-7 rounded-md border-2 transition-all ${data.logoShape !== "circle" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"} ${isPaid ? "opacity-60 cursor-not-allowed" : ""}`}
                      aria-label="Rounded square logo"
                      title="Rounded square"
                    >
                      <div className="w-full h-full rounded-[3px] bg-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ logoShape: "circle" })}
                      disabled={isPaid}
                      className={`w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center ${data.logoShape === "circle" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"} ${isPaid ? "opacity-60 cursor-not-allowed" : ""}`}
                      aria-label="Circle logo"
                      title="Circle"
                    >
                      <div className="w-5 h-5 rounded-full bg-muted" />
                    </button>
                  </div>
                  {/* Logo size slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Size:</span>
                      <span className="text-[10px] font-medium text-muted-foreground">{data.logoSize ?? 44}pt</span>
                    </div>
                    <input
                      type="range"
                      min={24}
                      max={96}
                      step={4}
                      value={data.logoSize ?? 44}
                      onChange={(e) => onChange({ logoSize: Number(e.target.value) })}
                      disabled={isPaid}
                      className="w-full h-1.5 rounded-full appearance-none bg-secondary cursor-pointer accent-primary disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label="Logo size"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground/50">
                      <span>Small</span>
                      <span>Large</span>
                    </div>
                  </div>
                  {/* Show on document toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={data.showLogo !== false}
                      onChange={(e) => onChange({ showLogo: e.target.checked })}
                      disabled={isPaid}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs text-muted-foreground">Show logo on document</span>
                  </label>
                </div>
              ) : isLogoUploading ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading logo…</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isPaid}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload logo</span>
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleLogoUpload}
                className="hidden"
                aria-label="Upload business logo"
              />
            </div>
          </div>
        </Step>

        {/* ═══ Step 2: Parties ═══ */}
        <Step
          number={2}
          title="Parties"
          isComplete={step2Complete}
          isOpen={openStep === 2}
          onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
        >
          <div className="flex flex-col gap-4">
            {/* From / Seller */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {isInvoice ? "From (Seller)" : isContract ? "Party A" : "From"}
              </p>
              <Field
                id="from-name"
                label="Name / Company"
                value={data.fromName}
                onChange={(v) => onChange({ fromName: v })}
                placeholder="e.g. Acme Corp"
                disabled={isPaid}
              />
              <Field
                id="from-email"
                label="Email"
                value={data.fromEmail}
                onChange={(v) => onChange({ fromEmail: v })}
                placeholder="billing@acme.com"
                type="email"
                disabled={isPaid}
              />
              <Field
                id="from-address"
                label="Address"
                value={data.fromAddress}
                onChange={(v) => onChange({ fromAddress: v })}
                placeholder="123 Main St, City, Country"
                disabled={isPaid}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="from-phone"
                  label="Phone"
                  value={data.fromPhone}
                  onChange={(v) => onChange({ fromPhone: v })}
                  placeholder="+1 555 000 0000"
                  optional
                  disabled={isPaid}
                />
                <Field
                  id="from-taxid"
                  label="Tax / VAT ID"
                  value={data.fromTaxId}
                  onChange={(v) => onChange({ fromTaxId: v })}
                  placeholder="e.g. GB123456789"
                  optional
                  disabled={isPaid}
                />
              </div>
              <Field
                id="from-website"
                label="Website"
                value={data.fromWebsite}
                onChange={(v) => onChange({ fromWebsite: v })}
                placeholder="https://acme.com"
                optional
                disabled={isPaid}
              />
            </div>

            <div className="border-t border-border" />

            {/* To / Buyer */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {isInvoice ? "Bill To (Buyer)" : isContract ? "Party B" : "To (Client)"}
              </p>
              <Field
                id="to-name"
                label="Name / Company"
                value={data.toName}
                onChange={(v) => onChange({ toName: v })}
                placeholder="e.g. John Doe"
                disabled={isPaid}
              />
              <Field
                id="to-email"
                label="Email"
                value={data.toEmail}
                onChange={(v) => onChange({ toEmail: v })}
                placeholder="john@example.com"
                type="email"
                disabled={isPaid}
              />
              <Field
                id="to-address"
                label="Address"
                value={data.toAddress}
                onChange={(v) => onChange({ toAddress: v })}
                placeholder="456 Elm St, City, Country"
                disabled={isPaid}
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="to-phone"
                  label="Phone"
                  value={data.toPhone}
                  onChange={(v) => onChange({ toPhone: v })}
                  placeholder="+1 555 111 1111"
                  optional
                  disabled={isPaid}
                />
                <Field
                  id="to-taxid"
                  label="Tax / VAT ID"
                  value={data.toTaxId}
                  onChange={(v) => onChange({ toTaxId: v })}
                  placeholder="e.g. US987654321"
                  optional
                  disabled={isPaid}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Document meta */}
            <div className="grid grid-cols-2 gap-2">
              {isInvoice && (
                <Field
                  id="invoice-number"
                  label="Invoice #"
                  value={data.invoiceNumber}
                  onChange={(v) => onChange({ invoiceNumber: v })}
                  placeholder="INV-0001"
                  disabled={isPaid}
                />
              )}
              <Field
                id="reference-number"
                label="Reference / PO #"
                value={data.referenceNumber}
                onChange={(v) => onChange({ referenceNumber: v })}
                placeholder={isInvoice ? "PO-1234" : isQuote ? "QUO-0001" : isProposal ? "PROP-0001" : "CTR-0001"}
                optional={isInvoice}
                disabled={isPaid}
              />
              <Field
                id="invoice-date"
                label={isInvoice ? "Invoice Date" : isQuote ? "Quote Date" : isProposal ? "Proposal Date" : "Date"}
                value={data.invoiceDate}
                onChange={(v) => onChange({ invoiceDate: v })}
                type="date"
                disabled={isPaid}
              />
              {hasLineItems && (
                <Field
                  id="due-date"
                  label={isInvoice ? "Due Date" : "Valid Until"}
                  value={data.dueDate}
                  onChange={(v) => onChange({ dueDate: v })}
                  type="date"
                  disabled={isPaid}
                />
              )}
              {hasLineItems && (
                <SelectField
                  id="payment-terms"
                  label="Payment Terms"
                  value={data.paymentTerms}
                  onChange={(v) => onChange({ paymentTerms: v })}
                  options={PAYMENT_TERMS}
                  disabled={isPaid}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenStep(3)}
              className="text-xs font-medium text-primary hover:underline self-end mt-1"
            >
              Next step
            </button>
          </div>
        </Step>

        {/* ═══ Step 3: Line Items (Invoice/Quotation/Proposal) / Description (Contract) ═══ */}
        {hasLineItems ? (
          <Step
            number={3}
            title="Line Items"
            isComplete={step3Complete}
            isOpen={openStep === 3}
            onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
          >
            <div className="flex flex-col gap-3">
              {/* Card-per-item layout — works on any screen width */}
              {data.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border bg-background p-3 flex flex-col gap-2 transition-shadow hover:shadow-sm active:scale-[0.995]"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder={`Item ${idx + 1} description`}
                      disabled={isPaid}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={data.items.length <= 1 || isPaid}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-90"
                      aria-label={`Remove item ${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground text-center outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Rate ({currencyObj.symbol})</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate || ""}
                        onChange={(e) => updateItem(item.id, { rate: Number(e.target.value) || 0 })}
                        placeholder="0.00"
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Disc %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={item.discount || ""}
                        onChange={(e) => updateItem(item.id, { discount: Number(e.target.value) || 0 })}
                        placeholder="0"
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground text-center outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                disabled={isPaid}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline self-start mt-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add item
              </button>

              {/* Subtotal */}
              <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(calculateSubtotal(data.items), data.currency)}
                </span>
              </div>

              {/* Tax */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={data.taxLabel}
                    onChange={(e) => onChange({ taxLabel: e.target.value })}
                    disabled={isPaid}
                    className="appearance-none px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {TAX_LABELS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">(%)</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={data.taxRate || ""}
                  onChange={(e) =>
                    onChange({ taxRate: Number(e.target.value) || 0 })
                  }
                  placeholder="0"
                  disabled={isPaid}
                  className="w-20 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Discount</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={data.discountType}
                    onChange={(e) =>
                      onChange({
                        discountType: e.target.value as "percent" | "flat",
                      })
                    }
                    disabled={isPaid}
                    className="appearance-none px-2 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-primary/40 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="percent">%</option>
                    <option value="flat">{currencyObj.symbol}</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.discountValue || ""}
                    onChange={(e) =>
                      onChange({ discountValue: Number(e.target.value) || 0 })
                    }
                    placeholder="0"
                    disabled={isPaid}
                    className="w-20 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Shipping */}
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="shipping"
                  className="text-sm text-muted-foreground"
                >
                  Shipping / Delivery
                </label>
                <input
                  id="shipping"
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.shippingFee || ""}
                  onChange={(e) =>
                    onChange({ shippingFee: Number(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  disabled={isPaid}
                  className="w-24 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                onClick={() => setOpenStep(4)}
                className="text-xs font-medium text-primary hover:underline self-end mt-1"
              >
                Next step
              </button>
            </div>
          </Step>
        ) : (
          <Step
            number={3}
            title="Details"
            isComplete={data.description.trim().length > 0}
            isOpen={openStep === 3}
            onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
          >
            <div className="flex flex-col gap-3">
              <textarea
                value={data.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder={
                  data.documentType
                    ? `Describe your ${data.documentType.toLowerCase()} details...`
                    : "Describe the document you need..."
                }
                rows={5}
                disabled={isPaid}
                className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Attach file</span>
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {data.description.length > 0
                    ? `${data.description.length} chars`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenStep(4)}
                className="text-xs font-medium text-primary hover:underline self-end mt-1"
              >
                Next step
              </button>
            </div>
          </Step>
        )}

        {/* ═══ Step 4: Payment & Notes (Items docs) / Notes & Terms (Contract) ═══ */}
        {hasLineItems ? (
          <Step
            number={4}
            title="Payment & Notes"
            isComplete={step4Complete}
            isOpen={openStep === 4}
            onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}
          >
            <div className="flex flex-col gap-4">
              {/* Payment method — shows only connected gateways + base methods */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Payment Method
                </label>
                <div className="relative">
                  <select
                    id="payment-method"
                    value={data.paymentMethod}
                    onChange={(v) => onChange({ paymentMethod: v.target.value })}
                    disabled={isPaid}
                    className="w-full appearance-none px-3 py-2 pr-9 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select payment method</option>
                    {paymentMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Connected gateways info */}
              {connectedGateways.length > 0 ? (
                <p className="text-[10px] text-muted-foreground -mt-2">
                  Connected: {connectedGateways.map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(", ")}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground -mt-2">
                  <a href="/settings?tab=payments" className="text-primary hover:underline">Connect a payment gateway</a> to enable online payments
                </p>
              )}

              {/* Payment link options — only for document types that support payment links (e.g. invoice) */}
              {supportsPaymentLink && (
                <div className="rounded-xl border border-border bg-background p-3 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Payment Link & QR</p>

                  {/* Show payment link in PDF toggle — hidden when document is paid */}
                  {documentStatus !== "paid" && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">Embed payment link in PDF</p>
                        <p className="text-[10px] text-muted-foreground">Shows the payment URL at the bottom of the PDF</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange({ showPaymentLinkInPdf: !data.showPaymentLinkInPdf })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${data.showPaymentLinkInPdf ? "bg-primary" : "bg-muted"}`}
                        aria-label={data.showPaymentLinkInPdf ? "Disable payment link in PDF" : "Enable payment link in PDF"}
                      >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${data.showPaymentLinkInPdf ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  )}

                  {data.paymentLink ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40 border border-border">
                        <span className="text-[11px] font-mono text-foreground/70 truncate flex-1">{data.paymentLink}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                          data.paymentLinkStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
                          data.paymentLinkStatus === "created" ? "bg-blue-100 text-blue-700" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {data.paymentLinkStatus === "paid" ? "Paid ✓" : data.paymentLinkStatus === "created" ? "Pending" : data.paymentLinkStatus || "Active"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        QR code will be auto-generated and embedded in the PDF when you download it.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Use the <span className="font-semibold text-primary">Get Payment Link</span> button in the preview toolbar to create a payment link. It will automatically appear in the PDF with a QR code.
                    </p>
                  )}
                </div>
              )}

              {/* Payment instructions */}
              <div>
                <label
                  htmlFor="payment-instructions"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Payment Instructions
                </label>
                <textarea
                  id="payment-instructions"
                  value={data.paymentInstructions}
                  onChange={(e) =>
                    onChange({ paymentInstructions: e.target.value })
                  }
                  placeholder="Bank: Example Bank&#10;Account: 1234567890&#10;Routing: 021000021&#10;SWIFT: EXAMUS33"
                  rows={4}
                  disabled={isPaid}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed font-mono text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="border-t border-border" />

              {/* Notes */}
              <div>
                <label
                  htmlFor="notes"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Notes (visible to client)
                </label>
                <textarea
                  id="notes"
                  value={data.notes}
                  onChange={(e) => onChange({ notes: e.target.value })}
                  placeholder="e.g. Thank you for your business!"
                  rows={2}
                  disabled={isPaid}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {/* Terms */}
              <div>
                <label
                  htmlFor="terms"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Terms & Conditions
                </label>
                <textarea
                  id="terms"
                  value={data.terms}
                  onChange={(e) => onChange({ terms: e.target.value })}
                  placeholder="e.g. Payment is due within 30 days of issue date..."
                  rows={2}
                  disabled={isPaid}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                onClick={() => setOpenStep(5)}
                className="text-xs font-medium text-primary hover:underline self-end mt-1"
              >
                Next step
              </button>
            </div>
          </Step>
        ) : (
          <Step
            number={4}
            title="Notes & Terms"
            isComplete={
              data.notes.trim().length > 0 || data.terms.trim().length > 0
            }
            isOpen={openStep === 4}
            onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}
          >
            <div className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="notes-gen"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Notes
                </label>
                <textarea
                  id="notes-gen"
                  value={data.notes}
                  onChange={(e) => onChange({ notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  disabled={isPaid}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label
                  htmlFor="terms-gen"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Terms & Conditions
                </label>
                <textarea
                  id="terms-gen"
                  value={data.terms}
                  onChange={(e) => onChange({ terms: e.target.value })}
                  placeholder="Terms and conditions..."
                  rows={2}
                  disabled={isPaid}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </Step>
        )}

        {/* ═══ Step 5: Signature (signable types only) ═══ */}
        {supportsSignature && (
          <Step
            number={5}
            title="Signature"
            isComplete={step5Complete}
            isOpen={openStep === 5}
            onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}
          >
            <SignatureStep
              data={data}
              onChange={onChange}
              isPaid={isPaid}
              isSent={isSent}
            />
          </Step>
        )}

        {/* ═══ Step 6: Additional Details (line-item docs only) ═══ */}
        {hasLineItems && (
          <Step
            number={supportsSignature ? 6 : 5}
            title="Additional Details"
            isComplete={data.description.trim().length > 0}
            isOpen={openStep === (supportsSignature ? 6 : 5)}
            onToggle={() => setOpenStep(openStep === (supportsSignature ? 6 : 5) ? 0 : (supportsSignature ? 6 : 5))}
          >
            <div className="flex flex-col gap-3">
              <textarea
                value={data.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Any additional context or instructions for this invoice..."
                rows={3}
                disabled={isPaid}
                className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </Step>
        )}
      </div>
    </div>
  )
}

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ Type-specific editor components (Tasks 14.1–14.5)                          ║
// ║ These render purpose-built step layouts for the 6 newer document types.   ║
// ║ They share the Step / Field / SelectField / SignatureStep helpers above.  ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * Helper to read/write extension fields on InvoiceData without complaining
 * about the unindexed string | null union. The 6 new doc types stash their
 * type-specific data on the same InvoiceData object via these escape hatches.
 */
type ExtData = InvoiceData & Record<string, unknown>

function getExt<T>(data: InvoiceData, key: string, fallback: T): T {
  const v = (data as ExtData)[key]
  return (v === undefined || v === null) ? fallback : (v as T)
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* ─── Reusable string-array editor (for assumptions/obligations/exclusions) ─── */
function StringArrayEditor({
  label,
  values,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {values.length === 0 && (
        <p className="text-xs text-muted-foreground/70 italic">No items yet.</p>
      )}
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={v}
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              onChange(next)
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            disabled={disabled}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-all"
            aria-label={`Remove ${label} ${i + 1}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ""])}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  )
}

/* ─── Shared Parties block (From/To) ─── */
function PartiesBlock({
  data,
  onChange,
  disabled,
  fromLabel = "From",
  toLabel = "To",
}: {
  data: InvoiceData
  onChange: (u: Partial<InvoiceData>) => void
  disabled?: boolean
  fromLabel?: string
  toLabel?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{fromLabel}</p>
        <Field id="from-name" label="Name / Company" value={data.fromName} onChange={(v) => onChange({ fromName: v })} disabled={disabled} placeholder="e.g. Acme Corp" />
        <Field id="from-email" label="Email" value={data.fromEmail} onChange={(v) => onChange({ fromEmail: v })} disabled={disabled} placeholder="hello@acme.com" type="email" />
        <Field id="from-address" label="Address" value={data.fromAddress} onChange={(v) => onChange({ fromAddress: v })} disabled={disabled} placeholder="123 Main St, City, Country" />
      </div>
      <div className="border-t border-border" />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">{toLabel}</p>
        <Field id="to-name" label="Name / Company" value={data.toName} onChange={(v) => onChange({ toName: v })} disabled={disabled} placeholder="e.g. John Doe" />
        <Field id="to-email" label="Email" value={data.toEmail} onChange={(v) => onChange({ toEmail: v })} disabled={disabled} placeholder="john@example.com" type="email" />
        <Field id="to-address" label="Address" value={data.toAddress} onChange={(v) => onChange({ toAddress: v })} disabled={disabled} placeholder="456 Elm St, City, Country" />
      </div>
    </div>
  )
}

/* ─── Shell wrapper that all type-specific editors use for consistent chrome ─── */
function TypedEditorShell({
  title,
  totalSteps,
  completedSteps,
  isPaid,
  sessionId,
  isLocked,
  children,
}: {
  title: string
  totalSteps: number
  completedSteps: number
  isPaid: boolean
  sessionId?: string
  isLocked?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 shrink-0 bg-card">
        <span className="text-sm font-semibold text-foreground tracking-tight">{title}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedSteps}/{totalSteps} steps
        </span>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24 flex flex-col gap-3 min-h-0">
        {isPaid && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Document is read-only</p>
          </div>
        )}
        {/* Reference Context (RAG) — teach the AI your document style */}
        <EditorContextSection sessionId={sessionId} disabled={isLocked || isPaid} />
        {children}
      </div>
    </div>
  )
}

function ValidateBeforeExportButton({ data, isPaid }: { data: InvoiceData; isPaid: boolean }) {
  // Removed: "Validate before export" was confusing jargon.
  // Validation now happens inline when the user clicks Download.
  return null
}

// ─── 14.1 SOW Editor ──────────────────────────────────────────────────────────

function SOWEditor({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)

  const scopeItems = getExt<Array<{ id: string; title: string; description: string; included: boolean }>>(data, "scopeItems", [])
  const deliverables = getExt<Array<{ id: string; description: string; dueDate?: string; acceptanceCriteria?: string }>>(data, "deliverables", [])
  const milestones = getExt<Array<{ id: string; name: string; date: string; description?: string }>>(data, "milestones", [])
  const assumptions = getExt<string[]>(data, "assumptions", [])
  const projectOverview = getExt<string>(data, "projectOverview", data.description ?? "")
  const title = getExt<string>(data, "title", "")

  const completed = [
    !!data.documentType,
    data.fromName.trim().length > 0 && data.toName.trim().length > 0,
    scopeItems.length > 0 && deliverables.length >= 0 && projectOverview.trim().length > 0,
    milestones.length >= 0,
    data.signatureName.trim().length > 0,
  ].filter(Boolean).length

  return (
    <TypedEditorShell title="SOW Builder" totalSteps={5} completedSteps={completed} isPaid={isPaid} sessionId={sessionId} isLocked={isSent}>
      <Step number={1} title="Document Type" isComplete={!!data.documentType} isOpen={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40">
            <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">Statement of Work</p>
            <p className="text-[11px] text-cyan-700 dark:text-cyan-400 mt-0.5">Detailed scope, deliverables and milestones — typically issued under a parent contract.</p>
          </div>
          <Field id="sow-title" label="Title" value={title} onChange={(v) => onChange({ title: v } as Partial<InvoiceData>)} placeholder="e.g. Website Redesign — Statement of Work" disabled={isPaid} />
          <Field id="sow-ref" label="Reference Number" value={data.referenceNumber} onChange={(v) => onChange({ referenceNumber: v })} placeholder="SOW-0001" disabled={isPaid} />
          <SelectField id="sow-currency" label="Currency" value={data.currency} onChange={(v) => onChange({ currency: v })} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))} disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(2)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={2} title="Parties" isComplete={data.fromName.trim().length > 0 && data.toName.trim().length > 0} isOpen={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
        <div className="flex flex-col gap-3">
          <PartiesBlock data={data} onChange={onChange} disabled={isPaid} fromLabel="Service Provider" toLabel="Client" />
          <button
            type="button"
            onClick={() => setOpenStep(3)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={3} title="Scope & Deliverables" isComplete={scopeItems.length > 0 && projectOverview.trim().length > 0} isOpen={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Overview</label>
            <textarea
              value={projectOverview}
              onChange={(e) => onChange({ projectOverview: e.target.value, description: e.target.value } as Partial<InvoiceData>)}
              rows={3}
              disabled={isPaid}
              placeholder="High-level summary of the work to be performed..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scope Items</p>
            {scopeItems.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) => {
                      const next = [...scopeItems]; next[i] = { ...s, title: e.target.value }
                      onChange({ scopeItems: next } as Partial<InvoiceData>)
                    }}
                    placeholder="Scope item title"
                    disabled={isPaid}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={s.included}
                      onChange={(e) => {
                        const next = [...scopeItems]; next[i] = { ...s, included: e.target.checked }
                        onChange({ scopeItems: next } as Partial<InvoiceData>)
                      }}
                      disabled={isPaid}
                    />
                    Included
                  </label>
                  <button type="button" onClick={() => onChange({ scopeItems: scopeItems.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  value={s.description}
                  onChange={(e) => {
                    const next = [...scopeItems]; next[i] = { ...s, description: e.target.value }
                    onChange({ scopeItems: next } as Partial<InvoiceData>)
                  }}
                  rows={2}
                  placeholder="Describe what's included in this scope item..."
                  disabled={isPaid}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ scopeItems: [...scopeItems, { id: genId(), title: "", description: "", included: true }] } as Partial<InvoiceData>)}
              disabled={isPaid}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Add scope item
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Deliverables</p>
            {deliverables.map((d, i) => (
              <div key={d.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d.description}
                    onChange={(e) => {
                      const next = [...deliverables]; next[i] = { ...d, description: e.target.value }
                      onChange({ deliverables: next } as Partial<InvoiceData>)
                    }}
                    placeholder="Deliverable description"
                    disabled={isPaid}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                  />
                  <button type="button" onClick={() => onChange({ deliverables: deliverables.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`del-due-${d.id}`} label="Due date" value={d.dueDate ?? ""} onChange={(v) => {
                    const next = [...deliverables]; next[i] = { ...d, dueDate: v }
                    onChange({ deliverables: next } as Partial<InvoiceData>)
                  }} type="date" optional disabled={isPaid} />
                  <Field id={`del-ac-${d.id}`} label="Acceptance criteria" value={d.acceptanceCriteria ?? ""} onChange={(v) => {
                    const next = [...deliverables]; next[i] = { ...d, acceptanceCriteria: v }
                    onChange({ deliverables: next } as Partial<InvoiceData>)
                  }} optional disabled={isPaid} />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ deliverables: [...deliverables, { id: genId(), description: "" }] } as Partial<InvoiceData>)}
              disabled={isPaid}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Add deliverable
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(4)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={4} title="Milestones" isComplete={milestones.length > 0} isOpen={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
        <div className="flex flex-col gap-3">
          {milestones.map((m, i) => (
            <div key={m.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => {
                    const next = [...milestones]; next[i] = { ...m, name: e.target.value }
                    onChange({ milestones: next } as Partial<InvoiceData>)
                  }}
                  placeholder="Milestone name"
                  disabled={isPaid}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                />
                <button type="button" onClick={() => onChange({ milestones: milestones.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field id={`ms-date-${m.id}`} label="Date" value={m.date} onChange={(v) => {
                  const next = [...milestones]; next[i] = { ...m, date: v }
                  onChange({ milestones: next } as Partial<InvoiceData>)
                }} type="date" disabled={isPaid} />
                <Field id={`ms-desc-${m.id}`} label="Description" value={m.description ?? ""} onChange={(v) => {
                  const next = [...milestones]; next[i] = { ...m, description: v }
                  onChange({ milestones: next } as Partial<InvoiceData>)
                }} optional disabled={isPaid} />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ milestones: [...milestones, { id: genId(), name: "", date: "" }] } as Partial<InvoiceData>)}
            disabled={isPaid}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add milestone
          </button>
          <div className="border-t border-border pt-3">
            <StringArrayEditor
              label="Assumptions"
              values={assumptions}
              onChange={(next) => onChange({ assumptions: next } as Partial<InvoiceData>)}
              placeholder="e.g. Client provides content within 5 business days"
              disabled={isPaid}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(5)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={5} title="Terms & Signature" isComplete={data.signatureName.trim().length > 0} isOpen={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Terms</label>
            <textarea
              value={data.terms}
              onChange={(e) => onChange({ terms: e.target.value })}
              rows={3}
              disabled={isPaid}
              placeholder="Payment terms, change-control process, IP ownership..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
          <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
        </div>
      </Step>

      <ValidateBeforeExportButton data={data} isPaid={isPaid} />
    </TypedEditorShell>
  )
}

// ─── 14.2 Change Order Editor ────────────────────────────────────────────────

function ChangeOrderEditor({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)

  const additions = getExt<Array<{ id: string; description: string; cost?: number }>>(data, "additions", [])
  const removals = getExt<Array<{ id: string; description: string; costReduction?: number }>>(data, "removals", [])
  const modifications = getExt<Array<{ id: string; original: string; revised: string; costImpact?: number }>>(data, "modifications", [])
  const parentDocumentId = getExt<string>(data, "parentDocumentId", "")
  const parentDocumentType = getExt<"sow" | "contract">(data, "parentDocumentType", "contract")
  const parentReferenceNumber = getExt<string>(data, "parentReferenceNumber", "")
  const changeOrderNumber = getExt<string>(data, "changeOrderNumber", data.invoiceNumber ?? "")
  const description = getExt<string>(data, "description", data.description ?? "")
  const timelineImpact = getExt<string>(data, "timelineImpact", "")

  const completed = [
    !!data.documentType,
    !!parentDocumentId,
    description.trim().length > 0,
    additions.length + removals.length + modifications.length > 0,
    data.signatureName.trim().length > 0,
  ].filter(Boolean).length

  return (
    <TypedEditorShell title="Change Order Builder" totalSteps={5} completedSteps={completed} isPaid={isPaid} sessionId={sessionId} isLocked={isSent}>
      <Step number={1} title="Document Type" isComplete={!!data.documentType} isOpen={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
            <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">Change Order</p>
            <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-0.5">Amendment to an existing SOW or contract.</p>
          </div>
          <Field id="co-number" label="Change Order #" value={changeOrderNumber} onChange={(v) => onChange({ changeOrderNumber: v, invoiceNumber: v } as Partial<InvoiceData>)} placeholder="CO-001" disabled={isPaid} />
          <Field id="co-ref" label="Reference Number" value={data.referenceNumber} onChange={(v) => onChange({ referenceNumber: v })} placeholder="REF-0001" disabled={isPaid} />
          <SelectField id="co-currency" label="Currency" value={data.currency} onChange={(v) => onChange({ currency: v })} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` }))} disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(2)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={2} title="Parent Reference" isComplete={!!parentDocumentId} isOpen={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Linked Document (read-only)</p>
            <p className="text-sm font-medium text-foreground">
              {parentReferenceNumber || "No parent linked"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Type: {parentDocumentType.toUpperCase()} {parentDocumentId && <>· ID: {parentDocumentId.slice(0, 8)}…</>}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            The parent reference is set when this change order is created from a parent SOW/contract. To link a different parent, regenerate the change order from the parent document.
          </p>
          <PartiesBlock data={data} onChange={onChange} disabled={isPaid} fromLabel="Service Provider" toLabel="Client" />
          <button
            type="button"
            onClick={() => setOpenStep(3)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={3} title="Changes" isComplete={additions.length + removals.length + modifications.length > 0} isOpen={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description / Reason</label>
            <textarea
              value={description}
              onChange={(e) => onChange({ description: e.target.value } as Partial<InvoiceData>)}
              rows={2}
              disabled={isPaid}
              placeholder="Why is this change order needed?"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>

          {/* Additions */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Additions</p>
            {additions.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2">
                <input type="text" value={a.description} onChange={(e) => {
                  const next = [...additions]; next[i] = { ...a, description: e.target.value }
                  onChange({ additions: next } as Partial<InvoiceData>)
                }} placeholder="What's being added" disabled={isPaid} className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60" />
                <input type="number" value={a.cost ?? ""} onChange={(e) => {
                  const next = [...additions]; next[i] = { ...a, cost: e.target.value === "" ? undefined : Number(e.target.value) }
                  onChange({ additions: next } as Partial<InvoiceData>)
                }} placeholder="Cost" disabled={isPaid} className="w-24 px-2 py-2 rounded-lg border border-border bg-background text-sm text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60" />
                <button type="button" onClick={() => onChange({ additions: additions.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ additions: [...additions, { id: genId(), description: "" }] } as Partial<InvoiceData>)} disabled={isPaid} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add addition
            </button>
          </div>

          {/* Removals */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Removals</p>
            {removals.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <input type="text" value={r.description} onChange={(e) => {
                  const next = [...removals]; next[i] = { ...r, description: e.target.value }
                  onChange({ removals: next } as Partial<InvoiceData>)
                }} placeholder="What's being removed" disabled={isPaid} className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60" />
                <input type="number" value={r.costReduction ?? ""} onChange={(e) => {
                  const next = [...removals]; next[i] = { ...r, costReduction: e.target.value === "" ? undefined : Number(e.target.value) }
                  onChange({ removals: next } as Partial<InvoiceData>)
                }} placeholder="Reduction" disabled={isPaid} className="w-24 px-2 py-2 rounded-lg border border-border bg-background text-sm text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 disabled:opacity-60" />
                <button type="button" onClick={() => onChange({ removals: removals.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ removals: [...removals, { id: genId(), description: "" }] } as Partial<InvoiceData>)} disabled={isPaid} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add removal
            </button>
          </div>

          {/* Modifications */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Modifications</p>
            {modifications.map((m, i) => (
              <div key={m.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2 justify-end">
                  <button type="button" onClick={() => onChange({ modifications: modifications.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Field id={`mod-orig-${m.id}`} label="Original" value={m.original} onChange={(v) => {
                  const next = [...modifications]; next[i] = { ...m, original: v }
                  onChange({ modifications: next } as Partial<InvoiceData>)
                }} disabled={isPaid} />
                <Field id={`mod-rev-${m.id}`} label="Revised" value={m.revised} onChange={(v) => {
                  const next = [...modifications]; next[i] = { ...m, revised: v }
                  onChange({ modifications: next } as Partial<InvoiceData>)
                }} disabled={isPaid} />
                <Field id={`mod-cost-${m.id}`} label="Cost impact" value={m.costImpact?.toString() ?? ""} onChange={(v) => {
                  const next = [...modifications]; next[i] = { ...m, costImpact: v === "" ? undefined : Number(v) }
                  onChange({ modifications: next } as Partial<InvoiceData>)
                }} type="number" optional disabled={isPaid} />
              </div>
            ))}
            <button type="button" onClick={() => onChange({ modifications: [...modifications, { id: genId(), original: "", revised: "" }] } as Partial<InvoiceData>)} disabled={isPaid} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add modification
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(4)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={4} title="Impact" isComplete={timelineImpact.trim().length > 0} isOpen={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Timeline Impact</label>
            <textarea
              value={timelineImpact}
              onChange={(e) => onChange({ timelineImpact: e.target.value } as Partial<InvoiceData>)}
              rows={2}
              disabled={isPaid}
              placeholder="e.g. Project completion extended by 2 weeks"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
          <Field id="co-effective" label="Effective Date" value={data.invoiceDate} onChange={(v) => onChange({ invoiceDate: v })} type="date" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(5)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={5} title="Signature" isComplete={data.signatureName.trim().length > 0} isOpen={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
        <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
      </Step>

      <ValidateBeforeExportButton data={data} isPaid={isPaid} />
    </TypedEditorShell>
  )
}

// ─── 14.3 NDA Editor ──────────────────────────────────────────────────────────

function NDAEditor({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)

  const parties = getExt<Array<{ name: string; role: "disclosing" | "receiving" | "mutual"; address?: string; representative?: string }>>(data, "parties", [
    { name: data.fromName || "", role: "disclosing" },
    { name: data.toName || "", role: "receiving" },
  ])
  const confidentialInfoDefinition = getExt<string>(data, "confidentialInfoDefinition", data.description ?? "")
  const obligations = getExt<string[]>(data, "obligations", [])
  const exclusions = getExt<string[]>(data, "exclusions", [])
  const termDuration = getExt<number>(data, "termDuration", 12)
  const termUnit = getExt<"months" | "years">(data, "termUnit", "months")
  const termStart = getExt<string>(data, "termStart", data.invoiceDate ?? "")
  const governingLaw = getExt<string>(data, "governingLaw", "")

  const completed = [
    !!data.documentType,
    parties.length >= 2 && parties.every((p) => p.name.trim().length > 0),
    confidentialInfoDefinition.trim().length > 0,
    obligations.length > 0 && termStart.length > 0,
    data.signatureName.trim().length > 0,
  ].filter(Boolean).length

  const updateParty = (i: number, patch: Partial<(typeof parties)[number]>) => {
    const next = [...parties]; next[i] = { ...next[i], ...patch }
    onChange({ parties: next } as Partial<InvoiceData>)
  }

  return (
    <TypedEditorShell title="NDA Builder" totalSteps={5} completedSteps={completed} isPaid={isPaid} sessionId={sessionId} isLocked={isSent}>
      <Step number={1} title="Document Type" isComplete={!!data.documentType} isOpen={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/40">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-300">Non-Disclosure Agreement</p>
            <p className="text-[11px] text-slate-700 dark:text-slate-400 mt-0.5">Protects confidential information shared between parties.</p>
          </div>
          <Field id="nda-ref" label="Reference Number" value={data.referenceNumber} onChange={(v) => onChange({ referenceNumber: v })} placeholder="NDA-0001" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(2)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={2} title="Parties" isComplete={parties.length >= 2 && parties.every((p) => p.name.trim().length > 0)} isOpen={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
        <div className="flex flex-col gap-3">
          {parties.map((p, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Party {i + 1}</span>
                <span className="ml-auto" />
                {parties.length > 2 && (
                  <button type="button" onClick={() => onChange({ parties: parties.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <Field id={`p-name-${i}`} label="Name / Company" value={p.name} onChange={(v) => updateParty(i, { name: v })} disabled={isPaid} />
              <SelectField id={`p-role-${i}`} label="Role" value={p.role} onChange={(v) => updateParty(i, { role: v as "disclosing" | "receiving" | "mutual" })} options={[
                { value: "disclosing", label: "Disclosing" },
                { value: "receiving", label: "Receiving" },
                { value: "mutual", label: "Mutual" },
              ]} disabled={isPaid} />
              <Field id={`p-addr-${i}`} label="Address" value={p.address ?? ""} onChange={(v) => updateParty(i, { address: v })} optional disabled={isPaid} />
              <Field id={`p-rep-${i}`} label="Representative" value={p.representative ?? ""} onChange={(v) => updateParty(i, { representative: v })} optional disabled={isPaid} />
            </div>
          ))}
          {parties.length < 4 && (
            <button type="button" onClick={() => onChange({ parties: [...parties, { name: "", role: "receiving" as const }] } as Partial<InvoiceData>)} disabled={isPaid} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add party
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenStep(3)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={3} title="Confidential Information" isComplete={confidentialInfoDefinition.trim().length > 0} isOpen={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Definition of Confidential Information</label>
            <textarea
              value={confidentialInfoDefinition}
              onChange={(e) => onChange({ confidentialInfoDefinition: e.target.value, description: e.target.value } as Partial<InvoiceData>)}
              rows={4}
              disabled={isPaid}
              placeholder="Describe what information is considered confidential..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
          <StringArrayEditor label="Obligations" values={obligations} onChange={(next) => onChange({ obligations: next } as Partial<InvoiceData>)} placeholder="e.g. Use the information only for the stated purpose" disabled={isPaid} />
          <StringArrayEditor label="Exclusions" values={exclusions} onChange={(next) => onChange({ exclusions: next } as Partial<InvoiceData>)} placeholder="e.g. Information already in the public domain" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(4)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={4} title="Terms & Duration" isComplete={obligations.length > 0 && termStart.length > 0} isOpen={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field id="nda-term-start" label="Term Start" value={termStart} onChange={(v) => onChange({ termStart: v, invoiceDate: v } as Partial<InvoiceData>)} type="date" disabled={isPaid} />
            <Field id="nda-term-duration" label="Duration" value={String(termDuration)} onChange={(v) => onChange({ termDuration: Number(v) || 0 } as Partial<InvoiceData>)} type="number" disabled={isPaid} />
          </div>
          <SelectField id="nda-term-unit" label="Duration Unit" value={termUnit} onChange={(v) => onChange({ termUnit: v as "months" | "years" } as Partial<InvoiceData>)} options={[
            { value: "months", label: "Months" },
            { value: "years", label: "Years" },
          ]} disabled={isPaid} />
          <Field id="nda-law" label="Governing Law" value={governingLaw} onChange={(v) => onChange({ governingLaw: v } as Partial<InvoiceData>)} placeholder="e.g. State of California, USA" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(5)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={5} title="Signature" isComplete={data.signatureName.trim().length > 0} isOpen={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
        <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
      </Step>

      <ValidateBeforeExportButton data={data} isPaid={isPaid} />
    </TypedEditorShell>
  )
}

// ─── 14.4 Client Onboarding Form Editor ──────────────────────────────────────

function ClientOnboardingFormEditor({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)

  const customQuestions = getExt<Array<{ id: string; question: string; answer: string }>>(data, "customQuestions", [])
  const requirements = getExt<string[]>(data, "requirements", [])
  const projectName = getExt<string>(data, "projectName", "")
  const projectDescription = getExt<string>(data, "projectDescription", data.description ?? "")
  const timelinePreference = getExt<string>(data, "timelinePreference", "")
  const budgetRange = getExt<string>(data, "budgetRange", "")
  const assetUploadLink = getExt<string>(data, "assetUploadLink", "")

  const completed = [
    !!data.documentType,
    data.toName.trim().length > 0,
    customQuestions.length > 0 || requirements.length > 0,
    projectName.trim().length > 0,
  ].filter(Boolean).length

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= customQuestions.length) return
    const next = [...customQuestions]
    const tmp = next[i]; next[i] = next[j]; next[j] = tmp
    onChange({ customQuestions: next } as Partial<InvoiceData>)
  }

  return (
    <TypedEditorShell title="Onboarding Form Builder" totalSteps={5} completedSteps={completed} isPaid={isPaid} sessionId={sessionId} isLocked={isSent}>
      <OnboardingClientUploads sessionId={sessionId} />
      <Step number={1} title="Document Type" isComplete={!!data.documentType} isOpen={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
            <p className="text-xs font-semibold text-foreground">Client Onboarding Form</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Intake form to collect structured client details and project requirements.</p>
          </div>
          <Field id="cof-ref" label="Reference Number" value={data.referenceNumber} onChange={(v) => onChange({ referenceNumber: v })} placeholder="ONB-0001" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(2)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={2} title="Client Details" isComplete={data.toName.trim().length > 0} isOpen={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">From (You)</p>
            <Field id="cof-from-name" label="Name / Company" value={data.fromName} onChange={(v) => onChange({ fromName: v })} disabled={isPaid} />
            <Field id="cof-from-email" label="Email" value={data.fromEmail} onChange={(v) => onChange({ fromEmail: v })} type="email" disabled={isPaid} />
          </div>
          <div className="border-t border-border" />
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Client</p>
            <Field id="cof-client-name" label="Client Name" value={data.toName} onChange={(v) => onChange({ toName: v })} placeholder="e.g. Jane Doe" disabled={isPaid} />
            <Field id="cof-client-email" label="Client Email" value={data.toEmail} onChange={(v) => onChange({ toEmail: v })} optional type="email" disabled={isPaid} />
            <Field id="cof-client-phone" label="Client Phone" value={data.toPhone} onChange={(v) => onChange({ toPhone: v })} optional disabled={isPaid} />
            <Field id="cof-client-address" label="Client Address" value={data.toAddress} onChange={(v) => onChange({ toAddress: v })} optional disabled={isPaid} />
          </div>
          <div className="border-t border-border" />
          <Field id="cof-project-name" label="Project Name" value={projectName} onChange={(v) => onChange({ projectName: v } as Partial<InvoiceData>)} placeholder="e.g. Website Redesign" disabled={isPaid} />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Project Description</label>
            <textarea
              value={projectDescription}
              onChange={(e) => onChange({ projectDescription: e.target.value, description: e.target.value } as Partial<InvoiceData>)}
              rows={3}
              disabled={isPaid}
              placeholder="High-level project overview..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field id="cof-timeline" label="Timeline Preference" value={timelinePreference} onChange={(v) => onChange({ timelinePreference: v } as Partial<InvoiceData>)} optional placeholder="e.g. 6 weeks" disabled={isPaid} />
            <Field id="cof-budget" label="Budget Range" value={budgetRange} onChange={(v) => onChange({ budgetRange: v } as Partial<InvoiceData>)} optional placeholder="e.g. $5-10k" disabled={isPaid} />
          </div>
          <div className="border-t border-border" />
          <div>
            <Field
              id="cof-asset-link"
              label="Client Asset Upload Link"
              value={assetUploadLink}
              onChange={(v) => onChange({ assetUploadLink: v })}
              optional
              placeholder="https://drive.google.com/… or Dropbox link"
              disabled={isPaid}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Paste a Google Drive / Dropbox folder link. Your client sees a &ldquo;Drop your assets here&rdquo; button that opens it — no login needed on your side.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(3)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={3} title="Questions" isComplete={customQuestions.length > 0 || requirements.length > 0} isOpen={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
        <div className="flex flex-col gap-4">
          <StringArrayEditor label="Requirements" values={requirements} onChange={(next) => onChange({ requirements: next } as Partial<InvoiceData>)} placeholder="e.g. Mobile-responsive design" disabled={isPaid} />
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Custom Questions</p>
            {customQuestions.map((q, i) => (
              <div key={q.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                  <span className="ml-auto" />
                  <button type="button" onClick={() => moveQuestion(i, -1)} disabled={isPaid || i === 0} className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveQuestion(i, 1)} disabled={isPaid || i === customQuestions.length - 1} className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => onChange({ customQuestions: customQuestions.filter((_, j) => j !== i) } as Partial<InvoiceData>)} disabled={isPaid} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Field id={`q-${q.id}`} label="Question" value={q.question} onChange={(v) => {
                  const next = [...customQuestions]; next[i] = { ...q, question: v }
                  onChange({ customQuestions: next } as Partial<InvoiceData>)
                }} disabled={isPaid} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Answer</label>
                  <textarea
                    value={q.answer}
                    onChange={(e) => {
                      const next = [...customQuestions]; next[i] = { ...q, answer: e.target.value }
                      onChange({ customQuestions: next } as Partial<InvoiceData>)
                    }}
                    rows={2}
                    disabled={isPaid}
                    placeholder="Client's answer..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
                  />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => onChange({ customQuestions: [...customQuestions, { id: genId(), question: "", answer: "" }] } as Partial<InvoiceData>)} disabled={isPaid} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Add question
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(4)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={4} title="Summary" isComplete={projectName.trim().length > 0} isOpen={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Onboarding Summary</p>
            <p className="text-sm font-medium text-foreground">{projectName || "(no project name)"}</p>
            <p className="text-xs text-muted-foreground">{requirements.length} requirements · {customQuestions.length} questions answered</p>
            {timelinePreference && <p className="text-xs text-muted-foreground">Timeline: {timelinePreference}</p>}
            {budgetRange && <p className="text-xs text-muted-foreground">Budget: {budgetRange}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notes</label>
            <textarea
              value={data.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={3}
              disabled={isPaid}
              placeholder="Any additional notes for this onboarding..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
          </div>
        </div>
      </Step>

      <Step number={5} title="Signature" isComplete={data.signatureName.trim().length > 0} isOpen={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
        <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
      </Step>

      <ValidateBeforeExportButton data={data} isPaid={isPaid} />
    </TypedEditorShell>
  )
}

// ─── 14.5 Payment Follow-up Editor ───────────────────────────────────────────

function PaymentFollowupEditor({ data, onChange, documentStatus, sessionId }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const isSent = documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"
  const [openStep, setOpenStep] = useState(1)

  const linkedInvoiceId = getExt<string>(data, "linkedInvoiceId", "")
  const invoiceNumber = getExt<string>(data, "invoiceNumber", data.invoiceNumber ?? "")
  const invoiceAmount = getExt<number>(data, "invoiceAmount", 0)
  const invoiceCurrency = getExt<string>(data, "invoiceCurrency", data.currency ?? "USD")
  const dueDate = getExt<string>(data, "dueDate", data.dueDate ?? "")
  const daysOverdue = getExt<number>(data, "daysOverdue", 0)
  const paymentLinkUrl = getExt<string>(data, "paymentLinkUrl", data.paymentLink ?? "")
  const reminderTone = getExt<"polite" | "firm" | "urgent">(data, "reminderTone", "polite")
  const customMessage = getExt<string>(data, "customMessage", data.description ?? "")

  const completed = [
    !!data.documentType,
    !!linkedInvoiceId,
    customMessage.trim().length > 0,
  ].filter(Boolean).length

  return (
    <TypedEditorShell title="Payment Follow-up Builder" totalSteps={5} completedSteps={completed} isPaid={isPaid} sessionId={sessionId} isLocked={isSent}>
      <Step number={1} title="Document Type" isComplete={!!data.documentType} isOpen={openStep === 1} onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Payment Follow-up</p>
            <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">Reminder for an unpaid invoice — references the original invoice details.</p>
          </div>
          <Field id="pf-ref" label="Reference Number" value={data.referenceNumber} onChange={(v) => onChange({ referenceNumber: v })} placeholder="PF-2026-05-001" disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(2)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={2} title="Invoice Reference" isComplete={!!linkedInvoiceId} isOpen={openStep === 2} onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}>
        <div className="flex flex-col gap-3">
          <div className="px-3 py-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Linked Invoice (read-only)</p>
            <p className="text-sm font-medium text-foreground">
              {invoiceNumber || "—"}
              {invoiceAmount > 0 && (
                <span className="ml-2 text-muted-foreground">
                  · {formatCurrency(invoiceAmount, invoiceCurrency)}
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {dueDate && <>Due: {dueDate}</>}
              {daysOverdue > 0 && <span className="ml-2 text-rose-600 dark:text-rose-400">· {daysOverdue} days overdue</span>}
            </p>
            {paymentLinkUrl && (
              <p className="text-[11px] text-muted-foreground truncate">
                <span className="font-medium">Link:</span> {paymentLinkUrl}
              </p>
            )}
            {linkedInvoiceId && (
              <p className="text-[10px] text-muted-foreground/70">ID: {linkedInvoiceId.slice(0, 8)}…</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            The invoice link is set automatically when this follow-up is generated from a parent invoice. To target a different invoice, regenerate from that invoice.
          </p>
          <PartiesBlock data={data} onChange={onChange} disabled={isPaid} />
          <button
            type="button"
            onClick={() => setOpenStep(3)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={3} title="Reminder Settings" isComplete={!!reminderTone} isOpen={openStep === 3} onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tone</label>
            <div className="grid grid-cols-3 gap-2">
              {(["polite", "firm", "urgent"] as const).map((tone) => {
                const active = reminderTone === tone
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => onChange({ reminderTone: tone } as Partial<InvoiceData>)}
                    disabled={isPaid}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium capitalize transition-all ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/30"} disabled:opacity-60`}
                  >
                    {tone}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {reminderTone === "polite" && "Friendly nudge. Best for first reminders."}
              {reminderTone === "firm" && "Direct and clear. Use after the first nudge has been ignored."}
              {reminderTone === "urgent" && "Strong language. Reserve for significantly overdue invoices."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpenStep(4)}
            className="text-xs font-medium text-primary hover:underline self-end mt-1"
          >
            Next step
          </button>
        </div>
      </Step>

      <Step number={4} title="Message" isComplete={customMessage.trim().length > 0} isOpen={openStep === 4} onToggle={() => setOpenStep(openStep === 4 ? 0 : 4)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom Message</label>
            <textarea
              value={customMessage}
              onChange={(e) => onChange({ customMessage: e.target.value, description: e.target.value } as Partial<InvoiceData>)}
              rows={6}
              disabled={isPaid}
              maxLength={2000}
              placeholder="Hi [Client], just a friendly reminder that invoice [number] for [amount] is now [days] days past due..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-none disabled:opacity-60"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              {customMessage.length}/2000
            </p>
          </div>
        </div>
      </Step>

      <Step number={5} title="Signature" isComplete={data.signatureName.trim().length > 0} isOpen={openStep === 5} onToggle={() => setOpenStep(openStep === 5 ? 0 : 5)}>
        <SignatureStep data={data} onChange={onChange} isPaid={isPaid} isSent={isSent} />
      </Step>

      <ValidateBeforeExportButton data={data} isPaid={isPaid} />
    </TypedEditorShell>
  )
}
