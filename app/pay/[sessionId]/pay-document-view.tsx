"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Loader2, FileText, CheckCircle2, Clock } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport, calculateTotal, getCurrencySymbol } from "@/lib/invoice-types"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────

interface PaymentInfo {
  short_url: string
  status: string
  amount: number
  currency: string
  amount_paid: number | null
}

interface Props {
  docData: InvoiceData | null
  payment: PaymentInfo | null
}

// ── QR Code ───────────────────────────────────────────────────────────

async function generateQRDataUrl(url: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode")
    return await QRCode.default.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
  } catch {
    return null
  }
}

// ── PDF generation ────────────────────────────────────────────────────

async function buildPdfBlob(data: InvoiceData): Promise<Blob> {
  const cleaned = cleanDataForExport(data)
  // For the public pay page, we don't embed the payment QR in the PDF itself
  const { resolveLogoUrl } = await import("@/lib/resolve-logo-url")
  const logoUrl = await resolveLogoUrl(cleaned.fromLogo).catch(() => null)
  const templates = await import("@/lib/pdf-templates")
  const docType = (cleaned.documentType || "").toLowerCase()

  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }>
  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    case "receipt": PdfComponent = templates.ReceiptPDF; break
    default:
      PdfComponent = (cleaned.design?.layout === "receipt" || cleaned.design?.templateId === "receipt")
        ? templates.ReceiptPDF
        : templates.InvoicePDF
      break
  }

  return pdf(<PdfComponent data={cleaned} logoUrl={logoUrl} />).toBlob()
}

// ── PDF Viewer ────────────────────────────────────────────────────────

const PDF_OPTIONS = {
  standardFontDataUrl: "/standard_fonts/",
  cMapUrl: "/cmaps/",
  cMapPacked: true,
} as const

function PdfViewer({ pdfBytes }: { pdfBytes: Uint8Array }) {
  const [ViewerComponents, setViewerComponents] = useState<{ Document: any; Page: any } | null>(null)
  const [numPages, setNumPages] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const optionsRef = useRef(PDF_OPTIONS)

  useEffect(() => {
    let cancelled = false
    import("react-pdf").then((m) => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      if (!cancelled) setViewerComponents({ Document: m.Document, Page: m.Page })
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width)
    })
    obs.observe(el)
    setContainerWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const fileData = useMemo(() => ({ data: pdfBytes.slice() }), [pdfBytes])
  // On mobile, use full container width minus minimal padding to avoid overflow
  const pageWidth = containerWidth > 0 ? Math.min(containerWidth - 8, 800) : 320

  if (!ViewerComponents) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-hidden">
      <ViewerComponents.Document
        file={fileData}
        onLoadSuccess={({ numPages: n }: { numPages: number }) => setNumPages(n)}
        options={optionsRef.current}
        loading={
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 py-4">
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="shadow-lg rounded-lg overflow-hidden bg-white w-full">
              <ViewerComponents.Page
                pageNumber={i + 1}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))}
        </div>
      </ViewerComponents.Document>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
        <CheckCircle2 className="w-4 h-4" />
        Paid
      </span>
    )
  }
  if (status === "partially_paid") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-sm font-semibold">
        <Clock className="w-4 h-4" />
        Partially Paid
      </span>
    )
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-semibold">
        <Clock className="w-4 h-4" />
        Expired
      </span>
    )
  }
  // Don't show a badge for cancelled — just show the document normally
  if (status === "cancelled") {
    return null
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-sm font-semibold">
      <Clock className="w-4 h-4" />
      Pending
    </span>
  )
}

// ── Main Client Component ─────────────────────────────────────────────

