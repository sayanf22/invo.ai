import Link from "next/link"
import { InvoLogo } from "@/components/invo-logo"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <InvoLogo size={48} />
      <h1 className="mt-8 text-[72px] font-bold tracking-tight text-foreground leading-none">404</h1>
      <p className="mt-3 text-[17px] text-muted-foreground text-center max-w-md">
        This page doesn't exist. It may have been moved or the link might be incorrect.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
