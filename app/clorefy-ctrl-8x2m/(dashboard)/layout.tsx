import { requireAdmin } from '@/lib/admin-auth'
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider'
import AdminShell from '@/components/admin/admin-shell'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminEmail = await requireAdmin()
  const sessionExpiresAt = Date.now() + 3600 * 1000

  return (
    <AdminThemeProvider>
      <AdminShell adminEmail={adminEmail} sessionExpiresAt={sessionExpiresAt}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  )
}
