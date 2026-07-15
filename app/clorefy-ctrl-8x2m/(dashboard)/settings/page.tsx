import { requireAdmin } from '@/lib/admin-auth'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const adminEmail = await requireAdmin()
  return <SettingsClient adminEmail={adminEmail} />
}
