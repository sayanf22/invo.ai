import { describe, it, expect } from "vitest"
import { classifyIntentFull, detectMismatch } from "@/lib/intent-router"

/**
 * Unit tests for the full intent classifier and mismatch detection
 * used by the chat-first document flow.
 *
 * Validates: chat-first-document-flow requirements 2.2, 2.3, 2.5, 2.6, 4.2, 4.6.
 */

describe("classifyIntentFull — explicit create routing", () => {
  it("routes explicit invoice create with client and amount", () => {
    const result = classifyIntentFull("Create an invoice for Acme Corp for $1500 web design work")
    expect(result.route).toBe("document-explicit")
    expect(result.suggestedType).toBe("invoice")
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it("routes explicit contract create with scope and duration", () => {
    const result = classifyIntentFull(
      "Generate a service agreement for 6-month consulting with John Doe at Acme"
    )
    expect(result.route).toBe("document-explicit")
    expect(result.suggestedType).toBe("contract")
  })

  it("routes explicit quote create with client and scope", () => {
    const result = classifyIntentFull("Make a quote for 50 custom branded t-shirts for Acme Sports")
    expect(result.route).toBe("document-explicit")
    // "quotation" is a legacy alias — the canonical type is now "quote"
    expect(result.suggestedType).toBe("quote")
  })
})

describe("classifyIntentFull — question routing", () => {
  it("routes a what-question to chat", () => {
    const result = classifyIntentFull("What should I send my client after onboarding?")
    expect(result.route).toBe("chat")
  })

  it("routes a how-question to chat", () => {
    const result = classifyIntentFull("How do I charge clients in different currencies?")
    expect(result.route).toBe("chat")
  })

  it("routes a should-question to chat", () => {
    const result = classifyIntentFull("Should I use a contract or an invoice for a fixed-price project?")
    expect(result.route).toBe("chat")
  })
})

describe("classifyIntentFull — ambiguous routing", () => {
  it("routes bare doc type name to ambiguous", () => {
    const result = classifyIntentFull("invoice")
    expect(result.route).toBe("ambiguous")
    expect(result.suggestedType).toBe("invoice")
  })

  it("routes vague create request to ambiguous", () => {
    const result = classifyIntentFull("I need a contract")
    expect(result.route).toBe("ambiguous")
    expect(result.suggestedType).toBe("contract")
  })

  it("routes help-with request to ambiguous", () => {
    const result = classifyIntentFull("help me with an invoice")
    expect(result.route).toBe("ambiguous")
    expect(result.suggestedType).toBe("invoice")
  })
})

describe("classifyIntentFull — category fallback", () => {
  it("uses selectedCategory when prompt has no type keyword", () => {
    const result = classifyIntentFull(
      "create one for Acme Corp with $1500 for the logo design project",
      "Invoice"
    )
    expect(result.route).toBe("document-explicit")
    expect(result.suggestedType).toBe("invoice")
  })
})

describe("detectMismatch — the four required patterns", () => {
  it("flags contract-for-payment as invoice", () => {
    const result = detectMismatch("create a contract for a $1000 payment", "contract")
    expect(result).not.toBeNull()
    expect(result!.suggestedType).toBe("invoice")
    expect(result!.requestedType).toBe("contract")
  })

  it("flags invoice-for-employment as contract", () => {
    const result = detectMismatch("invoice for an employment agreement with terms", "invoice")
    expect(result).not.toBeNull()
    expect(result!.suggestedType).toBe("contract")
  })

  it("flags quote-already-agreed as invoice", () => {
    const result = detectMismatch(
      "quotation for the already agreed work, payment due next week",
      "quote"
    )
    expect(result).not.toBeNull()
    expect(result!.suggestedType).toBe("invoice")
  })

  it("flags proposal-with-line-items as quote", () => {
    const result = detectMismatch(
      "proposal with line items and unit price per hour",
      "proposal"
    )
    expect(result).not.toBeNull()
    expect(result!.suggestedType).toBe("quote")
  })

  it("returns null when the request is internally consistent", () => {
    const result = detectMismatch("create an invoice for a $1000 payment", "invoice")
    expect(result).toBeNull()
  })

  it("only matches rules for the requested type", () => {
    // "employment agreement" would flag if requestedType were 'invoice', but
    // here we pass 'contract' as requested so no rule fires.
    const result = detectMismatch("contract for employment agreement with terms", "contract")
    expect(result).toBeNull()
  })
})
