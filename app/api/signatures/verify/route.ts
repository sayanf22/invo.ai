/**
 * Public signature verification endpoint.
 * GET /api/signatures/verify?id=<signature_id>
 *
 * No authentication required — this is a public verification page.
 * Returns sanitized signature details for display on the verify page.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase service role credentials")
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing signature ID" }, { status: 400 })
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid signature ID format" }, { status: 400 })
    }

    const supabase = getServiceRoleClient()

    // Fetch signature
    const { data: sig, error: sigError } = await supabase
      .from("signatures")
      .select("id, signer_name, signer_email, signed_at, document_hash, ip_address, user_agent, verification_url, session_id, document_id")
      .eq("id", id)
      .single()

    if (sigError || !sig) {
      return NextResponse.json({ error: "Signature not found" }, { status: 404 })
    }

    // Fetch session for document details
    let documentType = "Document"
    let referenceNumber = ""
    let businessName = "Clorefy"

    if ((sig as any).session_id) {
      const { data: session } = await supabase
        .from("document_sessions")
        .select("document_type, context, user_id")
        .eq("id", (sig as any).session_id)
        .single()

      if (session) {
        documentType = session.document_type
          ? session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
          : "Document"

        const ctx = (session.context ?? {}) as Record<string, unknown>
        referenceNumber = session.document_type === "invoice"
          ? ((ctx.invoiceNumber as string) || (ctx.referenceNumber as string) || "")
          : ((ctx.referenceNumber as string) || (ctx.invoiceNumber as string) || "")

        // Fetch business name
        if (session.user_id) {
          const { data: biz } = await supabase
            .from("businesses")
            .select("name")
            .eq("user_id", session.user_id)
            .single()
          if (biz?.name) businessName = biz.name
        }
      }
    }

    return NextResponse.json({
      valid: true,
      signature: {
        id: sig.id,
        signer_name: sig.signer_name,
        signer_email: sig.signer_email,
        signed_at: sig.signed_at,
        document_hash: sig.document_hash,
        ip_address: sig.ip_address,
        user_agent: sig.user_agent,
        verification_url: sig.verification_url,
      },
      document: {
        type: documentType,
        reference: referenceNumber,
        business_name: businessName,
      },
    })
  } catch (error) {
    console.error("[verify] error:", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
