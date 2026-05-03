/**
 * Unit tests for AgenticThinkingBlock behavior
 * Feature: ai-dual-model-chat, Task 7.4
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.7
 */
import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import {
  AgenticThinkingBlock,
  type ActivityItem,
} from "@/components/ui/agentic-thinking-block"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ActivityItem> & { id: string }): ActivityItem {
  return {
    action: "read",
    label: "Test activity",
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AgenticThinkingBlock unit tests", () => {
  // Requirement 6.1 — empty activities renders nothing
  it("renders nothing when activities array is empty", () => {
    const { container } = render(
      <AgenticThinkingBlock activities={[]} isWorking={false} />
    )
    expect(container.innerHTML).toBe("")
  })

  // Requirement 6.7 — no vertical connecting line for single activity
  it("does not render a vertical connecting line for a single activity", () => {
    const activities: ActivityItem[] = [
      makeActivity({ id: "a1", action: "read", label: "Business profile" }),
    ]
    const { container } = render(
      <AgenticThinkingBlock activities={activities} isWorking={false} />
    )
    const dottedLine = container.querySelector(".border-dotted")
    expect(dottedLine).toBeNull()
  })

  // Requirement 6.7 — vertical connecting line present for multiple activities
  it("renders a vertical connecting line when multiple activities are present", () => {
    const activities: ActivityItem[] = [
      makeActivity({ id: "a1", action: "read", label: "Business profile" }),
      makeActivity({ id: "a2", action: "search", label: "Compliance rules" }),
    ]
    const { container } = render(
      <AgenticThinkingBlock activities={activities} isWorking={false} />
    )
    const dottedLine = container.querySelector(".border-dotted")
    expect(dottedLine).not.toBeNull()
  })

  // Requirement 6.2 — pulse animation on last row when isWorking is true
  it("applies pulse animation to the last row when isWorking is true", () => {
    const activities: ActivityItem[] = [
      makeActivity({ id: "a1", action: "read", label: "Business profile", detail: "Acme Corp" }),
      makeActivity({ id: "a2", action: "generate", label: "Generating document" }),
    ]
    const { container } = render(
      <AgenticThinkingBlock activities={activities} isWorking={true} />
    )

    const buttons = container.querySelectorAll("button")
    const lastButton = buttons[buttons.length - 1]

    // The icon span and label span in the last row should have animate-pulse
    const pulsingElements = lastButton.querySelectorAll(".animate-pulse")
    expect(pulsingElements.length).toBeGreaterThan(0)

    // First row should NOT have pulse (it has a detail so it wouldn't pulse anyway,
    // but also it's not the last row)
    const firstButton = buttons[0]
    const firstPulsing = firstButton.querySelectorAll(".animate-pulse")
    expect(firstPulsing.length).toBe(0)
  })

  // Requirement 6.3 — no pulse animation when isWorking is false
  it("does not apply pulse animation when isWorking is false", () => {
    const activities: ActivityItem[] = [
      makeActivity({ id: "a1", action: "read", label: "Business profile" }),
      makeActivity({ id: "a2", action: "generate", label: "Generating document" }),
    ]
    const { container } = render(
      <AgenticThinkingBlock activities={activities} isWorking={false} />
    )

    const pulsingElements = container.querySelectorAll(".animate-pulse")
    expect(pulsingElements.length).toBe(0)
  })

  // Requirement 6.5 — expandable "think" row toggles reasoning text visibility
  it("toggles reasoning text visibility when clicking an expandable think row", () => {
    const reasoningText = "Let me analyze the tax implications for this invoice."
    const activities: ActivityItem[] = [
      makeActivity({
        id: "a1",
        action: "think",
        label: "Thinking",
        reasoningText,
      }),
    ]
    const { container } = render(
      <AgenticThinkingBlock activities={activities} isWorking={false} />
    )

    // The expandable content container should start collapsed (gridTemplateRows: 0fr)
    const expandableDiv = container.querySelector(
      ".grid.transition-all"
    ) as HTMLElement
    expect(expandableDiv).not.toBeNull()
    expect(expandableDiv.style.gridTemplateRows).toBe("0fr")

    // Click the button to expand
    const button = container.querySelector("button")!
    fireEvent.click(button)

    // After click, gridTemplateRows should be "1fr" (expanded)
    expect(expandableDiv.style.gridTemplateRows).toBe("1fr")

    // The reasoning text should be in the DOM (it's always in DOM, just hidden via overflow)
    expect(container.textContent).toContain(reasoningText)

    // Click again to collapse
    fireEvent.click(button)
    expect(expandableDiv.style.gridTemplateRows).toBe("0fr")
  })

  // Requirement 6.4 — component persists in DOM after isWorking transitions from true to false
  it("persists in DOM after isWorking transitions from true to false", () => {
    const activities: ActivityItem[] = [
      makeActivity({ id: "a1", action: "read", label: "Business profile", detail: "Acme Corp" }),
      makeActivity({ id: "a2", action: "generate", label: "Generating document", detail: "DeepSeek" }),
    ]

    // Render with isWorking: true
    const { container, rerender } = render(
      <AgenticThinkingBlock activities={activities} isWorking={true} />
    )

    // Component should be in the DOM
    const buttons = container.querySelectorAll("button")
    expect(buttons.length).toBe(2)

    // Re-render with isWorking: false (simulating completion)
    rerender(
      <AgenticThinkingBlock activities={activities} isWorking={false} />
    )

    // Component should still be in the DOM with all activities
    const buttonsAfter = container.querySelectorAll("button")
    expect(buttonsAfter.length).toBe(2)
    expect(container.textContent).toContain("Business profile")
    expect(container.textContent).toContain("Generating document")
    expect(container.innerHTML).not.toBe("")
  })
})
