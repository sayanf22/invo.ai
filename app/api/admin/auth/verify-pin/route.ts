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
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(request: NextRequest) {
  let body: { pin?: string; email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const { pin, email, password } = body
  if (!pin || !email || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const ip = getIP(request)

  // Layer 1: Check email against ADMIN_EMAILS whitelist
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!adminEmails.includes(email.toLowerCase())) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Layer 2: Check password against ADMIN_PASSWORD (direct comparison)
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // Layer 3: Check PIN against ADMIN_PIN (direct comparison)
  const adminPin = process.env.ADMIN_PIN
  if (!adminPin || pin !== adminPin) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  // All layers passed — issue admin session JWT
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
    sameSite: "lax",
    maxAge: 3600,
    path: "/",
  })

  return response
}
