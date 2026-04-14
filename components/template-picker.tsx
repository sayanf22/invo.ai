"use client"
import { useState, useRef, useEffect } from "react"
import { Palette, ChevronDown, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InvoiceData } from "@/lib/invoice-types"

interface TemplatePickerProps {
  data: InvoiceData
  onChange: (updates: Partial<InvoiceData>) => void
}

type FontId = "Helvetica" | "Times-Roman" | "Courier" | "Inter" | "Playfair" | "Roboto Mono" | "Lora"

const TEMPLATES = [
  { id: "modern",    name: "Modern",    desc: "Clean & professional", hc: "#2563eb", tc: "#eff6ff",  font: "Helvetica" as FontId,    accent: "#2563eb", bg: "#f8fafc" },
  { id: "classic",   name: "Classic",   desc: "Traditional serif",    hc: "#1e293b", tc: "#f1f5f9",  font: "Times-Roman" as FontId,  accent: "#1e293b", bg: "#fafaf9" },
  { id: "bold",      name: "Bold",      desc: "Vibrant & striking",   hc: "#7c3aed", tc: "#f5f3ff",  font: "Helvetica" as FontId,    accent: "#7c3aed", bg: "#faf5ff" },
  { id: "minimal",   name: "Minimal",   desc: "No color, pure text",  hc: "",        tc: "#fafafa",  font: "Inter" as FontId,        accent: "#a3a3a3", bg: "#fafafa" },
  { id: "elegant",   name: "Elegant",   desc: "Emerald & refined",    hc: "#059669", tc: "#ecfdf5",  font: "Playfair" as FontId,     accent: "#059669", bg: "#f0fdf4" },
  { id: "corporate", name: "Corporate", desc: "Navy executive",       hc: "#1e3a5f", tc: "#f0f4f8",  font: "Helvetica" as FontId,    accent: "#1e3a5f", bg: "#f0f4f8" },
  { id: "creative",  name: "Creative",  desc: "Rose & playful",       hc: "#e11d48", tc: "#fff1f2",  font: "Lora" as FontId,         accent: "#e11d48", bg: "#fff1f2" },
  { id: "warm",      name: "Warm",      desc: "Earthy terracotta",    hc: "#c2410c", tc: "#fff7ed",  font: "Lora" as FontId,         accent: "#c2410c", bg: "#fff7ed" },
  { id: "geometric", name: "Geometric", desc: "Shapes & angles",      hc: "#0d9488", tc: "#f0fdfa",  font: "Roboto Mono" as FontId,  accent: "#0d9488", bg: "#f0fdfa" },
  { id: "receipt",   name: "Receipt",   desc: "Clean & structured",   hc: "#f6821f", tc: "#fff7ed",  font: "Helvetica" as FontId,    accent: "#f6821f", bg: "#fafafa" },
] as const

const COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#dc2626",
  "#ea580c", "#0891b2", "#4f46e5", "#1e293b",
  "#e11d48", "#c2410c", "#0d9488", "#d97706",
]

const FONTS: { id: FontId; label: string; sample: string; cls: string }[] = [
  { id: "Helvetica",   label: "Helvetica",    sample: "Clean sans-serif",    cls: "font-sans" },
  { id: "Inter",       label: "Inter",        sample: "Modern geometric",    cls: "font-sans" },
  { id: "Times-Roman", label: "Times Roman",  sample: "Classic serif",       cls: "font-serif" },
  { id: "Playfair",    label: "Playfair",     sample: "Elegant display",     cls: "font-serif" },
  { id: "Lora",        label: "Lora",         sample: "Warm literary serif", cls: "font-serif" },
  { id: "Courier",     label: "Courier",      sample: "Typewriter mono",     cls: "font-mono" },
  { id: "Roboto Mono", label: "Roboto Mono",  sample: "Technical mono",      cls: "font-mono" },
]

type Tab = "templates" | "colors" | "fonts"

