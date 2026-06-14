import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/geo/country
 *
 * Returns the visitor's 2-letter country code from Cloudflare's cf-ipcountry header.
 * Falls back to "XX" when unknown. This endpoint is public and lightweight.
 *
 * Cloudflare Workers set this header on every request; it's instant and free.
 * In local dev (no Cloudflare) the header is absent and "XX" is returned.
 */
export async function GET(request: NextRequest) {
  const cfCountry = request.headers.get('cf-ipcountry')
  const country = cfCountry && cfCountry !== 'XX' && /^[A-Z]{2}$/.test(cfCountry)
    ? cfCountry
    : null

  return NextResponse.json(
    { country },
    {
      headers: {
        // Cache for 5 minutes — country code is stable per IP during a session.
        // Vary: none — same response regardless of request headers.
        'Cache-Control': 'private, max-age=300',
      },
    }
  )
}
