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
        <span className="text-[7px] font-bold uppercase tracking-wider px-1 py-[1px] rounded-full bg-foreground/[0.07] text-muted-foreground/60 border border-border/40 leading-none select-none whitespace-nowrap shrink-0">
          beta
        </span>
      )}
    </span>
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
