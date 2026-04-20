"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { ClientList } from "@/components/clients/client-list"
import { ClientFormModal } from "@/components/clients/client-form-modal"
import { CSVImporter } from "@/components/clients/csv-importer"
import { CSVExporter } from "@/components/clients/csv-exporter"
import { filterClients } from "@/lib/client-utils"
import type { Client } from "@/lib/invoice-types"

import { ClientAIChat } from "@/components/clients/client-ai-chat"

interface ClientsPageClientProps {
  initialClients: Client[]
  userTier: string
}

type ModalState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; client: Client }

export function ClientsPageClient({ initialClients, userTier }: ClientsPageClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState("")
  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" })
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = filterClients(clients, search)

  // Re-fetch clients from the API (used after CSV import)
  async function refetchClients() {
    try {
      const res = await fetch("/api/clients")
      if (!res.ok) throw new Error("Failed to fetch clients")
      const data = await res.json()
      setClients(data.clients ?? [])
    } catch {
      toast.error("Failed to refresh client list")
    }
  }

  function handleAddSuccess(client: Client) {
    setClients((prev) => [...prev, client])
  }

  function handleEditSuccess(updated: Client) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleModalSuccess(client: Client) {
    if (modalState.mode === "add") {
      handleAddSuccess(client)
    } else if (modalState.mode === "edit") {
      handleEditSuccess(client)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    const target = deleteTarget

    // Optimistic removal
    setClients((prev) => prev.filter((c) => c.id !== target.id))
    setDeleteTarget(null)

    try {
      const res = await fetch(`/api/clients/${target.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success(`${target.name} deleted`)
    } catch (err) {
      // Revert optimistic removal
      setClients((prev) => {
        const exists = prev.some((c) => c.id === target.id)
        return exists ? prev : [...prev, target]
      })
      toast.error(err instanceof Error ? err.message : "Failed to delete client")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <Input
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setModalState({ mode: "add" })} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Client
          </Button>
          <CSVImporter onImportComplete={refetchClients} />
          <CSVExporter clients={clients} />
        </div>
      </div>

      {/* Stats bar */}
      <p className="text-sm text-muted-foreground">
        {clients.length} client{clients.length !== 1 ? "s" : ""}
      </p>

      {/* Client list */}
      <ClientList
        clients={filtered}
        onEdit={(client) => setModalState({ mode: "edit", client })}
        onDelete={(client) => setDeleteTarget(client)}
      />

      {/* Add / Edit modal */}
      {modalState.mode !== "closed" && (
        <ClientFormModal
          mode={modalState.mode as "add" | "edit"}
          client={modalState.mode === "edit" ? modalState.client : undefined}
          onSuccess={handleModalSuccess}
          onClose={() => setModalState({ mode: "closed" })}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" will be permanently deleted. This action cannot be undone.`
                : "This client will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI section */}
      {userTier !== "free" ? (
        <ClientAIChat onClientsUpdated={refetchClients} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            AI client management is available on paid plans. Upgrade to add clients via natural language.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
