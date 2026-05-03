/**
 * Intent classification for the dual-model AI architecture.
 *
 * Classifies user prompts as either "document" (routed to DeepSeek for
 * structured document generation) or "chat" (routed to Kimi K2.5 for
 * conversational responses).
 *
 * Classification rules:
 * - Document generation verbs present AND no question-word-only pattern → "document"
 * - Question words present without generation verbs → "chat"
 * - Both present (e.g., "can you create an invoice") → generation verbs take priority → "document"
 * - Ambiguous (neither pattern matches) → "chat" (default)
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
  const hasGenerationVerbs = GENERATION_VERBS.test(prompt)
  const hasQuestionWords = QUESTION_WORDS.test(prompt)
  const hasStrongGenerationVerbs = STRONG_GENERATION_VERBS.test(prompt)

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
