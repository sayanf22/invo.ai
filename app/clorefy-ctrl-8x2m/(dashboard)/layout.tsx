import { requireAdminSession } from '@/lib/admin-auth'
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider'
import AdminShell from '@/components/admin/admin-shell'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { email: adminEmail, expiresAt: sessionExpiresAt } = await requireAdminSession()

  return (
    <AdminThemeProvider>
      <AdminShell adminEmail={adminEmail} sessionExpiresAt={sessionExpiresAt}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  )
}
