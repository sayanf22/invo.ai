"use client"

import { useState } from "react"
import { Mail, RefreshCw, Users, CheckCircle, AlertCircle, Loader2, Eye, Send, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useAdminTheme } from "@/components/admin/admin-theme-provider"

interface Campaign {
  id: string
  segment: string
  subject: string
  emails_sent: number
  emails_failed: number
  sent_by: string
  sent_at: string
}

interface SegmentCounts {
  dropoff: number
  inactive7: number
  inactive14: number
  allActive: number
}

interface Props {
  campaigns: Campaign[]
  segmentCounts: SegmentCounts
}

// ── Segment sync actions ──────────────────────────────────────────────────────
// These sync users to Brevo lists → Brevo automations send the emails.
// We do NOT send bulk emails directly — that would violate Brevo ToS & CAN-SPAM.

const SEGMENTS = [
  {
    id: "sync-dropoff",
    label: "Sync onboarding drop-off users",
    description: "Adds users who never completed onboarding (idle 2+ days) to the 'Onboarding Started' Brevo list. The Brevo automation workflow then sends them the video walkthrough email with a proper unsubscribe link.",
    countKey: "dropoff" as keyof SegmentCounts,
    automationNote: "Triggers: Brevo 'Onboarding Started' automation (Email 1 + Email 2)",
    color: "#DC2626",
  },
  {
    id: "sync-active",
    label: "Sync active users",
    description: "Adds completed-onboarding users to the 'Active Users' Brevo list with updated LAST_ACTIVE date. If they've been inactive 7+ days, Brevo's automation sends a re-engagement email.",
    countKey: "allActive" as keyof SegmentCounts,
    automationNote: "Triggers: Brevo 'Active Users' automation (Day 7 + Day 14 inactivity)",
    color: "#2563EB",
  },
  {
    id: "sync-all",
    label: "Full backfill sync",
    description: "Syncs ALL users to the correct Brevo list. Run once to catch anyone who was missed. Safe to run anytime — idempotent upsert.",
    countKey: "allActive" as keyof SegmentCounts,
    automationNote: "Syncs all users. Daily cron does this automatically at 08:00 UTC.",
    color: "#059669",
  },
]

// ── Direct message state ──────────────────────────────────────────────────────

interface DirectMessageState {
  userId: string
  email: string
  name: string
  subject: string
  message: string
}

