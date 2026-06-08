/**
 * Brevo email HTML templates — clean, minimal, modern SaaS style.
 * White background, soft borders, flat rounded buttons, generous whitespace.
 * Mobile-first, single-column, Outlook-safe buttons, dark-mode aware.
 * Works in Gmail, Outlook, Apple Mail, mobile clients.
 * Support: support@clorefy.com
 */

// ── Palette (light, minimal) ─────────────────────────────────────────────────
const INK = "#18181B"          // near-black text/buttons
const INK_SOFT = "#3F3F46"     // body text
const MUTED = "#71717A"        // secondary text
const FAINT = "#A1A1AA"        // footer text
const AMBER = "#C67A3C"        // brand accent (used sparingly)
const PAGE_BG = "#F4F4F5"      // very light page backdrop
const PANEL = "#FAFAFA"        // subtle inset panel
const BORDER = "#ECECEE"       // hairline borders
const SUPPORT_EMAIL = "support@clorefy.com"
const APP_URL = "https://clorefy.com"
const ICON_URL = "https://clorefy.com/favicon.png"
const ONBOARDING_VIDEO = "https://youtu.be/37OXbkavJPs"
const ONBOARDING_THUMB = "https://img.youtube.com/vi/37OXbkavJPs/hqdefault.jpg"
const DOC_VIDEO = "https://youtu.be/CkMqIpStBxA"
const DOC_THUMB = "https://img.youtube.com/vi/CkMqIpStBxA/hqdefault.jpg"

/** Modern, fun, short subject lines (with preview text). Used by callers/admin. */
export const EMAIL_SUBJECTS = {
  onboarding1: "Your first doc is 1 click away ✨",
  onboarding2: "One last nudge 👋",
  inactive1: "Miss us yet? 👀",
  inactive2: "Okay, last one 🙈",
  welcome: "You're in 🎉 Let's make your first doc",
} as const

