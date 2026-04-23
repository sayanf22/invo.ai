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
  "mailnesia.com", "mailnull.com", "spamfree24.org", "spamfree24.de",
  "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
  "tempinbox.com", "tempinbox.co.uk", "tempr.email", "temp-mail.org",
  "temp-mail.io", "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "20minutemail.com", "20minutemail.it", "mohmal.com", "getairmail.com",
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

    // 1. Basic format check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ valid: false, reason: "Invalid email format" })
    }

    const domain = email.split("@")[1]

    // 2. Disposable domain check
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({ valid: false, reason: "Disposable email addresses are not allowed" })
    }

    // 3. DNS MX record check via Cloudflare DNS-over-HTTPS (works in Cloudflare Workers)
    try {
      const dnsRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
        {
          headers: { "Accept": "application/dns-json" },
          signal: AbortSignal.timeout(3000),
        }
      )

      if (dnsRes.ok) {
        const dnsData = await dnsRes.json()
        // Status 0 = NOERROR, Status 3 = NXDOMAIN (domain doesn't exist)
        if (dnsData.Status === 3) {
          return NextResponse.json({ valid: false, reason: "Email domain does not exist" })
        }
        // Check if MX records exist
        const hasMx = dnsData.Answer?.some((r: any) => r.type === 15) // type 15 = MX
        if (dnsData.Status === 0 && dnsData.Answer && !hasMx) {
          // Domain exists but no MX records — try A record fallback
          const aRes = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
            {
              headers: { "Accept": "application/dns-json" },
              signal: AbortSignal.timeout(2000),
            }
          )
          if (aRes.ok) {
            const aData = await aRes.json()
            const hasA = aData.Answer?.some((r: any) => r.type === 1)
            if (!hasA) {
              return NextResponse.json({ valid: false, reason: "Email domain cannot receive emails" })
            }
          }
        }
      }
    } catch {
      // DNS check failed (timeout, network error) — fail open, don't block the user
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error("Email validation error:", error)
    // Fail open — don't block sending if validation itself errors
    return NextResponse.json({ valid: true })
  }
}
