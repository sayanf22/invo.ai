import Image from "next/image"

export function ClorefyLogo({ size = 72 }: { size?: number }) {
  return (
    <Image
      src="/favicon.png"
      alt="Clorefy"
      width={size}
      height={size}
      className="rounded-lg"
      priority
    />
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
