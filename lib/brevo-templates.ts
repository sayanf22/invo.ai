/**
 * Brevo email HTML templates — Clorefy landing-page theme.
 * Mobile-first, single-column, bulletproof (Outlook-safe) buttons, dark-mode aware.
 * Signature look: cream background, dark header, amber accent, offset-shadow cards.
 * Works in Gmail, Outlook, Apple Mail, mobile clients.
 * Support: support@clorefy.com
 */

// ── Landing theme tokens (mirrors app/globals.css) ───────────────────────────
const DARK = "#121211"          // --landing-dark
const DARK_SOFT = "#1F1B16"     // --landing-text-dark
const CREAM = "#FBF7F0"         // --landing-cream
const CREAM_DEEP = "#F5EDE0"    // --landing-cream-deep
const AMBER = "#C67A3C"         // --landing-amber
const AMBER_LIGHT = "#E8A96A"   // --landing-amber-light
const MUTED = "#7A7266"         // --landing-text-muted
const BORDER = "#E7DECF"
const SUPPORT_EMAIL = "support@clorefy.com"
const APP_URL = "https://clorefy.com"
const ONBOARDING_VIDEO = "https://youtu.be/37OXbkavJPs"

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
      pitch: "Once your profile is set, you can generate a professional invoice — with tax details, payment terms, and a payment link — in under 30 seconds. No more copying client details into spreadsheets.",
      urgency: "Every invoice you send without the right tax details is a risk. Clorefy handles it automatically, so you get paid faster.",
      examplePrompt: "Invoice Acme Corp ₹15,000 for logo design, due in 7 days, UPI",
    }
  }
  if (t.includes("agenc") || t.includes("studio")) {
    return {
      docType: "proposal",
      pitch: "Agencies use Clorefy to turn a brief into a polished proposal, SOW, or invoice from a single prompt — no more juggling Google Docs and your billing tool.",
      urgency: "Your clients are waiting on proposals. Clorefy gets you from brief to signed SOW in minutes, not days.",
      examplePrompt: "Brand strategy proposal for Nexus Co, $12,000, 6 weeks, 50% upfront",
    }
  }
  if (t.includes("develop") || t.includes("engineer") || t.includes("tech")) {
    return {
      docType: "SOW",
      pitch: "Set up once and Clorefy generates compliant SOWs, contracts, and invoices from a single prompt — with IP clauses, milestone payments, and the right tax rules for your client's country.",
      urgency: "Your next project scope should be a signed document, not a Slack thread. Takes about 30 seconds.",
      examplePrompt: "Fixed-fee SOW for fintech web app, Next.js + Supabase, $18,000, 3 milestones",
    }
  }
  if (t.includes("sale") || t.includes("business")) {
    return {
      docType: "quote",
      pitch: "After a call, Clorefy generates a quote or proposal instantly — with your branding, correct tax, and a payment link. No waiting on the accounts team.",
      urgency: "Deals go cold while you format quotes. Clorefy gets one out in 30 seconds.",
      examplePrompt: "Quote Pinnacle Retail for 50 seats, enterprise plan, Net-30",
    }
  }
  return {
    docType: "document",
    pitch: "Once set up, Clorefy writes invoices, contracts, quotes, and proposals from a simple description — with your business details, correct taxes, and clean formatting.",
    urgency: "You're one short setup away from never manually writing a business document again.",
    examplePrompt: "Invoice [client] ₹10,000 for [service], due in 7 days",
  }
}

