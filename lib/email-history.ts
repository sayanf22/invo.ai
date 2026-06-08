/**
 * Reconstructs a user's email history directly from Brevo webhook events
 * (`email_events`), grouped by `message_id`.
 *
 * Why this approach: every email Brevo sends has a unique message_id, and ALL
 * of its lifecycle events (request → delivered → opened → clicked) carry that
 * same id plus the real subject. Grouping by message_id gives us the actual,
 * authoritative record of what was sent and whether it was opened — with no
 * guessing of subjects (which is fragile because automation subjects change).
 */

export interface RawEmailEvent {
  message_id: string | null
  event: string
  subject: string | null
  tag: string | null
  event_at: string
}

export interface EmailHistoryEntry {
  kind: "auto" | "manual"
  label: string
  subject: string | null
  sent_at: string
  delivered: boolean
  open_count: number
  click_count: number
  opens: string[]          // open timestamps, ascending
  last_opened_at: string | null
}

/** A manual 1:1 admin email is tagged from the dashboard send path. */
function isManualTag(tag: string | null): boolean {
  if (!tag) return false
  return /admin|dashboard|direct/i.test(tag)
}

/** Diagnostic/test emails we don't want cluttering real history. */
function isDiagnosticTag(tag: string | null): boolean {
  if (!tag) return false
  return /diagnostic|test/i.test(tag)
}

interface Group {
  subject: string | null
  tag: string | null
  sent_at: string
  delivered: boolean
  open_count: number
  click_count: number
  opens: string[]
}

/**
 * Build the de-duplicated, newest-first email history for a single user
 * from their raw email_events. Each entry is one real email (one message_id).
 */
export function buildEmailHistory(events: RawEmailEvent[], includeDiagnostics = false): EmailHistoryEntry[] {
  const groups = new Map<string, Group>()

  for (const ev of events) {
    if (!includeDiagnostics && isDiagnosticTag(ev.tag)) continue
    // Group by message_id; fall back to subject+timestamp for rare null-id events
    const key = ev.message_id || `${ev.subject ?? ""}|${ev.event_at}`
    const g = groups.get(key) ?? {
      subject: ev.subject ?? null,
      tag: ev.tag ?? null,
      sent_at: ev.event_at,
      delivered: false,
      open_count: 0,
      click_count: 0,
      opens: [],
    }
    // earliest event = send time
    if (new Date(ev.event_at).getTime() < new Date(g.sent_at).getTime()) g.sent_at = ev.event_at
    if (!g.subject && ev.subject) g.subject = ev.subject
    if (!g.tag && ev.tag) g.tag = ev.tag

    switch (ev.event) {
      case "opened":
      case "uniqueOpened":
        g.open_count += 1
        g.opens.push(ev.event_at)
        break
      case "click":
        g.click_count += 1
        break
      case "delivered":
        g.delivered = true
        break
    }
    groups.set(key, g)
  }

  const entries: EmailHistoryEntry[] = []
  for (const g of groups.values()) {
    const manual = isManualTag(g.tag)
    g.opens.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    entries.push({
      kind: manual ? "manual" : "auto",
      label: manual ? "Direct email" : "Lifecycle email",
      subject: g.subject,
      sent_at: g.sent_at,
      delivered: g.delivered,
      open_count: g.open_count,
      click_count: g.click_count,
      opens: g.opens,
      last_opened_at: g.opens.length > 0 ? g.opens[g.opens.length - 1] : null,
    })
  }

  return entries.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
}
