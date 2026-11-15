"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Scale, X } from "lucide-react";
import { useCompare } from "./CompareContext";
import { calmTransition } from "@/lib/motion";

export function CompareTray() {
  const { items, removeItem, clearAll } = useCompare();

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={calmTransition}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl bg-white border border-[#C9C9C2] rounded-xl shadow-[0_8px_24px_rgba(26,29,33,0.10)] px-4 py-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <motion.span
                key={items.length}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md font-medium"
              >
                <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                Compare ({items.length}/3)
              </motion.span>
              <AnimatePresence mode="popLayout">
                {items.map((card) => (
                  <motion.span
                    key={card.card_id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.82, y: 4 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-[#1A1D21] bg-[#F3F2EE] border border-[#E4E4DF] rounded-md px-2.5 py-1 max-w-[200px]"
                  >
                    <span className="truncate">{card.card_name}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(card.card_id)}
                      aria-label={`Remove ${card.card_name} from compare`}
                      className="text-[#717882] hover:text-[#1A1D21] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={clearAll}
                className="text-[12.5px] text-[#717882] hover:text-[#1A1D21] px-2 py-1.5 cursor-pointer"
              >
                Clear
              </button>
              <Link
                href={`/compare?ids=${encodeURIComponent(items.map((c) => c.card_id).join(","))}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F5C4D] hover:bg-[#0B473B] px-3.5 py-1.5 rounded-lg transition-colors"
              >
                Compare Side-by-Side
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
