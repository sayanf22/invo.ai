import Image from "next/image"

export function ClorefyLogo({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="/favicon.png"
      alt="Clorefy"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      priority
    />
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
