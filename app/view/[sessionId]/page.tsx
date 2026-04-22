"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import {
  ArrowLeft, Download, Share2, Loader2, FileText,
  Copy, Check, MessageCircle, Mail, Link2, QrCode,
  ZoomIn, ZoomOut, Maximize2,
} from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentInfo {
  short_url: string
  status: string
  amount: number
  currency: string
  amount_paid: number | null
}

// ── QR Code (inline, no external service) ────────────────────────────────────

async function generateQRDataUrl(url: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode")
    return await QRCode.default.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
  } catch { return null }
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function buildPdfBlob(data: InvoiceData, paymentQrCode?: string | null): Promise<Blob> {
  const cleaned = cleanDataForExport(data)
  const logoUrl = await resolveLogoUrl(cleaned.fromLogo)
  const templates = await import("@/lib/pdf-templates")
  const docType = (cleaned.documentType || "").toLowerCase()

  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }>
  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    case "receipt": PdfComponent = templates.ReceiptPDF; break
    default: PdfComponent = (cleaned.design?.layout === "receipt" || cleaned.design?.templateId === "receipt")
      ? templates.ReceiptPDF : templates.InvoicePDF; break
  }

  return pdf(<PdfComponent data={cleaned} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />).toBlob()
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────

const PDF_OPTIONS = { standardFontDataUrl: "/standard_fonts/", cMapUrl: "/cmaps/", cMapPacked: true } as const

