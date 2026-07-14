import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { hashAdminSessionToken, verifyAdminSession } from "@/lib/admin-auth"
import { logAudit } from "@/lib/audit-log"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role is required for admin logout")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const token = request.cookies.get("admin_session")?.value
  const serviceClient = getServiceRoleClient()

  if (token) {
    await serviceClient
      .from("admin_sessions")
      .delete()
      .eq("session_token_hash", await hashAdminSessionToken(token))
  }

  // Get user id for audit log
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  await logAudit(serviceClient as any, {
    user_id: user?.id || "unknown",
    action: "admin.logout",
    metadata: { email: adminEmail },
  })

  const response = NextResponse.json({ success: true })
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })

  return response
}
