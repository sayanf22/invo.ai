/**
 * RPC Preservation Property Tests — Razorpay Downgrade Billing Fix
 *
 * Property 2 (Preservation): Genuine Payment Failure Still Marked past_due
 * Feature: razorpay-downgrade-billing-fix (bugfix)
 *
 * These tests capture the BASELINE behavior of the LIVE, UNFIXED
 * `check_subscription_expiry` Postgres RPC (project tdeqauhtobtahncglqwq) that
 * MUST be preserved once the fix (Task 7.3) lands. They run against the current,
 * unfixed RPC and are expected to PASS.
 *
 * Observed baseline rules (confirmed manually via mcp_supabase_execute_sql against
 * a disposable test row before writing this test):
 *   1. NOT expired (current_period_end in the future): the RPC returns the
 *      subscription's CURRENT plan/status untouched, is_expired = false, and
 *      does NOT mutate the row (scheduled_downgrade stays exactly as stored) —
 *      regardless of what scheduled_downgrade or status happen to be set to.
 *   2. Expired AND scheduled_downgrade IS NULL: the RPC sets status = 'past_due'
 *      (idempotently — same result whether the row was already 'active' or
 *      already 'past_due') and leaves `plan` unchanged. is_expired = true.
 *   3. Expired AND scheduled_downgrade = 'free': the RPC ALREADY correctly sets
 *      status = 'active' and plan = 'free' — this is the ONE downgrade target
 *      that isn't bugged today, and must NOT regress once the fix generalizes
 *      "any completed downgrade -> active" to non-free targets too.
 *
 * This test deliberately stays OUT of the bug condition itself — i.e. it never
 * generates "expired AND scheduled_downgrade IN ('starter','pro','agency')",
 * since that case is documented as FAILING on unfixed code by the sibling
 * exploration test (Task 3). Do NOT modify the RPC/migration to make this test
 * pass or fail — this task only documents baseline behavior to protect.
 *
 * SAFETY: All rows are written to/deleted from a single pre-existing disposable
 * test account (a mailinator-based pentest fixture, NOT a real customer) and are
 * cleaned up immediately after each assertion. No other user's data is touched.
 *
 * Validates: Requirements 3.5, 3.6
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest"
import * as fc from "fast-check"
import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// ── Env loading (mirrors scripts/backfill-compliance-embeddings.mjs's lightweight loader) ──

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env not present — fall through, tests will skip below
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnvFile(path.join(__dirname, "..", ".env.local"))
loadEnvFile(path.join(__dirname, "..", ".env"))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasLiveCredentials = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)
const maybeIt = hasLiveCredentials ? it : it.skip

// Pre-existing disposable test fixture (pentest_clf_01@mailinator.com) — a
// dedicated, non-customer test account already present in the profiles table.
// This is NOT a real user's subscription; it exists solely to exercise
// RLS-bypassing / security-testing flows and is safe to write to and clean up.
const TEST_USER_ID = "6c6dfaa6-d000-4d7d-bb0d-39d0400f164f"

let admin: SupabaseClient

beforeAll(() => {
  if (hasLiveCredentials) {
    admin = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string)
  }
})

// Always leave the fixture's subscriptions row deleted between tests so each
// property run starts from a clean slate and no state leaks between cases.
afterEach(async () => {
  if (!hasLiveCredentials) return
  await admin.from("subscriptions").delete().eq("user_id", TEST_USER_ID)
})

// ── Generators ───────────────────────────────────────────────────────────────

const PAID_PLANS = ["starter", "pro", "agency"] as const
const NON_EXPIRED_STATUSES = ["active", "trialing", "past_due", "cancelled", "paused"] as const

const futureIsoArb = fc.integer({ min: 1, max: 60 }).map((days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
})

const pastIsoArb = fc.integer({ min: 1, max: 60 }).map((days) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
})

// Scenario 1: NOT expired — any scheduled_downgrade, any status, any paid plan.
// Bug condition never applies here (subscription hasn't hit its period end yet).
const notExpiredArb = fc.record({
  kind: fc.constant("not_expired" as const),
  plan: fc.constantFrom(...PAID_PLANS),
  status: fc.constantFrom(...NON_EXPIRED_STATUSES),
  scheduledDowngrade: fc.constantFrom(null, "free", "starter", "pro", "agency"),
  periodEnd: futureIsoArb,
})

// Scenario 2: expired, NO scheduled downgrade — genuine unscheduled expiry.
// The RPC must (still) mark this past_due, whether or not it already was.
const expiredNoDowngradeArb = fc.record({
  kind: fc.constant("expired_no_downgrade" as const),
  plan: fc.constantFrom(...PAID_PLANS),
  status: fc.constantFrom("active" as const, "past_due" as const),
  scheduledDowngrade: fc.constant(null),
  periodEnd: pastIsoArb,
})

// Scenario 3: expired, scheduled_downgrade = 'free' — the one downgrade target
// that is ALREADY correct on unfixed code (must not regress after the fix).
const expiredFreeDowngradeArb = fc.record({
  kind: fc.constant("expired_free_downgrade" as const),
  plan: fc.constantFrom(...PAID_PLANS),
  status: fc.constant("active" as const),
  scheduledDowngrade: fc.constant("free" as const),
  periodEnd: pastIsoArb,
})

const preservedStateArb = fc.oneof(notExpiredArb, expiredNoDowngradeArb, expiredFreeDowngradeArb)

// ── Helpers ────────────────────────────────────────────────────────────────

async function seedSubscription(state: {
  plan: string
  status: string
  scheduledDowngrade: string | null
  periodEnd: string
}) {
  const periodStart = new Date(new Date(state.periodEnd).getTime() - 30 * 86400 * 1000).toISOString()
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: TEST_USER_ID,
      plan: state.plan,
      billing_cycle: "monthly",
      status: state.status,
      current_period_start: periodStart,
      current_period_end: state.periodEnd,
      scheduled_downgrade: state.scheduledDowngrade,
      currency: "INR",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (error) throw new Error(`Failed to seed disposable subscription row: ${error.message}`)
}

async function callExpiryRpc(): Promise<{ plan: string; status: string; is_expired: boolean }> {
  const { data, error } = await admin.rpc("check_subscription_expiry", { p_user_id: TEST_USER_ID })
  if (error) throw new Error(`RPC call failed: ${error.message}`)
  return (data as any[])[0]
}

async function readSubscriptionRow() {
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan, status, scheduled_downgrade, current_period_end")
    .eq("user_id", TEST_USER_ID)
    .single()
  if (error) throw new Error(`Failed to read back disposable subscription row: ${error.message}`)
  return data
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("RPC Preservation: check_subscription_expiry — Genuine Payment Failure Still Marked past_due (live, unfixed)", () => {
  maybeIt(
    "matches the observed baseline for every state where the bug condition does NOT hold",
    async () => {
      await fc.assert(
        fc.asyncProperty(preservedStateArb, async (state) => {
          await seedSubscription(state)
          const result = await callExpiryRpc()
          const row = await readSubscriptionRow()

          if (state.kind === "not_expired") {
            // Rule 1: not expired -> returned unchanged, no mutation, scheduled_downgrade intact
            expect(result.is_expired).toBe(false)
            expect(result.plan).toBe(state.plan)
            expect(result.status).toBe(state.status)
            expect(row.scheduled_downgrade).toBe(state.scheduledDowngrade)
            expect(row.plan).toBe(state.plan)
            expect(row.status).toBe(state.status)
          } else if (state.kind === "expired_no_downgrade") {
            // Rule 2: expired, no scheduled downgrade -> past_due, plan unchanged
            expect(result.is_expired).toBe(true)
            expect(result.status).toBe("past_due")
            expect(result.plan).toBe(state.plan)
            expect(row.status).toBe("past_due")
            expect(row.scheduled_downgrade).toBeNull()
          } else {
            // Rule 3: expired, scheduled_downgrade = 'free' -> active, plan = 'free'
            // (already correct today — must not regress once the fix generalizes this)
            expect(result.is_expired).toBe(true)
            expect(result.status).toBe("active")
            expect(result.plan).toBe("free")
            expect(row.status).toBe("active")
            expect(row.plan).toBe("free")
            expect(row.scheduled_downgrade).toBeNull()
          }
        }),
        { numRuns: 20 }
      )
    },
    30000
  )
})
