import { createClient } from "@supabase/supabase-js"
import { SignJWT, jwtVerify } from "jose"

export interface AdminSessionPayload {
  email: string
  iat: number
  exp: number
}

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set")
  return new TextEncoder().encode(secret)
}

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role is required for admin sessions")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** SHA-256 hex via Web Crypto so it runs in both Node and Cloudflare Workers. */
export async function hashAdminSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

async function verifyTokenAndPersistence(token: string): Promise<string | null> {
  const { payload } = await jwtVerify(token, getSecret())
  const email = String((payload as unknown as AdminSessionPayload).email || "").toLowerCase()
  if (!email || !getAdminEmails().includes(email)) return null

  const { data, error } = await getAdminClient()
    .from("admin_sessions")
    .select("admin_email,expires_at")
    .eq("session_token_hash", await hashAdminSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()
  if (error || !data || String(data.admin_email).toLowerCase() !== email) return null
  return email
}

/** Verify both the signed cookie and its revocable, non-expired DB session. */
export async function verifyAdminSession(request: Request): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get("cookie") || ""
    const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/)
    return match ? await verifyTokenAndPersistence(match[1]) : null
  } catch {
    return null
  }
}

export async function createAdminSessionToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(getSecret())
}

/** Server-component helper with the same revocation check as API routes. */
export async function requireAdmin(): Promise<string> {
  const { cookies } = await import("next/headers")
  const { notFound } = await import("next/navigation")
  const token = (await cookies()).get("admin_session")?.value
  if (!token) return notFound()
  try {
    return (await verifyTokenAndPersistence(token)) || notFound()
  } catch {
    return notFound()
  }
}
