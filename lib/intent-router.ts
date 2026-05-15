/**
 * Intent classification for the dual-model AI architecture.
 *
 * Provides two classifiers:
 *
 * 1. `classifyIntent(prompt)` — binary, returns "document" | "chat".
 *    Used by `/api/ai/stream` to decide whether to generate a document or
 *    respond conversationally. KEPT UNCHANGED for backward compatibility
 *    with existing tests and call sites.
 *
 * 2. `classifyIntentFull(prompt, selectedCategory?)` — richer, returns an
 *    `IntentResult` with `route`, `suggestedType`, `suggestions` (ranked array),
 *    and `confidence`. Used by `/api/ai/detect-type` and AppShell to decide
 *    whether a prompt should route to the split-screen directly
 *    ("document-explicit") or into the chat-only screen ("chat" | "ambiguous").
 *    When more than one type pattern matches with similar confidence, all
 *    candidates above the CONFIDENCE_GAP threshold are returned in `suggestions`
 *    so the calling layer can present a disambiguation prompt to the user.
 *
 * Both functions are pure, stateless, and side-effect free.
 */

const GENERATION_VERBS =
  /create|generate|make|build|draft|prepare|change|update|add|remove|modify/i

const QUESTION_WORDS =
  /what|how|why|explain|tell me|can you|is it|does|should/i

const STRONG_GENERATION_VERBS = /create|generate|make/i

/**
 * Classify a user prompt as document generation or conversational chat.
 *
 * This function is pure, stateless, and has no side effects.
 * Each message is evaluated independently.
 */
export function classifyIntent(prompt: string): "document" | "chat" {
  // Strip system-injected blocks before classification
  const cleanedPrompt = prompt.replace(/\[SYSTEM:[^\]]*\]/g, '').trim()

  const hasGenerationVerbs = GENERATION_VERBS.test(cleanedPrompt)
  const hasQuestionWords = QUESTION_WORDS.test(cleanedPrompt)
  const hasStrongGenerationVerbs = STRONG_GENERATION_VERBS.test(cleanedPrompt)

  // Generation verbs present AND not a question-only pattern → "document"
  // If both question words and generation verbs are present,
  // generation verbs take priority → "document"
  if (
    hasGenerationVerbs &&
    !(hasQuestionWords && !hasStrongGenerationVerbs)
  ) {
    return "document"
  }

  // All other cases (question-only, ambiguous, neither) → "chat"
  return "chat"
}

// ─── Full intent classification (for chat-first routing) ──────────────────────

export type IntentRoute = "document-explicit" | "chat" | "ambiguous"

/**
 * All 10 canonical document types supported by the platform.
 * Requirements: 3.1–3.11
 */
export type DocumentType =
  | "invoice"
  | "contract"
  | "quote"
  | "proposal"
  | "sow"
  | "change_order"
  | "nda"
  | "client_onboarding_form"
  | "payment_followup"
  | "recurring_invoice"

/**
 * A single ranked suggestion returned by `classifyIntentFull`.
 * Requirement 3.3a
 */
export interface IntentSuggestion {
  type: DocumentType
  /** Normalized confidence score in [0, 1]. Top match is always 1.0. */
  confidence: number
  /** The keyword strings from the prompt that matched this type's pattern. */
  matchedKeywords: string[]
}

/**
 * Result from `classifyIntentFull`.
 *
 * - `route` — routing decision for the calling layer.
 * - `suggestions` — ranked list of matching document types (highest confidence
 *   first). Empty when route is "chat" and no type keywords were detected.
 * - `suggestedType` — convenience accessor equal to `suggestions[0]?.type`.
 *   Retained for callers that don't need multi-suggestion disambiguation.
 * - `confidence` — overall confidence in the route + primary type (0–1).
 */
export interface IntentResult {
  route: IntentRoute
  /** Ranked suggestions, highest confidence first. Requirement 3.3a */
  suggestions: IntentSuggestion[]
  /**
   * Convenience accessor — equals `suggestions[0]?.type ?? undefined`.
   * Retained for backward compatibility with callers that check this field
   * directly without needing the full ranked list.
   */
  suggestedType?: DocumentType
  /** 0 to 1 — how confident we are in the route + suggestedType. */
  confidence: number
}

/**
 * When two candidate types differ in confidence by more than this gap,
 * the lower-confidence candidate is dropped from the suggestions array.
 * Set to 0.25 per the design document (Requirement 3.3a).
 */
const CONFIDENCE_GAP = 0.25

