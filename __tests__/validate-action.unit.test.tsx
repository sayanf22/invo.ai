/**
 * Unit tests for validate action icon rendering in AgenticThinkingBlock
 * Feature: kimi-rag-orchestrator, Task 2.2
 *
 * Validates: Requirements 4.2, 4.4
 */
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import {
    AgenticThinkingBlock,
    type ActivityItem,
} from "@/components/ui/agentic-thinking-block"

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Validate action icon rendering", () => {
    /**
     * Validates: Requirement 4.2 — validate action renders with ShieldCheck icon
     * Validates: Requirement 4.4 — new "validate" action type supported
     */
    it("renders AgenticThinkingBlock with a validate activity item without errors", () => {
        const activities: ActivityItem[] = [
            {
                id: "validate-1",
                action: "validate",
                label: "Validating compliance",
                detail: "Compliant",
                reasoningText: "✅ Tax rate matches. ✅ Currency correct. ✅ All mandatory fields present.",
            },
        ]

        const { container } = render(
            <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        // Component should render (not be empty)
        expect(container.innerHTML).not.toBe("")
    })

    it("displays the activity label text for validate action", () => {
        const activities: ActivityItem[] = [
            {
                id: "validate-1",
                action: "validate",
                label: "Validating compliance",
                detail: "Issues found",
                reasoningText: "⚠️ Tax rate mismatch: expected 18%, found 15%.",
            },
        ]

        const { container } = render(
            <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        // The label text should appear
        expect(container.textContent).toContain("Validating compliance")
        // The detail text should appear
        expect(container.textContent).toContain("Issues found")
    })

    it("renders validate action alongside other action types", () => {
        const activities: ActivityItem[] = [
            {
                id: "read-1",
                action: "read",
                label: "Reading business profile",
                detail: "Acme Corp • India • INR",
            },
            {
                id: "search-1",
                action: "search",
                label: "Searching India compliance",
                detail: "Found 5 rules",
            },
            {
                id: "generate-1",
                action: "generate",
                label: "Writing invoice",
                detail: "DeepSeek",
            },
            {
                id: "validate-1",
                action: "validate",
                label: "Validating compliance",
                detail: "Compliant",
                reasoningText: "✅ All checks passed.",
            },
        ]

        const { container } = render(
            <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        // All labels should be present
        expect(container.textContent).toContain("Reading business profile")
        expect(container.textContent).toContain("Searching India compliance")
        expect(container.textContent).toContain("Writing invoice")
        expect(container.textContent).toContain("Validating compliance")

        // Should have 4 activity buttons
        const buttons = container.querySelectorAll("button")
        expect(buttons.length).toBe(4)
    })

    it("renders the ShieldCheck SVG icon for validate action", () => {
        const activities: ActivityItem[] = [
            {
                id: "validate-1",
                action: "validate",
                label: "Validating compliance",
                detail: "Compliant",
            },
        ]

        const { container } = render(
            <AgenticThinkingBlock activities={activities} isWorking={false} />
        )

        // The icon container should have an SVG (ShieldCheck renders as SVG)
        const iconSpan = container.querySelector("span.w-8.h-8")
        expect(iconSpan).not.toBeNull()
        const svg = iconSpan?.querySelector("svg")
        expect(svg).not.toBeNull()
    })
})
