"use client"

import { useState, useMemo } from "react"
import { Mail, Send, X, Search, CheckCircle, AlertTriangle, ChevronDown } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useAdminTheme } from "@/components/admin/admin-theme-provider"
import KpiCard from "@/components/admin/kpi-card"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SentEmail { email_type: string; sent_at: string }
interface LastEmailEvent { event: string; event_at: string }

interface UserRow {
  id: string; email: string; name: string | null
  onboarding_complete: boolean; last_active_at: string | null; created_at: string
  tier: string; days_since_active: number; days_since_signup: number
  docs_count: number; sent_emails: SentEmail[]; last_email_event: LastEmailEvent | null
  category: string; never_emailed: boolean
}

interface EmailEvent {
  id: string; email: string; event: string; subject: string | null
  tag: string | null; event_at: string; reason: string | null; user_id: string | null
}

interface Campaign {
  id: string; segment: string; subject: string
  emails_sent: number; emails_failed: number; sent_by: string; sent_at: string
}

interface Props {
  users: UserRow[]
  campaigns: Campaign[]
  emailSummary: Record<string, number>
  recentEvents: EmailEvent[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  dropoff: "Onboarding drop-off",
  inactive: "Inactive 7d+",
  active: "Active",
}

const CATEGORY_COLOR: Record<string, string> = {
  dropoff: "#DC2626",
  inactive: "#D97757",
  active: "#059669",
}

const EVENT_COLOR: Record<string, [string, string]> = {
  delivered: ["#059669", "#F0FDF4"],
  opened:    ["#7C3AED", "#F5F3FF"],
  click:     ["#D97757", "#FFF7ED"],
  sent:      ["#2563EB", "#EFF6FF"],
  hardBounce:["#DC2626", "#FEF2F2"],
  softBounce:["#EA580C", "#FFF7ED"],
  spam:      ["#B45309", "#FFFBEB"],
  unsubscribed:["#6B7280", "#F9FAFB"],
  blocked:   ["#DC2626", "#FEF2F2"],
}

function emailEventBadge(event: string) {
  const [color, bg] = EVENT_COLOR[event] ?? ["#6B7280", "#F9FAFB"]
  return <span style={{ color, background: bg, padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{event}</span>
}

function emailTypeBadge(type: string) {
  const labels: Record<string, string> = {
    dropoff_1: "Drop-off #1", dropoff_2: "Drop-off #2",
    inactive_1: "Inactive #1", inactive_2: "Inactive #2",
  }
  return <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#F0F0F0", color: "#555" }}>{labels[type] ?? type}</span>
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EmailCampaignsClient({ users, campaigns, emailSummary, recentEvents }: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === "dark"

  const bg = isDark ? "#000" : "#F5F5F5"
  const cardBg = isDark ? "#0A0A0A" : "#FAFAFA"
  const border = isDark ? "#1A1A1A" : "#E5E5E5"
  const text = isDark ? "#F5F5F5" : "#0A0A0A"
  const muted = isDark ? "#71717A" : "#71717A"
  const rowHover = isDark ? "#111" : "#F0F0F0"

  // Filters
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<"all" | "dropoff" | "inactive" | "active">("all")
  const [filterEmailed, setFilterEmailed] = useState<"all" | "emailed" | "never">("all")
  const [activeTab, setActiveTab] = useState<"users" | "events">("users")

  // Email modal state
  const [modalUser, setModalUser] = useState<UserRow | null>(null)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiTone, setAiTone] = useState<"friendly" | "professional" | "urgent">("friendly")
  const [aiIntent, setAiIntent] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Filtered users
  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filterCategory !== "all" && u.category !== filterCategory) return false
      if (filterEmailed === "emailed" && u.never_emailed) return false
      if (filterEmailed === "never" && !u.never_emailed) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!u.email.toLowerCase().includes(q) && !(u.name ?? "").toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [users, filterCategory, filterEmailed, search])

  // Stats
  const dropoffCount = users.filter(u => u.category === "dropoff").length
  const inactiveCount = users.filter(u => u.category === "inactive").length
  const neverEmailedCount = users.filter(u => u.never_emailed).length

  // Open email modal
  function openEmail(user: UserRow) {
    setModalUser(user)
    setSubject("")
    setMessage("")
    setSendError(null)
    setSendSuccess(false)
    setAiIntent("")
  }

  // AI generate
  async function handleAiGenerate() {
    if (!modalUser) return
    setAiGenerating(true)
    setSendError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: modalUser.id, intent: aiIntent.trim() || undefined, tone: aiTone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI generation failed")
      setSubject(data.subject ?? "")
      setMessage(data.message ?? "")
    } catch (e: any) {
      setSendError(e.message)
    } finally { setAiGenerating(false) }
  }

