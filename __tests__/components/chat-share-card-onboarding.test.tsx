import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { ChatShareCard } from "@/components/chat-share-card"
import { authFetch } from "@/lib/auth-fetch"

vi.mock("@/lib/auth-fetch", () => ({ authFetch: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/hooks/use-payment-methods", () => ({ usePaymentMethods: () => ({ hasAnyGateway: false }) }))
vi.mock("@/hooks/use-public-document-link", () => ({
  // The generic preview link that must NEVER be used for onboarding.
  usePublicDocumentLink: () => ({ publicUrl: "https://clorefy.com/d/PREVIEWID", loading: false }),
}))

const FILL_URL = "https://clorefy.com/onboard/onb_abc123"

describe("ChatShareCard — onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ onboardUrl: FILL_URL, status: "in_progress" }),
    } as Response)
  })
  afterEach(cleanup)

  it("copies the fillable /onboard link and never the /d/ preview", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <ChatShareCard
        sessionId="11111111-1111-4111-8111-111111111111"
        documentType="client_onboarding_form"
        onSelectEmail={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    // The fill link is fetched on mount.
    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(expect.stringContaining("/api/onboarding?sessionId=")))

    // Copy Link → confirm.
    fireEvent.click(screen.getByText("Copy Link"))
    const confirmBtn = await screen.findByText("Copy & Share Link")
    await act(async () => { fireEvent.click(confirmBtn) })

    expect(writeText).toHaveBeenCalledWith(FILL_URL)
    const copied = writeText.mock.calls.map(c => String(c[0]))
    expect(copied.some(v => v.includes("/d/"))).toBe(false)
  })

  it("never calls the generic finalize endpoint for onboarding", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(
      <ChatShareCard
        sessionId="11111111-1111-4111-8111-111111111111"
        documentType="client_onboarding_form"
        onSelectEmail={vi.fn()}
        onDismiss={vi.fn()}
      />
    )
    await waitFor(() => expect(authFetch).toHaveBeenCalled())

    fireEvent.click(screen.getByText("Copy Link"))
    const confirmBtn = await screen.findByText("Copy & Share Link")
    await act(async () => { fireEvent.click(confirmBtn) })

    const finalizeCalls = vi.mocked(authFetch).mock.calls.filter(([url]) => String(url).includes("/api/sessions/finalize"))
    expect(finalizeCalls).toHaveLength(0)
  })
})
