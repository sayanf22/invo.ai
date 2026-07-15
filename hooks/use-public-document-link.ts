"use client"

import { useEffect, useState } from "react"
import { fetchPublicDocumentLink } from "@/lib/public-document-link-client"

export function usePublicDocumentLink(sessionId?: string | null) {
  const requestedSessionId = sessionId ?? null
  const [result, setResult] = useState<{
    sessionId: string | null
    publicUrl: string | null
  }>({ sessionId: null, publicUrl: null })

  useEffect(() => {
    let active = true
    if (!requestedSessionId) return () => { active = false }

    fetchPublicDocumentLink(requestedSessionId)
      .then(publicUrl => {
        if (active) setResult({ sessionId: requestedSessionId, publicUrl })
      })
      .catch(() => {
        if (active) setResult({ sessionId: requestedSessionId, publicUrl: null })
      })

    return () => { active = false }
  }, [requestedSessionId])

  const hasCurrentResult = result.sessionId === requestedSessionId
  return {
    publicUrl: hasCurrentResult ? result.publicUrl : null,
    loading: Boolean(requestedSessionId) && !hasCurrentResult,
  }
}
