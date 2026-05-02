/**
 * Unit Tests for Compliance RAG Module — Deterministic Mode
 *
 * Task 9.1: Write unit tests for deterministic mode
 * Validates: Requirements 3.1, 3.6, 10.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  COUNTRY_MAP,
  getComplianceContext,
  getFallbackContext,
} from "@/lib/compliance-rag"

// ── Test 1: COUNTRY_MAP contains all 11 ISO codes ─────────────────────

describe("COUNTRY_MAP contains all 11 ISO codes", () => {
  /**
   * **Validates: Requirement 10.1**
   *
   * The RAG system must maintain a mapping between ISO 3166-1 alpha-2 codes
   * and the full country names used in the compliance_knowledge table.
   */
  const REQUIRED_ISO_CODES: Record<string, string> = {
    IN: "India",
    US: "USA",
    GB: "UK",
    DE: "Germany",
    CA: "Canada",
    AU: "Australia",
    SG: "Singapore",
    AE: "UAE",
    PH: "Philippines",
    FR: "France",
    NL: "Netherlands",
  }

  it("contains all 11 required ISO alpha-2 codes", () => {
    const isoCodes = Object.keys(REQUIRED_ISO_CODES)
    expect(isoCodes).toHaveLength(11)

    for (const code of isoCodes) {
      expect(COUNTRY_MAP).toHaveProperty(code)
    }
  })

  it("maps each ISO code to the correct canonical country name", () => {
    for (const [code, expectedName] of Object.entries(REQUIRED_ISO_CODES)) {
      expect(COUNTRY_MAP[code]).toBe(expectedName)
    }
  })
})

// ── Test 2: Deterministic mode returns correct rules for India + invoice ──

describe("Deterministic mode returns correct rules for India + invoice", () => {
  /**
   * **Validates: Requirement 3.1**
   *
   * When a document generation request is received, the RAG system queries
   * the compliance_knowledge table using exact SQL filters on country and
   * document_type matching the user's business profile.
   */

  const sampleRules = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      country: "India",
      document_type: "invoice",
      category: "tax_rates",
      requirement_key: "gst_rates",
      requirement_value: { standard: 18, reduced: 5 },
      description: "GST rates: 0%, 5%, 12%, 18%, 28%",
      effective_date: null,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      country: "India",
      document_type: "invoice",
      category: "mandatory_fields",
      requirement_key: "gstin",
      requirement_value: { required: true },
      description: "GSTIN number is mandatory on all invoices",
      effective_date: null,
    },
  ]

  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: sampleRules,
            error: null,
          }),
        }),
      }),
    }),
  } as any

  it("returns deterministic mode with rules for India + invoice", async () => {
    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice"
    )

    expect(result.mode).toBe("deterministic")
    expect(result.country).toBe("India")
    expect(result.documentType).toBe("invoice")
    expect(result.rules).toHaveLength(2)
  })

  it("formatted context contains the country and document type", async () => {
    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice"
    )

    expect(result.formattedContext).toContain("India")
    expect(result.formattedContext).toContain("invoice")
  })

  it("formatted context contains rule descriptions", async () => {
    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice"
    )

    expect(result.formattedContext).toContain("GST rates")
    expect(result.formattedContext).toContain("GSTIN number is mandatory")
  })

  it("works with ISO code IN instead of full name India", async () => {
    const result = await getComplianceContext(
      mockSupabase,
      "IN",
      "invoice"
    )

    // normalizeCountry("IN") → "India", so the Supabase query should use "India"
    expect(result.country).toBe("India")
    expect(result.mode).toBe("deterministic")
  })

  it("calls supabase.from with compliance_knowledge table", async () => {
    await getComplianceContext(mockSupabase, "India", "invoice")

    expect(mockSupabase.from).toHaveBeenCalledWith("compliance_knowledge")
  })
})

// ── Test 3: Deterministic mode makes zero OpenAI API calls ────────────

