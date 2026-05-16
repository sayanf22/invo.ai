import Image from "next/image"

export function ClorefyLogo({ size = 72, className = "", showBeta = false }: { size?: number; className?: string; showBeta?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <Image
        src="/favicon.png"
        alt="Clorefy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`rounded-lg shrink-0 ${className}`}
        priority
      />
    </span>
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
