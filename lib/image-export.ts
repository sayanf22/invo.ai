/**
 * Image Export Utility
 * Renders the document PDF to a PNG/JPG image using pdfjs-dist (already bundled via react-pdf).
 * Works entirely client-side.
 */

import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

/**
 * Generate a PNG image of the first page of the document.
 * Uses @react-pdf/renderer to generate the PDF blob, then pdfjs-dist to render to canvas.
 */
export async function generateDocumentImage(
  data: InvoiceData,
  format: "png" | "jpg" = "png",
  scale = 2 // retina quality
): Promise<Blob> {
  const cleanedData = cleanDataForExport(data)
  const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)

  // Step 1: Generate PDF blob using @react-pdf/renderer
  const { pdf } = await import("@react-pdf/renderer")
  const templates = await import("@/lib/pdf-templates")

  const docType = (cleanedData.documentType || "").toLowerCase()
  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>

  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    case "receipt": PdfComponent = templates.ReceiptPDF; break
    default:
      PdfComponent = (cleanedData.design?.layout === "receipt" || cleanedData.design?.templateId === "receipt")
        ? templates.ReceiptPDF
        : templates.InvoicePDF
      break
  }

  const pdfBlob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
  const pdfArrayBuffer = await pdfBlob.arrayBuffer()

  // Step 2: Load PDF with pdfjs-dist and render first page to canvas
  const pdfjsLib = await import("pdfjs-dist")

  // Set worker — use the bundled worker from react-pdf's assets
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfArrayBuffer) })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(1)

  const viewport = page.getViewport({ scale })

  const canvas = document.createElement("canvas")
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get canvas context")

  // White background for JPG
  if (format === "jpg") {
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  await page.render({ canvasContext: ctx, viewport }).promise

  // Step 3: Export canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Canvas export failed")),
      format === "jpg" ? "image/jpeg" : "image/png",
      format === "jpg" ? 0.92 : undefined
    )
  })
}
