/**
 * Property 1: Message limit enforcement returns structured 429
 * Feature: document-linking-and-usage-tracking
 *
 * For any user tier (free, starter, pro) and any session message count
 * that equals or exceeds that tier's messagesPerSession limit,
 * checkMessageLimit SHALL return a 429 response containing the fields
 * error, currentMessages, limit, tier, and message.
 * For the agency tier (limit 0), checkMessageLimit SHALL return null
 * regardless of message count.
 *
 * Validates: Requirements 2.2, 1.1, 1.2, 1.3, 1.4
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { checkMessageLimit, type UserTier } from "@/lib/cost-protection"

const TIER_MESSAGE_LIMITS: Record<Exclude<UserTier, "agency">, number> = {
  free: 10,
  starter: 30,
  pro: 50,
}

const LIMITED_TIERS: Array<Exclude<UserTier, "agency">> = ["free", "starter", "pro"]

function createMockSupabase(messageCount: number) {
  const eqChain = {
    eq: vi.fn().mockReturnValue({
      count: messageCount,
      error: null,
    } as never),
  }
  const selectChain = {
    eq: vi.fn().mockReturnValue(eqChain),
  }
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
    }),
  } as any
}

describe("Feature: document-linking-and-usage-tracking, Property 1: Message limit enforcement returns structured 429", () => {
  it("should return 429 with all required fields when message count >= tier limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...LIMITED_TIERS),
        fc.integer({ min: 0, max: 500 }),
        async (tier, extraMessages) => {
          const limit = TIER_MESSAGE_LIMITS[tier]
          const messageCount = limit + extraMessages // always >= limit
          const mockSupabase = createMockSupabase(messageCount)

          const result = await checkMessageLimit(
            mockSupabase,
            "test-user-id",
            "test-session-id",
            tier
          )

          // Must return a response (not null)
          expect(result).not.toBeNull()

          // Extract the JSON body from the NextResponse
          const body = await result!.json()

          // Status must be 429
          expect(result!.status).toBe(429)

          // All required fields must be present
          expect(body).toHaveProperty("error", "Session message limit reached")
          expect(body).toHaveProperty("currentMessages", messageCount)
          expect(body).toHaveProperty("limit", limit)
          expect(body).toHaveProperty("tier", tier)
          expect(body).toHaveProperty("message")
          expect(typeof body.message).toBe("string")
          expect(body.message.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return null for agency tier regardless of message count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }),
        async (messageCount) => {
          const mockSupabase = createMockSupabase(messageCount)

          const result = await checkMessageLimit(
            mockSupabase,
            "test-user-id",
            "test-session-id",
            "agency"
          )

          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Property 2: Message counting counts only user-role messages
 * Feature: document-linking-and-usage-tracking
 *
 * For any session containing a random mix of messages with roles "user"
 * and "assistant", getSessionMessageCount SHALL return a count equal to
 * exactly the number of messages with role = "user", ignoring all
 * assistant messages.
 *
 * Validates: Requirements 2.3, 8.3
 */
import { getSessionMessageCount } from "@/lib/cost-protection"

describe("Feature: document-linking-and-usage-tracking, Property 2: Message counting counts only user-role messages", () => {
  it("should return count equal to the number of user-role messages", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom("user", "assistant"),
            content: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.uuid(),
        async (messages, sessionId) => {
          const expectedUserCount = messages.filter(
            (m) => m.role === "user"
          ).length

          // Mock Supabase to return the expected user count
          // (simulating what the real DB would return after filtering by role="user")
          const eqRole = {
            count: expectedUserCount,
            error: null,
          }
          const eqSession = {
            eq: vi.fn().mockReturnValue(eqRole),
          }
          const selectChain = {
            eq: vi.fn().mockReturnValue(eqSession),
          }
          const mockSupabase = {
            from: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue(selectChain),
            }),
          } as any

          const result = await getSessionMessageCount(mockSupabase, sessionId)

          // Result must equal the number of user-role messages
          expect(result).toBe(expectedUserCount)

          // Verify the query was constructed correctly
          expect(mockSupabase.from).toHaveBeenCalledWith("chat_messages")
          expect(selectChain.eq).toHaveBeenCalledWith("session_id", sessionId)
          expect(eqSession.eq).toHaveBeenCalledWith("role", "user")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return 0 when Supabase returns an error (fail-open)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (sessionId, errorMessage) => {
          const eqRole = {
            count: null,
            error: { message: errorMessage, code: "UNKNOWN" },
          }
          const eqSession = {
            eq: vi.fn().mockReturnValue(eqRole),
          }
          const selectChain = {
            eq: vi.fn().mockReturnValue(eqSession),
          }
          const mockSupabase = {
            from: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue(selectChain),
            }),
          } as any

          const result = await getSessionMessageCount(mockSupabase, sessionId)

          // Must return 0 on error (fail-open)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
