/**
 * Property 2: buildPrompt includes all provided context sections
 * Feature: ai-dual-model-chat
 *
 * For any valid AIGenerationRequest with a non-empty business profile
 * (name, country, currency), the output of buildPrompt() SHALL contain
 * the business name, country, currency, and document type.
 * If complianceContext is provided, the output SHALL contain it.
 * If conversationHistory is provided, the output SHALL contain at least
 * the last message from the history.
 * If fileContext is provided, the output SHALL contain it.
 *
 * Validates: Requirements 3.1
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildPrompt, type AIGenerationRequest } from "@/lib/deepseek"

// Use alphanumeric strings to avoid regex/string matching issues
const alphanumArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789".split("")), {
    minLength: 3,
    maxLength: 20,
  })
  .map((chars) => chars.join(""))

const documentTypeArb = fc.constantFrom("invoice", "contract", "quotation", "proposal")

// Generator for a non-empty business context
const businessContextArb = fc.record({
  name: alphanumArb,
  country: alphanumArb,
  currency: alphanumArb,
  address: fc.constant("123 Test Street"),
  paymentTerms: fc.constantFrom("Net 30", "Net 15", "Due on Receipt"),
})

// Generator for conversation history entries
const conversationEntryArb = fc.record({
  role: fc.constantFrom("user" as const, "assistant" as const),
  content: alphanumArb,
})

const conversationHistoryArb = fc.array(conversationEntryArb, {
  minLength: 1,
  maxLength: 10,
})

describe("Feature: ai-dual-model-chat, Property 2: buildPrompt includes all provided context sections", () => {
  it("output contains business name, country, currency, and document type", () => {
    /**
     * Validates: Requirements 3.1
     *
     * When buildPrompt receives a request with a non-empty business profile,
     * the output SHALL contain the business name, country, currency, and
     * document type.
     */
    fc.assert(
      fc.property(
        alphanumArb,
        businessContextArb,
        documentTypeArb,
        (prompt, biz, docType) => {
          const request: AIGenerationRequest = {
            prompt,
            documentType: docType,
            businessContext: biz,
          }
          const output = buildPrompt(request)

          expect(output).toContain(biz.name)
          expect(output).toContain(biz.country)
          expect(output).toContain(biz.currency)
          expect(output).toContain(docType)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("output contains complianceContext when provided", () => {
    /**
     * Validates: Requirements 3.1
     *
     * When complianceContext is provided, the output SHALL contain
     * the compliance context string.
     */
    fc.assert(
      fc.property(
        alphanumArb,
        businessContextArb,
        documentTypeArb,
        alphanumArb,
        (prompt, biz, docType, compliance) => {
          const request: AIGenerationRequest = {
            prompt,
            documentType: docType,
            businessContext: biz,
            complianceContext: compliance,
          }
          const output = buildPrompt(request)

          expect(output).toContain(compliance)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("output contains at least the last message from conversationHistory when provided", () => {
    /**
     * Validates: Requirements 3.1
     *
     * When conversationHistory is provided, the output SHALL contain
     * at least the last message content from the history.
     */
    fc.assert(
      fc.property(
        alphanumArb,
        businessContextArb,
        documentTypeArb,
        conversationHistoryArb,
        (prompt, biz, docType, history) => {
          const request: AIGenerationRequest = {
            prompt,
            documentType: docType,
            businessContext: biz,
            conversationHistory: history,
          }
          const output = buildPrompt(request)

          const lastMessage = history[history.length - 1]
          expect(output).toContain(lastMessage.content)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("output contains fileContext when provided", () => {
    /**
     * Validates: Requirements 3.1
     *
     * When fileContext is provided, the output SHALL contain
     * the file context string.
     */
    fc.assert(
      fc.property(
        alphanumArb,
        businessContextArb,
        documentTypeArb,
        alphanumArb,
        (prompt, biz, docType, fileCtx) => {
          const request: AIGenerationRequest = {
            prompt,
            documentType: docType,
            businessContext: biz,
            fileContext: fileCtx,
          }
          const output = buildPrompt(request)

          expect(output).toContain(fileCtx)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("output always contains document type and user prompt regardless of optional fields", () => {
    /**
     * Validates: Requirements 3.1
     *
     * For any request, the output SHALL always contain the document type
     * and the user prompt text.
     */
    fc.assert(
      fc.property(
        alphanumArb,
        documentTypeArb,
        fc.option(businessContextArb, { nil: undefined }),
        fc.option(alphanumArb, { nil: undefined }),
        fc.option(conversationHistoryArb, { nil: undefined }),
        fc.option(alphanumArb, { nil: undefined }),
        (prompt, docType, biz, compliance, history, fileCtx) => {
          const request: AIGenerationRequest = {
            prompt,
            documentType: docType,
            businessContext: biz,
            complianceContext: compliance,
            conversationHistory: history,
            fileContext: fileCtx,
          }
          const output = buildPrompt(request)

          expect(output).toContain(docType)
          expect(output).toContain(prompt)
        }
      ),
      { numRuns: 100 }
    )
  })
})
