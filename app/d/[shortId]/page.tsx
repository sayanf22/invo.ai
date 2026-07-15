import { redirect } from "next/navigation"
import { isPublicDocumentId } from "@/lib/public-capability"

/**
 * Compatibility route for shared links. The route parameter is now a full
 * 256-bit public capability despite the legacy folder name.
 */
export default async function PublicDocumentRedirect({
  params,
}: {
  params: Promise<{ shortId: string }>
}) {
  const { shortId: publicId } = await params
  if (!isPublicDocumentId(publicId)) redirect("/d/not-found")
  redirect(`/pay/${publicId}`)
}
