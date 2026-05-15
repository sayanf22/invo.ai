/**
 * Property 5: Document type detector keyword detection
 *
 * For any document type in the 10 supported types and for any prompt string
 * containing only keywords from that type's pattern, `detectDocumentType(prompt)`
 * SHALL return that type as the detected type. Prompts containing "quotation"
 * keywords SHALL detect as "quote" (never "quotation").
 *
 * **Validates: Requirements 4.1–4.7, 4.9**
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  detectDocumentType,
  type DocumentType,
} from "@/lib/server/document-type-detector"

// ─── Canonical document types ────────────────────────────────────────────────

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

// ─── Exclusive keyword anchors per type ──────────────────────────────────────
//
// Each anchor prompt uses only keywords that exclusively match that type's
// pattern, with no competing keywords from other types. These are calibrated
// against the keyword patterns in lib/server/document-type-detector.ts.

const TYPE_ANCHORS: Array<{ type: DocumentType; prompt: string }> = [
  {
    type: "invoice",
    // "invoice" (1.0), "bill" (1.0), "payment" (1.0) → invoice 3.0
    // "services rendered" has no competing keyword matches
    prompt: "invoice bill payment services rendered",
  },
  {
    type: "contract",
    // "contract" (1.0), "service agreement" (1.0), "employment" (1.0), "hire" (1.0) → contract 4.0
    prompt: "contract service agreement employment hire",
  },
  {
    type: "quote",
    // "quote" (1.2), "price quote" (1.2), "estimate" (1.2), "cost estimate" (1.2), "bid" (1.2) → quote 6.0
    // vs invoice "price" + "cost" = 2.0 — quote wins clearly
    prompt: "quote price quote estimate cost estimate bid",
  },
  {
    type: "proposal",
    // "proposal" (0.8), "business proposal" (0.8), "pitch" (0.8) → proposal 2.4
    // Avoids "deliverables"/"milestones" which would also match sow
    prompt: "proposal business proposal pitch",
  },
  {
    type: "sow",
    // "statement of work" (1.1), "deliverables" (1.1), "milestones" (1.1),
    // "timeline" (1.1), "phases" (1.1) → sow 5.5
    prompt: "statement of work deliverables milestones timeline phases",
  },
  {
    type: "change_order",
    // "change order" (1.2), "amendment" (1.2), "scope change" (1.2),
    // "modification" (1.2), "addendum" (1.2) → change_order 6.0
    prompt: "change order amendment scope change modification addendum",
  },
  {
    type: "nda",
    // "nda" (1.2), "non-disclosure" (1.2), "confidentiality" (1.2),
    // "confidential" (1.2), "secret" (1.2), "proprietary" (1.2) → nda 7.2
    prompt: "nda non-disclosure confidentiality confidential secret proprietary",
  },
  {
    type: "client_onboarding_form",
    // "onboarding" (1.0), "intake" (1.0), "client details" (1.0),
    // "questionnaire" (1.0) → client_onboarding_form 4.0
    prompt: "onboarding intake client details questionnaire",
  },
  {
    type: "payment_followup",
    // "reminder" (1.1), "follow up" (1.1), "overdue" (1.1), "payment reminder" (1.1),
    // "past due" (1.1), "outstanding" (1.1) → payment_followup 6.6
    // vs invoice "payment" = 1.0 — payment_followup wins clearly
    prompt: "payment reminder follow up overdue past due outstanding",
  },
  {
    type: "recurring_invoice",
    // "recurring" (1.1), "monthly invoice" (1.1), "subscription billing" (1.1),
    // "repeat invoice" (1.1) → recurring_invoice 4.4
    // vs invoice "invoice"×2 + "bill" + "billing" = 4.0 — recurring_invoice wins
    prompt: "recurring monthly invoice subscription billing repeat invoice",
  },
]

// ─── Safe filler words that don't trigger any document-type keywords ──────────
//
// These words are safe because they are not standalone keywords in any type's
// pattern and cannot form a matching multi-word phrase on their own.

const SAFE_FILLER_WORDS = [
  "please",
  "for",
  "my",
  "the",
  "a",
  "an",
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
  "next",
]

const safeFillerArb = fc
  .array(fc.constantFrom(...SAFE_FILLER_WORDS), { minLength: 0, maxLength: 4 })
  .map((words) => words.join(" "))

// ─── Tests ───────────────────────────────────────────────────────────────────

describe(
  "Feature: service-business-document-workflow, Property 5: Document type detector keyword detection",
  () => {
    // Property: for each type anchor (with optional safe filler), detectDocumentType
    // returns exactly that type
    for (const { type, prompt } of TYPE_ANCHORS) {
      it(`detectDocumentType with ${type} keywords returns type === "${type}"`, () => {
        /**
         * Validates: Requirements 4.1–4.7, 4.9
         *
         * For a prompt containing only keywords specific to the given document type,
         * detectDocumentType SHALL return a DetectionResult whose `type` equals that
         * document type. Safe filler words prepended to the prompt must not alter the
         * detected type.
         */
        fc.assert(
          fc.property(safeFillerArb, (filler) => {
            const fullPrompt = filler ? `${filler} ${prompt}` : prompt
            const result = detectDocumentType(fullPrompt)
            expect(result.type).toBe(type)
          }),
          { numRuns: 50 }
        )
      })
    }

    // Property: "quotation" keyword maps to "quote", never to "quotation"
    it('"quotation" keyword detects as "quote" — never as "quotation"', () => {
      /**
       * Validates: Requirement 4.9
       *
       * The legacy keyword "quotation" SHALL be detected as "quote" (the canonical
       * type). The returned type SHALL never equal the string "quotation" since
       * "quotation" is not a valid DocumentType.
       */
      fc.assert(
        fc.property(safeFillerArb, (filler) => {
          const prompt = filler
            ? `${filler} quotation price estimate`
            : "quotation price estimate"
          const result = detectDocumentType(prompt)
          expect(result.type).toBe("quote")
          expect(result.type).not.toBe("quotation")
        }),
        { numRuns: 50 }
      )
    })

    // Property: confidence is always a number in [0, 1]
    it("confidence is always between 0 and 1 for every type anchor", () => {
      /**
       * Validates: Requirements 4.1–4.7, 4.9
       *
       * The `confidence` field of DetectionResult SHALL always be a number
       * in the closed interval [0, 1] for any valid prompt input.
       */
      fc.assert(
        fc.property(fc.constantFrom(...TYPE_ANCHORS), ({ prompt }) => {
          const result = detectDocumentType(prompt)
          expect(result.confidence).toBeGreaterThanOrEqual(0)
          expect(result.confidence).toBeLessThanOrEqual(1)
        }),
        { numRuns: 50 }
      )
    })

    // Property: type is always one of the 10 canonical DocumentType values
    it("type is always a valid DocumentType from the 10 canonical types (never 'quotation')", () => {
      /**
       * Validates: Requirements 4.1–4.7, 4.9
       *
       * The `type` field of DetectionResult SHALL always be one of the 10 canonical
       * DocumentType values. It SHALL never equal "quotation" (a retired legacy alias).
       */
      fc.assert(
        fc.property(fc.constantFrom(...TYPE_ANCHORS), ({ prompt }) => {
          const result = detectDocumentType(prompt)
          expect(ALL_DOCUMENT_TYPES).toContain(result.type)
          expect(result.type).not.toBe("quotation")
        }),
        { numRuns: 50 }
      )
    })
  }
)
