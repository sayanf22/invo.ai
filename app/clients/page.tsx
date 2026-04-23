import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ClientsPageClient } from "@/components/clients/clients-page-client"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { Client } from "@/lib/invoice-types"

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Fetch initial clients ordered by name
  const { data: clientsData } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  const initialClients: Client[] = (clientsData ?? []) as Client[]

  // Read user tier from subscriptions table, default to "free"
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user.id)
    .single()

  const userTier: string = subscription?.plan ?? "free"

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <ClorefyLogo size={24} />
              <span className="font-semibold text-sm">Clients</span>
            </div>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8 pt-6 sm:pt-10">
        <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Clients</h1>
        <ClientsPageClient initialClients={initialClients} userTier={userTier} />
      </div>
    </div>
  )
}
