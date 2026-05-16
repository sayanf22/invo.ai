import Link from "next/link"
import { InvoLogo } from "@/components/invo-logo"

/**
 * Short-link not-found page.
 *
 * Rendered when middleware cannot resolve a /d/<shortId> URL to a real
 * document session. Mirrors the language used by DocuSign and Adobe Sign
 * for invalid envelope links — short, clear, and never reveals whether
 * the link was simply mistyped or whether the underlying document was
 * cancelled by the sender.
 */
export const dynamic = "force-static"

export default function ShortLinkNotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <InvoLogo size={48} />
      <h1 className="mt-8 text-[28px] font-semibold tracking-tight text-foreground text-center">
        Document link not found
      </h1>
      <p className="mt-3 text-[16px] text-muted-foreground text-center max-w-md leading-relaxed">
        This link is no longer valid. The document may have been cancelled by
        the sender, or the link might be incomplete. If you believe this is a
        mistake, please contact the person who sent you this link.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Go to Clorefy
      </Link>
    </div>
  )
}
