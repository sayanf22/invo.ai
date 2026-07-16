import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

describe("tier-aware (billing-anchored) usage periods", () => {
  it("defines a single DB source of truth: paid billing-anchored window + free calendar month", () => {
    const sql = source("supabase/migrations/20260718_billing_anchored_usage_periods.sql")
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.current_usage_period(p_user_id uuid)")
    expect(sql).toContain("'billing_anchored', true")
    expect(sql).toContain("'billing_anchored', false")
    // Paid window anchored on current_period_start, month-stepped with clamping.
    expect(sql).toContain("make_interval(months => v_months)")
    // Free branch uses the UTC calendar month.
    expect(sql).toContain("date_trunc('month', v_utc_now)")
    // Keys stay YYYY-MM so admin rollups and validation regexes keep working.
    expect(sql).toContain("to_char(timezone('UTC', v_ws), 'YYYY-MM')")
    // Auth: callers may only resolve their own period unless service_role.
    expect(sql).toContain("p_user_id IS DISTINCT FROM auth.uid()")
  })

  it("rebinds every usage writer to the authoritative tier-aware period key", () => {
    const sql = source("supabase/migrations/20260718_billing_anchored_usage_periods.sql")
    for (const fn of [
      "reserve_document_quota",
      "increment_document_count",
      "increment_email_count",
      "increment_user_usage",
    ]) {
      const idx = sql.indexOf(`FUNCTION public.${fn}`)
      expect(idx, `${fn} should be redefined`).toBeGreaterThan(-1)
    }
    // Reservation derives the bucket from the period function, not a raw month.
    expect(sql).toContain("v_period := public.current_usage_period_key(p_user_id)")
    // Existing (already reserved) documents are never re-charged after downgrade.
    expect(sql).toContain("IF v_session.quota_counted_at IS NOT NULL THEN")
  })

  it("keeps existing documents editable after downgrade — type gate only for new docs", () => {
    const stream = source("app/api/ai/stream/route.ts")
    // The type gate must run only when the session has not yet reserved quota.
    expect(stream).toContain("!(sessionData as any).quota_counted_at")
    expect(stream).toContain("checkDocumentTypeAllowed(requestedType, userTier)")
    // The old unconditional pre-session type gate must be gone.
    expect(stream).not.toContain('const docTypeToCheck = (body.documentType || "invoice").toLowerCase()')
    // The session lookup must select quota_counted_at to make that decision.
    expect(stream).toContain("id,status,document_type,quota_counted_at")
  })

  it("usage API resolves the tier-aware period and exposes billingAnchored", () => {
    const route = source("app/api/usage/route.ts")
    expect(route).toContain('rpc("current_usage_period" as any')
    expect(route).toContain("billingAnchored")
    expect(route).toContain("billing_anchored_monthly_window")
    expect(route).toContain("utc_calendar_month")
  })

  it("cost-protection readers scope to the resolved period, not a raw calendar month", () => {
    const lib = source("lib/cost-protection.ts")
    expect(lib).toContain("export async function resolveUsagePeriodKey(")
    expect(lib).toContain('rpc as any)("current_usage_period_key"')
    // getUserUsage and checkEmailLimit must use the resolved period.
    const getUserUsage = lib.slice(lib.indexOf("async function getUserUsage"))
    expect(getUserUsage.slice(0, 400)).toContain("await resolveUsagePeriodKey(supabase, userId)")
  })

  it("billing copy is tier-aware, de-duplicated, and promises existing docs stay editable", () => {
    const billing = source("app/billing/page.tsx")
    expect(billing).toContain("Paid allowances renew on your billing date each month")
    expect(billing).toContain("Free allowances reset at the start of each UTC calendar month")
    expect(billing).toContain("Existing documents always stay editable, even after a downgrade.")
    // The old redundant/contradictory single-line copy must be gone.
    expect(billing).not.toContain("Allowances reset at each UTC month start and once when a verified plan transition becomes active; existing documents remain editable.")
  })
})
