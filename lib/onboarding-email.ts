/**
 * Onboarding-form email templates (invitation to the client + submission
 * notification to the owner). Inline-CSS + table layout for broad email-client
 * compatibility, mirroring the signing invitation style.
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

  const isValidLogo = !!businessLogoUrl && (businessLogoUrl.startsWith("https://") || businessLogoUrl.startsWith("http://"))
  const logoHtml = isValidLogo
    ? `<img src="${esc(businessLogoUrl!)}" alt="" width="40" height="40" style="display:block;border-radius:8px;object-fit:cover;" />`
    : ""

  const expiryFormatted = new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

  const personalMessageHtml = personalMessage
    ? `<tr><td style="padding:0 28px 20px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;">
          <tr><td style="padding:16px 20px;font-size:14px;color:#3f3f46;line-height:1.7;font-family:${FONT};">
            ${h(personalMessage).replace(/\n/g, "<br/>")}
          </td></tr>
        </table>
      </td></tr>`
    : ""

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${h(businessName)} — please complete your onboarding form</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
  <tr><td align="center" style="padding:24px 8px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:24px 28px 20px 28px;border-bottom:1px solid #f0f0f0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${isValidLogo ? `<td style="vertical-align:middle;padding-right:14px;">${logoHtml}</td>` : ""}
          <td style="vertical-align:middle;"><span style="font-size:18px;font-weight:700;color:#18181b;">${h(businessName)}</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:16px;font-weight:600;color:#18181b;">Hi ${h(clientName || "there")},</p>
        <p style="margin:0 0 24px 0;font-size:15px;color:#52525b;line-height:1.6;">
          ${h(businessName)} would like you to complete a short onboarding form so they can get started. It only takes a few minutes and works on any device.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border-radius:10px;border:1px solid #e4e4e7;margin-bottom:24px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.1em;">Onboarding Form</p>
            <p style="margin:0;font-size:20px;font-weight:800;color:#18181b;letter-spacing:-0.02em;">${h(formTitle || "Client Onboarding")}</p>
          </td></tr>
        </table>
      </td></tr>
      ${personalMessageHtml}
      <tr><td style="padding:0 28px 24px 28px;">
        <a href="${esc(fillUrl)}" target="_blank" style="display:inline-block;padding:13px 28px;background-color:#18181b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">Complete Form</a>
      </td></tr>
      <tr><td style="padding:0 28px 24px 28px;">
        <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">Your progress saves automatically. This link expires on <strong>${h(expiryFormatted)}</strong>.</p>
        <p style="margin:0;font-size:13px;color:#71717a;background-color:#fef9c3;border:1px solid #fde047;border-radius:6px;padding:10px 14px;">⚠️ This link is unique to you. Do not share it.</p>
      </td></tr>
      <tr><td style="padding:0 28px 24px 28px;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">If the button doesn't work, copy and paste this link:<br/>
          <a href="${esc(fillUrl)}" style="color:#6366f1;word-break:break-all;">${h(fillUrl)}</a></p>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">Sent via <a href="https://clorefy.com" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">Clorefy</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`
}

/** Owner notification email — the client submitted their onboarding form. */
export function buildOnboardingSubmittedEmail(opts: {
  businessName: string
  formTitle: string
  clientName: string
  dashboardUrl: string
}): string {
  const { businessName, formTitle, clientName, dashboardUrl } = opts
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>Onboarding form completed</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
  <tr><td align="center" style="padding:24px 8px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:18px;font-weight:700;color:#18181b;">✅ Onboarding form completed</p>
        <p style="margin:0 0 24px 0;font-size:15px;color:#52525b;line-height:1.6;">
          ${h(clientName || "Your client")} just completed the onboarding form <strong>${h(formTitle || "Client Onboarding")}</strong>. Their answers are ready to review.
        </p>
      </td></tr>
      <tr><td style="padding:0 28px 28px 28px;">
        <a href="${esc(dashboardUrl)}" target="_blank" style="display:inline-block;padding:13px 28px;background-color:#18181b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">View Responses</a>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">Sent via <a href="https://clorefy.com" target="_blank" style="color:#6366f1;text-decoration:none;font-weight:600;">Clorefy</a></p>
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`
}
