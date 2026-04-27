/**
 * Certificate of Completion API
 * GET /api/signatures/certificate?sessionId=xxx
 *
 * Generates a downloadable Certificate of Completion PDF for a signed document.
 * This is the legal evidence package — equivalent to DocuSign's Certificate of Completion.
 *
 * Contains:
 * - Document details (type, reference, business)
 * - Full audit trail (sent → viewed → signed → completed)
 * - Signer details (name, email, IP, device, timestamp)
 * - Document hash (tamper evidence)
 * - Signature image
 *
 * Requires authentication — only the document owner can download.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatUTC(iso: string): string {
  return new Date(iso).toUTCString()
}

function deviceFromUA(ua: string | null): string {
  if (!ua) return "Unknown device"
  const device = ua.includes("Mobile") ? "Mobile" : "Desktop"
  const browser = ua.includes("Chrome") ? "Chrome"
    : ua.includes("Firefox") ? "Firefox"
    : ua.includes("Safari") ? "Safari"
    : ua.includes("Edge") ? "Edge"
    : "Browser"
  const os = ua.includes("Android") ? "Android"
    : ua.includes("iPhone") || ua.includes("iPad") ? "iOS"
    : ua.includes("Windows") ? "Windows"
    : ua.includes("Mac") ? "macOS"
    : ua.includes("Linux") ? "Linux"
    : "Unknown OS"
  return `${device} · ${browser} · ${os}`
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    "signature.request_created": "Signing request sent",
    "signature.viewed": "Document viewed by signer",
    "signature.signed": "Document signed",
    "signature.completed": "All parties signed — completed",
    "signature.expired": "Signing link expired",
    "signature.cancelled": "Signing request cancelled",
  }
  return labels[action] || action
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 })
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    const supabase = getServiceRoleClient()

    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("document_sessions")
      .select("id, document_type, context, user_id, status")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch all signatures for this session
    const { data: signatures } = await supabase
      .from("signatures")
      .select("id, signer_name, signer_email, party, signed_at, ip_address, user_agent, document_hash, signature_image_url, verification_url")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    // Fetch audit trail
    const { data: auditEvents } = await supabase
      .from("signature_audit_events")
      .select("action, ip_address, user_agent, actor_email, created_at, metadata")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    // Fetch business info
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("user_id", auth.user.id)
      .single()

    const ctx = (session.context ?? {}) as Record<string, unknown>
    const docType = session.document_type || "document"
    const docTypeLabel = docType.charAt(0).toUpperCase() + docType.slice(1)
    const refNumber = docType === "invoice"
      ? ((ctx.invoiceNumber as string) || (ctx.referenceNumber as string) || "")
      : ((ctx.referenceNumber as string) || (ctx.invoiceNumber as string) || "")
    const businessName = business?.name || "Unknown Business"

    // Load signature images
    const sigImages: Record<string, string> = {}
    for (const sig of (signatures || [])) {
      const imgKey = sig.signature_image_url as string | null
      if (!imgKey || imgKey === "data_url_fallback" || !sig.signed_at) continue
      try {
        if (imgKey.startsWith("sb:")) {
          const storagePath = imgKey.slice(3)
          const bucket = storagePath.startsWith("signatures/") ? "signatures" : "business-assets"
          const { data: blob } = await supabase.storage.from(bucket).download(storagePath)
          if (blob) {
            const buf = await blob.arrayBuffer()
            const b64 = Buffer.from(buf).toString("base64")
            sigImages[sig.id] = `data:${blob.type || "image/jpeg"};base64,${b64}`
          }
        } else {
          const { getObject } = await import("@/lib/r2")
          const obj = await getObject(imgKey)
          if (obj) {
            const b64 = Buffer.from(obj.body).toString("base64")
            sigImages[sig.id] = `data:${obj.contentType || "image/png"};base64,${b64}`
          }
        }
      } catch { /* non-fatal */ }
    }

    // Build the Certificate of Completion HTML
    // This is rendered server-side and returned as a downloadable HTML file
    // that the browser can print/save as PDF
    const now = new Date().toUTCString()
    const completedAt = (auditEvents || []).find(e => e.action === "signature.completed")?.created_at

    const auditRows = (auditEvents || [])
      .filter(e => ["signature.request_created", "signature.viewed", "signature.signed", "signature.completed"].includes(e.action))
      .map(e => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${actionLabel(e.action)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${e.actor_email || (e as any).signer_email || "—"}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;font-family:monospace;">${e.ip_address || "—"}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${e.user_agent ? deviceFromUA(e.user_agent) : "—"}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">${formatUTC(e.created_at)}</td>
        </tr>
      `).join("")

    const signerRows = (signatures || []).map(sig => `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:16px;background:#fafafa;">
        <div style="display:flex;align-items:flex-start;gap:20px;">
          <div style="flex:1;">
            <p style="margin:0 0 4px 0;font-size:15px;font-weight:700;color:#111827;">${sig.signer_name || "Unknown"}</p>
            <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;">${sig.signer_email}</p>
            <table style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;width:120px;">Role</td>
                <td style="padding:3px 0;font-size:12px;color:#374151;">${sig.party || "Signer"}</td>
              </tr>
              <tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">Status</td>
                <td style="padding:3px 0;font-size:12px;color:${sig.signed_at ? "#059669" : "#d97706"};font-weight:600;">${sig.signed_at ? "✓ Signed" : "⏳ Pending"}</td>
              </tr>
              ${sig.signed_at ? `<tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">Signed at</td>
                <td style="padding:3px 0;font-size:12px;color:#374151;">${formatUTC(sig.signed_at)}</td>
              </tr>` : ""}
              ${sig.ip_address ? `<tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">IP Address</td>
                <td style="padding:3px 0;font-size:12px;color:#374151;font-family:monospace;">${sig.ip_address}</td>
              </tr>` : ""}
              ${sig.user_agent ? `<tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">Device</td>
                <td style="padding:3px 0;font-size:12px;color:#374151;">${deviceFromUA(sig.user_agent)}</td>
              </tr>` : ""}
              ${sig.document_hash ? `<tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">Doc Hash</td>
                <td style="padding:3px 0;font-size:11px;color:#374151;font-family:monospace;word-break:break-all;">${sig.document_hash}</td>
              </tr>` : ""}
              ${sig.verification_url ? `<tr>
                <td style="padding:3px 0;font-size:12px;color:#9ca3af;">Verify</td>
                <td style="padding:3px 0;font-size:12px;"><a href="${sig.verification_url}" style="color:#4f46e5;">${sig.verification_url}</a></td>
              </tr>` : ""}
            </table>
          </div>
          ${sigImages[sig.id] ? `
          <div style="text-align:center;min-width:140px;">
            <p style="margin:0 0 6px 0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Signature</p>
            <div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px;background:white;display:inline-block;">
              <img src="${sigImages[sig.id]}" alt="Signature" style="max-width:140px;max-height:60px;display:block;" />
            </div>
          </div>` : ""}
        </div>
      </div>
    `).join("")

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Certificate of Completion — ${docTypeLabel} ${refNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #111827; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- Print button -->
<div class="no-print" style="margin-bottom:24px;display:flex;gap:12px;">
  <button onclick="window.print()" style="padding:10px 20px;background:#111827;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
    ⬇ Download / Print PDF
  </button>
</div>

<!-- Header -->
<div style="border-bottom:2px solid #111827;padding-bottom:20px;margin-bottom:28px;">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;">
    <div>
      <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Certificate of Completion</p>
      <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:800;color:#111827;">${docTypeLabel} ${refNumber}</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">${businessName}</p>
    </div>
    <div style="text-align:right;">
      <div style="display:inline-flex;align-items:center;gap:6px;background:#dcfce7;border:1px solid #86efac;border-radius:20px;padding:6px 14px;">
        <span style="font-size:14px;">✓</span>
        <span style="font-size:13px;font-weight:700;color:#166534;">Completed</span>
      </div>
      ${completedAt ? `<p style="margin:6px 0 0 0;font-size:12px;color:#6b7280;">${formatUTC(completedAt)}</p>` : ""}
    </div>
  </div>
</div>

<!-- Document Info -->
<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:28px;">
  <p style="margin:0 0 12px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Document Information</p>
  <table style="border-collapse:collapse;width:100%;">
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;width:160px;">Document Type</td>
      <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${docTypeLabel}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">Reference Number</td>
      <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;">${refNumber || "—"}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">Sender</td>
      <td style="padding:4px 0;font-size:13px;color:#111827;">${businessName}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">Session ID</td>
      <td style="padding:4px 0;font-size:12px;color:#111827;font-family:monospace;">${sessionId}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">Certificate Generated</td>
      <td style="padding:4px 0;font-size:13px;color:#111827;">${now}</td>
    </tr>
  </table>
</div>

<!-- Signers -->
<div style="margin-bottom:28px;">
  <p style="margin:0 0 14px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Signer Details</p>
  ${signerRows || '<p style="color:#6b7280;font-size:13px;">No signers found.</p>'}
</div>

<!-- Audit Trail -->
<div style="margin-bottom:28px;">
  <p style="margin:0 0 14px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Audit Trail — Chain of Custody</p>
  <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Event</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Actor</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">IP Address</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Device</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;">Timestamp (UTC)</th>
        </tr>
      </thead>
      <tbody>
        ${auditRows || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#6b7280;font-size:13px;">No audit events found.</td></tr>'}
      </tbody>
    </table>
  </div>
</div>

<!-- Legal notice -->
<div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px;">
  <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;">Legal Notice</p>
  <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">
    This Certificate of Completion is an official record of the electronic signing process. The document hash provides tamper evidence — any modification to the original document after signing will produce a different hash. The IP addresses, timestamps, and device information recorded above constitute the audit trail for this transaction. Electronic signatures created through Clorefy are legally binding under applicable electronic signature laws (ESIGN Act, UETA, eIDAS, and equivalent legislation).
  </p>
  <p style="margin:12px 0 0 0;font-size:11px;color:#9ca3af;">Generated by Clorefy · clorefy.com · ${now}</p>
</div>

</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="certificate-${refNumber || sessionId.slice(0, 8)}.html"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[certificate] error:", error)
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 })
  }
}
