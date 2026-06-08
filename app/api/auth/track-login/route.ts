/**
 * POST /api/auth/track-login
 *
 * Records a login event for the authenticated user with IP + resolved geolocation
 * (city / region / country). Called once by the client on the SIGNED_IN auth event,
 * which covers every login method (password, Google OAuth, magic link).
 *
 * Deduplication: skips inserting a new row if this user already has a login event
 * from the same IP within the last 30 minutes — so token refreshes and tab focus
 * don't create noise. We still refresh the profile's last_login_* snapshot.
 *
 * Auth: authenticateRequest() (the user's own session). No admin needed.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { createClient } from "@supabase/supabase-js"
import { resolveGeo, formatLocation } from "@/lib/geo"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

const DEDUP_WINDOW_MS = 30 * 60 * 1000 // 30 minutes

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest()
  if (auth.error) return auth.error
  const userId = auth.user.id

  // Optional login method hint from the client
  let method: string | null = null
  try {
    const body = await request.json()
    if (body && typeof body.method === "string") method = body.method.slice(0, 32)
  } catch { /* body is optional */ }

  const supabase = getServiceClient()

  // Resolve IP + geolocation (Cloudflare headers first, ipwho.is fallback)
  const geo = await resolveGeo(request.headers)
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null
  const location = formatLocation(geo)

  // Dedup: skip a fresh row if the same IP logged a session very recently
  try {
    if (geo.ip) {
      const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString()
      const { data: recent } = await supabase
        .from("login_events")
        .select("id")
        .eq("user_id", userId)
        .eq("ip_address", geo.ip)
        .gte("created_at", since)
        .limit(1)
      if (recent && recent.length > 0) {
        return NextResponse.json({ ok: true, deduped: true })
      }
    }
  } catch { /* non-critical — proceed to insert */ }

  // Insert the login event (best-effort)
  try {
    await supabase.from("login_events").insert({
      user_id: userId,
      ip_address: geo.ip,
      country: geo.country,
      country_code: geo.countryCode,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
      latitude: geo.latitude,
      longitude: geo.longitude,
      user_agent: userAgent,
      login_method: method,
    })
  } catch { /* non-critical */ }

  // Refresh the profile snapshot for fast admin-dashboard reads
  try {
    await supabase
      .from("profiles")
      .update({
        last_login_at: new Date().toISOString(),
        last_login_ip: geo.ip,
        last_login_location: location,
      })
      .eq("id", userId)
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, location })
}
