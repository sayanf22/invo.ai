/**
 * Unit tests for thinking mode model selection.
 *
 * Tests the resolveThinkingMode() and getModelConfig() functions that
 * control which DeepSeek model is used and whether reasoning events
 * are emitted.
 *
 * Validates: Requirements 3.2, 3.3, 7.1, 7.2, 7.4
 */
import { describe, it, expect } from "vitest"
import { resolveThinkingMode, getModelConfig } from "@/lib/deepseek"

describe("resolveThinkingMode", () => {
    it('"fast" → returns "fast"', () => {
        expect(resolveThinkingMode("fast")).toBe("fast")
    })

    it('"thinking" → returns "thinking"', () => {
        expect(resolveThinkingMode("thinking")).toBe("thinking")
    })

    it("invalid string value → defaults to 'fast'", () => {
        expect(resolveThinkingMode("turbo")).toBe("fast")
        expect(resolveThinkingMode("slow")).toBe("fast")
        expect(resolveThinkingMode("FAST")).toBe("fast") // case-sensitive
        expect(resolveThinkingMode("THINKING")).toBe("fast")
        expect(resolveThinkingMode("")).toBe("fast")
    })

    it("undefined → defaults to 'fast'", () => {
        expect(resolveThinkingMode(undefined)).toBe("fast")
    })

    it("null → defaults to 'fast'", () => {
        expect(resolveThinkingMode(null)).toBe("fast")
    })

    it("non-string types → defaults to 'fast'", () => {
        expect(resolveThinkingMode(0)).toBe("fast")
        expect(resolveThinkingMode(1)).toBe("fast")
        expect(resolveThinkingMode(true)).toBe("fast")
        expect(resolveThinkingMode(false)).toBe("fast")
        expect(resolveThinkingMode({})).toBe("fast")
        expect(resolveThinkingMode([])).toBe("fast")
    })
})

describe("getModelConfig", () => {
    describe('thinkingMode: "fast"', () => {
        const config = getModelConfig("fast")

        it("uses deepseek-chat model", () => {
            expect(config.model).toBe("deepseek-chat")
        })

        it("isThinking is false (no reasoning events)", () => {
            expect(config.isThinking).toBe(false)
        })

        it("sets temperature 0.3, no reasoning_effort", () => {
            expect(config.extraParams).toEqual({ temperature: 0.3 })
            expect(config.extraParams).not.toHaveProperty("reasoning_effort")
        })
    })

    describe('thinkingMode: "thinking"', () => {
        const config = getModelConfig("thinking")

        it("uses deepseek-v4-pro model", () => {
            expect(config.model).toBe("deepseek-v4-pro")
        })

        it("isThinking is true (emits reasoning events)", () => {
            expect(config.isThinking).toBe(true)
        })

        it('sets reasoning_effort "low", no temperature', () => {
            expect(config.extraParams).toEqual({ reasoning_effort: "low" })
            expect(config.extraParams).not.toHaveProperty("temperature")
        })
    })
})

describe("end-to-end: resolveThinkingMode → getModelConfig", () => {
    it('"fast" input → deepseek-chat, no reasoning', () => {
        const mode = resolveThinkingMode("fast")
        const config = getModelConfig(mode)
        expect(config.model).toBe("deepseek-chat")
        expect(config.isThinking).toBe(false)
    })

    it('"thinking" input → deepseek-v4-pro, reasoning enabled', () => {
        const mode = resolveThinkingMode("thinking")
        const config = getModelConfig(mode)
        expect(config.model).toBe("deepseek-v4-pro")
        expect(config.isThinking).toBe(true)
    })

    it("invalid input → defaults to fast → deepseek-chat", () => {
        const mode = resolveThinkingMode("invalid")
        const config = getModelConfig(mode)
        expect(config.model).toBe("deepseek-chat")
        expect(config.isThinking).toBe(false)
    })

    it("undefined input → defaults to fast → deepseek-chat", () => {
        const mode = resolveThinkingMode(undefined)
        const config = getModelConfig(mode)
        expect(config.model).toBe("deepseek-chat")
        expect(config.isThinking).toBe(false)
    })
})
