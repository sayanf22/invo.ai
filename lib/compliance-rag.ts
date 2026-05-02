/**
 * Compliance RAG Module
 *
 * Retrieves country-specific compliance rules from the compliance_knowledge
 * table using deterministic SQL lookup (document generation) or semantic
 * vector search (conversational queries). Injected into the AI prompt
 * before document generation.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getSecret } from "./secrets"

// Use `any` typed client for compliance_knowledge table since it's not
// in the generated database.types.ts yet. This avoids build failures
// while keeping the rest of the codebase type-safe.
type AnySupabaseClient = SupabaseClient<any>

// ── Types ──────────────────────────────────────────────────────────────

export interface ComplianceRule {
  id: string
  country: string
  document_type: string
  category: "tax_rates" | "mandatory_fields" | "legal_requirements" | "formatting" | "deadlines"
  requirement_key: string
  requirement_value: Record<string, any>
  description: string | null
  effective_date: string | null
  similarity?: number
}

export interface ComplianceContext {
  mode: "deterministic" | "semantic" | "fallback"
  country: string
  documentType: string
  rules: ComplianceRule[]
  formattedContext: string
}

// ── Country Normalization ──────────────────────────────────────────────

/**
 * Maps country identifiers (ISO alpha-2, full names, common variants)
 * to the canonical format used in the compliance_knowledge table.
 * All keys are stored uppercase for case-insensitive lookup.
 */
export const COUNTRY_MAP: Record<string, string> = {
  // ISO alpha-2 → compliance_knowledge table format
  "IN": "India", "US": "USA", "GB": "UK", "DE": "Germany",
  "CA": "Canada", "AU": "Australia", "SG": "Singapore",
  "AE": "UAE", "PH": "Philippines", "FR": "France", "NL": "Netherlands",
  // Full names (case-insensitive lookup)
  "INDIA": "India", "USA": "USA", "UK": "UK", "GERMANY": "Germany",
  "CANADA": "Canada", "AUSTRALIA": "Australia", "SINGAPORE": "Singapore",
  "UAE": "UAE", "PHILIPPINES": "Philippines", "FRANCE": "France",
  "NETHERLANDS": "Netherlands",
  // Common variants
  "UNITED STATES": "USA", "UNITED KINGDOM": "UK",
  "UNITED ARAB EMIRATES": "UAE",
}

/**
 * Normalizes a country identifier to the compliance_knowledge table format.
 * Performs case-insensitive lookup against ISO alpha-2 codes, full names,
 * and common variants.
 *
 * @returns The canonical country name, or null if unsupported.
 */
export function normalizeCountry(country: string): string | null {
  if (!country || typeof country !== "string") return null
  const key = country.trim().toUpperCase()
  return COUNTRY_MAP[key] ?? null
}

// ── Document Type Normalization ────────────────────────────────────────

/**
 * Normalizes a document type to lowercase for case-insensitive matching
 * against the compliance_knowledge table.
 *
 * @returns The lowercase document type string.
 */
export function normalizeDocumentType(docType: string): string {
  if (!docType || typeof docType !== "string") return ""
  return docType.trim().toLowerCase()
}

// ── Effective Date Filtering ───────────────────────────────────────────

/**
 * Filters compliance rules to include only those where `effective_date`
 * is null (always applicable) or on/before the current date.
 * Rules with a future `effective_date` are excluded.
 *
 * Exported for property testing (Task 2.5).
 */
export function filterByEffectiveDate(rules: ComplianceRule[]): ComplianceRule[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return rules.filter((rule) => {
    if (rule.effective_date === null || rule.effective_date === undefined) {
      return true
    }
    const effectiveDate = new Date(rule.effective_date)
    effectiveDate.setHours(0, 0, 0, 0)
    return effectiveDate <= today
  })
}

// ── Deterministic Retrieval ────────────────────────────────────────────

/**
 * Retrieves compliance rules from the `compliance_knowledge` table using
 * exact SQL filters on `country` and `document_type`. Filters out rules
 * with a future `effective_date`. Makes zero calls to OpenAI embeddings API.
 *
 * This is an internal helper called by `getComplianceContext`.
 */
