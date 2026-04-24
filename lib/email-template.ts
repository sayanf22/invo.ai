export interface EmailTemplateData {
  businessName: string
  businessLogoUrl?: string | null
  documentType: "invoice" | "contract" | "quotation" | "proposal"
  referenceNumber: string
  recipientName: string
  totalAmount?: string | null
  currency?: string | null
  dueDate?: string | null
  description?: string | null
  personalMessage?: string | null
  viewDocumentUrl: string
  payNowUrl?: string | null
}

/**
 * Generate the email subject line based on document type.
 *
 * Invoice:   "Invoice {referenceNumber} from {businessName}"
 * Contract:  "Contract {referenceNumber} from {businessName}"
 * Quotation: "Quotation {referenceNumber} from {businessName}"
 * Proposal:  "Proposal {referenceNumber} from {businessName}"
 */
export function generateEmailSubject(
  documentType: string,
  referenceNumber: string,
  businessName: string
): string {
  const label =
    documentType === "invoice"
      ? "Invoice"
      : documentType === "contract"
        ? "Contract"
        : documentType === "quotation"
          ? "Quotation"
          : "Proposal"
  return `${label} ${referenceNumber} from ${businessName}`
}

/**
 * Renders a branded HTML email string using inline CSS + table layout.
 * Compatible with Gmail, Outlook, and Apple Mail.
 * No <style> blocks, no <link> tags — all styles are inline.
 * Max 600px content width. Total size kept under 102KB.
 */
export function renderEmailTemplate(data: EmailTemplateData): string {
  const {
    businessName,
    businessLogoUrl,
    documentType,
    referenceNumber,
    recipientName,
    totalAmount,
    currency,
    dueDate,
    description,
    personalMessage,
    viewDocumentUrl,
    payNowUrl,
  } = data

  const docLabel =
    documentType === "invoice"
      ? "Invoice"
      : documentType === "contract"
        ? "Contract"
        : documentType === "quotation"
          ? "Quotation"
          : "Proposal"

  const showAmount =
    (documentType === "invoice" || documentType === "quotation") &&
    totalAmount != null &&
    totalAmount !== ""

  const showDescription =
    (documentType === "contract" || documentType === "proposal") &&
    description != null &&
    description !== ""

  const showPersonalMessage =
    personalMessage != null && personalMessage !== ""

  const showPayNow = payNowUrl != null && payNowUrl !== ""

  // ── Logo / header ──────────────────────────────────────────────────────────
  const logoHtml = businessLogoUrl
    ? `<img src="${escapeAttr(businessLogoUrl)}" alt="${escapeAttr(businessName)} logo" width="40" height="40" style="display:block;border-radius:6px;margin-right:12px;" />`
    : ""

  // ── Amount / due date row (invoice & quotation) ────────────────────────────
  const amountRowHtml = showAmount
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#f0f4ff;border-radius:8px;">
        <tr>
          <td style="padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Amount</td>
                ${dueDate ? `<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Due Date</td>` : ""}
              </tr>
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#1a1a2e;padding-top:4px;">${escapeHtml(totalAmount ?? "")}${currency ? ` ${escapeHtml(currency)}` : ""}</td>
                ${dueDate ? `<td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#1a1a2e;padding-top:4px;">${escapeHtml(dueDate)}</td>` : ""}
              </tr>
            </table>
          </td>
        </tr>
      </table>`
    : ""

  // ── Description row (contract & proposal) ─────────────────────────────────
  const descriptionRowHtml = showDescription
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;background-color:#f8f9fa;border-radius:8px;">
        <tr>
          <td style="padding:16px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#444444;line-height:1.6;">
            ${escapeHtml(description ?? "")}
          </td>
        </tr>
      </table>`
    : ""

  // ── Personal message ───────────────────────────────────────────────────────
  const personalMessageHtml = showPersonalMessage
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
        <tr>
          <td style="padding:16px 20px;background-color:#f8f9fa;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;line-height:1.7;">
            ${escapeHtml(personalMessage ?? "").replace(/\n/g, "<br/>")}
          </td>
        </tr>
      </table>`
    : ""

  // ── CTA buttons ────────────────────────────────────────────────────────────
  const payNowButtonHtml = showPayNow
    ? `<td style="padding-left:12px;">
        <a href="${escapeAttr(payNowUrl ?? "")}" target="_blank" style="display:inline-block;padding:12px 28px;background-color:#16a34a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">Pay Now</a>
      </td>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(docLabel)} ${escapeHtml(referenceNumber)} from ${escapeHtml(businessName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- Outer wrapper: max 600px -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background-color:#1a1a2e;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="vertical-align:middle;">${logoHtml}</td>
                      <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">${escapeHtml(businessName)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr>
          <td style="padding:32px 32px 24px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:#333333;">Hi ${escapeHtml(recipientName)},</p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#555555;">You have received a ${escapeHtml(docLabel.toLowerCase())} from <strong>${escapeHtml(businessName)}</strong>.</p>

            <!-- Document type + reference -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#888888;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(docLabel)}</p>
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#1a1a2e;">${escapeHtml(referenceNumber)}</p>
                </td>
              </tr>
            </table>

            ${amountRowHtml}
            ${descriptionRowHtml}
            ${personalMessageHtml}

            <!-- CTA buttons -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
              <tr>
                <td>
                  <a href="${escapeAttr(viewDocumentUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;background-color:#4f46e5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">View Document</a>
                </td>
                ${payNowButtonHtml}
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background-color:#f8f9fa;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;text-align:center;">
              Sent via <a href="https://clorefy.com" target="_blank" style="color:#4f46e5;text-decoration:none;">Clorefy</a>
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#bbbbbb;text-align:center;">
              You received this because ${escapeHtml(businessName)} sent you a document.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Outer wrapper -->

    </td>
  </tr>
</table>
</body>
</html>`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
