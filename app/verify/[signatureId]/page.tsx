import { createClient } from "@supabase/supabase-js"
import { CheckCircle, XCircle, Shield } from "lucide-react"
import {
  buildPublicVerificationData,
} from "@/lib/verification-data"
import type { SignatureRow, PublicVerificationData } from "@/lib/verification-data"

// ── Date formatting ───────────────────────────────────────────────────────────

function formatSignedAt(iso: string): string {
  const date = new Date(iso)
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = months[date.getUTCMonth()]
  const year = date.getUTCFullYear()
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ signatureId: string }>
}) {
  const { signatureId } = await params

  // Use service-role client — no auth required for this public page
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch signature with document type via session join
  const { data: signature } = await supabase
    .from("signatures")
    .select(`
      id,
      signer_name,
      signer_email,
      signed_at,
      document_hash,
      ip_address,
      signature_image_url,
      party,
      session_id,
      document_sessions (
        document_type
      )
    `)
    .eq("id", signatureId)
    .maybeSingle()

  // Build safe public data (or show not-verified state)
  const verificationData: PublicVerificationData | null = signature
    ? buildPublicVerificationData(signature as unknown as SignatureRow)
    : null

  const isVerified = verificationData?.verified === true

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-stone-600" />
            <span className="font-semibold text-stone-800 text-sm">Signature Verification</span>
          </div>
          <span className="text-sm font-medium text-stone-500">Clorefy</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Verification status card */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* Status banner */}
            <div
              className={`px-6 py-5 flex items-center gap-3 ${
                isVerified
                  ? "bg-emerald-50 border-b border-emerald-100"
                  : "bg-red-50 border-b border-red-100"
              }`}
            >
              {isVerified ? (
                <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500 shrink-0" />
              )}
              <div>
                <p
                  className={`text-lg font-bold ${
                    isVerified ? "text-emerald-800" : "text-red-700"
                  }`}
                >
                  {isVerified ? "✓ Verified" : "✗ Not Verified"}
                </p>
                <p
                  className={`text-sm ${
                    isVerified ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {isVerified
                    ? "This signature is authentic and has been verified."
                    : !signature
                    ? "No signature record found for this ID."
                    : "This signature has not been completed yet."}
                </p>
              </div>
            </div>

            {/* Details table */}
            {verificationData ? (
              <div className="divide-y divide-stone-100">
                <DetailRow label="Signer Name" value={verificationData.signerName ?? "—"} />
                <DetailRow label="Signer Email" value={verificationData.signerEmail} />
                <DetailRow
                  label="Signed At"
                  value={
                    verificationData.signedAt
                      ? formatSignedAt(verificationData.signedAt)
                      : "Not yet signed"
                  }
                />
                <DetailRow
                  label="Document Type"
                  value={
                    verificationData.documentType
                      ? verificationData.documentType.charAt(0).toUpperCase() +
                        verificationData.documentType.slice(1)
                      : "—"
                  }
                />
                <DetailRow
                  label="Document Hash"
                  value={
                    verificationData.documentHashPrefix
                      ? `${verificationData.documentHashPrefix}...`
                      : "—"
                  }
                  mono
                />
                <DetailRow
                  label="Status"
                  value={
                    verificationData.status.charAt(0).toUpperCase() +
                    verificationData.status.slice(1)
                  }
                />
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-stone-500 text-sm">
                <p>The signature ID <span className="font-mono text-xs bg-stone-100 px-1.5 py-0.5 rounded">{signatureId}</span> does not exist.</p>
                <p className="mt-2 text-stone-400">Please check the verification URL and try again.</p>
              </div>
            )}
          </div>

          {/* Signature ID reference */}
          <p className="mt-4 text-center text-xs text-stone-400">
            Signature ID:{" "}
            <span className="font-mono">{signatureId}</span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-4 text-center">
        <p className="text-xs text-stone-400">Powered by Clorefy</p>
      </footer>
    </div>
  )
}

// ── Detail row component ──────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="px-6 py-3.5 flex items-start gap-4">
      <span className="text-sm text-stone-500 w-36 shrink-0">{label}</span>
      <span
        className={`text-sm text-stone-800 break-all ${
          mono ? "font-mono text-xs bg-stone-50 px-1.5 py-0.5 rounded" : "font-medium"
        }`}
      >
        {value}
      </span>
    </div>
  )
}