async function getDeterministicRules(
  supabase: AnySupabaseClient,
  country: string,
  documentType: string
): Promise<ComplianceRule[]> {
  const { data, error } = await supabase
    .from("compliance_knowledge")
    .select("id, country, document_type, category, requirement_key, requirement_value, description, effective_date")
    .eq("country", country)
    .eq("document_type", documentType)

  if (error) {
    console.error("Deterministic retrieval failed:", {
      operation: "getDeterministicRules",
      country,
      documentType,
      error: error.message,
    })
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  // Map DB rows to ComplianceRule and filter by effective date
  const rules: ComplianceRule[] = data.map((row) => ({
    id: row.id,
    country: row.country,
    document_type: row.document_type,
    category: row.category as ComplianceRule["category"],
    requirement_key: row.requirement_key,
    requirement_value: row.requirement_value as Record<string, any>,
    description: row.description,
    effective_date: row.effective_date,
  }))

  return filterByEffectiveDate(rules)
}

// ── Semantic Retrieval ─────────────────────────────────────────────────

/**
 * Retrieves compliance rules from the `compliance_knowledge` table using
 * semantic vector search. Generates an embedding of the user's query via
 * OpenAI `text-embedding-3-large` (1536 dimensions), then calls the
 * `match_compliance_knowledge` DB function with cosine similarity search.
 *
 * Falls back to deterministic mode on any API error or timeout (5s).
 * This is an internal helper called by `getComplianceContext`.
 */
async function getSemanticRules(
  supabase: AnySupabaseClient,
  country: string,
  documentType: string,
  query: string
): Promise<ComplianceRule[]> {
  let embedding: number[]

  try {
    const apiKey = await getSecret("OPENAI_API_KEY")
    if (!apiKey) {
      console.error("Semantic retrieval failed: missing OpenAI API key", {
        operation: "getSemanticRules",
        country,
        documentType,
      })
      return getDeterministicRules(supabase, country, documentType)
    }

    // 5-second timeout via AbortController
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-large",
          input: query,
          dimensions: 1536,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error("Semantic retrieval failed: OpenAI API error", {
          operation: "getSemanticRules",
          country,
          documentType,
          status: response.status,
          statusText: response.statusText,
        })
        return getDeterministicRules(supabase, country, documentType)
      }

      const result = await response.json()
      embedding = result.data?.[0]?.embedding

      if (!embedding || !Array.isArray(embedding)) {
        console.error("Semantic retrieval failed: invalid embedding response", {
          operation: "getSemanticRules",
          country,
          documentType,
        })
        return getDeterministicRules(supabase, country, documentType)
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      const isTimeout = fetchError?.name === "AbortError"
      console.error(`Semantic retrieval failed: ${isTimeout ? "timeout (5s)" : "fetch error"}`, {
        operation: "getSemanticRules",
        country,
        documentType,
        error: fetchError?.message,
      })
      return getDeterministicRules(supabase, country, documentType)
    }
  } catch (err: any) {
    console.error("Semantic retrieval failed: unexpected error", {
      operation: "getSemanticRules",
      country,
      documentType,
      error: err?.message,
    })
    return getDeterministicRules(supabase, country, documentType)
  }

  // Call the match_compliance_knowledge DB function
  const { data, error } = await supabase.rpc("match_compliance_knowledge", {
    query_embedding: embedding as any,
    match_country: country,
    match_document_type: documentType,
    match_threshold: 0.65,
    match_count: 8,
  })

  if (error) {
    console.error("Semantic retrieval failed: DB function error", {
      operation: "getSemanticRules",
      country,
      documentType,
      error: error.message,
    })
    return getDeterministicRules(supabase, country, documentType)
  }

  if (!data || data.length === 0) {
    // No results above threshold — fall back to deterministic
    return getDeterministicRules(supabase, country, documentType)
  }

  // Map DB rows to ComplianceRule with similarity scores
  const rules: ComplianceRule[] = data.map((row: any) => ({
    id: row.id,
    country: row.country,
    document_type: row.document_type,
    category: row.category as ComplianceRule["category"],
    requirement_key: row.requirement_key,
    requirement_value: row.requirement_value as Record<string, any>,
    description: row.description,
    effective_date: row.effective_date ?? null,
    similarity: row.similarity,
  }))

  return filterByEffectiveDate(rules)
}

