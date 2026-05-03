import { describe, it, expect } from "vitest"
import { classifyIntent } from "@/lib/intent-router"

/**
 * Unit tests for intent classification edge cases.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
describe("classifyIntent – edge cases", () => {
  // Requirement 1.3: Ambiguous / empty → defaults to "chat"
  it('returns "chat" for an empty string', () => {
    expect(classifyIntent("")).toBe("chat")
  })

  // Single-word prompts
  describe("single word prompts", () => {
    it('returns "chat" for "hello" (no verb, no question word)', () => {
      expect(classifyIntent("hello")).toBe("chat")
    })

    it('returns "document" for "create" (generation verb)', () => {
      expect(classifyIntent("create")).toBe("document")
    })

    it('returns "chat" for "what" (question word only)', () => {
      expect(classifyIntent("what")).toBe("chat")
    })
  })

  // Requirement 1.4: Both question words and generation verbs → "document"
  it('returns "document" for mixed intent "can you create an invoice"', () => {
    expect(classifyIntent("can you create an invoice")).toBe("document")
  })

  // Requirement 1.2: Question words without generation verbs → "chat"
  it('returns "chat" for question-only "what is GST"', () => {
    expect(classifyIntent("what is GST")).toBe("chat")
  })

  // Requirement 1.3: Ambiguous – no verb, no question word → "chat"
  it('returns "chat" for ambiguous "invoice" (no verb)', () => {
    expect(classifyIntent("invoice")).toBe("chat")
  })

  // Long prompts with both patterns
  describe("long prompts with both patterns", () => {
    it('returns "document" for a long prompt with generation verb and question words', () => {
      const prompt =
        "I was wondering how to handle tax compliance, but can you please create a detailed invoice for my client in Germany with all the required fields and VAT information"
      expect(classifyIntent(prompt)).toBe("document")
    })

    it('returns "chat" for a long prompt with only question words', () => {
      const prompt =
        "Can you explain how invoicing works in the UAE and what are the VAT requirements for businesses operating in the free trade zones"
      expect(classifyIntent(prompt)).toBe("chat")
    })
  })
})
