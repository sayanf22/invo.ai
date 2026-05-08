"use client";
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * FlipWords — rotating gradient-clipped words.
 *
 * Design decision: No drop-shadow on gradient text.
 * Modern SaaS heroes (Linear, Vercel, Stripe, Framer) use clean gradient
 * text without offset shadows — the gradient itself is the visual accent.
 * Applying `filter: drop-shadow` on gradient-clipped text also creates
 * rendering issues in Chrome/Safari where it can fight with -webkit-
 * background-clip and the framer-motion blur animation.
 */
export const FlipWords = ({
  words,
  gradients,
  duration = 3000,
  className,
}: {
  words: string[];
  gradients?: string[];
  duration?: number;
  className?: string;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentWord = words[currentIndex];
  const currentGradient = gradients?.[currentIndex % gradients.length];

  const startAnimation = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % words.length);
    setIsAnimating(true);
  }, [words.length]);

  useEffect(() => {
    if (!isAnimating) {
      const t = setTimeout(startAnimation, duration);
      return () => clearTimeout(t);
    }
  }, [isAnimating, duration, startAnimation]);

  return (
    <AnimatePresence mode="wait" onExitComplete={() => setIsAnimating(false)}>
      <motion.span
        key={currentWord}
        initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={cn("inline-block relative", className)}
        style={
          currentGradient
            ? {
                backgroundImage: currentGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : undefined
        }
      >
        {currentWord}
      </motion.span>
    </AnimatePresence>
  );
};