// ── Category Priority ──────────────────────────────────────────────────

/**
 * Category priority order (highest to lowest).
 * When the formatted context exceeds the token limit, categories are
 * removed from the end of this list first: `deadlines` first, then
 * `formatting`, preserving `tax_rates`, `mandatory_fields`, and
 * `legal_requirements`.
 *
 * Exported for property testing.
 */
export const CATEGORY_PRIORITY = [
  "tax_rates",
  "mandatory_fields",
  "legal_requirements",
  "formatting",
  "deadlines",
] as const

// ── Context Formatting ─────────────────────────────────────────────────

/** Maximum token budget for formatted context (estimated as char count / 4). */
const MAX_TOKEN_LIMIT = 2_000
const CHARS_PER_TOKEN = 4

/**
 * Formats a human-readable category header from a snake_case category name.
 * e.g. "tax_rates" → "TAX_RATES"
 */
function formatCategoryHeader(category: string): string {
  return category.toUpperCase()
}

/**
 * Formats a single compliance rule as a line item.
 * In semantic mode, appends a similarity score annotation.
 */
function formatRuleLine(rule: ComplianceRule, mode: "deterministic" | "semantic"): string {
  const description = rule.description ?? JSON.stringify(rule.requirement_value)
  if (mode === "semantic" && rule.similarity !== undefined) {
    return `- ${rule.requirement_key}: ${description} [similarity: ${rule.similarity.toFixed(4)}]`
  }
  return `- ${rule.requirement_key}: ${description}`
}

/**
 * Estimates the token count for a string (character count / 4).
 */
function estimateTokens(text: string): number {
  return text.length / CHARS_PER_TOKEN
}

/**
 * Formats compliance rules into a structured text block suitable for
 * injection into the AI system prompt.
 *
 * - Deterministic mode: header + rules grouped by category.
 * - Semantic mode: same structure, rules sorted by descending similarity
 *   score before grouping, with similarity annotation per rule.
 * - Limits output to max 2,000 tokens (char count / 4).
 * - When exceeding the limit, removes lowest-priority categories first:
 *   `deadlines` → `formatting`, preserving `tax_rates`, `mandatory_fields`,
 *   `legal_requirements`.
 *
 * @param rules - The compliance rules to format.
 * @param country - The canonical country name.
 * @param documentType - The document type.
 * @param mode - "deterministic" or "semantic".
 * @returns A formatted string ready for prompt injection.
 */
export function formatComplianceContext(
  rules: ComplianceRule[],
  country: string,
  documentType: string,
  mode: "deterministic" | "semantic"
): string {
  if (!rules || rules.length === 0) {
    return ""
  }

  // For semantic mode, sort rules by descending similarity before grouping
  const sortedRules = mode === "semantic"
    ? [...rules].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    : rules

  // Group rules by category
  const grouped = new Map<string, ComplianceRule[]>()
  for (const rule of sortedRules) {
    const existing = grouped.get(rule.category) ?? []
    existing.push(rule)
    grouped.set(rule.category, existing)
  }

  // Build the header
  const header = `COMPLIANCE CONTEXT (${country} — ${documentType}):\nMode: ${mode}\n`

  // Build category sections in priority order
  const categorySections: { category: string; text: string }[] = []
  for (const category of CATEGORY_PRIORITY) {
    const categoryRules = grouped.get(category)
    if (!categoryRules || categoryRules.length === 0) continue

    let section = `\n## ${formatCategoryHeader(category)}\n`
    for (const rule of categoryRules) {
      section += formatRuleLine(rule, mode) + "\n"
    }
    categorySections.push({ category, text: section })
  }

  // Assemble full context and check token limit
  let fullContext = header
  for (const section of categorySections) {
    fullContext += section.text
  }

  if (estimateTokens(fullContext) <= MAX_TOKEN_LIMIT) {
    return fullContext
  }

  // Truncate by removing lowest-priority categories first
  // Priority order (lowest first for removal): deadlines, formatting
  const removableCategories = ["deadlines", "formatting"] as const

  let truncatedSections = [...categorySections]
  for (const removable of removableCategories) {
    truncatedSections = truncatedSections.filter((s) => s.category !== removable)

    let context = header
    for (const section of truncatedSections) {
      context += section.text
    }

    if (estimateTokens(context) <= MAX_TOKEN_LIMIT) {
      return context
    }
  }

  // Even after removing deadlines and formatting, still over limit.
  // Return what we have (preserving high-priority categories).
  let context = header
  for (const section of truncatedSections) {
    context += section.text
  }
  return context
}

