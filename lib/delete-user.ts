/**
 * Shared account-deletion logic — used by both the admin "delete user" endpoint
 * and the user-facing "delete my account" endpoint.
 *
 * Deletion is irreversible and removes EVERYTHING tied to the user:
 *   1. All Postgres rows (chats, prompts, documents, signatures, payments,
 *      usage, audit logs, …) via the SECURITY DEFINER RPC `delete_user_account`.
 *   2. All stored files in R2 (logos / documents / signatures / uploads) and
 *      the Supabase `signatures` bucket.
 *   3. The auth.users record itself (via the Auth Admin API).
 *   4. Optionally adds the email to `blocked_emails` so it can never be used to
 *      register again (used for admin-initiated suspend/delete).
 *
 * Every step is best-effort except the RPC + auth delete, which are the ones
 * that actually remove the account. Storage failures never block the wipe.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { deleteByPrefix } from "@/lib/r2"
import { deleteBrevoContact } from "@/lib/brevo"

function getServiceRoleClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface DeleteAccountResult {
  success: boolean
  email: string | null
  storageObjectsDeleted: number
  error?: string
}

/**
 * Fully delete a user account and all associated data.
 *
 * @param userId    The auth.users id to delete.
 * @param options.blockEmail  When true, the email is added to `blocked_emails`
 *                            so it can never register again (admin delete/suspend).
 */
export async function deleteUserAccount(
  userId: string,
  options: { blockEmail?: boolean; blockReason?: string; blockedBy?: string } = {}
): Promise<DeleteAccountResult> {
  const svc = getServiceRoleClient()

  // 1. Capture the email up-front (needed for the blocklist + return value)
  let email: string | null = null
  try {
    const { data } = await svc.from("profiles").select("email").eq("id", userId).maybeSingle()
    email = (data as { email: string | null } | null)?.email ?? null
  } catch {
    /* non-fatal */
  }

  // 2. Block the email BEFORE deleting (so a race can't re-register mid-delete)
  if (options.blockEmail && email) {
    try {
      await svc.from("blocked_emails").upsert(
        {
          email: email.toLowerCase(),
          reason: options.blockReason ?? "account_deleted",
          blocked_by: options.blockedBy ?? "system",
        },
        { onConflict: "email" }
      )
    } catch {
      /* non-fatal — proceed with deletion */
    }
  }

  // 3. Atomic Postgres wipe of all user-owned rows
  const { error: rpcError } = await svc.rpc("delete_user_account", {
    target_user_id: userId,
  } as never)
  if (rpcError) {
    return {
      success: false,
      email,
      storageObjectsDeleted: 0,
      error: rpcError.message,
    }
  }

  // 4. Storage cleanup (best-effort, never blocks)
  let storageObjectsDeleted = 0
  try {
    for (const prefix of [
      `logos/${userId}/`,
      `documents/${userId}/`,
      `signatures/${userId}/`,
      `uploads/${userId}/`,
    ]) {
      storageObjectsDeleted += await deleteByPrefix(prefix)
    }
  } catch {
    /* best-effort */
  }

  // Supabase storage `signatures` bucket — saved-signature variants
  try {
    await svc.storage
      .from("signatures")
      .remove([`signatures/saved_${userId}.jpg`, `signatures/saved_${userId}.png`])
  } catch {
    /* best-effort */
  }

  // Remove the Brevo contact so no re-engagement automation can email them again.
  if (email) {
    try {
      await deleteBrevoContact(email)
    } catch {
      /* best-effort */
    }
  }

  // 5. Finally remove the auth.users record
  const { error: authError } = await svc.auth.admin.deleteUser(userId)
  if (authError) {
    return {
      success: false,
      email,
      storageObjectsDeleted,
      error: authError.message,
    }
  }

  return { success: true, email, storageObjectsDeleted }
}