export function PayDocumentView({ docData, payment }: Props) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [rendering, setRendering] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Track document view (fire-and-forget)
  useEffect(() => {
    // Extract sessionId from URL
    const path = window.location.pathname
    const match = path.match(/\/pay\/([0-9a-f-]+)/i)
    if (match?.[1]) {
      fetch("/api/emails/track-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: match[1] }),
      }).catch(() => {})
    }
  }, [])

  // Render PDF
  useEffect(() => {
    if (!docData) return
    let cancelled = false
    const render = async () => {
      setRendering(true)
      try {
        const blob = await buildPdfBlob(docData)
        if (cancelled) return
        const buf = await blob.arrayBuffer()
        setPdfBytes(new Uint8Array(buf))
      } catch (err) {
        console.error("PDF render error:", err)
      } finally {
        if (!cancelled) setRendering(false)
      }
    }
    render()
    return () => { cancelled = true }
  }, [docData])

  // Generate QR code for gateway URL
  useEffect(() => {
    if (!payment?.short_url) return
    const isActive = payment.status === "created" || payment.status === "partially_paid"
    if (!isActive) return
    generateQRDataUrl(payment.short_url).then(setQrDataUrl)
  }, [payment])

  // ── Document not found ──────────────────────────────────────────────
  if (!docData) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <FileText className="w-8 h-8 text-neutral-400" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Document not found
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            This link may be invalid or the document may have been removed.
          </p>
        </div>
      </div>
    )
  }

  const { total } = calculateTotal(docData)
  const currencySymbol = getCurrencySymbol(docData.currency || "USD")
  const docType = (docData.documentType || "Invoice")
  const docTypeLabel = docType.charAt(0).toUpperCase() + docType.slice(1)
  const docRef = docData.invoiceNumber || docData.referenceNumber || docTypeLabel

  const isPaid = payment?.status === "paid"
  const isActive = payment?.status === "created" || payment?.status === "partially_paid"
  const isInactive = payment?.status === "expired" || payment?.status === "cancelled"

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-0.5">
                {docData.fromName || "Business"}
              </p>
              <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {docRef}
              </h1>
              {docData.toName && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  To: {docData.toName}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {currencySymbol} {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {docData.currency || "USD"}
              </p>
            </div>
          </div>

          {/* Status badge */}
          {payment && (
            <div className="mt-3">
              <StatusBadge status={payment.status} />
            </div>
          )}
        </div>
      </div>

      {/* Payment controls */}
      {payment && (
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Paid state */}
          {isPaid && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Payment received</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                {payment.currency} {((payment.amount_paid ?? payment.amount) / 100).toFixed(2)} paid
              </p>
            </div>
          )}

          {/* Active payment state */}
          {isActive && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Complete your payment
                </p>

                {/* Pay Now button — use location.href for mobile compatibility */}
                <a
                  href={payment.short_url}
                  onClick={(e) => {
                    // On mobile, target="_blank" can be blocked; use direct navigation as fallback
                    if (typeof window !== "undefined") {
                      e.preventDefault()
                      window.open(payment.short_url, "_blank", "noopener,noreferrer") ||
                        (window.location.href = payment.short_url)
                    }
                  }}
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-full px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base transition-colors shadow-sm touch-manipulation select-none"
                >
                  Pay Now — {currencySymbol} {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </a>

                {/* QR code */}
                {qrDataUrl && (
                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-2">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Or scan to pay on your phone
                    </p>
                    <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white p-2">
                      <img src={qrDataUrl} alt="Scan to pay" className="w-full h-full" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expired / Cancelled state */}
          {isInactive && (
            <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-5 text-center">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                {payment.status === "expired" ? "Payment link has expired" : "Payment link is no longer active"}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Please contact <strong>{docData.fromName || "the sender"}</strong> to arrange payment.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PDF Preview */}
      <div className="max-w-2xl mx-auto px-2 sm:px-4 pb-8 overflow-x-hidden">
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              {docTypeLabel} Preview
            </p>
          </div>
          <div className="p-1 sm:p-4 bg-neutral-100 dark:bg-neutral-950 min-h-[300px] overflow-x-hidden">
            {rendering && !pdfBytes && (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2.5 bg-white dark:bg-neutral-900 px-4 py-2.5 rounded-xl shadow border border-neutral-200 dark:border-neutral-800">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-neutral-500">Loading preview…</span>
                </div>
              </div>
            )}
            {pdfBytes && (
              <div className={cn("transition-opacity duration-300", rendering ? "opacity-60" : "opacity-100")}>
                <PdfViewer pdfBytes={pdfBytes} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 px-4">
        <p className="text-xs text-neutral-400 dark:text-neutral-600">
          Powered by Clorefy
        </p>
      </div>
    </div>
  )
}