function MiniPreview({ tpl, active }: { tpl: typeof TEMPLATES[number]; active: boolean }) {
  const c = tpl.accent || "#a3a3a3"
  const isGeo = tpl.id === "geometric"
  const isBold = tpl.id === "bold" || tpl.id === "creative"
  const isMinimal = tpl.id === "minimal"
  const isReceipt = tpl.id === "receipt"

  return (
    <svg viewBox="0 0 80 100" className={cn(
      "w-full h-full rounded-md border-2 transition-all duration-200",
      active ? "border-primary shadow-md" : "border-border/60"
    )}>
      <rect width="80" height="100" fill={tpl.bg} rx="3" />
      {isReceipt ? (
        <>
          <rect x="0" y="0" width="80" height="4" fill={c} rx="1.5" />
          <rect x="8" y="12" width="28" height="5" fill="#1a1a1a" rx="1" />
          <rect x="8" y="21" width="22" height="1.5" fill="#d1d5db" rx="0.5" />
          <rect x="8" y="25" width="18" height="1.5" fill="#d1d5db" rx="0.5" />
          <line x1="8" y1="32" x2="72" y2="32" stroke="#e5e5e5" strokeWidth="0.5" />
          <rect x="8" y="36" width="40" height="4" fill="#1a1a1a" rx="1" />
          <line x1="8" y1="44" x2="72" y2="44" stroke="#e5e5e5" strokeWidth="0.5" />
          {[48, 55, 62].map(y => (
            <g key={y}>
              <rect x="8" y={y} width="32" height="2" fill="#cbd5e1" rx="0.5" opacity="0.6" />
              <rect x="50" y={y} width="10" height="2" fill="#cbd5e1" rx="0.5" opacity="0.4" />
              <rect x="64" y={y} width="8" height="2" fill="#cbd5e1" rx="0.5" opacity="0.5" />
            </g>
          ))}
          <rect x="42" y="70" width="30" height="2" fill="#e5e5e5" rx="0.5" />
          <rect x="42" y="75" width="30" height="2" fill="#e5e5e5" rx="0.5" />
          <rect x="42" y="80" width="30" height="3" fill={c} rx="0.5" opacity="0.7" />
          <rect x="42" y="85" width="30" height="3" fill="#f0f0f0" rx="1" />
        </>
      ) : isBold ? (
        <rect x="0" y="0" width="80" height="28" fill={c} rx="3" />
      ) : isGeo ? (
        <>
          <polygon points="0,0 50,0 30,28 0,28" fill={c} opacity="0.85" />
          <polygon points="50,0 80,0 80,18 35,18" fill={c} opacity="0.5" />
        </>
      ) : isMinimal ? (
        <line x1="8" y1="26" x2="72" y2="26" stroke="#d4d4d4" strokeWidth="0.5" />
      ) : (
        <rect x="8" y="8" width="18" height="3" fill={c} rx="1" />
      )}
      <rect x="8" y={isBold ? "10" : "14"} width="30" height="4" fill={isBold ? "#fff" : c} rx="1" opacity="0.9" />
      <rect x="8" y={isBold ? "18" : "20"} width="18" height="2.5" fill={isBold ? "#ffffff80" : "#94a3b8"} rx="1" />
      {[38, 46, 54, 62].map(y => (
        <g key={y}>
          <rect x="8" y={y} width="40" height="2" fill="#cbd5e1" rx="1" opacity="0.6" />
          <rect x="56" y={y} width="16" height="2" fill="#cbd5e1" rx="1" opacity="0.4" />
        </g>
      ))}
      <rect x="8" y="34" width="64" height="0.5" fill={c} opacity="0.4" />
      <rect x="44" y="76" width="28" height="4" fill={c} rx="1" opacity="0.7" />
      <rect x="44" y="82" width="28" height="3" fill={c} rx="1" opacity="0.3" />
      {isGeo && (
        <>
          <circle cx="68" cy="85" r="6" fill={c} opacity="0.15" />
          <rect x="4" y="72" width="10" height="10" fill={c} opacity="0.1" transform="rotate(15 9 77)" />
        </>
      )}
    </svg>
  )
}

export function TemplatePicker({ data, onChange }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("templates")
  const ref = useRef<HTMLDivElement>(null)
  const tplId = data.design?.templateId || "modern"
  const tpl = TEMPLATES.find(t => t.id === tplId) || TEMPLATES[0]
  const curColor = data.design?.headerColor || tpl.hc
  const curFont = data.design?.font || "Helvetica"

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find(x => x.id === id)
    if (!t) return
    onChange({
      design: {
        templateId: t.id,
        layout: t.id as NonNullable<InvoiceData["design"]>["layout"],
        font: t.font,
        headerColor: t.hc,
        tableColor: t.tc,
      },
    })
  }

  const applyColor = (color: string) => {
    onChange({
      design: {
        ...(data.design || { templateId: "modern", layout: "modern" as const, font: "Helvetica" as const, tableColor: "" }),
        headerColor: color,
      },
    })
  }

  const applyFont = (font: FontId) => {
    onChange({
      design: {
        ...(data.design || { templateId: "modern", layout: "modern" as const, headerColor: "", tableColor: "" }),
        font,
      },
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 active:scale-95",
          open
            ? "bg-primary text-primary-foreground border-primary shadow-md"
            : "bg-card border-border text-foreground hover:border-primary/40 hover:shadow-sm"
        )}
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Design</span>
        <div className="w-5 h-5 rounded-full border border-black/10" style={{ backgroundColor: tpl.accent || "#a3a3a3" }} />
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-[340px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex border-b border-border">
            {(["templates", "colors", "fonts"] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-all duration-150",
                  tab === t
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {t}
              </button>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="px-2.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3 max-h-[420px] overflow-y-auto">
            {tab === "templates" && (
              <div className="grid grid-cols-3 gap-2.5">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all duration-150 active:scale-[0.97]",
                      tplId === t.id
                        ? "bg-primary/10 ring-2 ring-primary/40"
                        : "hover:bg-secondary/50 ring-1 ring-border/40"
                    )}
                  >
                    <div className="w-full aspect-[4/5] relative">
                      <MiniPreview tpl={t} active={tplId === t.id} />
                      {tplId === t.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="text-center w-full">
                      <p className="text-[11px] font-semibold leading-tight">{t.name}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {tab === "colors" && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-2.5 font-medium">Accent color</p>
                <div className="grid grid-cols-6 gap-2.5">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => applyColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full relative transition-transform duration-150 hover:scale-110 active:scale-90",
                        curColor === c && "ring-2 ring-offset-2 ring-primary"
                      )}
                      style={{ backgroundColor: c }}
                    >
                      {curColor === c && <Check className="w-3 h-3 text-white absolute inset-0 m-auto" />}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Custom:</span>
                  <input
                    type="color"
                    value={curColor || "#2563eb"}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => applyColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-border cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">{curColor || "#2563eb"}</span>
                </div>
              </div>
            )}

            {tab === "fonts" && (
              <div className="space-y-1.5">
                {FONTS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => applyFont(f.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 active:scale-[0.98]",
                      curFont === f.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-secondary/50 ring-1 ring-transparent"
                    )}
                  >
                    <span className={cn("text-lg leading-none w-8 text-center", f.cls)}>Aa</span>
                    <div className="flex-1 text-left">
                      <div className="text-xs font-semibold">{f.label}</div>
                      <div className={cn("text-[10px] text-muted-foreground", f.cls)}>{f.sample}</div>
                    </div>
                    {curFont === f.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
