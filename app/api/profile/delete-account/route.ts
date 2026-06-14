import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, validateOrigin, getClientIP } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit-log'
import { deleteUserAccount } from '@/lib/delete-user'

/**
 * POST /api/profile/delete-account
 *
 * Lets an authenticated user permanently delete their OWN account and all
 * associated data. This is irreversible.
 *
 * Safety:
 *  - Requires a valid session (authenticateRequest).
 *  - Validates request origin (CSRF defense).
 *  - Requires the body to contain `confirmText: "DELETE"` — the UI collects
 *    this via a type-to-confirm danger-zone flow with double confirmation.
 *
 * Unlike admin deletion, a self-deleted email is NOT added to the blocklist —
 * the person is free to sign up again later.
 */
export async function POST(request: NextRequest) {
  const originError = validateOrigin(request)
  if (originError) return originError

  const auth = await authenticateRequest(request)
  if (auth.error) return auth.error

  let body: { confirmText?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if ((body.confirmText || '').trim() !== 'DELETE') {
    return NextResponse.json(
      { error: 'Please type DELETE to confirm account deletion.' },
      { status: 400 }
    )
  }

  const userId = auth.user.id

  // Audit BEFORE deletion (the audit row for this user is wiped by the cascade,
  // so log with a service client and a generic actor to keep a permanent trail).
  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await logAudit(svc, {
    user_id: 'system',
    action: 'account.self_delete',
    resource_type: 'user',
    ip_address: getClientIP(request),
    metadata: { userId, email: auth.user.email },
  })

  const result = await deleteUserAccount(userId, { blockEmail: false })

  if (!result.success) {
    return NextResponse.json(
      { error: 'Failed to delete your account. Please try again or contact support@clorefy.com.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
