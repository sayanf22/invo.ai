/**
 * Property 3: Code fence stripping preserves inner content
 * Feature: ai-dual-model-chat
 *
 * For any non-empty content string that does not itself contain the sequence "```",
 * wrapping it in any of the markdown code fence patterns (```json\n{content}\n```
 * or ```\n{content}\n```) and then applying the stripping logic SHALL produce a
 * result that, when trimmed, equals the original content string trimmed.
 *
 * **Validates: Requirements 3.5**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { stripCodeFences } from "@/lib/deepseek"

describe("Feature: ai-dual-model-chat, Property 3: Code fence stripping preserves inner content", () => {
    /** Generate non-empty strings that do not contain "```" */
    const contentArb = fc.string().filter(
        (s) => !s.includes("```") && s.trim().length > 0
    )

    it("strips ```json fences and preserves inner content", () => {
        /**
         * **Validates: Requirements 3.5**
         *
         * Wrap random content in ```json\n{content}\n``` and verify
         * stripping recovers the original trimmed content.
         */
        fc.assert(
            fc.property(contentArb, (content) => {
                const wrapped = "```json\n" + content + "\n```"
                const result = stripCodeFences(wrapped)
                expect(result).toBe(content.trim())
            }),
            { numRuns: 100 }
        )
    })

    it("strips bare ``` fences and preserves inner content", () => {
        /**
         * **Validates: Requirements 3.5**
         *
         * Wrap random content in ```\n{content}\n``` and verify
         * stripping recovers the original trimmed content.
         */
        fc.assert(
            fc.property(contentArb, (content) => {
                const wrapped = "```\n" + content + "\n```"
                const result = stripCodeFences(wrapped)
                expect(result).toBe(content.trim())
            }),
            { numRuns: 100 }
        )
    })

    it("content without code fences is returned unchanged (trimmed)", () => {
        /**
         * **Validates: Requirements 3.5**
         *
         * Content that doesn't start with ``` should pass through
         * unchanged (only trimmed).
         */
        fc.assert(
            fc.property(contentArb, (content) => {
                const result = stripCodeFences(content)
                expect(result).toBe(content.trim())
            }),
            { numRuns: 100 }
        )
    })
})
