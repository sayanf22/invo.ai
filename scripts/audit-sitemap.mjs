/**
 * Sitemap hygiene audit.
 *
 * Fetches the deployed sitemap.xml, requests every URL it lists, and flags any
 * that are:
 *   - non-200 (404s, 5xx, soft-404s that return non-200)
 *   - 3xx-redirected (final URL differs from the listed URL)
 *   - carry a `noindex` directive (meta robots or X-Robots-Tag header)
 *
 * This is the regression guard for Property 1 (Sitemap Hygiene) in the
 * seo-search-visibility-fix spec. On the CURRENT (unfixed) deployment it is
 * expected to surface the ~9x404 / ~9xredirect / 1xsoft-404 / 1xnoindex URLs
 * plus the thin /auth/login + /auth/signup entries.
 *
 * Usage:
 *   node scripts/audit-sitemap.mjs [sitemapUrl]
 *   SITEMAP_URL=https://clorefy.com/sitemap.xml node scripts/audit-sitemap.mjs
 *
 * Exit code:
 *   0  every listed URL is a clean, non-redirecting 200 with no noindex
 *   1  at least one URL failed hygiene (details printed)
 */

const DEFAULT_SITEMAP =
  process.env.SITEMAP_URL ||
  process.argv[2] ||
  "https://clorefy.com/sitemap.xml"

const NOINDEX_RE = /noindex/i

/** Extract <loc> URLs from a sitemap.xml body. */
export function parseSitemapUrls(xml) {
  const urls = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    urls.push(m[1].trim())
  }
  return urls
}

/** Detect a noindex directive in the response headers or HTML body. */
export function hasNoindex(headers, body) {
  const xRobots = headers.get("x-robots-tag") || ""
  if (NOINDEX_RE.test(xRobots)) return true
  // <meta name="robots" content="...noindex...">
  const metaRe =
    /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/gi
  let m
  while ((m = metaRe.exec(body)) !== null) {
    if (NOINDEX_RE.test(m[1])) return true
  }
  return false
}

/**
 * Audit a single URL. Returns a report object describing any hygiene failure.
 */
export async function auditUrl(url, fetchImpl = fetch) {
  const report = {
    url,
    finalUrl: url,
    finalStatus: 0,
    wasRedirected: false,
    hasNoindex: false,
    ok: false,
    error: null,
  }
  try {
    const res = await fetchImpl(url, { redirect: "follow" })
    report.finalStatus = res.status
    report.finalUrl = res.url || url
    report.wasRedirected = res.redirected === true || report.finalUrl !== url
    const body = await res.text()
    report.hasNoindex = hasNoindex(res.headers, body)
    report.ok =
      report.finalStatus === 200 &&
      !report.wasRedirected &&
      !report.hasNoindex
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err)
    report.ok = false
  }
  return report
}

/**
 * Audit an entire sitemap. Returns { total, failures } where each failure is
 * an auditUrl report that did not resolve to a clean 200.
 */
export async function auditSitemap(sitemapUrl, fetchImpl = fetch) {
  const res = await fetchImpl(sitemapUrl, { redirect: "follow" })
  if (res.status !== 200) {
    throw new Error(
      `sitemap fetch failed: ${sitemapUrl} returned ${res.status}`
    )
  }
  const xml = await res.text()
  const urls = parseSitemapUrls(xml)

  const failures = []
  // Sequential to stay gentle on the origin; sitemaps are small (~250 URLs).
  for (const url of urls) {
    const report = await auditUrl(url, fetchImpl)
    if (!report.ok) failures.push(report)
  }
  return { total: urls.length, failures }
}

// ── CLI entry point ────────────────────────────────────────────────────
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("audit-sitemap.mjs")

if (isMain) {
  auditSitemap(DEFAULT_SITEMAP)
    .then(({ total, failures }) => {
      console.log(`Audited ${total} sitemap URLs from ${DEFAULT_SITEMAP}`)
      if (failures.length === 0) {
        console.log("✅ All sitemap URLs are clean, non-redirecting 200s with no noindex.")
        process.exit(0)
      }
      console.error(`❌ ${failures.length} URL(s) failed sitemap hygiene:\n`)
      for (const f of failures) {
        const reasons = []
        if (f.error) reasons.push(`error: ${f.error}`)
        if (f.finalStatus !== 200) reasons.push(`status ${f.finalStatus}`)
        if (f.wasRedirected) reasons.push(`redirected → ${f.finalUrl}`)
        if (f.hasNoindex) reasons.push("noindex")
        console.error(`  - ${f.url}  [${reasons.join(", ")}]`)
      }
      process.exit(1)
    })
    .catch((err) => {
      console.error("Sitemap audit crashed:", err)
      process.exit(1)
    })
}
