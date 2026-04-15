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
  ChevronUp,
  Plus,
  Trash2,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import type { InvoiceData, LineItem } from "@/lib/invoice-types"
import { authFetch } from "@/lib/auth-fetch"
import {
  CURRENCIES,
  PAYMENT_TERMS,
  PAYMENT_METHODS,
  TAX_LABELS,
  calculateSubtotal,
  formatCurrency,
} from "@/lib/invoice-types"

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
    <div className="border border-border rounded-2xl bg-card overflow-hidden transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors"
      >
        <span
          className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 transition-colors ${isComplete
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground"
            }`}
        >
          {isComplete ? <Check className="w-3.5 h-3.5" /> : number}
        </span>
        <span className="text-sm font-medium text-foreground flex-1">
          {title}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
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
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  optional?: boolean
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
        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
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
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  options: readonly string[] | { value: string; label: string }[]
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
          className="w-full appearance-none px-3 py-2 pr-9 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
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

export function EditorPanel({ data, onChange }: EditorPanelProps) {
  const [openStep, setOpenStep] = useState(1)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoDisplayUrl, setLogoDisplayUrl] = useState<string | null>(null)
  const [isLogoUploading, setIsLogoUploading] = useState(false)

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

  /* ── Resolve logo display URL from R2 object key via base64 proxy ── */
  useEffect(() => {
    if (!data.fromLogo) {
      setLogoDisplayUrl(null)
      return
    }
    // If it's already a data URL or http URL, use directly
    if (!isR2ObjectKey(data.fromLogo)) {
      setLogoDisplayUrl(data.fromLogo)
      return
    }
    // Fetch as base64 data URL via server proxy (avoids CORS)
    let cancelled = false
    async function fetchUrl() {
      try {
        const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(data.fromLogo)}`)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json.dataUrl) setLogoDisplayUrl(json.dataUrl)
      } catch {
        // Silently fail — logo just won't display
      }
    }
    fetchUrl()
    return () => { cancelled = true }
  }, [data.fromLogo])

  /* ── Logo upload via R2 ── */
  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ""

    // Validate file type
    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPEG, WebP, or GIF.")
      return
    }
    // Validate file size
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error(`File too large. Maximum size is ${MAX_LOGO_SIZE_MB}MB.`)
      return
    }

    setIsLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", "logos")

      const res = await authFetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed.")
      }
      const { objectKey } = await res.json()

      onChange({ fromLogo: objectKey })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Logo upload failed. Please try again."
      toast.error(message)
    } finally {
      setIsLogoUploading(false)
    }
  }, [onChange])

  const currencyObj =
    CURRENCIES.find((c) => c.code === data.currency) ?? CURRENCIES[0]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground tracking-tight">
          Document Builder
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {completedSteps}/{totalSteps} steps
        </span>
      </div>

      {/* Steps — scrollable on all screen sizes */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24 flex flex-col gap-3">
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
                    onClick={() => {
                      onChange({ documentType: isActive ? null : type.label })
                      if (!isActive) setOpenStep(2)
                    }}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${isActive
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-background hover:border-primary/30"
                      }`}
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
                  className="w-full appearance-none px-3 py-2 pr-9 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
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
                    ) : (
                      <div className={`w-10 h-10 bg-secondary flex items-center justify-center ${data.logoShape === "circle" ? "rounded-full" : "rounded-lg"}`}>
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      Logo uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ fromLogo: "" })}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors"
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
                      className={`w-7 h-7 rounded-md border-2 transition-all ${data.logoShape !== "circle" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                      aria-label="Rounded square logo"
                      title="Rounded square"
                    >
                      <div className="w-full h-full rounded-[3px] bg-muted" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ logoShape: "circle" })}
                      className={`w-7 h-7 rounded-md border-2 transition-all flex items-center justify-center ${data.logoShape === "circle" ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}
                      aria-label="Circle logo"
                      title="Circle"
                    >
                      <div className="w-5 h-5 rounded-full bg-muted" />
                    </button>
                  </div>
                  {/* Show on document toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={data.showLogo !== false}
                      onChange={(e) => onChange({ showLogo: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
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
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
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
              />
              <Field
                id="from-email"
                label="Email"
                value={data.fromEmail}
                onChange={(v) => onChange({ fromEmail: v })}
                placeholder="billing@acme.com"
                type="email"
              />
              <Field
                id="from-address"
                label="Address"
                value={data.fromAddress}
                onChange={(v) => onChange({ fromAddress: v })}
                placeholder="123 Main St, City, Country"
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="from-phone"
                  label="Phone"
                  value={data.fromPhone}
                  onChange={(v) => onChange({ fromPhone: v })}
                  placeholder="+1 555 000 0000"
                  optional
                />
                <Field
                  id="from-taxid"
                  label="Tax / VAT ID"
                  value={data.fromTaxId}
                  onChange={(v) => onChange({ fromTaxId: v })}
                  placeholder="e.g. GB123456789"
                  optional
                />
              </div>
              <Field
                id="from-website"
                label="Website"
                value={data.fromWebsite}
                onChange={(v) => onChange({ fromWebsite: v })}
                placeholder="https://acme.com"
                optional
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
              />
              <Field
                id="to-email"
                label="Email"
                value={data.toEmail}
                onChange={(v) => onChange({ toEmail: v })}
                placeholder="john@example.com"
                type="email"
              />
              <Field
                id="to-address"
                label="Address"
                value={data.toAddress}
                onChange={(v) => onChange({ toAddress: v })}
                placeholder="456 Elm St, City, Country"
              />
              <div className="grid grid-cols-2 gap-2">
                <Field
                  id="to-phone"
                  label="Phone"
                  value={data.toPhone}
                  onChange={(v) => onChange({ toPhone: v })}
                  placeholder="+1 555 111 1111"
                  optional
                />
                <Field
                  id="to-taxid"
                  label="Tax / VAT ID"
                  value={data.toTaxId}
                  onChange={(v) => onChange({ toTaxId: v })}
                  placeholder="e.g. US987654321"
                  optional
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
                />
              )}
              <Field
                id="reference-number"
                label="Reference / PO #"
                value={data.referenceNumber}
                onChange={(v) => onChange({ referenceNumber: v })}
                placeholder={isInvoice ? "PO-1234" : data.documentType === "Quotation" ? "QUO-0001" : data.documentType === "Proposal" ? "PROP-0001" : "CTR-0001"}
                optional={isInvoice}
              />
              <Field
                id="invoice-date"
                label={isInvoice ? "Invoice Date" : data.documentType === "Quotation" ? "Quote Date" : data.documentType === "Proposal" ? "Proposal Date" : "Date"}
                value={data.invoiceDate}
                onChange={(v) => onChange({ invoiceDate: v })}
                type="date"
              />
              {hasLineItems && (
                <Field
                  id="due-date"
                  label={isInvoice ? "Due Date" : "Valid Until"}
                  value={data.dueDate}
                  onChange={(v) => onChange({ dueDate: v })}
                  type="date"
                />
              )}
              {hasLineItems && (
                <SelectField
                  id="payment-terms"
                  label="Payment Terms"
                  value={data.paymentTerms}
                  onChange={(v) => onChange({ paymentTerms: v })}
                  options={PAYMENT_TERMS}
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
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_50px_70px_56px_28px] gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Description</span>
                <span>Qty</span>
                <span>Rate ({currencyObj.symbol})</span>
                <span>Disc %</span>
                <span className="sr-only">Remove</span>
              </div>

              {data.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_50px_70px_56px_28px] gap-2 items-start"
                >
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, { description: e.target.value })
                    }
                    placeholder={`Item ${idx + 1}`}
                    className="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="px-2 py-2 rounded-xl border border-border bg-background text-sm text-foreground text-center outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate || ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        rate: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    className="px-2 py-2 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={item.discount || ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        discount: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    className="px-2 py-2 rounded-xl border border-border bg-background text-sm text-foreground text-center outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={data.items.length <= 1}
                    className="flex items-center justify-center w-7 h-9 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Remove item ${idx + 1}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline self-start mt-1"
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
                    className="appearance-none px-2 py-1 rounded-lg border border-border bg-background text-xs text-foreground outline-none focus:border-primary/40 transition-all cursor-pointer"
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
                  className="w-20 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
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
                    className="appearance-none px-2 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground outline-none focus:border-primary/40 transition-all cursor-pointer"
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
                    className="w-20 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
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
                  className="w-24 px-2 py-1.5 rounded-xl border border-border bg-background text-sm text-foreground text-right outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
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
                className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
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
              {/* Payment method */}
              <SelectField
                id="payment-method"
                label="Payment Method"
                value={data.paymentMethod}
                onChange={(v) => onChange({ paymentMethod: v })}
                options={PAYMENT_METHODS}
              />

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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed font-mono text-xs"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
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
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
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
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add your name and title to generate a signature block on the
                document. The recipient will receive a secure signing link.
              </p>
              <Field
                id="sig-name"
                label="Full Name"
                value={data.signatureName}
                onChange={(v) => onChange({ signatureName: v })}
                placeholder="e.g. Jane Smith"
              />
              <Field
                id="sig-title"
                label="Title / Role"
                value={data.signatureTitle}
                onChange={(v) => onChange({ signatureTitle: v })}
                placeholder="e.g. CEO, Founder"
                optional
              />
            </div>
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
                className="w-full px-3.5 py-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all resize-none leading-relaxed"
              />
            </div>
          </Step>
        )}
      </div>
    </div>
  )
}
