"use client"

import { useState, useMemo } from "react"
import { Mail, Send, X, Search, CheckCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useAdminTheme } from "@/components/admin/admin-theme-provider"
import { useIsMobile } from "@/hooks/use-mobile"
import KpiCard from "@/components/admin/kpi-card"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SentEmail { email_type: string; sent_at: string }
interface LastEmailEvent { event: string; event_at: string }

interface UserRow {
  id: string; email: string; name: string | null
  onboarding_complete: boolean; last_active_at: string | null; created_at: string
  tier: string; days_since_active: number; days_since_signup: number
  docs_count: number; sent_emails: SentEmail[]; last_email_event: LastEmailEvent | null
  category: string; never_emailed: boolean; auto_stopped: boolean
  // Send breakdown
  auto_sent_count: number; manual_sent_count: number; total_sent_count: number
  last_manual_sent_at: string | null
  // Engagement (last 30 days)
  opened: boolean; open_count: number; delivered_count: number; clicked_count: number
  bounced: boolean; last_opened_at: string | null
}

interface EmailEvent {
  id: string; email: string; event: string; subject: string | null
  tag: string | null; event_at: string; reason: string | null; user_id: string | null
}

interface Props {
  users: UserRow[]
  campaigns: any[]
  emailSummary: Record<string, number>
  recentEvents: EmailEvent[]
  sentToday: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  dropoff: "#DC2626", inactive: "#D97757", active: "#059669",
}
const CATEGORY_LABEL: Record<string, string> = {
  dropoff: "Drop-off", inactive: "Inactive", active: "Active",
}
const EVENT_COLOR: Record<string, [string, string]> = {
  delivered: ["#059669","#F0FDF4"], opened: ["#7C3AED","#F5F3FF"],
  click: ["#D97757","#FFF7ED"], sent: ["#2563EB","#EFF6FF"],
  hardBounce: ["#DC2626","#FEF2F2"], softBounce: ["#EA580C","#FFF7ED"],
  spam: ["#B45309","#FFFBEB"], unsubscribed: ["#6B7280","#F9FAFB"],
  blocked: ["#DC2626","#FEF2F2"],
}

