"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { History, MessageSquare, FileText, Calendar } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Session {
  id: string
  document_type: string
  created_at: string | null
  updated_at: string | null
  context: any
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/auth/login")
      return
    }
    loadSessions()
  }, [user])

  const loadSessions = async () => {
    try {
      if (!user?.id) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("document_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50)

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }
      
      setSessions((data || []) as Session[])
    } catch (error: any) {
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load history")
    } finally {
      setLoading(false)
    }
  }

  const openSession = (session: Session) => {
    // Navigate to home with session ID to load that specific session
    router.push(`/?sessionId=${session.id}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-24 bg-muted rounded"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conversation History</h1>
        <p className="text-muted-foreground">
          View your past conversations and resume where you left off
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No history yet</h3>
            <p className="text-muted-foreground mb-4">
              Start a conversation to see it here
            </p>
            <Button onClick={() => router.push("/")}>
              Start New Conversation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card 
              key={session.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openSession(session)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg capitalize">
                        {session.document_type} Session
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {session.updated_at ? format(new Date(session.updated_at), "MMM dd, yyyy 'at' h:mm a") : 'N/A'}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardHeader>
              {session.context && Object.keys(session.context).length > 0 && (
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {session.context.fromName && (
                      <p>From: {session.context.fromName}</p>
                    )}
                    {session.context.toName && (
                      <p>To: {session.context.toName}</p>
                    )}
                    {session.context.total && (
                      <p>Amount: {session.context.currency || "$"}{session.context.total}</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