// ── Fallback Context ───────────────────────────────────────────────────

/**
 * Fallback compliance context returned when:
 * - The user's country is unsupported (not in COUNTRY_MAP)
 * - No rules are found for the country + document type combination
 * - Any error occurs during retrieval (DB error, API error, etc.)
 *
 * Instructs the AI to set taxRate to 0 and ask the user to confirm
 * their country and tax requirements.
 */
const FALLBACK_CONTEXT = `
COMPLIANCE CONTEXT (Fallback — no country-specific rules available):
- Set taxRate to 0 (no tax applied)
- Do not include any country-specific tax labels or mandatory fields
- In your message, ask the user to confirm their country and tax requirements
- Generate the document with all other fields populated normally
`

/**
 * Returns the fallback compliance guidance string.
 * Used when no country-specific rules are available or on any error.
 */
export function getFallbackContext(): string {
  return FALLBACK_CONTEXT
}

// ── Main Entry Point ───────────────────────────────────────────────────

/**
 * Main entry point for compliance context retrieval.
 *
 * Determines retrieval mode based on whether a `userMessage` is provided:
 * - If `userMessage` is provided → semantic mode (embedding + pgvector search)
 * - Otherwise → deterministic mode (SQL WHERE filter)
 *
 * Normalizes country and document type, retrieves rules, formats them,
 * and returns a `ComplianceContext` object ready for prompt injection.
 *
 * All errors are caught and logged — never surfaced to the user.
 * On any failure, returns fallback context.
 *
 * @param supabase - Authenticated Supabase client
 * @param country - The user's country (ISO alpha-2, full name, or variant)
 * @param documentType - The document type (invoice, contract, quotation, proposal)
 * @param userMessage - Optional user message; if provided, triggers semantic mode
 * @returns ComplianceContext with mode, rules, and formatted context string
 */
export async function getComplianceContext(
  supabase: AnySupabaseClient,
  country: string,
  documentType: string,
  userMessage?: string
): Promise<ComplianceContext> {
  try {
    // 1. Normalize country — return fallback if unsupported
    const normalizedCountry = normalizeCountry(country)
    if (!normalizedCountry) {
      return {
        mode: "fallback",
        country,
        documentType,
        rules: [],
        formattedContext: getFallbackContext(),
      }
    }

    // 2. Normalize document type
    const normalizedDocType = normalizeDocumentType(documentType)

    // 3. Determine retrieval mode and fetch rules
    let rules: ComplianceRule[]
    let mode: "deterministic" | "semantic"

    if (userMessage) {
      // Semantic mode — embedding + pgvector search
      mode = "semantic"
      rules = await getSemanticRules(supabase, normalizedCountry, normalizedDocType, userMessage)
    } else {
      // Deterministic mode — SQL WHERE filter
      mode = "deterministic"
      rules = await getDeterministicRules(supabase, normalizedCountry, normalizedDocType)
    }

    // 4. If no rules found, return fallback
    if (!rules || rules.length === 0) {
      return {
        mode: "fallback",
        country: normalizedCountry,
        documentType: normalizedDocType,
        rules: [],
        formattedContext: getFallbackContext(),
      }
    }

    // 5. Format rules into prompt-ready context
    const formattedContext = formatComplianceContext(rules, normalizedCountry, normalizedDocType, mode)

    return {
      mode,
      country: normalizedCountry,
      documentType: normalizedDocType,
      rules,
      formattedContext,
    }
  } catch (error: any) {
    // Catch-all: log error, return fallback — never surface to user
    console.error("getComplianceContext failed:", {
      operation: "getComplianceContext",
      country,
      documentType,
      error: error?.message,
      stack: error?.stack,
    })

    return {
      mode: "fallback",
      country,
      documentType,
      rules: [],
      formattedContext: getFallbackContext(),
    }
  }
}
