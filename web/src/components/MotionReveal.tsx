"use client";

import React from "react";
import { motion } from "motion/react";
import { LEDGER_EASE, calmTransition } from "@/lib/motion";

export function MotionRevealCard({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ ...calmTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedMeterBar({
  percent,
  barClassName,
  trackClassName = "h-1.5 bg-[#F3F2EE] rounded-full overflow-hidden",
}: {
  percent: number;
  barClassName: string;
  trackClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={trackClassName}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${clamped}%` }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.52, ease: LEDGER_EASE }}
        className={`h-full rounded-full ${barClassName}`}
      />
    </div>
  );
}
