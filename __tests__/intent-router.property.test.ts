/**
 * Property 4: Intent classifier keyword detection
 *
 * For any document type in the 10 supported types and for any prompt string
 * that contains only keywords from that type's keyword pattern,
 * `classifyIntentFull(prompt)` SHALL return a result where `suggestedType`
 * equals that document type (assuming no competing keywords from other types
 * with higher match density).
 *
 * **Validates: Requirements 3.1–3.11**
 *
 * Property 6: Classification function determinism
 *
 * For any prompt string, calling `classifyIntentFull(prompt)` multiple times
 * SHALL always return the same `IntentResult`. Similarly, for any
 * (prompt, requestedType) pair, calling `detectMismatch(prompt, requestedType)`
 * multiple times SHALL always return the same result.
 *
 * **Validates: Requirements 3.12, 13.7**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { classifyIntentFull, detectMismatch, type DocumentType } from "@/lib/intent-router"

// ─── Unambiguous keyword anchors per type ────────────────────────────────────
//
// Each anchor is chosen to match ONLY that type's regex and not any other
// type's regex. These are the exact prompts from the task specification,
// validated against TYPE_KEYWORDS in lib/intent-router.ts.

const TYPE_ANCHORS: Array<{ type: DocumentType; prompt: string }> = [
  {
    type: "invoice",
    // Matches: invoice, billing, amount owed, services rendered
    // Does NOT match: recurring, subscription (those go to recurring_invoice)
    prompt: "create an invoice for services rendered billing amount owed",
  },
  {
    type: "contract",
    // Matches: contract, service agreement, employment, hire
    prompt: "create a contract service agreement employment hire",
  },
  {
    type: "quote",
    // Matches: quote, price quote, cost estimate, bid, pricing
    prompt: "create a quote price quote cost estimate bid pricing",
  },
  {
    type: "proposal",
    // Matches: proposal, business proposal, pitch
    // NOTE: deliberately avoids "deliverables"/"milestones" (would also match sow)
    prompt: "create a proposal business proposal project pitch",
  },
  {
    type: "sow",
    // Matches: statement of work, deliverables, milestones, project scope
    prompt: "create a statement of work with deliverables milestones project scope",
  },
  {
    type: "change_order",
    // Matches: change order, amendment, scope change, revision, addendum
    prompt: "create a change order amendment scope change revision addendum",
  },
  {
    type: "nda",
    // Matches: nda, non-disclosure, confidentiality, proprietary
    prompt: "create an nda non-disclosure confidentiality agreement proprietary",
  },
  {
    type: "client_onboarding_form",
    // Matches: onboarding, intake, questionnaire, client form
    prompt: "create a client onboarding intake questionnaire client form",
  },
  {
    type: "payment_followup",
    // Matches: payment reminder, follow-up, overdue, past due, unpaid
    prompt: "create a payment reminder follow-up overdue past due unpaid",
  },
  {
    type: "recurring_invoice",
    // Matches: recurring (1), monthly invoice (1), subscription billing (1) = 3 matches
    // invoice pattern only matches: invoice (1), billing (1) = 2 matches
    // recurring_invoice wins 3 vs 2 — avoids the tie that "repeat invoice" + "monthly billing" caused
    prompt: "set up a recurring monthly invoice subscription billing",
  },
]

// ─── Safe filler words that don't trigger any document-type patterns ─────────

const SAFE_FILLER_WORDS = [
  "please",
  "for",
  "my",
  "the",
  "a",
  "an",
  "client",
  "immediately",
  "now",
  "today",
  "quickly",
  "asap",
  "important",
  "regarding",
  "about",
  "with",
  "and",
  "also",
  "new",
  "next",
]

const safeFillerArb = fc
  .array(fc.constantFrom(...SAFE_FILLER_WORDS), { minLength: 0, maxLength: 4 })
  .map((words) => words.join(" "))

// ─── Test: each type anchor produces the correct suggestedType ───────────────

describe(
  "Feature: service-business-document-workflow, Property 4: Intent classifier keyword detection",
  () => {
    for (const { type, prompt } of TYPE_ANCHORS) {
      it(`classifyIntentFull with ${type} keywords returns suggestedType === "${type}"`, () => {
        /**
         * Validates: Requirements 3.1–3.11
         *
         * For a prompt containing only keywords specific to the given document type,
         * classifyIntentFull SHALL return suggestedType equal to that type.
         */
        fc.assert(
          fc.property(safeFillerArb, (filler) => {
            // Prepend safe filler to the anchor prompt to vary input while
            // preserving the unambiguous type-specific keyword signal.
            const fullPrompt = filler
              ? `${filler} ${prompt}`
              : prompt
            const result = classifyIntentFull(fullPrompt)
            expect(result.suggestedType).toBe(type)
          }),
          { numRuns: 50 }
        )
      })
    }

    // ─── Test: pure question prompts always route to "chat" ─────────────────

    it("pure question prompt (no create verb) routes to 'chat'", () => {
      /**
       * Validates: Requirement 3.12 (deterministic routing)
       *
       * A prompt containing only a question word (no creation verb)
       * SHALL route to "chat" regardless of other content.
       */
      const questionPrompts = [
        "what is an invoice",
        "how do I write a contract",
        "why should I use an nda",
        "can you explain a proposal",
        "should I use a quote or invoice",
      ]
      fc.assert(
        fc.property(fc.constantFrom(...questionPrompts), (qPrompt) => {
          const result = classifyIntentFull(qPrompt)
          expect(result.route).toBe("chat")
        }),
        { numRuns: 50 }
      )
    })

    // ─── Test: explicit create + type keyword + concrete subject → document-explicit ──

    it("explicit create verb + type keyword + concrete subject → 'document-explicit'", () => {
      /**
       * Validates: Requirements 3.1, 3.3
       *
       * When a prompt has a create verb, a type keyword, and enough concrete
       * subject tokens, the route SHALL be "document-explicit".
       */
      const explicitPrompts: Array<{ prompt: string; expectedType: DocumentType }> = [
        {
          prompt: "create an invoice for Acme Corp for web design services rendered",
          expectedType: "invoice",
        },
        {
          // "generate", "contract", "employment", "agreement", "at" are stopwords;
          // remaining subject tokens: "john" "doe" "acme" "ltd" "partnership" = 5 > 3 → document-explicit
          prompt: "generate a contract employment agreement for John Doe at Acme Ltd partnership",
          expectedType: "contract",
        },
        {
          prompt: "make a quote price estimate for 50 custom branded t-shirts for Acme Sports",
          expectedType: "quote",
        },
        {
          prompt: "draft a proposal business proposal for the rebranding project pitch to Acme",
          expectedType: "proposal",
        },
        {
          prompt: "create a statement of work with deliverables milestones for the new Acme project",
          expectedType: "sow",
        },
        {
          prompt: "generate a change order amendment for scope change in the Acme project",
          expectedType: "change_order",
        },
        {
          prompt: "create an nda non-disclosure confidentiality agreement for Acme Corp partner",
          expectedType: "nda",
        },
        {
          prompt: "create a client onboarding intake questionnaire form for new Acme client",
          expectedType: "client_onboarding_form",
        },
        {
          prompt: "create a payment reminder follow-up for overdue past due unpaid invoice Acme",
          expectedType: "payment_followup",
        },
        {
          // recurring_invoice pattern: "recurring" (1), "monthly invoice" (1), "subscription billing" (1) = 3 matches
          // invoice pattern: "invoice" (in "monthly invoice") (1), "billing" (in "subscription billing") (1) = 2 matches
          // recurring_invoice wins 3 vs 2 matches → correct suggestedType
          prompt: "create a recurring monthly invoice subscription billing for Acme Corp quarterly client work",
          expectedType: "recurring_invoice",
        },
      ]

      fc.assert(
        fc.property(
          fc.constantFrom(...explicitPrompts),
          ({ prompt: p, expectedType }) => {
            const result = classifyIntentFull(p)
            expect(result.route).toBe("document-explicit")
            expect(result.suggestedType).toBe(expectedType)
          }
        ),
        { numRuns: 100 }
      )
    })
  }
)

