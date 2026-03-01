"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { InvoLogo } from "@/components/invo-logo"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Loader2, ArrowLeft, Building2, Mail, Phone, MapPin,
    CreditCard, FileText, CheckCircle2, Pencil, Save, X, Landmark
} from "lucide-react"
import { toast } from "sonner"
import { getTaxIdFieldName } from "@/lib/countries"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────

interface BusinessProfile {
    name: string
    business_type: string
    owner_name: string
    email: string
    phone: string
    country: string
    state_province: string
    address: {
        street: string
        city: string
        state: string
        postal_code: string
        country: string
    }
    tax_ids: Record<string, string>
    client_countries: string[]
    default_currency: string
    default_payment_terms: string
    default_payment_instructions: string
    additional_notes: string
    payment_methods: Record<string, unknown>
    created_at: string
    updated_at: string
}

const COUNTRY_FLAGS: Record<string, string> = {
    IN: "🇮🇳 India", US: "🇺🇸 United States", GB: "🇬🇧 United Kingdom",
    DE: "🇩🇪 Germany", CA: "🇨🇦 Canada", AU: "🇦🇺 Australia",
    SG: "🇸🇬 Singapore", AE: "🇦🇪 UAE", PH: "🇵🇭 Philippines",
    FR: "🇫🇷 France", NL: "🇳🇱 Netherlands",
}

const COUNTRY_CODES = ["IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"]

const BUSINESS_TYPES: Record<string, string> = {
    freelancer: "Freelancer", developer: "Developer", agency: "Agency",
    ecommerce: "E-commerce", professional: "Professional Services", other: "Other",
}

const PAYMENT_TERMS: Record<string, string> = {
    immediate: "Due Immediately", net_15: "Net 15 Days",
    net_30: "Net 30 Days", net_60: "Net 60 Days",
}

const CURRENCIES = ["INR", "USD", "GBP", "EUR", "CAD", "AUD", "SGD", "AED", "PHP"]

// ── Editable Field Component ───────────────────────────────────────────

function EditableField({
    label, value, field, editing, editData, onChange, type = "text", icon,
}: {
    label: string; value: string; field: string; editing: boolean
    editData: Record<string, string>; onChange: (field: string, val: string) => void
    type?: string; icon?: React.ReactNode
}) {
    return (
        <div>
            <label className="text-[13px] font-medium text-muted-foreground flex items-center gap-2">
                {icon}{label}
            </label>
            {editing ? (
                <Input
                    value={editData[field] ?? value}
                    onChange={(e) => onChange(field, e.target.value)}
                    className="mt-1.5 h-11 text-[15px]"
                    type={type}
                />
            ) : (
                <p className="text-[16px] mt-1.5">{value || "—"}</p>
            )}
        </div>
    )
}

// ── Section Header with Edit Button ────────────────────────────────────

