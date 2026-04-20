import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { getAdminClientIP } from '@/lib/admin-utils'

export async function PATCH(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { current_pin, new_pin } = body

  if (!current_pin || !new_pin) {
    return NextResponse.json({ error: 'current_pin and new_pin are required' }, { status: 400 })
  }

  // Validate new PIN is exactly 6 digits
  if (!/^\d{6}$/.test(String(new_pin))) {
    return NextResponse.json({ error: 'New PIN must be exactly 6 digits' }, { status: 400 })
  }

  // Verify current PIN against ADMIN_PIN env var using timing-safe comparison
  const storedPin = process.env.ADMIN_PIN
  if (!storedPin) {
    return NextResponse.json({ error: 'PIN not configured' }, { status: 500 })
  }

  const pinMatch = (() => {
    try {
      const a = Buffer.from(String(current_pin), "utf8")
      const b = Buffer.from(storedPin, "utf8")
      if (a.length !== b.length) return false
      return require("crypto").timingSafeEqual(a, b)
    } catch { return false }
  })()

  if (!pinMatch) {
    return NextResponse.json({ error: 'Invalid current PIN' }, { status: 400 })
  }

  // Note: Changing the PIN requires updating the ADMIN_PIN environment variable
  // in Cloudflare Workers secrets. This endpoint logs the intent but the actual
  // change must be done via: npx wrangler secret put ADMIN_PIN
  const ip = getAdminClientIP(request)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.pin_change',
    ip_address: ip,
    metadata: { adminEmail, note: 'PIN change requested — update ADMIN_PIN secret in Cloudflare' },
  })

  return NextResponse.json({ 
    success: true,
    message: 'PIN change logged. Update ADMIN_PIN in Cloudflare Workers secrets to complete the change.'
  })
}
