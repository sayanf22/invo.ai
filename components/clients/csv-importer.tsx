"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClientInput } from "@/lib/invoice-types"

interface CSVImporterProps {
  onImportComplete: () => void
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        fields.push(current)
        current = ""
      } else {
        current += ch
      }
    }
  }

  fields.push(current)
  return fields
}

function parseCSV(text: string): string[][] {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  const result: string[][] = []

  for (const line of lines) {
    if (line.trim() === "") continue
    result.push(parseCSVLine(line))
  }

  return result
}

// ─── Header mapping ───────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof ClientInput> = {
  name: "name",
  email: "email",
  phone: "phone",
  address: "address",
  tax_id: "tax_id",
  notes: "notes",
}

function mapHeaders(headers: string[]): (keyof ClientInput | null)[] {
  return headers.map((h) => HEADER_MAP[h.trim().toLowerCase()] ?? null)
}

function rowsToClients(rows: string[][]): { valid: ClientInput[]; skipped: number } {
  if (rows.length < 2) return { valid: [], skipped: 0 }

  const [headerRow, ...dataRows] = rows
  const columnMap = mapHeaders(headerRow)

  let skipped = 0
  const valid: ClientInput[] = []

  for (const row of dataRows) {
    const client: Partial<ClientInput> = {}

    columnMap.forEach((key, idx) => {
      if (key !== null) {
        const val = (row[idx] ?? "").trim()
        if (val) (client as Record<string, string>)[key] = val
      }
    })

    if (!client.name) {
      skipped++
    } else {
      valid.push(client as ClientInput)
    }
  }

  return { valid, skipped }
}

// ─── Template ─────────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = "name,email,phone,address,tax_id,notes"

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_HEADERS + "\n"], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "clients_template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CSVImporter({ onImportComplete }: CSVImporterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [parsedClients, setParsedClients] = useState<ClientInput[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [isImporting, setIsImporting] = useState(false)

  function handleButtonClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be re-selected
    e.target.value = ""

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const rows = parseCSV(text)

        if (rows.length < 2) {
          toast.error("CSV file appears to be empty or has no data rows.")
          return
        }

        const { valid, skipped } = rowsToClients(rows)

        if (valid.length === 0 && skipped === 0) {
          toast.error("Could not parse any rows from the CSV file.")
          return
        }

        setParsedClients(valid)
        setSkippedCount(skipped)
        setPreviewOpen(true)
      } catch {
        toast.error("Failed to parse the CSV file. Please check the format and try again.")
      }
    }

    reader.onerror = () => {
      toast.error("Failed to read the file. Please try again.")
    }

    reader.readAsText(file)
  }

  async function handleConfirmImport() {
    if (parsedClients.length === 0) {
      setPreviewOpen(false)
      return
    }

    setIsImporting(true)
    try {
      const res = await fetch("/api/clients/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: parsedClients }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Import failed")
      }

      const { inserted, skipped: serverSkipped } = await res.json()
      const totalSkipped = skippedCount + (serverSkipped ?? 0)

      toast.success(
        `Imported ${inserted} client${inserted !== 1 ? "s" : ""}` +
          (totalSkipped > 0 ? `, ${totalSkipped} row${totalSkipped !== 1 ? "s" : ""} skipped` : "")
      )

      setPreviewOpen(false)
      onImportComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed. Please try again.")
    } finally {
      setIsImporting(false)
    }
  }

  function handleCancel() {
    setPreviewOpen(false)
    setParsedClients([])
    setSkippedCount(0)
  }

  const previewRows = parsedClients.slice(0, 10)

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Trigger buttons */}
      <Button variant="outline" size="sm" onClick={handleButtonClick}>
        Import CSV
      </Button>
      <Button variant="ghost" size="sm" onClick={downloadTemplate}>
        Download Template
      </Button>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={(open) => { if (!open) handleCancel() }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Import</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            {parsedClients.length} row{parsedClients.length !== 1 ? "s" : ""} will be imported
            {skippedCount > 0 && (
              <>, {skippedCount} row{skippedCount !== 1 ? "s" : ""} skipped (missing name)</>
            )}
            {parsedClients.length > 10 && " — showing first 10 rows below"}
          </p>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((client, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{client.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{client.email ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{client.phone ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport} disabled={isImporting || parsedClients.length === 0}>
              {isImporting ? "Importing…" : `Import ${parsedClients.length} client${parsedClients.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
