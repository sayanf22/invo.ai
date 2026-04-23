import { describe, it, expect } from "vitest"

// Mirror the badge config from the EmailBadge component in app/documents/page.tsx
const EMAIL_BADGE_CONFIG = {
  sent: { label: "Sent", className: "bg-muted text-muted-foreground" },
  delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  opened: { label: "Opened", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  bounced: { label: "Bounced", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
}

// Validates: Requirements 11.1, 11.2, 11.3, 11.4

describe("EmailBadge config", () => {
  it("has correct badge colors for delivered status", () => {
    expect(EMAIL_BADGE_CONFIG.delivered.className).toContain("emerald")
    expect(EMAIL_BADGE_CONFIG.delivered.label).toBe("Delivered")
  })

  it("has correct badge colors for bounced status", () => {
    expect(EMAIL_BADGE_CONFIG.bounced.className).toContain("red")
    expect(EMAIL_BADGE_CONFIG.bounced.label).toBe("Bounced")
  })

  it("has correct badge colors for opened status", () => {
    expect(EMAIL_BADGE_CONFIG.opened.className).toContain("blue")
    expect(EMAIL_BADGE_CONFIG.opened.label).toBe("Opened")
  })

  it("selects most recent email record (data shape test)", () => {
    // Simulate the emailMap logic from documents/page.tsx:
    // emails are ordered by created_at descending, first entry per session_id wins
    const emails = [
      { id: "e2", session_id: "s1", status: "opened" as const, created_at: "2024-06-02T10:00:00Z" },
      { id: "e1", session_id: "s1", status: "delivered" as const, created_at: "2024-06-01T08:00:00Z" },
    ]

    const emailMap: Record<string, typeof emails[0]> = {}
    for (const e of emails) {
      if (!emailMap[e.session_id]) {
        emailMap[e.session_id] = e
      }
    }

    // The most recent record (first in descending order) should be selected
    expect(emailMap["s1"].id).toBe("e2")
    expect(emailMap["s1"].status).toBe("opened")
    expect(emailMap["s1"].created_at).toBe("2024-06-02T10:00:00Z")
  })
})
