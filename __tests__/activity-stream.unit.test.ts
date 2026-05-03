import { describe, it, expect } from "vitest"

/**
 * Unit tests for activity stream events in the dual-model chat architecture.
 *
 * The activity stream logic lives inline in app/api/ai/stream/route.ts.
 * Rather than spinning up the full route handler (which requires auth,
 * Supabase, secrets, etc.), we replicate the core activity-emitting patterns
 * and test them with controlled inputs — the same approach used in
 * fallback.unit.test.ts.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

// ── Types matching the real SSE event shapes ──────────────────────────

type ActivityEvent = {
  type: "activity"
  action: "read" | "search" | "generate"
  label: string
  detail?: string
}

type SentEvent =
  | ActivityEvent
  | { type: "chunk"; data: string }
  | { type: "complete"; data: string }
  | { type: "error"; data: string }

// ── Extracted activity-emitting patterns from route handler ───────────

/**
 * Replicates the business profile fetch activity pattern from route.ts.
 * Emits an initial "read" activity, then updates with the business name
 * or "Not found" based on the fetch result.
 */
function emitBusinessProfileActivity(
  sendEvent: (e: SentEvent) => void,
  business: { name?: string } | null
): void {
  sendEvent({ type: "activity", action: "read", label: "Business profile" })

  if (business) {
    sendEvent({
      type: "activity",
      action: "read",
      label: "Business profile",
      detail: business.name || "Loaded",
    })
  } else {
    sendEvent({
      type: "activity",
      action: "read",
      label: "Business profile",
      detail: "Not found",
    })
  }
}

/**
 * Replicates the compliance search activity pattern from route.ts.
 * Only emits when country is non-empty. Updates with rule count and
 * optional tax rate detail.
 */
function emitComplianceSearchActivity(
  sendEvent: (e: SentEvent) => void,
  country: string,
  rulesCount: number,
  taxRate?: number
): void {
  if (country) {
    sendEvent({
      type: "activity",
      action: "search",
      label: `${country} compliance rules`,
    })
  }

  // After fetch completes
  if (country) {
    const taxRateDetail = taxRate !== undefined ? `, ${taxRate}% tax` : ""
    sendEvent({
      type: "activity",
      action: "search",
      label: `${country} compliance rules`,
      detail: `${rulesCount} rules found${taxRateDetail}`,
    })
  }
}

/**
 * Replicates the document number activity pattern from route.ts.
 * Always emits a "generate" activity with the document number as detail.
 */
function emitDocumentNumberActivity(
  sendEvent: (e: SentEvent) => void,
  docNumber: string
): void {
  sendEvent({
    type: "activity",
    action: "generate",
    label: "Document number",
    detail: docNumber,
  })
}

/**
 * Replicates the model routing activity pattern from route.ts.
 * Emits a "generate" activity with the model name as detail.
 * Label depends on whether it's document generation or chat.
 */
