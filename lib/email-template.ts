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
  // Only use logo if it's a full HTTPS URL (not an R2 key or relative path)
  const isValidLogoUrl = businessLogoUrl &&
    (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))
  const logoHtml = isValidLogoUrl
    ? `<img src="${escapeAttr(businessLogoUrl!)}" alt="" width="36" height="36" style="display:block;border-radius:6px;margin-right:14px;object-fit:cover;" />`
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
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f6f6;padding:40px 16px;">
  <tr>
    <td align="center">

      <!-- Card -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;overflow:hidden;">

        <!-- Header: business name only, clean white -->
        <tr>
          <td style="padding:28px 32px 24px 32px;border-bottom:1px solid #f0f0f0;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${isValidLogoUrl ? `<td style="vertical-align:middle;padding-right:12px;">${logoHtml}</td>` : ""}
                <td style="vertical-align:middle;">
                  <span style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#111111;">${escapeHtml(businessName)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px 0;font-size:15px;color:#111111;font-family:Arial,Helvetica,sans-serif;">Hi ${escapeHtml(recipientName)},</p>
            <p style="margin:0 0 24px 0;font-size:14px;color:#555555;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
              ${escapeHtml(businessName)} has sent you a ${escapeHtml(docLabel.toLowerCase())}.
            </p>

            <!-- Invoice summary box -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f9fb;border-radius:6px;border:1px solid #e4e4e7;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 2px 0;font-size:11px;font-weight:bold;color:#888888;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(docLabel)}</p>
                  <p style="margin:0 0 16px 0;font-size:24px;font-weight:bold;color:#111111;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(referenceNumber)}</p>
                  ${showAmount ? `
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:13px;color:#555555;font-family:Arial,Helvetica,sans-serif;padding-bottom:4px;">Amount due</td>
                      ${dueDate ? `<td align="right" style="font-size:13px;color:#555555;font-family:Arial,Helvetica,sans-serif;padding-bottom:4px;">Due date</td>` : ""}
                    </tr>
                    <tr>
                      <td style="font-size:20px;font-weight:bold;color:#111111;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(totalAmount ?? "")}</td>
                      ${dueDate ? `<td align="right" style="font-size:15px;font-weight:bold;color:#111111;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(dueDate)}</td>` : ""}
                    </tr>
                  </table>` : ""}
                  ${showDescription ? `<p style="margin:8px 0 0 0;font-size:13px;color:#555555;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">${escapeHtml(description ?? "")}</p>` : ""}
                </td>
              </tr>
            </table>

            ${showPersonalMessage ? `
            <!-- Personal message -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:16px 20px;background-color:#f9f9fb;border-radius:6px;border:1px solid #e4e4e7;font-size:14px;color:#333333;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">
                  ${escapeHtml(personalMessage ?? "").replace(/\n/g, "<br/>")}
                </td>
              </tr>
            </table>` : ""}

            <!-- CTA buttons -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <a href="${escapeAttr(viewDocumentUrl)}" target="_blank"
                    style="display:inline-block;padding:12px 24px;background-color:#18181b;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px;">
                    View ${escapeHtml(docLabel)}
                  </a>
                </td>
                ${showPayNow ? `
                <td style="padding-left:10px;">
                  <a href="${escapeAttr(payNowUrl ?? "")}" target="_blank"
                    style="display:inline-block;padding:12px 24px;background-color:#16a34a;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px;">
                    Pay Now
                  </a>
                </td>` : ""}
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;text-align:center;font-family:Arial,Helvetica,sans-serif;">
              Sent via <a href="https://clorefy.com" target="_blank" style="color:#6366f1;text-decoration:none;">Clorefy</a>
              &nbsp;·&nbsp;
              You received this because ${escapeHtml(businessName)} sent you a document.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

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
