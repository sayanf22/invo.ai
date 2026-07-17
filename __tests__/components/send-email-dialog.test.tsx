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
import { render, fireEvent, act, cleanup, within, waitFor } from "@testing-library/react"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { authFetch } from "@/lib/auth-fetch"
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
    vi.mocked(authFetch).mockImplementation(async (url) => {
      if (String(url) === "/api/emails/generate-message") {
        return {
          ok: true,
          json: async () => ({ message: "Hi Client,\n\nPlease review the invoice.\n\nBest,\nAcme" }),
        } as Response
      }
      if (String(url) === "/api/payments/settings") {
        return { ok: true, json: async () => ({ settings: {} }) } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })
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
    await waitFor(() => expect(dialog.queryByText("Writing...")).toBeNull())

    // The automatic first-open draft has completed. Keep only the send request
    // pending so the send button's loading state can be asserted independently.
    vi.mocked(authFetch).mockReturnValue(new Promise(() => {}))
    const sendButton = dialog.getByRole("button", { name: /^send$/i })

    await act(async () => {
      fireEvent.click(sendButton)
    })

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

  it("generates the AI message on the first open", async () => {
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
      />
    )

    const textarea = within(container).getByRole("textbox", { name: /personal message/i }) as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain("Please review the invoice"))
    expect(vi.mocked(authFetch).mock.calls.filter(([url]) => String(url) === "/api/emails/generate-message")).toHaveLength(1)
  })

  it("starts one fresh draft when the dialog is closed and reopened", async () => {
    let draftNumber = 0
    vi.mocked(authFetch).mockImplementation(async (url) => {
      if (String(url) === "/api/emails/generate-message") {
        draftNumber += 1
        return { ok: true, json: async () => ({ message: `Draft ${draftNumber}` }) } as Response
      }
      return { ok: true, json: async () => ({ settings: {} }) } as Response
    })

    const props = {
      onClose: vi.fn(),
      sessionId: "session-1",
      invoiceData: mockInvoiceData,
      documentType: "invoice",
    }
    const { container, rerender } = render(<SendEmailDialog {...props} open={true} />)
    const dialog = within(container)
    await waitFor(() => expect((dialog.getByRole("textbox", { name: /personal message/i }) as HTMLTextAreaElement).value).toBe("Draft 1"))

    rerender(<SendEmailDialog {...props} open={false} />)
    rerender(<SendEmailDialog {...props} open={true} />)

    await waitFor(() => expect((dialog.getByRole("textbox", { name: /personal message/i }) as HTMLTextAreaElement).value).toBe("Draft 2"))
    expect(draftNumber).toBe(2)
  })

  it("does not let a stale AI response overwrite manual edits", async () => {
    let resolveDraft!: (value: Response) => void
    const pendingDraft = new Promise<Response>((resolve) => { resolveDraft = resolve })
    vi.mocked(authFetch).mockImplementation((url) => {
      if (String(url) === "/api/emails/generate-message") return pendingDraft
      return Promise.resolve({ ok: true, json: async () => ({ settings: {} }) } as Response)
    })

    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={mockInvoiceData}
        documentType="invoice"
      />
    )
    const textarea = within(container).getByRole("textbox", { name: /personal message/i }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "My own client note" } })

    await act(async () => {
      resolveDraft({ ok: true, json: async () => ({ message: "Late AI copy" }) } as Response)
      await pendingDraft
    })

    expect(textarea.value).toBe("My own client note")
  })

  it("uses link-specific onboarding copy and never claims an attachment", async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error("AI unavailable"))
    const onboardingData = {
      ...mockInvoiceData,
      projectName: "Website Redesign",
      toName: "Jordan",
    }
    const { container } = render(
      <SendEmailDialog
        open={true}
        onClose={vi.fn()}
        sessionId="session-1"
        invoiceData={onboardingData}
        documentType="client_onboarding_form"
      />
    )

    const textarea = within(container).getByRole("textbox", { name: /personal message/i }) as HTMLTextAreaElement
    await waitFor(() => expect(textarea.value).toContain("secure onboarding form"))
    expect(textarea.value).toContain("link in this email")
    expect(textarea.value.toLowerCase()).not.toContain("attached")
  })
})