describe("Deterministic mode makes zero OpenAI API calls", () => {
  /**
   * **Validates: Requirement 3.6**
   *
   * The RAG system shall make zero calls to the OpenAI embeddings API
   * when operating in deterministic mode.
   */

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("does not call global.fetch (OpenAI API) when no userMessage is provided", async () => {
    const sampleRules = [
      {
        id: "33333333-3333-3333-3333-333333333333",
        country: "India",
        document_type: "invoice",
        category: "tax_rates",
        requirement_key: "gst_standard",
        requirement_value: { rate: 18 },
        description: "Standard GST rate is 18%",
        effective_date: null,
      },
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: sampleRules,
              error: null,
            }),
          }),
        }),
      }),
    } as any

    // Call without userMessage → deterministic mode
    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice"
      // No userMessage parameter → deterministic mode
    )

    expect(result.mode).toBe("deterministic")
    // global.fetch should NOT have been called (no OpenAI embedding request)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

// ── Mock @/lib/secrets for semantic mode tests ────────────────────────

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn().mockResolvedValue("fake-openai-api-key"),
}))

// ── Test 4: Semantic mode fallbacks ───────────────────────────────────

describe("Semantic mode falls back to deterministic on API error", () => {
  /**
   * **Validates: Requirements 4.6, 8.2**
   *
   * If the OpenAI embeddings API call fails (e.g., 500 Internal Server Error),
   * the RAG system shall fall back to deterministic mode and return rules
   * from the SQL WHERE filter instead.
   */

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("falls back to deterministic rules when OpenAI returns 500", async () => {
    // Mock OpenAI API returning a 500 error
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as any)

    const deterministicRules = [
      {
        id: "44444444-4444-4444-4444-444444444444",
        country: "India",
        document_type: "invoice",
        category: "tax_rates",
        requirement_key: "gst_standard",
        requirement_value: { rate: 18 },
        description: "Standard GST rate is 18%",
        effective_date: null,
      },
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: deterministicRules,
              error: null,
            }),
          }),
        }),
      }),
      rpc: vi.fn(),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice",
      "What are the GST rates in India?"
    )

    // Semantic mode was requested, but internally falls back to deterministic rules.
    // The mode stays "semantic" (what was requested), but rules come from SQL WHERE.
    expect(result.mode).toBe("semantic")
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].requirement_key).toBe("gst_standard")
    expect(result.formattedContext).toContain("India")
    expect(result.formattedContext).toContain("GST rate")
    // Verify fetch was called (OpenAI API was attempted)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    // Verify deterministic fallback was used (supabase.from was called)
    expect(mockSupabase.from).toHaveBeenCalledWith("compliance_knowledge")
  })
})

describe("Semantic mode falls back when no results above threshold", () => {
  /**
   * **Validates: Requirements 4.4, 8.2**
   *
   * If the semantic search returns no results above the similarity threshold
   * (0.65), the RAG system shall fall back to deterministic mode.
   */

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("falls back to deterministic when RPC returns empty data", async () => {
    // Mock OpenAI API returning a valid embedding
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    } as any)

    const deterministicRules = [
      {
        id: "55555555-5555-5555-5555-555555555555",
        country: "USA",
        document_type: "invoice",
        category: "tax_rates",
        requirement_key: "sales_tax",
        requirement_value: { varies_by_state: true },
        description: "Sales tax varies by state",
        effective_date: null,
      },
    ]

    const mockSupabase = {
      // rpc returns empty data (no results above threshold)
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      // from() is used by the deterministic fallback
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: deterministicRules,
              error: null,
            }),
          }),
        }),
      }),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "US",
      "invoice",
      "What are the tax rules?"
    )

    // Semantic search returned nothing → internally fell back to deterministic rules.
    // Mode stays "semantic" (what was requested), but rules come from SQL WHERE fallback.
    expect(result.mode).toBe("semantic")
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].requirement_key).toBe("sales_tax")
    expect(result.formattedContext).toContain("USA")
    // Verify the RPC was called (semantic search was attempted)
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "match_compliance_knowledge",
      expect.objectContaining({
        match_country: "USA",
        match_document_type: "invoice",
        match_threshold: 0.65,
        match_count: 8,
      })
    )
    // Verify deterministic fallback was used
    expect(mockSupabase.from).toHaveBeenCalledWith("compliance_knowledge")
  })
})

