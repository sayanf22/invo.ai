/**
 * Preservation Property Tests — Tier Enforcement
 *
 * These tests capture behavior that MUST remain unchanged after the fix.
 * They follow observation-first methodology: observed on UNFIXED code, then
 * written as property-based tests to ensure no regressions.
 *
 * Property 1: Paid tiers (starter/pro/agency) can always use POST /api/ai/profile-update
 * Property 2: Within-limit users can create sessions (documentCount < tierLimit, tierLimit > 0)
 * Property 3: Allowed doc types succeed for their tier
 * Property 4: Agency tier (unlimited) always succeeds regardless of document count
 * Property 5: Free-tier user within limits with allowed doc types succeeds
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import fc from "fast-check"

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [
      {
        name: "sb-test-auth-token",
        value: JSON.stringify({ access_token: "mock-token" }),
      },
    ],
  }),
}))

// Mock Supabase client
const mockSupabaseFrom = vi.fn()
const mockSupabaseRpc = vi.fn()
const mockSupabaseAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: "user-123", email: "test@example.com" } },
    error: null,
  }),
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
    auth: mockSupabaseAuth,
  })),
}))

// Mock secrets
vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("mock-deepseek-key"),
}))

// Mock sanitize
vi.mock("@/lib/sanitize", () => ({
  sanitizeText: vi.fn((text: string) => text),
}))

// Mock global fetch for DeepSeek API calls
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * Configure mock Supabase to return a specific subscription plan and document count.
 */
function setupSupabaseMocks(plan: string, documentsCount: number) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "subscriptions") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { plan },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { plan },
          error: null,
        }),
      }
    }
    if (table === "user_usage") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { documents_count: documentsCount },
          error: null,
        }),
      }
    }
    if (table === "document_sessions") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "session-abc",
                document_type: "invoice",
                status: "active",
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === "chat_messages") {
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    }
    // Default fallback
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  })

  mockSupabaseRpc.mockResolvedValue({ error: null })
}

function setupDeepSeekMock() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: "Updated!",
              extractedData: {},
              needsClarification: false,
              allFieldsComplete: false,
            }),
          },
        },
      ],
    }),
  })
}

// ── Tier limits reference (mirrors lib/cost-protection.ts) ─────────────────

