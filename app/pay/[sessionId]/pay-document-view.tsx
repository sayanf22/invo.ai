"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { Loader2, FileText, CheckCircle2, Clock, RefreshCw, AlertCircle, X } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport, calculateTotal, formatCurrency, fromMinorUnits, getCurrencySymbol } from "@/lib/invoice-types"
import { resolvePdfComponent } from "@/lib/pdf-export-helpers"
import { cn } from "@/lib/utils"
import type { PaymentInfo } from "./page"

// ── Types ─────────────────────────────────────────────────────────────

interface Props {
  docData: InvoiceData | null
  payment: PaymentInfo | null
  sessionId?: string
  documentType?: string
  existingResponse?: "accepted" | "declined" | "changes_requested" | null
  /**
   * When true, render a "no longer available" UI instead of the document.
   * Set by the server when the owner has cancelled the share after sending.
   */
  cancelled?: boolean
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
  const { resolveLogoUrl } = await import("@/lib/resolve-logo-url")
  const logoUrl = await resolveLogoUrl(cleaned.fromLogo).catch(() => null)
  const templates = await import("@/lib/pdf-templates")
  const docType = (cleaned.documentType || "").toLowerCase()

  const PdfComponent = resolvePdfComponent(templates, docType, cleaned) as React.ComponentType<{
    data: InvoiceData
    logoUrl?: string | null
    paymentQrCode?: string | null
  }>

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

function StatusBadge({ status }: { status: PaymentInfo["status"] }) {
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
        <AlertCircle className="w-4 h-4" />
        Expired
      </span>
    )
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-semibold">
        <AlertCircle className="w-4 h-4" />
        Cancelled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-sm font-semibold">
      <Clock className="w-4 h-4" />
      Pending
    </span>
  )
}

// ── Main Client Component ─────────────────────────────────────────────

