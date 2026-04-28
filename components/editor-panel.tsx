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

const documentTypes = [
  { label: "Invoice", icon: FileText, description: "Bills & payment requests" },
  { label: "Contract", icon: ScrollText, description: "Legal agreements" },
  { label: "Quotation", icon: ClipboardList, description: "Price quotes & estimates" },
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
          // Auto-fill into document if not already set and showSenderSignature is true
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
    onChange({ showSenderSignature: next })
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

export function EditorPanel({ data, onChange, documentStatus }: EditorPanelProps) {
  const isPaid = documentStatus === "paid"
  const [openStep, setOpenStep] = useState(1)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [isLogoUploading, setIsLogoUploading] = useState(false)
  const { methods: paymentMethods, connectedGateways } = usePaymentMethods()

  // Cached hook — no spinner on repeat visits, instant after upload
  const { url: logoDisplayUrl, loading: logoLoading } = useLogoUrl(data.fromLogo || null)

  const isInvoice = data.documentType === "Invoice"
  const isContract = data.documentType === "Contract"
  const hasLineItems = !isContract // invoices, quotations, proposals all have items
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
  const totalSteps = hasLineItems ? 6 : 4
  const completedSteps = [
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
    step5Complete,
  ].filter(Boolean).length

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
                const isActive = data.documentType === type.label
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
                placeholder={isInvoice ? "PO-1234" : data.documentType === "Quotation" ? "QUO-0001" : data.documentType === "Proposal" ? "PROP-0001" : "CTR-0001"}
                optional={isInvoice}
                disabled={isPaid}
              />
              <Field
                id="invoice-date"
                label={isInvoice ? "Invoice Date" : data.documentType === "Quotation" ? "Quote Date" : data.documentType === "Proposal" ? "Proposal Date" : "Date"}
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

              {/* Payment link options — only for invoices */}
              {data.documentType === "Invoice" && (
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

        {/* ═══ Step 5: Signature ═══ */}
        {hasLineItems && (
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
              isSent={documentStatus === "sent" || documentStatus === "signed" || documentStatus === "finalized"}
            />
          </Step>
        )}

        {/* ═══ Step 6: Additional Details / Description ═══ */}
        {hasLineItems && (
          <Step
            number={6}
            title="Additional Details"
            isComplete={data.description.trim().length > 0}
            isOpen={openStep === 6}
            onToggle={() => setOpenStep(openStep === 6 ? 0 : 6)}
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
