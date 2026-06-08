import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createAdminSessionToken } from "@/lib/admin-auth"
import { logAudit } from "@/lib/audit-log"

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getIP(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

// In-memory brute force tracker (per IP, resets on worker restart)
// For Cloudflare Workers this is per-isolate — good enough for admin protection
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function checkBruteForce(ip: string): { blocked: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = failedAttempts.get(ip)

  if (!record) return { blocked: false }

  // Check if still locked out
  if (record.lockedUntil > now) {
    return { blocked: true, retryAfter: Math.ceil((record.lockedUntil - now) / 1000) }
  }

  // Lockout expired — reset
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttempts.delete(ip)
    return { blocked: false }
  }

  return { blocked: false }
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 }
  record.count += 1

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS
  }

  failedAttempts.set(ip, record)
}

function resetAttempts(ip: string): void {
  failedAttempts.delete(ip)
}

// ── DB-backed lockout (persists across Cloudflare isolates & restarts) ─────────
// The in-memory tracker above is per-isolate, so a determined attacker could
// spread guesses across isolates. This adds a persistent, cross-instance count
// of recent failures from audit_logs. Fails safe: if the DB read errors, we fall
// back to the in-memory limiter (login still protected by password + PIN).
const DB_WINDOW_MS = 15 * 60 * 1000

async function dbFailureCount(client: ReturnType<typeof getServiceRoleClient>, ip: string): Promise<number> {
  if (ip === "unknown") return 0
  try {
    const since = new Date(Date.now() - DB_WINDOW_MS).toISOString()
    const { count } = await client
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "security.auth_failure")
      .eq("ip_address", ip)
      .gte("created_at", since)
    return count ?? 0
  } catch {
    return 0
  }
}

async function logFailureToDb(client: ReturnType<typeof getServiceRoleClient>, ip: string): Promise<void> {
  try {
    await client.from("audit_logs").insert({
      user_id: "admin",
      action: "security.auth_failure",
      ip_address: ip,
      metadata: { context: "admin_login" },
    })
  } catch { /* non-blocking */ }
}

export async function POST(request: NextRequest) {
  const ip = getIP(request)
  const serviceClient = getServiceRoleClient()

  // Brute force check BEFORE parsing body — in-memory (fast) + DB-backed (persistent)
  const bruteCheck = checkBruteForce(ip)
  if (bruteCheck.blocked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(bruteCheck.retryAfter) } }
    )
  }
  // Cross-isolate persistent lockout: block if too many recent DB-logged failures
  const dbFails = await dbFailureCount(serviceClient, ip)
  if (dbFails >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(LOCKOUT_MS / 1000)) } }
    )
  }

  // Helper: record a failure in BOTH in-memory and DB (cross-isolate)
  const fail = (status = 401, msg = "Invalid credentials") => {
    recordFailure(ip)
    void logFailureToDb(serviceClient, ip)
    return NextResponse.json({ error: msg }, { status })
  }

  let body: { pin?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const { pin, email, password } = body
  if (!pin || !email || !password) {
    return fail()
  }

  // Add artificial delay to slow down automated attacks (100ms)
  await new Promise(resolve => setTimeout(resolve, 100))

  // Layer 1: Check email against ADMIN_EMAILS whitelist
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes(email.toLowerCase())) {
    return fail()
  }

  // Layer 2: Check password against ADMIN_PASSWORD (timing-safe comparison)
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    return fail()
  }
  // Use timing-safe comparison to prevent timing attacks
  const passwordMatch = (() => {
    try {
      const a = Buffer.from(password, "utf8")
      const b = Buffer.from(adminPassword, "utf8")
      if (a.length !== b.length) return false
      return require("crypto").timingSafeEqual(a, b)
    } catch { return false }
  })()
  if (!passwordMatch) {
    return fail()
  }

  // Layer 3: Check PIN against ADMIN_PIN (timing-safe comparison)
  const adminPin = process.env.ADMIN_PIN
  if (!adminPin) {
    return fail()
  }
  const pinMatch = (() => {
    try {
      const a = Buffer.from(pin, "utf8")
      const b = Buffer.from(adminPin, "utf8")
      if (a.length !== b.length) return false
      return require("crypto").timingSafeEqual(a, b)
    } catch { return false }
  })()
  if (!pinMatch) {
    return fail()
  }

  // All layers passed — reset brute force counter
  resetAttempts(ip)

  // Issue admin session JWT
  const token = await createAdminSessionToken(email)

  // Store session in DB (best-effort)
  try {
    const tokenBytes = new TextEncoder().encode(token)
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes)
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    await serviceClient.from("admin_sessions").insert({
      admin_email: email,
      session_token_hash: tokenHash,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      ip_address: ip,
    })

    await logAudit(serviceClient as any, {
      user_id: "admin",
      action: "admin.login",
      ip_address: ip,
      metadata: { email, ip_address: ip },
    })
  } catch {
    // Non-blocking
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set("admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // upgraded from lax to strict for admin
    maxAge: 3600,
    path: "/", // must be "/" so the cookie is sent to both /clorefy-ctrl-8x2m and /api/admin routes
  })

  return response
}
