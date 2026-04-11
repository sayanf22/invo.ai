/**
 * Property 3: MessageLimitBanner displays count and limit
 * Feature: document-linking-and-usage-tracking
 *
 * For any `currentMessages` value and for any `limit` value,
 * rendering the MessageLimitBanner component SHALL produce output
 * containing the text "You've reached the message limit for this session",
 * the `currentMessages` number, and the `limit` number.
 *
 * Validates: Requirements 3.2
 */
import { describe, it, expect, vi } from "vitest"
import * as fc from "fast-check"
import { render } from "@testing-library/react"
import { MessageLimitBanner } from "@/components/message-limit-banner"

describe("Feature: document-linking-and-usage-tracking, Property 3: MessageLimitBanner displays count and limit", () => {
  it("should display the limit text, currentMessages, and limit for any positive integer pair", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (currentMessages, limit) => {
          const onCreateDocument = vi.fn()

          const { container } = render(
            <MessageLimitBanner
              currentMessages={currentMessages}
              limit={limit}
              tier="free"
              currentDocType="invoice"
              hasChain={false}
              parentSessionId="test-session-id"
              onCreateDocument={onCreateDocument}
            />
          )

          const text = container.textContent || ""

          // Assert the banner contains the limit-reached message
          // &apos; renders as standard ASCII apostrophe (')
          expect(text).toContain(
            "You've reached the message limit for this session"
          )

          // Assert the banner contains the currentMessages/limit format
          expect(text).toContain(`${currentMessages}/${limit}`)
        }
      ),
      { numRuns: 100 }
    )
  })
})
