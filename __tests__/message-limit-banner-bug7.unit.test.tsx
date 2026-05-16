/**
 * Unit tests for Bug 7: Message-limit banner copy fix.
 *
 * Tests:
 *  1. nextTierUpgrade("free")   → { nextTier: "starter", label: "Starter", messagesPerSession: 30 }
 *  2. nextTierUpgrade("agency") → { nextTier: null, label: null, messagesPerSession: null }
 *  3. MessageLimitBanner tier="pro"  → contains "Start a new session", NOT "Upgrade to"
 *  4. MessageLimitBanner tier="free" → contains "Upgrade to Starter for 30 messages/session"
 *
 * **Validates: Requirements 7.1, 7.3, 3.9**
 */
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { nextTierUpgrade } from "@/lib/cost-protection"
import { MessageLimitBanner } from "@/components/message-limit-banner"

// ─── nextTierUpgrade unit tests ───────────────────────────────────────────────

describe("nextTierUpgrade", () => {
  it('nextTierUpgrade("free") returns starter upgrade info with 30 messages/session', () => {
    expect(nextTierUpgrade("free")).toEqual({
      nextTier: "starter",
      label: "Starter",
      messagesPerSession: 30,
    })
  })

  it('nextTierUpgrade("starter") returns pro upgrade info with 50 messages/session', () => {
    expect(nextTierUpgrade("starter")).toEqual({
      nextTier: "pro",
      label: "Pro",
      messagesPerSession: 50,
    })
  })

  it('nextTierUpgrade("pro") returns null (no upgrade path)', () => {
    expect(nextTierUpgrade("pro")).toEqual({
      nextTier: null,
      label: null,
      messagesPerSession: null,
    })
  })

  it('nextTierUpgrade("agency") returns null (no upgrade path)', () => {
    expect(nextTierUpgrade("agency")).toEqual({
      nextTier: null,
      label: null,
      messagesPerSession: null,
    })
  })
})

// ─── MessageLimitBanner render tests ─────────────────────────────────────────

describe("MessageLimitBanner copy", () => {
  it('tier="pro": renders "Start a new session" and does NOT contain "Upgrade to"', () => {
    const onCreateDocument = vi.fn()
    const { container } = render(
      <MessageLimitBanner
        currentMessages={50}
        limit={50}
        tier="pro"
        currentDocType="invoice"
        hasChain={false}
        parentSessionId="test-session-id"
        onCreateDocument={onCreateDocument}
      />
    )
    const text = container.textContent ?? ""
    expect(text).toContain("Start a new session")
    expect(text).not.toContain("Upgrade to")
  })

  it('tier="free": renders "Upgrade to Starter for 30 messages/session"', () => {
    const onCreateDocument = vi.fn()
    const { container } = render(
      <MessageLimitBanner
        currentMessages={10}
        limit={10}
        tier="free"
        currentDocType="invoice"
        hasChain={false}
        parentSessionId="test-session-id"
        onCreateDocument={onCreateDocument}
      />
    )
    const text = container.textContent ?? ""
    expect(text).toContain("Upgrade to Starter for 30 messages/session")
  })

  it('tier="agency": renders "Start a new session" and does NOT contain "Upgrade to"', () => {
    const onCreateDocument = vi.fn()
    const { container } = render(
      <MessageLimitBanner
        currentMessages={100}
        limit={100}
        tier="agency"
        currentDocType="invoice"
        hasChain={false}
        parentSessionId="test-session-id"
        onCreateDocument={onCreateDocument}
      />
    )
    const text = container.textContent ?? ""
    expect(text).toContain("Start a new session")
    expect(text).not.toContain("Upgrade to")
  })
})
