"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { FileText, Edit3, Loader2, ZoomIn, ZoomOut, Maximize2, RotateCcw, Printer } from "lucide-react"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
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

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200]
const DEFAULT_ZOOM = 100

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
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    setContainerWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const generatePdf = useCallback(async (docData: InvoiceData) => {
    setIsRendering(true)
    setError(null)
    try {
      const templates = await import("@/lib/pdf-templates")
      const docType = (docData.documentType || "").toLowerCase()

      let PdfComponent: React.ComponentType<{ data: InvoiceData }>
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
        default:
          PdfComponent = templates.InvoicePDF
          break
      }

      const instance = pdf(<PdfComponent data={docData} />)
      const blob = await instance.toBlob()

      if (!mountedRef.current) return

      const arrayBuffer = await blob.arrayBuffer()
      setPdfBytes(new Uint8Array(arrayBuffer))
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <FileText className="w-8 h-8" />
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  // A4 aspect ratio: 595pt wide. Base width is container - padding, scaled by zoom.
  const baseWidth = containerWidth > 0 ? Math.min(containerWidth - 48, 800) : 600
  const pageWidth = Math.round(baseWidth * (zoom / 100))

  const pdfOptions = useMemo(() => ({
    standardFontDataUrl: "/standard_fonts/",
    cMapUrl: "/cmaps/",
    cMapPacked: true,
  }), [])

  const fileData = useMemo(() => {
    if (!pdfBytes) return null
    return { data: pdfBytes }
  }, [pdfBytes])

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-auto">
      {isRendering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2.5 bg-card px-5 py-3 rounded-2xl shadow-lg border border-border/60">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Rendering preview...</span>
          </div>
        </div>
      )}

      {fileData && viewerReady && ViewerComponents ? (
        <div className="flex flex-col items-center gap-6 py-6">
          <ViewerComponents.Document
            file={fileData}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={pdfOptions}
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
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
        disabled && "opacity-40 pointer-events-none"
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
export function DocumentPreview({ data, onChange, onToggleEditor, showEditor }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [pageCount, setPageCount] = useState(0)
  const hasContent = data.documentType || data.fromName || data.toName || data.description

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
      const templates = await import("@/lib/pdf-templates")
      const docType = (cleanedData.documentType || "").toLowerCase()

      let PdfComponent: React.ComponentType<{ data: InvoiceData }>
      switch (docType) {
        case "contract": PdfComponent = templates.ContractPDF; break
        case "quotation": PdfComponent = templates.QuotationPDF; break
        case "proposal": PdfComponent = templates.ProposalPDF; break
        default: PdfComponent = templates.InvoicePDF; break
      }

      const blob = await pdf(<PdfComponent data={cleanedData} />).toBlob()
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
      <div className="relative z-30 flex items-center justify-between px-4 py-2.5 border-b bg-card/80 backdrop-blur-sm shadow-sm shrink-0 gap-2">
        {/* Left: Design + Editor toggle */}
        <div className="flex items-center gap-2">
          {onChange && <TemplatePicker data={data} onChange={onChange} />}
          {onToggleEditor && (
            <button
              type="button"
              onClick={onToggleEditor}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-200 active:scale-95",
                showEditor
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-foreground hover:border-primary/40 hover:shadow-sm"
              )}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">{showEditor ? "Hide Editor" : "Editor"}</span>
            </button>
          )}
        </div>

        {/* Center: Zoom controls + page info */}
        <div className="flex items-center gap-1 bg-secondary/40 rounded-xl px-2 py-1">
          <ToolbarBtn onClick={handleZoomOut} disabled={!canZoomOut} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </ToolbarBtn>
          <span className="text-xs font-medium text-foreground min-w-[40px] text-center tabular-nums select-none">
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

        {/* Right: Print + Download */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            title="Print document"
            aria-label="Print document"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm transition-all duration-200 active:scale-95"
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
    </div>
  )
}
