"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { clientSchema } from "@/lib/invoice-types"
import type { Client } from "@/lib/invoice-types"

type ClientFormData = z.infer<typeof clientSchema>

interface ClientFormModalProps {
  mode: "add" | "edit"
  client?: Client
  onSuccess: (client: Client) => void
  onClose: () => void
}

export function ClientFormModal({ mode, client, onSuccess, onClose }: ClientFormModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? "",
      email: client?.email ?? "",
      phone: client?.phone ?? "",
      address: client?.address ?? "",
      tax_id: client?.tax_id ?? "",
      notes: client?.notes ?? "",
    },
  })

  const onSubmit = async (data: ClientFormData) => {
    try {
      const url = mode === "edit" && client ? `/api/clients/${client.id}` : "/api/clients"
      const method = mode === "edit" ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Something went wrong")
      }

      const { client: savedClient } = await res.json()
      toast.success(mode === "edit" ? "Client updated" : "Client added")
      onSuccess(savedClient)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save client")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Client" : "Add Client"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...register("name")} placeholder="Client name" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="client@example.com" />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" {...register("phone")} placeholder="+1 555 000 0000" />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" {...register("address")} placeholder="Street, City, Country" rows={2} />
            {errors.address && (
              <p className="text-xs text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="tax_id">Tax ID</Label>
            <Input id="tax_id" {...register("tax_id")} placeholder="VAT / GST / EIN" />
            {errors.tax_id && (
              <p className="text-xs text-destructive">{errors.tax_id.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Optional notes" rows={2} />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2 flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving…" : mode === "edit" ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
