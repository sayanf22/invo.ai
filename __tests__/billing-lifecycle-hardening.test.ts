import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { applyRazorpayTerminalSnapshot } from "@/lib/razorpay-subscription-state"

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
const userId = "7670887d-0945-4f2e-afc6-86004f4bb35b"

describe("billing lifecycle hardening", () => {
  it("routes terminal snapshots through the atomic service RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: { applied: true, stale: false, finalized: true, period_end: "2026-07-16T10:34:44.816Z" },
      error: null,
    }))
    const result = await applyRazorpayTerminalSnapshot({ rpc } as any, {
      id: "sub_BOUND123", status: "cancelled", current_end: 1_784_198_084,
      notes: { platform: "clorefy", user_id: userId },
    }, { userId, eventType: "subscription.cancelled", eventCreatedAt: new Date("2026-07-16T10:34:45Z") })

    expect(result).toMatchObject({ applied: true, finalized: true })
    expect(rpc).toHaveBeenCalledWith("record_subscription_terminal_event", expect.objectContaining({
      p_user_id: userId, p_subscription_id: "sub_BOUND123", p_provider_status: "cancelled",
    }))
  })

  it("keeps expiry finalization atomic, bounded, secret-free, and service-only", () => {
    const sql = source("supabase/migrations/20260717_finalize_subscription_expiry.sql")
    const profileSync = source("supabase/migrations/20260717_allow_postgres_profile_tier_sync.sql")
    expect(sql).toContain("FOR UPDATE SKIP LOCKED")
    expect(sql).toContain("finalize_due_subscription_entitlements(500)")
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM authenticated")
    expect(sql).not.toMatch(/http_request|net\.http|service_role_key|authorization/i)
    expect(profileSync).toContain("session_user <> 'postgres'")
    expect(profileSync).toContain("FROM PUBLIC, anon, authenticated")
  })

  it("uses atomic session reservation instead of the redundant early quota gate", () => {
    const stream = source("app/api/ai/stream/route.ts")
    expect(stream).not.toContain("checkCostLimit(")
    expect(stream).toContain("reserveDocumentQuota(")
  })

  it("keeps transition allowance resets transactional, archived, and replay-safe", () => {
    const sql = source("supabase/migrations/20260717_recover_subscription_transitions_and_reset_usage.sql")
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.subscription_usage_resets")
    expect(sql).toContain("ON CONFLICT (transition_key) DO NOTHING")
    // Paid resets happen inside the exact charge RPC, keyed by the transition id.
    expect(sql).toContain("'paid:' || v_transition_id::text")
    expect(sql).toContain("IF v_completes_transition THEN")
    // Only the paid-to-Free boundary is owned by the standalone trigger.
    expect(sql).toContain("OLD.current_period_end <= now()")
    expect(sql).toContain("previous_documents_count")
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.clear_subscription_transition")
    expect(sql).not.toMatch(/service_role_key|http_request|net\.http/i)
  })

  it("gates paid entitlement on an exact transition compare-and-set", () => {
    const sql = source("supabase/migrations/20260717_recover_subscription_transitions_and_reset_usage.sql")
    // The charge must match the stored transition id, plan/cycle, and provider plan.
    expect(sql).toContain("v_sub.pending_transition_id IS NOT NULL")
    expect(sql).toContain("v_sub.pending_provider_plan_id = p_plan_id")
    // A renewal of the current plan must not clear an unrelated pending change.
    expect(sql).toContain("charge_does_not_match_pending_transition")
    // clear_subscription_transition requires the expected transition id (CAS).
    expect(sql).toContain("v_sub.pending_transition_id IS DISTINCT FROM p_expected_transition_id")
  })

  it("shows the exact scheduled target and reset boundary in Billing", () => {
    const billing = source("app/billing/page.tsx")
    expect(billing).toContain("Scheduled plan")
    expect(billing).toContain("Starts {formatExactLocal(subscription.pending_effective_at)}")
    expect(billing).toContain("allowance counters reset once when this transition actually completes")
    expect(billing).toContain("Cancel scheduled change")
    expect(billing).not.toContain('hasPendingChange ? "Change Pending"')
  })

  it("keeps legacy receipt IDs optional and avoids unsupported official or tax claims", () => {
    const templates = source("lib/pdf-templates.tsx")
    const receipt = templates.slice(
      templates.indexOf("export interface PaymentReceiptData"),
      templates.indexOf("export function SOWPDF"),
    )
    expect(receipt).toContain("paymentId?: string | null")
    expect(receipt).not.toContain("Official payment receipt")
    expect(receipt).not.toContain(">Included</Text>")
  })
})