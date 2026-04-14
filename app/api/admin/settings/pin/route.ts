import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'

export async function PATCH(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json()
  const { current_pin, new_pin } = body

  if (!current_pin || !new_pin) {
    return NextResponse.json({ error: 'current_pin and new_pin are required' }, { status: 400 })
  }

  // Verify current PIN against env var hash
  const storedHash = process.env.ADMIN_PIN_HASH
  if (!storedHash) {
    return NextResponse.json({ error: 'PIN not configured' }, { status: 500 })
  }

  const isValid = await bcrypt.compare(String(current_pin), storedHash)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid current PIN' }, { status: 400 })
  }

  // Validate new PIN is exactly 6 digits
  if (!/^\d{6}$/.test(String(new_pin))) {
    return NextResponse.json({ error: 'New PIN must be exactly 6 digits' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(String(new_pin), 10)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Upsert into admin_config table
  const { error: upsertError } = await supabase
    .from('admin_config')
    .upsert({ key: 'pin_hash', value: newHash }, { onConflict: 'key' })
  if (upsertError) return NextResponse.json({ error: 'Failed to update PIN' }, { status: 500 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.pin_change',
    ip_address: ip,
    metadata: { adminEmail },
  })

  return NextResponse.json({ success: true })
}
