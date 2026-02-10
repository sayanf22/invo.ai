import React from "react"

import {
  FileText,
  ScrollText,
  ShieldCheck,
  Handshake,
} from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { formatCurrency, calculateTotal } from "@/lib/invoice-types"
import { PDFDownloadButton } from "@/components/pdf-download-button"

const iconMap: Record<string, React.ElementType> = {
  Invoice: FileText,
  Contract: ScrollText,
  NDA: ShieldCheck,
  Agreement: Handshake,
}

interface DocumentPreviewProps {
  data: InvoiceData
}

/* ─── Placeholder skeleton lines ─── */
function Skeleton({ width = "w-full" }: { width?: string }) {
  return <div className={`h-3 bg-secondary rounded-full ${width}`} />
}

/* ─── Empty state ─── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground px-8">
      <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
        <FileText className="w-7 h-7" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">No preview yet</p>
        <p className="text-xs mt-1">
          Start filling in the details on the left to see a live preview
        </p>
      </div>
    </div>
  )
}

// Helper to map PDF fonts to CSS classes
function getDesignClasses(design: InvoiceData["design"]) {
  if (!design) return { font: "font-sans", container: "", header: "" }

  const fontMap: Record<string, string> = {
    "Helvetica": "font-sans",
    "Times-Roman": "font-serif",
    "Courier": "font-mono",
  }

  const layoutMap: Record<string, string> = {
    modern: "rounded-2xl border border-border shadow-sm",
    classic: "rounded-none border-2 border-double border-muted-foreground/20 shadow-none",
    bold: "rounded-none border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
    minimal: "rounded-sm border border-border/40 shadow-none",
  }

  return {
    font: fontMap[design.font] || "font-sans",
    container: layoutMap[design.layout] || layoutMap.modern,
    headerColor: design.headerColor,
  }
}

/* ─── Invoice preview ─── */
function InvoicePreview({ data }: { data: InvoiceData }) {
  const { subtotal, tax, discount, total } = calculateTotal(data)
  const styles = getDesignClasses(data.design)

  const hasItems = data.items.some(
    (i) => i.description.trim().length > 0 || i.rate > 0
  )

  return (
    <div
      className={`w-full max-w-[640px] bg-card overflow-hidden ${styles.container} ${styles.font}`}
      style={{ borderColor: data.design?.layout === 'bold' ? data.design.headerColor : undefined }}
    >
      {/* Invoice Header */}
      <div
        className="px-8 pt-8 pb-6 flex items-start justify-between"
        style={{
          backgroundColor: data.design?.headerColor || undefined,
          color: data.design?.layout === 'bold' ? '#fff' : undefined
        }}
      >
        <div>
          <h2 className={`text-2xl font-bold tracking-tight ${data.design?.layout === 'bold' ? 'text-white' : 'text-foreground'}`}>
            INVOICE
          </h2>
          <p className={`text-xs mt-1 ${data.design?.layout === 'bold' ? 'text-white/80' : 'text-muted-foreground'}`}>
            {data.invoiceNumber || "INV-0000"}
          </p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${data.design?.layout === 'bold'
              ? 'bg-white/20 text-white'
              : 'bg-primary/10 text-primary'
            }`}>
            Draft
          </span>
        </div>
      </div>

      {/* Dates Row */}
      <div className="px-8 pb-6 pt-6 flex gap-6 text-xs border-b border-border/50">
        <div>
          <p className="text-muted-foreground font-medium mb-0.5">
            Invoice Date
          </p>
          <p className="text-foreground font-medium">
            {data.invoiceDate
              ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { year: "numeric", month: "short", day: "numeric" }
              )
              : "---"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium mb-0.5">Due Date</p>
          <p className="text-foreground font-medium">
            {data.dueDate
              ? new Date(data.dueDate + "T00:00:00").toLocaleDateString(
                "en-US",
                { year: "numeric", month: "short", day: "numeric" }
              )
              : "---"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground font-medium mb-0.5">
            Payment Terms
          </p>
          <p className="text-foreground font-medium">
            {data.paymentTerms || "---"}
          </p>
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-2 gap-6 px-8 py-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            From
          </p>
          <p className="text-sm font-semibold text-foreground">
            {data.fromName || (
              <span className="text-muted-foreground/40 font-normal">
                Your name
              </span>
            )}
          </p>
          {data.fromAddress && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {data.fromAddress}
            </p>
          )}
          {data.fromEmail && (
            <p className="text-xs text-muted-foreground">{data.fromEmail}</p>
          )}
          {data.fromPhone && (
            <p className="text-xs text-muted-foreground">{data.fromPhone}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Bill To
          </p>
          <p className="text-sm font-semibold text-foreground">
            {data.toName || (
              <span className="text-muted-foreground/40 font-normal">
                Recipient name
              </span>
            )}
          </p>
          {data.toAddress && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {data.toAddress}
            </p>
          )}
          {data.toEmail && (
            <p className="text-xs text-muted-foreground">{data.toEmail}</p>
          )}
          {data.toPhone && (
            <p className="text-xs text-muted-foreground">{data.toPhone}</p>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="px-8 pb-2">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: data.design?.tableColor || undefined }}>
            <tr className="border-b border-foreground/10">
              <th className="text-left py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Description
              </th>
              <th className="text-center py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-16">
                Qty
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">
                Rate
              </th>
              <th className="text-right py-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-24">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {hasItems ? (
              data.items.map((item, idx) => {
                const lineTotal = item.quantity * item.rate
                if (!item.description && item.rate === 0) return null
                return (
                  <tr
                    key={item.id}
                    className="border-b border-border/60"
                  >
                    <td className="py-3 px-2 text-foreground">
                      {item.description || (
                        <span className="text-muted-foreground/40">
                          Item {idx + 1}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center text-muted-foreground">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-2 text-right text-muted-foreground">
                      {formatCurrency(item.rate, data.currency)}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-foreground">
                      {formatCurrency(lineTotal, data.currency)}
                    </td>
                  </tr>
                )
              })
            ) : (
              // Empty state rows
              null
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-8 py-4 flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground font-medium">
              {formatCurrency(subtotal, data.currency)}
            </span>
          </div>
          {data.discountValue > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Discount
                {data.discountType === "percent"
                  ? ` (${data.discountValue}%)`
                  : ""}
              </span>
              <span className="text-destructive font-medium">
                -{formatCurrency(discount, data.currency)}
              </span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({data.taxRate}%)
              </span>
              <span className="text-foreground font-medium">
                {formatCurrency(tax, data.currency)}
              </span>
            </div>
          )}
          <div className="border-t-2 border-foreground/10 pt-2 flex justify-between">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground tracking-tight">
              {formatCurrency(total, data.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      {(data.notes || data.terms) && (
        <div className="px-8 pb-6 space-y-3">
          {data.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Notes
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {data.notes}
              </p>
            </div>
          )}
          {data.terms && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Terms & Conditions
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {data.terms}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-8 py-4 border-t border-border flex items-center justify-between bg-secondary/30">
        <p className="text-[10px] text-muted-foreground">
          Generated by Invo.ai
        </p>
        <PDFDownloadButton
          data={data}
          variant="ghost"
          size="sm"
        />
      </div>
    </div>
  )
}

/* ─── Generic document preview (Contract / NDA / Agreement) ─── */
function GenericPreview({ data }: { data: InvoiceData }) {
  const Icon = data.documentType ? iconMap[data.documentType] || FileText : FileText
  const styles = getDesignClasses(data.design)

  return (
    <div className={`w-full max-w-[640px] bg-card overflow-hidden ${styles.container} ${styles.font}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 pt-8 pb-5 border-b border-border"
        style={{ backgroundColor: data.design?.headerColor || undefined }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.design?.layout === 'bold' ? 'bg-white/10 text-white' : 'bg-primary/10'}`}>
            <Icon className={`w-5 h-5 ${data.design?.layout === 'bold' ? 'text-white' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${data.design?.layout === 'bold' ? 'text-white' : 'text-foreground'}`}>
              {data.documentType || "Document"}
            </h3>
            <p className={`text-xs ${data.design?.layout === 'bold' ? 'text-white/80' : 'text-muted-foreground'}`}>
              {data.invoiceDate
                ? new Date(data.invoiceDate + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { year: "numeric", month: "long", day: "numeric" }
                )
                : "---"}
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${data.design?.layout === 'bold'
            ? 'bg-white/20 text-white'
            : 'bg-primary/10 text-primary'
          }`}>
          Draft
        </span>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-border">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Party A
          </p>
          <p className="text-sm font-semibold text-foreground">
            {data.fromName || (
              <span className="text-muted-foreground/40 font-normal">
                Your name
              </span>
            )}
          </p>
          {data.fromAddress && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.fromAddress}
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            Party B
          </p>
          <p className="text-sm font-semibold text-foreground">
            {data.toName || (
              <span className="text-muted-foreground/40 font-normal">
                Recipient name
              </span>
            )}
          </p>
          {data.toAddress && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.toAddress}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="px-8 py-6 border-b border-border" style={{ backgroundColor: data.design?.tableColor || undefined }}>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Details
        </p>
        {data.description ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {data.description}
          </p>
        ) : (
          <div className="space-y-2 opacity-50">
            {/* Skeleton placeholders */}
            <div className="h-2 bg-secondary rounded w-full"></div>
            <div className="h-2 bg-secondary rounded w-4/5"></div>
            <div className="h-2 bg-secondary rounded w-3/4"></div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 flex items-center justify-between bg-secondary/30">
        <p className="text-[10px] text-muted-foreground">
          Generated by Invo.ai
        </p>
        <PDFDownloadButton
          data={data}
          variant="ghost"
          size="sm"
        />
      </div>
    </div>
  )
}

/* ─── Main DocumentPreview ─── */
export function DocumentPreview({ data }: DocumentPreviewProps) {
  const hasContent =
    data.documentType || data.fromName || data.toName || data.description

  if (!hasContent) {
    return <EmptyState />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-auto">
        {data.documentType === "Invoice" ? (
          <InvoicePreview data={data} />
        ) : (
          <GenericPreview data={data} />
        )}
      </div>
    </div>
  )
}
