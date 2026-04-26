"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { FileText, Edit3, Loader2, ZoomIn, ZoomOut, Maximize2, RotateCcw, Printer, Mail, PenLine, Download } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { PDFDownloadButton } from "@/components/pdf-download-button"
import { TemplatePicker } from "@/components/template-picker"
import { ShareButton } from "@/components/share-button"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { PaymentLinkButton } from "@/components/payment-link-button"
import { GetSignatureModal } from "@/components/get-signature-modal"
import { useSupabase, useUser } from "@/components/auth-provider"
import { parseTier } from "@/lib/cost-protection"
import { cn } from "@/lib/utils"

const SIGNATURE_DOCUMENT_TYPES = ["contract", "quotation", "proposal"]

interface DocumentPreviewProps {
  data: InvoiceData
  onChange?: (updates: Partial<InvoiceData>) => void
  onToggleEditor?: () => void
  showEditor?: boolean
  sessionId?: string | null
  onPaymentLinkChange?: (shortUrl: string, status: string) => void
  /** Called when invoice lock state changes (true = locked after payment link created) */
  onLockChange?: (locked: boolean) => void
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

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200]
const DEFAULT_ZOOM = 100

// Module-level constant — stable across HMR, never recreated
const PDF_OPTIONS = {
  standardFontDataUrl: "/standard_fonts/",
  cMapUrl: "/cmaps/",
  cMapPacked: true,
} as const

