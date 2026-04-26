"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface SignatureCancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  signerName: string
  onConfirm: () => void
  loading?: boolean
}

export function SignatureCancelDialog({
  open,
  onOpenChange,
  signerName,
  onConfirm,
  loading,
}: SignatureCancelDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Signature Request</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel the signature request for{" "}
            <span className="font-medium text-foreground">{signerName}</span>?
            The signing link will be invalidated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Request</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Cancelling..." : "Cancel Request"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
