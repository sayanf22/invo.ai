"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { type ProposalFormData } from "@/lib/proposal-types"
import { Building2, AlertCircle, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"

interface StepAgencyProps {
  form: ProposalFormData
  onChange: (updates: Partial<ProposalFormData>) => void
  profileIncomplete?: boolean
}

/**
 * Step 7 — About the Agency
 * Auto-filled from business profile. Blocks generation if profile is incomplete.
 */
export function StepAgency({ form, onChange, profileIncomplete }: StepAgencyProps) {
  const router = useRouter()

  const isBlocked = !form.agencyName.trim() || !form.agencyEmail.trim()

  return (
    <div className="space-y-5">
      {/* Profile incomplete warning */}
      {(profileIncomplete || isBlocked) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-amber-800">
              Business profile is incomplete
            </p>
            <p className="text-xs text-amber-700">
              Agency name and email are required for proposal generation. Fill them here or go to your profile to complete it.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/profile")}
              className="text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Go to Profile
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Auto-filled from your business profile. Edit here if needed — changes apply to this proposal only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Agency Name */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyName">
            Agency Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agencyName"
            placeholder="WhyCreatives"
            value={form.agencyName}
            onChange={e => onChange({ agencyName: e.target.value })}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyEmail">
            Agency Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="agencyEmail"
            type="email"
            placeholder="hello@agency.com"
            value={form.agencyEmail}
            onChange={e => onChange({ agencyEmail: e.target.value })}
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyPhone">Phone</Label>
          <Input
            id="agencyPhone"
            placeholder="+91 98765 43210"
            value={form.agencyPhone}
            onChange={e => onChange({ agencyPhone: e.target.value })}
          />
        </div>

        {/* Website */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyWebsite">Website</Label>
          <Input
            id="agencyWebsite"
            placeholder="https://whycreatives.in"
            value={form.agencyWebsite}
            onChange={e => onChange({ agencyWebsite: e.target.value })}
          />
        </div>

        {/* Founding Year */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyFoundingYear">Founded Year</Label>
          <Input
            id="agencyFoundingYear"
            placeholder="2020"
            value={form.agencyFoundingYear}
            onChange={e => onChange({ agencyFoundingYear: e.target.value })}
          />
        </div>

        {/* Tagline */}
        <div className="space-y-1.5">
          <Label htmlFor="agencyTagline">Tagline / Specialisation</Label>
          <Input
            id="agencyTagline"
            placeholder="Helping brands grow through storytelling"
            value={form.agencyTagline}
            onChange={e => onChange({ agencyTagline: e.target.value })}
          />
        </div>

        {/* Address */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="agencyAddress">Agency Address</Label>
          <Textarea
            id="agencyAddress"
            placeholder="123 Agency Street, Agartala, Tripura 799001"
            value={form.agencyAddress}
            onChange={e => onChange({ agencyAddress: e.target.value })}
            rows={2}
          />
        </div>

        {/* Services */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="agencyServices">Services Offered</Label>
          <Textarea
            id="agencyServices"
            placeholder="Social media management, content creation, photography, paid ads management, brand strategy"
            value={form.agencyServices}
            onChange={e => onChange({ agencyServices: e.target.value })}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">Used in the About Us section of the proposal</p>
        </div>
      </div>
    </div>
  )
}
