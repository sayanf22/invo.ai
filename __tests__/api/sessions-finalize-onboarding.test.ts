import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }))

vi.mock("@/lib/api-auth", () => ({ authenticateRequest: mocks.authenticate }))

const sessionId = "12345678-1234-4123-8123-123456789012"

function request() {
  return new NextRequest("https://clorefy.com/api/sessions/finalize", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify({ sessionId }),
  })
}

function buildSupabase(documentType: string, status = "active") {
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) }))
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { status, document_type: documentType }, error: null }) })) })),
  }))
  const from = vi.fn(() => ({ select, update }))
  return { supabase: { from }, update }
}

beforeEach(() => vi.clearAllMocks())

describe("POST /api/sessions/finalize onboarding guard", () => {
  it("rejects finalizing a client onboarding form and never updates it", async () => {
    const { supabase, update } = buildSupabase("client_onboarding_form")
    mocks.authenticate.mockResolvedValue({ error: null, user: { id: "user-1" }, supabase })
    const { POST } = await import("@/app/api/sessions/finalize/route")

    const res = await POST(request())

    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it("still finalizes a regular invoice", async () => {
    const { supabase, update } = buildSupabase("invoice")
    mocks.authenticate.mockResolvedValue({ error: null, user: { id: "user-1" }, supabase })
    const { POST } = await import("@/app/api/sessions/finalize/route")

    const res = await POST(request())

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledOnce()
  })

  it("treats capitalized/hyphenated onboarding type as onboarding", async () => {
    const { supabase, update } = buildSupabase("Client-Onboarding-Form")
    mocks.authenticate.mockResolvedValue({ error: null, user: { id: "user-1" }, supabase })
    const { POST } = await import("@/app/api/sessions/finalize/route")

    const res = await POST(request())

    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })
})