// Strong create verbs used by the full classifier. Distinct from the broader
// GENERATION_VERBS set above (which includes edit verbs like "update", "remove")
// because for chat-first routing we only count "this user is creating
// something new" verbs as evidence of direct-create intent.
const STRONG_CREATE_VERBS = /\b(create|generate|make|draft|prepare|build|new)\b/i
const FULL_QUESTION_WORDS = /\b(what|how|why|which|when|can you|should I|do I|is it|does)\b/i

/**
 * Per-type keyword patterns for all 10 document types.
 *
 * The "quotation" pattern has been updated to map to "quote" — any keyword
 * that previously identified "quotation" now maps to the canonical "quote".
 *
 * Order is used as a tiebreaker when two types have equal match counts:
 * types earlier in the list win ties.
 *
 * Requirements: 3.1–3.11
 */
const TYPE_KEYWORDS: Array<{ type: DocumentType; pattern: RegExp }> = [
  // ── Existing types (quotation → quote) ──────────────────────────────────
  {
    type: "invoice",
    pattern: /\b(invoice|bill|receipt|billing|amount owed|services rendered)\b/i,
  },
  {
    type: "quote",
    // "quotation" and "quote" both map here (Req 3.2, 16.x)
    pattern: /\b(quotation|quote|price quote|pricing|estimate|cost estimate|bid)\b/i,
  },
  {
    type: "contract",
    pattern: /\b(contract|service agreement|employment|hire|work agreement|legal terms)\b/i,
  },
  {
    type: "proposal",
    pattern: /\b(proposal|business proposal|project proposal|pitch|selling capabilities)\b/i,
  },
  // ── New types ────────────────────────────────────────────────────────────
  {
    type: "sow",
    pattern:
      /\b(statement of work|sow|deliverables|milestones|timeline|phases|project scope)\b/i,
  },
  {
    type: "change_order",
    pattern:
      /\b(change order|amendment|scope change|modification|revision|addendum|extra work)\b/i,
  },
  {
    type: "nda",
    pattern:
      /\b(nda|non-disclosure|confidentiality|confidential|secret|proprietary)\b/i,
  },
  {
    type: "client_onboarding_form",
    pattern:
      /\b(onboarding|intake|client details|questionnaire|client form|project requirements)\b/i,
  },
  {
    type: "payment_followup",
    pattern:
      /\b(reminder|follow.?up|overdue|payment reminder|past due|outstanding|unpaid)\b/i,
  },
  {
    type: "recurring_invoice",
    pattern:
      /\b(recurring|monthly invoice|weekly billing|subscription billing|repeat invoice|monthly billing)\b/i,
  },
]

// Words stripped before counting "concrete subject" tokens.
const SUBJECT_STOPWORDS = new Set([
  "a", "an", "the", "for", "of", "to", "and", "or",
  "my", "i", "me", "please", "can", "you", "it",
  "this", "that", "with", "on", "at", "in", "by",
  // Doc type + generation verb words also get stripped before counting
  "invoice", "bill", "receipt", "billing",
  "quotation", "quote", "estimate",
  "contract", "agreement", "employment", "freelance",
  "proposal", "pitch",
  "create", "generate", "make", "draft", "prepare", "build", "new",
])

function normaliseCategory(selectedCategory?: string): DocumentType | undefined {
  if (!selectedCategory) return undefined
  const lower = selectedCategory.toLowerCase().trim()
  // Accept all 10 canonical types plus the legacy "quotation" alias
  if (lower === "quotation") return "quote"
  const match = TYPE_KEYWORDS.find(({ type }) => type === lower)
  if (match) return match.type
  // Legacy four-type backwards compat
  if (lower === "invoice" || lower === "contract" || lower === "proposal") return lower
  return undefined
}

/**
 * Count how many distinct keyword tokens from a pattern match a prompt.
 * Returns the count of matches (with the global flag applied).
 */
function countPatternMatches(prompt: string, pattern: RegExp): number {
  // Create a global version of the pattern so matchAll works
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
  return [...prompt.matchAll(globalPattern)].length
}

/**
 * Extract the matched keyword strings from a prompt for a given pattern.
 */
function extractMatchedKeywords(prompt: string, pattern: RegExp): string[] {
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
  return [...prompt.matchAll(globalPattern)].map((m) => m[0])
}

function countSubjectTokens(prompt: string): number {
  const lower = prompt.toLowerCase()
  const tokens = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 0 && !SUBJECT_STOPWORDS.has(t))
  return tokens.length
}

