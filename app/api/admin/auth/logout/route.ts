import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSession } from "@/lib/admin-auth"
import { logAudit } from "@/lib/audit-log"
import { createServerSupabaseClient } from "@/lib/supabase-server"

function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const token = request.cookies.get("admin_session")?.value
  const serviceClient = getServiceRoleClient()

  if (token) {
    // Hash the token to find the session record
    const tokenBytes = new TextEncoder().encode(token)
    const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    await serviceClient
      .from("admin_sessions")
      .delete()
      .eq("session_token_hash", tokenHash)
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
