import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import EmailCampaignsClient from "./email-campaigns-client"

export default async function EmailCampaignsPage() {
  await requireAdmin()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch existing campaign logs
  const { data: campaigns } = await supabase
    .from("admin_email_campaigns")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(50)

  // Fetch segment counts for display
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: dropoffCount },
    { count: inactive7Count },
    { count: inactive14Count },
    { count: allActiveCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", false)
      .lt("last_active_at", twoDaysAgo),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .lt("last_active_at", sevenDaysAgo),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .lt("last_active_at", fourteenDaysAgo),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true),
  ])

  return (
    <EmailCampaignsClient
      campaigns={campaigns ?? []}
      segmentCounts={{
        dropoff: dropoffCount ?? 0,
        inactive7: inactive7Count ?? 0,
        inactive14: inactive14Count ?? 0,
        allActive: allActiveCount ?? 0,
      }}
    />
  )
}
