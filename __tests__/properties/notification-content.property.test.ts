// Feature: esignature-upgrade, Property 10: Notification content correctness

/**
 * Property-based tests for lib/notification-builder.ts (buildSignatureNotification helper)
 *
 * Property 10: Notification content correctness
 * For any signing event that triggers an owner notification (viewed, signed,
 * completed, expired), the created notification row SHALL have the correct
 * `type`, a non-empty `title`, and a `message` that contains the signer's
 * name and the document type.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildSignatureNotification } from "@/lib/notification-builder"
import type { SignatureNotificationType } from "@/lib/notification-builder"

// ── Generators ────────────────────────────────────────────────────────────────

const uuidArb = fc.uuid()

const notificationTypeArb = fc.constantFrom<SignatureNotificationType>(
  "signature_viewed",
  "signature_signed",
  "signature_completed",
  "signature_expired"
)

/** Non-empty signer name (at least 2 chars, no leading/trailing whitespace) */
const signerNameArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0)
  )
  .map(([first, last]) => `${first} ${last}`)

/** Non-empty document type */
const documentTypeArb = fc.constantFrom(
  "invoice",
  "contract",
  "quotation",
  "proposal"
)

/** Non-empty reference number */
const referenceNumberArb = fc
  .tuple(
    fc.constantFrom("INV", "CON", "QUO", "PRO"),
    fc.integer({ min: 1000, max: 9999 })
  )
  .map(([prefix, num]) => `${prefix}-${num}`)

// ── Property 10: Notification content correctness ────────────────────────────

describe("Feature: esignature-upgrade, Property 10: Notification content correctness", () => {
  /**
   * For any signing event, the notification SHALL have the correct type.
   */
  it("should always produce a notification with the correct type", () => {
    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.type).toBe(type)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * For any signing event, the notification SHALL have a non-empty title.
   */
  it("should always produce a notification with a non-empty title", () => {
    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(typeof notification.title).toBe("string")
          expect(notification.title.trim().length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * For any signing event, the notification message SHALL contain the signer name.
   * Exception: signature_completed does not include signer name per spec.
   */
  it("should always include signer name in the message for viewed, signed, and expired events", () => {
    const typesWithSignerName = fc.constantFrom<SignatureNotificationType>(
      "signature_viewed",
      "signature_signed",
      "signature_expired"
    )

    fc.assert(
      fc.property(
        typesWithSignerName,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.message).toContain(signerName)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * For any signing event, the notification message SHALL contain the document type.
   */
  it("should always include document type in the message", () => {
    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.message).toContain(documentType)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The notification SHALL have the correct title per type.
   */
  it("should produce the correct title for each notification type", () => {
    const expectedTitles: Record<SignatureNotificationType, string> = {
      signature_viewed: "Document Viewed",
      signature_signed: "Document Signed",
      signature_completed: "All Signatures Complete",
      signature_expired: "Signing Link Expired",
    }

    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.title).toBe(expectedTitles[type])
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The notification SHALL have the correct user_id.
   */
  it("should always set the correct user_id", () => {
    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.user_id).toBe(userId)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The notification metadata SHALL contain session_id and signature_id.
   */
  it("should always include session_id and signature_id in metadata", () => {
    fc.assert(
      fc.property(
        notificationTypeArb,
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (type, userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const notification = buildSignatureNotification(
            type, userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(notification.metadata.session_id).toBe(sessionId)
          expect(notification.metadata.signature_id).toBe(signatureId)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Verify exact message format for each notification type per spec.
   */
  it("should produce the exact message format specified for each type", () => {
    fc.assert(
      fc.property(
        uuidArb,
        signerNameArb,
        documentTypeArb,
        referenceNumberArb,
        uuidArb,
        uuidArb,
        (userId, signerName, documentType, referenceNumber, sessionId, signatureId) => {
          const viewed = buildSignatureNotification(
            "signature_viewed", userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(viewed.message).toBe(`${signerName} viewed your ${documentType} for signing.`)

          const signed = buildSignatureNotification(
            "signature_signed", userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(signed.message).toBe(`${signerName} signed your ${documentType} ${referenceNumber}.`)

          const completed = buildSignatureNotification(
            "signature_completed", userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(completed.message).toBe(`Your ${documentType} ${referenceNumber} has been fully signed by all parties.`)

          const expired = buildSignatureNotification(
            "signature_expired", userId, signerName, documentType, referenceNumber, sessionId, signatureId
          )
          expect(expired.message).toBe(`The signing link for ${signerName} on ${documentType} ${referenceNumber} has expired.`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
