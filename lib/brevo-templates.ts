/**
 * Brevo email HTML templates.
 * Mobile-first, clean design. Works in Gmail, Outlook, Apple Mail.
 * Support email: support@clorefy.com
 */

const BRAND_COLOR = "#1C1A17"
const AMBER = "#d97757"
const CREAM = "#F5F4F0"
const MUTED = "#6b7280"
const SUPPORT_EMAIL = "support@clorefy.com"
const APP_URL = "https://clorefy.com"
const ONBOARDING_VIDEO = "https://youtu.be/37OXbkavJPs"

/** Escape HTML special chars — prevents XSS in email templates from user-controlled strings */
function esc(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

/** Returns personalized context based on business type for email copy */
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
      pitch: "Once your profile is set up, you can generate a professional invoice with GSTIN, payment terms, and a payment link in under 30 seconds. No more copying client details into spreadsheets.",
      urgency: "As a freelancer, every invoice you send without the right tax details is a risk. Clorefy handles it automatically.",
      examplePrompt: "Invoice Acme Corp ₹15,000 for logo design, 7 days, UPI",
    }
  }
  if (t.includes("agenc") || t.includes("studio")) {
    return {
      docType: "proposal",
      pitch: "Agencies using Clorefy generate proposals, SOWs, and invoices from a single prompt — no more copying client details between HoneyBook, Google Docs, and your billing tool.",
      urgency: "Your clients are waiting on proposals. Clorefy gets you from brief to signed SOW in under 5 minutes.",
      examplePrompt: "Brand strategy proposal for Nexus Co, $12,000, 6 weeks, 50% upfront",
    }
  }
  if (t.includes("develop") || t.includes("engineer") || t.includes("tech")) {
    return {
      docType: "SOW",
      pitch: "Set up your profile once and Clorefy generates compliant SOWs, contracts, and invoices from a single prompt — with IP clauses, milestone payments, and the right tax rules for your client's country.",
      urgency: "Your next project scope should be a signed document, not a Slack message. Takes 30 seconds.",
      examplePrompt: "Fixed-fee SOW for fintech web app, Next.js + Supabase, $18,000, 3 milestones",
    }
  }
  if (t.includes("sale") || t.includes("business")) {
    return {
      docType: "quote",
      pitch: "After a discovery call, Clorefy generates a quote or proposal instantly — with your branding, correct tax, and a payment link. No waiting for the accounts team.",
      urgency: "Deals go cold while you're formatting quotes. Clorefy gets it out in 30 seconds.",
      examplePrompt: "Quote Pinnacle Retail for 50 seats, enterprise plan, Net-30",
    }
  }

  // Default
  return {
    docType: "document",
    pitch: "Once set up, Clorefy generates invoices, contracts, quotes, and proposals from a simple description — with your business details, correct taxes, and professional formatting.",
    urgency: "You're one 2-minute setup away from never manually writing a business document again.",
    examplePrompt: "Invoice [client] ₹10,000 for [service], due in 7 days",
  }
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Clorefy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: ${CREAM}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; }
    .email-wrap { max-width: 600px; margin: 0 auto; padding: 24px 16px 48px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; border: 1.5px solid #E5E3DE; }
    .header { background: ${BRAND_COLOR}; padding: 28px 32px; }
    .header-logo { color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .header-logo span { color: ${AMBER}; }
    .body { padding: 36px 32px; }
    h1 { font-size: 22px; font-weight: 700; color: ${BRAND_COLOR}; line-height: 1.3; margin-bottom: 12px; }
    p { font-size: 15px; line-height: 1.65; color: #374151; margin-bottom: 16px; }
    .cta-btn { display: inline-block; background: ${BRAND_COLOR}; color: #ffffff !important; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin: 8px 0 24px; }
    .cta-btn-secondary { display: inline-block; border: 2px solid ${BRAND_COLOR}; color: ${BRAND_COLOR} !important; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 4px 0 24px; }
    .video-box { background: ${CREAM}; border-radius: 12px; padding: 20px 24px; margin: 20px 0; border-left: 3px solid ${AMBER}; }
    .video-box p { margin-bottom: 8px; font-size: 14px; color: ${MUTED}; }
    .video-box a { color: ${BRAND_COLOR}; font-weight: 600; word-break: break-all; }
    .divider { border: none; border-top: 1px solid #E5E3DE; margin: 24px 0; }
    .feedback-box { background: #fafafa; border-radius: 12px; padding: 20px 24px; margin: 20px 0; }
    .feedback-box p { font-size: 14px; color: ${MUTED}; margin-bottom: 10px; }
    .footer { padding: 20px 32px 28px; }
    .footer p { font-size: 12px; color: ${MUTED}; line-height: 1.6; margin-bottom: 4px; }
    .footer a { color: ${AMBER}; text-decoration: none; }
    @media (max-width: 600px) {
      .body, .footer { padding: 24px 20px; }
      h1 { font-size: 20px; }
      .cta-btn { width: 100%; text-align: center; padding: 16px 20px; }
      .cta-btn-secondary { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrap">
    <div class="card">
      <div class="header">
        <div class="header-logo">Clore<span>fy</span></div>
      </div>
      ${content}
      <div class="footer">
        <hr class="divider">
        <p>Questions? Reply to this email or write to us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        <p>© Clorefy · <a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/contact">Contact</a></p>
        <p style="margin-top:8px;color:#9ca3af;">You're receiving this because you signed up at clorefy.com.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

// ── Template 1: Onboarding Drop-off (Email 1 of 2) ────────────────────────────

export function onboardingDropoffEmail1(
  firstName?: string | null,
  businessType?: string | null
): string {
  const name = esc(firstName) || "there"
  // Personalize the use-case context based on business type
  const useCase = getUseCase(businessType)

  return emailWrapper(`
    <div class="body">
      <h1>Your account is set up — finish in 2 minutes</h1>
      <p>Hey ${name},</p>
      <p>You created your Clorefy account but didn't finish the setup. That 2-minute profile is what makes every ${useCase.docType} look professional — it fills in your business name, address, tax ID, and payment details automatically.</p>

      <div class="video-box">
        <p>📹 Watch the quick walkthrough (2 min)</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <p>${useCase.pitch}</p>

      <a href="${APP_URL}/onboarding" class="cta-btn">Complete my setup →</a>

      <hr class="divider">

      <div class="feedback-box">
        <p>Ran into something confusing? Tell us and we'll help.</p>
        <a href="mailto:${SUPPORT_EMAIL}" class="cta-btn-secondary">Get help from support</a>
      </div>

      <p style="font-size:13px;color:${MUTED};">Takes 2 minutes. Free forever. No card needed.</p>
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
      <h1>One last nudge — then we'll leave you alone</h1>
      <p>Hey ${name},</p>
      <p>We sent you a note a few days ago about finishing your Clorefy setup. Just one more check-in — and after this we'll stop.</p>
      <p>${useCase.urgency}</p>

      <a href="${APP_URL}/onboarding" class="cta-btn">Finish setup now →</a>

      <div class="video-box">
        <p>Still unsure? Watch this 2-minute demo:</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <hr class="divider">
      <p style="font-size:13px;color:${MUTED};">Your account stays active forever — you can come back any time at <a href="${APP_URL}" style="color:${AMBER}">clorefy.com</a>.</p>

      <div class="feedback-box">
        <p>Something put you off? A one-liner helps us improve for everyone.</p>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Onboarding feedback" class="cta-btn-secondary">Share feedback</a>
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
      <h1>${hasDocs ? "Come back — your documents are waiting" : "Your Clorefy account is ready"}</h1>
      <p>Hey ${name},</p>
      <p>${hasDocs
        ? `You haven't opened Clorefy in a while. Your existing ${useCase.docType}s are saved and ready — and generating a new one takes about 30 seconds.`
        : `You set up your Clorefy profile but haven't generated a ${useCase.docType} yet. It takes less time than you think.`
      }</p>

      <p><strong>Here's how quick it is:</strong></p>
      <p style="background:${CREAM};border-radius:8px;padding:14px 18px;font-size:14px;color:${BRAND_COLOR};border-left:3px solid ${AMBER}">
        "${useCase.examplePrompt}"
      </p>
      <p>Clorefy writes the whole document — with your business details, correct taxes, and professional formatting. Done.</p>

      <a href="${APP_URL}" class="cta-btn">${hasDocs ? "Open my documents →" : "Generate my first document →"}</a>

      <hr class="divider">

      <div class="feedback-box">
        <p>Something stopped you from using it? Tell us — we're always improving.</p>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Feedback" class="cta-btn-secondary">Send us feedback</a>
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
      <h1>We'll stop after this one</h1>
      <p>Hey ${name},</p>
      <p>This is the last email we'll send. If Clorefy isn't the right fit right now, no hard feelings.</p>
      <p>${hasDocs
        ? `But if you've just been busy — your account is still here with all your ${useCase.docType}s saved.`
        : `If you haven't had a chance yet, your account is still ready. One ${useCase.docType} takes 30 seconds.`
      }</p>

      <div class="video-box">
        <p>🎬 See it in action (2 minutes):</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <a href="${APP_URL}" class="cta-btn">Open Clorefy →</a>

      <hr class="divider">

      <p>We'd genuinely love to know what's missing or what stopped you — it takes 30 seconds and directly shapes what we build next.</p>
      <a href="mailto:${SUPPORT_EMAIL}?subject=Why I stopped using Clorefy" class="cta-btn-secondary">Tell us what's missing</a>

      <p style="font-size:13px;color:${MUTED};margin-top:24px;">No more emails after this. Your account stays active.</p>
    </div>
  `)
}

// ── Template 5: Welcome / Onboarding complete ────────────────────────────────

export function welcomeCompleteEmail(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>You're all set, ${name} — let's create your first document</h1>
      <p>Your business profile is complete. From now on, every invoice, contract, quote, or proposal you generate will have your details, correct tax rates, and professional formatting — automatically.</p>

      <p><strong>Try it right now:</strong></p>
      <p style="background:${CREAM};border-radius:8px;padding:14px 18px;font-size:14px;color:${BRAND_COLOR};border-left:3px solid ${AMBER}">
        "Invoice [Client Name] ₹10,000 for [service], due in 7 days"
      </p>

      <a href="${APP_URL}" class="cta-btn">Generate first document →</a>

      <hr class="divider">
      <p>You're on the <strong>free plan</strong> — you can generate invoices, contracts, and quotes. <a href="${APP_URL}/pricing" style="color:${AMBER}">See all plans →</a></p>
      <div class="feedback-box">
        <p>Need help or have questions? We're human — reply to this email or reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${AMBER}">${SUPPORT_EMAIL}</a></p>
      </div>
    </div>
  `)
}

// ── Template 6: Admin direct email to user ────────────────────────────────────

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
  // Convert newlines to <br> — message is already escaped below
  const escapedMsg = esc(message).replace(/\n/g, "<br>")

  return emailWrapper(`
    <div class="body">
      <h1>${esc(subject)}</h1>
      <p>Hey ${name},</p>
      <p>${escapedMsg}</p>
      <hr class="divider">
      <p style="font-size:13px;color:${MUTED};">This message was sent by the Clorefy team (${esc(adminEmail)}). Reply to this email or reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${AMBER}">${SUPPORT_EMAIL}</a>.</p>
    </div>
  `)
}
