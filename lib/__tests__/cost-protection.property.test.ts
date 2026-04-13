/**
 * Property 12: Tier-based usage limit enforcement
 * Feature: security-hardening
 *
 * For any user tier and usage count (documents per month or messages per session),
 * the cost protector SHALL allow the operation when usage is below the tier limit
 * and SHALL return a 429 response when usage meets or exceeds the limit.
 * Unlimited tiers (agency) SHALL always allow.
 *
 * **Validates: Requirements 7.3, 7.4, 7.5**
 */
import { describe, it, expect, vi } from "vitest"
import * as fc from "fast-check"
import {
  checkDocumentLimit,
  checkMessageLimit,
  getTierLimits,
  type UserTier,
} from "@/lib/cost-protection"

const ALL_TIERS: UserTier[] = ["free", "starter", "pro", "agency"]
const LIMITED_TIERS: Array<Exclude<UserTier, "agency">> = ["free", "starter", "pro"]

// Expected limits per the requirements
const EXPECTED_DOC_LIMITS: Record<Exclude<UserTier, "agency">, number> = {
  free: 5,
  starter: 50,
  pro: 150,
}

const EXPECTED_MSG_LIMITS: Record<Exclude<UserTier, "agency">, number> = {
  free: 10,
  starter: 30,
  pro: 50,
}

// ── Helpers ────────────────────────────────────────────────────────────

function createDocUsageMock(documentsCount: number) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { documents_count: documentsCount },
              error: null,
            }),
          }),
        }),
      }),
    }),
  } as any
}

function createMsgCountMock(messageCount: number) {
  const eqRole = { count: messageCount, error: null }
  const eqSession = { eq: vi.fn().mockReturnValue(eqRole) }
  const selectChain = { eq: vi.fn().mockReturnValue(eqSession) }
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
    }),
  } as any
}

// ── Property 12a: Document limit enforcement ───────────────────────────

describe("Feature: security-hardening, Property 12: Tier-based usage limit enforcement", () => {
  describe("Document limits", () => {
    it("SHALL allow when document usage is below the tier limit", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...LIMITED_TIERS),
          fc.integer({ min: 0, max: 1000 }),
          async (tier, offset) => {
            const limit = EXPECTED_DOC_LIMITS[tier]
            // usage strictly below limit
            const usage = offset % limit  // 0..limit-1
            const mock = createDocUsageMock(usage)

            const result = await checkDocumentLimit(mock, "user-id", tier)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("SHALL return 429 when document usage meets or exceeds the tier limit", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...LIMITED_TIERS),
          fc.integer({ min: 0, max: 500 }),
          async (tier, extra) => {
            const limit = EXPECTED_DOC_LIMITS[tier]
            const usage = limit + extra  // always >= limit
            const mock = createDocUsageMock(usage)

            const result = await checkDocumentLimit(mock, "user-id", tier)
            expect(result).not.toBeNull()

            const body = await result!.json()
            expect(result!.status).toBe(429)
            expect(body).toHaveProperty("error", "Monthly document limit reached")
            expect(body).toHaveProperty("currentUsage", usage)
            expect(body).toHaveProperty("limit", limit)
            expect(body).toHaveProperty("tier", tier)
            expect(body).toHaveProperty("message")
          }
        ),
        { numRuns: 100 }
      )
    })

    it("SHALL always allow for agency tier (unlimited)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100_000 }),
          async (usage) => {
            const mock = createDocUsageMock(usage)
            const result = await checkDocumentLimit(mock, "user-id", "agency")
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ── Property 12b: Message limit enforcement ──────────────────────────

  describe("Message limits", () => {
    it("SHALL allow when message count is below the tier limit", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...LIMITED_TIERS),
          fc.integer({ min: 0, max: 1000 }),
          async (tier, offset) => {
            const limit = EXPECTED_MSG_LIMITS[tier]
            const count = offset % limit  // 0..limit-1
            const mock = createMsgCountMock(count)

            const result = await checkMessageLimit(mock, "user-id", "session-id", tier)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it("SHALL return 429 when message count meets or exceeds the tier limit", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...LIMITED_TIERS),
          fc.integer({ min: 0, max: 500 }),
          async (tier, extra) => {
            const limit = EXPECTED_MSG_LIMITS[tier]
            const count = limit + extra  // always >= limit
            const mock = createMsgCountMock(count)

            const result = await checkMessageLimit(mock, "user-id", "session-id", tier)
            expect(result).not.toBeNull()

            const body = await result!.json()
            expect(result!.status).toBe(429)
            expect(body).toHaveProperty("error", "Session message limit reached")
            expect(body).toHaveProperty("currentMessages", count)
            expect(body).toHaveProperty("limit", limit)
            expect(body).toHaveProperty("tier", tier)
            expect(body).toHaveProperty("message")
          }
        ),
        { numRuns: 100 }
      )
    })

    it("SHALL always allow for agency tier (unlimited)", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 100_000 }),
          async (count) => {
            const mock = createMsgCountMock(count)
            const result = await checkMessageLimit(mock, "user-id", "session-id", "agency")
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // ── Tier limit values match requirements ─────────────────────────────

  describe("Tier limit values match requirements", () => {
    it("SHALL have correct document limits per tier", () => {
      for (const tier of LIMITED_TIERS) {
        const limits = getTierLimits(tier)
        expect(limits.documentsPerMonth).toBe(EXPECTED_DOC_LIMITS[tier])
      }
      // Agency unlimited (0 means unlimited)
      expect(getTierLimits("agency").documentsPerMonth).toBe(0)
    })

    it("SHALL have correct message limits per tier", () => {
      for (const tier of LIMITED_TIERS) {
        const limits = getTierLimits(tier)
        expect(limits.messagesPerSession).toBe(EXPECTED_MSG_LIMITS[tier])
      }
      // Agency unlimited (0 means unlimited)
      expect(getTierLimits("agency").messagesPerSession).toBe(0)
    })
  })
})
