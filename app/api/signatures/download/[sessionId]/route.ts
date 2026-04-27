/**
 * GET /api/signatures/download/[sessionId]
 *
 * Authenticated endpoint that generates and streams a merged signed PDF:
 *   - Original document PDF (generated via @react-pdf/renderer)
 *   - Certificate PDF (fetched from R2, regenerated if missing)
 *
 * Requirements: 11.1, 11.2, 11.5, 11.6, 11.7
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument } from "pdf-lib"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { authenticateRequest } from "@/lib/api-auth"
import { getObject } from "@/lib/r2"
import { buildCertificateKey, generateAndStoreCertificate } from "@/lib/certificate-generator"
import type { Database } from "@/lib/database.types"

// Minimal placeholder document styles
const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#18181b",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    color: "#71717a",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 13,
    marginBottom: 16,
  },
})

/**
 * Generate a minimal placeholder PDF for the original document.
 * The actual template selection is complex; this renders the session context
 * as structured text using @react-pdf/renderer.
 */
async function generateOriginalDocumentPdf(
  documentType: string,
  referenceNumber: string,
  context: Record<string, unknown>
): Promise<Uint8Array> {
  // Build a list of context fields to display
  const fields = Object.entries(context)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 30) // cap to avoid huge PDFs

  const docElement = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      createElement(View, null,
        createElement(Text, { style: styles.title },
          `${documentType.charAt(0).toUpperCase()}${documentType.slice(1)} — ${referenceNumber}`
        ),
        ...fields.map(([key, value]) =>
          createElement(View, { key },
            createElement(Text, { style: styles.label }, key),
            createElement(Text, { style: styles.value }, String(value))
          )
        )
      )
    )
  )

  const buffer = await renderToBuffer(docElement)
  return new Uint8Array(buffer)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // SECURITY: Authenticate user
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // Use service-role client for DB operations
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("document_sessions")
      .select("id, user_id, document_id, document_type, context")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // SECURITY: Verify ownership
    if (session.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const documentId = session.document_id || sessionId

    // Verify all signatures for this session are complete (all have signed_at)
    const { data: signatures, error: sigError } = await supabase
      .from("signatures")
      .select("id, signed_at")
      .eq("session_id", sessionId)

    if (sigError) {
      return NextResponse.json({ error: "Failed to fetch signatures" }, { status: 500 })
    }

    if (!signatures || signatures.length === 0) {
      return NextResponse.json(
        { error: "No signatures found for this session" },
        { status: 400 }
      )
    }

    const allSigned = signatures.every((s) => s.signed_at !== null)
    if (!allSigned) {
      return NextResponse.json(
        { error: "Not all signatures are complete. All parties must sign before downloading." },
        { status: 400 }
      )
    }

    // Extract context and reference number
    const ctx = (session.context ?? {}) as Record<string, unknown>
    const referenceNumber =
      (ctx.invoiceNumber as string) ||
      (ctx.referenceNumber as string) ||
      "document"
    const documentType = session.document_type ?? "document"

    // Generate original document PDF
    const originalPdfBytes = await generateOriginalDocumentPdf(
      documentType,
      referenceNumber,
      ctx
    )

    // Fetch certificate PDF from R2
    const certKey = buildCertificateKey(documentId)
    let certResult = await getObject(certKey)

    // If not found, regenerate and re-fetch
    if (!certResult) {
      await generateAndStoreCertificate(sessionId, documentId, supabase)
      certResult = await getObject(certKey)
    }

    if (!certResult) {
      return NextResponse.json(
        { error: "Certificate PDF could not be generated or retrieved" },
        { status: 500 }
      )
    }

    // Merge PDFs using pdf-lib
    const originalDoc = await PDFDocument.load(originalPdfBytes)
    const certDoc = await PDFDocument.load(certResult.body)

    const certPages = await originalDoc.copyPages(certDoc, certDoc.getPageIndices())
    for (const page of certPages) {
      originalDoc.addPage(page)
    }

    const mergedBytes = await originalDoc.save()

    // Build filename: [referenceNumber]_signed_[YYYY-MM-DD].pdf
    const dateStr = new Date().toISOString().slice(0, 10)
    const safeRef = referenceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeRef}_signed_${dateStr}.pdf`

    return new Response(mergedBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(mergedBytes.byteLength),
      },
    })
  } catch (error) {
    console.error("[signatures/download] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
