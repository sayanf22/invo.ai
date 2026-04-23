import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

// Common disposable/throwaway email domains to block
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
  "guerrillamail.org", "spam4.me", "trashmail.com", "trashmail.me", "trashmail.net",
  "dispostable.com", "mailnull.com", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "maildrop.cc", "discard.email", "fakeinbox.com",
  "mailnesia.com", "spamfree24.org", "spamfree24.de", "spamfree24.eu",
  "spamfree24.info", "spamfree24.net", "tempinbox.com", "tempinbox.co.uk",
  "tempr.email", "temp-mail.org", "temp-mail.io", "10minutemail.com",
  "10minutemail.net", "10minutemail.org", "20minutemail.com", "20minutemail.it",
  "mohmal.com", "getairmail.com",
])

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: { email: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ valid: false, reason: "Invalid request" }, { status: 400 })
    }

    const email = (body.email || "").trim().toLowerCase()

    // ── 1. Strict format check ──────────────────────────────────────────────
    // Must have: local@domain.tld where TLD is at least 2 chars
    // Rejects: hello@whycreatives (no TLD), hello@domain (no dot after @)
    const strictEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
    if (!strictEmailRegex.test(email)) {
      return NextResponse.json({ valid: false, reason: "Invalid email format" })
    }

    const parts = email.split("@")
    if (parts.length !== 2) {
      return NextResponse.json({ valid: false, reason: "Invalid email format" })
    }
    const domain = parts[1]

    // ── 2. TLD must be at least 2 chars and only letters ───────────────────
    const tld = domain.split(".").pop() || ""
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      return NextResponse.json({ valid: false, reason: "Invalid email domain" })
    }

    // ── 3. Disposable domain check ─────────────────────────────────────────
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({ valid: false, reason: "Disposable email addresses are not allowed" })
    }

    // ── 4. DNS MX record check — STRICT: must have MX records ─────────────
    // We do NOT fall back to A records. A website having an A record does NOT
    // mean it can receive email. Only MX records prove email deliverability.
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)

      const dnsRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
        {
          headers: { "Accept": "application/dns-json" },
          signal: controller.signal,
        }
      )
      clearTimeout(timeout)

      if (dnsRes.ok) {
        const dnsData = await dnsRes.json()

        // NXDOMAIN — domain doesn't exist at all
        if (dnsData.Status === 3) {
          return NextResponse.json({ valid: false, reason: "Email domain does not exist" })
        }

        // NOERROR but check for MX records specifically
        if (dnsData.Status === 0) {
          const mxRecords = (dnsData.Answer || []).filter((r: any) => r.type === 15)

          if (mxRecords.length === 0) {
            // No MX records — domain exists (website) but cannot receive email
            return NextResponse.json({
              valid: false,
              reason: "This domain cannot receive emails (no mail server configured)",
            })
          }

          // Has MX records — valid email domain
          return NextResponse.json({ valid: true })
        }

        // Other DNS error codes — fail open (don't block user)
        return NextResponse.json({ valid: true })
      }

      // DNS API unreachable — fail open
      return NextResponse.json({ valid: true })
    } catch {
      // Timeout or network error — fail open, don't block the user
      return NextResponse.json({ valid: true })
    }
  } catch (error) {
    console.error("Email validation error:", error)
    return NextResponse.json({ valid: true }) // fail open
  }
}
