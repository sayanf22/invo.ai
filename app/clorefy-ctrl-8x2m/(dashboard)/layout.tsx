import { requireAdmin } from '@/lib/admin-auth'
import AdminSidebar from '@/components/admin/admin-sidebar'
import AdminHeader from '@/components/admin/admin-header'
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
      <AdminShell>
        <AdminSidebar adminEmail={adminEmail} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader adminEmail={adminEmail} sessionExpiresAt={sessionExpiresAt} />
          <main
            className="flex-1 overflow-auto p-6"
            style={{
              animation: 'adminFadeIn 0.3s ease-out',
            }}
          >
            <style>{`
              @keyframes adminFadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            {children}
          </main>
        </div>
      </AdminShell>
    </AdminThemeProvider>
  )
}