/**
 * Build the ranked `IntentSuggestion[]` array from all matching type patterns.
 *
 * Algorithm (Requirement 3.3a):
 * 1. Test every type pattern; collect those that match.
 * 2. Count match occurrences for each matching type (proxy for confidence).
 * 3. Normalize so the top match gets confidence 1.0.
 * 4. Sort descending by confidence; break ties by TYPE_KEYWORDS order.
 * 5. Drop any candidate whose confidence is more than CONFIDENCE_GAP below
 *    the leader.
 */
function buildSuggestions(prompt: string, pinnedType?: DocumentType): IntentSuggestion[] {
  const candidates: Array<{ type: DocumentType; matchCount: number; matchedKeywords: string[] }> = []

  for (const { type, pattern } of TYPE_KEYWORDS) {
    const keywords = extractMatchedKeywords(prompt, pattern)
    if (keywords.length > 0) {
      candidates.push({ type, matchCount: keywords.length, matchedKeywords: keywords })
    }
  }

  // If a pinned type (from selectedCategory) has no match in the prompt, add
  // it at the front with matchCount 1 so it appears as the primary suggestion.
  if (pinnedType) {
    const alreadyPresent = candidates.some(c => c.type === pinnedType)
    if (!alreadyPresent) {
      candidates.unshift({ type: pinnedType, matchCount: 1, matchedKeywords: [] })
    } else {
      // Move the pinned type to the front by giving it a slight boost
      const idx = candidates.findIndex(c => c.type === pinnedType)
      if (idx > 0) {
        const [pinned] = candidates.splice(idx, 1)
        candidates.unshift(pinned)
      }
    }
  }

  if (candidates.length === 0) return []

  const maxMatchCount = Math.max(...candidates.map(c => c.matchCount))

  // Normalize; sort desc by confidence then by TYPE_KEYWORDS order for ties
  const typeOrder = TYPE_KEYWORDS.map(k => k.type)
  const suggestions: IntentSuggestion[] = candidates
    .map(c => ({
      type: c.type,
      confidence: c.matchCount / maxMatchCount,
      matchedKeywords: c.matchedKeywords,
    }))
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
    })

  // Drop candidates below the gap threshold
  const leader = suggestions[0].confidence
  return suggestions.filter(s => leader - s.confidence <= CONFIDENCE_GAP)
}

/**
 * Full intent classification for chat-first routing.
 *
 * Routes:
 *   - "document-explicit" — user said something like "create invoice for Acme
 *     for $1500 web design". Enough context to skip chat-only and go straight
 *     to the split-screen.
 *   - "ambiguous" — doc-type keyword present but no concrete subject (e.g.,
 *     "invoice", "I need a contract"). Route to chat-only so the AI can gather
 *     missing details.
 *   - "chat" — question or general conversation. Route to chat-only.
 *
 * `suggestions` contains all plausibly-matching types ranked by confidence.
 * When `suggestions.length >= 2` the calling layer SHOULD present a
 * disambiguation prompt listing each candidate's label and description.
 *
 * `suggestedType` is a convenience accessor equal to `suggestions[0]?.type`
 * and is retained for callers that don't need the full ranked list.
 */
export function classifyIntentFull(prompt: string, selectedCategory?: string): IntentResult {
  const cleanedPrompt = prompt.replace(/\[SYSTEM:[^\]]*\]/g, '').trim()

  const hasCreateVerb = STRONG_CREATE_VERBS.test(cleanedPrompt)
  const hasQuestionWord = FULL_QUESTION_WORDS.test(cleanedPrompt)

  const categoryType = normaliseCategory(selectedCategory)
  const suggestions = buildSuggestions(cleanedPrompt, categoryType)
  const suggestedType = suggestions[0]?.type

  const subjectTokens = countSubjectTokens(cleanedPrompt)
  const hasConcreteSubject = subjectTokens > 3

  // A pure question (no create verb) always routes to chat.
  if (hasQuestionWord && !hasCreateVerb) {
    return {
      route: "chat",
      suggestions,
      suggestedType,
      confidence: suggestedType ? 0.4 : 0.3,
    }
  }

  // "document-explicit" requires: create verb + (keyword OR category) + concrete subject.
  if (hasCreateVerb && suggestedType && hasConcreteSubject) {
    // Slightly lower confidence when we only got the type from the category pill
    const hasKeywordMatch = suggestions[0]?.matchedKeywords.length > 0
    const confidence = hasKeywordMatch ? 0.92 : 0.75
    return { route: "document-explicit", suggestions, suggestedType, confidence }
  }

  // A doc-type keyword or selectedCategory is present but no concrete subject
  // (or no create verb) → ambiguous, route to chat-only.
  if (suggestedType) {
    return {
      route: "ambiguous",
      suggestions,
      suggestedType,
      confidence: hasCreateVerb ? 0.55 : 0.45,
    }
  }

  // Nothing matched a doc type at all → plain chat.
  return {
    route: "chat",
    suggestions: [],
    suggestedType: undefined,
    confidence: 0.25,
  }
}

