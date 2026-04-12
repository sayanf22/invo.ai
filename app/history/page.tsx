"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, MessageSquare, FileText, Calendar, Link2, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface Session {
  id: string
  document_type: string
  created_at: string | null
  updated_at: string | null
  chain_id: string | null
  client_name: string | null
  context: any
}

interface SessionGroup {
  chainId: string | null
  clientName: string | null
  sessions: Session[]
  latestDate: string
}

const DOC_TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  contract: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  quotation: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  proposal: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    loadSessions()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    try {
      if (!user?.id) { setLoading(false); return }

      const { data, error } = await supabase
        .from("document_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100)

      if (error) throw error

      const sessions = (data || []) as Session[]

      // Group sessions by chain_id
      const chainMap = new Map<string, Session[]>()
      const standalone: Session[] = []

      for (const s of sessions) {
        if (s.chain_id) {
          const existing = chainMap.get(s.chain_id) || []
          existing.push(s)
          chainMap.set(s.chain_id, existing)
        } else {
          standalone.push(s)
        }
      }

      const grouped: SessionGroup[] = []

      // Add chain groups
      for (const [chainId, chainSessions] of chainMap) {
        // Sort chain sessions by created_at ascending (oldest first = root)
        chainSessions.sort((a, b) =>
          new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
        const clientName = chainSessions.find(s => s.client_name)?.client_name || null
        const latestDate = chainSessions.reduce((latest, s) => {
          const d = s.updated_at || s.created_at || ""
          return d > latest ? d : latest
        }, "")
        grouped.push({ chainId, clientName, sessions: chainSessions, latestDate })
      }

      // Add standalone sessions
      for (const s of standalone) {
        const clientName = s.client_name || s.context?.toName || null
        grouped.push({
          chainId: null,
          clientName,
          sessions: [s],
          latestDate: s.updated_at || s.created_at || "",
        })
      }

      // Sort groups by latest date descending
      grouped.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())

      setGroups(grouped)
    } catch (error: any) {
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load history")
    } finally {
      setLoading(false)
    }
  }

  const openSession = (session: Session) => {
    router.push(`/?sessionId=${session.id}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-24 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document History</h1>
        <p className="text-muted-foreground">
          Your documents, grouped by client and linked chains
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No history yet</h3>
            <p className="text-muted-foreground mb-4">Start a conversation to see it here</p>
            <Button onClick={() => router.push("/")}>Start New Conversation</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group, gi) => (
            <div key={group.chainId || `standalone-${gi}`}>
              {/* Chain group with multiple sessions */}
              {group.sessions.length > 1 ? (
                <Card className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <CardTitle className="text-base">
                        {group.clientName || "Linked Documents"}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {group.sessions.length} documents
                      </span>
                    </div>
                    <CardDescription className="text-xs">
                      {format(new Date(group.latestDate), "MMM dd, yyyy")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-0">
                    {group.sessions.map((session, si) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openSession(session)}
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                      >
                        {/* Chain connector line */}
                        <div className="flex flex-col items-center w-5 shrink-0">
                          {si > 0 && <div className="w-px h-3 bg-border -mt-3" />}
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-background shrink-0" />
                          {si < group.sessions.length - 1 && <div className="w-px flex-1 bg-border" />}
                        </div>

                        <span className={cn(
                          "text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0",
                          DOC_TYPE_COLORS[session.document_type] || "bg-muted text-muted-foreground"
                        )}>
                          {session.document_type}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.context?.toName || session.client_name || "Untitled"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.created_at ? format(new Date(session.created_at), "MMM dd, h:mm a") : ""}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                /* Single standalone session */
                <Card
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => openSession(group.sessions[0])}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize",
                          DOC_TYPE_COLORS[group.sessions[0].document_type] || "bg-muted text-muted-foreground"
                        )}>
                          {group.sessions[0].document_type}
                        </span>
                        <div>
                          <CardTitle className="text-base">
                            {group.clientName || group.sessions[0].context?.toName || "Untitled"}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {group.latestDate ? format(new Date(group.latestDate), "MMM dd, yyyy 'at' h:mm a") : "N/A"}
                          </CardDescription>
                        </div>
                      </div>
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  {group.sessions[0].context?.fromName && (
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">
                        From: {group.sessions[0].context.fromName}
                      </p>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