describe("OpenAI timeout (>5s) triggers deterministic fallback", () => {
  /**
   * **Validates: Requirements 8.4, 4.6**
   *
   * The RAG system shall set a timeout of 5 seconds for the OpenAI
   * embeddings API call, falling back to deterministic mode if the
   * timeout is exceeded.
   */

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("falls back to deterministic when OpenAI request times out (AbortError)", async () => {
    // Mock fetch to simulate an AbortError (timeout)
    vi.mocked(globalThis.fetch).mockImplementationOnce(() =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new DOMException("The operation was aborted", "AbortError")), 100)
      })
    )

    const deterministicRules = [
      {
        id: "66666666-6666-6666-6666-666666666666",
        country: "Germany",
        document_type: "contract",
        category: "legal_requirements",
        requirement_key: "contract_language",
        requirement_value: { language: "German" },
        description: "Contracts must be in German for domestic use",
        effective_date: null,
      },
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: deterministicRules,
              error: null,
            }),
          }),
        }),
      }),
      rpc: vi.fn(),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "DE",
      "contract",
      "What are the legal requirements for contracts in Germany?"
    )

    // Timeout → internally falls back to deterministic rules.
    // Mode stays "semantic" (what was requested), but rules come from SQL WHERE fallback.
    expect(result.mode).toBe("semantic")
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0].requirement_key).toBe("contract_language")
    expect(result.formattedContext).toContain("Germany")
    expect(result.formattedContext).toContain("contract")
    // Verify fetch was called (OpenAI API was attempted and timed out)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    // Verify deterministic fallback was used
    expect(mockSupabase.from).toHaveBeenCalledWith("compliance_knowledge")
  })
})


// ══════════════════════════════════════════════════════════════════════
// Task 9.4: Unit tests for fallback and cost tracking
// Validates: Requirements 8.1, 8.5, 9.1, 9.2
// ══════════════════════════════════════════════════════════════════════

// ── Test 5: Fallback context contains taxRate=0 instruction ───────────

describe("Fallback context contains taxRate=0 instruction", () => {
  /**
   * **Validates: Requirement 8.5**
   *
   * THE Fallback_Context SHALL instruct the AI to set `taxRate` to 0
   * and include a message asking the user to confirm their country's
   * tax requirements.
   */

  it("contains 'taxRate' and '0' in the fallback context", () => {
    const fallback = getFallbackContext()
    expect(fallback).toContain("taxRate")
    expect(fallback).toContain("0")
  })

  it("contains instruction to ask user about country/tax requirements", () => {
    const fallback = getFallbackContext()
    expect(fallback).toContain("ask the user to confirm their country and tax requirements")
  })

  it("contains instruction to not include country-specific fields", () => {
    const fallback = getFallbackContext()
    expect(fallback).toContain("Do not include any country-specific tax labels or mandatory fields")
  })

  it("contains instruction to generate document normally", () => {
    const fallback = getFallbackContext()
    expect(fallback).toContain("Generate the document with all other fields populated normally")
  })
})

// ── Test 6: Stream route continues on RAG failure ─────────────────────

describe("Stream route continues on RAG failure (getComplianceContext catch-all)", () => {
  /**
   * **Validates: Requirements 8.1, 5.4**
   *
   * IF the compliance_knowledge table query fails, THEN THE RAG_System
   * SHALL return the Fallback_Context and log the error.
   * The stream route wraps getComplianceContext in a try/catch and
   * continues with document generation even if RAG fails entirely.
   */

  it("returns fallback mode when supabase query throws an error", async () => {
    const errorSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockRejectedValue(new Error("DB connection lost")),
          }),
        }),
      }),
    } as any

    const result = await getComplianceContext(
      errorSupabase,
      "India",
      "invoice"
    )

    // getComplianceContext wraps everything in try/catch → returns fallback
    expect(result.mode).toBe("fallback")
    expect(result.formattedContext).toBe(getFallbackContext())
    expect(result.rules).toHaveLength(0)
  })

  it("returns fallback mode when supabase returns an error object", async () => {
    const errorSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "relation does not exist", code: "42P01" },
            }),
          }),
        }),
      }),
    } as any

    const result = await getComplianceContext(
      errorSupabase,
      "India",
      "invoice"
    )

    // No rules found (error path returns []) → fallback
    expect(result.mode).toBe("fallback")
    expect(result.formattedContext).toBe(getFallbackContext())
  })

  it("returns fallback for unsupported country (never blocks user)", async () => {
    const mockSupabase = {
      from: vi.fn(),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "Atlantis",
      "invoice"
    )

    // Unsupported country → normalizeCountry returns null → fallback
    expect(result.mode).toBe("fallback")
    expect(result.formattedContext).toBe(getFallbackContext())
    // supabase.from should NOT have been called (early return)
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })
})