function emitModelRoutingActivity(
  sendEvent: (e: SentEvent) => void,
  isDocGeneration: boolean,
  modelName: "DeepSeek" | "Kimi K2.5" | "DeepSeek (fallback)"
): void {
  sendEvent({
    type: "activity",
    action: "generate",
    label: isDocGeneration ? "Generating document" : "Responding",
    detail: modelName,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Activity stream events – unit tests", () => {
  // ── Business profile activity ─────────────────────────────────────

  describe("Business profile fetch activity", () => {
    /**
     * Validates: Requirement 5.1
     * WHEN the server begins processing a request, THE Activity_Stream
     * SHALL emit an activity event with action: "read" and label: "Business profile".
     */
    it('emits action: "read" with label "Business profile" initially', () => {
      const events: SentEvent[] = []
      emitBusinessProfileActivity((e) => events.push(e), { name: "Acme Corp" })

      const initial = events[0] as ActivityEvent
      expect(initial.type).toBe("activity")
      expect(initial.action).toBe("read")
      expect(initial.label).toBe("Business profile")
    })

    /**
     * Validates: Requirement 5.2
     * WHEN the business profile fetch completes, THE Activity_Stream SHALL
     * update the activity event with a detail field containing the business name.
     */
    it("updates detail with business name when profile is found", () => {
      const events: SentEvent[] = []
      emitBusinessProfileActivity((e) => events.push(e), { name: "Acme Corp" })

      const updated = events[1] as ActivityEvent
      expect(updated.type).toBe("activity")
      expect(updated.action).toBe("read")
      expect(updated.label).toBe("Business profile")
      expect(updated.detail).toBe("Acme Corp")
    })

    /**
     * Validates: Requirement 5.2
     * WHEN the business profile fetch completes with no result,
     * THE Activity_Stream SHALL update with detail "Not found".
     */
    it('updates detail with "Not found" when profile is null', () => {
      const events: SentEvent[] = []
      emitBusinessProfileActivity((e) => events.push(e), null)

      const updated = events[1] as ActivityEvent
      expect(updated.detail).toBe("Not found")
    })

    /**
     * Validates: Requirement 5.2
     * When business exists but has no name, detail should be "Loaded".
     */
    it('updates detail with "Loaded" when business has no name', () => {
      const events: SentEvent[] = []
      emitBusinessProfileActivity((e) => events.push(e), { name: "" })

      const updated = events[1] as ActivityEvent
      expect(updated.detail).toBe("Loaded")
    })
  })

  // ── Compliance search activity ────────────────────────────────────

  describe("Compliance search activity", () => {
    /**
     * Validates: Requirement 5.3
     * WHEN the server fetches compliance rules for a known country,
     * THE Activity_Stream SHALL emit an activity event with action: "search"
     * and label containing the country name.
     */
    it('emits action: "search" with country name in label when country is present', () => {
      const events: SentEvent[] = []
      emitComplianceSearchActivity((e) => events.push(e), "India", 5, 18)

      const initial = events[0] as ActivityEvent
      expect(initial.type).toBe("activity")
      expect(initial.action).toBe("search")
      expect(initial.label).toBe("India compliance rules")
    })

    /**
     * Validates: Requirement 5.4
     * WHEN compliance rule fetching completes, THE Activity_Stream SHALL
     * update with the number of rules found and the tax rate if available.
     */
    it("updates detail with rule count and tax rate", () => {
      const events: SentEvent[] = []
      emitComplianceSearchActivity((e) => events.push(e), "India", 5, 18)

      const updated = events[1] as ActivityEvent
      expect(updated.detail).toBe("5 rules found, 18% tax")
    })

    /**
     * Validates: Requirement 5.4
     * When no tax rate is available, detail should only show rule count.
     */
    it("updates detail with rule count only when no tax rate", () => {
      const events: SentEvent[] = []
      emitComplianceSearchActivity((e) => events.push(e), "USA", 3)

      const updated = events[1] as ActivityEvent
      expect(updated.detail).toBe("3 rules found")
    })

    /**
     * Validates: Requirement 5.7
     * THE Activity_Stream SHALL only emit events for operations that are
     * actually being performed — no compliance search when country is empty.
     */
    it("does NOT emit any search activity when country is empty", () => {
      const events: SentEvent[] = []
      emitComplianceSearchActivity((e) => events.push(e), "", 0)

      expect(events).toHaveLength(0)
    })

    /**
     * Validates: Requirement 5.3
     * Different countries produce different labels.
     */
    it("uses the correct country name in the label", () => {
      const countries = ["Germany", "UK", "Singapore", "Australia"]
      for (const country of countries) {
        const events: SentEvent[] = []
        emitComplianceSearchActivity((e) => events.push(e), country, 2)

        const initial = events[0] as ActivityEvent
        expect(initial.label).toBe(`${country} compliance rules`)
      }
    })
  })

  // ── Document number activity ──────────────────────────────────────

  describe("Document number activity", () => {
    /**
     * Validates: Requirement 5.5
     * WHEN the server generates a document number, THE Activity_Stream
     * SHALL emit an activity event with action: "generate" and
     * label: "Document number" with the generated number as detail.
     */
    it('emits action: "generate" with label "Document number" and the number as detail', () => {
      const events: SentEvent[] = []
      emitDocumentNumberActivity((e) => events.push(e), "INV-2025-01-001")

      expect(events).toHaveLength(1)
      const event = events[0] as ActivityEvent
      expect(event.type).toBe("activity")
      expect(event.action).toBe("generate")
      expect(event.label).toBe("Document number")
      expect(event.detail).toBe("INV-2025-01-001")
    })

    /**
     * Validates: Requirement 5.5
     * Different document type prefixes produce different numbers.
     */
    it("includes the correct document number for different prefixes", () => {
      const numbers = [
        "INV-2025-07-003",
        "QUO-2025-07-001",
        "CTR-2025-07-002",
        "PROP-2025-07-001",
      ]
      for (const num of numbers) {
        const events: SentEvent[] = []
        emitDocumentNumberActivity((e) => events.push(e), num)

        const event = events[0] as ActivityEvent
        expect(event.detail).toBe(num)
      }
    })
  })

  // ── Model routing activity ────────────────────────────────────────

  describe("Model routing activity", () => {
    /**
     * Validates: Requirement 5.6
     * WHEN the server begins streaming from the Document_Model for doc generation,
     * THE Activity_Stream SHALL emit action: "generate" with label "Generating document"
     * and detail "DeepSeek".
     */
    it('emits "Generating document" with detail "DeepSeek" for document generation', () => {
      const events: SentEvent[] = []
      emitModelRoutingActivity((e) => events.push(e), true, "DeepSeek")

      const event = events[0] as ActivityEvent
      expect(event.type).toBe("activity")
      expect(event.action).toBe("generate")
      expect(event.label).toBe("Generating document")
      expect(event.detail).toBe("DeepSeek")
    })

    /**
     * Validates: Requirement 5.6
     * WHEN the server begins streaming from the Chat_Model for conversation,
     * THE Activity_Stream SHALL emit action: "generate" with label "Responding"
     * and detail "Kimi K2.5".
     */
    it('emits "Responding" with detail "Kimi K2.5" for conversational chat', () => {
      const events: SentEvent[] = []
      emitModelRoutingActivity((e) => events.push(e), false, "Kimi K2.5")

      const event = events[0] as ActivityEvent
      expect(event.type).toBe("activity")
      expect(event.action).toBe("generate")
      expect(event.label).toBe("Responding")
      expect(event.detail).toBe("Kimi K2.5")
    })

    /**
     * Validates: Requirement 5.6
     * WHEN fallback activates, THE Activity_Stream SHALL emit
     * detail "DeepSeek (fallback)".
     */
    it('emits "Responding" with detail "DeepSeek (fallback)" on fallback', () => {
      const events: SentEvent[] = []
      emitModelRoutingActivity((e) => events.push(e), false, "DeepSeek (fallback)")

      const event = events[0] as ActivityEvent
      expect(event.label).toBe("Responding")
      expect(event.detail).toBe("DeepSeek (fallback)")
    })

    /**
     * Validates: Requirement 5.6
     * When no Bedrock key is available and chat falls back to DeepSeek directly,
     * the detail should be "DeepSeek" (not "DeepSeek (fallback)").
     */
    it('emits "Responding" with detail "DeepSeek" when no Bedrock key', () => {
      const events: SentEvent[] = []
      emitModelRoutingActivity((e) => events.push(e), false, "DeepSeek")

      const event = events[0] as ActivityEvent
      expect(event.label).toBe("Responding")
      expect(event.detail).toBe("DeepSeek")
    })
  })

  // ── Full activity stream sequence ─────────────────────────────────

  describe("Full activity stream sequence", () => {
    /**
     * Validates: Requirements 5.1, 5.3, 5.5, 5.6
     * A complete request with all steps should emit activities in order:
     * 1. Business profile read
     * 2. Compliance search (when country present)
     * 3. Document number generation
     * 4. Model routing
     */
    it("emits all activity events in correct order for a full request with country", () => {
      const events: SentEvent[] = []
      const send = (e: SentEvent) => events.push(e)

      // Step 1: Business profile
      emitBusinessProfileActivity(send, { name: "Test Corp" })
      // Step 2: Compliance search (country present)
      emitComplianceSearchActivity(send, "India", 5, 18)
      // Step 3: Document number
      emitDocumentNumberActivity(send, "INV-2025-01-001")
      // Step 4: Model routing
      emitModelRoutingActivity(send, true, "DeepSeek")

      const activities = events.filter(
        (e) => e.type === "activity"
      ) as ActivityEvent[]

      // 2 (profile initial + update) + 2 (search initial + update) + 1 (doc number) + 1 (model) = 6
      expect(activities).toHaveLength(6)

      // Verify order of actions
      expect(activities[0].action).toBe("read")
      expect(activities[1].action).toBe("read")
      expect(activities[2].action).toBe("search")
      expect(activities[3].action).toBe("search")
      expect(activities[4].action).toBe("generate")
      expect(activities[4].label).toBe("Document number")
      expect(activities[5].action).toBe("generate")
      expect(activities[5].label).toBe("Generating document")
    })

    /**
     * Validates: Requirements 5.1, 5.5, 5.6, 5.7
     * When country is empty, compliance search should be skipped entirely.
     */
    it("skips compliance search activity when country is empty", () => {
      const events: SentEvent[] = []
      const send = (e: SentEvent) => events.push(e)

      // Step 1: Business profile (no country)
      emitBusinessProfileActivity(send, { name: "No Country Corp" })
      // Step 2: Compliance search — country is empty, should emit nothing
      emitComplianceSearchActivity(send, "", 0)
      // Step 3: Document number
      emitDocumentNumberActivity(send, "INV-2025-01-001")
      // Step 4: Model routing
      emitModelRoutingActivity(send, true, "DeepSeek")

      const activities = events.filter(
        (e) => e.type === "activity"
      ) as ActivityEvent[]

      // 2 (profile) + 0 (no search) + 1 (doc number) + 1 (model) = 4
      expect(activities).toHaveLength(4)

      // No search actions should be present
      const searchActivities = activities.filter((a) => a.action === "search")
      expect(searchActivities).toHaveLength(0)
    })
  })
})
