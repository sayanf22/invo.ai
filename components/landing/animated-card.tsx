"use client"

import { motion, type Variants } from "framer-motion"
import { type ReactNode } from "react"

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
}

const cardVariants: Variants = {
  hidden: (custom: { y: number }) => ({
    opacity: 0,
    y: custom.y,
  }),
  visible: (custom: { duration: number; delay: number }) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: custom.duration,
      delay: custom.delay,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
}

export function AnimatedCard({
  children,
  className,
  delay = 0,
  duration = 0.6,
  y = 40,
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      custom={{ y, duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
