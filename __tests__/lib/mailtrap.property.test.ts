/**
 * Property 1: Mailtrap payload construction invariants
 * Feature: email-sending
 *
 * For any valid SendEmailParams (with any recipient email, subject, HTML body,
 * and sender name), the constructed Mailtrap API request payload SHALL always contain:
 * (a) the URL `https://send.api.mailtrap.io/api/send`
 * (b) an `Authorization: Bearer {token}` header
 * (c) `from.email` equal to `no-reply@clorefy.com`
 * (d) `from.name` equal to `"{senderName} via Clorefy"` when senderName is non-empty
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import { sendEmail } from "@/lib/mailtrap"

describe("Feature: email-sending, Property 1: Mailtrap payload construction invariants", () => {
  beforeEach(() => {
    process.env.MAILTRAP_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MAILTRAP_API_KEY
  })

  it("should always send to the correct Mailtrap URL with correct auth header and from fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          to: fc.emailAddress(),
          subject: fc.string({ minLength: 1 }),
          html: fc.string({ minLength: 1 }),
          senderName: fc.string({ minLength: 1 }),
        }),
        async ({ to, subject, html, senderName }) => {
          let capturedUrl: string | undefined
          let capturedInit: RequestInit | undefined

          vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string, init?: RequestInit) => {
              capturedUrl = url
              capturedInit = init
              return new Response(
                JSON.stringify({ message_ids: ["test-id"] }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            })
          )

          await sendEmail({ to, subject, html, senderName })

          // (a) URL must be the Mailtrap send endpoint
          expect(capturedUrl).toBe("https://send.api.mailtrap.io/api/send")

          // (b) Authorization header must be Bearer test-key
          const headers = capturedInit?.headers as Record<string, string>
          expect(headers["Authorization"]).toBe("Bearer test-key")

          // Parse the request body
          const body = JSON.parse(capturedInit?.body as string)

          // (c) from.email must always be no-reply@clorefy.com
          expect(body.from.email).toBe("no-reply@clorefy.com")

          // (d) from.name must be "{senderName} via Clorefy" when senderName is non-empty
          expect(body.from.name).toBe(`${senderName} via Clorefy`)
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 2: Non-2xx error response structure
 * Feature: email-sending
 *
 * For any HTTP status code returned by the Mailtrap API that is outside the 2xx range
 * and is not 429, the `sendEmail` function SHALL return an error object containing
 * `success: false`, the HTTP status code, and the response body text.
 * For status 429 specifically, the error object SHALL additionally contain a numeric
 * `retryAfter` duration.
 *
 * Validates: Requirements 1.5, 1.6
 */
describe("Feature: email-sending, Property 2: Non-2xx error response structure", () => {
  beforeEach(() => {
    process.env.MAILTRAP_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MAILTRAP_API_KEY
  })

  it("should return { success: false, statusCode, message } for any non-2xx non-429 status", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }).filter((n) => n !== 429),
        fc.string(),
        async (statusCode, bodyText) => {
          vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
              new Response(bodyText, {
                status: statusCode,
                headers: { "Content-Type": "text/plain" },
              })
            )
          )

          const result = await sendEmail({
            to: "recipient@example.com",
            subject: "Test Subject",
            html: "<p>Test</p>",
            senderName: "Test Sender",
          })

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.statusCode).toBe(statusCode)
            expect(result.message).toBe(bodyText)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should return { success: false, statusCode: 429, retryAfter } for status 429", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3600 }),
        async (retryAfterSeconds) => {
          vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
              new Response("Rate limit exceeded", {
                status: 429,
                headers: {
                  "Content-Type": "text/plain",
                  "Retry-After": String(retryAfterSeconds),
                },
              })
            )
          )

          const result = await sendEmail({
            to: "recipient@example.com",
            subject: "Test Subject",
            html: "<p>Test</p>",
            senderName: "Test Sender",
          })

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.statusCode).toBe(429)
            expect(result.retryAfter).toBe(retryAfterSeconds)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
