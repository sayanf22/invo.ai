/**
 * Brevo integration — contact sync & lifecycle email automation.
 *
 * ARCHITECTURE — READ BEFORE MODIFYING:
 *
 * Re-engagement and drop-off emails go through Brevo AUTOMATIONS (list-based
 * workflows), NOT the transactional SMTP API. Reasons:
 *   1. Brevo ToS: transactional API is for triggered 1:1 emails (order confirm,
 *      password reset). Using it for bulk marketing is a ToS violation.
 *   2. CAN-SPAM / GDPR: marketing/lifecycle emails require unsubscribe links.
 *      Brevo automations add these automatically; raw SMTP does not.
 *   3. Gmail/Yahoo 2024 enforcement: bulk senders must support one-click
 *      unsubscribe. Automation handles this; raw API does not.
 *
 * The admin "Email Campaigns" dashboard triggers automation by MOVING contacts
 * into the correct Brevo list. The automation workflow then fires.
 *
 * The transactional SMTP API is used ONLY for:
 *   - Admin sending a direct 1:1 message to a specific user from the dashboard
 *   - This is clearly admin-to-user communication, not marketing
 *
 * All calls use plain fetch() — works in Cloudflare Workers edge runtime.
 * Env vars are read INSIDE functions — safe for Cloudflare Workers.
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

/** Brevo REST API wrapper — logs errors, never throws */
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

// ── Contact sync — keeps lists accurate so automations fire correctly ─────────

/**
 * Called on every login.
 * Creates or updates the Brevo contact and places them in the right list
 * so the correct automation workflow fires.
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
  const today = new Date().toISOString().split("T")[0]
  const { onboardingListId, activeListId } = cfg()

  const attributes: Record<string, unknown> = {
    LAST_ACTIVE: today,
  }
  if (firstName && typeof firstName === "string") {
    attributes.FIRSTNAME = firstName.slice(0, 64)
  }
  if (signupAt && typeof signupAt === "string") {
    attributes.SIGNUP_AT = signupAt.split("T")[0]
  }
  if (!onboardingComplete) {
    attributes.ONBOARDING_COMPLETE = false
  }

  const listIds =
    onboardingComplete
      ? [activeListId]
      : isNewUser
      ? [onboardingListId]
      : undefined

  await brevoCall("POST", "/contacts", {
    email,
    ...(listIds ? { listIds } : {}),
    updateEnabled: true,
    attributes,
  })
}

/**
 * Called when onboarding completes.
 * Moves contact to Active Users list → triggers inactivity automation.
 * Removes from Onboarding list → stops drop-off automation.
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

  // Correct Brevo v3 endpoint to remove from a list
  await brevoCall(
    "POST",
    `/contacts/lists/${onboardingListId}/contacts/remove`,
    { emails: [email] }
  )
}

/**
 * Updates LAST_ACTIVE date — keeps automation inactivity timer accurate.
 */
export async function updateLastActive(email: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]
  await brevoCall("PUT", `/contacts/${encodeURIComponent(email)}`, {
    attributes: { LAST_ACTIVE: today },
  })
}

// ── Transactional email — 1:1 admin-to-user messages ONLY ────────────────────

export interface TransactionalEmailParams {
  to: string
  toName?: string
  subject: string
  htmlContent: string
  replyTo?: string
  tags?: string[]
}

/**
 * Sends a single transactional email.
 * Use ONLY for direct admin-to-user messages from the dashboard.
 * NOT for bulk campaigns — those go through Brevo Automations.
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

// ── Brevo list management for cron-based automation sync ──────────────────────

export interface BulkEmailContact {
  email: string
  name?: string
}

/**
 * Re-adds a contact to the Onboarding Started list if they dropped off.
 * This re-triggers the drop-off automation for contacts who are already
 * in Brevo but fell out of the list tracking.
 *
 * Called by the daily cron job — not by user-facing code.
 */
export async function addToOnboardingList(contact: BulkEmailContact): Promise<boolean> {
  const { onboardingListId } = cfg()
  const today = new Date().toISOString().split("T")[0]

  const result = await brevoCall("POST", "/contacts", {
    email: contact.email,
    listIds: [onboardingListId],
    updateEnabled: true,
    attributes: {
      ONBOARDING_COMPLETE: false,
      ...(contact.name ? { FIRSTNAME: contact.name.slice(0, 64) } : {}),
      LAST_ACTIVE: today,
    },
  })
  return result.ok
}

/**
 * Get count of contacts in a Brevo list.
 * Used by admin dashboard.
 */
export async function getListContactCount(listId: number): Promise<number> {
  const result = await brevoCall("GET", `/contacts/lists/${listId}`)
  if (!result.ok || !result.json) return 0
  const data = result.json as Record<string, unknown>
  return Number(data.totalSubscribers ?? 0)
}

/**
 * Check if a contact is in the Brevo blocklist (unsubscribed or hard-bounced).
 * Returns true if they're blocked and should NOT receive any emails.
 */
export async function isContactBlocked(email: string): Promise<boolean> {
  const result = await brevoCall(
    "GET",
    `/smtp/blockedContacts?email=${encodeURIComponent(email)}&limit=1`
  )
  if (!result.ok || !result.json) return false
  const data = result.json as Record<string, unknown>
  const contacts = data.contacts as unknown[]
  return Array.isArray(contacts) && contacts.length > 0
}
