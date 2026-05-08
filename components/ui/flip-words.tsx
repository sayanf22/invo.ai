"use client";
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
    <span
      className="inline-block"
      // drop-shadow is applied on the outer wrapper so it doesn't conflict with
      // framer-motion's blur filter animation. drop-shadow works on gradient-
      // clipped text where text-shadow doesn't render anything.
      style={{
        filter:
          "drop-shadow(3px 3px 0px rgba(26,26,26,0.10)) drop-shadow(0 8px 24px rgba(26,26,26,0.14))",
      }}
    >
      <AnimatePresence mode="wait" onExitComplete={() => setIsAnimating(false)}>
        <motion.span
          key={currentWord}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className={cn("inline-block relative", className)}
        >
          {/* Gradient applied to inner span so it doesn't conflict with framer-motion opacity */}
          <span
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
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
