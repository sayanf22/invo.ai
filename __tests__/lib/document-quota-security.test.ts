import { describe, expect, it, vi } from "vitest"
import { reserveDocumentQuota } from "@/lib/cost-protection"

const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"
const sessionId = "11111111-1111-4111-8111-111111111111"

function client(result: { data: any; error: any }) {
  return { rpc: vi.fn(async () => result) }
}

describe("atomic document quota enforcement", () => {
  it("fails closed when the reservation RPC is unavailable", async () => {
    const result = await reserveDocumentQuota(
      client({ data: null, error: { message: "database unavailable" } }) as any,
      userId,
      sessionId,
    )

    expect(result.response?.status).toBe(503)
    expect(result.reserved).toBe(false)
  })

  it("returns 429 when the atomic reservation says the limit is exhausted", async () => {
    const result = await reserveDocumentQuota(
      client({ data: { allowed: false, current_count: 5, limit: 5, tier: "free" }, error: null }) as any,
      userId,
      sessionId,
    )

    expect(result.response?.status).toBe(429)
    expect(result.reserved).toBe(false)
  })

  it("reports whether this request created the one-per-session reservation", async () => {
    const result = await reserveDocumentQuota(
      client({ data: { allowed: true, reserved: true, current_count: 1 }, error: null }) as any,
      userId,
      sessionId,
    )

    expect(result.response).toBeNull()
    expect(result.reserved).toBe(true)
  })
})
