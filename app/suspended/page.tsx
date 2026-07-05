"use client"

import { useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { ShieldAlert } from "lucide-react"

export default function SuspendedPage() {
  // Sign the suspended user out so their session can't keep loading the app.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.signOut().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <ClorefyLogo size={52} />
        </div>

        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Account suspended</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been suspended and you no longer have access to Clorefy.
            If you believe this is a mistake, please reach out and we'll review it.
          </p>
        </div>

        <a
          href="mailto:support@clorefy.com"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Contact support@clorefy.com
        </a>

        <p className="text-xs text-muted-foreground">
          <Link href="/" className="underline hover:text-foreground">
            Return to homepage
          </Link>
        </p>
      </div>
    </div>
  )
}
