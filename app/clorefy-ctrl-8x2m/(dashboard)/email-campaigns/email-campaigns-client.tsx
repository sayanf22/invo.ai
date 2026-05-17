"use client"

import { useState } from "react"
import { Mail, Send, Users, Clock, CheckCircle, AlertCircle, Loader2, Eye } from "lucide-react"
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

const SEGMENTS = [
  {
    id: "onboarding-dropoff-1",
    label: "Onboarding drop-off — Email 1",
    description: "Users who signed up but never completed onboarding (>2h inactive). Sends walkthrough video link.",
    countKey: "dropoff" as keyof SegmentCounts,
    subject: "Your Clorefy setup is waiting — takes 2 minutes",
    color: "#DC2626",
  },
  {
    id: "onboarding-dropoff-2",
    label: "Onboarding drop-off — Email 2",
    description: "Same segment, second and final nudge. Only send after Email 1.",
    countKey: "dropoff" as keyof SegmentCounts,
    subject: "One last reminder — your Clorefy account is ready",
    color: "#EA580C",
  },
  {
    id: "inactive-7d",
    label: "Inactive users — Day 7",
    description: "Completed onboarding but no activity in 7+ days. Re-engagement email.",
    countKey: "inactive7" as keyof SegmentCounts,
    subject: "You set up Clorefy — haven't tried it yet?",
    color: "#D97706",
  },
  {
    id: "inactive-14d",
    label: "Inactive users — Day 14 (final)",
    description: "Completed onboarding, no activity in 14+ days. Last email before silence.",
    countKey: "inactive14" as keyof SegmentCounts,
    subject: "We built Clorefy for you — give it 60 seconds",
    color: "#7C3AED",
  },
  {
    id: "backfill-all",
    label: "Sync all users to Brevo",
    description: "Backfill — syncs all users to Brevo contact lists. Does NOT send email.",
    countKey: "allActive" as keyof SegmentCounts,
    subject: "Brevo contact sync (no email sent)",
    color: "#2563EB",
  },
]

export default function EmailCampaignsClient({ campaigns, segmentCounts }: Props) {
  const { theme } = useAdminTheme()
  const isDark = theme === "dark"

  const [sending, setSending] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { sent: number; failed: number; total: number } | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [campaignLog, setCampaignLog] = useState<Campaign[]>(campaigns)

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
      setResults((prev) => ({ ...prev, [`${segmentId}-dry`]: { sent: data.count, failed: 0, total: data.count } }))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPreviewing(null)
    }
  }

  async function handleSend(segmentId: string) {
    if (!confirm(`Send "${segmentId}" to all matching users? This cannot be undone.`)) return
    setSending(segmentId)
    setError(null)
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: segmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Request failed")
      setResults((prev) => ({ ...prev, [segmentId]: { sent: data.sent ?? data.synced ?? 0, failed: data.failed ?? 0, total: data.total ?? data.synced ?? 0 } }))

      // Refresh logs
      const logRes = await fetch("/api/admin/email-campaigns")
      const logData = await logRes.json()
      if (logData.campaigns) setCampaignLog(logData.campaigns)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSending(null)
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
            Send targeted re-engagement emails to drop-off and inactive users via Brevo. Always run a dry run first.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
            <AlertCircle size={16} color="#DC2626" />
            <span style={{ color: "#DC2626", fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* Segments */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 16 }}>Segments</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SEGMENTS.map((seg) => {
              const count = segmentCounts[seg.countKey]
              const result = results[seg.id]
              const dryResult = results[`${seg.id}-dry`]
              const isSending = sending === seg.id
              const isPreviewing = previewing === seg.id

              return (
                <div
                  key={seg.id}
                  style={{
                    background: cardBg,
                    border: `1.5px solid ${border}`,
                    borderRadius: 14,
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{seg.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: seg.color, background: `${seg.color}18`, padding: "2px 8px", borderRadius: 6 }}>
                          {count} users
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: muted, margin: 0, lineHeight: 1.5 }}>{seg.description}</p>
                      <p style={{ fontSize: 12, color: muted, margin: "4px 0 0", fontStyle: "italic" }}>Subject: "{seg.subject}"</p>

                      {/* Dry run result */}
                      {dryResult && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#2563EB", background: "#EFF6FF", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
                          👁 Dry run: {dryResult.sent} users would receive this email
                        </div>
                      )}

                      {/* Send result */}
                      {result && (
                        <div style={{ marginTop: 8, fontSize: 13, color: "#059669", background: "#F0FDF4", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
                          <CheckCircle size={13} style={{ display: "inline", marginRight: 4 }} />
                          Sent: {result.sent} · Failed: {result.failed}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleDryRun(seg.id)}
                        disabled={!!sending || !!previewing}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: `1.5px solid ${border}`,
                          background: "transparent",
                          color: text,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: sending || previewing ? "not-allowed" : "pointer",
                          opacity: sending || previewing ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {isPreviewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                        Dry run
                      </button>
                      <button
                        onClick={() => handleSend(seg.id)}
                        disabled={!!sending || !!previewing}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: isSending ? "#9CA3AF" : seg.color,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: sending || previewing ? "not-allowed" : "pointer",
                          opacity: sending && !isSending ? 0.5 : 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {isSending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Campaign history */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 16 }}>Send History</h2>
          {campaignLog.length === 0 ? (
            <div style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "32px 20px", textAlign: "center" }}>
              <Mail size={32} color={muted} style={{ marginBottom: 12 }} />
              <p style={{ color: muted, fontSize: 14 }}>No campaigns sent yet. Send your first one above.</p>
            </div>
          ) : (
            <div style={{ background: cardBg, border: `1.5px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    {["Segment", "Subject", "Sent", "Failed", "By", "When"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: muted, whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaignLog.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < campaignLog.length - 1 ? `1px solid ${border}` : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: text, fontWeight: 500 }}>{c.segment}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>{c.emails_sent}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.emails_failed > 0 ? "#DC2626" : muted }}>{c.emails_failed}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted }}>{c.sent_by}</td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: muted, whiteSpace: "nowrap" }}>
                        {formatDistanceToNow(new Date(c.sent_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginTop: 32, padding: "16px 20px", background: isDark ? "#1A1A1A" : "#F0EDEA", borderRadius: 12 }}>
          <p style={{ fontSize: 13, color: muted, marginBottom: 4, fontWeight: 600 }}>Free tier limits</p>
          <p style={{ fontSize: 13, color: muted, margin: 0 }}>Brevo free plan: 300 emails/day, 9,000/month. With 17 users today this is well within limits. Contact support@clorefy.com if you hit limits.</p>
        </div>

      </div>
    </div>
  )
}
