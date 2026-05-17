/**
 * Brevo integration — contact sync & transactional email sending.
 * All calls use plain fetch() — works in Cloudflare Workers edge runtime.
 *
 * IMPORTANT: env vars are read INSIDE functions, never at module level.
 * Cloudflare Workers inject bindings at request time, not at module init.
 */

const BASE = "https://api.brevo.com/v3"

/** Read env vars at call time — safe for Cloudflare Workers. */
function cfg() {
  return {
    apiKey: process.env.BREVO_API_KEY ?? "",
    onboardingListId: Number(process.env.BREVO_ONBOARDING_LIST_ID ?? 4),
    activeListId: Number(process.env.BREVO_ACTIVE_LIST_ID ?? 5),
  }
}

/** Fire-and-forget wrapper — logs errors, never throws */
async function brevoCall(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const { apiKey } = cfg()
  if (!apiKey) {
    console.warn("[brevo] BREVO_API_KEY not set — skipping call to", path)
    return { ok: false, status: 0, json: null }
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) {
      console.error(`[brevo] ${method} ${path} → ${res.status}:`, text.slice(0, 200))
    }
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
  const { onboardingListId, activeListId } = cfg()

  const attributes: Record<string, unknown> = {
    LAST_ACTIVE: today,
  }
  // Only set safe string values — never trust user input in attribute keys
  if (firstName && typeof firstName === "string") {
    attributes.FIRSTNAME = firstName.slice(0, 64) // cap length
  }
  if (signupAt && typeof signupAt === "string") {
    attributes.SIGNUP_AT = signupAt.split("T")[0]
  }

  // Only set ONBOARDING_COMPLETE = false, never overwrite an existing true
  if (!onboardingComplete) {
    attributes.ONBOARDING_COMPLETE = false
  }

  const listIds =
    onboardingComplete
      ? [activeListId]
      : isNewUser
      ? [onboardingListId]
      : undefined // existing partial users: don't change list, just update attrs

  await brevoCall("POST", "/contacts", {
    email,
    ...(listIds ? { listIds } : {}),
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
  const { activeListId, onboardingListId } = cfg()

  await brevoCall("POST", "/contacts", {
    email,
    listIds: [activeListId],
    updateEnabled: true,
    attributes: {
      ONBOARDING_COMPLETE: true,
      LAST_ACTIVE: today,
    },
  })

  // Remove from onboarding list — correct Brevo v3 endpoint
  // POST /contacts/lists/{listId}/contacts/remove
  await brevoCall(
    "POST",
    `/contacts/lists/${onboardingListId}/contacts/remove`,
    { emails: [email] }
  )
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

    // Throttle: ~20 emails/sec to stay well within Brevo free-tier limits
    await new Promise<void>((r) => setTimeout(r, 50))
  }

  return { sent, failed }
}
