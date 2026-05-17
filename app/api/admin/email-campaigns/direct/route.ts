/**
 * POST /api/admin/email-campaigns/direct
 * Admin sends a direct 1:1 email to a specific user.
 *
 * This uses the Brevo transactional API correctly:
 * - It's a single admin-to-user message, not bulk marketing
 * - Admin writes the message, it goes out once to one person
 * - Always includes support reply-to
 *
 * Auth: verifyAdminSession() required.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { sendTransactionalEmail, isContactBlocked } from "@/lib/brevo"
import { adminDirectEmailTemplate } from "@/lib/brevo-templates"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

interface DirectEmailBody {
  userId: string
  subject: string
  message: string  // plain text — will be wrapped in HTML template
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: DirectEmailBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { userId, subject, message } = body

  // Validate inputs
  if (!userId || typeof userId !== "string" || userId.length > 64) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
  }
  if (!subject || typeof subject !== "string" || subject.trim().length < 3 || subject.length > 200) {
    return NextResponse.json({ error: "Subject must be 3-200 characters" }, { status: 400 })
  }
  if (!message || typeof message !== "string" || message.trim().length < 10 || message.length > 4000) {
    return NextResponse.json({ error: "Message must be 10-4000 characters" }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Fetch user profile
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .limit(1)

  if (error || !profiles || profiles.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const profile = profiles[0]
  if (!profile.email) {
    return NextResponse.json({ error: "User has no email address" }, { status: 400 })
  }

  // Check if contact is blocked/unsubscribed in Brevo
  const blocked = await isContactBlocked(profile.email)
  if (blocked) {
    return NextResponse.json(
      { error: "This user has unsubscribed or bounced — email cannot be sent" },
      { status: 422 }
    )
  }

  const firstName = profile.full_name?.split(" ")[0] ?? null
  const html = adminDirectEmailTemplate({
    firstName,
    subject: subject.trim(),
    message: message.trim(),
    adminEmail,
  })

  const sent = await sendTransactionalEmail({
    to: profile.email,
    toName: profile.full_name ?? undefined,
    subject: subject.trim(),
    htmlContent: html,
    tags: ["admin-direct", "from-dashboard"],
  })

  if (!sent) {
    return NextResponse.json({ error: "Failed to send email — check Brevo account status" }, { status: 500 })
  }

  // Log in audit trail
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "admin.direct_email",
      resource_type: "email",
      metadata: {
        sent_by: adminEmail,
        subject: subject.trim(),
        to_email: profile.email,
      },
    })
  } catch { /* non-critical */ }

  return NextResponse.json({ success: true, to: profile.email, subject: subject.trim() })
}
