import React, { useState, useRef, useEffect } from "react"
import { FileText, Wrench, Edit3, ZoomIn, ZoomOut, RotateCcw, ChevronDown } from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { formatCurrency, calculateTotal } from "@/lib/invoice-types"
import { PDFDownloadButton } from "@/components/pdf-download-button"
import { TemplatePicker } from "@/components/template-picker"
import { cn } from "@/lib/utils"

interface DocumentPreviewProps {
  data: InvoiceData
  onChange?: (updates: Partial<InvoiceData>) => void
  onToggleEditor?: () => void
  showEditor?: boolean
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground px-8">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <FileText className="w-7 h-7" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">No preview yet</p>
        <p className="text-xs mt-1">Start a conversation to see your document here</p>
      </div>
    </div>
  )
}

// Get design config from template
function getDesign(data: InvoiceData) {
  const d = data.design
  const templateId = d?.templateId || "modern"
  const headerColor = d?.headerColor || (
    templateId === "modern" ? "#2563eb" :
    templateId === "classic" ? "#1e293b" :
    templateId === "bold" ? "#7c3aed" :
    templateId === "minimal" ? "" :
    templateId === "elegant" ? "#059669" :
    templateId === "corporate" ? "#1e3a5f" :
    templateId === "creative" ? "#e11d48" :
    templateId === "warm" ? "#c2410c" :
    templateId === "geometric" ? "#0d9488" : "#2563eb"
  )
  const tableColor = d?.tableColor || (
    templateId === "corporate" ? "#f0f4f8" :
    templateId === "creative" ? "#fff1f2" :
    templateId === "warm" ? "#fff7ed" :
    templateId === "geometric" ? "#f0fdfa" : ""
  )
  const font = d?.font || "Helvetica"

  // Map each font to its actual CSS font-family using loaded Google Fonts
  const fontStyle: React.CSSProperties = (() => {
    switch (font) {
      case "Inter":       return { fontFamily: "var(--font-inter), system-ui, sans-serif" }
      case "Playfair":    return { fontFamily: "var(--font-display), Georgia, serif" }
      case "Lora":        return { fontFamily: "var(--font-lora), Georgia, serif" }
      case "Roboto Mono": return { fontFamily: "var(--font-roboto-mono), monospace" }
      case "Courier":     return { fontFamily: "var(--font-mono), Courier, monospace" }
      case "Times-Roman": return { fontFamily: "Georgia, 'Times New Roman', serif" }
      default:            return { fontFamily: "var(--font-sans), system-ui, sans-serif" }
    }
  })()

  return { templateId, headerColor, tableColor, font, fontStyle }
}