function PdfViewer({ pdfBytes, zoom }: { pdfBytes: Uint8Array; zoom: number }) {
  const [ViewerComponents, setViewerComponents] = useState<{ Document: any; Page: any } | null>(null)
  const [numPages, setNumPages] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const optionsRef = useRef(PDF_OPTIONS)

  useEffect(() => {
    let cancelled = false
    import("react-pdf").then(m => {
      m.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      if (!cancelled) setViewerComponents({ Document: m.Document, Page: m.Page })
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width)
    })
    obs.observe(el)
    setContainerWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  const fileData = useMemo(() => ({ data: pdfBytes.slice() }), [pdfBytes])
  const baseWidth = containerWidth > 0 ? Math.min(containerWidth - 32, 800) : 600
  const pageWidth = Math.round(baseWidth * (zoom / 100))

  if (!ViewerComponents) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full">
      <ViewerComponents.Document
        file={fileData}
        onLoadSuccess={({ numPages: n }: { numPages: number }) => setNumPages(n)}
        options={optionsRef.current}
        loading={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
      >
        <div className="flex flex-col items-center gap-4 py-4">
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i} className="shadow-xl rounded-lg overflow-hidden bg-white">
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

// ── Share Sheet ───────────────────────────────────────────────────────────────

function ShareSheet({
  data,
  payment,
  onClose,
}: {
  data: InvoiceData
  payment: PaymentInfo | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    if (payment?.short_url) {
      generateQRDataUrl(payment.short_url).then(setQrDataUrl)
    }
  }, [payment?.short_url])

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success("Copied!")
    setTimeout(() => setCopied(null), 2000)
  }

  const shareWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
  }

  const sharePdf = async () => {
    setGeneratingPdf(true)
    try {
      let qr: string | null = null
      if (payment?.short_url) qr = await generateQRDataUrl(payment.short_url)
      const blob = await buildPdfBlob(data, qr)
      const file = new File([blob], `${data.invoiceNumber || "document"}.pdf`, { type: "application/pdf" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: data.invoiceNumber || "Document", files: [file] })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
        toast.success("PDF downloaded")
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Failed to share PDF")
    } finally {
      setGeneratingPdf(false)
    }
  }

  const docType = (data.documentType || "Invoice").charAt(0).toUpperCase() + (data.documentType || "invoice").slice(1)
  const invoiceRef = data.invoiceNumber || data.referenceNumber || docType
  const total = data.items?.reduce((s, i) => s + i.quantity * i.rate, 0) ?? 0
  const currency = data.currency || "INR"

  const paymentMsg = payment?.short_url
    ? `Hi ${data.toName || ""},\n\nPlease find your ${docType} ${invoiceRef} for ${currency} ${total.toFixed(2)}.\n\nPay here: ${payment.short_url}\n\nThank you,\n${data.fromName || ""}`
    : `Hi ${data.toName || ""},\n\nPlease find your ${docType} ${invoiceRef} for ${currency} ${total.toFixed(2)}.\n\nThank you,\n${data.fromName || ""}`

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-6 pt-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Share {docType}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground">
              ✕
            </button>
          </div>

          {/* Payment link section */}
          {payment?.short_url && payment.status !== "paid" && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Link</p>

              {/* URL + copy */}
              <div className="flex items-center gap-2 bg-background rounded-xl border border-border px-3 py-2">
                <Link2 size={13} className="text-muted-foreground shrink-0" />
                <span className="flex-1 text-xs font-mono truncate text-foreground/80">{payment.short_url}</span>
                <button onClick={() => copy(payment.short_url, "link")}
                  className="shrink-0 p-1 rounded-lg hover:bg-muted transition-colors">
                  {copied === "link" ? <Check size={13} className="text-primary" /> : <Copy size={13} className="text-muted-foreground" />}
                </button>
              </div>

              {/* QR code */}
              {qrDataUrl && (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-white shrink-0">
                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Scan to pay</p>
                    <button
                      onClick={() => shareWhatsApp(paymentMsg)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C7E] dark:text-[#25D366] text-xs font-medium hover:bg-[#25D366]/20 transition-colors"
                    >
                      <MessageCircle size={13} />
                      Send via WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Share options */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={sharePdf}
              disabled={generatingPdf}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {generatingPdf ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} className="text-muted-foreground" />}
              Share PDF
            </button>

            <button
              onClick={() => copy(paymentMsg, "msg")}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium"
            >
              {copied === "msg" ? <Check size={16} className="text-primary" /> : <Copy size={16} className="text-muted-foreground" />}
              Copy Message
            </button>

            <button
              onClick={() => {
                const subject = encodeURIComponent(`${docType} ${invoiceRef} from ${data.fromName || ""}`)
                const body = encodeURIComponent(paymentMsg)
                window.location.href = `mailto:${data.toEmail || ""}?subject=${subject}&body=${body}`
              }}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl border border-border bg-card hover:bg-muted/50 transition-colors text-sm font-medium"
            >
              <Mail size={16} className="text-muted-foreground" />
              Email
            </button>

            {payment?.short_url && (
              <button
                onClick={() => shareWhatsApp(paymentMsg)}
                className="flex items-center gap-2 px-3 py-3 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C7E] dark:text-[#25D366] hover:bg-[#25D366]/20 transition-colors text-sm font-medium"
              >
                <MessageCircle size={16} />
                WhatsApp
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [50, 75, 100, 125, 150]

export default function ViewDocumentPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()

  const [docData, setDocData] = useState<InvoiceData | null>(null)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [rendering, setRendering] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [showShare, setShowShare] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Load session data
  useEffect(() => {
    if (!user || !sessionId) return
    const load = async () => {
      setLoading(true)
      try {
        const { data: session } = await supabase
          .from("document_sessions")
          .select("context, document_type")
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .single()

        if (!session?.context) { router.push("/documents"); return }
        setDocData(session.context as unknown as InvoiceData)

        // Load payment info
        const { data: pay } = await (supabase as any)
          .from("invoice_payments")
          .select("short_url, status, amount, currency, amount_paid")
          .eq("session_id", sessionId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (pay) setPayment(pay as PaymentInfo)
      } catch (err) {
        console.error(err)
        toast.error("Failed to load document")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, sessionId, supabase, router])

  // Render PDF bytes whenever docData changes
  useEffect(() => {
    if (!docData) return
    let cancelled = false
    const render = async () => {
      setRendering(true)
      try {
        let qr: string | null = null
        if (payment?.short_url && payment.status !== "paid" && payment.status !== "expired" && payment.status !== "cancelled") {
          qr = await generateQRDataUrl(payment.short_url)
        }
        const blob = await buildPdfBlob(
          payment?.status === "paid" ? { ...docData, status: "paid" } : docData,
          qr
        )
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
  }, [docData, payment])

  const handleDownload = async () => {
    if (!docData) return
    setDownloading(true)
    try {
      let qr: string | null = null
      if (payment?.short_url) qr = await generateQRDataUrl(payment.short_url)
      const blob = await buildPdfBlob(
        payment?.status === "paid" ? { ...docData, status: "paid" } : docData,
        qr
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${docData.invoiceNumber || docData.referenceNumber || "document"}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded!")
    } catch { toast.error("Failed to download") }
    finally { setDownloading(false) }
  }

  const docType = docData
    ? (docData.documentType || "document").charAt(0).toUpperCase() + (docData.documentType || "document").slice(1)
    : "Document"

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!docData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <FileText className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Document not found</p>
        <button onClick={() => router.push("/documents")} className="text-primary text-sm hover:underline">
          Back to Documents
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {docData.invoiceNumber || docData.referenceNumber || docType}
            </p>
            {docData.toName && (
              <p className="text-xs text-muted-foreground truncate">{docData.toName}</p>
            )}
          </div>

          {/* Zoom — desktop only */}
          <div className="hidden sm:flex items-center gap-1 bg-secondary/60 border border-border rounded-xl px-2 py-1">
            <button
              onClick={() => setZoom(z => Math.max(ZOOM_LEVELS[0], ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) - 1] ?? z))}
              disabled={zoom <= ZOOM_LEVELS[0]}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold min-w-[36px] text-center tabular-nums">{zoom}%</span>
            <button
              onClick={() => setZoom(z => Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], ZOOM_LEVELS[ZOOM_LEVELS.indexOf(z) + 1] ?? z))}
              disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
              title="Reset zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading || rendering}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment status banner */}
      {payment && (
        <div className={cn(
          "border-b px-4 py-2 text-center text-xs font-medium",
          payment.status === "paid"
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400"
            : payment.status === "created"
            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400"
            : "bg-muted border-border text-muted-foreground"
        )}>
          {payment.status === "paid" && `✓ Paid — ${payment.currency} ${((payment.amount_paid ?? payment.amount) / 100).toFixed(2)}`}
          {payment.status === "created" && `Payment pending — ${payment.currency} ${(payment.amount / 100).toFixed(2)}`}
          {payment.status === "partially_paid" && `Partially paid — ${payment.currency} ${((payment.amount_paid ?? 0) / 100).toFixed(2)} of ${(payment.amount / 100).toFixed(2)}`}
          {payment.status === "expired" && "Payment link expired"}
          {payment.status === "cancelled" && "Payment link cancelled"}
        </div>
      )}

      {/* PDF viewer */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4">
          {rendering && !pdfBytes && (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2.5 bg-card px-5 py-3 rounded-2xl shadow border border-border/60">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Generating preview...</span>
              </div>
            </div>
          )}
          {pdfBytes && (
            <div className={cn("transition-opacity duration-300", rendering ? "opacity-60" : "opacity-100")}>
              <PdfViewer pdfBytes={pdfBytes} zoom={zoom} />
            </div>
          )}
        </div>
      </div>

      {/* Share sheet */}
      {showShare && (
        <ShareSheet data={docData} payment={payment} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