  // Send email
  async function handleSend() {
    if (!modalUser || !subject.trim() || !message.trim()) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: modalUser.id, subject: subject.trim(), message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setSendSuccess(true)
      setTimeout(() => { setModalUser(null); setSendSuccess(false) }, 1600)
    } catch (e: any) {
      setSendError(e.message)
    } finally { setSending(false) }
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, padding: "32px 32px 64px" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          <Mail size={20} color="#D97757" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: text, margin: 0 }}>Email Outreach</h1>
        </div>
        <p style={{ color: muted, fontSize: 13, margin: 0 }}>
          All your users, their email history, and what was sent. Click any row to send a direct email.
          Lifecycle emails (drop-off, inactivity) run automatically via Brevo at 08:00 UTC daily.
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard title="Total users" value={users.length} />
        <KpiCard title="Drop-off" value={dropoffCount} description="Didn't finish onboarding" />
        <KpiCard title="Inactive 7d+" value={inactiveCount} description="Completed but idle" />
        <KpiCard title="Never emailed" value={neverEmailedCount} description="No lifecycle email yet" />
        <KpiCard title="Delivered (30d)" value={emailSummary["delivered"] ?? 0} />
        <KpiCard title="Opened (30d)" value={emailSummary["opened"] ?? 0} />
        <KpiCard title="Clicked (30d)" value={emailSummary["click"] ?? 0} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: `1px solid ${border}` }}>
        {(["users", "events"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              background: "transparent", border: "none",
              borderBottom: activeTab === tab ? `2px solid ${text}` : "2px solid transparent",
              color: activeTab === tab ? text : muted,
              cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {tab === "users" ? "Users" : "Email Events"}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${border}`, background: cardBg, flex: "1 1 200px", maxWidth: 300 }}>
              <Search size={13} color={muted} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search email or name…"
                style={{ border: "none", background: "transparent", fontSize: 13, color: text, outline: "none", flex: 1 }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} color={muted} /></button>}
            </div>

            {/* Category filter */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as any)}
              style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, fontSize: 13, cursor: "pointer" }}
            >
              <option value="all">All users ({users.length})</option>
              <option value="dropoff">Drop-off ({dropoffCount})</option>
              <option value="inactive">Inactive 7d+ ({inactiveCount})</option>
              <option value="active">Active</option>
            </select>

            {/* Email filter */}
            <select
              value={filterEmailed}
              onChange={e => setFilterEmailed(e.target.value as any)}
              style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, fontSize: 13, cursor: "pointer" }}
            >
              <option value="all">All email status</option>
              <option value="never">Never emailed ({neverEmailedCount})</option>
              <option value="emailed">Emailed</option>
            </select>

            <span style={{ color: muted, fontSize: 12, marginLeft: "auto" }}>{filtered.length} users</span>
          </div>

          {/* Users table */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 100px 130px 90px 80px", gap: 12, padding: "10px 16px", background: isDark ? "#000" : "#F0F0F0", borderBottom: `1px solid ${border}` }}>
              {["User", "Status", "Inactive", "Docs", "Emails Sent", "Last Event", "Action"].map(h => (
                <span key={h} style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: "32px", textAlign: "center", color: muted, fontSize: 13 }}>No users match your filters</div>
            )}

            {filtered.map((u, i) => (
              <div
                key={u.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 90px 100px 130px 90px 80px",
                  gap: 12, padding: "11px 16px", alignItems: "center",
                  borderTop: i > 0 ? `1px solid ${border}` : "none",
                  cursor: "pointer", transition: "background 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
                onClick={() => openEmail(u)}
              >
                {/* User */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                  {u.name && <div style={{ fontSize: 11, color: muted }}>{u.name}</div>}
                </div>

                {/* Status badge */}
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: CATEGORY_COLOR[u.category], background: `${CATEGORY_COLOR[u.category]}18`, padding: "2px 7px", borderRadius: 4 }}>
                    {u.category === "dropoff" ? "Drop-off" : u.category === "inactive" ? "Inactive" : "Active"}
                  </span>
                </div>

                {/* Days idle */}
                <div style={{ fontSize: 12, color: u.days_since_active >= 7 ? "#D97757" : muted }}>{u.days_since_active}d</div>

                {/* Docs count */}
                <div style={{ fontSize: 12, color: u.docs_count > 0 ? text : muted }}>{u.docs_count} doc{u.docs_count !== 1 ? "s" : ""}</div>

                {/* Emails sent */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {u.sent_emails.length === 0
                    ? <span style={{ fontSize: 11, color: muted }}>None</span>
                    : u.sent_emails.map((s, j) => (
                      <span key={j} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: isDark ? "#1A1A1A" : "#E5E5E5", color: muted }}>{s.email_type.replace("_", " #")}</span>
                    ))
                  }
                </div>

                {/* Last event */}
                <div>
                  {u.last_email_event
                    ? emailEventBadge(u.last_email_event.event)
                    : <span style={{ fontSize: 11, color: muted }}>—</span>
                  }
                </div>

                {/* Action button */}
                <button
                  onClick={e => { e.stopPropagation(); openEmail(u) }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <Mail size={11} /> Email
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px 150px 100px 120px", gap: 12, padding: "10px 16px", background: isDark ? "#000" : "#F0F0F0", borderBottom: `1px solid ${border}` }}>
            {["Recipient", "Event", "Tag", "Subject", "Reason", "When"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</span>
            ))}
          </div>
          {recentEvents.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: muted, fontSize: 13 }}>
              No email events yet. Events appear here once Brevo automations start sending.
            </div>
          )}
          {recentEvents.map((ev, i) => (
            <div key={ev.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px 150px 100px 120px", gap: 12, padding: "10px 16px", borderTop: i > 0 ? `1px solid ${border}` : "none", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.email}</span>
              <span>{emailEventBadge(ev.event)}</span>
              <span style={{ fontSize: 11, color: muted }}>{ev.tag ?? "—"}</span>
              <span style={{ fontSize: 12, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.subject ?? "—"}</span>
              <span style={{ fontSize: 11, color: "#DC2626" }}>{ev.reason ?? "—"}</span>
              <span style={{ fontSize: 11, color: muted, whiteSpace: "nowrap" }}>{formatDistanceToNow(new Date(ev.event_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── EMAIL MODAL ── */}
      {modalUser && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalUser(null) }}
        >
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, width: "100%", maxWidth: 540, padding: 28, maxHeight: "90vh", overflow: "auto" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 2px" }}>Email {modalUser.name ?? modalUser.email}</h2>
                <p style={{ color: muted, fontSize: 12, margin: 0 }}>{modalUser.email}</p>
              </div>
              <button onClick={() => setModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color={muted} />
              </button>
            </div>

            {/* User KPIs */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18, padding: "12px 14px", borderRadius: 8, background: isDark ? "#0A0A0A" : "#F0F0F0", border: `1px solid ${border}` }}>
              {[
                { label: "Status", value: CATEGORY_LABEL[modalUser.category] ?? modalUser.category, color: CATEGORY_COLOR[modalUser.category] },
                { label: "Idle", value: `${modalUser.days_since_active}d`, color: undefined },
                { label: "Docs", value: String(modalUser.docs_count), color: undefined },
                { label: "Tier", value: modalUser.tier, color: undefined },
                { label: "Emails", value: modalUser.sent_emails.length === 0 ? "None sent" : modalUser.sent_emails.map(s => s.email_type.replace("_", " #")).join(", "), color: undefined },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <span style={{ fontSize: 11, color: muted }}>{label}: </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: color ?? text }}>{value}</span>
                </div>
              ))}
            </div>

            {/* AI section */}
            <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 10, border: `1px solid ${border}`, background: isDark ? "#050505" : "#FAFAFA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>✨ AI Draft</span>
                <span style={{ fontSize: 11, color: muted }}>Generates using this user's real data</span>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["friendly", "professional", "urgent"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setAiTone(t)}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${aiTone === t ? "#7C3AED" : border}`, background: aiTone === t ? "#7C3AED" : "transparent", color: aiTone === t ? "#fff" : muted, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <input
                type="text"
                placeholder="Optional: "came back after 2 weeks" or "never tried the app""
                value={aiIntent}
                onChange={e => setAiIntent(e.target.value)}
                maxLength={300}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${border}`, background: bg, color: text, fontSize: 12, outline: "none", marginBottom: 10 }}
              />

              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating}
                style={{ width: "100%", padding: "9px", borderRadius: 7, border: "none", background: aiGenerating ? muted : "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 600, cursor: aiGenerating ? "not-allowed" : "pointer" }}
              >
                {aiGenerating ? "Generating…" : "Generate subject + message →"}
              </button>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 5 }}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Quick check-in from Clorefy"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, outline: "none" }}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: muted, display: "block", marginBottom: 5 }}>Message</label>
              <textarea
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Write your message — or use AI Draft above"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: text, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.6 }}
              />
            </div>

            {sendError && (
              <div style={{ color: "#DC2626", fontSize: 12, background: "#FEF2F2", padding: "8px 12px", borderRadius: 6, marginBottom: 14 }}>{sendError}</div>
            )}
            {sendSuccess && (
              <div style={{ color: "#059669", fontSize: 12, background: "#F0FDF4", padding: "8px 12px", borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={13} /> Email sent to {modalUser.email}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setModalUser(null)}
                style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: text, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim() || sending}
                style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (!subject.trim() || !message.trim() || sending) ? muted : isDark ? "#F5F5F5" : "#0A0A0A", color: isDark ? "#0A0A0A" : "#F5F5F5", fontSize: 13, fontWeight: 600, cursor: (!subject.trim() || !message.trim() || sending) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}
              >
                <Send size={13} />{sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
