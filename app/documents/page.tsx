"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, Calendar, DollarSign, Loader2, ArrowRight, Clock, Filter } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

interface DocSession {
  id: string
  document_type: string
  status: string
  client_name: string | null
  created_at: string
  updated_at: string | null
  context: any
}

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  contract: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  quotation: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  proposal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export default function MyDocumentsPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [sessions, setSessions] = useState<DocSession[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    if (!user) return
    loadSessions()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    if (!user?.id) { setLoading(false); return }
    try {
      // Get document sessions that have actual generated content (context is not empty)
      const { data, error } = await supabase
        .from("document_sessions")
        .select("id, document_type, status, client_name, created_at, updated_at, context")
        .eq("user_id", user.id)
        .not("context", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      // Filter to only sessions that have meaningful document data
      const withContent = (data || []).filter((s: any) => {
        const ctx = s.context
        if (!ctx || typeof ctx !== "object") return false
        // Must have at least a document type or items or a name
        return ctx.documentType || ctx.fromName || ctx.toName || (Array.isArray(ctx.items) && ctx.items.length > 0)
      })

      setSessions(withContent as DocSession[])
    } catch (error: any) {
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = async (session: DocSession) => {
    if (!session.context) {
      toast.error("No document data available")
      return
    }
    setDownloadingId(session.id)
    try {
      const cleanedData = cleanDataForExport(session.context as InvoiceData)
      const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
      const templates = await import("@/lib/pdf-templates")
      const { pdf } = await import("@react-pdf/renderer")

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
      let filePrefix: string
      const docType = (session.document_type || "invoice").toLowerCase()

      switch (docType) {
        case "contract":
          PdfComponent = templates.ContractPDF
          filePrefix = cleanedData.referenceNumber || "contract"
          break
        case "quotation":
          PdfComponent = templates.QuotationPDF
          filePrefix = cleanedData.referenceNumber || "quotation"
          break
        case "proposal":
          PdfComponent = templates.ProposalPDF
          filePrefix = cleanedData.referenceNumber || "proposal"
          break
        default:
          PdfComponent = templates.InvoicePDF
          filePrefix = cleanedData.invoiceNumber || "invoice"
          break
      }

      const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filePrefix}_${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded!")
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setDownloadingId(null)
    }
  }

  const getDocTitle = (s: DocSession): string => {
    const ctx = s.context || {}
    return ctx.invoiceNumber || ctx.referenceNumber || s.client_name || `${(s.document_type || "document").charAt(0).toUpperCase() + (s.document_type || "document").slice(1)}`
  }

  const getDocTotal = (s: DocSession): string | null => {
    const ctx = s.context || {}
    if (!ctx.items || !Array.isArray(ctx.items) || ctx.items.length === 0) return null
    const subtotal = ctx.items.reduce((sum: number, item: any) => {
      const qty = Number(item.quantity) || 1
      const rate = Number(item.rate) || 0
      return sum + qty * rate
    }, 0)
    const currency = ctx.currency || "₹"
    return `${currency}${subtotal.toLocaleString()}`
  }

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.document_type === filter)

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Documents</h1>
          <p className="text-muted-foreground">
            {sessions.length} document{sessions.length !== 1 ? "s" : ""} generated
          </p>
        </div>
        <Button onClick={() => router.push("/")} className="gap-2">
          New Document <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Filter pills */}
      {sessions.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "invoice", "contract", "quotation", "proposal"].map(f => {
            const count = f === "all" ? sessions.length : sessions.filter(s => s.document_type === f).length
            if (f !== "all" && count === 0) return null
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
              </button>
            )
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {sessions.length === 0 ? "No documents yet" : "No matching documents"}
            </h3>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              {sessions.length === 0
                ? "Start a conversation and describe your document. Once the AI generates it, it will appear here."
                : "Try a different filter to see your documents."}
            </p>
            {sessions.length === 0 && (
              <Button onClick={() => router.push("/")} className="gap-2">
                Create Your First Document <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => {
            const total = getDocTotal(s)
            const docType = (s.document_type || "invoice").toLowerCase()
            return (
              <Card key={s.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="flex items-center gap-4 py-4 px-5">
                  {/* Type badge */}
                  <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider shrink-0 ${TYPE_COLORS[docType] || "bg-muted text-muted-foreground"}`}>
                    {docType}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{getDocTitle(s)}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {s.client_name && <span>{s.client_name}</span>}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(s.created_at), "MMM dd, yyyy")}
                      </span>
                      {total && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          {total}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => router.push(`/?sessionId=${s.id}`)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      disabled={downloadingId === s.id}
                      onClick={() => downloadDocument(s)}
                    >
                      {downloadingId === s.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
