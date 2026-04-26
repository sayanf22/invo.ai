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
  signingUrl?: string | null
}

export function generateEmailSubject(
  documentType: string,
  referenceNumber: string,
  businessName: string
): string {
  const label =
    documentType === "invoice" ? "Invoice"
    : documentType === "contract" ? "Contract"
    : documentType === "quotation" ? "Quotation"
    : "Proposal"
  return `${label} ${referenceNumber} from ${businessName}`
}

/**
 * Renders a branded HTML email using inline CSS + table layout.
 * Mobile-first: uses 100% width with max-width constraint.
 * Compatible with Gmail, Outlook, Apple Mail, Samsung Mail.
 * Tested patterns from Litmus/Email on Acid best practices.
 */
export function renderEmailTemplate(data: EmailTemplateData): string {
  const {
    businessName, businessLogoUrl, documentType, referenceNumber,
    recipientName, totalAmount, currency, dueDate, description,
    personalMessage, viewDocumentUrl, payNowUrl, signingUrl,
  } = data

  const docLabel =
    documentType === "invoice" ? "Invoice"
    : documentType === "contract" ? "Contract"
    : documentType === "quotation" ? "Quotation"
    : "Proposal"

  const showAmount = (documentType === "invoice" || documentType === "quotation") && totalAmount != null && totalAmount !== ""
  const showDescription = (documentType === "contract" || documentType === "proposal") && description != null && description !== ""
  const showPersonalMessage = personalMessage != null && personalMessage !== ""
  const showPayNow = payNowUrl != null && payNowUrl !== ""

  const isValidLogoUrl = businessLogoUrl &&
    (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))

  const logoHtml = isValidLogoUrl
    ? `<img src="${esc(businessLogoUrl!)}" alt="" width="40" height="40" style="display:block;border-radius:8px;object-fit:cover;" />`
    : ""

  // Build the full-width, mobile-optimized email
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${h(docLabel)} ${h(referenceNumber)} from ${h(businessName)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Reset for all clients */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;min-width:100%!important}
  /* Mobile-first responsive */
  @media only screen and (max-width:620px){
    .email-container{width:100%!important;max-width:100%!important}
    .mobile-pad{padding-left:16px!important;padding-right:16px!important}
    .mobile-pad-sm{padding-left:12px!important;padding-right:12px!important}
    .mobile-stack{display:block!important;width:100%!important}
    .mobile-center{text-align:center!important}
    .mobile-btn{display:block!important;width:100%!important;text-align:center!important;padding:14px 20px!important}
    .mobile-btn-wrap{display:block!important;width:100%!important;padding:0!important;padding-top:8px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<!-- Outer wrapper — full width background -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
  <tr>
    <td align="center" style="padding:24px 8px;">

      <!-- Email container — 600px max, 100% on mobile -->
      <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td class="mobile-pad" style="padding:24px 28px 20px 28px;border-bottom:1px solid #f0f0f0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${isValidLogoUrl ? `<td style="vertical-align:middle;padding-right:14px;">${logoHtml}</td>` : ""}
                <td style="vertical-align:middle;">
                  <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.01em;">${h(businessName)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="mobile-pad" style="padding:28px 28px 8px 28px;">

            <!-- Greeting -->
            <p style="margin:0 0 6px 0;font-size:16px;font-weight:600;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Hi ${h(recipientName)},</p>
            <p style="margin:0 0 24px 0;font-size:15px;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
              ${h(businessName)} has sent you a ${h(docLabel.toLowerCase())}.
            </p>

            <!-- Document summary card -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;margin-bottom:24px;">
              <tr>
                <td class="mobile-pad-sm" style="padding:20px 24px;">
                  <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${h(docLabel)}</p>
                  <p style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.02em;">${h(referenceNumber)}</p>
                  ${showAmount ? `
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-size:13px;color:#71717a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding-bottom:4px;">Amount due</td>
                      ${dueDate ? `<td align="right" style="font-size:13px;color:#71717a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding-bottom:4px;">Due date</td>` : ""}
                    </tr>
                    <tr>
                      <td style="font-size:20px;font-weight:700;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${h(totalAmount ?? "")}</td>
                      ${dueDate ? `<td align="right" style="font-size:15px;font-weight:600;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${h(dueDate)}</td>` : ""}
                    </tr>
                  </table>` : ""}
                  ${showDescription ? `<p style="margin:12px 0 0 0;font-size:14px;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">${h(description ?? "")}</p>` : ""}
                </td>
              </tr>
            </table>

            ${showPersonalMessage ? `
            <!-- Personal message -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td class="mobile-pad-sm" style="padding:16px 20px;background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;font-size:14px;color:#3f3f46;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                  ${h(personalMessage ?? "").replace(/\n/g, "<br/>")}
                </td>
              </tr>
            </table>` : ""}

          </td>
        </tr>

        <!-- CTA buttons — stacked on mobile for full-width tappability -->
        <tr>
          <td class="mobile-pad" style="padding:0 28px 28px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="mobile-stack" style="vertical-align:top;">
                  <a href="${esc(viewDocumentUrl)}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:13px 28px;background-color:#18181b;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;text-align:center;min-width:140px;">
                    View ${h(docLabel)}
                  </a>
                </td>
                ${signingUrl ? `
                <td class="mobile-btn-wrap" style="padding-left:10px;vertical-align:top;">
                  <a href="${esc(signingUrl)}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:13px 28px;background-color:#7c3aed;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;text-align:center;min-width:140px;">
                    ✍ Sign Document
                  </a>
                </td>` : ""}
                ${showPayNow ? `
                <td class="mobile-btn-wrap" style="padding-left:10px;vertical-align:top;">
                  <a href="${esc(payNowUrl ?? "")}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:13px 28px;background-color:#16a34a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;text-align:center;min-width:120px;">
                    Pay Now
                  </a>
                </td>` : ""}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="mobile-pad" style="padding:16px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;">
              Sent via <a href="https://clorefy.com" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">Clorefy</a>
              &nbsp;&middot;&nbsp;
              You received this because ${h(businessName)} sent you a document.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Email container -->

    </td>
  </tr>
</table>

</body>
</html>`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function h(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function esc(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
