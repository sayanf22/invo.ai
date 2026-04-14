"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Shield } from "lucide-react"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null)
  const pinRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus email on mount
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || pin.length !== 6 || isLoading) return

    setIsLoading(true)
    setError(null)
    setLockoutMessage(null)

    try {
      const res = await fetch("/api/admin/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, pin }),
      })

      if (res.ok) {
        router.push("/clorefy-ctrl-8x2m")
        return
      }

      const data = await res.json().catch(() => ({}))

      if (res.status === 429) {
        const until = data.lockedUntil ? new Date(data.lockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""
        setLockoutMessage(`Too many attempts. Try again${until ? ` after ${until}` : " later"}.`)
        setPin("")
      } else {
        setError("Invalid credentials")
        setPin("")
        pinRef.current?.focus()
      }
    } catch {
      setError("Invalid credentials")
      setPin("")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6)
    setPin(value)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-xl p-8 w-full max-w-sm border border-gray-700">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
            <Shield className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white">Admin Access</h1>
            <p className="text-sm text-gray-400 mt-1">Enter your credentials and PIN</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isLoading}
            required
            className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          />
          <input
            ref={pinRef}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="6-digit PIN"
            value={pin}
            onChange={handlePinChange}
            disabled={isLoading}
            className="w-full text-center text-2xl tracking-widest bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          />

          {(error || lockoutMessage) && (
            <p className="text-sm text-red-400 text-center">{error || lockoutMessage}</p>
          )}

          <button
            type="submit"
            disabled={!email || !password || pin.length !== 6 || isLoading}
            className="w-full py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Enter"}
          </button>
        </form>
      </div>
    </div>
  )
}
