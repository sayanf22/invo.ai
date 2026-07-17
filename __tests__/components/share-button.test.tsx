/**
 * Unit tests for ShareButton component - Share button integration
 * Feature: email-sending
 *
 * Tests verify:
 * - ShareButton shows "Send via Clorefy Email" when sessionId present (Req 9.1)
 * - ShareButton hides "Send via Clorefy Email" when sessionId absent (Req 9.3)
 * - Existing "Send via Email" is renamed to "Open in Email App" (Req 9.4)
 *
 * Validates: Requirements 9.1, 9.3, 9.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { ShareButton } from "@/components/share-button"
import { getInitialInvoiceData } from "@/lib/invoice-types"

/** Open the Share dropdown by firing the full pointer event sequence Radix expects */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" })
  fireEvent.mouseDown(trigger)
  fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" })
  fireEvent.mouseUp(trigger)
  fireEvent.click(trigger)
}

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@react-pdf/renderer", () => ({ pdf: vi.fn() }))
vi.mock("@/lib/resolve-logo-url", () => ({ resolveLogoUrl: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/auth-fetch", () => ({ authFetch: vi.fn() }))
vi.mock("@/lib/public-document-link-client", () => ({
  fetchPublicDocumentLink: vi.fn().mockResolvedValue("https://clorefy.com/d/PUBLICID"),
}))

const mockData = {
  ...getInitialInvoiceData(),
  documentType: "invoice",
  fromName: "Test Business",
  toName: "Test Client",
}

describe("ShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows "Send via Clorefy Email" when sessionId present', () => {
    render(
      <ShareButton
        data={mockData}
        sessionId="session-123"
        onOpenSendDialog={vi.fn()}
      />
    )

    const trigger = screen.getByRole("button", { name: /share/i })
    openDropdown(trigger)

    expect(screen.getByText("Send via Clorefy Email")).toBeTruthy()
  })

  it('hides "Send via Clorefy Email" when sessionId absent', () => {
    render(<ShareButton data={mockData} />)

    const trigger = screen.getByRole("button", { name: /share/i })
    openDropdown(trigger)

    expect(screen.queryByText("Send via Clorefy Email")).toBeNull()
  })

  it('existing "Send via Email" is renamed to "Open in Email App"', () => {
    render(<ShareButton data={mockData} />)

    const trigger = screen.getByRole("button", { name: /share/i })
    openDropdown(trigger)

    expect(screen.getByText("Open in Email App")).toBeTruthy()
    expect(screen.queryByText("Send via Email")).toBeNull()
  })

  it("copies the fillable /onboard link for a sent onboarding form, never the /d/ preview", async () => {
    const { authFetch } = await import("@/lib/auth-fetch")
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ onboardUrl: "https://clorefy.com/onboard/onb_abc123", status: "in_progress" }),
    } as Response)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const onboardingData = { ...mockData, documentType: "Client_onboarding_form" }
    render(
      <ShareButton
        data={onboardingData}
        sessionId="session-123"
        documentStatus="finalized"
        onOpenSendDialog={vi.fn()}
      />
    )

    const trigger = screen.getByRole("button", { name: /share/i })
    await act(async () => { openDropdown(trigger) })

    const copyBtn = await screen.findByText("Copy form link")
    await act(async () => { fireEvent.click(copyBtn) })

    expect(writeText).toHaveBeenCalledWith("https://clorefy.com/onboard/onb_abc123")
    const copiedValues = writeText.mock.calls.map(c => String(c[0]))
    expect(copiedValues.some(v => v.includes("/d/"))).toBe(false)
  })
})
