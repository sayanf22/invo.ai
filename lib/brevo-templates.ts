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

export function onboardingDropoffEmail1(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>Your account is set up — finish in 2 minutes</h1>
      <p>Hey ${name},</p>
      <p>You created your Clorefy account but didn't finish setting up your business profile yet. That profile is what makes every document feel professional and accurate — it's worth the 2 minutes.</p>

      <div class="video-box">
        <p>📹 Watch the quick walkthrough (2 min)</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <p>Once you're done, Clorefy will know your business name, address, tax ID, and bank details — so every invoice, contract, or proposal you generate is ready to send without editing.</p>

      <a href="${APP_URL}/onboarding" class="cta-btn">Complete my setup →</a>

      <hr class="divider">

      <div class="feedback-box">
        <p>Ran into something confusing? Tell us what happened and we'll fix it.</p>
        <a href="mailto:${SUPPORT_EMAIL}" class="cta-btn-secondary">Get help from support</a>
      </div>

      <p style="font-size:13px;color:${MUTED};">Takes 2 minutes. Free forever. No card needed.</p>
    </div>
  `)
}

// ── Template 2: Onboarding Drop-off (Email 2 — final nudge) ──────────────────

export function onboardingDropoffEmail2(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>One last thing before we stop</h1>
      <p>Hey ${name},</p>
      <p>We sent you a reminder yesterday about finishing your Clorefy setup. Just checking in once more — your account is ready and waiting.</p>
      <p>Completing the 5-step profile means you can generate a compliant invoice or contract in under 30 seconds. No templates to fill, no tax rules to look up — you just describe what you need.</p>

      <a href="${APP_URL}/onboarding" class="cta-btn">Finish setup now →</a>

      <div class="video-box">
        <p>Still unsure how it works? Watch this 2-minute demo:</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <hr class="divider">
      <p style="font-size:13px;color:${MUTED};">After today we won't send any more reminders. But your account stays active — you can come back any time at <a href="${APP_URL}" style="color:${AMBER}">clorefy.com</a>.</p>

      <div class="feedback-box">
        <p>Did something put you off? Your feedback helps us improve — even a one-liner helps.</p>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Onboarding feedback" class="cta-btn-secondary">Share feedback</a>
      </div>
    </div>
  `)
}

// ── Template 3: Inactivity Re-engagement (Day 7) ─────────────────────────────

export function inactivityEmail1(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>Your Clorefy account is ready — you haven't tried it yet</h1>
      <p>Hey ${name},</p>
      <p>You set up your Clorefy profile a week ago but haven't generated a document yet. No worries — we just want to make sure you know how simple it is.</p>

      <p><strong>Here's how it works:</strong></p>
      <ul style="padding-left:20px;margin-bottom:16px;font-size:15px;line-height:1.8;color:#374151;">
        <li>Type what you need: <em>"Invoice Acme Corp ₹15,000 for web design, 7 days"</em></li>
        <li>Clorefy writes the full document with your business details, correct tax rates, and payment terms</li>
        <li>Send it, get it signed, or attach a payment link — all in one place</li>
      </ul>

      <a href="${APP_URL}" class="cta-btn">Generate my first document →</a>

      <hr class="divider">

      <div class="feedback-box">
        <p>Something not working for you? We'd genuinely like to know.</p>
        <a href="mailto:${SUPPORT_EMAIL}?subject=Feedback from new user" class="cta-btn-secondary">Send us feedback</a>
      </div>
      <p style="font-size:13px;color:${MUTED};">You're on the free plan — generate up to 3 documents before you need to upgrade.</p>
    </div>
  `)
}

// ── Template 4: Inactivity Re-engagement (Day 14 — final) ────────────────────

export function inactivityEmail2(firstName?: string | null): string {
  const name = esc(firstName) || "there"
  return emailWrapper(`
    <div class="body">
      <h1>We built Clorefy for you — give it 60 seconds</h1>
      <p>Hey ${name},</p>
      <p>This is our last check-in. We won't keep mailing you after this.</p>
      <p>If you've been busy or just haven't gotten around to it — we get it. But if you're still curious, here's the fastest way to see value: just type one thing you need to send a client.</p>

      <div class="video-box">
        <p>🎬 See it in action (2 minutes):</p>
        <a href="${ONBOARDING_VIDEO}">${ONBOARDING_VIDEO}</a>
      </div>

      <a href="${APP_URL}" class="cta-btn">Open Clorefy →</a>

      <hr class="divider">

      <p>If this isn't the right tool for you right now, no hard feelings. We'd love to hear what's missing — it takes 30 seconds and genuinely helps us build something better.</p>
      <a href="mailto:${SUPPORT_EMAIL}?subject=Why I didn't use Clorefy" class="cta-btn-secondary">Tell us what's missing</a>

      <p style="font-size:13px;color:${MUTED};margin-top:24px;">After this email we'll stop reaching out. Your account stays active — come back any time.</p>
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
