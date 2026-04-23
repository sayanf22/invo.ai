"use client"

import { useState } from "react"
import { Mail } from "lucide-react"
import { SendEmailDialog } from "@/components/send-email-dialog"
import type { InvoiceData } from "@/lib/invoice-types"
import { cn } from "@/lib/utils"

interface SendEmailButtonProps {
  sessionId: string | null
  invoiceData: InvoiceData
  documentType: string
  onEmailSent?: () => void
}

export function SendEmailButton({
  sessionId,
  invoiceData,
  documentType,
  onEmailSent,
}: SendEmailButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!sessionId) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[13px] font-medium",
          "bg-card border border-border",
          "hover:border-primary/40 hover:bg-secondary/60",
          "transition-all duration-150 touch-manipulation select-none"
        )}
      >
        <Mail className="w-3.5 h-3.5 shrink-0" />
        <span>Send</span>
      </button>

      <SendEmailDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sessionId={sessionId}
        invoiceData={invoiceData}
        documentType={documentType}
        onEmailSent={onEmailSent}
      />
    </>
  )
}
