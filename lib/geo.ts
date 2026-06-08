/**
 * IP geolocation resolver.
 *
 * Two sources, in priority order:
 *   1. Cloudflare edge headers — instant, free, no external call. Available when
 *      the "Add visitor location headers" Managed Transform is enabled (and
 *      `cf-ipcountry` is always present on Cloudflare). This is the fast path.
 *   2. ipwho.is fallback — free, HTTPS, no API key. Used to enrich city/region
 *      when Cloudflare headers are incomplete (e.g. country-only).
 *
 * All lookups are best-effort: failures never throw, they return what we have.
 * No PII is stored beyond IP + coarse location (city/region/country) which is
 * standard for security audit / login-location features.
 */

export interface GeoLocation {
  ip: string | null
  country: string | null
  countryCode: string | null
  region: string | null
  city: string | null
  timezone: string | null
  latitude: number | null
  longitude: number | null
}

const EMPTY_GEO: GeoLocation = {
  ip: null, country: null, countryCode: null, region: null,
  city: null, timezone: null, latitude: null, longitude: null,
}

/** Extract the client IP from request headers (Cloudflare-aware). */
export function getClientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")
  if (cf) return cf.trim()
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = headers.get("x-real-ip")
  if (real) return real.trim()
  return null
}

const toNum = (v: string | null): number | null => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Read geolocation directly from Cloudflare request headers.
 * `cf-ipcountry` is always present; city/region/etc. require the managed transform.
 */
export function geoFromCloudflareHeaders(headers: Headers): GeoLocation {
  const ip = getClientIp(headers)
  const countryCode = headers.get("cf-ipcountry")
  return {
    ip,
    country: null, // CF only gives the 2-letter code; full name resolved by fallback
    countryCode: countryCode && countryCode !== "XX" ? countryCode : null,
    region: headers.get("cf-region") || null,
    city: headers.get("cf-ipcity") || null,
    timezone: headers.get("cf-timezone") || null,
    latitude: toNum(headers.get("cf-iplatitude")),
    longitude: toNum(headers.get("cf-iplongitude")),
  }
}

/** Resolve geolocation for an IP via the free ipwho.is API (HTTPS, no key). */
async function geoFromIpwhois(ip: string): Promise<Partial<GeoLocation>> {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return {}
    const d = (await res.json()) as Record<string, any>
    if (d?.success === false) return {}
    return {
      country: typeof d.country === "string" ? d.country : null,
      countryCode: typeof d.country_code === "string" ? d.country_code : null,
      region: typeof d.region === "string" ? d.region : null,
      city: typeof d.city === "string" ? d.city : null,
      timezone: typeof d?.timezone?.id === "string" ? d.timezone.id : null,
      latitude: typeof d.latitude === "number" ? d.latitude : null,
      longitude: typeof d.longitude === "number" ? d.longitude : null,
    }
  } catch {
    return {}
  }
}

/**
 * Resolve the most complete geolocation possible for a request.
 * Uses Cloudflare headers first, then enriches missing city/region via ipwho.is.
 */
export async function resolveGeo(headers: Headers): Promise<GeoLocation> {
  const cf = geoFromCloudflareHeaders(headers)
  if (!cf.ip) return { ...EMPTY_GEO }

  // If Cloudflare already gave us city + country code, that's enough — skip the API call.
  if (cf.city && cf.countryCode) return cf

  // Otherwise enrich via the fallback API (skip for private/unknown IPs)
  if (isPrivateIp(cf.ip)) return cf

  const enriched = await geoFromIpwhois(cf.ip)
  return {
    ip: cf.ip,
    country: enriched.country ?? cf.country,
    countryCode: cf.countryCode ?? enriched.countryCode ?? null,
    region: cf.region ?? enriched.region ?? null,
    city: cf.city ?? enriched.city ?? null,
    timezone: cf.timezone ?? enriched.timezone ?? null,
    latitude: cf.latitude ?? enriched.latitude ?? null,
    longitude: cf.longitude ?? enriched.longitude ?? null,
  }
}

/** True for localhost / private network ranges that can't be geolocated. */
export function isPrivateIp(ip: string): boolean {
  if (ip === "unknown" || ip === "::1" || ip === "127.0.0.1") return true
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true // IPv6 ULA
  return false
}

/** Human-readable "City, Region, Country" — skips missing parts. */
export function formatLocation(geo: GeoLocation): string | null {
  const parts = [geo.city, geo.region, geo.country || geo.countryCode].filter(
    (p): p is string => !!p && p.trim().length > 0
  )
  // De-duplicate (e.g. city === region)
  const unique = parts.filter((p, i) => parts.indexOf(p) === i)
  return unique.length > 0 ? unique.join(", ") : null
}