function SectionHeader({
    icon, title, subtitle, editing, onEdit, onSave, onCancel, saving,
}: {
    icon: React.ReactNode; title: string; subtitle: string
    editing: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void
    saving: boolean
}) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">{icon}</div>
                <div>
                    <h2 className="text-[18px] font-semibold">{title}</h2>
                    <p className="text-[13px] text-muted-foreground">{subtitle}</p>
                </div>
            </div>
            {editing ? (
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving} className="gap-1.5 text-[14px]">
                        <X className="h-4 w-4" /> Cancel
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saving} className="gap-1.5 text-[14px]">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </Button>
                </div>
            ) : (
                <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5 text-[14px]">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
            )}
        </div>
    )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function ProfilePage() {
    const router = useRouter()
    const { supabase, user, isLoading: authLoading } = useAuth()
    const [profile, setProfile] = useState<BusinessProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Track which section is being edited
    const [editingSection, setEditingSection] = useState<string | null>(null)
    const [editData, setEditData] = useState<Record<string, string>>({})
    const [editCountries, setEditCountries] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    const loadProfile = useCallback(async () => {
        if (!user) return
        try {
            const { data, error } = await supabase
                .from("businesses")
                .select("*")
                .eq("user_id", user.id)
                .single()

            if (error) {
                if (error.code === "PGRST116") {
                    toast.error("No business profile found. Please complete onboarding.")
                    router.push("/onboarding")
                    return
                }
                throw error
            }
            setProfile(data as unknown as BusinessProfile)
        } catch (error) {
            console.error("Load profile error:", error)
            toast.error("Failed to load profile")
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase, router])

    useEffect(() => {
        if (!authLoading && !user) { router.push("/auth/login"); return }
        if (user) loadProfile()
    }, [authLoading, user, router, loadProfile])

    const handleChange = (field: string, value: string) => {
        setEditData(prev => ({ ...prev, [field]: value }))
    }

    const startEdit = (section: string) => {
        if (!profile) return
        setEditingSection(section)
        // Pre-fill edit data based on section
        switch (section) {
            case "business":
                setEditData({
                    name: profile.name || "",
                    business_type: profile.business_type || "",
                    owner_name: profile.owner_name || "",
                    country: profile.country || "",
                })
                break
            case "contact":
                setEditData({
                    email: profile.email || "",
                    phone: profile.phone || "",
                })
                break
            case "address":
                setEditData({
                    street: profile.address?.street || "",
                    city: profile.address?.city || "",
                    state: profile.address?.state || profile.state_province || "",
                    postal_code: profile.address?.postal_code || "",
                })
                break
            case "tax": {
                const taxLabel = profile.country ? getTaxIdFieldName(profile.country) : "tax_id"
                setEditData({
                    tax_id: profile.tax_ids?.[taxLabel] || "",
                })
                setEditCountries(profile.client_countries || [])
                break
            }
            case "payment": {
                const bank = (profile.payment_methods as any)?.bank || {}
                setEditData({
                    default_currency: profile.default_currency || "",
                    default_payment_terms: profile.default_payment_terms || "",
                    default_payment_instructions: profile.default_payment_instructions || "",
                    bank_name: bank.bankName || "",
                    account_name: bank.accountName || "",
                    account_number: bank.accountNumber || "",
                    ifsc_code: bank.ifscCode || "",
                    swift_code: bank.swiftCode || "",
                    routing_number: bank.routingNumber || "",
                })
                break
            }
            case "notes":
                setEditData({
                    additional_notes: profile.additional_notes || "",
                })
                break
        }
    }

    const cancelEdit = () => {
        setEditingSection(null)
        setEditData({})
        setEditCountries([])
    }

    const saveSection = async (section: string) => {
        if (!user || !profile) return
        setSaving(true)
        try {
            let updateData: Record<string, unknown> = {}

            switch (section) {
                case "business":
                    updateData = {
                        name: editData.name,
                        business_type: editData.business_type,
                        owner_name: editData.owner_name,
                        country: editData.country,
                    }
                    break
                case "contact":
                    updateData = {
                        email: editData.email,
                        phone: editData.phone,
                    }
                    break
                case "address":
                    updateData = {
                        state_province: editData.state,
                        address: {
                            street: editData.street,
                            city: editData.city,
                            state: editData.state,
                            postal_code: editData.postal_code,
                            country: profile.country,
                        },
                    }
                    break
                case "tax": {
                    const taxLabel = profile.country ? getTaxIdFieldName(profile.country) : "tax_id"
                    const taxIds: Record<string, string> = {}
                    if (editData.tax_id) taxIds[taxLabel] = editData.tax_id
                    updateData = {
                        tax_ids: taxIds,
                        client_countries: editCountries,
                    }
                    break
                }
                case "payment": {
                    const bankDetails: Record<string, string> = {}
                    if (editData.bank_name) bankDetails.bankName = editData.bank_name
                    if (editData.account_name) bankDetails.accountName = editData.account_name
                    if (editData.account_number) bankDetails.accountNumber = editData.account_number
                    if (editData.ifsc_code) bankDetails.ifscCode = editData.ifsc_code
                    if (editData.swift_code) bankDetails.swiftCode = editData.swift_code
                    if (editData.routing_number) bankDetails.routingNumber = editData.routing_number

                    updateData = {
                        default_currency: editData.default_currency,
                        default_payment_terms: editData.default_payment_terms,
                        default_payment_instructions: editData.default_payment_instructions,
                        payment_methods: Object.keys(bankDetails).length > 0 ? { bank: bankDetails } : {},
                    }
                    break
                }
                case "notes":
                    updateData = {
                        additional_notes: editData.additional_notes,
                    }
                    break
            }

            const { error } = await supabase
                .from("businesses")
                .update(updateData)
                .eq("user_id", user.id)

            if (error) throw error

            toast.success("Profile updated!")
            setEditingSection(null)
            setEditData({})
            await loadProfile()
        } catch (error) {
            console.error("Save error:", error)
            toast.error("Failed to save changes")
        } finally {
            setSaving(false)
        }
    }

    const toggleCountry = (code: string) => {
        setEditCountries(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        )
    }

    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!profile) return null

    const taxIdLabel = profile.country ? getTaxIdFieldName(profile.country) : "Tax ID"
    const taxIdValue = profile.tax_ids?.[taxIdLabel] || "Not provided"
    const bank = (profile.payment_methods as any)?.bank || {}
    const hasBankDetails = bank.bankName || bank.accountNumber
    const isEditing = (s: string) => editingSection === s

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="border-b py-4 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-xl">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <InvoLogo size={40} />
                </div>
                <div className="text-[15px] text-muted-foreground font-medium">Business Profile</div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 overflow-auto">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div>
                        <h1 className="text-[28px] font-semibold tracking-tight">Business Profile</h1>
                        <p className="text-[15px] text-muted-foreground mt-1">
                            Your business information used for document generation. Click Edit on any section to update.
                        </p>
                    </div>

                    {/* ── Business Information ──────────────────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<Building2 className="h-5 w-5 text-primary" />}
                            title="Business Information" subtitle="Core business details"
                            editing={isEditing("business")} onEdit={() => startEdit("business")}
                            onSave={() => saveSection("business")} onCancel={cancelEdit} saving={saving}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <EditableField label="Business Name" value={profile.name} field="name"
                                editing={isEditing("business")} editData={editData} onChange={handleChange} />
                            {isEditing("business") ? (
                                <div>
                                    <label className="text-[13px] font-medium text-muted-foreground">Business Type</label>
                                    <Select value={editData.business_type} onValueChange={(v) => handleChange("business_type", v)}>
                                        <SelectTrigger className="mt-1.5 h-11 text-[15px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <EditableField label="Business Type" value={BUSINESS_TYPES[profile.business_type] || profile.business_type}
                                    field="business_type" editing={false} editData={editData} onChange={handleChange} />
                            )}
                            <EditableField label="Owner Name" value={profile.owner_name} field="owner_name"
                                editing={isEditing("business")} editData={editData} onChange={handleChange} />
                            {isEditing("business") ? (
                                <div>
                                    <label className="text-[13px] font-medium text-muted-foreground">Country</label>
                                    <Select value={editData.country} onValueChange={(v) => handleChange("country", v)}>
                                        <SelectTrigger className="mt-1.5 h-11 text-[15px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {COUNTRY_CODES.map(c => (
                                                <SelectItem key={c} value={c}>{COUNTRY_FLAGS[c]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <EditableField label="Country" value={COUNTRY_FLAGS[profile.country] || profile.country}
                                    field="country" editing={false} editData={editData} onChange={handleChange} />
                            )}
                        </div>
                    </Card>

                    {/* ── Contact Information ──────────────────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<Mail className="h-5 w-5 text-primary" />}
                            title="Contact Information" subtitle="How to reach your business"
                            editing={isEditing("contact")} onEdit={() => startEdit("contact")}
                            onSave={() => saveSection("contact")} onCancel={cancelEdit} saving={saving}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <EditableField label="Email" value={profile.email} field="email"
                                editing={isEditing("contact")} editData={editData} onChange={handleChange}
                                type="email" icon={<Mail className="h-3.5 w-3.5" />} />
                            <EditableField label="Phone" value={profile.phone} field="phone"
                                editing={isEditing("contact")} editData={editData} onChange={handleChange}
                                type="tel" icon={<Phone className="h-3.5 w-3.5" />} />
                        </div>
                    </Card>

                    {/* ── Address ──────────────────────────────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<MapPin className="h-5 w-5 text-primary" />}
                            title="Business Address" subtitle="Physical location"
                            editing={isEditing("address")} onEdit={() => startEdit("address")}
                            onSave={() => saveSection("address")} onCancel={cancelEdit} saving={saving}
                        />
                        <div className="space-y-4">
                            <EditableField label="Street Address" value={profile.address?.street} field="street"
                                editing={isEditing("address")} editData={editData} onChange={handleChange} />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <EditableField label="City" value={profile.address?.city} field="city"
                                    editing={isEditing("address")} editData={editData} onChange={handleChange} />
                                <EditableField label="State/Province" value={profile.address?.state || profile.state_province} field="state"
                                    editing={isEditing("address")} editData={editData} onChange={handleChange} />
                                <EditableField label="Postal Code" value={profile.address?.postal_code} field="postal_code"
                                    editing={isEditing("address")} editData={editData} onChange={handleChange} />
                            </div>
                        </div>
                    </Card>

                    {/* ── Tax & Compliance ─────────────────────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<FileText className="h-5 w-5 text-primary" />}
                            title="Tax & Compliance" subtitle="Tax registration details"
                            editing={isEditing("tax")} onEdit={() => startEdit("tax")}
                            onSave={() => saveSection("tax")} onCancel={cancelEdit} saving={saving}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <EditableField label={taxIdLabel.toUpperCase()} value={taxIdValue} field="tax_id"
                                editing={isEditing("tax")} editData={editData} onChange={handleChange} />
                            <div>
                                <label className="text-[13px] font-medium text-muted-foreground">Client Countries</label>
                                {isEditing("tax") ? (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {COUNTRY_CODES.map(code => (
                                            <button key={code} type="button" onClick={() => toggleCountry(code)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border",
                                                    editCountries.includes(code)
                                                        ? "bg-primary/10 border-primary/30 text-foreground"
                                                        : "bg-background border-border text-muted-foreground hover:border-primary/20"
                                                )}>
                                                {COUNTRY_FLAGS[code]?.split(" ")[0]} {code}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {profile.client_countries?.length > 0 ? profile.client_countries.map(c => (
                                            <span key={c} className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/10 text-[13px]">
                                                {COUNTRY_FLAGS[c] || c}
                                            </span>
                                        )) : <p className="text-[16px]">—</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── Payment Settings & Bank Details ─────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<CreditCard className="h-5 w-5 text-primary" />}
                            title="Payment Settings" subtitle="Currency, terms, and bank details"
                            editing={isEditing("payment")} onEdit={() => startEdit("payment")}
                            onSave={() => saveSection("payment")} onCancel={cancelEdit} saving={saving}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {isEditing("payment") ? (
                                <div>
                                    <label className="text-[13px] font-medium text-muted-foreground">Default Currency</label>
                                    <Select value={editData.default_currency} onValueChange={(v) => handleChange("default_currency", v)}>
                                        <SelectTrigger className="mt-1.5 h-11 text-[15px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <EditableField label="Default Currency" value={profile.default_currency}
                                    field="default_currency" editing={false} editData={editData} onChange={handleChange} />
                            )}
                            {isEditing("payment") ? (
                                <div>
                                    <label className="text-[13px] font-medium text-muted-foreground">Payment Terms</label>
                                    <Select value={editData.default_payment_terms} onValueChange={(v) => handleChange("default_payment_terms", v)}>
                                        <SelectTrigger className="mt-1.5 h-11 text-[15px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(PAYMENT_TERMS).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <EditableField label="Payment Terms" value={PAYMENT_TERMS[profile.default_payment_terms] || profile.default_payment_terms}
                                    field="default_payment_terms" editing={false} editData={editData} onChange={handleChange} />
                            )}
                            <div className="md:col-span-2">
                                {isEditing("payment") ? (
                                    <div>
                                        <label className="text-[13px] font-medium text-muted-foreground">Payment Instructions</label>
                                        <Textarea value={editData.default_payment_instructions}
                                            onChange={(e) => handleChange("default_payment_instructions", e.target.value)}
                                            className="mt-1.5 text-[15px] min-h-[80px]"
                                            placeholder="e.g., Bank transfer to Account #1234..." />
                                    </div>
                                ) : (
                                    <EditableField label="Payment Instructions" value={profile.default_payment_instructions}
                                        field="default_payment_instructions" editing={false} editData={editData} onChange={handleChange} />
                                )}
                            </div>
                        </div>

                        {/* Bank Details Sub-section */}
                        <div className="mt-6 pt-6 border-t border-border">
                            <div className="flex items-center gap-2 mb-4">
                                <Landmark className="h-4 w-4 text-muted-foreground" />
                                <span className="text-[15px] font-semibold">Bank Details</span>
                                {!hasBankDetails && !isEditing("payment") && (
                                    <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Optional</span>
                                )}
                            </div>
                            {isEditing("payment") ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <EditableField label="Bank Name" value="" field="bank_name"
                                        editing={true} editData={editData} onChange={handleChange} />
                                    <EditableField label="Account Holder Name" value="" field="account_name"
                                        editing={true} editData={editData} onChange={handleChange} />
                                    <EditableField label="Account Number" value="" field="account_number"
                                        editing={true} editData={editData} onChange={handleChange} />
                                    <EditableField label="IFSC Code" value="" field="ifsc_code"
                                        editing={true} editData={editData} onChange={handleChange} />
                                    <EditableField label="SWIFT Code" value="" field="swift_code"
                                        editing={true} editData={editData} onChange={handleChange} />
                                    <EditableField label="Routing Number" value="" field="routing_number"
                                        editing={true} editData={editData} onChange={handleChange} />
                                </div>
                            ) : hasBankDetails ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {bank.bankName && <div><label className="text-[13px] font-medium text-muted-foreground">Bank Name</label><p className="text-[16px] mt-1">{bank.bankName}</p></div>}
                                    {bank.accountName && <div><label className="text-[13px] font-medium text-muted-foreground">Account Holder</label><p className="text-[16px] mt-1">{bank.accountName}</p></div>}
                                    {bank.accountNumber && <div><label className="text-[13px] font-medium text-muted-foreground">Account Number</label><p className="text-[16px] mt-1">{bank.accountNumber}</p></div>}
                                    {bank.ifscCode && <div><label className="text-[13px] font-medium text-muted-foreground">IFSC Code</label><p className="text-[16px] mt-1">{bank.ifscCode}</p></div>}
                                    {bank.swiftCode && <div><label className="text-[13px] font-medium text-muted-foreground">SWIFT Code</label><p className="text-[16px] mt-1">{bank.swiftCode}</p></div>}
                                    {bank.routingNumber && <div><label className="text-[13px] font-medium text-muted-foreground">Routing Number</label><p className="text-[16px] mt-1">{bank.routingNumber}</p></div>}
                                </div>
                            ) : (
                                <p className="text-[14px] text-muted-foreground">No bank details added. Click Edit to add your bank information for invoices.</p>
                            )}
                        </div>
                    </Card>

                    {/* ── Additional Notes ─────────────────────────── */}
                    <Card className="p-6">
                        <SectionHeader
                            icon={<FileText className="h-5 w-5 text-primary" />}
                            title="Additional Notes" subtitle="Extra business info, pricing, descriptions"
                            editing={isEditing("notes")} onEdit={() => startEdit("notes")}
                            onSave={() => saveSection("notes")} onCancel={cancelEdit} saving={saving}
                        />
                        {isEditing("notes") ? (
                            <Textarea value={editData.additional_notes}
                                onChange={(e) => handleChange("additional_notes", e.target.value)}
                                className="text-[15px] min-h-[120px]"
                                placeholder="Add any extra info about your business — pricing, services, descriptions..." />
                        ) : (
                            <p className="text-[16px] whitespace-pre-wrap">{profile.additional_notes || "No additional notes. Click Edit to add business descriptions, pricing, or other details."}</p>
                        )}
                    </Card>

                    {/* Profile Status */}
                    <Card className="p-5 bg-primary/5 border-primary/20">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-[16px] font-medium">Profile Complete</p>
                                <p className="text-[14px] text-muted-foreground">
                                    This information is used to generate your documents. Edit any section above to update.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    )
}
