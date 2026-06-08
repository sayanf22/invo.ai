/**
 * Lightweight, dependency-free User-Agent parser (edge-runtime safe).
 *
 * Extracts the operating system, browser, device type and — where the UA or
 * client hints expose it — the device model. All passive: derived purely from
 * request headers the browser already sends. No permission, no client JS.
 *
 * Note on modern UA reduction: Chrome/Edge now freeze parts of the UA string,
 * so Android model often appears as a placeholder ("K"). When the browser sends
 * the `Sec-CH-UA-Model` / `Sec-CH-UA-Platform` client hints we prefer those.
 */

export interface ParsedUserAgent {
  deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown"
  os: string | null
  osVersion: string | null
  browser: string | null
  browserVersion: string | null
  deviceModel: string | null
  /** Human-friendly one-liner, e.g. "iPhone · iOS 17 · Safari". */
  summary: string | null
}

function firstMatch(ua: string, re: RegExp): string | null {
  const m = ua.match(re)
  return m ? (m[1] ?? "").trim() || null : null
}

function detectOS(ua: string): { os: string | null; version: string | null } {
  // Order matters — check more specific patterns first.
  if (/windows nt/i.test(ua)) {
    const v = firstMatch(ua, /windows nt ([\d.]+)/i)
    // Windows 11 is reported as NT 10.0 too; we can't reliably distinguish.
    const map: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" }
    return { os: "Windows", version: v ? (map[v] ?? v) : null }
  }
  if (/iphone/i.test(ua)) return { os: "iOS", version: (firstMatch(ua, /os ([\d_]+)/i) || "").replace(/_/g, ".") || null }
  if (/ipad/i.test(ua)) return { os: "iPadOS", version: (firstMatch(ua, /os ([\d_]+)/i) || "").replace(/_/g, ".") || null }
  if (/android/i.test(ua)) return { os: "Android", version: firstMatch(ua, /android ([\d.]+)/i) }
  if (/cros/i.test(ua)) return { os: "ChromeOS", version: null }
  if (/mac os x/i.test(ua)) return { os: "macOS", version: (firstMatch(ua, /mac os x ([\d_]+)/i) || "").replace(/_/g, ".") || null }
  if (/linux/i.test(ua)) return { os: "Linux", version: null }
  return { os: null, version: null }
}

function detectBrowser(ua: string): { browser: string | null; version: string | null } {
  // Order matters — Edge/Brave/Samsung masquerade as Chrome, so check them first.
  if (/edg(?:a|ios|e)?\//i.test(ua)) return { browser: "Edge", version: firstMatch(ua, /edg(?:a|ios|e)?\/([\d.]+)/i) }
  if (/opr\/|opera/i.test(ua)) return { browser: "Opera", version: firstMatch(ua, /(?:opr|opera)\/([\d.]+)/i) }
  if (/samsungbrowser/i.test(ua)) return { browser: "Samsung Internet", version: firstMatch(ua, /samsungbrowser\/([\d.]+)/i) }
  if (/firefox|fxios/i.test(ua)) return { browser: "Firefox", version: firstMatch(ua, /(?:firefox|fxios)\/([\d.]+)/i) }
  if (/crios/i.test(ua)) return { browser: "Chrome", version: firstMatch(ua, /crios\/([\d.]+)/i) }
  if (/chrome/i.test(ua)) return { browser: "Chrome", version: firstMatch(ua, /chrome\/([\d.]+)/i) }
  if (/safari/i.test(ua)) return { browser: "Safari", version: firstMatch(ua, /version\/([\d.]+)/i) }
  return { browser: null, version: null }
}

function detectDeviceType(ua: string): ParsedUserAgent["deviceType"] {
  if (/bot|crawler|spider|crawling|facebookexternalhit|slurp/i.test(ua)) return "bot"
  if (/ipad|tablet|(android(?!.*mobile))|playbook|silk/i.test(ua)) return "tablet"
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) return "mobile"
  if (/windows nt|macintosh|mac os x|cros|linux/i.test(ua)) return "desktop"
  return "unknown"
}

/** Try to pull a device model from the UA (mainly Android handsets). */
function detectModelFromUA(ua: string): string | null {
  if (/iphone/i.test(ua)) return "iPhone"
  if (/ipad/i.test(ua)) return "iPad"
  // Android: "...; <MODEL> Build/..." or "...; <MODEL>) AppleWebKit"
  const m = ua.match(/android[^;]*;\s*([^;)]+?)\s*(?:build\/|\))/i)
  if (m && m[1]) {
    const model = m[1].trim()
    // Filter out generic/frozen placeholders and locale strings
    if (model && model.toLowerCase() !== "k" && !/^[a-z]{2}-[a-z]{2}$/i.test(model) && model.length <= 64) {
      return model
    }
  }
  return null
}

/** Strip surrounding quotes from a client-hint header value. */
function unquote(v: string | null): string | null {
  if (!v) return null
  return v.replace(/^"|"$/g, "").trim() || null
}

/**
 * Parse a User-Agent string, optionally enriched with UA client-hint headers.
 * @param uaString the `user-agent` header
 * @param hints optional { model, platform, platformVersion, mobile } from Sec-CH-UA-* headers
 */
export function parseUserAgent(
  uaString: string | null | undefined,
  hints?: { model?: string | null; platform?: string | null; platformVersion?: string | null; mobile?: string | null }
): ParsedUserAgent {
  const ua = (uaString ?? "").slice(0, 1024)
  if (!ua) {
    return { deviceType: "unknown", os: null, osVersion: null, browser: null, browserVersion: null, deviceModel: null, summary: null }
  }

  const { os, version: osVersion } = detectOS(ua)
  const { browser, version: browserVersion } = detectBrowser(ua)
  let deviceType = detectDeviceType(ua)

  // Prefer client hints when present (more accurate than the frozen UA)
  const chPlatform = unquote(hints?.platform ?? null)
  const chModel = unquote(hints?.model ?? null)
  const chMobile = hints?.mobile

  const finalOs = chPlatform || os
  const deviceModel = chModel || detectModelFromUA(ua)
  if (chMobile === "?1" && deviceType === "desktop") deviceType = "mobile"

  // Build a friendly summary
  const parts: string[] = []
  if (deviceModel) parts.push(deviceModel)
  if (finalOs) parts.push(osVersion ? `${finalOs} ${osVersion}` : finalOs)
  if (browser) parts.push(browser)
  const summary = parts.length > 0 ? parts.join(" · ") : null

  return {
    deviceType,
    os: finalOs,
    osVersion,
    browser,
    browserVersion,
    deviceModel,
    summary,
  }
}
