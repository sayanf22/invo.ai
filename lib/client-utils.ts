import type { Client } from "@/lib/invoice-types"

/**
 * Filters clients by case-insensitive substring match on name, email, or phone.
 * Returns the full list when search is empty.
 * Requirements: 2.4
 */
export function filterClients(clients: Client[], search: string): Client[] {
  if (!search.trim()) return clients
  const lower = search.toLowerCase()
  return clients.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      (c.email?.toLowerCase().includes(lower) ?? false) ||
      (c.phone?.toLowerCase().includes(lower) ?? false)
  )
}
