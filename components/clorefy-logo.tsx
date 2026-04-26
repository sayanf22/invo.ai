import Image from "next/image"

export function ClorefyLogo({ size = 72, className = "", showBeta = false }: { size?: number; className?: string; showBeta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Image
        src="/favicon.png"
        alt="Clorefy"
        width={size}
        height={size}
        className={`rounded-lg ${className}`}
        priority
      />
      {showBeta && (
        <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40 leading-none select-none">
          Beta
        </span>
      )}
    </span>
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