/* ─── Live PDF Preview ─── */
function LivePDFPreview({ data, zoom, onPageCount }: { data: InvoiceData; zoom: number; onPageCount: (n: number) => void }) {
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [isRendering, setIsRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [ViewerComponents, setViewerComponents] = useState<{
    Document: any
    Page: any
  } | null>(null)
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  // useRef guarantees the same object identity across ALL renders and HMR updates
  // This silences react-pdf's "options changed" warning in dev mode
  const pdfOptionsRef = useRef(PDF_OPTIONS)

  // Dynamically load react-pdf to avoid SSR issues
  useEffect(() => {
    let cancelled = false
    async function loadViewer() {
      try {
        const reactPdf = await import("react-pdf")
        reactPdf.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        if (!cancelled) {
          setViewerComponents({
            Document: reactPdf.Document,
            Page: reactPdf.Page,
          })
          setViewerReady(true)
        }
      } catch (err) {
        console.error("Failed to load PDF viewer:", err)
        if (!cancelled) setError("Failed to load PDF viewer")
      }
    }
    loadViewer()
    return () => { cancelled = true }
  }, [])

  // Measure container width for responsive page sizing
  // Debounced to avoid re-rendering PDF during history sidebar slide animation (300ms)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => setContainerWidth(w), 350)
      }
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => {
      observer.disconnect()
      if (resizeTimer) clearTimeout(resizeTimer)
    }
  }, [])

  const generatePdf = useCallback(async (docData: InvoiceData) => {
    setIsRendering(true)
    setError(null)
    try {
      const templates = await import("@/lib/pdf-templates")
      const docType = (docData.documentType || "").toLowerCase()

      // Resolve logo URL from R2 key
      const logoUrl = await resolveLogoUrl(docData.fromLogo)

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
      switch (docType) {
        case "contract":
          PdfComponent = templates.ContractPDF
          break
        case "quotation":
          PdfComponent = templates.QuotationPDF
          break
        case "proposal":
          PdfComponent = templates.ProposalPDF
          break
        case "receipt":
          PdfComponent = templates.ReceiptPDF
          break
        default:
          PdfComponent = (docData.design?.layout === "receipt" || docData.design?.templateId === "receipt")
            ? templates.ReceiptPDF
            : templates.InvoicePDF
          break
      }

      const instance = pdf(<PdfComponent data={docData} logoUrl={logoUrl} />)
      const blob = await instance.toBlob()

      if (!mountedRef.current) return

      const arrayBuffer = await blob.arrayBuffer()
      // Copy the buffer so react-pdf's worker transfer doesn't detach our reference
      setPdfBytes(new Uint8Array(arrayBuffer).slice())
    } catch (err) {
      console.error("PDF preview render error:", err)
      if (mountedRef.current) setError("Failed to render preview")
    } finally {
      if (mountedRef.current) setIsRendering(false)
    }
  }, [])

  const dataKey = useMemo(() => {
    try { return JSON.stringify(data) }
    catch { return String(Date.now()) }
  }, [data])

  useEffect(() => {
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current)
    renderTimeoutRef.current = setTimeout(() => {
      generatePdf(cleanDataForExport(data))
    }, 400)
    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current)
    }
  }, [dataKey, generatePdf]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n)
    onPageCount(n)
  }, [onPageCount])

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("react-pdf Document load error:", err)
    setError("Could not load preview")
  }, [])

  // A4 aspect ratio: 595pt wide. Base width is container - padding, scaled by zoom.
  const baseWidth = containerWidth > 0 ? Math.min(containerWidth - 48, 800) : 600
  const pageWidth = Math.round(baseWidth * (zoom / 100))

  const fileData = useMemo(() => {
    if (!pdfBytes) return null
    // Always pass a fresh copy — react-pdf transfers the buffer to its Worker,
    // which detaches the original. A new copy avoids "already detached" errors.
    return { data: pdfBytes.slice() }
  }, [pdfBytes])

  // Early return AFTER all hooks to avoid "Rendered fewer hooks" error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileText className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto">
      {/* Smooth rendering overlay — fades in/out instead of popping */}
      <div className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[3px] transition-opacity duration-300 pointer-events-none",
        isRendering ? "opacity-100" : "opacity-0"
      )}>
        <div className="flex items-center gap-2.5 bg-card px-5 py-3 rounded-2xl shadow-lg border border-border/60">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Updating preview...</span>
        </div>
      </div>

      {fileData && viewerReady && ViewerComponents ? (
        <div className={cn(
          "flex flex-col items-center gap-6 py-6 transition-opacity duration-500",
          isRendering ? "opacity-60" : "opacity-100"
        )}>
          <ViewerComponents.Document
            file={fileData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={pdfOptionsRef.current}
            loading={
              <div className="flex items-center gap-2.5 py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading document...</span>
              </div>
            }
            error={
              <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                <FileText className="w-8 h-8" />
                <p className="text-sm">Could not load preview</p>
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div key={i} className="shadow-lg rounded-lg overflow-hidden mb-6 bg-white">
                <ViewerComponents.Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </div>
            ))}
          </ViewerComponents.Document>
          {numPages > 0 && (
            <p className="text-xs text-muted-foreground pb-2">
              {numPages} {numPages === 1 ? "page" : "pages"}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Generating preview...</span>
          </div>
        </div>
      )}
    </div>
  )
}


/* ─── Toolbar Button ─── */
function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-95",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground/70 hover:text-foreground hover:bg-secondary",
        disabled && "opacity-30 pointer-events-none"
      )}
    >
      {children}
    </button>
  )
}

/* ─── Toolbar Separator ─── */
function ToolbarSep() {
  return <div className="w-px h-5 bg-border mx-1" />
}

