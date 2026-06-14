import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'
import { deleteBrevoContact } from '@/lib/brevo'

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

  // Fetch the user's email so we can manage the re-registration blocklist.
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', id)
    .maybeSingle()
  const email = (profile as { email: string | null } | null)?.email ?? null

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ suspended_at: suspended ? new Date().toISOString() : null })
    .eq('id', id)
  if (updateError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Block / unblock the email from registering again. A suspended account's
  // email cannot be used to create a new account; un-suspending restores it.
  if (email) {
    try {
      if (suspended) {
        await supabase.from('blocked_emails').upsert(
          { email: email.toLowerCase(), reason: 'account_suspended', blocked_by: adminEmail },
          { onConflict: 'email' }
        )
        // Stop all re-engagement / automation emails immediately.
        await deleteBrevoContact(email).catch(() => {})
      } else {
        await supabase
          .from('blocked_emails')
          .delete()
          .eq('email', email.toLowerCase())
          .eq('reason', 'account_suspended')
      }
    } catch {
      // Non-fatal — suspension state is already persisted on the profile.
    }
  }

  const ip = getAdminClientIP(request)
  await logAudit(supabase, {
    user_id: 'admin',
    action: suspended ? 'admin.user_suspend' : 'admin.user_unsuspend',
    ip_address: ip,
    metadata: { userId: id, adminEmail, email },
  })

  return NextResponse.json({ success: true })
}