export default function EmailCampaignsClient({ campaigns: initialCampaigns, segmentCounts }: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === "dark"

  const [syncing, setSyncing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { synced: number; failed: number; count?: number } | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [campaignLog, setCampaignLog] = useState<Campaign[]>(initialCampaigns)

  // Direct message modal state
  const [directMsg, setDirectMsg] = useState<DirectMessageState | null>(null)
  const [sendingDirect, setSendingDirect] = useState(false)
  const [directError, setDirectError] = useState<string | null>(null)
  const [directSuccess, setDirectSuccess] = useState(false)

  const bg = isDark ? "#0D0D0D" : "#F9F8F6"
  const cardBg = isDark ? "#141414" : "#FFFFFF"
  const border = isDark ? "#222" : "#E5E3DE"
  const text = isDark ? "#F3F4F6" : "#111827"
  const muted = isDark ? "#6B7280" : "#9CA3AF"

  async function handleDryRun(segmentId: string) {
    setPreviewing(segmentId)
    setError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: segmentId, dryRun: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setResults((prev) => ({ ...prev, [`${segmentId}-dry`]: { synced: data.count, failed: 0, count: data.count } }))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPreviewing(null)
    }
  }

  async function handleSync(segmentId: string) {
    if (!confirm(`Sync "${segmentId}" contacts to Brevo? Brevo automations will send emails to qualifying users.`)) return
    setSyncing(segmentId)
    setError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: segmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setResults((prev) => ({ ...prev, [segmentId]: { synced: data.synced ?? 0, failed: data.failed ?? 0 } }))

      // Refresh log
      const logRes = await fetch("/api/admin/email-campaigns")
      const logData = await logRes.json()
      if (logData.campaigns) setCampaignLog(logData.campaigns)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSyncing(null)
    }
  }

  async function handleSendDirect() {
    if (!directMsg) return
    setSendingDirect(true)
    setDirectError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: directMsg.userId,
          subject: directMsg.subject,
          message: directMsg.message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setDirectSuccess(true)
      setTimeout(() => {
        setDirectMsg(null)
        setDirectSuccess(false)
      }, 2000)
    } catch (e: any) {
      setDirectError(e.message)
    } finally {
      setSendingDirect(false)
    }
  }

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isDark ? "#1A1A1A" : "#F0EDEA", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={20} color="#D97757" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: text, margin: 0 }}>Email Campaigns</h1>
          </div>
          <p style={{ color: muted, fontSize: 14, margin: 0 }}>
            Sync users to Brevo contact lists. Brevo automations handle email delivery with proper unsubscribe links (required by Gmail/Yahoo/Outlook).
          </p>
        </div>

        {/* How it works banner */}
        <div style={{ background: isDark ? "#1A1A1A" : "#EFF6FF", border: `1.5px solid ${isDark ? "#333" : "#BFDBFE"}`, borderRadius: 12, padding: "14px 18px", marginBottom: 28 }}>
          <p style={{ color: isDark ? "#93C5FD" : "#1D4ED8", fontSize: 13, margin: 0, fontWeight: 600 }}>
            ℹ️ How this works
          </p>
          <p style={{ color: isDark ? "#6B7280" : "#3B82F6", fontSize: 13, margin: "4px 0 0", lineHeight: 1.6 }}>
            Clicking "Sync" updates Brevo contact lists. Brevo's pre-built automation workflows then send emails at the right time — not this dashboard. 
            You must build the 2 automation workflows in <a href="https://app.brevo.com" target="_blank" rel="noopener noreferrer" style={{ color: "#D97757" }}>app.brevo.com → Automations</a> for emails to go out.
            The daily cron at 08:00 UTC auto-syncs all users.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} color="#DC2626" />
            <span style={{ color: "#DC2626", fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* Segment sync cards */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 16 }}>List Sync</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SEGMENTS.map((seg) => {
              const count = segmentCounts[seg.countKey]
              const result = results[seg.id]
              const dryResult = results[`${seg.id}-dry`]
              const isSyncing = syncing === seg.id
              const isPreviewing = previewing === seg.id

              return (
                <div key={seg.id} style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{seg.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: seg.color, background: `${seg.color}18`, padding: "2px 8px", borderRadius: 6 }}>
                          {count} users
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: muted, margin: "0 0 4px", lineHeight: 1.5 }}>{seg.description}</p>
                      <p style={{ fontSize: 12, color: isDark ? "#4B5563" : "#9CA3AF", margin: 0, fontStyle: "italic" }}>{seg.automationNote}</p>

                      {dryResult && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#2563EB", background: "#EFF6FF", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
                          👁 Dry run: {dryResult.count} users would be synced
                        </div>
                      )}
                      {result && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#059669", background: "#F0FDF4", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
                          <CheckCircle size={13} style={{ display: "inline", marginRight: 4 }} />
                          Synced: {result.synced} · Failed: {result.failed}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleDryRun(seg.id)}
                        disabled={!!syncing || !!previewing}
                        style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${border}`, background: "transparent", color: text, fontSize: 13, fontWeight: 500, cursor: syncing || previewing ? "not-allowed" : "pointer", opacity: syncing || previewing ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {isPreviewing ? <Loader2 size={13} /> : <Eye size={13} />}
                        Dry run
                      </button>
                      <button
                        onClick={() => handleSync(seg.id)}
                        disabled={!!syncing || !!previewing}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: isSyncing ? "#9CA3AF" : seg.color, color: "#fff", fontSize: 13, fontWeight: 600, cursor: syncing || previewing ? "not-allowed" : "pointer", opacity: syncing && !isSyncing ? 0.5 : 1, display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {isSyncing ? <Loader2 size={13} /> : <RefreshCw size={13} />}
                        {isSyncing ? "Syncing..." : "Sync"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Direct email to user */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 8 }}>Direct Email to User</h2>
          <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>Send a direct 1:1 message to a specific user from the admin. Uses the transactional API correctly — not bulk.</p>
          <div style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "20px" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 4 }}>User Email</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color: text, fontSize: 14 }}
                  onChange={(e) => setDirectMsg((prev) => prev ? { ...prev, email: e.target.value } : { userId: "", email: e.target.value, name: "", subject: "", message: "" })}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 4 }}>Subject</label>
                <input
                  type="text"
                  placeholder="Following up on your Clorefy account"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color: text, fontSize: 14 }}
                  value={directMsg?.subject ?? ""}
                  onChange={(e) => setDirectMsg((prev) => prev ? { ...prev, subject: e.target.value } : { userId: "", email: "", name: "", subject: e.target.value, message: "" })}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 4 }}>Message</label>
                <textarea
                  rows={5}
                  placeholder="Write your message here..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${border}`, background: bg, color: text, fontSize: 14, resize: "vertical" }}
                  value={directMsg?.message ?? ""}
                  onChange={(e) => setDirectMsg((prev) => prev ? { ...prev, message: e.target.value } : { userId: "", email: "", name: "", subject: "", message: e.target.value })}
                />
              </div>
              {directError && (
                <div style={{ color: "#DC2626", fontSize: 13, background: "#FEF2F2", padding: "8px 12px", borderRadius: 8 }}>{directError}</div>
              )}
              {directSuccess && (
                <div style={{ color: "#059669", fontSize: 13, background: "#F0FDF4", padding: "8px 12px", borderRadius: 8 }}>
                  <CheckCircle size={13} style={{ display: "inline", marginRight: 4 }} />Email sent successfully
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <DirectSendButton
                  email={directMsg?.email ?? ""}
                  subject={directMsg?.subject ?? ""}
                  message={directMsg?.message ?? ""}
                  onSend={handleSendDirect}
                  sending={sendingDirect}
                  border={border}
                  text={text}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Campaign history */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 16 }}>Activity Log</h2>
          {campaignLog.length === 0 ? (
            <div style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
              <Mail size={32} color={muted} style={{ marginBottom: 12 }} />
              <p style={{ color: muted, fontSize: 14 }}>No activity yet.</p>
            </div>
          ) : (
            <div style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {["Action", "Note", "Synced", "Failed", "By", "When"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: muted, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignLog.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < campaignLog.length - 1 ? `1px solid ${border}` : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: text, fontWeight: 500 }}>{c.segment}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</td>
                      <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>{c.emails_sent}</span></td>
                      <td style={{ padding: "12px 16px" }}><span style={{ fontSize: 13, fontWeight: 600, color: c.emails_failed > 0 ? "#DC2626" : muted }}>{c.emails_failed}</span></td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted }}>{c.sent_by}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted, whiteSpace: "nowrap" }}>{formatDistanceToNow(new Date(c.sent_at), { addSuffix: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cron status note */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: isDark ? "#1A1A1A" : "#F0EDEA", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: muted, marginBottom: 4, fontWeight: 600 }}>⏰ Automated daily sync</p>
          <p style={{ fontSize: 13, color: muted, margin: 0 }}>
            Supabase pg_cron runs a full sync every day at 08:00 UTC. This keeps Brevo lists up to date automatically. 
            Free Brevo plan: 300 emails/day via automations. Current users: ~17.
          </p>
        </div>

      </div>

      {/* Direct email user lookup helper */}
      {directMsg && directMsg.email && !directMsg.userId && (
        <UserLookup
          email={directMsg.email}
          onFound={(userId, name) => setDirectMsg((prev) => prev ? { ...prev, userId, name } : null)}
          border={border}
        />
      )}
    </div>
  )
}

