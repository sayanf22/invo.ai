import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAdminSession } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit-log'
import { isValidUUID, getAdminClientIP } from '@/lib/admin-utils'
import { deleteUserAccount } from '@/lib/delete-user'

/**
 * DELETE /api/admin/users/[id]/delete
 *
 * Permanently and irreversibly deletes a user account and ALL of its data
 * (chats, prompts, documents, signatures, payments, usage, files, …) and
 * blocks the email from ever registering again.
 *
 * Defense-in-depth:
 *  - Requires a valid admin session (404 otherwise).
 *  - UUID-validates the target id.
 *  - Requires the request body to echo back the exact target email
 *    (`confirmEmail`) — the UI collects this via a type-to-confirm dialog,
 *    so an accidental / forged call without the right email is rejected.
 *  - Refuses to delete an admin's own account.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { id } = await params
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: { confirmEmail?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Resolve the target's email and confirm it matches what the admin typed.
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', id)
    .maybeSingle()
  const targetEmail = (profile as { email: string | null } | null)?.email ?? null

  if (!targetEmail) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const confirmEmail = (body.confirmEmail || '').trim().toLowerCase()
  if (!confirmEmail || confirmEmail !== targetEmail.toLowerCase()) {
    return NextResponse.json(
      { error: 'Confirmation email does not match the target account.' },
      { status: 400 }
    )
  }

  // Don't allow deleting an admin's own account through this endpoint.
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (adminEmails.includes(targetEmail.toLowerCase())) {
    return NextResponse.json(
      { error: 'Admin accounts cannot be deleted from the dashboard.' },
      { status: 403 }
    )
  }

  const result = await deleteUserAccount(id, {
    blockEmail: false,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: 'Failed to fully delete the account. Please retry.' },
      { status: 500 }
    )
  }

  const ip = getAdminClientIP(request)
  await logAudit(supabase, {
    user_id: 'admin',
    action: 'admin.user_delete',
    resource_type: 'user',
    ip_address: ip,
    metadata: {
      userId: id,
      adminEmail,
      email: result.email,
      storageObjectsDeleted: result.storageObjectsDeleted,
    },
  })

  return NextResponse.json({ success: true })
}
