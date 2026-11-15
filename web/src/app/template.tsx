"use client";

import React from "react";
import { motion } from "motion/react";

/**
 * Smooth page transition wrapper triggered automatically by Next.js App Router on route change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 flex flex-col w-full min-w-0"
    >
      {children}
    </motion.div>
  );
}