// ─── Mismatch detection ───────────────────────────────────────────────────────

/**
 * A MismatchResult is returned when the user's requested document type does
 * not match their stated goal. For example, asking for a contract to collect
 * a payment — the correct document is an invoice.
 */
export interface MismatchResult {
  requestedType: DocumentType
  suggestedType: DocumentType
  reason: string
}

interface MismatchRule {
  requestedType: DocumentType
  triggerPattern: RegExp
  suggestedType: DocumentType
  reason: string
}

/**
 * Rules for detecting document-type mismatches. Each rule fires when the user
 * asks for `requestedType` AND the prompt matches `triggerPattern`. The rules
 * are evaluated in order; first match wins. Pure regex — no AI call.
 *
 * Task 4.2 will add the new mismatch rules for the 6 new document types.
 * The existing 4 rules are preserved unchanged here.
 */
export const MISMATCH_RULES: readonly MismatchRule[] = [
  {
    requestedType: "contract",
    triggerPattern: /\b(payment|bill|invoice|charge|amount due|pay me|collect payment)\b/i,
    suggestedType: "invoice",
    reason:
      "For collecting payment, an invoice is the right document. Contracts are for agreements and terms.",
  },
  {
    requestedType: "invoice",
    triggerPattern:
      /\b(agreement|terms|employment|hire|freelance agreement|consulting agreement|scope of work)\b/i,
    suggestedType: "contract",
    reason:
      "For formalizing an agreement or terms, a contract is more appropriate than an invoice.",
  },
  {
    requestedType: "quote",
    triggerPattern: /\b(already agreed|final price|payment due|invoice for|bill for)\b/i,
    suggestedType: "invoice",
    reason:
      "If the work is already agreed and you need to request payment, use an invoice instead of a quote.",
  },
  {
    requestedType: "proposal",
    triggerPattern: /\b(price list|line items|unit price|per hour|per unit|rate card)\b/i,
    suggestedType: "quote",
    reason: "For itemized pricing, a quote is more appropriate than a proposal.",
  },
  // ── New mismatch rules for expanded document types (Task 4.2) ─────────────
  {
    requestedType: "proposal",
    triggerPattern: /\b(deliverables|milestones|acceptance criteria|timeline|phases)\b/i,
    suggestedType: "sow",
    reason: "For detailed deliverables and milestones, a Statement of Work (SOW) is more appropriate than a proposal.",
  },
  {
    requestedType: "contract",
    triggerPattern: /\b(change|amendment|scope change|modification|revision|addendum)\b/i,
    suggestedType: "change_order",
    reason: "For changes to an existing agreement, a Change Order is the right document.",
  },
  {
    requestedType: "invoice",
    triggerPattern: /\b(reminder|follow.?up|overdue|past due|outstanding|unpaid invoice)\b/i,
    suggestedType: "payment_followup",
    reason: "For reminding a client about an unpaid invoice, a Payment Follow-up is more appropriate.",
  },
  {
    requestedType: "contract",
    triggerPattern: /\b(confidential|nda|non-disclosure|secret|proprietary)\b/i,
    suggestedType: "nda",
    reason: "For confidentiality protection only, an NDA is more appropriate than a full contract.",
  },
  {
    requestedType: "quote",
    triggerPattern: /\b(already agreed|final price|payment due|collect payment|invoice for)\b/i,
    suggestedType: "invoice",
    reason: "If the work is already agreed and you need to collect payment, use an invoice.",
  },
] as const

/**
 * Detect whether the user's requested document type mismatches their stated
 * goal. Returns a MismatchResult when a rule fires, or null otherwise.
 *
 * The same `requestedType` can only be matched against its own rule (e.g.,
 * a contract request is only checked against the contract mismatch rule),
 * so this function returns at most one result.
 *
 * Pure, stateless, no AI call.
 */
export function detectMismatch(
  prompt: string,
  requestedType: DocumentType
): MismatchResult | null {
  const cleaned = prompt.replace(/\[SYSTEM:[^\]]*\]/g, '').trim()

  for (const rule of MISMATCH_RULES) {
    if (rule.requestedType !== requestedType) continue
    if (rule.triggerPattern.test(cleaned)) {
      return {
        requestedType: rule.requestedType,
        suggestedType: rule.suggestedType,
        reason: rule.reason,
      }
    }
  }
  return null
}
