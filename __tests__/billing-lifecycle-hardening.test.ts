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