// ── Bulletproof button (table-based, survives Outlook) ───────────────────────
function ctaButton(href: string, label: string, primary = true): string {
  const bg = primary ? DARK : "#ffffff"
  const color = primary ? "#ffffff" : DARK_SOFT
  const border = primary ? DARK : DARK_SOFT
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
    <tr>
      <td align="center" style="border-radius:12px;background:${bg};border:2px solid ${border};box-shadow:3px 3px 0 0 ${DARK};">
        <a href="${href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;color:${color};text-decoration:none;letter-spacing:-0.2px;">${label}</a>
      </td>
    </tr>
  </table>`
}

// ── Email shell (single column, offset-shadow card, dark header) ─────────────
function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Clorefy</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${CREAM}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; }
    .wrap { max-width:600px; margin:0 auto; padding:32px 16px 48px; }
    .card { background:#ffffff; border-radius:18px; overflow:hidden; border:2px solid ${DARK}; box-shadow:4px 4px 0 0 ${DARK}; }
    .hdr { background:${DARK}; padding:22px 32px; }
    .logo { font-size:21px; font-weight:800; letter-spacing:-0.5px; color:#ffffff; }
    .logo span { color:${AMBER_LIGHT}; }
    .body { padding:36px 32px 32px; }
    .eyebrow { display:inline-block; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:${AMBER}; margin-bottom:14px; }
    h1 { font-size:24px; font-weight:800; color:${DARK_SOFT}; line-height:1.25; letter-spacing:-0.5px; margin-bottom:14px; }
    p { font-size:15px; line-height:1.65; color:#3d3a34; margin-bottom:16px; }
    .lead { font-size:16px; }
    .prompt { background:${CREAM_DEEP}; border:2px solid ${BORDER}; border-radius:12px; padding:16px 18px; margin:18px 0; font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace; font-size:14px; color:${DARK_SOFT}; line-height:1.5; }
    .prompt b { color:${AMBER}; font-weight:700; }
    .divider { border:none; border-top:1px solid ${BORDER}; margin:26px 0; }
    .note { background:${CREAM}; border-radius:12px; padding:18px 20px; margin:18px 0; }
    .note p { font-size:13px; color:${MUTED}; margin-bottom:10px; }
    .fine { font-size:13px; color:${MUTED}; }
    .ftr { padding:22px 32px 28px; }
    .ftr p { font-size:12px; color:#9a9388; line-height:1.6; margin-bottom:5px; }
    .ftr a { color:${AMBER}; text-decoration:none; }
    @media (max-width:600px) {
      .wrap { padding:20px 12px 36px; }
      .body, .ftr { padding-left:22px; padding-right:22px; }
      h1 { font-size:21px; }
      .card { box-shadow:3px 3px 0 0 ${DARK}; }
    }
    @media (prefers-color-scheme: dark) {
      body, .wrap { background:${DARK} !important; }
    }
  </style>
</head>
<body style="background:${CREAM};">
  <div class="wrap">
    <div class="card">
      <div class="hdr">
        <div class="logo">Clore<span>fy</span></div>
      </div>
      ${content}
      <div class="ftr">
        <hr class="divider" style="margin:0 0 18px;">
        <p>Questions? Just reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        <p>© Clorefy · <a href="${APP_URL}/privacy">Privacy</a> · <a href="${APP_URL}/contact">Contact</a></p>
        <p style="margin-top:8px;color:#b5ada1;">You're receiving this because you signed up at clorefy.com. <a href="{{ unsubscribe }}" style="color:#b5ada1;text-decoration:underline;">Unsubscribe</a></p>
      </div>
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
      <span class="eyebrow">Finish your setup</span>
      <h1>You're 2 minutes from your first ${useCase.docType}</h1>
      <p class="lead">Hey ${name},</p>
      <p>You created your Clorefy account but haven't finished setting up your business profile yet. That quick setup is what lets Clorefy fill in your business name, address, tax ID, and payment details on every document — automatically.</p>
      <p>${useCase.pitch}</p>
      ${ctaButton(`${APP_URL}/onboarding`, "Complete my setup →")}
      <p style="margin-top:18px;"><a href="${ONBOARDING_VIDEO}" style="color:${AMBER};font-weight:600;text-decoration:none;">▶ Watch the 2-minute walkthrough</a></p>
      <hr class="divider">
      <div class="note">
        <p>Ran into something confusing? We're real people and happy to help.</p>
        ${ctaButton(`mailto:${SUPPORT_EMAIL}`, "Get help from support", false)}
      </div>
      <p class="fine">Free forever. No card needed.</p>
    </div>
  `)
}

