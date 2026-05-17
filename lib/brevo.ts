/**
 * Brevo integration — contact sync & transactional email sending.
 * All calls use plain fetch() — works in Cloudflare Workers edge runtime.
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY || ""
const ONBOARDING_LIST_ID = Number(process.env.BREVO_ONBOARDING_LIST_ID || 4)
const ACTIVE_LIST_ID = Number(process.env.BREVO_ACTIVE_LIST_ID || 5)
const BASE = "https://api.brevo.com/v3"

const brevoHeaders = {
  "api-key": BREVO_API_KEY,
  "Content-Type": "application/json",
}

/** Fire-and-forget wrapper — logs errors, never throws */
async function brevoCall(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: unknown }> {
  if (!BREVO_API_KEY) return { ok: false, status: 0, json: null }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: brevoHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    return { ok: res.ok, status: res.status, json }
  } catch (err) {
    console.error("[brevo] fetch error:", err)
    return { ok: false, status: 0, json: null }
  }
}

// ── Contact sync ──────────────────────────────────────────────────────────────

/**
 * Called on every login / signup.
 * Creates or updates the contact in Brevo with LAST_ACTIVE.
 * New users (no onboarding) go to the Onboarding Started list.
 */
export async function syncUserOnLogin({
  email,
  firstName,
  isNewUser,
  onboardingComplete,
  signupAt,
}: {
  email: string
  firstName?: string | null
  isNewUser: boolean
  onboardingComplete: boolean
  signupAt?: string | null
}): Promise<void> {
  const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD

  const attributes: Record<string, unknown> = {
    LAST_ACTIVE: today,
  }
  if (firstName) attributes.FIRSTNAME = firstName
  if (signupAt) attributes.SIGNUP_AT = signupAt.split("T")[0]

  // Only set ONBOARDING_COMPLETE if it's false (don't overwrite true)
  if (!onboardingComplete) {
    attributes.ONBOARDING_COMPLETE = false
  }

  const listIds = onboardingComplete
    ? [ACTIVE_LIST_ID]
    : isNewUser
    ? [ONBOARDING_LIST_ID]
    : undefined // existing partial users: don't change list, just update attrs

  await brevoCall("POST", "/contacts", {
    email,
    listIds,
    updateEnabled: true,
    attributes,
  })
}

/**
 * Called when onboarding is fully completed.
 * Moves user from Onboarding Started → Active Users and marks ONBOARDING_COMPLETE.
 */
export async function syncOnboardingComplete(email: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]

  await brevoCall("POST", "/contacts", {
    email,
    listIds: [ACTIVE_LIST_ID],
    updateEnabled: true,
    attributes: {
      ONBOARDING_COMPLETE: true,
      LAST_ACTIVE: today,
    },
  })

  // Remove from onboarding list (they graduated)
  await brevoCall("POST", "/contacts/lists/remove", {
    emails: [email],
    listId: ONBOARDING_LIST_ID,
  }).catch(() => {}) // non-critical
}

/**
 * Updates LAST_ACTIVE date for an existing contact.
 * Called on any meaningful app interaction.
 */
export async function updateLastActive(email: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]
  await brevoCall("PUT", `/contacts/${encodeURIComponent(email)}`, {
    attributes: { LAST_ACTIVE: today },
  })
}

// ── Transactional email sending ───────────────────────────────────────────────

export interface TransactionalEmailParams {
  to: string
  toName?: string
  subject: string
  htmlContent: string
  replyTo?: string
  tags?: string[]
}

/**
 * Sends a transactional email via Brevo.
 * Returns true on success, false on failure (never throws).
 */
export async function sendTransactionalEmail(
  params: TransactionalEmailParams
): Promise<boolean> {
  const result = await brevoCall("POST", "/smtp/email", {
    sender: { name: "Clorefy", email: "noreply@clorefy.com" },
    to: [{ email: params.to, name: params.toName || params.to }],
    subject: params.subject,
    htmlContent: params.htmlContent,
    replyTo: { email: params.replyTo || "support@clorefy.com" },
    tags: params.tags,
  })
  return result.ok
}

// ── Batch email send ──────────────────────────────────────────────────────────

export interface BulkEmailContact {
  email: string
  name?: string
}

/**
 * Sends an email to a list of contacts one-by-one (respects Brevo rate limits).
 * Returns counts of sent/failed.
 */
export async function sendBulkTransactionalEmails(
  contacts: BulkEmailContact[],
  subject: string,
  getHtml: (contact: BulkEmailContact) => string,
  tags: string[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const contact of contacts) {
    const ok = await sendTransactionalEmail({
      to: contact.email,
      toName: contact.name,
      subject,
      htmlContent: getHtml(contact),
      tags,
    })
    if (ok) sent++
    else failed++

    // Small delay to avoid rate limiting (free tier: ~50/sec)
    await new Promise((r) => setTimeout(r, 50))
  }

  return { sent, failed }
}
