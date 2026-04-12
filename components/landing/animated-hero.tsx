"use client"

import { motion } from "framer-motion"
import { type ReactNode } from "react"

interface AnimatedHeroProps {
  children: ReactNode
  className?: string
}

export function AnimatedHero({ children, className }: AnimatedHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
