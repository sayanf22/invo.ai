import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  // Validate UUID format to prevent injection
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { suspended } = body

  if (typeof suspended !== 'boolean') {
    return NextResponse.json({ error: 'suspended must be a boolean' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ suspended_at: suspended ? new Date().toISOString() : null })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  const ip = getAdminClientIP(request)
  await logAudit(supabase, {
    user_id: 'admin',
    action: suspended ? 'admin.user_suspend' : 'admin.user_unsuspend',
    ip_address: ip,
    metadata: { userId: id, adminEmail },
  })

  return NextResponse.json({ success: true })
}