/* ─── Main DocumentPreview ─── */
export function DocumentPreview({ data, onChange, onToggleEditor, showEditor, sessionId, onPaymentLinkChange, onLockChange }: DocumentPreviewProps) {
  const supabase = useSupabase()
  const user = useUser()
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [pageCount, setPageCount] = useState(0)
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false)
  const [getSignatureModalOpen, setGetSignatureModalOpen] = useState(false)
  const [signatures, setSignatures] = useState<Array<{ id: string; signed_at: string | null }>>([])
  const [signaturesLoading, setSignaturesLoading] = useState(false)
  const [userTier, setUserTier] = useState<"free" | "starter" | "pro" | "agency">("free")
  const hasContent = data.documentType || data.fromName || data.toName || data.description

  const supportsSignatures = SIGNATURE_DOCUMENT_TYPES.includes((data.documentType || "").toLowerCase())
  const hasPendingSignatures = signatures.length > 0 && !signatures.every(s => s.signed_at)
  const allSigned = signatures.length > 0 && signatures.every(s => s.signed_at)
  const hasDeclined = signatures.some((s: any) => s.signer_action === "declined")
  const hasRevisionRequested = signatures.some((s: any) => s.signer_action === "revision_requested")

  // Fetch user tier once on mount
  useEffect(() => {
    if (!user) return
    ;(supabase as any)
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data: sub }: { data: { plan?: string } | null }) => {
        if (sub?.plan) {
          setUserTier(parseTier(sub.plan))
        }
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionId || !supportsSignatures) return
    setSignaturesLoading(true)
    fetch(`/api/signatures?sessionId=${sessionId}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.signatures) setSignatures(json.signatures)
      })
      .catch(() => {})
      .finally(() => setSignaturesLoading(false))
  }, [sessionId, supportsSignatures])

  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const next = ZOOM_LEVELS.find(z => z > prev)
      return next ?? prev
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = [...ZOOM_LEVELS].reverse().find(z => z < prev)
      return next ?? prev
    })
  }, [])

  const handleFitWidth = useCallback(() => {
    setZoom(DEFAULT_ZOOM)
  }, [])

  const handlePrint = useCallback(async () => {
    try {
      const cleanedData = cleanDataForExport(data)
      const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
      const templates = await import("@/lib/pdf-templates")
      const docType = (cleanedData.documentType || "").toLowerCase()

      // Generate QR for payment link if enabled
      let paymentQrCode: string | null = null
      const shouldEmbedPaymentLink = cleanedData.showPaymentLinkInPdf !== false
      if ((docType === "invoice" || !docType) && shouldEmbedPaymentLink && cleanedData.paymentLink &&
          cleanedData.paymentLinkStatus !== "paid" &&
          cleanedData.paymentLinkStatus !== "expired" &&
          cleanedData.paymentLinkStatus !== "cancelled") {
        try {
          const QRCode = await import("qrcode")
          paymentQrCode = await QRCode.default.toDataURL(cleanedData.paymentLink, {
            width: 200, margin: 1, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M",
          })
        } catch { /* ignore QR errors */ }
      }

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }>
      switch (docType) {
        case "contract": PdfComponent = templates.ContractPDF; break
        case "quotation": PdfComponent = templates.QuotationPDF; break
        case "proposal": PdfComponent = templates.ProposalPDF; break
        case "receipt": PdfComponent = templates.ReceiptPDF; break
        default: PdfComponent = (cleanedData.design?.layout === "receipt" || cleanedData.design?.templateId === "receipt")
          ? templates.ReceiptPDF
          : templates.InvoicePDF; break
      }

      const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />).toBlob()
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url)
      if (printWindow) {
        printWindow.addEventListener("load", () => {
          printWindow.print()
        })
      }
    } catch (err) {
      console.error("Print error:", err)
    }
  }, [data])

  const canZoomIn = zoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
  const canZoomOut = zoom > ZOOM_LEVELS[0]

  if (!hasContent) return <EmptyState />

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="relative z-10 flex items-center justify-between px-2 sm:px-4 py-2.5 border-b border-border bg-card shrink-0 gap-1.5 sm:gap-2 min-h-[48px] overflow-x-auto scrollbar-none"
        style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.06), 0 4px 12px -2px rgba(0,0,0,0.08)", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Left: Design + Editor toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onChange && <TemplatePicker data={data} onChange={onChange} />}
          {onToggleEditor && (
            <button
              type="button"
              onClick={onToggleEditor}
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95",
                showEditor
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card border-border/60 text-foreground hover:border-primary/40 hover:shadow-md shadow-sm"
              )}
            >
              <Edit3 className="w-4 h-4" />
              <span key={showEditor ? "hide-editor" : "editor"} className="hidden sm:inline animate-text-swap">
                {showEditor ? "Hide Editor" : "Editor"}
              </span>
            </button>
          )}
        </div>

        {/* Center: Zoom controls + page info — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 bg-secondary/60 border border-border rounded-xl px-2 py-1 shadow-sm">
          <ToolbarBtn onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </ToolbarBtn>
          <span className="text-xs font-semibold text-foreground min-w-[40px] text-center tabular-nums select-none">
            {zoom}%
          </span>
          <ToolbarBtn onClick={handleZoomIn} disabled={!canZoomIn} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarSep />
          <ToolbarBtn onClick={handleFitWidth} active={zoom === DEFAULT_ZOOM} title="Fit to width">
            <Maximize2 className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => setZoom(DEFAULT_ZOOM)} title="Reset zoom">
            <RotateCcw className="w-4 h-4" />
          </ToolbarBtn>
          {pageCount > 0 && (
            <>
              <ToolbarSep />
              <span className="text-xs text-muted-foreground px-1 select-none">
                {pageCount} {pageCount === 1 ? "pg" : "pgs"}
              </span>
            </>
          )}
        </div>

        {/* Mobile: page count only */}
        {pageCount > 0 && (
          <span className="sm:hidden text-xs text-muted-foreground select-none">
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
        )}

        {/* Right: Payment Link (invoices) + Send + Share + Print + Download */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 overflow-x-auto max-w-[calc(100vw-120px)] sm:max-w-none scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {/* Signature status badges */}
          {supportsSignatures && sessionId && hasPendingSignatures && !hasDeclined && !hasRevisionRequested && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Pending Signature
            </span>
          )}
          {supportsSignatures && sessionId && hasDeclined && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
              Declined
            </span>
          )}
          {supportsSignatures && sessionId && hasRevisionRequested && !hasDeclined && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Revision Requested
            </span>
          )}
          {supportsSignatures && sessionId && allSigned && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
              Signed
            </span>
          )}
          {/* For contracts/proposals: single "Send & Sign" button that opens signature modal */}
          {supportsSignatures && sessionId && (
            <button
              type="button"
              onClick={() => setGetSignatureModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-400 shadow-sm transition-all duration-200 active:scale-95 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40"
              title="Request signature — sends signing link via email or WhatsApp"
            >
              <PenLine className="w-4 h-4" />
              <span className="hidden sm:inline">Request Signature</span>
            </button>
          )}
          {/* For non-signature docs (invoices): show Send button separately */}
          {!supportsSignatures && sessionId && (
            <button
              type="button"
              onClick={() => setSendEmailDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-95"
              title="Send document via email"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          )}
          {/* Download Signed PDF button */}
          {supportsSignatures && sessionId && allSigned && (
            <a
              href={`/api/signatures/download/${sessionId}`}
              download
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-95"
              title="Download signed PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Signed PDF</span>
            </a>
          )}
          {sessionId && (
            <PaymentLinkButton
              sessionId={sessionId}
              invoiceData={data}
              documentType={data.documentType || "invoice"}
              onPaymentLinkChange={onPaymentLinkChange}
              onLockChange={onLockChange}
            />
          )}
          <ShareButton data={data} sessionId={sessionId ?? null} onOpenSendDialog={() => setSendEmailDialogOpen(true)} />
          <button
            type="button"
            onClick={handlePrint}
            title="Print document"
            aria-label="Print document"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-md shadow-sm transition-all duration-200 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden lg:inline">Print</span>
          </button>
          <PDFDownloadButton data={data} size="sm" variant="outline" />
        </div>
      </div>

      {/* Live PDF Preview */}
      <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
        <LivePDFPreview data={data} zoom={zoom} onPageCount={setPageCount} />
      </div>

      {sessionId && (
        <SendEmailDialog
          open={sendEmailDialogOpen}
          onClose={() => setSendEmailDialogOpen(false)}
          sessionId={sessionId}
          invoiceData={data}
          documentType={data.documentType || "invoice"}
          userTier={userTier}
        />
      )}
      {supportsSignatures && sessionId && (
        <GetSignatureModal
          sessionId={sessionId}
          documentType={data.documentType || ""}
          open={getSignatureModalOpen}
          onOpenChange={setGetSignatureModalOpen}
        />
      )}
    </div>
  )
}