/** Escape HTML special chars — prevents XSS from user-controlled strings */
function esc(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

/**
 * Remove a leading greeting line from a message body (e.g. "Hi Jean,",
 * "Hello there,", "Hey,", "Dear Sayan,"). The admin email template already
 * renders its own "Hey {firstName}," line, so any greeting the author (or AI)
 * included would double up. This strips that first greeting line only.
 */
export function stripLeadingGreeting(message: string): string {
  if (!message) return message
  const lines = message.split(/\r?\n/)
  // Skip leading blank lines
  let i = 0
  while (i < lines.length && lines[i].trim() === "") i++
  const first = (lines[i] ?? "").trim()
  // A greeting: short line starting with a salutation, optionally a name, ending in , or !
  const greetingRe = /^(hi|hey|hello|hiya|dear|greetings|good (morning|afternoon|evening))\b[^.!?]{0,40}[,!]?$/i
  if (first && greetingRe.test(first)) {
    lines.splice(0, i + 1)
    // Drop a following blank line so we don't leave a gap
    while (lines.length && lines[0].trim() === "") lines.shift()
    return lines.join("\n")
  }
  return message
}

/** Personalized context based on business type */
function getUseCase(businessType?: string | null): {
  docType: string
  pitch: string
  urgency: string
  examplePrompt: string
} {
  const t = (businessType ?? "").toLowerCase()

  if (t.includes("freelan") || t.includes("consultant")) {
    return {
      docType: "invoice",
      pitch: "Once your profile is set, you can generate a professional invoice — with tax details, payment terms, and a payment link — in under 30 seconds.",
      urgency: "Every invoice without the right tax details is a risk. Clorefy handles it automatically, so you get paid faster.",
      examplePrompt: "Invoice Acme Corp ₹15,000 for logo design, due in 7 days",
    }
  }
  if (t.includes("agenc") || t.includes("studio")) {
    return {
      docType: "proposal",
      pitch: "Turn a brief into a polished proposal, SOW, or invoice from a single prompt — no more juggling Google Docs and your billing tool.",
      urgency: "Your clients are waiting on proposals. Clorefy gets you from brief to signed SOW in minutes.",
      examplePrompt: "Brand strategy proposal for Nexus Co, $12,000, 6 weeks",
    }
  }
  if (t.includes("develop") || t.includes("engineer") || t.includes("tech")) {
    return {
      docType: "SOW",
      pitch: "Generate compliant SOWs, contracts, and invoices from a single prompt — with IP clauses, milestone payments, and the right tax rules.",
      urgency: "Your next project scope should be a signed document, not a Slack thread.",
      examplePrompt: "Fixed-fee SOW for fintech web app, $18,000, 3 milestones",
    }
  }
  if (t.includes("sale") || t.includes("business")) {
    return {
      docType: "quote",
      pitch: "After a call, Clorefy generates a quote or proposal instantly — with your branding, correct tax, and a payment link.",
      urgency: "Deals go cold while you format quotes. Clorefy gets one out in 30 seconds.",
      examplePrompt: "Quote Pinnacle Retail for 50 seats, enterprise plan, Net-30",
    }
  }
  return {
    docType: "document",
    pitch: "Clorefy writes invoices, contracts, quotes, and proposals from a simple description — with your details, correct taxes, and clean formatting.",
    urgency: "You're one short setup away from never manually writing a business document again.",
    examplePrompt: "Invoice [client] ₹10,000 for [service], due in 7 days",
  }
}

// ── Flat rounded button (table-based, Outlook-safe) ──────────────────────────
function ctaButton(href: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px auto 4px;">
    <tr>
      <td align="center" bgcolor="${INK}" style="border-radius:10px;">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── Video thumbnail card (clickable, with play overlay) ──────────────────────
function videoCard(href: string, thumb: string, label: string): string {
  return `
  <a href="${href}" target="_blank" style="text-decoration:none;display:block;margin:22px 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:440px;margin:0 auto;border-collapse:separate;">
      <tr>
        <td style="border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td background="${thumb}" bgcolor="#18181B" valign="middle" align="center" height="200" style="background-image:url('${thumb}');background-size:cover;background-position:center;height:200px;border-radius:12px 12px 0 0;">
                <div style="width:56px;height:56px;line-height:56px;border-radius:50%;background:rgba(255,255,255,0.95);text-align:center;margin:0 auto;">
                  <span style="font-size:20px;color:#18181B;">&#9654;</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;padding:13px 16px;border-radius:0 0 12px 12px;">
                <span style="font-size:14px;font-weight:600;color:${INK};">${label}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </a>`
}

// ── Email shell (clean, centered, minimal) ───────────────────────────────────
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Clorefy</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${PAGE_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    .wrap { max-width:520px; margin:0 auto; padding:40px 16px; }
    .card { background:#ffffff; border-radius:16px; border:1px solid ${BORDER}; overflow:hidden; }
    .head { padding:28px 40px 0; text-align:center; }
    .logo { font-size:22px; font-weight:700; letter-spacing:-0.4px; color:${INK}; }
    .logo span { color:${AMBER}; }
    .body { padding:24px 40px 36px; text-align:center; }
    h1 { font-size:23px; font-weight:700; color:${INK}; line-height:1.3; letter-spacing:-0.4px; margin:14px 0 14px; }
    p { font-size:15px; line-height:1.65; color:${INK_SOFT}; margin-bottom:16px; }
    .muted { color:${MUTED}; }
    .prompt { background:${PANEL}; border:1px solid ${BORDER}; border-radius:10px; padding:14px 18px; margin:20px 0; font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace; font-size:13.5px; color:${INK_SOFT}; line-height:1.5; text-align:left; }
    .label { font-size:14px; font-weight:600; color:${INK}; margin-bottom:6px; }
    .divider { border:none; border-top:1px solid ${BORDER}; margin:28px 0; }
    .link-amber { color:${AMBER}; font-weight:600; text-decoration:none; }
    .fine { font-size:13px; color:${MUTED}; }
    .ftr { padding:24px 40px 32px; text-align:center; }
    .ftr p { font-size:12px; color:${FAINT}; line-height:1.7; margin-bottom:4px; }
    .ftr a { color:${MUTED}; text-decoration:underline; }
    @media (max-width:600px) {
      .wrap { padding:24px 12px; }
      .head { padding:24px 24px 0; }
      .body { padding:20px 24px 30px; }
      .ftr { padding:20px 24px 28px; }
      h1 { font-size:21px; }
    }
  </style>
</head>
<body style="background:${PAGE_BG};">
  <div class="wrap">
    <div class="card">
      <div class="head">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td style="padding-right:8px;vertical-align:middle;">
              <img src="${ICON_URL}" width="28" height="28" alt="Clorefy" style="display:block;width:28px;height:28px;border-radius:7px;">
            </td>
            <td style="vertical-align:middle;">
              <span class="logo">Clore<span>fy</span></span>
            </td>
          </tr>
        </table>
      </div>
      ${content}
    </div>
    <div class="ftr">
      <p>Questions? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${MUTED};">${SUPPORT_EMAIL}</a></p>
      <p>© Clorefy · <a href="${APP_URL}/privacy">Privacy</a> · <a href="${APP_URL}/contact">Contact</a></p>
      <p style="margin-top:6px;">You're receiving this because you signed up at clorefy.com.<br><a href="{{ unsubscribe }}">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`
}

// ── Template 1: Onboarding Drop-off (Email 1 of 2) ───────────────────────────
export function onboardingDropoffEmail1(
  firstName?: string | null,
  businessType?: string | null
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  return emailWrapper(`
    <div class="body">
      <h1>Your first ${useCase.docType} is 1 click away ✨</h1>
      <p>Hey ${name} 👋 — you're <em>almost</em> there. You created your Clorefy account but haven't set up your business profile yet.</p>
      <p>It takes about a minute, and then Clorefy fills in your business name, tax ID, and payment details on every document — automatically. ${useCase.pitch}</p>
      ${ctaButton(`${APP_URL}/onboarding`, "Finish setup → 1 min")}
      ${videoCard(ONBOARDING_VIDEO, ONBOARDING_THUMB, "▶ Watch: set up Clorefy in 1 minute")}
      <hr class="divider">
      <p class="fine">Free forever. No card needed. Stuck on something? Email <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a> — real humans here. 🙂</p>
    </div>
  `)
}

// ── Template 2: Onboarding Drop-off (final nudge) ────────────────────────────
export function onboardingDropoffEmail2(
  firstName?: string | null,
  businessType?: string | null
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  return emailWrapper(`
    <div class="body">
      <h1>One last nudge 👋</h1>
      <p>Hey ${name}, we'll keep this short. Your Clorefy account is set up and waiting — just the 1-minute profile left.</p>
      <p>Finish it and your next ${useCase.docType} writes itself in under 30 seconds. Seriously, just describe what you need and watch it appear.</p>
      ${ctaButton(`${APP_URL}/onboarding`, "Finish setup → 1 min")}
      ${videoCard(ONBOARDING_VIDEO, ONBOARDING_THUMB, "▶ See how it works (1 min)")}
      <hr class="divider">
      <p class="fine">Your account stays active forever — pop back any time at <a href="${APP_URL}" class="link-amber">clorefy.com</a>. Not feeling it? Tell us why at <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a>. 🙏</p>
    </div>
  `)
}

// ── Template 3: Inactivity Re-engagement (Day 7) ─────────────────────────────
export function inactivityEmail1(
  firstName?: string | null,
  businessType?: string | null,
  docsCount?: number
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  const hasDocs = (docsCount ?? 0) > 0
  return emailWrapper(`
    <div class="body">
      <h1>Miss us yet? 👀</h1>
      <p>Hey ${name}, ${hasDocs
        ? `you've been away about a week. Your ${useCase.docType}s are right where you left them — and a fresh one takes about 30 seconds.`
        : `you set up your profile but haven't made a ${useCase.docType} yet. Spoiler: it's ridiculously fast.`}</p>
      <p class="label">Try typing something like this:</p>
      <div class="prompt">"${useCase.examplePrompt}"</div>
      <p>Clorefy writes the whole thing — your details, the right taxes, a payment link. You just hit send. 🚀</p>
      ${ctaButton(APP_URL, hasDocs ? "Jump back in" : "Make my first doc")}
      ${videoCard(DOC_VIDEO, DOC_THUMB, "▶ Watch: create a document in seconds")}
      <hr class="divider">
      <p class="fine">Something stopped you? We'd genuinely love to know — email <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a>. It shapes what we build next. 🙏</p>
    </div>
  `)
}

// ── Template 4: Inactivity Re-engagement (final) ─────────────────────────────
export function inactivityEmail2(
  firstName?: string | null,
  businessType?: string | null,
  docsCount?: number
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  return emailWrapper(`
    <div class="body">
      <h1>Okay, last one 🙈</h1>
      <p>Hey ${name}, we promise this is the final check-in. If Clorefy isn't your thing right now, totally fine — your account stays active and you can wander back any time.</p>
      <p>But if you've just been busy, here's the 30-second version:</p>
      <div class="prompt">"${useCase.examplePrompt}"</div>
      <p>Describe it, and Clorefy writes the complete document — branding, taxes, the lot. Watch it happen below 👇</p>
      ${ctaButton(APP_URL, "Give it a go")}
      ${videoCard(DOC_VIDEO, DOC_THUMB, "▶ Watch: a document in seconds")}
      <hr class="divider">
      <p class="fine">What's missing for you? A quick note to <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a> genuinely helps. No more automatic emails after this. 👋</p>
    </div>
  `)
}

// ── Template 5: Welcome / Onboarding complete ────────────────────────────────
export function welcomeCompleteEmail(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>Welcome aboard, ${name} 🎉</h1>
      <p>Your business profile is complete. From now on, every invoice, contract, quote, or proposal carries your details, the correct tax rates, and clean formatting — automatically.</p>
      <p class="label">Try it right now:</p>
      <div class="prompt">"Invoice [Client Name] ₹10,000 for [service], due in 7 days"</div>
      ${ctaButton(APP_URL, "Generate my first document")}
      <hr class="divider">
      <p class="fine">You're on the free plan — generate invoices, contracts, and quotes anytime. <a href="${APP_URL}/pricing" class="link-amber">See all plans</a>. Need help? Email <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a>.</p>
    </div>
  `)
}

// ── Template 6: Admin direct email to user ───────────────────────────────────
export function adminDirectEmailTemplate({
  firstName,
  subject,
  message,
}: {
  firstName?: string | null
  subject: string
  message: string
  adminEmail?: string
}): string {
  const name = esc(firstName) || "there"
  const escapedMsg = esc(stripLeadingGreeting(message)).replace(/\n/g, "<br>")
  return emailWrapper(`
    <div class="body" style="text-align:left;">
      <h1 style="text-align:left;">${esc(subject)}</h1>
      <p>Hey ${name},</p>
      <p>${escapedMsg}</p>
      <hr class="divider">
      <p class="fine">Sent by the Clorefy team. Questions? Email us at <a href="mailto:${SUPPORT_EMAIL}" class="link-amber">${SUPPORT_EMAIL}</a>.</p>
    </div>
  `)
}
