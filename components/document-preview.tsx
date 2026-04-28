"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { FileText, Edit3, Loader2, ZoomIn, ZoomOut, Maximize2, RotateCcw, Printer, Mail, PenLine, Download, FileDown, ChevronDown, Image as ImageIcon, X } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { PDFDownloadButton } from "@/components/pdf-download-button"
import { TemplatePicker } from "@/components/template-picker"
import { ShareButton } from "@/components/share-button"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { PaymentLinkButton } from "@/components/payment-link-button"
import { MarkAsPaidButton } from "@/components/mark-as-paid-button"
import { GetSignatureModal } from "@/components/get-signature-modal"
import { SignatureCancelDialog } from "@/components/signature-cancel-dialog"
import { SignaturePad } from "@/components/signature-pad"
import { useSupabase, useUser } from "@/components/auth-provider"
import { parseTier } from "@/lib/cost-protection"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  const [signatures, setSignatures] = useState<Array<{ id: string; signed_at: string | null; signer_action: string | null; signer_name?: string }>>([])
  const [signaturesLoading, setSignaturesLoading] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [userTier, setUserTier] = useState<"free" | "starter" | "pro" | "agency">("free")
  const [exportingDocx, setExportingDocx] = useState(false)
  const [exportingImage, setExportingImage] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [manualPaid, setManualPaid] = useState(false)
  const [manualPaidAt, setManualPaidAt] = useState<string | null>(null)
  const [manualPaymentMethod, setManualPaymentMethod] = useState<string | null>(null)
  const [selfSignOpen, setSelfSignOpen] = useState(false)
  const [selfSignLoading, setSelfSignLoading] = useState(false)
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null | undefined>(undefined) // undefined = not loaded yet
  const hasContent = data.documentType || data.fromName || data.toName || data.description

  const supportsSignatures = SIGNATURE_DOCUMENT_TYPES.includes((data.documentType || "").toLowerCase())
  const hasPendingSignatures = signatures.some(s => s.signed_at === null && (s.signer_action === null || s.signer_action === undefined))
  const allSigned = signatures.length > 0 && signatures.every(s => s.signed_at !== null)
  const hasDeclined = signatures.some((s: any) => s.signer_action === "declined")
  const hasRevisionRequested = signatures.some((s: any) => s.signer_action === "revision_requested")

  // Toolbar state machine: idle | pending | signed | actionable
  const toolbarState: "idle" | "pending" | "signed" | "actionable" = (() => {
    if (signatures.length === 0) return "idle"
    if (hasPendingSignatures) return "pending"
    if (allSigned) return "signed"
    if (hasDeclined || hasRevisionRequested) return "actionable"
    return "idle"
  })()

  // Find the first pending signature for cancel flow
  const pendingSignature = signatures.find(s => s.signed_at === null && (s.signer_action === null || s.signer_action === undefined))

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

  // Fetch sent_at for invoice "Sent" badge — reset when session changes
  useEffect(() => {
    setSentAt(null)
    if (!sessionId || !user) return
    ;(supabase as any)
      .from("document_sessions")
      .select("sent_at")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: s }: { data: { sent_at?: string | null } | null }) => {
        if (s?.sent_at) setSentAt(s.sent_at)
      })
      .catch(() => {})
  }, [sessionId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if invoice is already manually marked as paid
  useEffect(() => {
    setManualPaid(false)
    setManualPaidAt(null)
    setManualPaymentMethod(null)
    const docType = (data.documentType || "").toLowerCase()
    if (!sessionId || !user || docType !== "invoice") return
    ;(supabase as any)
      .from("invoice_payments")
      .select("status, is_manual, manual_payment_method, paid_at, manually_marked_at, gateway")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: p }: { data: { status?: string; is_manual?: boolean; manual_payment_method?: string | null; paid_at?: string | null; manually_marked_at?: string | null; gateway?: string } | null }) => {
        if (p?.status === "paid" && (p.is_manual || p.gateway === "manual")) {
          setManualPaid(true)
          setManualPaidAt(p.paid_at || p.manually_marked_at || null)
          setManualPaymentMethod(p.manual_payment_method || null)
        }
      })
      .catch(() => {})
  }, [sessionId, user?.id, data.documentType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if sender has already self-signed this session
  const [senderSigned, setSenderSigned] = useState(false)
  useEffect(() => {
    setSenderSigned(false)
    if (!sessionId || !supportsSignatures) return
    ;(supabase as any)
      .from("signatures")
      .select("id, signed_at")
      .eq("session_id", sessionId)
      .eq("party", "Sender")
      .maybeSingle()
      .then(({ data: s }: { data: { signed_at?: string | null } | null }) => {
        if (s?.signed_at) setSenderSigned(true)
      })
      .catch(() => {})
  }, [sessionId, supportsSignatures]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved signature when self-sign panel opens
  useEffect(() => {
    if (!selfSignOpen || savedSignatureUrl !== undefined) return
    import("@/lib/auth-fetch").then(({ authFetch }) => {
      authFetch("/api/profile/signature")
        .then(r => r.json())
        .then(d => setSavedSignatureUrl(d.signatureDataUrl || null))
        .catch(() => setSavedSignatureUrl(null))
    })
  }, [selfSignOpen, savedSignatureUrl])

  const handleSelfSign = useCallback(async (signatureDataUrl: string) => {
    if (!sessionId || selfSignLoading) return
    setSelfSignLoading(true)
    try {
      const { authFetch } = await import("@/lib/auth-fetch")
      const res = await authFetch("/api/signatures/self-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, signatureDataUrl }),
      })
      const result = await res.json()
      if (res.ok) {
        setSenderSigned(true)
        setSelfSignOpen(false)
        toast.success("Your signature has been applied!")
        // Refresh signatures list
        const sigRes = await fetch(`/api/signatures?sessionId=${sessionId}`)
        if (sigRes.ok) {
          const sigData = await sigRes.json()
          if (sigData?.signatures) setSignatures(sigData.signatures)
        }
      } else {
        toast.error(result.error || "Failed to apply signature")
      }
    } catch {
      toast.error("Failed to apply signature")
    } finally {
      setSelfSignLoading(false)
    }
  }, [sessionId, selfSignLoading])

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

  // DOCX export
  const handleExportDocx = useCallback(async () => {
    if (exportingDocx) return
    setExportingDocx(true)
    try {
      const { generateDocx } = await import("@/lib/docx-export")
      const blob = await generateDocx(data)
      const docType = (data.documentType || "document").toLowerCase()
      const ref = data.invoiceNumber || data.referenceNumber || docType
      const filename = `${ref}_${new Date().toISOString().slice(0, 10)}.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("Word document downloaded!")
    } catch (err) {
      console.error("DOCX export error:", err)
      toast.error("Failed to generate Word document")
    } finally {
      setExportingDocx(false)
    }
  }, [data, exportingDocx])

  // Image export (PNG)
  const handleExportImage = useCallback(async (format: "png" | "jpg" = "png") => {
    if (exportingImage) return
    setExportingImage(true)
    try {
      const { generateDocumentImage } = await import("@/lib/image-export")
      const blob = await generateDocumentImage(data, format)
      const docType = (data.documentType || "document").toLowerCase()
      const ref = data.invoiceNumber || data.referenceNumber || docType
      const filename = `${ref}_${new Date().toISOString().slice(0, 10)}.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} image downloaded!`)
    } catch (err) {
      console.error("Image export error:", err)
      toast.error("Failed to generate image")
    } finally {
      setExportingImage(false)
    }
  }, [data, exportingImage])

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
          {/* Signature status badges — visible on all screen sizes */}
          {supportsSignatures && sessionId && hasPendingSignatures && !hasDeclined && !hasRevisionRequested && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Pending Signature
            </span>
          )}
          {supportsSignatures && sessionId && hasDeclined && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
              Declined
            </span>
          )}
          {supportsSignatures && sessionId && hasRevisionRequested && !hasDeclined && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Revision Requested
            </span>
          )}
          {supportsSignatures && sessionId && allSigned && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
              Signed
            </span>
          )}
          {/* For contracts/proposals: toolbar state machine for signature actions */}
          {supportsSignatures && sessionId && toolbarState === "pending" && (
            <button
              type="button"
              onClick={() => setCancelDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-400 shadow-sm transition-all duration-200 active:scale-95 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
              title="Cancel the pending signature request"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Cancel Request</span>
            </button>
          )}
          {supportsSignatures && sessionId && (toolbarState === "idle" || toolbarState === "actionable") && (
            <>
              {/* Sign as Sender (Party A) — only if not yet self-signed */}
              {!senderSigned && (
                <button
                  type="button"
                  onClick={() => setSelfSignOpen(v => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border shadow-sm transition-all duration-200 active:scale-95",
                    selfSignOpen
                      ? "border-emerald-400 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                  )}
                  title="Sign this document as the sender (Party A)"
                >
                  <PenLine className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign as Sender</span>
                </button>
              )}
              {senderSigned && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  ✓ You signed
                </span>
              )}
              <button
                type="button"
                onClick={() => setGetSignatureModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-400 shadow-sm transition-all duration-200 active:scale-95 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-900/40"
                title="Request signature — sends signing link via email or WhatsApp"
              >
                <PenLine className="w-4 h-4" />
                <span className="hidden sm:inline">Request Signature</span>
              </button>
            </>
          )}
          {/* For non-signature docs (invoices): show Sent badge + Send button */}
          {!supportsSignatures && sessionId && sentAt && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
              Sent
            </span>
          )}
          {!supportsSignatures && sessionId && (
            <button
              type="button"
              onClick={() => setSendEmailDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-95"
              title={sentAt ? "Resend document via email" : "Send document via email"}
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">{sentAt ? "Resend" : "Send"}</span>
            </button>
          )}
          {/* Download Signed PDF button — client-side generation */}
          {supportsSignatures && sessionId && allSigned && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const cleanedData = cleanDataForExport(data)
                  const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
                  const templates = await import("@/lib/pdf-templates")
                  const docType = (cleanedData.documentType || "").toLowerCase()
                  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
                  switch (docType) {
                    case "contract": PdfComponent = templates.ContractPDF; break
                    case "quotation": PdfComponent = templates.QuotationPDF; break
                    case "proposal": PdfComponent = templates.ProposalPDF; break
                    default: PdfComponent = templates.InvoicePDF; break
                  }
                  const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
                  const ref = cleanedData.referenceNumber || cleanedData.invoiceNumber || "signed"
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a"); a.href = url
                  a.download = `${ref}_signed_${new Date().toISOString().slice(0, 10)}.pdf`
                  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                  toast.success("Signed PDF downloaded!")
                } catch { toast.error("Failed to generate PDF") }
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-95"
              title="Download signed PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Signed PDF</span>
            </button>
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
          {/* Mark as Paid — shown for invoices when no gateway payment link exists or it's not gateway-paid */}
          {sessionId && (data.documentType || "invoice").toLowerCase() === "invoice" && !manualPaid && (
            <MarkAsPaidButton
              sessionId={sessionId}
              isPaid={false}
              onStatusChange={(paid) => {
                if (paid) {
                  setManualPaid(true)
                  setManualPaidAt(new Date().toISOString())
                }
              }}
            />
          )}
          {sessionId && (data.documentType || "invoice").toLowerCase() === "invoice" && manualPaid && (
            <MarkAsPaidButton
              sessionId={sessionId}
              isPaid
              paidAt={manualPaidAt}
              paymentMethod={manualPaymentMethod}
              onStatusChange={(paid) => {
                if (!paid) {
                  setManualPaid(false)
                  setManualPaidAt(null)
                  setManualPaymentMethod(null)
                }
              }}
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

          {/* Export dropdown — PDF, DOCX, PNG, JPG */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-md shadow-sm transition-all duration-200 active:scale-95"
                title="Export document"
              >
                {(exportingDocx || exportingImage) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-2xl p-1.5 shadow-xl border border-border/60">
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
                Export As
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const { cleanDataForExport } = await import("@/lib/invoice-types")
                    const { resolveLogoUrl } = await import("@/lib/resolve-logo-url")
                    const { pdf } = await import("@react-pdf/renderer")
                    const templates = await import("@/lib/pdf-templates")
                    const cleanedData = cleanDataForExport(data)
                    const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
                    const docType = (cleanedData.documentType || "").toLowerCase()
                    let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
                    switch (docType) {
                      case "contract": PdfComponent = templates.ContractPDF; break
                      case "quotation": PdfComponent = templates.QuotationPDF; break
                      case "proposal": PdfComponent = templates.ProposalPDF; break
                      default: PdfComponent = templates.InvoicePDF; break
                    }
                    const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
                    const ref = cleanedData.invoiceNumber || cleanedData.referenceNumber || docType
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a"); a.href = url
                    a.download = `${ref}_${new Date().toISOString().slice(0, 10)}.pdf`
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
                    toast.success("PDF downloaded!")
                  } catch { toast.error("Failed to generate PDF") }
                }}
                className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
              >
                <FileText className="w-4 h-4 text-red-500" />
                <span>PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportDocx}
                disabled={exportingDocx}
                className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
              >
                {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 text-blue-500" />}
                <span>Word (.docx)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-border/50" />
              <DropdownMenuItem
                onClick={() => handleExportImage("png")}
                disabled={exportingImage}
                className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
              >
                {exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-emerald-500" />}
                <span>PNG Image</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportImage("jpg")}
                disabled={exportingImage}
                className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
              >
                {exportingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-amber-500" />}
                <span>JPG Image</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Self-sign panel — slides in below toolbar */}
      {selfSignOpen && supportsSignatures && sessionId && !senderSigned && (
        <div className="border-b border-border bg-card px-4 py-4 animate-in slide-in-from-top-2 duration-200">
          <div className="max-w-md">
            <p className="text-sm font-semibold text-foreground mb-1">Sign as Sender (Party A)</p>
            <p className="text-xs text-muted-foreground mb-3">
              {savedSignatureUrl === undefined
                ? "Loading your saved signature..."
                : savedSignatureUrl
                ? "Your saved signature is shown below. Click Confirm to apply it, or draw a new one."
                : "Draw your signature below. Save it to your profile to reuse it next time."}
            </p>
            {savedSignatureUrl === undefined ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : savedSignatureUrl ? (
              <div className="space-y-3">
                <div className="inline-block border border-border rounded-xl p-3 bg-white">
                  <img src={savedSignatureUrl} alt="Your signature" className="max-w-[200px] max-h-[70px] object-contain" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelfSign(savedSignatureUrl)}
                    disabled={selfSignLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {selfSignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                    Apply My Signature
                  </button>
                  <button
                    type="button"
                    onClick={() => setSavedSignatureUrl(null)}
                    className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Draw New
                  </button>
                </div>
              </div>
            ) : (
              <SignaturePad
                onSignature={handleSelfSign}
                className="max-w-md"
              />
            )}
          </div>
        </div>
      )}

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
          onEmailSent={() => setSentAt(new Date().toISOString())}
        />
      )}
      {supportsSignatures && sessionId && (
        <GetSignatureModal
          sessionId={sessionId}
          documentType={data.documentType || ""}
          defaultEmail={data.toEmail || ""}
          defaultName={data.toName || ""}
          open={getSignatureModalOpen}
          onOpenChange={(open) => {
            // Guard: prevent opening when a pending signature exists
            if (open && toolbarState === "pending") return
            setGetSignatureModalOpen(open)
          }}
        />
      )}
      {supportsSignatures && sessionId && pendingSignature && (
        <SignatureCancelDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          signerName={pendingSignature.signer_name || "the signer"}
          onConfirm={async () => {
            setCancelLoading(true)
            try {
              const res = await fetch("/api/signatures/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signatureId: pendingSignature.id }),
              })
              if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || "Failed to cancel signature request")
              }
              toast.success("Signature request cancelled")
              setCancelDialogOpen(false)
              // Refetch signatures
              const refetchRes = await fetch(`/api/signatures?sessionId=${sessionId}`)
              if (refetchRes.ok) {
                const json = await refetchRes.json()
                if (json?.signatures) setSignatures(json.signatures)
              }
            } catch (err: any) {
              toast.error(err.message || "Failed to cancel signature request")
            } finally {
              setCancelLoading(false)
            }
          }}
          loading={cancelLoading}
        />
      )}
    </div>
  )
}
