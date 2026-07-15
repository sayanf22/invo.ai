import { requireAdmin } from "@/lib/admin-auth"
import EmailCampaignsClient from "./email-campaigns-client"

export default async function EmailCampaignsPage() {
  await requireAdmin()
  return <EmailCampaignsClient />
}
