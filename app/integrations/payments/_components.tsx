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
// Razorpay: Navy #012652 bg, "R" lightning bolt mark (official brand colors from razorpay.com/newsroom/brand-assets)
// Stripe:   Purple #635BFF bg, "S" wordmark shape (official brand)
// Cashfree: Green #00A550 bg, "C" with arrow mark (official brand)

export function RazorpayLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 32L16 8H24C29.5 8 33 11 33 16.5C33 21 30 24 25.5 25.5L33 32H26L19.5 26H15L13 32H8ZM15 21H22C25 21 27 19.5 27 16.5C27 13.5 25 12 22 12H16.5L15 21Z" fill="white"/>
    </svg>
  )
}

export function StripeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.5 14.5C20.5 13.4 21.4 12.8 22.8 12.8C24.6 12.8 26.3 13.5 27.5 14.4L28.9 10.6C27.4 9.5 25.2 8.8 22.7 8.8C18.5 8.8 15.6 11.1 15.6 14.8C15.6 21.4 24.5 20.2 24.5 23.4C24.5 24.7 23.4 25.4 21.8 25.4C19.6 25.4 17.6 24.5 16.3 23.2L14.8 27.1C16.4 28.5 18.9 29.3 21.6 29.3C26.1 29.3 29.2 27 29.2 23.1C29.2 16.2 20.5 17.5 20.5 14.5Z" fill="white"/>
    </svg>
  )
}

export function CashfreeLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27 12C24.5 9.5 21 8 17 8C9.8 8 4 13.8 4 21C4 28.2 9.8 34 17 34C21 34 24.5 32.5 27 30" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M23 17L29 21L23 25" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <line x1="29" y1="21" x2="17" y2="21" stroke="white" strokeWidth="3" strokeLinecap="round"/>
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