// ── Test 7: OPERATION_COSTS includes "embedding" at $0.00001 ──────────

describe("OPERATION_COSTS includes 'embedding' at $0.00001", () => {
  /**
   * **Validates: Requirement 9.2**
   *
   * THE Cost_Protection module SHALL include an `embedding` operation
   * type with an estimated cost of $0.00001 per call.
   */

  it("trackUsage accepts 'embedding' as a valid operation type", async () => {
    // Import trackUsage to verify it accepts "embedding" without type error
    const { trackUsage } = await import("@/lib/cost-protection")

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as any

    // This should not throw — "embedding" is a valid operation type
    await expect(
      trackUsage(mockSupabase, "test-user-id", "embedding", 100)
    ).resolves.not.toThrow()

    // Verify rpc was called with the correct cost ($0.00001)
    expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_user_usage", {
      p_user_id: "test-user-id",
      p_month: expect.stringMatching(/^\d{4}-\d{2}$/),
      p_requests: 1,
      p_tokens: 100,
      p_cost: 0.00001,
    })
  })
})

// ── Test 8: Cost tracking called with "embedding" for semantic mode ───

describe("Cost tracking for semantic mode in stream route", () => {
  /**
   * **Validates: Requirement 9.1**
   *
   * WHEN the RAG_System makes an OpenAI embeddings API call in
   * Semantic_Mode, THE Stream_Route SHALL call trackUsage with
   * operation type "embedding".
   *
   * We verify this by checking the stream route source code contains
   * the correct trackUsage call pattern for semantic mode, and by
   * testing that getComplianceContext returns "semantic" mode when
   * a userMessage is provided (which triggers the trackUsage call
   * in the stream route).
   */

  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn() as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("getComplianceContext returns 'semantic' mode when userMessage is provided (triggers embedding cost tracking)", async () => {
    // Mock OpenAI API returning a valid embedding
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.1) }],
      }),
    } as any)

    const semanticRules = [
      {
        id: "77777777-7777-7777-7777-777777777777",
        country: "India",
        document_type: "invoice",
        category: "tax_rates",
        requirement_key: "gst_rates",
        requirement_value: { standard: 18 },
        description: "GST rates in India",
        similarity: 0.85,
      },
    ]

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: semanticRules,
        error: null,
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice",
      "What are the GST rates?"  // userMessage triggers semantic mode
    )

    // When mode is "semantic", the stream route calls:
    //   trackUsage(auth.supabase, auth.user.id, "embedding", 100)
    expect(result.mode).toBe("semantic")
    expect(result.rules).toHaveLength(1)
  })

  it("getComplianceContext returns 'deterministic' mode when no userMessage (no embedding cost)", async () => {
    const deterministicRules = [
      {
        id: "88888888-8888-8888-8888-888888888888",
        country: "India",
        document_type: "invoice",
        category: "tax_rates",
        requirement_key: "gst_rates",
        requirement_value: { standard: 18 },
        description: "GST rates in India",
        effective_date: null,
      },
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: deterministicRules,
              error: null,
            }),
          }),
        }),
      }),
    } as any

    const result = await getComplianceContext(
      mockSupabase,
      "India",
      "invoice"
      // No userMessage → deterministic mode → no embedding cost
    )

    expect(result.mode).toBe("deterministic")
    // No fetch call should have been made (no OpenAI embedding)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("stream route source code calls trackUsage with 'embedding' for semantic mode", async () => {
    // Read the stream route source to verify the integration pattern
    const fs = await import("fs")
    const routeSource = fs.readFileSync("app/api/ai/stream/route.ts", "utf-8")

    // Verify the stream route checks for semantic mode and tracks embedding usage
    expect(routeSource).toContain('complianceResult.mode === "semantic"')
    expect(routeSource).toContain('trackUsage')
    expect(routeSource).toContain('"embedding"')
  })
})
