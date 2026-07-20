/**
 * Image Export Utility
 * Renders the document PDF to a PNG/JPG image using pdfjs-dist (already bundled via react-pdf).
 * Works entirely client-side. Uses React.createElement instead of JSX so this file can be .ts.
 */

import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import React from "react"

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

  // Pick the correct React component for each document type.
  // All new types (sow, change_order, nda, client_onboarding_form,
  // payment_followup) have dedicated PDF templates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let element: any

  switch (docType) {
    case "contract":
      element = React.createElement(templates.ContractPDF, { data: cleanedData, logoUrl })
      break

    case "quote":
    case "quotation":
      element = React.createElement(templates.QuotationPDF, { data: cleanedData, logoUrl })
      break

    case "proposal":
      element = React.createElement(templates.ProposalPDF, { data: cleanedData, logoUrl })
      break

    case "estimate":
      // Estimates reuse the proposal layout (ProposalPDF renders "ESTIMATE").
      element = React.createElement(templates.ProposalPDF, { data: cleanedData, logoUrl })
      break

    case "receipt":
      element = React.createElement(templates.ReceiptPDF, { data: cleanedData, logoUrl })
      break

    case "sow":
      element = React.createElement(
        templates.SOWPDF as React.ComponentType<{ data: unknown; logoUrl?: string | null }>,
        { data: cleanedData, logoUrl }
      )
      break

    case "change_order":
      element = React.createElement(
        templates.ChangeOrderPDF as React.ComponentType<{ data: unknown; logoUrl?: string | null }>,
        { data: cleanedData, logoUrl }
      )
      break

    case "nda":
      element = React.createElement(
        templates.NDAPDF as React.ComponentType<{ data: unknown; logoUrl?: string | null }>,
        { data: cleanedData, logoUrl }
      )
      break

    case "client_onboarding_form":
      element = React.createElement(
        templates.ClientOnboardingFormPDF as React.ComponentType<{ data: unknown; logoUrl?: string | null }>,
        { data: cleanedData, logoUrl }
      )
      break

    case "payment_followup":
      element = React.createElement(
        templates.PaymentFollowupPDF as React.ComponentType<{ data: unknown; logoUrl?: string | null }>,
        { data: cleanedData, logoUrl }
      )
      break

    default:
      // Fallback: invoice (also handles undefined / unknown types)
      {
        const InvoiceLike =
          cleanedData.design?.layout === "receipt" ||
          cleanedData.design?.templateId === "receipt"
            ? templates.ReceiptPDF
            : templates.InvoicePDF
        element = React.createElement(InvoiceLike, { data: cleanedData, logoUrl })
      }
      break
  }

  const pdfBlob = await pdf(element).toBlob()
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

  await page.render({ canvasContext: ctx, viewport } as any).promise

  // Step 3: Export canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Canvas export failed")),
      format === "jpg" ? "image/jpeg" : "image/png",
      format === "jpg" ? 0.92 : undefined
    )
  })
}
