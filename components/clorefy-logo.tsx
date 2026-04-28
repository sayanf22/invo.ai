import Image from "next/image"

export function ClorefyLogo({ size = 72, className = "", showBeta = false }: { size?: number; className?: string; showBeta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <Image
        src="/favicon.png"
        alt="Clorefy"
        width={size}
        height={size}
        className={`rounded-lg shrink-0 ${className}`}
        priority
      />
      {showBeta && (
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-[2px] rounded-full bg-foreground/[0.06] text-muted-foreground/70 border border-border/50 leading-none select-none whitespace-nowrap shrink-0">
          beta
        </span>
      )}
    </span>
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
