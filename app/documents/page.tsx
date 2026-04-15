"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download, Eye, Trash2, Calendar, DollarSign, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

interface Document {
  id: string
  type: string | null
  document_number: string | null
  status: string | null
  created_at: string | null
  data: any
  business_id: string | null
}

export default function MyDocumentsPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    loadDocuments()
  }, [user])

  const loadDocuments = async () => {
    try {
      if (!user?.id) {
        setLoading(false)
        return
      }

      // First get the user's business
      const { data: businesses, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)

      if (businessError) {
        console.error("Business query error:", businessError)
        throw businessError
      }

      if (!businesses || businesses.length === 0) {
        // User hasn't completed onboarding yet
        setDocuments([])
        setLoading(false)
        return
      }

      const businessId = businesses[0].id

      // Now get documents for this business
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Documents query error:", error)
        throw error
      }
      
      setDocuments((data || []) as Document[])
    } catch (error: any) {
      console.error("Error loading documents:", error?.message || error)
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
    }
  }

  const downloadDocument = async (doc: Document) => {
    if (!doc.data) {
      toast.error("No document data available")
      return
    }
    setDownloadingId(doc.id)
    try {
      const cleanedData = cleanDataForExport(doc.data as InvoiceData)
      const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
      const templates = await import("@/lib/pdf-templates")
      const { pdf } = await import("@react-pdf/renderer")

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
      let filePrefix: string

      switch ((cleanedData.documentType || "").toLowerCase()) {
        case "contract":
          PdfComponent = templates.ContractPDF
          filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "contract"
          break
        case "quotation":
          PdfComponent = templates.QuotationPDF
          filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "quotation"
          break
        case "proposal":
          PdfComponent = templates.ProposalPDF
          filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "proposal"
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

  const deleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return

    try {
      if (!user?.id) {
        toast.error("User not authenticated")
        return
      }

      // Get user's business first
      const { data: businesses } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)

      if (!businesses || businesses.length === 0) {
        toast.error("Business not found")
        return
      }

      const businessId = businesses[0]?.id
      if (!businessId) {
        toast.error("Invalid business ID")
        return
      }

      // Delete document only if it belongs to user's business
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId)

      if (error) throw error
      toast.success("Document deleted")
      loadDocuments()
    } catch (error: any) {
      console.error("Error deleting document:", error?.message || error)
      toast.error("Failed to delete document")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Documents</h1>
        <p className="text-muted-foreground">
          View and manage all your generated documents
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first invoice, contract, or proposal
            </p>
            <Button onClick={() => router.push("/")}>
              Create Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {doc.document_number || `${doc.type || 'Document'}`}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {doc.created_at ? format(new Date(doc.created_at), "MMM dd, yyyy") : 'N/A'}
                        </span>
                        {doc.data?.total && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {doc.data.currency || "$"} {doc.data.total}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    doc.status === "completed" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {doc.status || 'draft'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/?doc=${doc.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === doc.id}
                    onClick={() => downloadDocument(doc)}
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Download PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
