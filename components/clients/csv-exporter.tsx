"use client"

import { Client } from "@/lib/invoice-types"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface CSVExporterProps {
  clients: Client[]
}

const CSV_HEADERS = ["name", "email", "phone", "address", "tax_id", "notes", "created_at"] as const

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function clientToCSVRow(client: Client): string {
  const fields: string[] = [
    client.name ?? "",
    client.email ?? "",
    client.phone ?? "",
    client.address ?? "",
    client.tax_id ?? "",
    client.notes ?? "",
    client.created_at ?? "",
  ]
  return fields.map(escapeCSVField).join(",")
}

export function CSVExporter({ clients }: CSVExporterProps) {
  function handleExport() {
    if (clients.length === 0) {
      toast("No clients to export")
      return
    }

    const rows = [CSV_HEADERS.join(","), ...clients.map(clientToCSVRow)]
    const csv = rows.join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().slice(0, 10)

    const a = document.createElement("a")
    a.href = url
    a.download = `clients_export_${date}.csv`
    a.click()

    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" onClick={handleExport}>
      Export CSV
    </Button>
  )
}