function EventBadge({ event }: { event: string }) {
  const [color, bg] = EVENT_COLOR[event] ?? ["#6B7280","#F9FAFB"]
  return (
    <span style={{ color, background: bg, padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      {event}
    </span>
  )
}

/** Compact open/delivery indicator for a user row */
function OpenIndicator({ u }: { u: UserRow }) {
  if (u.never_emailed) return <span style={{ fontSize: 11, color: "#9CA3AF" }}>—</span>
  if (u.opened) {
    return (
      <span style={{ color: "#7C3AED", background: "#F5F3FF", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
        ✓ Opened{u.open_count > 1 ? ` ×${u.open_count}` : ""}
      </span>
    )
  }
  if (u.bounced) {
    return <span style={{ color: "#DC2626", background: "#FEF2F2", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Bounced</span>
  }
  if (u.delivered_count > 0) {
    return <span style={{ color: "#059669", background: "#F0FDF4", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Delivered · not opened</span>
  }
  return <span style={{ color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>Sent</span>
}

/** Sent count chip — auto + manual breakdown */
function SentChip({ u }: { u: UserRow }) {
  if (u.total_sent_count === 0) return <span style={{ fontSize: 11, color: "#9CA3AF" }}>None</span>
  return (
    <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
      <span title="Total emails sent">{u.total_sent_count}</span>
      <span style={{ color: "#9CA3AF", fontWeight: 500 }}> ({u.auto_sent_count} auto · {u.manual_sent_count} manual)</span>
    </span>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function EmailCampaignsClient({ users, campaigns, emailSummary, recentEvents, sentToday }: Props) {
  const { theme } = useAdminTheme()
  const isMobile = useIsMobile()
  const isDark = theme === "dark"

  const cardBg  = isDark ? "#0A0A0A" : "#FAFAFA"
  const border  = isDark ? "#1A1A1A" : "#E5E5E5"
  const text    = isDark ? "#F5F5F5" : "#0A0A0A"
  const muted   = isDark ? "#71717A" : "#71717A"
  const hoverBg = isDark ? "#111111" : "#F0F0F0"
  const inputBg = isDark ? "#000000" : "#FFFFFF"

  // Filters
  const [search, setSearch]           = useState("")
  const [filterCat, setFilterCat]     = useState<"all"|"dropoff"|"inactive"|"active"|"stopped">("all")
  const [filterEmail, setFilterEmail] = useState<"all"|"emailed"|"never"|"opened"|"notopened">("all")
  const [activeTab, setActiveTab]     = useState<"users"|"events">("users")

  // Modal
  const [modalUser, setModalUser]     = useState<UserRow | null>(null)
  const [subject, setSubject]         = useState("")
  const [message, setMessage]         = useState("")
  const [sending, setSending]         = useState(false)
  const [aiGenerating, setAiGen]      = useState(false)
  const [aiTone, setAiTone]           = useState<"friendly"|"professional"|"urgent">("friendly")
  const [aiIntent, setAiIntent]       = useState("")
  const [sendError, setSendError]     = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Derived counts
  const dropoffCount      = users.filter(u => u.category === "dropoff").length
  const inactiveCount     = users.filter(u => u.category === "inactive").length
  const neverEmailedCount = users.filter(u => u.never_emailed).length
  const stoppedCount      = users.filter(u => u.auto_stopped).length

  // Filtered users
  const filtered = useMemo(() => users.filter(u => {
    if (filterCat === "stopped") return u.auto_stopped
    if (filterCat !== "all" && u.category !== filterCat) return false
    if (filterEmail === "emailed" && u.never_emailed) return false
    if (filterEmail === "never" && !u.never_emailed) return false
    if (filterEmail === "opened" && !u.opened) return false
    if (filterEmail === "notopened" && (u.never_emailed || u.opened)) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q)
    }
    return true
  }), [users, filterCat, filterEmail, search])

  // Open modal
  function openEmail(u: UserRow) {
    setModalUser(u)
    setSubject("")
    setMessage("")
    setSendError(null)
    setSendSuccess(false)
    setAiIntent("")
  }

  // AI generate email
  async function handleAiGenerate() {
    if (!modalUser) return
    setAiGen(true)
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
    } catch (e: any) { setSendError(e.message) }
    finally { setAiGen(false) }
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
    } catch (e: any) { setSendError(e.message) }
    finally { setSending(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} style={{ color: "#D97757", flexShrink: 0 }} />
          <h1 className="text-lg font-bold" style={{ color: text, margin: 0 }}>Email Outreach</h1>
        </div>
        <p className="text-xs" style={{ color: muted }}>
          All users with email history. Click any row to send. Lifecycle emails run automatically at 08:00 UTC daily.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard title="Total users" value={users.length} />
        <KpiCard title="Drop-off" value={dropoffCount} description="Never onboarded" />
        <KpiCard title="Inactive 7d+" value={inactiveCount} description="Idle users" />
        <KpiCard title="Never emailed" value={neverEmailedCount} />
        <KpiCard title="Queued today" value={sentToday} description="Cron today" />
        <KpiCard title="Delivered" value={emailSummary["delivered"] ?? 0} description="30 days" />
        <KpiCard title="Opened" value={emailSummary["opened"] ?? 0} description="30 days" />
        <KpiCard title="Clicked" value={emailSummary["click"] ?? 0} description="30 days" />
      </div>

      {/* Tabs */}
      <div className="flex mb-4" style={{ borderBottom: `1px solid ${border}` }}>
        {(["users","events"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 text-sm font-semibold capitalize"
            style={{
              background: "transparent", border: "none",
              borderBottom: activeTab === tab ? `2px solid ${text}` : "2px solid transparent",
              color: activeTab === tab ? text : muted,
              cursor: "pointer", marginBottom: -1,
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
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-[160px]"
              style={{ border: `1px solid ${border}`, background: cardBg }}>
              <Search size={13} style={{ color: muted, flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="text-sm bg-transparent outline-none flex-1 min-w-0"
                style={{ color: text }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <X size={12} style={{ color: muted }} />
                </button>
              )}
            </div>

            <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)}
              className="text-sm px-3 py-2 rounded-lg cursor-pointer outline-none"
              style={{ border: `1px solid ${border}`, background: cardBg, color: text }}>
              <option value="all">All ({users.length})</option>
              <option value="dropoff">Drop-off ({dropoffCount})</option>
              <option value="inactive">Inactive ({inactiveCount})</option>
              <option value="active">Active</option>
              <option value="stopped">Auto-stopped ({stoppedCount})</option>
            </select>

            <select value={filterEmail} onChange={e => setFilterEmail(e.target.value as any)}
              className="text-sm px-3 py-2 rounded-lg cursor-pointer outline-none"
              style={{ border: `1px solid ${border}`, background: cardBg, color: text }}>
              <option value="all">All email status</option>
              <option value="never">Never emailed</option>
              <option value="emailed">Already emailed</option>
              <option value="opened">Opened</option>
              <option value="notopened">Not opened</option>
            </select>

            <span className="text-xs ml-auto" style={{ color: muted }}>{filtered.length} users</span>
          </div>

          {/* Users table */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}`, background: cardBg }}>
            {/* Desktop header */}
            <div className="hidden sm:grid text-xs uppercase tracking-wider font-semibold px-4 py-3"
              style={{ gridTemplateColumns: "minmax(150px,1fr) 76px 48px 46px 150px 160px 64px", gap: "12px", background: isDark ? "#000" : "#F0F0F0", borderBottom: `1px solid ${border}`, color: muted }}>
              <span>User</span><span>Status</span><span>Idle</span><span>Docs</span>
              <span>Emails sent</span><span>Engagement</span><span>Action</span>
            </div>

            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm" style={{ color: muted }}>No users match your filters</div>
            )}

            {filtered.map((u, i) => (
              <div key={u.id}
                onClick={() => openEmail(u)}
                style={{ borderTop: i > 0 ? `1px solid ${border}` : "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>

                {/* Desktop row */}
                <div className="hidden sm:grid items-center px-4 py-3"
                  style={{ gridTemplateColumns: "minmax(150px,1fr) 76px 48px 46px 150px 160px 64px", gap: "12px" }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm" style={{ color: text }}>{u.email}</div>
                    {u.name && <div className="truncate text-xs" style={{ color: muted }}>{u.name}</div>}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: u.auto_stopped ? "#6B7280" : CATEGORY_COLOR[u.category], background: `${u.auto_stopped ? "#6B7280" : CATEGORY_COLOR[u.category]}1A`, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>
                    {u.auto_stopped ? "Stopped" : CATEGORY_LABEL[u.category]}
                  </span>
                  <span className="text-xs" style={{ color: u.days_since_active >= 7 ? "#D97757" : muted }}>{u.days_since_active}d</span>
                  <span className="text-xs" style={{ color: u.docs_count > 0 ? text : muted }}>{u.docs_count}</span>
                  <div style={{ color: text }}><SentChip u={u} /></div>
                  <div><OpenIndicator u={u} /></div>
                  <button onClick={e => { e.stopPropagation(); openEmail(u) }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                    style={{ border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer" }}>
                    <Mail size={11} /> Email
                  </button>
                </div>

                {/* Mobile card */}
                <div className="sm:hidden px-4 py-3">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" style={{ color: text }}>{u.name ?? u.email}</div>
                      {u.name && <div className="text-xs truncate" style={{ color: muted }}>{u.email}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span style={{ fontSize: 10, fontWeight: 700, color: u.auto_stopped ? "#6B7280" : CATEGORY_COLOR[u.category], background: `${u.auto_stopped ? "#6B7280" : CATEGORY_COLOR[u.category]}1A`, padding: "2px 6px", borderRadius: 4 }}>
                        {u.auto_stopped ? "Stopped" : CATEGORY_LABEL[u.category]}
                      </span>
                      <button onClick={e => { e.stopPropagation(); openEmail(u) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                        style={{ border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer" }}>
                        <Mail size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: muted }}>
                    <span>Idle: <span style={{ color: u.days_since_active >= 7 ? "#D97757" : text }}>{u.days_since_active}d</span></span>
                    <span>Docs: <span style={{ color: text }}>{u.docs_count}</span></span>
                    <span>Sent: <span style={{ color: text }}>{u.total_sent_count === 0 ? "None" : `${u.total_sent_count} (${u.auto_sent_count}a/${u.manual_sent_count}m)`}</span></span>
                  </div>
                  <div className="mt-1.5"><OpenIndicator u={u} /></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── EVENTS TAB ── */}
      {activeTab === "events" && (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${border}`, background: cardBg }}>
          <div className="hidden sm:grid px-4 py-3 text-xs uppercase tracking-wider font-semibold"
            style={{ gridTemplateColumns: "1fr 100px 100px 160px 80px 110px", gap: "12px", background: isDark ? "#000" : "#F0F0F0", borderBottom: `1px solid ${border}`, color: muted }}>
            <span>Recipient</span><span>Event</span><span>Tag</span><span>Subject</span><span>Reason</span><span>When</span>
          </div>
          {recentEvents.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: muted }}>No events yet — events appear once Brevo automations start sending.</div>
          )}
          {recentEvents.map((ev, i) => (
            <div key={ev.id} style={{ borderTop: i > 0 ? `1px solid ${border}` : "none" }}>
              <div className="hidden sm:grid items-center px-4 py-3"
                style={{ gridTemplateColumns: "1fr 100px 100px 160px 80px 110px", gap: "12px" }}>
                <span className="truncate text-sm" style={{ color: text }}>{ev.email}</span>
                <EventBadge event={ev.event} />
                <span className="text-xs" style={{ color: muted }}>{ev.tag ?? "—"}</span>
                <span className="truncate text-xs" style={{ color: muted }}>{ev.subject ?? "—"}</span>
                <span className="text-xs" style={{ color: "#DC2626" }}>{ev.reason ?? "—"}</span>
                <span className="text-xs whitespace-nowrap" style={{ color: muted }}>{formatDistanceToNow(new Date(ev.event_at), { addSuffix: true })}</span>
              </div>
              <div className="sm:hidden px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs truncate flex-1" style={{ color: text }}>{ev.email}</span>
                  <EventBadge event={ev.event} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs" style={{ color: muted }}>
                  {ev.tag && <span>Tag: {ev.tag}</span>}
                  {ev.reason && <span style={{ color: "#DC2626" }}>{ev.reason}</span>}
                  <span>{formatDistanceToNow(new Date(ev.event_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EMAIL MODAL ── */}
      {modalUser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          style={{ background: "rgba(0,0,0,0.65)" }}
          onClick={e => { if (e.target === e.currentTarget) setModalUser(null) }}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-auto"
            style={{ background: cardBg, border: `1px solid ${border}`, maxHeight: "92vh", padding: isMobile ? "20px 16px 32px" : "28px" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0 flex-1 mr-4">
                <h2 className="text-base font-bold truncate" style={{ color: text, margin: 0 }}>
                  Email {modalUser.name ?? modalUser.email}
                </h2>
                <p className="text-xs mt-0.5 truncate" style={{ color: muted }}>{modalUser.email}</p>
              </div>
              <button onClick={() => setModalUser(null)} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
                <X size={18} style={{ color: muted }} />
              </button>
            </div>

            {/* User KPIs */}
            <div className="flex flex-wrap gap-3 mb-4 p-3 rounded-lg text-xs" style={{ background: isDark ? "#0A0A0A" : "#F0F0F0", border: `1px solid ${border}` }}>
              <span style={{ color: muted }}>Status: <strong style={{ color: modalUser.auto_stopped ? "#6B7280" : CATEGORY_COLOR[modalUser.category] }}>{modalUser.auto_stopped ? "Auto-stopped" : CATEGORY_LABEL[modalUser.category]}</strong></span>
              <span style={{ color: muted }}>Idle: <strong style={{ color: text }}>{modalUser.days_since_active}d</strong></span>
              <span style={{ color: muted }}>Docs: <strong style={{ color: text }}>{modalUser.docs_count}</strong></span>
              <span style={{ color: muted }}>Tier: <strong style={{ color: text }}>{modalUser.tier}</strong></span>
              <span style={{ color: muted }}>Total sent: <strong style={{ color: text }}>{modalUser.total_sent_count}</strong> <span style={{ color: muted }}>({modalUser.auto_sent_count} auto · {modalUser.manual_sent_count} manual)</span></span>
              <span style={{ color: muted }}>Engagement: <strong style={{ color: text }}>
                {modalUser.never_emailed ? "No emails yet"
                  : modalUser.opened ? `Opened ×${modalUser.open_count}`
                  : modalUser.bounced ? "Bounced"
                  : modalUser.delivered_count > 0 ? "Delivered, not opened"
                  : "Sent"}
              </strong></span>
              {modalUser.auto_stopped && (
                <span style={{ color: "#D97757" }}>⚠ Auto-stopped. This manual email will still send.</span>
              )}
            </div>

            {/* AI Draft */}
            <div className="mb-4 p-4 rounded-xl" style={{ border: `1px solid ${border}`, background: isDark ? "#050505" : "#FAFAFA" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold" style={{ color: "#7C3AED" }}>✨ AI Draft</span>
                <span className="text-xs" style={{ color: muted }}>Uses this user's real usage data</span>
              </div>
              <div className="flex gap-2 mb-3">
                {(["friendly","professional","urgent"] as const).map(t => (
                  <button key={t} onClick={() => setAiTone(t)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold capitalize"
                    style={{ border: `1px solid ${aiTone === t ? "#7C3AED" : border}`, background: aiTone === t ? "#7C3AED" : "transparent", color: aiTone === t ? "#fff" : muted, cursor: "pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Optional context: inactive 2 weeks, never used app…"
                value={aiIntent} onChange={e => setAiIntent(e.target.value)} maxLength={300}
                className="w-full text-sm rounded-lg outline-none mb-3"
                style={{ padding: "8px 10px", border: `1px solid ${border}`, background: inputBg, color: text }} />
              <button onClick={handleAiGenerate} disabled={aiGenerating}
                className="w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: aiGenerating ? muted : "#7C3AED", color: "#fff", border: "none", cursor: aiGenerating ? "not-allowed" : "pointer" }}>
                {aiGenerating ? "Generating…" : "Generate subject + message →"}
              </button>
            </div>

            {/* Subject */}
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: muted }}>Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Quick check-in from Clorefy"
                className="w-full text-sm rounded-lg outline-none"
                style={{ padding: "10px 12px", border: `1px solid ${border}`, background: inputBg, color: text }} />
            </div>

            {/* Message */}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: muted }}>Message</label>
              <textarea rows={isMobile ? 5 : 6} value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Write your message — or use AI Draft above"
                className="w-full text-sm rounded-lg outline-none resize-y leading-relaxed"
                style={{ padding: "10px 12px", border: `1px solid ${border}`, background: inputBg, color: text }} />
            </div>

            {sendError && (
              <div className="text-xs p-3 rounded-lg mb-3" style={{ background: "#FEF2F2", color: "#DC2626" }}>{sendError}</div>
            )}
            {sendSuccess && (
              <div className="flex items-center gap-2 text-xs p-3 rounded-lg mb-3" style={{ background: "#F0FDF4", color: "#059669" }}>
                <CheckCircle size={13} /> Email sent to {modalUser.email}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setModalUser(null)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm"
                style={{ border: `1px solid ${border}`, background: "transparent", color: text, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSend} disabled={!subject.trim() || !message.trim() || sending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: (!subject.trim() || !message.trim() || sending) ? muted : isDark ? "#F5F5F5" : "#0A0A0A",
                  color: isDark ? "#0A0A0A" : "#F5F5F5",
                  border: "none",
                  cursor: (!subject.trim() || !message.trim() || sending) ? "not-allowed" : "pointer",
                }}>
                <Send size={13} />{sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
