/**
 * Onboarding-form email templates (invitation to the client + submission
 * notification to the owner). Inline-CSS + table layout for broad email-client
 * compatibility, matching the brand tokens in lib/email-template.ts.
 */

function h(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function esc(str: string): string {
  return String(str ?? "").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Mirrors lib/email-template.ts BRAND tokens (app/globals.css warm off-white theme).
const BRAND = {
  pageBg: "#FBF7F0",
  cardBg: "#ffffff",
  text: "#1a1714",
  textMuted: "#6b6156",
  textFaint: "#a39b8d",
  border: "#e8dfd0",
  chip: "#F3EADC",
  accent: "#b8622e",
  ink: "#1a1714",
  inkText: "#FBF7F0",
} as const

/** Shared header + footer wrapper so both onboarding emails stay visually identical. */
function wrap(opts: { title: string; businessName: string; businessLogoUrl?: string | null; body: string }): string {
  const { title, businessName, businessLogoUrl, body } = opts
  const isValidLogo = !!businessLogoUrl && (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))
  const logoHtml = isValidLogo
    ? `<img src="${esc(businessLogoUrl!)}" width="36" height="36" alt="${h(businessName)}" style="display:block;border-radius:9px;object-fit:cover;width:36px;height:36px;" />`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${h(title)}</title>
<style>
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;min-width:100%!important}
  @media only screen and (max-width:600px){
    .email-container{width:100%!important;max-width:100%!important;border-radius:0!important}
    .mobile-pad{padding-left:20px!important;padding-right:20px!important}
    .mobile-btn{display:block!important;width:100%!important;text-align:center!important;box-sizing:border-box;padding:15px 20px!important}
    .mobile-outer-pad{padding:0!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.pageBg};">
  <tr><td align="center" class="mobile-outer-pad" style="padding:32px 16px;">
    <table role="presentation" class="email-container" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${BRAND.cardBg};border-radius:20px;overflow:hidden;border:1px solid ${BRAND.border};">

      <!-- Header -->
      <tr><td class="mobile-pad" style="padding:26px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${isValidLogo ? `<td style="vertical-align:middle;padding-right:12px;">${logoHtml}</td>` : ""}
          <td style="vertical-align:middle;"><span style="font-family:${FONT};font-size:16px;font-weight:700;color:${BRAND.text};letter-spacing:-0.01em;">${h(businessName)}</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 32px;"><div style="height:1px;background-color:${BRAND.border};line-height:1px;font-size:1px;">&nbsp;</div></td></tr>

      ${body}

      <!-- Footer -->
      <tr><td class="mobile-pad" style="padding:18px 32px;background-color:${BRAND.chip};border-top:1px solid ${BRAND.border};">
        <p style="margin:0;font-family:${FONT};font-size:12px;color:${BRAND.textFaint};text-align:center;line-height:1.6;">
          Sent via <a href="https://clorefy.com" target="_blank" style="color:${BRAND.accent};text-decoration:none;font-weight:600;">Clorefy</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

/** Client invitation email with a "Complete Form" CTA. */
export function buildOnboardingInvitationEmail(opts: {
  businessName: string
  businessLogoUrl?: string | null
  formTitle: string
  clientName: string
  fillUrl: string
  expiresAt: string
  personalMessage?: string | null
}): string {
  const { businessName, businessLogoUrl, formTitle, clientName, fillUrl, expiresAt, personalMessage } = opts

  const expiryFormatted = new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  const personalMessageHtml = personalMessage
    ? `<tr><td class="mobile-pad" style="padding:0 32px 20px 32px;">
        <p style="margin:0;font-family:${FONT};font-size:15px;color:${BRAND.text};line-height:1.65;">
          ${h(personalMessage).replace(/\n/g, "<br/>")}
        </p>
      </td></tr>`
    // No personal message → the default greeting IS the body (never both, to
    // avoid the duplicated "Hi X ... Please find your form attached" look).
    : `<tr><td class="mobile-pad" style="padding:0 32px 20px 32px;">
        <p style="margin:0 0 6px 0;font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.text};">Hi ${h(clientName || "there")},</p>
        <p style="margin:0;font-family:${FONT};font-size:14.5px;color:${BRAND.textMuted};line-height:1.65;">
          ${h(businessName)} would like you to complete a short onboarding form so they can get started. It only takes a few minutes and works on any device.
        </p>
      </td></tr>`

  const body = `
      <!-- Reference hero -->
      <tr><td class="mobile-pad" style="padding:28px 32px 4px 32px;">
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:11px;font-weight:600;color:${BRAND.textFaint};text-transform:uppercase;letter-spacing:0.08em;">Onboarding Form</p>
        <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:800;color:${BRAND.text};letter-spacing:-0.02em;line-height:1.2;">${h(formTitle || "Client Onboarding")}</p>
      </td></tr>

      ${personalMessageHtml}

      <!-- CTA -->
      <tr><td class="mobile-pad" style="padding:8px 32px 22px 32px;">
        <a href="${esc(fillUrl)}" target="_blank" class="mobile-btn"
          style="display:inline-block;padding:14px 30px;background-color:${BRAND.ink};color:${BRAND.inkText};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          Complete Form
        </a>
      </td></tr>

      <!-- Expiry + security notice -->
      <tr><td class="mobile-pad" style="padding:0 32px 26px 32px;">
        <p style="margin:0 0 10px 0;font-family:${FONT};font-size:12.5px;color:${BRAND.textMuted};">Your progress saves automatically. This link expires on <strong style="color:${BRAND.text};">${h(expiryFormatted)}</strong>.</p>
        <p style="margin:0;font-family:${FONT};font-size:12.5px;color:${BRAND.accent};background-color:${BRAND.chip};border:1px solid ${BRAND.border};border-radius:10px;padding:11px 14px;">This link is unique to you. Do not share it.</p>
      </td></tr>`

  return wrap({ title: `${businessName} — please complete your onboarding form`, businessName, businessLogoUrl, body })
}

/** Owner notification email — the client submitted their onboarding form. */
export function buildOnboardingSubmittedEmail(opts: {
  businessName: string
  formTitle: string
  clientName: string
  dashboardUrl: string
}): string {
  const { businessName, formTitle, clientName, dashboardUrl } = opts

  const body = `
      <!-- Reference hero -->
      <tr><td class="mobile-pad" style="padding:28px 32px 4px 32px;">
        <p style="margin:0 0 4px 0;font-family:${FONT};font-size:11px;font-weight:600;color:${BRAND.textFaint};text-transform:uppercase;letter-spacing:0.08em;">Onboarding Completed</p>
        <p style="margin:0;font-family:${FONT};font-size:26px;font-weight:800;color:${BRAND.text};letter-spacing:-0.02em;line-height:1.2;">${h(formTitle || "Client Onboarding")}</p>
      </td></tr>

      <tr><td class="mobile-pad" style="padding:16px 32px 22px 32px;">
        <p style="margin:0;font-family:${FONT};font-size:14.5px;color:${BRAND.textMuted};line-height:1.65;">
          ${h(clientName || "Your client")} just completed this onboarding form. Their answers are ready to review.
        </p>
      </td></tr>

      <tr><td class="mobile-pad" style="padding:0 32px 30px 32px;">
        <a href="${esc(dashboardUrl)}" target="_blank" class="mobile-btn"
          style="display:inline-block;padding:14px 30px;background-color:${BRAND.ink};color:${BRAND.inkText};font-family:${FONT};font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
          View Responses
        </a>
      </td></tr>`

  return wrap({ title: "Onboarding form completed", businessName, businessLogoUrl: null, body })
}
