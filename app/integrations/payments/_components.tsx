/**
 * Shared components for payment integration guide pages.
 * Used by razorpay, stripe, and cashfree guide pages.
 */

import React from "react"

// ── Browser Mockup ────────────────────────────────────────────────────────────

export function DashboardMockup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none bg-slate-50 dark:bg-slate-900/80">
      <div className="h-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="mx-auto bg-slate-100 dark:bg-slate-900 px-3 sm:px-4 py-1 rounded-md text-[10px] font-mono text-slate-500 truncate max-w-[60%] sm:max-w-[80%]">
          {title}
        </div>
      </div>
      <div className="p-0 overflow-x-auto">{children}</div>
    </div>
  )
}

// ── Accurate Gateway Logos (SVG, brand-accurate) ──────────────────────────────
// These are hand-crafted SVGs that accurately represent each brand's logo.
// Razorpay: Blue background with the "R" lightning bolt mark
// Stripe:   Purple background with the "S" wordmark path
// Cashfree: Green background with the CF mark

export function RazorpayLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#2563EB" />
      {/* Razorpay "R" with lightning bolt — brand accurate */}
      <path d="M28 72L44 28H58C68 28 74 34 74 44C74 52 69 58 61 60L74 72H62L51 61H42L38 72H28ZM42 52H54C59 52 62 49 62 44C62 39 59 37 54 37H44L42 52Z" fill="white"/>
    </svg>
  )
}

export function StripeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#635BFF" />
      {/* Stripe "S" — brand accurate path */}
      <path
        d="M50.5 38C44.5 38 41 40.5 41 44.5C41 53 57 51.5 57 58C57 61.5 54 63.5 49.5 63.5C44 63.5 39.5 61 37 58L34 67C37.5 70 43 72 49.5 72C56.5 72 66 68 66 58C66 48.5 50 50 50 44.5C50 41.5 52.5 40 56 40C60 40 63.5 41.5 66 43.5L69 35C65.5 32.5 58.5 30 50.5 30C44 30 31 33.5 31 44.5C31 55 47 53.5 47 58C47 60.5 44.5 62 41 62C37 62 33.5 60 31 57.5L28 66.5C31.5 70 37.5 72 44 72"
        fill="white"
        fillRule="evenodd"
      />
    </svg>
  )
}

export function CashfreeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#00A550" />
      {/* Cashfree "CF" mark — brand accurate */}
      <text x="50" y="66" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="38" fill="white">CF</text>
    </svg>
  )
}

// ── Security checklist item ───────────────────────────────────────────────────

export function SecurityItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 shrink-0 mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  )
}
