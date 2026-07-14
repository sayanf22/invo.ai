import { describe, expect, it } from "vitest"
import { verifyCashfreeWebhookSignature } from "@/lib/cashfree-payment-links"

async function sign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  )
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))
  return btoa(String.fromCharCode(...bytes))
}

describe("verifyCashfreeWebhookSignature", () => {
  const rawBody = '{"type":"PAYMENT_LINK_EVENT","data":{"amount":100}}'
  const timestamp = "1712345678123"
  const secret = "cashfree-client-secret"

  it("verifies Cashfree's timestamp concatenated with the exact raw body", async () => {
    const signature = await sign(`${timestamp}${rawBody}`, secret)
    await expect(verifyCashfreeWebhookSignature(rawBody, signature, timestamp, secret))
      .resolves.toBe(true)
  })

  it("rejects a signature over the body alone and any raw-body reserialization", async () => {
    const bodyOnlySignature = await sign(rawBody, secret)
    await expect(verifyCashfreeWebhookSignature(rawBody, bodyOnlySignature, timestamp, secret))
      .resolves.toBe(false)

    const signature = await sign(`${timestamp}${rawBody}`, secret)
    const reformatted = '{ "type": "PAYMENT_LINK_EVENT", "data": { "amount": 100 } }'
    await expect(verifyCashfreeWebhookSignature(reformatted, signature, timestamp, secret))
      .resolves.toBe(false)
  })

  it.each(["", "not-a-time", "123456789", "17123456781234567"])(
    "rejects malformed timestamp %j before signature verification",
    async (invalidTimestamp) => {
      const signature = await sign(`${invalidTimestamp}${rawBody}`, secret)
      await expect(verifyCashfreeWebhookSignature(rawBody, signature, invalidTimestamp, secret))
        .resolves.toBe(false)
    },
  )
})
