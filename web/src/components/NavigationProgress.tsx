"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

/**
 * Slim top route-navigation progress bar that pulses smoothly whenever internal navigation occurs.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        target.target !== "_blank" &&
        href !== pathname
      ) {
        setActive(true);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setActive(false), 260);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={pathname}
          aria-hidden="true"
          initial={{ scaleX: 0.08, opacity: 1 }}
          animate={{ scaleX: 0.92, opacity: 1 }}
          exit={{ scaleX: 1, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 h-[2.5px] z-50 origin-left bg-[#0F5C4D]"
        />
      )}
    </AnimatePresence>
  );
}
