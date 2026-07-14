import { describe, expect, it, vi } from "vitest"
import { checkPublicRateLimit, hashRateLimitIdentifier } from "@/lib/public-rate-limit"

function dbResult(result: unknown) {
  return { rpc: vi.fn().mockResolvedValue(result) } as any
}

describe("checkPublicRateLimit", () => {
  it("forwards a hashed identifier and configured limits", async () => {
    const db = dbResult({ data: { allowed: true }, error: null })

    await expect(checkPublicRateLimit(db, "203.0.113.7", "public-pay", 8, 60))
      .resolves.toBeNull()
    expect(db.rpc).toHaveBeenCalledWith("check_public_rate_limit", {
      p_identifier_hash: await hashRateLimitIdentifier("203.0.113.7"),
      p_category: "public-pay",
      p_max_requests: 8,
      p_window_seconds: 60,
    })
  })

  it.each([
    { data: null, error: new Error("database unavailable") },
    { data: null, error: null },
    { data: { allowed: "yes" }, error: null },
  ])("fails closed when durable verification is unavailable or malformed", async (result) => {
    const response = await checkPublicRateLimit(dbResult(result), "ip", "public", 5, 30)
    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toEqual({
      error: "Request verification temporarily unavailable",
    })
  })

  it("returns a retryable 429 when the durable limiter denies the request", async () => {
    const response = await checkPublicRateLimit(
      dbResult({ data: [{ allowed: false, retry_after: 17 }], error: null }),
      "ip", "public", 5, 30,
    )
    expect(response?.status).toBe(429)
    expect(response?.headers.get("Retry-After")).toBe("17")
  })
})
