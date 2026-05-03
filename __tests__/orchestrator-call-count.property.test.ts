/**
 * Property test: Orchestrator call count invariant (Property 4)
 * Feature: kimi-rag-orchestrator, Task 3.5
 *
 * For thinking mode + document intent + valid key → shouldOrchestrate is true
 * For fast mode → shouldOrchestrate is false
 * For chat intent → shouldOrchestrate is false
 * For missing key → shouldOrchestrate is false
 *
 * **Validates: Requirements 8.1, 5.1, 8.6**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"

// ── Pure gate function extracted from route handler ───────────────────────────

/**
 * Mirrors the shouldOrchestrate gate logic from app/api/ai/stream/route.ts:
 *   const shouldOrchestrate = body.thinkingMode === "thinking"
 *       && intentType === "document"
 *       && bedrockKey && bedrockKey.length > 10
 */
function computeShouldOrchestrate(
    thinkingMode: string,
    intentType: string,
    bedrockKey: string
): boolean {
    return (
        thinkingMode === "thinking" &&
        intentType === "document" &&
        !!bedrockKey &&
        bedrockKey.length > 10
    )
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const thinkingModeArb = fc.oneof(
    fc.constant("thinking"),
    fc.constant("fast"),
    fc.string({ minLength: 1, maxLength: 20 })
)

const intentTypeArb = fc.oneof(
    fc.constant("document"),
    fc.constant("chat"),
    fc.string({ minLength: 1, maxLength: 20 })
)

const validKeyArb = fc.string({ minLength: 11, maxLength: 100 })
const shortKeyArb = fc.string({ minLength: 0, maxLength: 10 })

// ── Property Tests ────────────────────────────────────────────────────────────

describe("Orchestrator call count invariant (Property 4)", () => {
    /**
     * Property: thinking mode + document intent + valid key → shouldOrchestrate is true
     * Validates: Requirement 8.1
     */
    it("shouldOrchestrate is true for thinking mode + document intent + valid key", () => {
        fc.assert(
            fc.property(validKeyArb, (key) => {
                const result = computeShouldOrchestrate("thinking", "document", key)
                expect(result).toBe(true)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: fast mode → shouldOrchestrate is always false (zero calls)
     * Validates: Requirement 5.1, 8.6
     */
    it("shouldOrchestrate is false for fast mode regardless of other params", () => {
        fc.assert(
            fc.property(intentTypeArb, validKeyArb, (intent, key) => {
                const result = computeShouldOrchestrate("fast", intent, key)
                expect(result).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: chat intent → shouldOrchestrate is always false
     * Validates: Requirement 8.1
     */
    it("shouldOrchestrate is false for chat intent regardless of other params", () => {
        fc.assert(
            fc.property(thinkingModeArb, validKeyArb, (mode, key) => {
                const result = computeShouldOrchestrate(mode, "chat", key)
                expect(result).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: missing/short key → shouldOrchestrate is always false
     * Validates: Requirement 8.1
     */
    it("shouldOrchestrate is false for missing or short key", () => {
        fc.assert(
            fc.property(thinkingModeArb, intentTypeArb, shortKeyArb, (mode, intent, key) => {
                const result = computeShouldOrchestrate(mode, intent, key)
                expect(result).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: empty string key → shouldOrchestrate is always false
     */
    it("shouldOrchestrate is false for empty string key", () => {
        fc.assert(
            fc.property(thinkingModeArb, intentTypeArb, (mode, intent) => {
                const result = computeShouldOrchestrate(mode, intent, "")
                expect(result).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    /**
     * Property: only the exact combination of thinking + document + valid key yields true
     * Validates: Requirements 8.1, 5.1, 8.6
     */
    it("shouldOrchestrate is true if and only if all three conditions are met", () => {
        fc.assert(
            fc.property(thinkingModeArb, intentTypeArb, fc.oneof(validKeyArb, shortKeyArb, fc.constant("")), (mode, intent, key) => {
                const result = computeShouldOrchestrate(mode, intent, key)
                const expected = mode === "thinking" && intent === "document" && !!key && key.length > 10
                expect(result).toBe(expected)
            }),
            { numRuns: 200 }
        )
    })
})
