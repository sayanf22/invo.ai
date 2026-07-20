export interface EmailTemplateData {
  businessName: string
  businessLogoUrl?: string | null
  /** Raw document type from DB. Could be any of the 9 canonical types or
   *  the legacy "quotation" alias. The renderer normalizes internally. */
  documentType: string
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

/**
 * Display label for a document type. Maps "quotation" to "Quote" and
 * provides labels for all 9 canonical types. Falls back to "Document".
 */
function getDocLabel(documentType: string): string {
  const t = (documentType || "").toLowerCase()
  switch (t) {
    case "invoice":               return "Invoice"
    case "contract":              return "Contract"
    case "quote":
    case "quotation":             return "Quote"
    case "estimate":              return "Estimate"
    case "proposal":              return "Proposal"
    case "sow":                   return "Statement of Work"
    case "change_order":          return "Change Order"
    case "nda":                   return "NDA"
    case "client_onboarding_form": return "Client Onboarding Form"
    case "payment_followup":      return "Payment Reminder"
    default:                      return "Document"
  }
}

/**
 * Builds the email subject line. Each document type gets phrasing suited to
 * how that document is actually used (a signable agreement reads
 * differently than a reminder or a quote) rather than one generic template
 * with the label swapped in — matching how QuickBooks, FreshBooks, and
 * PandaDoc vary subject copy by document/notification type.
 */
export function generateEmailSubject(
  documentType: string,
  referenceNumber: string,
  businessName: string
): string {
  const t = (documentType || "").toLowerCase()
  const docLabel = getDocLabel(documentType)

  switch (t) {
    case "invoice":
      return `Invoice ${referenceNumber} from ${businessName}`
    case "quote":
    case "quotation":
      return `Quote ${referenceNumber} from ${businessName}`
    case "estimate":
      return `Estimate ${referenceNumber} from ${businessName}`
    case "payment_followup":
      return `Payment reminder: Invoice ${referenceNumber} from ${businessName}`
    case "contract":
      return `Contract for your review — ${businessName}`
    case "proposal":
      return `Proposal from ${businessName}`
    case "sow":
      return `Statement of Work ${referenceNumber} from ${businessName}`
    case "change_order":
      return `Change Order ${referenceNumber} from ${businessName}`
    case "nda":
      return `NDA for your signature — ${businessName}`
    case "client_onboarding_form":
      return `Please complete this form for ${businessName}`
    default:
      return `${docLabel} ${referenceNumber} from ${businessName}`
  }
}

// ── Brand tokens ─────────────────────────────────────────────────────────────
// Mirrors app/globals.css so outbound email reads as the same product, not a
// generic template with the logo swapped in.
//   --background #FBF7F0 (warm off-white)   --foreground #1a1714 (near-black)
//   --muted #F3EADC   --muted-foreground #6b6156   --border #e8dfd0
//   --accent #b8622e (warm terracotta)
const BRAND = {
  pageBg: "#FBF7F0",
  cardBg: "#ffffff",
  text: "#1a1714",
  textMuted: "#6b6156",
  textFaint: "#a39b8d",
  border: "#e8dfd0",
  chip: "#F3EADC",
  accent: "#b8622e",
  ink: "#1a1714", // primary CTA background — matches app's near-black primary
  inkText: "#FBF7F0", // primary CTA text — matches app's primary-foreground
} as const

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

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

  // Normalize doc type once for all conditional logic below.
  const t = (documentType || "").toLowerCase()
  const isInvoice = t === "invoice"
  const isContract = t === "contract"
  const isQuote = t === "quote" || t === "quotation"
  const isEstimate = t === "estimate"
  const isProposal = t === "proposal"
  const isSow = t === "sow"
  const isChangeOrder = t === "change_order"
  const isNda = t === "nda"
  const isOnboarding = t === "client_onboarding_form"
  const isPaymentFollowup = t === "payment_followup"

  const docLabel = getDocLabel(documentType)

  // Show monetary amount for types that track a total: invoice, quote, estimate, payment follow-up
  const showAmount = (isInvoice || isQuote || isEstimate || isPaymentFollowup) && totalAmount != null && totalAmount !== ""

  // For contracts/SOWs/NDAs/Change Orders: the "description" is the legal body — far too long for an email card.
  // For proposals/onboarding/payment follow-ups: a short excerpt is helpful.
  const isLongFormBody = isContract || isSow || isNda || isChangeOrder
  const rawDescription = !isLongFormBody && description != null && description !== ""
    ? description
    : null
  const showDescription = rawDescription !== null && (isProposal || isEstimate || isOnboarding || isPaymentFollowup)
  const truncatedDescription = rawDescription
    ? rawDescription.length > 200 ? rawDescription.slice(0, 197) + "…" : rawDescription
    : null

  // Body copy — short, type-appropriate. Only used when there's no personal
  // message (the personal message, when present, IS the body — never both,
  // which is what caused the duplicated-looking email).
  const bodyText =
    isInvoice          ? `Please find your invoice attached.`
  : isContract         ? `Please review the contract and sign when ready.`
  : isQuote            ? `Please review the quote. Let us know if you have any questions.`
  : isProposal         ? `Please review the proposal at your convenience.`
  : isSow              ? `Please review this Statement of Work and sign to confirm scope.`
  : isChangeOrder      ? `Please review this change order and sign to approve the changes.`
  : isNda              ? `Please review the NDA and sign to acknowledge.`
  : isOnboarding       ? `Please complete this onboarding form so we can get started.`
  : isPaymentFollowup  ? `Friendly reminder about your outstanding invoice.`
  : `Please review the document attached.`

  const showPersonalMessage = personalMessage != null && personalMessage !== ""
  const showPayNow = payNowUrl != null && payNowUrl !== ""

  const isValidLogoUrl = !!businessLogoUrl &&
    (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))

  const logoHtml = isValidLogoUrl
    ? `<img src="${esc(businessLogoUrl!)}" width="36" height="36" alt="${h(businessName)}" style="display:block;border-radius:9px;object-fit:cover;width:36px;height:36px;" />`
    : ""

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
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;min-width:100%!important}
  @media only screen and (max-width:600px){
    .email-container{width:100%!important;max-width:100%!important;border-radius:0!important}
    .mobile-pad{padding-left:20px!important;padding-right:20px!important}
    .mobile-pad-sm{padding-left:16px!important;padding-right:16px!important}
    .mobile-stack{display:block!important;width:100%!important}
    .mobile-btn{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box;padding:15px 20px!important}
    .mobile-btn-wrap{display:block!important;width:100%!important;padding:0!important;padding-top:10px!important}
    .mobile-ref{font-size:26px!important}
    .mobile-outer-pad{padding:0!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${FONT};">

<!-- Outer wrapper — full width background -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.pageBg};">
  <tr>
    <td align="center" class="mobile-outer-pad" style="padding:32px 16px;">

      <!-- Email container — 560px max, 100% on mobile -->
      <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${BRAND.cardBg};border-radius:20px;overflow:hidden;border:1px solid ${BRAND.border};">

        <!-- Header — logo + business name, single row, no duplication -->
        <tr>
          <td class="mobile-pad" style="padding:26px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      ${isValidLogoUrl ? `<td style="vertical-align:middle;padding-right:12px;">${logoHtml}</td>` : ""}
                      <td style="vertical-align:middle;">
                        <span style="font-family:${FONT};font-size:16px;font-weight:700;color:${BRAND.text};letter-spacing:-0.01em;">${h(businessName)}</span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="font-family:${FONT};font-size:11px;font-weight:600;color:${BRAND.textFaint};text-transform:uppercase;letter-spacing:0.08em;">${h(docLabel)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="padding:0 32px;"><div style="height:1px;background-color:${BRAND.border};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

        <!-- Reference + amount hero -->
        <tr>
          <td class="mobile-pad" style="padding:28px 32px 8px 32px;">
            <p class="mobile-ref" style="margin:0 0 4px 0;font-family:${FONT};font-size:30px;font-weight:800;color:${BRAND.text};letter-spacing:-0.02em;line-height:1.15;">${h(referenceNumber)}</p>
            ${showAmount ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
              <tr>
                <td style="vertical-align:bottom;padding-right:20px;">
                  <p style="margin:0 0 2px 0;font-family:${FONT};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;">Amount due</p>
                  <p style="margin:0;font-family:${FONT};font-size:22px;font-weight:800;color:${BRAND.accent};letter-spacing:-0.01em;">${h(totalAmount ?? "")}</p>
                </td>
                ${dueDate ? `
                <td style="vertical-align:bottom;">
                  <p style="margin:0 0 2px 0;font-family:${FONT};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;">Due date</p>
                  <p style="margin:0;font-family:${FONT};font-size:16px;font-weight:700;color:${BRAND.text};">${h(dueDate)}</p>
                </td>` : ""}
              </tr>
            </table>` : ""}
          </td>
        </tr>

        <!-- Body copy — EITHER the owner's personal message OR the default
             greeting + one-line body, never both, to avoid the duplicated
             "Hi X ... Please find your ... attached" look. -->
        <tr>
          <td class="mobile-pad" style="padding:16px 32px 4px 32px;">
            ${showPersonalMessage ? `
            <p style="margin:0;font-family:${FONT};font-size:15px;color:${BRAND.text};line-height:1.65;">
              ${h(personalMessage ?? "").replace(/\n/g, "<br/>")}
            </p>
            ` : `
            <p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.text};">Hi ${h(recipientName)},</p>
            <p style="margin:0;font-family:${FONT};font-size:14.5px;color:${BRAND.textMuted};line-height:1.65;">
              ${h(bodyText)}
            </p>
            `}
            ${showDescription ? `<p style="margin:14px 0 0 0;font-family:${FONT};font-size:14px;color:${BRAND.textMuted};line-height:1.65;">${h(truncatedDescription ?? "")}</p>` : ""}
          </td>
        </tr>

        <!-- CTA buttons — stacked on mobile for full-width tappability -->
        <tr>
          <td class="mobile-pad" style="padding:24px 32px 30px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="mobile-stack" style="vertical-align:top;">
                  <a href="${esc(viewDocumentUrl)}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:14px 30px;background-color:${BRAND.ink};color:${BRAND.inkText};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;text-align:center;min-width:150px;">
                    View ${h(docLabel)}
                  </a>
                </td>
                ${signingUrl ? `
                <td class="mobile-btn-wrap" style="padding-left:10px;vertical-align:top;">
                  <a href="${esc(signingUrl)}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:14px 30px;background-color:${BRAND.accent};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;text-align:center;min-width:150px;">
                    Sign Document
                  </a>
                </td>` : ""}
                ${showPayNow ? `
                <td class="mobile-btn-wrap" style="padding-left:10px;vertical-align:top;">
                  <a href="${esc(payNowUrl ?? "")}" target="_blank" class="mobile-btn"
                    style="display:inline-block;padding:14px 30px;background-color:#ffffff;color:${BRAND.text};border:1px solid ${BRAND.border};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;text-align:center;min-width:130px;">
                    Pay Now
                  </a>
                </td>` : ""}
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td class="mobile-pad" style="padding:18px 32px;background-color:${BRAND.chip};border-top:1px solid ${BRAND.border};">
            <p style="margin:0;font-family:${FONT};font-size:12px;color:${BRAND.textFaint};text-align:center;line-height:1.6;">
              Sent via <a href="https://clorefy.com" target="_blank" style="color:${BRAND.accent};text-decoration:none;font-weight:600;">Clorefy</a>
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