// ── Template 2: Onboarding Drop-off (Email 2 — final nudge) ──────────────────
export function onboardingDropoffEmail2(
  firstName?: string | null,
  businessType?: string | null
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  return emailWrapper(`
    <div class="body">
      <span class="eyebrow">Last reminder</span>
      <h1>One last nudge — then we'll leave you alone</h1>
      <p class="lead">Hey ${name},</p>
      <p>We mentioned finishing your Clorefy setup a few days ago. This is the final check-in.</p>
      <p>${useCase.urgency}</p>
      ${ctaButton(`${APP_URL}/onboarding`, "Finish setup now →")}
      <p style="margin-top:18px;"><a href="${ONBOARDING_VIDEO}" style="color:${AMBER};font-weight:600;text-decoration:none;">▶ Watch how it works (2 min)</a></p>
      <hr class="divider">
      <p class="fine">Your account stays active forever — come back any time at <a href="${APP_URL}" style="color:${AMBER};">clorefy.com</a>.</p>
      <div class="note">
        <p>Something put you off? A one-line reply genuinely helps us improve.</p>
        ${ctaButton(`mailto:${SUPPORT_EMAIL}?subject=Onboarding feedback`, "Share feedback", false)}
      </div>
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
      <span class="eyebrow">We saved your spot</span>
      <h1>${hasDocs ? "Your documents are right where you left them" : "Haven't seen you in a while"}</h1>
      <p class="lead">Hey ${name},</p>
      <p>${hasDocs
        ? `You haven't opened Clorefy in about a week. Your existing ${useCase.docType}s are saved and ready — and a new one takes about 30 seconds.`
        : `You set up your profile but haven't created a ${useCase.docType} yet. It's faster than you'd think.`}</p>
      <p style="margin-bottom:8px;font-weight:600;color:${DARK_SOFT};">Just describe what you need:</p>
      <div class="prompt">"${useCase.examplePrompt}"</div>
      <p>Clorefy writes the whole document — your details, the correct taxes, clean formatting, and a payment link. Done.</p>
      ${ctaButton(APP_URL, hasDocs ? "Open my documents →" : "Create my first document →")}
      <hr class="divider">
      <div class="note">
        <p>Something stopped you? We'd genuinely like to know — it shapes what we build next.</p>
        ${ctaButton(`mailto:${SUPPORT_EMAIL}?subject=Feedback`, "Send us feedback", false)}
      </div>
    </div>
  `)
}

// ── Template 4: Inactivity Re-engagement (Day 14 — final) ────────────────────
export function inactivityEmail2(
  firstName?: string | null,
  businessType?: string | null,
  docsCount?: number
): string {
  const name = esc(firstName) || "there"
  const useCase = getUseCase(businessType)
  const hasDocs = (docsCount ?? 0) > 0
  return emailWrapper(`
    <div class="body">
      <span class="eyebrow">Last one, promise</span>
      <h1>We'll stop after this</h1>
      <p class="lead">Hey ${name},</p>
      <p>This is our final check-in. If Clorefy isn't the right fit right now, no hard feelings — your account stays active and you can return any time.</p>
      <p>If you've just been busy, here's how quick it is to get value:</p>
      <div class="prompt">"${useCase.examplePrompt}"</div>
      <p>${hasDocs
        ? `Your account still has all your ${useCase.docType}s saved and ready.`
        : `One ${useCase.docType} takes about 30 seconds — fully written, with your details and the correct taxes.`}</p>
      ${ctaButton(APP_URL, "Open Clorefy →")}
      <hr class="divider">
      <p>We'd love to know what's missing — it takes 30 seconds and directly shapes what we build next.</p>
      ${ctaButton(`mailto:${SUPPORT_EMAIL}?subject=Why I stopped using Clorefy`, "Tell us what's missing", false)}
      <p class="fine" style="margin-top:22px;">No more automatic emails after this. Your account stays active.</p>
    </div>
  `)
}

// ── Template 5: Welcome / Onboarding complete ────────────────────────────────
export function welcomeCompleteEmail(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <span class="eyebrow">You're all set</span>
      <h1>Welcome aboard, ${name} 🎉</h1>
      <p class="lead">Your business profile is complete. From now on, every invoice, contract, quote, or proposal you generate carries your details, the correct tax rates, and clean formatting — automatically.</p>
      <p style="margin-bottom:8px;font-weight:600;color:${DARK_SOFT};">Try it right now:</p>
      <div class="prompt">"Invoice [Client Name] ₹10,000 for [service], due in 7 days"</div>
      ${ctaButton(APP_URL, "Generate my first document →")}
      <hr class="divider">
      <p>You're on the <b>free plan</b> — generate invoices, contracts, and quotes anytime. <a href="${APP_URL}/pricing" style="color:${AMBER};">See all plans →</a></p>
      <div class="note">
        <p>Need help or have a question? We're human — just reply or reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${AMBER};">${SUPPORT_EMAIL}</a>.</p>
      </div>
    </div>
  `)
}

// ── Template 6: Admin direct email to user ───────────────────────────────────
export function adminDirectEmailTemplate({
  firstName,
  subject,
  message,
  adminEmail,
}: {
  firstName?: string | null
  subject: string
  message: string
  adminEmail: string
}): string {
  const name = esc(firstName) || "there"
  const escapedMsg = esc(message).replace(/\n/g, "<br>")
  return emailWrapper(`
    <div class="body">
      <h1>${esc(subject)}</h1>
      <p class="lead">Hey ${name},</p>
      <p>${escapedMsg}</p>
      <hr class="divider">
      <p class="fine">Sent by the Clorefy team (${esc(adminEmail)}). Reply to this email or reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${AMBER};">${SUPPORT_EMAIL}</a>.</p>
    </div>
  `)
}
