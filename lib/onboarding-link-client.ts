import { authFetch } from "@/lib/auth-fetch"

interface OnboardingLinkResponse {
  onboardUrl?: unknown
  error?: unknown
}

/**
 * Creates or reuses the authenticated owner's active fillable onboarding link.
 * The server generates the capability token; callers never provide one.
 */
export async function ensureOnboardingFillLink(sessionId: string): Promise<string> {
  const response = await authFetch("/api/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, delivery: "link" }),
  })
  const result = await response.json().catch(() => ({})) as OnboardingLinkResponse

  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "Could not create the fillable link.")
  }
  if (typeof result.onboardUrl !== "string" || !result.onboardUrl.includes("/onboard/onb_")) {
    throw new Error("The server returned an invalid fillable link.")
  }
  return result.onboardUrl
}