/* â”€â”€â”€ Invoice Preview â”€â”€â”€ */
function InvoicePreview({ data }: { data: InvoiceData }) {
  const { subtotal, tax, discount, total } = calculateTotal(data)
  const { templateId, headerColor, tableColor, fontStyle } = getDesign(data)
  const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
  const isBold = templateId === "bold"
  const isMinimal = templateId === "minimal"
  const isClassic = templateId === "classic"
  const isElegant = templateId === "elegant"
  const isCorporate = templateId === "corporate"
  const isCreative = templateId === "creative"
  const isWarm = templateId === "warm"
  const isGeometric = templateId === "geometric"

  // Container styles per template
  const containerClass = isMinimal
    ? "rounded-lg border border-border/40"
    : isClassic
    ? "border-2 border-double border-muted-foreground/30"
    : isBold || isCreative
    ? "rounded-none border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)]"
    : isGeometric
    ? "rounded-lg border-2 border-border shadow-md overflow-hidden"
    : isElegant || isWarm
    ? "rounded-xl border border-border shadow-lg"
    : isCorporate
    ? "rounded-xl border-2 border-border shadow-md"
    : "rounded-2xl border border-border shadow-sm"

  return (
    <div className={`w-full max-w-[900px] bg-card overflow-hidden ${containerClass}`}
      style={{ ...fontStyle, borderColor: (isBold || isCreative) && headerColor ? headerColor : undefined }}>

      {/* Header */}
      <div className={`px-10 pt-10 pb-8 flex items-start justify-between relative ${isMinimal ? '' : ''}`}
        style={{
          backgroundColor: isMinimal ? 'transparent' : ((isBold || isCreative) ? headerColor : (isGeometric ? headerColor : undefined)),
          borderBottom: isMinimal ? '1px solid var(--border)' : (isClassic ? '3px double var(--border)' : undefined),
          color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : undefined,
          clipPath: isGeometric ? 'polygon(0 0, 100% 0, 100% 75%, 0 100%)' : undefined,
          paddingBottom: isGeometric ? '3rem' : undefined,
        }}>
        <div>
          {/* Accent bar for modern/elegant/corporate/warm */}
          {!isBold && !isCreative && !isMinimal && !isClassic && !isGeometric && headerColor && (
            <div className="w-12 h-1.5 rounded-full mb-3" style={{ backgroundColor: headerColor }} />
          )}
          <h2 className={`text-3xl tracking-tight ${isClassic ? 'font-normal italic' : 'font-bold'}`}
            style={{ color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : (isMinimal ? undefined : headerColor || undefined) }}>
            INVOICE
          </h2>
          <p className={`text-sm mt-1.5 ${(isBold || isCreative || isGeometric) ? 'text-white/70' : 'text-muted-foreground'}`}>
            {data.invoiceNumber || "INV-0000"}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${
          (isBold || isCreative || isGeometric) ? 'bg-white/20 text-white' : 'text-white'
        }`} style={{ backgroundColor: (isBold || isCreative || isGeometric) ? undefined : (headerColor || 'var(--primary)'), opacity: isMinimal ? 0.8 : 1 }}>
          {data.status === "paid" ? "Paid" : "Draft"}
        </span>
      </div>

      {/* Dates */}
      <div className="px-10 py-6 flex gap-8 text-sm border-b" style={{ borderColor: isClassic ? 'var(--border)' : undefined }}>
        <div>
          <p className="text-muted-foreground font-medium mb-0.5 text-xs uppercase tracking-wider">Invoice Date</p>
          <p className="text-foreground font-medium">
            {data.invoiceDate ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "---"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium mb-0.5 text-xs uppercase tracking-wider">Due Date</p>
          <p className="text-foreground font-medium">
            {data.dueDate ? new Date(data.dueDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "---"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium mb-0.5 text-xs uppercase tracking-wider">Payment Terms</p>
          <p className="text-foreground font-medium">{data.paymentTerms || "---"}</p>
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-2 gap-8 px-10 py-8">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5"
            style={{ color: headerColor || undefined }}>From</p>
          <p className="text-base font-semibold text-foreground">{data.fromName || <span className="text-muted-foreground/40">Your name</span>}</p>
          {data.fromAddress && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{data.fromAddress}</p>}
          {data.fromEmail && <p className="text-sm text-muted-foreground">{data.fromEmail}</p>}
          {data.fromPhone && <p className="text-sm text-muted-foreground">{data.fromPhone}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5"
            style={{ color: headerColor || undefined }}>Bill To</p>
          <p className="text-base font-semibold text-foreground">{data.toName || <span className="text-muted-foreground/40">Client name</span>}</p>
          {data.toAddress && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{data.toAddress}</p>}
          {data.toEmail && <p className="text-sm text-muted-foreground">{data.toEmail}</p>}
          {data.toPhone && <p className="text-sm text-muted-foreground">{data.toPhone}</p>}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="px-10 pb-3">
        <table className="w-full text-base">
          <thead>
            <tr style={{
              backgroundColor: tableColor || undefined,
              borderBottom: `2px solid ${headerColor || 'var(--border)'}`,
            }}>
              <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description</th>
              <th className="text-center py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-20">Qty</th>
              <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Rate</th>
              <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? data.items.map((item, idx) => {
              if (!item.description && item.rate === 0) return null
              const lineTotal = item.quantity * item.rate
              return (
                <tr key={item.id || `item-${idx}`} className="border-b border-border/60"
                  style={{ backgroundColor: idx % 2 === 1 ? (tableColor || undefined) : undefined }}>
                  <td className="py-4 px-3 text-foreground">{item.description || <span className="text-muted-foreground/40">Item {idx + 1}</span>}</td>
                  <td className="py-4 px-3 text-center text-muted-foreground">{item.quantity}</td>
                  <td className="py-4 px-3 text-right text-muted-foreground">{formatCurrency(item.rate, data.currency)}</td>
                  <td className="py-4 px-3 text-right font-medium text-foreground">{formatCurrency(lineTotal, data.currency)}</td>
                </tr>
              )
            }) : null}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-10 py-6 flex justify-end">
        <div className="w-80 space-y-3">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground font-medium">{formatCurrency(subtotal, data.currency)}</span>
          </div>
          {data.discountValue > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">Discount{data.discountType === "percent" ? ` (${data.discountValue}%)` : ""}</span>
              <span className="text-destructive font-medium">-{formatCurrency(discount, data.currency)}</span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">{data.taxLabel || "Tax"} ({data.taxRate}%)</span>
              <span className="text-foreground font-medium">{formatCurrency(tax, data.currency)}</span>
            </div>
          )}
          <div className="pt-3 flex justify-between" style={{ borderTop: `2px solid ${headerColor || 'var(--border)'}` }}>
            <span className="text-base font-semibold text-foreground">Total</span>
            <span className="text-2xl font-bold tracking-tight" style={{ color: headerColor || undefined }}>
              {formatCurrency(total, data.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      {(data.paymentMethod || data.paymentInstructions) && (
        <div className="px-10 pb-4">
          <p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Payment Information</p>
          {data.paymentMethod && <p className="text-sm text-muted-foreground">Method: {data.paymentMethod}</p>}
          {data.paymentInstructions && <p className="text-sm text-muted-foreground leading-relaxed">{data.paymentInstructions}</p>}
        </div>
      )}

      {/* Notes & Terms */}
      {(data.notes || data.terms) && (
        <div className="px-10 pb-8 space-y-4">
          {data.notes && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.notes}</p>
            </div>
          )}
          {data.terms && (
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Terms & Conditions</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.terms}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-10 py-5 border-t flex items-center justify-between"
        style={{ backgroundColor: tableColor || 'var(--secondary)', borderColor: headerColor || undefined, opacity: 0.9 }}>
        <p className="text-[10px] text-muted-foreground">Generated by Invo.ai</p>
        <PDFDownloadButton data={data} variant="ghost" size="sm" />
      </div>
    </div>
  )
}

/* â”€â”€â”€ Contract Preview â”€â”€â”€ */
function ContractPreview({ data }: { data: InvoiceData }) {
  const { templateId, headerColor, fontStyle } = getDesign(data)
  const isBold = templateId === "bold"
  const isMinimal = templateId === "minimal"
  const isClassic = templateId === "classic"
  const isElegant = templateId === "elegant"
  const isCorporate = templateId === "corporate"
  const isCreative = templateId === "creative"
  const isWarm = templateId === "warm"
  const isGeometric = templateId === "geometric"

  const containerClass = isMinimal ? "rounded-lg border border-border/40"
    : isClassic ? "border-2 border-double border-muted-foreground/30"
    : isBold || isCreative ? "rounded-none border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)]"
    : isGeometric ? "rounded-lg border-2 border-border shadow-md overflow-hidden"
    : isElegant || isWarm ? "rounded-xl border border-border shadow-lg"
    : isCorporate ? "rounded-xl border-2 border-border shadow-md"
    : "rounded-2xl border border-border shadow-sm"

  return (
    <div className={`w-full max-w-[900px] bg-card overflow-hidden ${containerClass}`}
      style={{ ...fontStyle, borderColor: (isBold || isCreative) && headerColor ? headerColor : undefined }}>
      <div className="px-10 pt-10 pb-8 flex items-start justify-between relative"
        style={{
          backgroundColor: isMinimal ? 'transparent' : ((isBold || isCreative || isGeometric) ? headerColor : undefined),
          borderBottom: isMinimal ? '1px solid var(--border)' : (isClassic ? '3px double var(--border)' : undefined),
          color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : undefined,
          clipPath: isGeometric ? 'polygon(0 0, 100% 0, 100% 75%, 0 100%)' : undefined,
          paddingBottom: isGeometric ? '3rem' : undefined,
        }}>
        <div>
          {!isBold && !isCreative && !isMinimal && !isClassic && !isGeometric && headerColor && (
            <div className="w-12 h-1.5 rounded-full mb-3" style={{ backgroundColor: headerColor }} />
          )}
          <h2 className={`text-3xl tracking-tight ${isClassic ? 'font-normal italic' : 'font-bold'}`}
            style={{ color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : (isMinimal ? undefined : headerColor || undefined) }}>
            CONTRACT
          </h2>
          <p className={`text-sm mt-1.5 ${(isBold || isCreative || isGeometric) ? 'text-white/70' : 'text-muted-foreground'}`}>
            {data.referenceNumber || data.invoiceNumber || "CTR-0000"}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${(isBold || isCreative || isGeometric) ? 'bg-white/20 text-white' : 'text-white'}`}
          style={{ backgroundColor: (isBold || isCreative || isGeometric) ? undefined : (headerColor || 'var(--primary)') }}>Draft</span>
      </div>

      {data.invoiceDate && (
        <div className="px-10 py-6 border-b">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Effective Date</p>
          <p className="text-foreground font-medium">
            {new Date(data.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 px-10 py-8">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>Party A (Provider)</p>
          <p className="text-base font-semibold text-foreground">{data.fromName || "Your name"}</p>
          {data.fromAddress && <p className="text-sm text-muted-foreground mt-1">{data.fromAddress}</p>}
          {data.fromEmail && <p className="text-sm text-muted-foreground">{data.fromEmail}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>Party B (Client)</p>
          <p className="text-base font-semibold text-foreground">{data.toName || "Client name"}</p>
          {data.toAddress && <p className="text-sm text-muted-foreground mt-1">{data.toAddress}</p>}
          {data.toEmail && <p className="text-sm text-muted-foreground">{data.toEmail}</p>}
        </div>
      </div>

      {data.description && (
        <div className="px-10 py-8 border-t">
          <h3 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: headerColor || undefined }}>Contract Terms</h3>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.description}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8 px-10 py-8 border-t">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-6">Party A Signature</p>
          <div className="border-b pb-1 mb-2 w-48" style={{ borderColor: headerColor || 'var(--border)' }} />
          <p className="text-sm font-medium">{data.signatureName || data.fromName || "_______________"}</p>
          {data.signatureTitle && <p className="text-xs text-muted-foreground">{data.signatureTitle}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-6">Party B Signature</p>
          <div className="border-b pb-1 mb-2 w-48" style={{ borderColor: headerColor || 'var(--border)' }} />
          <p className="text-sm font-medium">{data.toName || "_______________"}</p>
        </div>
      </div>

      {(data.notes || data.terms) && (
        <div className="px-10 pb-8 space-y-4">
          {data.notes && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Notes</p><p className="text-sm text-muted-foreground">{data.notes}</p></div>}
          {data.terms && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Additional Terms</p><p className="text-sm text-muted-foreground">{data.terms}</p></div>}
        </div>
      )}

      <div className="px-10 py-5 border-t flex items-center justify-between bg-secondary/30">
        <p className="text-[10px] text-muted-foreground">Generated by Invo.ai</p>
        <PDFDownloadButton data={data} variant="ghost" size="sm" />
      </div>
    </div>
  )
}

/* â”€â”€â”€ Quotation Preview â”€â”€â”€ */
function QuotationPreview({ data }: { data: InvoiceData }) {
  const { subtotal, tax, discount, total } = calculateTotal(data)
  const { templateId, headerColor, tableColor, fontStyle } = getDesign(data)
  const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
  const isBold = templateId === "bold"
  const isMinimal = templateId === "minimal"
  const isClassic = templateId === "classic"
  const isElegant = templateId === "elegant"
  const isCorporate = templateId === "corporate"
  const isCreative = templateId === "creative"
  const isWarm = templateId === "warm"
  const isGeometric = templateId === "geometric"

  const containerClass = isMinimal ? "rounded-lg border border-border/40"
    : isClassic ? "border-2 border-double border-muted-foreground/30"
    : isBold || isCreative ? "rounded-none border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)]"
    : isGeometric ? "rounded-lg border-2 border-border shadow-md overflow-hidden"
    : isElegant || isWarm ? "rounded-xl border border-border shadow-lg"
    : isCorporate ? "rounded-xl border-2 border-border shadow-md"
    : "rounded-2xl border border-border shadow-sm"

  return (
    <div className={`w-full max-w-[900px] bg-card overflow-hidden ${containerClass}`}
      style={{ ...fontStyle, borderColor: (isBold || isCreative) && headerColor ? headerColor : undefined }}>
      <div className="px-10 pt-10 pb-8 flex items-start justify-between relative"
        style={{
          backgroundColor: isMinimal ? 'transparent' : ((isBold || isCreative || isGeometric) ? headerColor : undefined),
          borderBottom: isMinimal ? '1px solid var(--border)' : (isClassic ? '3px double var(--border)' : undefined),
          color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : undefined,
          clipPath: isGeometric ? 'polygon(0 0, 100% 0, 100% 75%, 0 100%)' : undefined,
          paddingBottom: isGeometric ? '3rem' : undefined,
        }}>
        <div>
          {!isBold && !isCreative && !isMinimal && !isClassic && !isGeometric && headerColor && (
            <div className="w-12 h-1.5 rounded-full mb-3" style={{ backgroundColor: headerColor }} />
          )}
          <h2 className={`text-3xl tracking-tight ${isClassic ? 'font-normal italic' : 'font-bold'}`}
            style={{ color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : (isMinimal ? undefined : headerColor || undefined) }}>
            QUOTATION
          </h2>
          <p className={`text-sm mt-1.5 ${(isBold || isCreative || isGeometric) ? 'text-white/70' : 'text-muted-foreground'}`}>
            {data.referenceNumber || data.invoiceNumber || "QUO-0000"}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${(isBold || isCreative || isGeometric) ? 'bg-white/20 text-white' : 'text-white'}`}
          style={{ backgroundColor: (isBold || isCreative || isGeometric) ? undefined : (headerColor || 'var(--primary)') }}>Draft</span>
      </div>

      <div className="px-10 py-6 flex gap-8 text-sm border-b">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Quote Date</p>
          <p className="text-foreground font-medium">
            {data.invoiceDate ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "---"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Valid Until</p>
          <p className="text-foreground font-medium">
            {data.dueDate ? new Date(data.dueDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "---"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Payment Terms</p>
          <p className="text-foreground font-medium">{data.paymentTerms || "---"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 px-10 py-8">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>From</p>
          <p className="text-base font-semibold">{data.fromName || "Your name"}</p>
          {data.fromAddress && <p className="text-sm text-muted-foreground mt-1">{data.fromAddress}</p>}
          {data.fromEmail && <p className="text-sm text-muted-foreground">{data.fromEmail}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>Quote For</p>
          <p className="text-base font-semibold">{data.toName || "Client name"}</p>
          {data.toAddress && <p className="text-sm text-muted-foreground mt-1">{data.toAddress}</p>}
          {data.toEmail && <p className="text-sm text-muted-foreground">{data.toEmail}</p>}
        </div>
      </div>

      {data.description && (
        <div className="px-10 pb-6">
          <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: headerColor || undefined }}>Description</h3>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.description}</div>
        </div>
      )}

      <div className="px-10 pb-3">
        <table className="w-full text-base">
          <thead>
            <tr style={{ backgroundColor: tableColor || undefined, borderBottom: `2px solid ${headerColor || 'var(--border)'}` }}>
              <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Item / Service</th>
              <th className="text-center py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-20">Qty</th>
              <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Unit Price</th>
              <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? data.items.map((item, idx) => {
              if (!item.description && item.rate === 0) return null
              return (
                <tr key={item.id || `item-${idx}`} className="border-b border-border/60"
                  style={{ backgroundColor: idx % 2 === 1 ? (tableColor || undefined) : undefined }}>
                  <td className="py-4 px-3">{item.description || `Item ${idx + 1}`}</td>
                  <td className="py-4 px-3 text-center text-muted-foreground">{item.quantity}</td>
                  <td className="py-4 px-3 text-right text-muted-foreground">{formatCurrency(item.rate, data.currency)}</td>
                  <td className="py-4 px-3 text-right font-medium">{formatCurrency(item.quantity * item.rate, data.currency)}</td>
                </tr>
              )
            }) : null}
          </tbody>
        </table>
      </div>

      <div className="px-10 py-6 flex justify-end">
        <div className="w-80 space-y-3">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal, data.currency)}</span>
          </div>
          {data.discountValue > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">Discount{data.discountType === "percent" ? ` (${data.discountValue}%)` : ""}</span>
              <span className="text-destructive font-medium">-{formatCurrency(discount, data.currency)}</span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between text-base">
              <span className="text-muted-foreground">{data.taxLabel || "Tax"} ({data.taxRate}%)</span>
              <span className="font-medium">{formatCurrency(tax, data.currency)}</span>
            </div>
          )}
          <div className="pt-3 flex justify-between" style={{ borderTop: `2px solid ${headerColor || 'var(--border)'}` }}>
            <span className="text-base font-semibold">Total</span>
            <span className="text-2xl font-bold tracking-tight" style={{ color: headerColor || undefined }}>{formatCurrency(total, data.currency)}</span>
          </div>
        </div>
      </div>

      {(data.notes || data.terms) && (
        <div className="px-10 pb-8 space-y-4">
          {data.notes && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Notes</p><p className="text-sm text-muted-foreground">{data.notes}</p></div>}
          {data.terms && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Terms</p><p className="text-sm text-muted-foreground">{data.terms}</p></div>}
        </div>
      )}

      <div className="px-10 py-5 border-t flex items-center justify-between bg-secondary/30">
        <p className="text-[10px] text-muted-foreground">Generated by Invo.ai</p>
        <PDFDownloadButton data={data} variant="ghost" size="sm" />
      </div>
    </div>
  )
}

/* â”€â”€â”€ Proposal Preview â”€â”€â”€ */
function ProposalPreview({ data }: { data: InvoiceData }) {
  const { subtotal, total } = calculateTotal(data)
  const { templateId, headerColor, tableColor, fontStyle } = getDesign(data)
  const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
  const isBold = templateId === "bold"
  const isMinimal = templateId === "minimal"
  const isClassic = templateId === "classic"
  const isElegant = templateId === "elegant"
  const isCorporate = templateId === "corporate"
  const isCreative = templateId === "creative"
  const isWarm = templateId === "warm"
  const isGeometric = templateId === "geometric"

  const containerClass = isMinimal ? "rounded-lg border border-border/40"
    : isClassic ? "border-2 border-double border-muted-foreground/30"
    : isBold || isCreative ? "rounded-none border-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.15)]"
    : isGeometric ? "rounded-lg border-2 border-border shadow-md overflow-hidden"
    : isElegant || isWarm ? "rounded-xl border border-border shadow-lg"
    : isCorporate ? "rounded-xl border-2 border-border shadow-md"
    : "rounded-2xl border border-border shadow-sm"

  return (
    <div className={`w-full max-w-[900px] bg-card overflow-hidden ${containerClass}`}
      style={{ ...fontStyle, borderColor: (isBold || isCreative) && headerColor ? headerColor : undefined }}>
      <div className="px-10 pt-10 pb-8 flex items-start justify-between relative"
        style={{
          backgroundColor: isMinimal ? 'transparent' : ((isBold || isCreative || isGeometric) ? headerColor : undefined),
          borderBottom: isMinimal ? '1px solid var(--border)' : (isClassic ? '3px double var(--border)' : undefined),
          color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : undefined,
          clipPath: isGeometric ? 'polygon(0 0, 100% 0, 100% 75%, 0 100%)' : undefined,
          paddingBottom: isGeometric ? '3rem' : undefined,
        }}>
        <div>
          {!isBold && !isCreative && !isMinimal && !isClassic && !isGeometric && headerColor && (
            <div className="w-12 h-1.5 rounded-full mb-3" style={{ backgroundColor: headerColor }} />
          )}
          <h2 className={`text-3xl tracking-tight ${isClassic ? 'font-normal italic' : 'font-bold'}`}
            style={{ color: (isBold || isCreative || isGeometric) && headerColor ? '#fff' : (isMinimal ? undefined : headerColor || undefined) }}>
            PROPOSAL
          </h2>
          <p className={`text-sm mt-1.5 ${(isBold || isCreative || isGeometric) ? 'text-white/70' : 'text-muted-foreground'}`}>
            {data.referenceNumber || data.invoiceNumber || "PROP-0000"}
          </p>
        </div>
        <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${(isBold || isCreative || isGeometric) ? 'bg-white/20 text-white' : 'text-white'}`}
          style={{ backgroundColor: (isBold || isCreative || isGeometric) ? undefined : (headerColor || 'var(--primary)') }}>Draft</span>
      </div>

      <div className="px-10 py-6 flex gap-8 text-sm border-b">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Date</p>
          <p className="text-foreground font-medium">
            {data.invoiceDate ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "---"}
          </p>
        </div>
        {data.dueDate && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Valid Until</p>
            <p className="text-foreground font-medium">
              {new Date(data.dueDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-8 px-10 py-8">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>Prepared By</p>
          <p className="text-base font-semibold">{data.fromName || "Your name"}</p>
          {data.fromAddress && <p className="text-sm text-muted-foreground mt-1">{data.fromAddress}</p>}
          {data.fromEmail && <p className="text-sm text-muted-foreground">{data.fromEmail}</p>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold mb-2.5" style={{ color: headerColor || undefined }}>Prepared For</p>
          <p className="text-base font-semibold">{data.toName || "Client name"}</p>
          {data.toAddress && <p className="text-sm text-muted-foreground mt-1">{data.toAddress}</p>}
          {data.toEmail && <p className="text-sm text-muted-foreground">{data.toEmail}</p>}
        </div>
      </div>

      {data.description && (
        <div className="px-10 py-8 border-t">
          <h3 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: headerColor || undefined }}>Executive Summary</h3>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{data.description}</div>
        </div>
      )}

      {hasItems && (
        <>
          <div className="px-10 pb-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: headerColor || undefined }}>Deliverables & Pricing</h3>
            <table className="w-full text-base">
              <thead>
                <tr style={{ backgroundColor: tableColor || undefined, borderBottom: `2px solid ${headerColor || 'var(--border)'}` }}>
                  <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Deliverable</th>
                  <th className="text-center py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-20">Qty</th>
                  <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Rate</th>
                  <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => {
                  if (!item.description && item.rate === 0) return null
                  return (
                    <tr key={item.id || `item-${idx}`} className="border-b border-border/60"
                      style={{ backgroundColor: idx % 2 === 1 ? (tableColor || undefined) : undefined }}>
                      <td className="py-4 px-3">{item.description || `Phase ${idx + 1}`}</td>
                      <td className="py-4 px-3 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="py-4 px-3 text-right text-muted-foreground">{formatCurrency(item.rate, data.currency)}</td>
                      <td className="py-4 px-3 text-right font-medium">{formatCurrency(item.quantity * item.rate, data.currency)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-10 py-6 flex justify-end">
            <div className="w-80">
              <div className="pt-3 flex justify-between" style={{ borderTop: `2px solid ${headerColor || 'var(--border)'}` }}>
                <span className="text-base font-semibold">Total Investment</span>
                <span className="text-2xl font-bold tracking-tight" style={{ color: headerColor || undefined }}>{formatCurrency(total, data.currency)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {(data.notes || data.terms) && (
        <div className="px-10 pb-8 space-y-4">
          {data.notes && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Approach & Methodology</p><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.notes}</p></div>}
          {data.terms && <div><p className="text-xs uppercase tracking-wider font-semibold mb-1.5" style={{ color: headerColor || undefined }}>Terms & Conditions</p><p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.terms}</p></div>}
        </div>
      )}

      <div className="px-10 py-5 border-t flex items-center justify-between bg-secondary/30">
        <p className="text-[10px] text-muted-foreground">Generated by Invo.ai</p>
        <PDFDownloadButton data={data} variant="ghost" size="sm" />
      </div>
    </div>
  )
}

/* â”€â”€â”€ Editing Tools Dropdown â”€â”€â”€ */
function EditingToolsDropdown({ onToggleEditor, showEditor, onZoomChange }: { onToggleEditor?: () => void; showEditor?: boolean; onZoomChange: (fn: (z: number) => number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const setZoomFromTools = onZoomChange

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 active:scale-95 btn-press",
          open ? "bg-primary text-primary-foreground border-primary shadow-md" : "bg-card border-border text-foreground hover:border-primary/40 hover:shadow-sm"
        )}
      >
        <Wrench className="w-[18px] h-[18px]" />
        <span className="hidden sm:inline">Tools</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-lg shadow-black/10 z-50 overflow-hidden animate-dropdown-in">
          <div className="p-2">
            {onToggleEditor && (
              <button
                type="button"
                onClick={() => { onToggleEditor(); setOpen(false) }}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left text-sm transition-all duration-150 active:scale-[0.98]",
                  showEditor ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary/50 text-foreground"
                )}
              >
                <Edit3 className="w-5 h-5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{showEditor ? "Hide Editor" : "Show Editor"}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Edit fields manually</div>
                </div>
              </button>
            )}
            <div className="my-1.5 border-t border-border" />
            <button
              type="button"
              onClick={() => { setZoomFromTools(z => Math.min(150, z + 10)); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left text-sm hover:bg-secondary/50 text-foreground transition-all duration-150 active:scale-[0.98]"
            >
              <ZoomIn className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Zoom In</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Increase preview size</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setZoomFromTools(z => Math.max(50, z - 10)); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left text-sm hover:bg-secondary/50 text-foreground transition-all duration-150 active:scale-[0.98]"
            >
              <ZoomOut className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Zoom Out</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Decrease preview size</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => { setZoomFromTools(() => 100); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left text-sm hover:bg-secondary/50 text-foreground transition-all duration-150 active:scale-[0.98]"
            >
              <RotateCcw className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Reset View</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Reset to 100% zoom</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* â”€â”€â”€ Main DocumentPreview â”€â”€â”€ */
export function DocumentPreview({ data, onChange, onToggleEditor, showEditor }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const hasContent = data.documentType || data.fromName || data.toName || data.description

  if (!hasContent) return <EmptyState />

  const docType = (data.documentType || "").toLowerCase()

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="relative z-30 flex items-center justify-between px-5 py-3 border-b bg-card/80 backdrop-blur-sm shadow-sm shrink-0 gap-3">
        <div className="flex items-center gap-2.5">
          {onChange && <TemplatePicker data={data} onChange={onChange} />}
          <EditingToolsDropdown onToggleEditor={onToggleEditor} showEditor={showEditor} onZoomChange={(fn) => setZoom(prev => fn(prev))} />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-secondary/60 rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(50, z - 10))}
              className="p-1.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-90"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-muted-foreground w-9 text-center tabular-nums">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(150, z + 10))}
              className="p-1.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-90"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {zoom !== 100 && (
              <button
                type="button"
                onClick={() => setZoom(100)}
                className="p-1.5 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-90"
                aria-label="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <PDFDownloadButton data={data} size="sm" variant="outline" />
        </div>
      </div>

      {/* Preview content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 md:p-10 min-h-full flex items-start justify-center">
          <div
            className="w-full max-w-[900px]"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease',
            }}
          >
            {docType === "invoice" ? <InvoicePreview data={data} />
              : docType === "contract" ? <ContractPreview data={data} />
              : docType === "quotation" ? <QuotationPreview data={data} />
              : docType === "proposal" ? <ProposalPreview data={data} />
              : <InvoicePreview data={data} />}
          </div>
        </div>
      </div>
    </div>
  )
}
