/**
 * Bug Condition Exploration Tests — Tier Enforcement Bypass
 *
 * These tests encode the EXPECTED behavior (what the code SHOULD do after the fix).
 *
 * Bug 1: POST /api/ai/profile-update should return 403 for free-tier users
 * Bug 2: POST /api/sessions/create should return 429 when document limit reached
 * Bug 3: Free-tier users CAN create all 4 document types (within their 3-doc limit)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Bug Condition Exploration: Tier Enforcement Bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    })
    // Mock DeepSeek API response for profile-update
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
  })

  /**
   * Bug 1: Profile AI gate — free-tier users should get 403
   * Validates: Requirements 2.1, 2.2
   */
  describe("Bug 1: POST /api/ai/profile-update blocks free-tier users", () => {
    it("should return 403 for free-tier user (property-based)", async () => {
      const { POST } = await import("@/app/api/ai/profile-update/route")

      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary message content for free-tier user
          fc.string({ minLength: 1, maxLength: 100 }),
          async (messageContent) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            setupSupabaseMocks("free", 0)
            mockFetch.mockResolvedValue({
              ok: true,
              json: async () => ({
                choices: [
                  {
                    message: {
                      content: JSON.stringify({
                        message: "Done",
                        extractedData: {},
                        needsClarification: false,
                        allFieldsComplete: false,
                      }),
                    },
                  },
                ],
              }),
            })

            const req = createMockRequest("http://localhost:3000/api/ai/profile-update", {
              messages: [{ role: "user", content: messageContent }],
              currentProfile: { name: "Test Business" },
            })

            const response = await POST(req)
            // EXPECTED: 403 — free-tier users should be blocked from AI profile editing
            expect(response.status).toBe(403)
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  /**
   * Bug 2: Document limit — free-tier users at limit should get 429
   * Validates: Requirements 2.3
   */
  describe("Bug 2: POST /api/sessions/create enforces document limits", () => {
    it("should return 429 for free-tier user at document limit (property-based)", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      await fc.assert(
        fc.asyncProperty(
          // Generate document counts >= 5 (the free tier limit)
          fc.integer({ min: 5, max: 100 }),
          // Free tier allows only invoice + contract
          fc.constantFrom("invoice", "contract"),
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

            // EXPECTED: 429 with "Monthly document limit reached"
            expect(response.status).toBe(429)
            expect(body.error).toBe("Monthly document limit reached")
          }
        ),
        { numRuns: 5 }
      )
    })
  })

  /**
   * Bug 3: Free-tier users are blocked from quotation/proposal document types
   * Validates: Document type restriction for free tier
   */
  describe("Bug 3: POST /api/sessions/create blocks restricted doc types for free-tier", () => {
    it("should return 403 for free-tier user creating quotation or proposal (property-based)", async () => {
      const { POST } = await import("@/app/api/sessions/create/route")

      await fc.assert(
        fc.asyncProperty(
          // Restricted document types for free tier
          fc.constantFrom("quotation", "proposal"),
          async (documentType) => {
            vi.clearAllMocks()
            mockSupabaseAuth.getUser.mockResolvedValue({
              data: { user: { id: "user-123", email: "test@example.com" } },
              error: null,
            })
            // Use 0 docs — within limit, isolating the type restriction
            setupSupabaseMocks("free", 0)

            const req = createMockRequest("http://localhost:3000/api/sessions/create", {
              documentType,
            })

            const response = await POST(req)
            const body = await response.json()

            // EXPECTED: 403 — free-tier users cannot create quotation/proposal
            expect(response.status).toBe(403)
            expect(body.error).toBe("Document type not available on your plan")
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