// ── Helper: Send button with validation ───────────────────────────────────────

function DirectSendButton({
  email, subject, message, onSend, sending, border, text
}: {
  email: string; subject: string; message: string; onSend: () => void; sending: boolean; border: string; text: string
}) {
  const valid = email.includes("@") && subject.trim().length >= 3 && message.trim().length >= 10
  return (
    <button
      onClick={onSend}
      disabled={!valid || sending}
      style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: valid && !sending ? "#1C1A17" : "#9CA3AF", color: "#fff", fontSize: 14, fontWeight: 600, cursor: valid && !sending ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 8 }}
    >
      {sending ? <Loader2 size={14} /> : <Send size={14} />}
      {sending ? "Sending..." : "Send email"}
    </button>
  )
}

// ── Helper: look up user ID from email ────────────────────────────────────────

function UserLookup({ email, onFound, border }: { email: string; onFound: (id: string, name: string) => void; border: string }) {
  const [checking, setChecking] = useState(false)

  async function lookup() {
    if (!email.includes("@")) return
    setChecking(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}&pageSize=1`)
      const data = await res.json()
      const user = data.users?.[0]
      if (user) onFound(user.id, user.full_name || "")
    } catch { /* ignore */ }
    finally { setChecking(false) }
  }

  return (
    <button
      onClick={lookup}
      disabled={checking}
      style={{ position: "fixed", bottom: 24, right: 24, padding: "10px 16px", borderRadius: 8, border: `1.5px solid ${border}`, background: "#fff", color: "#111827", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
    >
      {checking ? <Loader2 size={13} /> : null}
      Look up user ID
    </button>
  )
}
