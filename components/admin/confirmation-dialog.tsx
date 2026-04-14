'use client'

import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAdminTheme } from './admin-theme-provider'

interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  destructive?: boolean
  loading?: boolean
}

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive,
  loading,
}: ConfirmationDialogProps) {
  const { theme } = useAdminTheme()
  const isDark = theme === 'dark'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
          borderColor: isDark ? '#1A1A1A' : '#E5E5E5',
          color: isDark ? '#F5F5F5' : '#0A0A0A',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: isDark ? '#F5F5F5' : '#0A0A0A' }}>{title}</DialogTitle>
          <DialogDescription style={{ color: isDark ? '#71717A' : '#71717A' }}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm active:scale-95 transition-all duration-150 disabled:opacity-50"
            style={{
              backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
              color: isDark ? '#F5F5F5' : '#0A0A0A',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              'px-4 py-2 rounded-md text-sm text-white flex items-center gap-2 active:scale-95 transition-all duration-150 disabled:opacity-50',
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#FFFFFF] hover:bg-[#E5E5E5] !text-[#0A0A0A]',
            ].join(' ')}
            style={!destructive ? { backgroundColor: isDark ? '#FFFFFF' : '#0A0A0A', color: isDark ? '#0A0A0A' : '#FFFFFF' } : undefined}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
