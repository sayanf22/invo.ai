/**
 * Property 1: Intent classification follows priority rules
 * Feature: ai-dual-model-chat
 *
 * For any user prompt string, the intent classification SHALL satisfy:
 * - Generation verbs without question-only patterns → "document"
 * - Question words without generation verbs → "chat"
 * - Both present → "document" (generation takes priority)
 * - Neither present → "chat" (default)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { classifyIntent } from "@/lib/intent-router"

// The exact verb/word lists from the implementation
const GENERATION_VERB_LIST = [
  "create",
  "generate",
  "make",
  "build",
  "draft",
  "prepare",
  "change",
  "update",
  "add",
  "remove",
  "modify",
]

const STRONG_GENERATION_VERB_LIST = ["create", "generate", "make"]

const WEAK_GENERATION_VERB_LIST = GENERATION_VERB_LIST.filter(
  (v) => !STRONG_GENERATION_VERB_LIST.includes(v)
)

const QUESTION_WORD_LIST = [
  "what",
  "how",
  "why",
  "explain",
  "tell me",
  "can you",
  "is it",
  "does",
  "should",
]

// Arbitrary for filler text that does NOT contain any generation verbs or question words.
// We use a safe word list that won't accidentally contain keywords.
const SAFE_WORDS = [
  "the",
  "invoice",
  "my",
  "for",
  "a",
  "this",
  "new",
  "please",
  "now",
  "client",
  "project",
  "report",
  "file",
  "item",
  "total",
  "price",
  "number",
  "list",
  "ok",
  "yes",
  "hello",
  "hi",
  "thanks",
]

const safeFillerArb = fc
  .array(fc.constantFrom(...SAFE_WORDS), { minLength: 0, maxLength: 5 })
  .map((words) => words.join(" "))

// Arbitrary that picks one generation verb
const generationVerbArb = fc.constantFrom(...GENERATION_VERB_LIST)

// Arbitrary that picks one strong generation verb
const strongGenerationVerbArb = fc.constantFrom(...STRONG_GENERATION_VERB_LIST)

// Arbitrary that picks one weak generation verb (not in strong list)
const weakGenerationVerbArb = fc.constantFrom(...WEAK_GENERATION_VERB_LIST)

// Arbitrary that picks one question word
const questionWordArb = fc.constantFrom(...QUESTION_WORD_LIST)

// Helper to build a prompt from parts with filler
function buildPrompt(parts: string[], filler: string): string {
  // Interleave filler around the keyword parts
  return `${filler} ${parts.join(" ")} ${filler}`.trim()
}

describe("Feature: ai-dual-model-chat, Property 1: Intent classification follows priority rules", () => {
  it("generation verbs without question words → 'document'", () => {
    /**
     * Validates: Requirements 1.1
     *
     * When a prompt contains generation verbs and no question words,
     * classifyIntent SHALL return "document".
     */
    fc.assert(
      fc.property(
        generationVerbArb,
        safeFillerArb,
        (verb, filler) => {
          const prompt = buildPrompt([verb], filler)
          expect(classifyIntent(prompt)).toBe("document")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("question words without generation verbs → 'chat'", () => {
    /**
     * Validates: Requirements 1.2
     *
     * When a prompt contains question words and no generation verbs,
     * classifyIntent SHALL return "chat".
     */
    fc.assert(
      fc.property(
        questionWordArb,
        safeFillerArb,
        (questionWord, filler) => {
          const prompt = buildPrompt([questionWord], filler)
          expect(classifyIntent(prompt)).toBe("chat")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("both question words and strong generation verbs → 'document' (generation takes priority)", () => {
    /**
     * Validates: Requirements 1.4
     *
     * When a prompt contains both question words and strong generation verbs
     * (create, generate, make), classifyIntent SHALL return "document"
     * because generation takes priority.
     */
    fc.assert(
      fc.property(
        questionWordArb,
        strongGenerationVerbArb,
        safeFillerArb,
        (questionWord, verb, filler) => {
          const prompt = buildPrompt([questionWord, verb], filler)
          expect(classifyIntent(prompt)).toBe("document")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("question words with weak generation verbs → 'chat' (question-only pattern overrides weak verbs)", () => {
    /**
     * Validates: Requirements 1.2, 1.4
     *
     * When a prompt contains question words and only weak generation verbs
     * (not create/generate/make), the question-only pattern takes precedence
     * and classifyIntent SHALL return "chat".
     *
     * This tests the nuance: hasGenerationVerbs && (hasQuestionWords && !hasStrongGenerationVerbs)
     * evaluates to false for the document branch, falling through to "chat".
     */
    fc.assert(
      fc.property(
        questionWordArb,
        weakGenerationVerbArb,
        safeFillerArb,
        (questionWord, verb, filler) => {
          const prompt = buildPrompt([questionWord, verb], filler)
          expect(classifyIntent(prompt)).toBe("chat")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("neither generation verbs nor question words → 'chat' (default)", () => {
    /**
     * Validates: Requirements 1.3
     *
     * When a prompt contains neither generation verbs nor question words,
     * classifyIntent SHALL default to "chat".
     */
    fc.assert(
      fc.property(
        safeFillerArb.filter((s) => s.trim().length > 0),
        (filler) => {
          expect(classifyIntent(filler)).toBe("chat")
        }
      ),
      { numRuns: 100 }
    )
  })
})
