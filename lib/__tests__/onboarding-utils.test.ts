import { describe, it, expect } from "vitest"
import {
  validateSupportMessage,
  computeOnboardingStatus,
  getFieldCompletion,
  filterByEmailSearch,
  filterErrorsByContext,
  applyOnboardingFilters,
  ONBOARDING_PHASES,
  TRACKED_FIELDS,
} from "@/lib/onboarding-utils"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("ONBOARDING_PHASES", () => {
  it("contains exactly 4 phases in order", () => {
    expect(ONBOARDING_PHASES).toEqual(["upload", "chat", "logo", "payments"])
  })
})

describe("TRACKED_FIELDS", () => {
  it("maps exactly 12 tracked fields to business columns", () => {
    expect(Object.keys(TRACKED_FIELDS)).toHaveLength(12)
    expect(TRACKED_FIELDS.businessType).toBe("business_type")
    expect(TRACKED_FIELDS.address).toBe("address")
    expect(TRACKED_FIELDS.bankDetails).toBe("payment_methods")
  })
})

// ---------------------------------------------------------------------------
// validateSupportMessage
// ---------------------------------------------------------------------------

describe("validateSupportMessage", () => {
  it("accepts a message with trimmed length between 3 and 2000", () => {
    expect(validateSupportMessage("abc")).toBe(true)
    expect(validateSupportMessage("Hello, I need help")).toBe(true)
  })

  it("rejects messages shorter than 3 trimmed chars", () => {
    expect(validateSupportMessage("")).toBe(false)
    expect(validateSupportMessage("ab")).toBe(false)
    expect(validateSupportMessage("  a  ")).toBe(false)
  })

  it("rejects messages longer than 2000 trimmed chars", () => {
    expect(validateSupportMessage("a".repeat(2001))).toBe(false)
  })

  it("accepts exactly 3 and exactly 2000 chars", () => {
    expect(validateSupportMessage("abc")).toBe(true)
    expect(validateSupportMessage("a".repeat(2000))).toBe(true)
  })

  it("trims whitespace before checking length", () => {
    expect(validateSupportMessage("   abc   ")).toBe(true)
    expect(validateSupportMessage("   ab   ")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeOnboardingStatus
// ---------------------------------------------------------------------------

describe("computeOnboardingStatus", () => {
  it('returns "completed" when onboarding_complete and completed_at are set', () => {
    const result = computeOnboardingStatus(
      { onboarding_complete: true, last_active_at: new Date().toISOString() },
      { current_phase: "completed", completed_at: new Date().toISOString() }
    )
    expect(result).toBe("completed")
  })

  it('returns "dropped-off" when no progress record exists', () => {
    const result = computeOnboardingStatus(
      { onboarding_complete: false, last_active_at: null },
      null
    )
    expect(result).toBe("dropped-off")
  })

  it('returns "dropped-off" when last active > 48 hours ago', () => {
    const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString()
    const result = computeOnboardingStatus(
      { onboarding_complete: false, last_active_at: oldDate },
      { current_phase: "chat", completed_at: null, updated_at: oldDate }
    )
    expect(result).toBe("dropped-off")
  })

  it('returns "in-progress" when last active within 48 hours', () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    const result = computeOnboardingStatus(
      { onboarding_complete: false, last_active_at: recentDate },
      { current_phase: "chat", completed_at: null }
    )
    expect(result).toBe("in-progress")
  })

  it('returns "in-progress" when onboarding_complete is true but completed_at is null', () => {
    const recentDate = new Date().toISOString()
    const result = computeOnboardingStatus(
      { onboarding_complete: true, last_active_at: recentDate },
      { current_phase: "payments", completed_at: null }
    )
    expect(result).toBe("in-progress")
  })
})

// ---------------------------------------------------------------------------
// getFieldCompletion
// ---------------------------------------------------------------------------

describe("getFieldCompletion", () => {
  it("returns all false and count 0 for an empty business", () => {
    const { fields, count } = getFieldCompletion({})
    expect(count).toBe(0)
    expect(Object.values(fields).every((v) => v === false)).toBe(true)
  })

  it("correctly detects non-empty string fields", () => {
    const { fields, count } = getFieldCompletion({
      business_type: "LLC",
      country: "US",
      name: "Acme",
      owner_name: "",
      email: null,
    })
    expect(fields.businessType).toBe(true)
    expect(fields.country).toBe(true)
    expect(fields.businessName).toBe(true)
    expect(fields.ownerName).toBe(false)
    expect(fields.email).toBe(false)
    expect(count).toBe(3)
  })

  it("detects address with at least one non-empty value", () => {
    const { fields } = getFieldCompletion({
      address: { street: "123 Main St", city: "" },
    })
    expect(fields.address).toBe(true)
  })

  it("rejects address with all empty values", () => {
    const { fields } = getFieldCompletion({
      address: { street: "", city: "" },
    })
    expect(fields.address).toBe(false)
  })

  it("detects tax_ids with at least one key", () => {
    const { fields } = getFieldCompletion({
      tax_ids: { gst: "123ABC" },
    })
    expect(fields.taxDetails).toBe(true)
  })

  it("rejects empty tax_ids object", () => {
    const { fields } = getFieldCompletion({ tax_ids: {} })
    expect(fields.taxDetails).toBe(false)
  })

  it("detects non-empty client_countries array", () => {
    const { fields } = getFieldCompletion({
      client_countries: ["US", "UK"],
    })
    expect(fields.clientCountries).toBe(true)
  })

  it("rejects empty client_countries array", () => {
    const { fields } = getFieldCompletion({ client_countries: [] })
    expect(fields.clientCountries).toBe(false)
  })

  it("detects payment_methods with at least one key", () => {
    const { fields } = getFieldCompletion({
      payment_methods: { bank: "Chase" },
    })
    expect(fields.bankDetails).toBe(true)
  })

  it("returns count matching the number of true fields", () => {
    const { fields, count } = getFieldCompletion({
      business_type: "LLC",
      country: "US",
      name: "Acme",
      owner_name: "John",
      email: "john@acme.com",
      phone: "555-1234",
      address: { street: "123 Main" },
      tax_ids: { ein: "12-3456789" },
      additional_notes: "Web dev",
      client_countries: ["US"],
      default_currency: "USD",
      payment_methods: { bank: "Chase" },
    })
    expect(count).toBe(12)
    expect(Object.values(fields).every((v) => v === true)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// filterByEmailSearch
// ---------------------------------------------------------------------------

describe("filterByEmailSearch", () => {
  const records = [
    { email: "alice@example.com", id: 1 },
    { email: "bob@test.org", id: 2 },
    { email: "CHARLIE@Example.COM", id: 3 },
    { email: null, id: 4 },
  ]

  it("returns all records when search is empty", () => {
    expect(filterByEmailSearch(records, "")).toHaveLength(4)
    expect(filterByEmailSearch(records, "  ")).toHaveLength(4)
  })

  it("filters case-insensitively", () => {
    const result = filterByEmailSearch(records, "example")
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.id)).toEqual([1, 3])
  })

  it("excludes records with null email", () => {
    const result = filterByEmailSearch(records, "a")
    expect(result.every((r) => r.email !== null)).toBe(true)
  })

  it("returns empty array when no match", () => {
    expect(filterByEmailSearch(records, "zzz")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// filterErrorsByContext
// ---------------------------------------------------------------------------

describe("filterErrorsByContext", () => {
  const errors = [
    { error_context: "onboarding_upload", msg: "upload fail" },
    { error_context: "onboarding_chat", msg: "chat fail" },
    { error_context: "onboarding_logo", msg: "logo fail" },
    { error_context: "onboarding_payments", msg: "pay fail" },
    { error_context: "onboarding_chat_ai_error", msg: "ai fail" },
    { error_context: "document_generation", msg: "gen fail" },
    { error_context: "payment_processing", msg: "proc fail" },
  ]

  it('returns all errors when filter is "All"', () => {
    expect(filterErrorsByContext(errors, "All")).toHaveLength(7)
  })

  it('filters by phase-specific context for "Upload"', () => {
    const result = filterErrorsByContext(errors, "Upload")
    expect(result).toHaveLength(1)
    expect(result[0].error_context).toBe("onboarding_upload")
  })

  it('filters by phase-specific context for "Chat" (includes ai_error)', () => {
    const result = filterErrorsByContext(errors, "Chat")
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.error_context.includes("onboarding_chat"))).toBe(true)
  })

  it('returns non-onboarding errors for "Non-Onboarding"', () => {
    const result = filterErrorsByContext(errors, "Non-Onboarding")
    expect(result).toHaveLength(2)
    expect(result.every((e) => !e.error_context.startsWith("onboarding"))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// applyOnboardingFilters
// ---------------------------------------------------------------------------

describe("applyOnboardingFilters", () => {
  const records = [
    { email: "a@test.com", onboarding_status: "completed" as const, current_phase: "completed", has_errors: false },
    { email: "b@test.com", onboarding_status: "in-progress" as const, current_phase: "chat", has_errors: true },
    { email: "c@test.com", onboarding_status: "dropped-off" as const, current_phase: "upload", has_errors: false },
    { email: "d@test.com", onboarding_status: "in-progress" as const, current_phase: "payments", has_errors: false },
  ]

  it("returns all records when no filters are active", () => {
    expect(applyOnboardingFilters(records, {})).toHaveLength(4)
  })

  it("filters by status", () => {
    const result = applyOnboardingFilters(records, { status: "in-progress" })
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.onboarding_status === "in-progress")).toBe(true)
  })

  it("filters by phase", () => {
    const result = applyOnboardingFilters(records, { phase: "chat" })
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe("b@test.com")
  })

  it("filters by errors (with-errors)", () => {
    const result = applyOnboardingFilters(records, { errors: "with-errors" })
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe("b@test.com")
  })

  it("filters by errors (without-errors)", () => {
    const result = applyOnboardingFilters(records, { errors: "without-errors" })
    expect(result).toHaveLength(3)
  })

  it("combines multiple filters with AND logic", () => {
    const result = applyOnboardingFilters(records, {
      status: "in-progress",
      errors: "with-errors",
    })
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe("b@test.com")
  })

  it("combines status + search with AND logic", () => {
    const result = applyOnboardingFilters(records, {
      status: "in-progress",
      search: "d@",
    })
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe("d@test.com")
  })
})
