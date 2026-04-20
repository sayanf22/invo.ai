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

export async function POST(request: NextRequest) {
  const ip = getIP(request)

  // Brute force check BEFORE parsing body
  const bruteCheck = checkBruteForce(ip)
  if (bruteCheck.blocked) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(bruteCheck.retryAfter) },
      }
    )
  }

  let body: { pin?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const { pin, email, password } = body
  if (!pin || !email || !password) {
    recordFailure(ip)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Add artificial delay to slow down automated attacks (100ms)
  await new Promise(resolve => setTimeout(resolve, 100))

  // Layer 1: Check email against ADMIN_EMAILS whitelist
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes(email.toLowerCase())) {
    recordFailure(ip)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Layer 2: Check password against ADMIN_PASSWORD (direct comparison)
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || password !== adminPassword) {
    recordFailure(ip)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Layer 3: Check PIN against ADMIN_PIN (direct comparison)
  const adminPin = process.env.ADMIN_PIN
  if (!adminPin || pin !== adminPin) {
    recordFailure(ip)
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // All layers passed — reset brute force counter
  resetAttempts(ip)

  // Issue admin session JWT
  const token = await createAdminSessionToken(email)

  // Store session in DB (best-effort)
  try {
    const serviceClient = getServiceRoleClient()
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
    path: "/clorefy-ctrl-8x2m", // scope cookie to admin path only
  })

  return response
}
