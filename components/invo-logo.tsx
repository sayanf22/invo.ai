export function InvoLogo({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Center circle */}
      <circle cx="36" cy="36" r="5" fill="hsl(18, 60%, 48%)" />
      {/* Petals */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180
        const cx = 36 + Math.cos(angle) * 18
        const cy = 36 + Math.sin(angle) * 18
        return (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx="7"
            ry="4"
            fill="none"
            stroke="hsl(18, 60%, 48%)"
            strokeWidth="2"
            transform={`rotate(${i * 45}, ${cx}, ${cy})`}
          />
        )
      })}
      {/* Inner connecting curves */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180
        const x1 = 36 + Math.cos(angle) * 8
        const y1 = 36 + Math.sin(angle) * 8
        const x2 = 36 + Math.cos(angle) * 24
        const y2 = 36 + Math.sin(angle) * 24
        return (
          <line
            key={`line-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="hsl(18, 60%, 48%)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
