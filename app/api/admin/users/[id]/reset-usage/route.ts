import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error: deleteError } = await supabase
    .from('user_usage')
    .delete()
    .eq('user_id', id)
    .eq('month', currentMonth)
  if (deleteError) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.usage_reset',
    ip_address: ip,
    metadata: { userId: id, month: currentMonth, adminEmail },
  })

  return NextResponse.json({ success: true })
}
