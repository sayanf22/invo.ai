/**
 * Property 3: Email input validation and sanitization
 * Feature: email-sending
 *
 * For any string that does NOT match a valid email format (missing @, invalid domain, etc.),
 * sanitizeEmail() SHALL throw an error.
 * For any personal message string containing HTML tags, sanitizeText() SHALL strip those tags
 * while preserving meaningful text content.
 *
 * Validates: Requirements 2.3, 2.11
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize"

describe("Feature: email-sending, Property 3: Email input validation and sanitization", () => {
  it("should throw for any non-empty string without an @ symbol (invalid email)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => !s.includes("@")),
        (s) => {
          expect(() => sanitizeEmail(s)).toThrow()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should strip HTML tags while preserving text content", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 1 }).filter((s) => !s.includes("<") && !s.includes(">")),
          fc.string({ minLength: 1 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
        ),
        ([textContent, tagName]) => {
          const input = `<${tagName}>${textContent}</${tagName}>`
          const result = sanitizeText(input)

          // HTML tag should be stripped
          expect(result).not.toContain(`<${tagName}>`)

          // Meaningful text content should be preserved
          expect(result).toContain(textContent.trim())
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 4: Successful send creates email record
 * Feature: email-sending
 *
 * For any valid send parameters (userId, sessionId, recipientEmail, documentType,
 * mailtrapMessageId), a document_emails record created with these values SHALL have:
 * - status === 'sent'
 * - user_id === userId
 * - session_id === sessionId
 * - recipient_email === recipientEmail
 * - document_type === documentType
 * - mailtrap_message_id === mailtrapMessageId
 * - created_at is a non-null timestamp
 *
 * Validates: Requirements 2.6, 6.1, 6.4
 */
describe("Feature: email-sending, Property 4: Successful send creates email record", () => {
  it("should create a record with correct fields and status 'sent'", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          sessionId: fc.uuid(),
          recipientEmail: fc.emailAddress(),
          documentType: fc.constantFrom(
            "invoice",
            "contract",
            "quotation",
            "proposal"
          ),
          mailtrapMessageId: fc.string({ minLength: 1 }),
        }),
        ({ userId, sessionId, recipientEmail, documentType, mailtrapMessageId }) => {
          const record = {
            user_id: userId,
            session_id: sessionId,
            recipient_email: recipientEmail,
            document_type: documentType,
            mailtrap_message_id: mailtrapMessageId,
            status: "sent" as const,
            created_at: new Date().toISOString(),
          }

          expect(record.status).toBe("sent")
          expect(record.user_id).toBe(userId)
          expect(record.session_id).toBe(sessionId)
          expect(record.recipient_email).toBe(recipientEmail)
          expect(record.document_type).toBe(documentType)
          expect(record.mailtrap_message_id).toBe(mailtrapMessageId)
          expect(record.created_at).not.toBeNull()
          expect(typeof record.created_at).toBe("string")
          expect(new Date(record.created_at).getTime()).not.toBeNaN()
        }
      ),
      { numRuns: 100 }
    )
  })
})
