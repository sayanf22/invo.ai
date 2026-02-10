"use client"

import { useState } from "react"
import {
    DOCUMENT_TEMPLATES,
    getTemplatesByCategory,
    type DocumentTemplate,
} from "@/lib/document-templates"
import { getInitialInvoiceData, type InvoiceData } from "@/lib/invoice-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    FileText,
    ScrollText,
    ShieldCheck,
    Handshake,
    Search,
    Clock,
    Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap: Record<string, React.ElementType> = {
    FileText,
    ScrollText,
    ShieldCheck,
    Handshake,
    Clock,
}

const categoryLabels = {
    invoice: "Invoices",
    contract: "Contracts",
    nda: "NDAs",
    agreement: "Agreements",
}

interface TemplateSelectorProps {
    onSelect: (data: Partial<InvoiceData>) => void
    trigger?: React.ReactNode
}

export function TemplateSelector({ onSelect, trigger }: TemplateSelectorProps) {
    const [open, setOpen] = useState(false)
    const [activeCategory, setActiveCategory] = useState<DocumentTemplate["category"]>("invoice")
    const [search, setSearch] = useState("")

    const categories: DocumentTemplate["category"][] = ["invoice", "contract", "nda", "agreement"]

    const filteredTemplates = search
        ? DOCUMENT_TEMPLATES.filter(
            (t) =>
                t.name.toLowerCase().includes(search.toLowerCase()) ||
                t.description.toLowerCase().includes(search.toLowerCase()) ||
                t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
        )
        : getTemplatesByCategory(activeCategory)

    const handleSelect = (template: DocumentTemplate) => {
        const initialData = getInitialInvoiceData()
        const merged = { ...initialData, ...template.data }
        onSelect(merged)
        setOpen(false)
        setSearch("")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Choose Template
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Choose a Template</DialogTitle>
                    <DialogDescription>
                        Start with a professionally crafted template and customize it for your needs
                    </DialogDescription>
                </DialogHeader>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex-1 flex overflow-hidden gap-4">
                    {/* Category tabs */}
                    {!search && (
                        <div className="flex flex-col gap-1 w-36 shrink-0">
                            {categories.map((cat) => {
                                const Icon = iconMap[cat === "invoice" ? "FileText" : cat === "contract" ? "ScrollText" : cat === "nda" ? "ShieldCheck" : "Handshake"]
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                                            activeCategory === cat
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {categoryLabels[cat]}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Templates grid */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid gap-3">
                            {filteredTemplates.map((template) => {
                                const Icon = iconMap[template.icon] || FileText
                                return (
                                    <button
                                        key={template.id}
                                        onClick={() => handleSelect(template)}
                                        className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Icon className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-foreground">{template.name}</h4>
                                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                                                {template.description}
                                            </p>
                                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                                {template.tags.slice(0, 3).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}

                            {filteredTemplates.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No templates found for "{search}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
