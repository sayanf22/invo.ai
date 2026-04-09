"use client"

/**
 * Clorefy SVG Logo — clean line-art style inspired by Claude's icon aesthetic.
 * A stylized document with an AI spark, rendered as pure SVG.
 */
export function ClorefyLogo({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Clorefy"
    >
      {/* Rounded square background */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#1a1a1a" />

      {/* Document shape — folded corner */}
      <path
        d="M15 10h10l8 8v20a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z"
        fill="none"
        stroke="#F5F0E8"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Fold triangle */}
      <path
        d="M25 10v6a2 2 0 0 0 2 2h6"
        fill="none"
        stroke="#F5F0E8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* AI spark / magic wand lines */}
      <circle cx="21" cy="28" r="1.5" fill="#e07b39" />
      <line x1="21" y1="23" x2="21" y2="25" stroke="#e07b39" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="31" x2="21" y2="33" stroke="#e07b39" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="28" x2="18" y2="28" stroke="#e07b39" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="28" x2="26" y2="28" stroke="#e07b39" strokeWidth="1.5" strokeLinecap="round" />

      {/* Diagonal sparks */}
      <line x1="17.5" y1="24.5" x2="18.9" y2="25.9" stroke="#e07b39" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23.1" y1="30.1" x2="24.5" y2="31.5" stroke="#e07b39" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="24.5" y1="24.5" x2="23.1" y2="25.9" stroke="#e07b39" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="18.9" y1="30.1" x2="17.5" y2="31.5" stroke="#e07b39" strokeWidth="1.2" strokeLinecap="round" />

      {/* Text lines on document */}
      <line x1="17" y1="22" x2="23" y2="22" stroke="#F5F0E8" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="17" y1="35" x2="28" y2="35" stroke="#F5F0E8" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

// Backward-compatible alias
export const InvoLogo = ClorefyLogo
