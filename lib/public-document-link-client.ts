import { authFetch } from "@/lib/auth-fetch"

export async function fetchPublicDocumentLink(sessionId: string): Promise<string | null> {
  if (!sessionId) return null
  const response = await authFetch(`/api/sessions/public-link?sessionId=${encodeURIComponent(sessionId)}`)
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  return typeof data?.publicUrl === "string" ? data.publicUrl : null
}
