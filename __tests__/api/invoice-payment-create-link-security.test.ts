import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/payments/create-link/route"

describe("POST /api/payments/create-link security", () => {
  it("rejects direct pre-send payment-link creation", async () => {
    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("GET")
    expect(body).toEqual({
      error: "Payment links are created only after the invoice amount is confirmed during Send.",
      code: "CREATE_ON_SEND_ONLY",
    })
  })
})