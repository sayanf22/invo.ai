"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Mail, RefreshCw, Eye, Send, AlertTriangle,
  CheckCircle, X, Search, ChevronDown, Users,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useAdminTheme } from "@/components/admin/admin-theme-provider"
import KpiCard from "@/components/admin/kpi-card"
import DataTable from "@/components/admin/data-table"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string; segment: string; subject: string
  emails_sent: number; emails_failed: number
  sent_by: string; sent_at: string
}

interface UserOption {
  id: string; email: string; name: string | null
  onboarding_complete: boolean; last_active_at: string | null
}

interface EmailEvent {
  id: string; email: string; event: string; subject: string | null
  tag: string | null; event_at: string; reason: string | null; user_id: string | null
}

interface Props {
  campaigns: Campaign[]
  segmentCounts: { dropoff: number; inactive7: number; inactive14: number; allActive: number }
  emailSummary: Record<string, number>
  recentEvents: EmailEvent[]
  users: UserOption[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function statusBadge(event: string, isDark: boolean) {
  const map: Record<string, [string, string]> = {
    delivered:    ["#059669", "#F0FDF4"],
    opened:       ["#7C3AED", "#F5F3FF"],
    click:        ["#D97757", "#FFF7ED"],
    sent:         ["#2563EB", "#EFF6FF"],
    hardBounce:   ["#DC2626", "#FEF2F2"],
    softBounce:   ["#EA580C", "#FFF7ED"],
    spam:         ["#B45309", "#FFFBEB"],
    unsubscribed: ["#6B7280", "#F9FAFB"],
    blocked:      ["#DC2626", "#FEF2F2"],
  }
  const [color, bg] = map[event] ?? ["#6B7280", isDark ? "#18181B" : "#F9FAFB"]
  return (
    <span style={{ color, background: bg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {event}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailCampaignsClient({
  campaigns: initialCampaigns,
  segmentCounts,
  emailSummary,
  recentEvents,
  users,
}: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === "dark"

  const bg = isDark ? "#000000" : "#F5F5F5"
  const cardBg = isDark ? "#0A0A0A" : "#FAFAFA"
  const border = isDark ? "#1A1A1A" : "#E5E5E5"
  const text = isDark ? "#F5F5F5" : "#0A0A0A"
  const muted = isDark ? "#71717A" : "#71717A"
  const headerBg = isDark ? "#000000" : "#F5F5F5"

  // Segment sync state
  const [syncing, setSyncing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, { synced: number; failed: number; count?: number }>>({})
  const [syncError, setSyncError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState(initialCampaigns)

  // Direct email state
  const [directOpen, setDirectOpen] = useState(false)
  const [directUser, setDirectUser] = useState<UserOption | null>(null)
  const [directSubject, setDirectSubject] = useState("")
  const [directMessage, setDirectMessage] = useState("")
  const [directSending, setDirectSending] = useState(false)
  const [directError, setDirectError] = useState<string | null>(null)
  const [directSuccess, setDirectSuccess] = useState(false)
  const [userSearch, setUserSearch] = useState("")
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const filteredUsers = userSearch.trim().length > 0
    ? users.filter(u =>
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.name ?? "").toLowerCase().includes(userSearch.toLowerCase())
      ).slice(0, 10)
    : users.slice(0, 10)

  // ── Sync ────────────────────────────────────────────────────────────────────

  async function handleDryRun(segmentId: string) {
    setPreviewing(segmentId)
    setSyncError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: segmentId, dryRun: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setSyncResults(prev => ({ ...prev, [`${segmentId}-dry`]: { synced: data.count, failed: 0, count: data.count } }))
    } catch (e: any) {
      setSyncError(e.message)
    } finally { setPreviewing(null) }
  }

  async function handleSync(segmentId: string) {
    if (!confirm(`Sync "${segmentId}" to Brevo? This updates contact lists so automation emails can go out.`)) return
    setSyncing(segmentId)
    setSyncError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: segmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setSyncResults(prev => ({ ...prev, [segmentId]: { synced: data.synced ?? 0, failed: data.failed ?? 0 } }))
      const logRes = await fetch("/api/admin/email-campaigns")
      const logData = await logRes.json()
      if (logData.campaigns) setCampaigns(logData.campaigns)
    } catch (e: any) {
      setSyncError(e.message)
    } finally { setSyncing(null) }
  }

  // ── Direct email ─────────────────────────────────────────────────────────────

  async function handleSendDirect() {
    if (!directUser || !directSubject.trim() || !directMessage.trim()) return
    setDirectSending(true)
    setDirectError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: directUser.id, subject: directSubject.trim(), message: directMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      setDirectSuccess(true)
      setTimeout(() => {
        setDirectOpen(false)
        setDirectUser(null)
        setDirectSubject("")
        setDirectMessage("")
        setDirectSuccess(false)
      }, 1800)
    } catch (e: any) {
      setDirectError(e.message)
    } finally { setDirectSending(false) }
  }

  // ── Segment definitions ──────────────────────────────────────────────────────

  const SEGMENTS = [
    {
      id: "sync-dropoff",
      label: "Onboarding drop-off",
      desc: "Users who signed up but never finished onboarding (idle 2+ days). Syncs to Brevo — automation sends walkthrough email.",
      count: segmentCounts.dropoff,
      color: "#DC2626",
    },
    {
      id: "sync-active",
      label: "Inactive users",
      desc: "Users who completed onboarding but haven't used the app in 7+ days. Syncs LAST_ACTIVE so automation knows when to send.",
      count: segmentCounts.inactive7,
      color: "#D97757",
    },
    {
      id: "sync-all",
      label: "Full backfill",
      desc: "Sync all users to the correct Brevo list. Run once to catch anyone missed. The daily cron at 08:00 UTC handles this automatically.",
      count: segmentCounts.allActive + segmentCounts.dropoff,
      color: "#2563EB",
    },
  ]

  // ── Email event table columns ─────────────────────────────────────────────

  const eventColumns = [
    { key: "email", header: "Recipient", render: (r: any) => <span style={{ fontFamily: "mono", fontSize: 12 }}>{r.email}</span> },
    { key: "event", header: "Event", render: (r: any) => statusBadge(r.event, isDark) },
    { key: "tag", header: "Tag", render: (r: any) => <span style={{ color: muted, fontSize: 12 }}>{r.tag ?? "—"}</span> },
    { key: "subject", header: "Subject", render: (r: any) => <span style={{ color: muted, fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{r.subject ?? "—"}</span> },
    { key: "event_at", header: "When", render: (r: any) => <span style={{ color: muted, fontSize: 12 }}>{formatDistanceToNow(new Date(r.event_at), { addSuffix: true })}</span> },
    { key: "reason", header: "Reason", render: (r: any) => <span style={{ color: "#DC2626", fontSize: 12 }}>{r.reason ?? "—"}</span> },
  ]

  const campaignColumns = [
    { key: "segment", header: "Action", render: (r: any) => <span style={{ fontWeight: 600, fontSize: 13 }}>{r.segment}</span> },
    { key: "emails_sent", header: "Synced", render: (r: any) => <span style={{ color: "#059669", fontWeight: 600 }}>{r.emails_sent}</span> },
    { key: "emails_failed", header: "Failed", render: (r: any) => <span style={{ color: r.emails_failed > 0 ? "#DC2626" : muted, fontWeight: r.emails_failed > 0 ? 600 : 400 }}>{r.emails_failed}</span> },
    { key: "sent_by", header: "By", render: (r: any) => <span style={{ color: muted, fontSize: 12 }}>{r.sent_by}</span> },
    { key: "sent_at", header: "When", render: (r: any) => <span style={{ color: muted, fontSize: 12 }}>{formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}</span> },
  ]

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 32px 64px" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Mail size={20} style={{ color: "#D97757" }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: text, margin: 0 }}>Email Campaigns</h1>
          </div>
          <p style={{ color: muted, fontSize: 13, margin: 0 }}>
            Lifecycle emails via Brevo automation. Daily cron at 08:00 UTC auto-syncs. Use controls below for manual sync or direct 1:1 emails.
          </p>
        </div>
        <button
          onClick={() => setDirectOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 8, border: "none", background: isDark ? "#F5F5F5" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#F5F5F5", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Send size={14} />
          Send direct email
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 32 }}>
        <KpiCard title="Sent (30d)" value={(emailSummary["sent"] ?? 0) + (emailSummary["request"] ?? 0)} />
        <KpiCard title="Delivered" value={emailSummary["delivered"] ?? 0} />
        <KpiCard title="Opened" value={emailSummary["opened"] ?? 0} />
        <KpiCard title="Clicked" value={emailSummary["click"] ?? 0} />
        <KpiCard title="Hard Bounce" value={emailSummary["hardBounce"] ?? 0} />
        <KpiCard title="Spam" value={emailSummary["spam"] ?? 0} />
        <KpiCard title="Unsubscribed" value={emailSummary["unsubscribed"] ?? 0} />
      </div>

      {/* Error */}
      {syncError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 8, background: isDark ? "#1A0000" : "#FEF2F2", border: `1px solid #FECACA`, marginBottom: 20 }}>
          <AlertTriangle size={14} color="#DC2626" />
          <span style={{ color: "#DC2626", fontSize: 13 }}>{syncError}</span>
          <button onClick={() => setSyncError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}><X size={14} color="#DC2626" /></button>
        </div>
      )}

      {/* Segment sync */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: text, margin: "0 0 12px" }}>Brevo List Sync</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SEGMENTS.map(seg => {
            const result = syncResults[seg.id]
            const dryResult = syncResults[`${seg.id}-dry`]
            const isSyncing = syncing === seg.id
            const isPreviewing = previewing === seg.id
            const busy = !!syncing || !!previewing

            return (
              <div key={seg.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{seg.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: seg.color, background: `${seg.color}1A`, padding: "2px 7px", borderRadius: 4 }}>{seg.count}</span>
                    {dryResult && <span style={{ fontSize: 11, color: "#2563EB" }}>Preview: {dryResult.count} users</span>}
                    {result && <span style={{ fontSize: 11, color: "#059669" }}>✓ {result.synced} synced</span>}
                  </div>
                  <p style={{ fontSize: 12, color: muted, margin: 0 }}>{seg.desc}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDryRun(seg.id)}
                    disabled={busy}
                    style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 12, fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Eye size={12} />{isPreviewing ? "..." : "Preview"}
                  </button>
                  <button
                    onClick={() => handleSync(seg.id)}
                    disabled={busy}
                    style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: busy && !isSyncing ? muted : seg.color, color: "#fff", fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy && !isSyncing ? 0.4 : 1, display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <RefreshCw size={12} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
                    {isSyncing ? "Syncing…" : "Sync now"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Email events */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: text, margin: "0 0 12px" }}>Email Events — last 30 days</h2>
        <DataTable
          columns={eventColumns as any}
          data={(recentEvents as any[]).slice(0, 50)}
          emptyState={<p style={{ color: muted, fontSize: 13 }}>No events yet — events appear once Brevo starts sending via automations.</p>}
        />
      </section>

      {/* Campaign log */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: text, margin: "0 0 12px" }}>Activity Log</h2>
        <DataTable
          columns={campaignColumns as any}
          data={campaigns as any[]}
          emptyState={<p style={{ color: muted, fontSize: 13 }}>No activity yet.</p>}
        />
      </section>

      {/* Direct email modal */}
      {directOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setDirectOpen(false) }}
        >
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, width: "100%", maxWidth: 520, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>Send direct email</h2>
              <button onClick={() => setDirectOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color={muted} />
              </button>
            </div>

            {/* User picker */}
            <div style={{ marginBottom: 16, position: "relative" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 6 }}>To</label>
              <div
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onClick={() => setUserDropdownOpen(v => !v)}
              >
                {directUser ? (
                  <span>{directUser.email} {directUser.name ? `(${directUser.name})` : ""}</span>
                ) : (
                  <span style={{ color: muted }}>Select a user…</span>
                )}
                <ChevronDown size={14} color={muted} />
              </div>
              {userDropdownOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, zIndex: 10, marginTop: 4, maxHeight: 280, overflow: "auto" }}>
                  <div style={{ padding: "8px 12px", borderBottom: `1px solid ${border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, background: bg }}>
                      <Search size={12} color={muted} />
                      <input
                        autoFocus
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search email or name…"
                        style={{ border: "none", background: "transparent", fontSize: 12, color: text, outline: "none", flex: 1 }}
                      />
                    </div>
                  </div>
                  {filteredUsers.length === 0 && (
                    <p style={{ padding: "12px 16px", color: muted, fontSize: 12, margin: 0 }}>No users found</p>
                  )}
                  {filteredUsers.map(u => (
                    <div
                      key={u.id}
                      onClick={() => { setDirectUser(u); setUserDropdownOpen(false); setUserSearch("") }}
                      style={{ padding: "10px 16px", cursor: "pointer", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? "#111" : "#f0f0f0")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{u.email}</div>
                        {u.name && <div style={{ fontSize: 11, color: muted }}>{u.name}</div>}
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: u.onboarding_complete ? "#F0FDF4" : "#FEF2F2", color: u.onboarding_complete ? "#059669" : "#DC2626", fontWeight: 600 }}>
                        {u.onboarding_complete ? "active" : "no onboarding"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 6 }}>Subject</label>
              <input
                type="text"
                placeholder="Following up on your Clorefy account"
                value={directSubject}
                onChange={e => setDirectSubject(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, outline: "none" }}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 6 }}>Message</label>
              <textarea
                rows={5}
                placeholder="Write your message here…"
                value={directMessage}
                onChange={e => setDirectMessage(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, outline: "none", resize: "vertical" }}
              />
            </div>

            {directError && (
              <div style={{ color: "#DC2626", fontSize: 12, background: isDark ? "#1A0000" : "#FEF2F2", padding: "8px 12px", borderRadius: 6, marginBottom: 14 }}>{directError}</div>
            )}
            {directSuccess && (
              <div style={{ color: "#059669", fontSize: 12, background: "#F0FDF4", padding: "8px 12px", borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={13} /> Email sent successfully
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setDirectOpen(false)}
                style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendDirect}
                disabled={!directUser || !directSubject.trim() || !directMessage.trim() || directSending}
                style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (!directUser || !directSubject.trim() || !directMessage.trim() || directSending) ? muted : isDark ? "#F5F5F5" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#F5F5F5", fontSize: 13, fontWeight: 600, cursor: (!directUser || !directSubject.trim() || !directMessage.trim() || directSending) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}
              >
                <Send size={13} />{directSending ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
