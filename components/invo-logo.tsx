import Image from "next/image"

export function InvoLogo({ size = 72 }: { size?: number }) {
  return (
    <Image
      src="/favicon.png"
      alt="Invo.ai"
      width={size}
      height={size}
      className="rounded-lg"
      priority
    />
  )
}