export function PayDocumentView({ docData, payment: initialPayment, sessionId, documentType, existingResponse, cancelled }: Props) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [rendering, setRendering] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Live payment state — starts from server-rendered value, can be refreshed
  const [payment, setPayment] = useState<PaymentInfo | null>(initialPayment)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Quotation/proposal response state
  const [responseStatus, setResponseStatus] = useState<"accepted" | "declined" | "changes_requested" | null>(existingResponse ?? null)
  const [responseNote, setResponseNote] = useState("")
  const [respondingAs, setRespondingAs] = useState<"accepted" | "declined" | "changes_requested" | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Track document view with the public capability only.
  useEffect(() => {
    if (!sessionId) return
    fetch("/api/emails/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId: sessionId }),
    }).catch(() => {})
  }, [sessionId])

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

  // Generate QR code only for active (unpaid) payment links
  useEffect(() => {
    if (!payment?.short_url || payment.status !== "created") return
    generateQRDataUrl(payment.short_url).then(setQrDataUrl)
  }, [payment])

  // Poll payment status after the user clicks "Pay Now" — check every 5s for up to 2 minutes
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const checkPaymentStatus = useCallback(async () => {
    if (!sessionId) return
    setCheckingStatus(true)
    try {
      const res = await fetch(`/api/payments/status?publicId=${encodeURIComponent(sessionId)}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.status) {
        setPayment(prev => prev ? { ...prev, status: data.status, amount_paid: data.amount_paid ?? prev.amount_paid, paid_at: data.paid_at ?? prev.paid_at } : prev)
        setLastChecked(new Date())
        // Stop polling once paid
        if (data.status === "paid") stopPolling()
      }
    } catch { /* non-fatal */ }
    finally { setCheckingStatus(false) }
  }, [sessionId, stopPolling])

  // Start polling when user opens the payment link (they clicked Pay Now)
  const handlePayNow = useCallback(() => {
    if (!payment?.short_url) return
    // Open payment link
    window.open(payment.short_url, "_blank", "noopener,noreferrer") ||
      (window.location.href = payment.short_url)
    // Poll for status updates — check after 5s, then every 10s for up to 2 min
    stopPolling()
    let attempts = 0
    const maxAttempts = 12 // 2 minutes at 10s intervals
    setTimeout(() => {
      checkPaymentStatus()
      pollRef.current = setInterval(() => {
        attempts++
        checkPaymentStatus()
        if (attempts >= maxAttempts) stopPolling()
      }, 10_000)
    }, 5_000)
  }, [payment, checkPaymentStatus, stopPolling])

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling])

  // ── Cancelled by owner ──────────────────────────────────────────────
  if (cancelled) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto">
            <X className="h-8 w-8 text-neutral-500 dark:text-neutral-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Document no longer available
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              The owner has cancelled this document. The link is no longer valid.
            </p>
            <p className="text-xs text-neutral-500/70 dark:text-neutral-400/70 pt-2">
              If you believe this is an error, please contact the sender directly.
            </p>
          </div>
        </div>
      </div>
    )
  }

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
  // For proposals/quotes/contracts: prefer referenceNumber (PROP-..., QUO-..., CTR-...)
  // over invoiceNumber which may hold an internal ID or wrong prefix
  const isInvoiceType = docType.toLowerCase() === "invoice"
  const docRef = isInvoiceType
    ? (docData.invoiceNumber || docData.referenceNumber || docTypeLabel)
    : (docData.referenceNumber || docData.invoiceNumber || docTypeLabel)

  // For tiered proposals (hideTotals: true) the "total" is meaningless —
  // it's the sum of mutually exclusive plan options which the client picks ONE of.
  // Never show this sum as the proposal value. Show "View plans" instead.
  const isTimedProposal = docType.toLowerCase() === "proposal" || docType.toLowerCase() === "quotation" || docType.toLowerCase() === "quote"
  const hasTieredPricing = (docData as any).hideTotals === true
  const showAmountInHeader = !hasTieredPricing && total > 0

  const isPaid = payment?.status === "paid"
  const isPartiallyPaid = payment?.status === "partially_paid"
  const isActive = payment?.status === "created"
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
              {showAmountInHeader ? (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {currencySymbol}{total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {docData.currency || "USD"}
                  </p>
                </>
              ) : hasTieredPricing ? (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium">
                  View plans inside
                </span>
              ) : null}
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

      {/* Payment section — only for invoices */}
      {payment && (
        <div className="max-w-2xl mx-auto px-4 py-4">

          {/* ── PAID ── */}
          {(isPaid || isPartiallyPaid) && (
            <div className={cn(
              "rounded-2xl border p-5 text-center",
              isPaid
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40"
            )}>
              <CheckCircle2 className={cn("w-8 h-8 mx-auto mb-2", isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")} />
              <p className={cn("font-semibold", isPaid ? "text-emerald-800 dark:text-emerald-300" : "text-amber-800 dark:text-amber-300")}>
                {isPaid ? "Payment received" : "Partial payment received"}
              </p>
              {payment.amount_paid != null && (
                <p className={cn("text-sm mt-0.5", isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  {formatCurrency(fromMinorUnits(payment.amount_paid, payment.currency), payment.currency)} paid
                  {isPartiallyPaid && ` of ${formatCurrency(fromMinorUnits(payment.amount, payment.currency), payment.currency)}`}
                </p>
              )}
              {payment.is_manual && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Marked as paid manually</p>
              )}
            </div>
          )}

          {/* ── ACTIVE — show Pay Now button ── */}
          {isActive && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Complete your payment
                </p>

                <button
                  type="button"
                  onClick={handlePayNow}
                  className="flex items-center justify-center w-full px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-base transition-colors shadow-sm touch-manipulation select-none"
                >
                  {showAmountInHeader
                    ? `Pay Now — ${currencySymbol}${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "Pay Now"
                  }
                </button>

                {/* QR code */}
                {qrDataUrl && (
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col items-center gap-2">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Or scan to pay on your phone
                    </p>
                    <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white p-2">
                      <img src={qrDataUrl} alt="Scan to pay" className="w-full h-full" />
                    </div>
                  </div>
                )}

                {/* Check status button — shown after user has clicked Pay Now */}
                {lastChecked && (
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {checkingStatus ? "Checking…" : `Checked ${lastChecked.toLocaleTimeString()}`}
                    </p>
                    <button
                      type="button"
                      onClick={checkPaymentStatus}
                      disabled={checkingStatus}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", checkingStatus && "animate-spin")} />
                      Refresh status
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EXPIRED / CANCELLED ── */}
          {isInactive && (
            <ExpiredPaymentCard
              status={payment!.status as "expired" | "cancelled"}
              senderName={docData.fromName || "the sender"}
              sessionId={sessionId ?? ""}
            />
          )}
        </div>
      )}

      {/* Accept / Reject / Need Changes — for quotes and proposals */}
      {sessionId && (documentType === "quotation" || documentType === "quote" || documentType === "proposal") && docData.allowClientResponse !== false && (
        <div className="max-w-2xl mx-auto px-4 py-4">
          {!responseStatus ? (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  How would you like to respond to this {docTypeLabel.toLowerCase()}?
                </p>

                {!respondingAs ? (
                  <div className="flex gap-2.5">
                    <button type="button"
                      onClick={() => setRespondingAs("accepted")}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 active:scale-[0.98] transition-all">
                      Accept
                    </button>
                    <button type="button"
                      onClick={() => setRespondingAs("changes_requested")}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all">
                      Need Changes
                    </button>
                    <button type="button"
                      onClick={() => setRespondingAs("declined")}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all">
                      Decline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {respondingAs === "accepted" ? "Accepting" : respondingAs === "declined" ? "Declining" : "Requesting changes"}
                    </span>
                    {(respondingAs === "changes_requested" || respondingAs === "declined") && (
                      <textarea
                        value={responseNote}
                        onChange={e => setResponseNote(e.target.value)}
                        placeholder={respondingAs === "changes_requested" ? "What changes would you like?" : "Reason for declining (optional)"}
                        rows={3}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
                      />
                    )}
                    <div className="flex gap-2.5">
                      <button type="button" onClick={() => { setRespondingAs(null); setResponseNote("") }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98]">
                        Back
                      </button>
                      <button type="button"
                        disabled={submitting || (respondingAs === "changes_requested" && !responseNote.trim())}
                        onClick={async () => {
                          setSubmitting(true)
                          try {
                            const res = await fetch("/api/quotations/respond", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                publicId: sessionId,
                                response: respondingAs,
                                clientName: docData.toName || undefined,
                                clientEmail: docData.toEmail || undefined,
                                note: responseNote.trim() || undefined,
                              }),
                            })
                            if (res.ok) setResponseStatus(respondingAs)
                          } catch { /* non-fatal */ }
                          finally { setSubmitting(false) }
                        }}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50">
                        {submitting ? "Submitting…" : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Already responded — show confirmation */
            <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-5 text-center">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                {responseStatus === "accepted" ? "✓ Accepted" : responseStatus === "declined" ? "✗ Declined" : "↩ Changes Requested"}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {responseStatus === "accepted"
                  ? `You've accepted this ${docTypeLabel.toLowerCase()}. ${docData.fromName || "The sender"} has been notified.`
                  : responseStatus === "declined"
                    ? `You've declined this ${docTypeLabel.toLowerCase()}. ${docData.fromName || "The sender"} has been notified.`
                    : `Your change request has been sent to ${docData.fromName || "the sender"}.`}
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

// ── Expired Payment Card with auto-retry ──────────────────────────────
// Shown only if server-side auto-regen failed (e.g. gateway hiccup at SSR time).
// Lets the recipient retry once more from the client, then falls back to a
// clear "contact sender" message.

function ExpiredPaymentCard({
  status,
  senderName,
  sessionId,
}: {
  status: "expired" | "cancelled"
  senderName: string
  sessionId: string
}) {
  const [retrying, setRetrying] = useState(false)
  const [retried, setRetried] = useState(false)

  const handleRetry = useCallback(async () => {
    if (!sessionId || retrying) return
    setRetrying(true)
    try {
      const res = await fetch("/api/payments/regenerate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: sessionId }),
      })
      if (res.ok) {
        // Fresh link generated — reload the page to pick up the new state.
        window.location.reload()
        return
      }
      setRetried(true)
    } catch {
      setRetried(true)
    } finally {
      setRetrying(false)
    }
  }, [sessionId, retrying])

  // Cancelled = sender intent — do not offer retry
  if (status === "cancelled") {
    return (
      <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-5 text-center">
        <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
        <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
          Payment link is no longer active
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Please contact <strong>{senderName}</strong> to arrange payment.
        </p>
      </div>
    )
  }

  // Expired + retry not yet failed — offer refresh
  return (
    <div className="rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 p-5 text-center">
      <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
      <p className="font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
        {retried ? "We couldn't refresh the payment link" : "Payment link needs a quick refresh"}
      </p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {retried
          ? <>Please contact <strong>{senderName}</strong> to arrange payment.</>
          : <>Click below to generate a fresh link. This takes a few seconds.</>}
      </p>
      {!retried && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
            "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900",
            "hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          )}
        >
          {retrying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Refreshing…
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Refresh payment link
            </>
          )}
        </button>
      )}
    </div>
  )
}