const TIER_LIMITS: Record<string, { documentsPerMonth: number; allowedDocTypes: string[] }> = {
  free: { documentsPerMonth: 5, allowedDocTypes: ["invoice", "contract"] },
  starter: { documentsPerMonth: 50, allowedDocTypes: ["invoice", "contract", "quotation", "proposal"] },
  pro: { documentsPerMonth: 150, allowedDocTypes: ["invoice", "contract", "quotation", "proposal"] },
  agency: { documentsPerMonth: 0, allowedDocTypes: ["invoice", "contract", "quotation", "proposal"] },
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Preservation Property Tests: Tier Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })
    setupDeepSeekMock()
  })

  /**
   * Property 1: For all tiers in {starter, pro, agency},
   * POST /api/ai/profile-update succeeds (not 403).
   *
   * Validates: Requirements 3.1, 3.2
   */
  describe("Property 1: Paid tiers can use AI profile-update", () => {
    it("should succeed (not 403) for all paid tiers", async () => {
      const { POST } = await import("@/app/api/ai/profile-update/route")

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("starter", "pro", "agency"),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (tier, messageContent) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            setupSupabaseMocks(tier, 0)
            setupDeepSeekMock()

            const req = createMockRequest("http://localhost:3000/api/ai/profile-update", {
              messages: [{ role: "user", content: messageContent }],
              currentProfile: { name: "Test Business" },
            })

            const response = await POST(req)
            // Paid tiers must NOT get 403
            expect(response.status).not.toBe(403)
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  /**
   * Property 2: For all (tier, documentCount) where documentCount < tierLimit
   * AND tierLimit > 0, POST /api/sessions/create succeeds.
   *
   * Validates: Requirements 3.3, 3.4
   */
  describe("Property 2: Within-limit session creation succeeds", () => {
    it("should succeed for users below their document limit", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      // Generator: pick a tier with a positive limit, then a count below that limit
      const tierAndCount = fc.constantFrom("free", "starter", "pro").chain((tier) => {
        const limit = TIER_LIMITS[tier].documentsPerMonth
        return fc.tuple(
          fc.constant(tier),
          fc.integer({ min: 0, max: limit - 1 })
        )
      })

      // Pick an allowed doc type for the chosen tier
      const tierCountAndType = tierAndCount.chain(([tier, count]) => {
        const allowed = TIER_LIMITS[tier].allowedDocTypes
        return fc.tuple(
          fc.constant(tier),
          fc.constant(count),
          fc.constantFrom(...allowed)
        )
      })

      await fc.assert(
        fc.asyncProperty(
          tierCountAndType,
          async ([tier, documentCount, documentType]) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            setupSupabaseMocks(tier, documentCount)

            const req = createMockRequest("http://localhost:3000/api/sessions/create", {
              documentType,
            })

            const response = await POST(req)
            const body = await response.json()

            // Within-limit + allowed type must succeed
            expect(response.status).toBe(200)
            expect(body.success).toBe(true)
          }
        ),
        { numRuns: 20 }
      )
    })
  })

  /**
   * Property 3: For all (tier, documentType) where documentType ∈ TIER_LIMITS[tier].allowedDocTypes,
   * POST /api/sessions/create succeeds.
   *
   * Validates: Requirements 3.4, 3.5
   */
  describe("Property 3: Allowed document types succeed", () => {
    it("should succeed for any tier with an allowed document type", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      // Generator: pick a tier, then pick an allowed doc type for that tier
      const tierAndType = fc.constantFrom("free", "starter", "pro", "agency").chain((tier) => {
        const allowed = TIER_LIMITS[tier].allowedDocTypes
        return fc.tuple(fc.constant(tier), fc.constantFrom(...allowed))
      })

      await fc.assert(
        fc.asyncProperty(
          tierAndType,
          async ([tier, documentType]) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            // Use 0 docs to avoid hitting any limit
            setupSupabaseMocks(tier, 0)

            const req = createMockRequest("http://localhost:3000/api/sessions/create", {
              documentType,
            })

            const response = await POST(req)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.success).toBe(true)
          }
        ),
        { numRuns: 15 }
      )
    })
  })

  /**
   * Property 4: Agency tier (unlimited, documentsPerMonth = 0) always succeeds
   * regardless of document count.
   *
   * Validates: Requirements 3.5
   */
  describe("Property 4: Agency tier always succeeds", () => {
    it("should succeed for agency tier regardless of document count", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      await fc.assert(
        fc.asyncProperty(
          // Any document count, even very high
          fc.integer({ min: 0, max: 10000 }),
          fc.constantFrom("invoice", "contract", "quotation", "proposal"),
          async (documentCount, documentType) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            setupSupabaseMocks("agency", documentCount)

            const req = createMockRequest("http://localhost:3000/api/sessions/create", {
              documentType,
            })

            const response = await POST(req)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.success).toBe(true)
          }
        ),
        { numRuns: 15 }
      )
    })
  })

  /**
   * Property 5: Free-tier user with documentCount < 5 and
   * documentType in ["invoice", "contract"] succeeds.
   *
   * Validates: Requirements 3.3, 3.4
   */
  describe("Property 5: Free-tier within limits succeeds", () => {
    it("should succeed for free-tier user below limit with any doc type", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 4 }), // < 5 (free tier limit)
          fc.constantFrom("invoice", "contract"), // free tier allowed types
          async (documentCount, documentType) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            setupSupabaseMocks("free", documentCount)

            const req = createMockRequest("http://localhost:3000/api/sessions/create", {
              documentType,
            })

            const response = await POST(req)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.success).toBe(true)
          }
        ),
        { numRuns: 10 }
      )
    })
  })
})