// ─── Property 6: Classification function determinism ─────────────────────────

const ALL_DOCUMENT_TYPES: DocumentType[] = [
  "invoice",
  "contract",
  "quote",
  "proposal",
  "sow",
  "change_order",
  "nda",
  "client_onboarding_form",
  "payment_followup",
  "recurring_invoice",
]

describe(
  "Feature: service-business-document-workflow, Property 6: Classification function determinism",
  () => {
    /**
     * Validates: Requirements 3.12, 13.7
     *
     * For any prompt string, calling `classifyIntentFull(prompt)` 3 times
     * SHALL always return identical route, suggestedType, and suggestions.length.
     */
    it("classifyIntentFull is deterministic across 3 calls for any prompt (fc.string)", () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), (prompt) => {
          const r1 = classifyIntentFull(prompt)
          const r2 = classifyIntentFull(prompt)
          const r3 = classifyIntentFull(prompt)

          // route must be identical
          expect(r2.route).toBe(r1.route)
          expect(r3.route).toBe(r1.route)

          // suggestedType must be identical
          expect(r2.suggestedType).toBe(r1.suggestedType)
          expect(r3.suggestedType).toBe(r1.suggestedType)

          // number of suggestions must be identical
          expect(r2.suggestions.length).toBe(r1.suggestions.length)
          expect(r3.suggestions.length).toBe(r1.suggestions.length)
        }),
        { numRuns: 200 }
      )
    })

    /**
     * Validates: Requirements 3.12, 13.7
     *
     * For any (prompt, DocumentType) pair, calling `detectMismatch(prompt, type)`
     * 3 times SHALL always return identical results (both null or the same suggestedType).
     */
    it("detectMismatch is deterministic across 3 calls for any (prompt, type) pair", () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 200 }),
          fc.constantFrom(...ALL_DOCUMENT_TYPES),
          (prompt, docType) => {
            const r1 = detectMismatch(prompt, docType)
            const r2 = detectMismatch(prompt, docType)
            const r3 = detectMismatch(prompt, docType)

            if (r1 === null) {
              expect(r2).toBeNull()
              expect(r3).toBeNull()
            } else {
              expect(r2).not.toBeNull()
              expect(r3).not.toBeNull()
              expect(r2!.suggestedType).toBe(r1.suggestedType)
              expect(r3!.suggestedType).toBe(r1.suggestedType)
            }
          }
        ),
        { numRuns: 200 }
      )
    })

    // ─── Concrete determinism checks for typical prompts ─────────────────────

    it("classifyIntentFull returns identical results across 3 calls for typical prompts", () => {
      /**
       * Validates: Requirement 3.12
       *
       * Demonstrates determinism holds for prompts representative of real usage.
       */
      const typicalPrompts = [
        "create an invoice for Acme Corp",
        "I need a contract for a freelance web developer",
        "send a payment reminder for overdue invoice",
        "draft an NDA for a new partnership",
        "make a statement of work with deliverables and milestones",
        "generate a change order for scope modification",
        "create a recurring monthly invoice for my retainer client",
        "write a proposal for the new marketing project",
        "what is an invoice",
        "",
        "   ",
        "random text with no document keywords whatsoever",
      ]

      for (const prompt of typicalPrompts) {
        const r1 = classifyIntentFull(prompt)
        const r2 = classifyIntentFull(prompt)
        const r3 = classifyIntentFull(prompt)

        expect(r2.route, `route mismatch for prompt: "${prompt}"`).toBe(r1.route)
        expect(r3.route, `route mismatch for prompt: "${prompt}"`).toBe(r1.route)
        expect(r2.suggestedType, `suggestedType mismatch for prompt: "${prompt}"`).toBe(r1.suggestedType)
        expect(r3.suggestedType, `suggestedType mismatch for prompt: "${prompt}"`).toBe(r1.suggestedType)
        expect(r2.suggestions.length, `suggestions.length mismatch for prompt: "${prompt}"`).toBe(r1.suggestions.length)
        expect(r3.suggestions.length, `suggestions.length mismatch for prompt: "${prompt}"`).toBe(r1.suggestions.length)
      }
    })

    it("detectMismatch returns identical results across 3 calls for typical (prompt, type) pairs", () => {
      /**
       * Validates: Requirement 13.7
       *
       * Demonstrates determinism holds for mismatch detection on representative inputs.
       */
      const typicalCases: Array<{ prompt: string; type: DocumentType }> = [
        { prompt: "collect payment and bill for services", type: "contract" },
        { prompt: "I need a reminder for an overdue invoice", type: "invoice" },
        { prompt: "change the scope and add an amendment", type: "contract" },
        { prompt: "confidentiality and non-disclosure only", type: "contract" },
        { prompt: "work is already agreed, final price invoice for client", type: "quote" },
        { prompt: "create a proposal with deliverables and milestones", type: "proposal" },
        { prompt: "completely unrelated text with no keywords", type: "invoice" },
        { prompt: "", type: "contract" },
      ]

      for (const { prompt, type } of typicalCases) {
        const r1 = detectMismatch(prompt, type)
        const r2 = detectMismatch(prompt, type)
        const r3 = detectMismatch(prompt, type)

        if (r1 === null) {
          expect(r2, `detectMismatch("${prompt}", "${type}") should consistently be null`).toBeNull()
          expect(r3, `detectMismatch("${prompt}", "${type}") should consistently be null`).toBeNull()
        } else {
          expect(r2, `detectMismatch("${prompt}", "${type}") should consistently be non-null`).not.toBeNull()
          expect(r3, `detectMismatch("${prompt}", "${type}") should consistently be non-null`).not.toBeNull()
          expect(r2!.suggestedType, `suggestedType mismatch for ("${prompt}", "${type}")`).toBe(r1.suggestedType)
          expect(r3!.suggestedType, `suggestedType mismatch for ("${prompt}", "${type}")`).toBe(r1.suggestedType)
        }
      }
    })
  }
)
