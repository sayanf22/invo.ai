/**
 * Unit tests for SendEmailDialog and SendEmailButton components
 * Feature: email-sending
 *
 * Tests verify:
 * - Pre-population of email from invoiceData.toEmail (Req 4.2)
 * - Pre-population from defaultEmail prop on resend (Req 4.2)
 * - Send button disabled for invalid email (Req 4.5)
 * - Loading state during send (Req 4.7)
 * - Character counter for personal message (Req 4.7)
 *
 * Validates: Requirements 4.2, 4.5, 4.7, 8.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, cleanup, within } from "@testing-library/react"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { getInitialInvoiceData } from "@/lib/invoice-types"

// Mock authFetch
vi.mock("@/lib/auth-fetch", () => ({
  authFetch: vi.fn(),
}))

// Mock sonner toasts
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// Mock supabase (authFetch internally uses it, but we mock authFetch directly)
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  })),
}))

const mockInvoiceData = { ...getInitialInvoiceData(), toEmail: "client@example.com" }

describe("SendEmailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it("pre-populates toEmail from document data", () => {
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
      />
    )

    const dialog = within(container)
    const emailInput = dialog.getByRole("textbox", { name: /recipient email/i })
    expect((emailInput as HTMLInputElement).value).toBe("client@example.com")
  })

  it("pre-populates email from defaultEmail prop on resend", () => {
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
        defaultEmail="resend@example.com"
      />
    )

    const dialog = within(container)
    const emailInput = dialog.getByRole("textbox", { name: /recipient email/i })
    expect((emailInput as HTMLInputElement).value).toBe("resend@example.com")
  })

  it("disables Send button for invalid email", () => {
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={{ ...getInitialInvoiceData(), toEmail: "" }}
        documentType="invoice"
      />
    )

    const dialog = within(container)
    const emailInput = dialog.getByRole("textbox", { name: /recipient email/i })
    fireEvent.change(emailInput, { target: { value: "" } })

    const sendButton = dialog.getByRole("button", { name: /^send$/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
  })

  it("shows loading state during send", async () => {
    const { authFetch } = await import("@/lib/auth-fetch")
    // Return a promise that never resolves (simulates hanging request)
    vi.mocked(authFetch).mockReturnValue(new Promise(() => {}))

    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
      />
    )

    const dialog = within(container)
    const sendButton = dialog.getByRole("button", { name: /^send$/i })

    await act(async () => {
      fireEvent.click(sendButton)
    })

    // After clicking, button should show "Sending..." and be disabled
    expect(dialog.getByText("Sending...")).toBeTruthy()
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
  })

  it("shows character counter for personal message", () => {
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
      />
    )

    const dialog = within(container)
    const textarea = dialog.getByRole("textbox", { name: /personal message/i })
    fireEvent.change(textarea, { target: { value: "Hello world" } })

    // "Hello world" is 11 characters
    expect(dialog.getByText("11/500")).toBeTruthy()
  })
})
