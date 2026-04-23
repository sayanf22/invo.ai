/**
 * Unit tests for sendEmail
 * Feature: email-sending
 * Requirements: 1.4, 1.5, 1.6
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendEmail } from "@/lib/mailtrap"

describe("sendEmail unit tests", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MAILTRAP_API_KEY
  })

  it("throws when MAILTRAP_API_KEY is missing", async () => {
    delete process.env.MAILTRAP_API_KEY

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
        senderName: "Test Sender",
      })
    ).rejects.toThrow("MAILTRAP_API_KEY")
  })

  it("handles 429 with retry-after header extraction", async () => {
    process.env.MAILTRAP_API_KEY = "test-key"

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
      )
    )

    const result = await sendEmail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      senderName: "Test Sender",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.statusCode).toBe(429)
      expect(result.retryAfter).toBe(60)
    }
  })

  it("handles network failures gracefully", async () => {
    process.env.MAILTRAP_API_KEY = "test-key"

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network failure")
      })
    )

    const result = await sendEmail({
      to: "recipient@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
      senderName: "Test Sender",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.statusCode).toBe(0)
      expect(result.message).toContain("Network error")
    }
  })
})
