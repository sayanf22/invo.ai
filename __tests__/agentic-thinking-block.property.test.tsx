/**
 * Property 6: AgenticThinkingBlock renders one row per activity
 * Feature: ai-dual-model-chat
 *
 * For any non-empty array of ActivityItem objects (each with unique id,
 * valid action, and label), the AgenticThinkingBlock component SHALL
 * render exactly activities.length activity rows, each containing the
 * corresponding label text.
 *
 * Validates: Requirements 6.1
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { render, screen } from "@testing-library/react"
import {
  AgenticThinkingBlock,
  type ActivityItem,
} from "@/components/ui/agentic-thinking-block"

/**
 * Arbitrary for a single ActivityItem with a unique id suffix,
 * a valid action, and a non-empty label.
 */
const activityItemArb = (index: number) =>
  fc.record({
    id: fc.constant(`activity-${index}`),
    action: fc.constantFrom("read" as const, "think" as const, "search" as const, "generate" as const, "analyze" as const, "route" as const, "context" as const),
    label: fc.string({ minLength: 1, maxLength: 60 }).filter(
      (s) => s.trim().length > 0
    ),
    detail: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined }),
  })

/**
 * Arbitrary for a non-empty array of ActivityItem objects with unique ids.
 */
const activitiesArb = fc
  .integer({ min: 1, max: 20 })
  .chain((len) =>
    fc.tuple(...Array.from({ length: len }, (_, i) => activityItemArb(i)))
  )

describe("Feature: ai-dual-model-chat, Property 6: AgenticThinkingBlock renders one row per activity", () => {
  it("should render exactly activities.length button rows for any non-empty activity array", () => {
    fc.assert(
      fc.property(activitiesArb, (activities: ActivityItem[]) => {
        const { container, unmount } = render(
          <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        // Each activity renders as a <button> element
        const buttons = container.querySelectorAll("button")
        expect(buttons.length).toBe(activities.length)

        unmount()
      }),
      { numRuns: 100 }
    )
  })

  it("should include each activity's label text in the rendered output", () => {
    fc.assert(
      fc.property(activitiesArb, (activities: ActivityItem[]) => {
        const { container, unmount } = render(
          <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        for (const activity of activities) {
          // Each label should appear in the rendered text
          expect(container.textContent).toContain(activity.label)
        }

        unmount()
      }),
      { numRuns: 100 }
    )
  })
})
