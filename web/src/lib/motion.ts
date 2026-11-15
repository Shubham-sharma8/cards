import type { Variants, Transition } from "motion/react";

export const LEDGER_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const calmTransition: Transition = {
  duration: 0.26,
  ease: LEDGER_EASE,
};

export const fastTransition: Transition = {
  duration: 0.18,
  ease: LEDGER_EASE,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 26,
  mass: 0.85,
};

export const panelRevealVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: calmTransition,
  },
};

export const sectionRevealProps = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 as const },
  transition: { duration: 0.38, ease: LEDGER_EASE },
};

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

export const modalSurfaceVariants: Variants = {
  hidden: { opacity: 0, scale: 0.985, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: calmTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 4,
    transition: fastTransition,
  },
};
