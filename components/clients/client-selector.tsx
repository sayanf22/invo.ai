"use client"

import { useState, useEffect } from "react"
import { Users } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { filterClients } from "@/lib/client-utils"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Client } from "@/lib/invoice-types"

interface BillToFields {
  toName: string
  toEmail: string
  toAddress: string
  toPhone: string
  toTaxId: string
}

interface ClientSelectorProps {
  onChange: (fields: BillToFields) => void
}

function ClientList({
  clients,
  loading,
  search,
  onSearch,
  onSelect,
  onClose,
}: {
  clients: Client[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  onSelect: (c: Client) => void
  onClose: () => void
}) {
  const filtered = filterClients(clients, search)

  return (
    <>
      <div className="p-3 border-b">
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="overflow-y-auto max-h-[60dvh]">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground text-center">Loading...</p>
        ) : clients.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">
            No clients saved yet.{" "}
            <Link href="/clients" className="underline text-foreground" onClick={onClose}>
              Add clients
            </Link>
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground text-center">No clients match your search.</p>
        ) : (
          filtered.map((client) => (
            <button
              key={client.id}
              type="button"
              className="w-full text-left px-4 py-3.5 hover:bg-accent active:bg-accent transition-colors border-b last:border-b-0"
              onClick={() => onSelect(client)}
            >
              <p className="font-medium text-sm">{client.name}</p>
              {(client.email || client.phone) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[client.email, client.phone].filter(Boolean).join(" · ")}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </>
  )
}

export function ClientSelector({ onChange }: ClientSelectorProps) {
  const [open, setOpen] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false))
  }, [open])

  function handleSelect(client: Client) {
    onChange({
      toName: client.name,
      toEmail: client.email ?? "",
      toAddress: client.address ?? "",
      toPhone: client.phone ?? "",
      toTaxId: client.tax_id ?? "",
    })
    setOpen(false)
    setSearch("")
  }

  // Pill style — matches NextStepsBar pill exactly (h-9, touch-friendly)
  const pillClass = cn(
    "inline-flex items-center gap-1.5",
    "h-9 px-3.5 rounded-xl",
    "text-[13px] font-medium text-foreground",
    "bg-card border border-border",
    "transition-all duration-150",
    "hover:bg-secondary/60 hover:border-border/80",
    "active:scale-[0.96] active:bg-secondary/80",
    "touch-manipulation select-none"
  )

  const pillShadow = "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.10)"

  const trigger = (
    <button
      type="button"
      className={pillClass}
      style={{ boxShadow: pillShadow }}
      aria-label="Select client"
    >
      <Users className="h-3.5 w-3.5 text-foreground/60 shrink-0" />
      <span>Select Client</span>
    </button>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="p-0 rounded-t-2xl max-h-[80dvh]">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="text-base">Select Client</SheetTitle>
          </SheetHeader>
          <ClientList
            clients={clients}
            loading={loading}
            search={search}
            onSearch={setSearch}
            onSelect={handleSelect}
            onClose={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <ClientList
          clients={clients}
          loading={loading}
          search={search}
          onSearch={setSearch}
          onSelect={handleSelect}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}
