import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { ClientsPageClient } from "@/components/clients/clients-page-client"
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
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Clients</h1>
      <ClientsPageClient initialClients={initialClients} userTier={userTier} />
    </div>
  )
}
