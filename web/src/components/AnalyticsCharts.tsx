"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { LEDGER_EASE } from "@/lib/motion";

export interface BarDatum {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue: string;
  color?: string;
  href?: string;
  extraNote?: string;
}

const DEFAULT_PALETTE = [
  "#0F5C4D",
  "#1D4ED8",
  "#B45309",
  "#7C3AED",
  "#0369A1",
  "#15803D",
  "#374151",
  "#C2410C",
  "#0E7490",
  "#4338CA",
];

interface CategoryMultiBarChartProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  unitSuffix?: string;
  height?: number;
}

export function CategoryMultiBarChart({
  title,
  subtitle,
  data,
  height = 240,
}: CategoryMultiBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = useMemo(() => {
    const rawMax = Math.max(0.5, ...data.map((d) => (Number.isFinite(d.value) && d.value > 0 ? d.value : 0)));
    return rawMax * 1.18;
  }, [data]);

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;
  const needsScroll = data.length > 7;

  if (data.length === 0) return null;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
          {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
        </div>
        {activeItem ? (
          <div className="bg-[#FAF9F6] border border-[#0F5C4D]/35 rounded-lg px-3 py-1.5 text-[12px] flex items-center gap-2 shadow-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor:
                  activeItem.value < 0
                    ? "#B91C1C"
                    : activeItem.color || DEFAULT_PALETTE[hoveredIdx! % DEFAULT_PALETTE.length],
              }}
            />
            <span className="font-medium text-[#1A1D21]">{activeItem.label}</span>
            {activeItem.sublabel && <span className="text-[#717882]">· {activeItem.sublabel}</span>}
            <span
              className={`font-semibold tabular-nums ${
                activeItem.value < 0 ? "text-[#B91C1C]" : "text-[#0F5C4D]"
              }`}
            >
              {activeItem.displayValue}
            </span>
            {activeItem.href && (
              <Link href={activeItem.href} className="text-[#0F5C4D] inline-flex items-center hover:underline">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-[#717882] bg-[#FAF9F6] border border-[#E4E4DF] px-2.5 py-1 rounded-md">
            Hover or tap bar for detail
          </span>
        )}
      </div>

      {/* Responsive Bar Chart Grid */}
      <div className="relative pt-4 pb-1 overflow-x-auto">
        <div style={needsScroll ? { minWidth: Math.max(580, data.length * 64) } : undefined}>
          {/* Horizontal dotted reference lines */}
          <div
            className="relative flex items-end gap-2 sm:gap-3 border-b border-[#D5D7D0] px-1 sm:px-2"
            style={{ height }}
          >
            {[0.25, 0.5, 0.75].map((pct) => (
              <div
                key={pct}
                style={{ bottom: `${pct * 100}%` }}
                className="absolute left-0 right-0 border-t border-dashed border-[#E4E4DF] pointer-events-none"
              />
            ))}

            {data.map((d, idx) => {
              const isNegative = Number.isFinite(d.value) && d.value < 0;
              const isZero = !Number.isFinite(d.value) || d.value === 0;
              const ratio = isNegative || isZero ? 0 : Math.max(0.05, Math.min(1, d.value / maxVal));
              const color = isNegative
                ? "#DC2626"
                : isZero
                  ? "#CBD5E1"
                  : d.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
              const isHovered = hoveredIdx === idx;
              const usableH = Math.max(40, height - 30);
              const innerHeight = isZero
                ? 3
                : isNegative
                  ? Math.max(8, Math.min(26, Math.round((Math.abs(d.value) / maxVal) * usableH)))
                  : Math.max(6, Math.round(ratio * usableH));

              return (
                <div
                  key={d.id}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setHoveredIdx(idx)}
                  onFocus={() => setHoveredIdx(idx)}
                  className="flex-1 min-w-[40px] h-full flex flex-col items-center justify-end group relative z-10"
                >
                  <span
                    className={`text-[10.5px] sm:text-[11px] font-semibold tabular-nums mb-1 transition-colors text-center leading-tight whitespace-nowrap ${
                      isNegative
                        ? "text-[#B91C1C]"
                        : isZero
                          ? "text-[#94A3B8]"
                          : isHovered
                            ? "text-[#1A1D21]"
                            : "text-[#4B525C]"
                    }`}
                  >
                    {d.displayValue}
                  </span>

                  <motion.div
                    initial={{ height: 3, opacity: 0.75 }}
                    animate={{ height: innerHeight, opacity: hoveredIdx !== null && !isHovered ? 0.55 : 1 }}
                    transition={{ duration: 0.35, delay: Math.min(idx * 0.025, 0.2), ease: LEDGER_EASE }}
                    style={{ backgroundColor: color }}
                    className={`w-full max-w-[42px] relative shadow-xs cursor-pointer ${
                      isNegative ? "rounded-t-xs border border-[#FECACA]" : "rounded-t-md"
                    }`}
                  >
                    {d.href && (
                      <Link
                        href={d.href}
                        aria-label={`${d.label} ${d.displayValue}`}
                        className="absolute inset-0"
                      />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* X-Axis Labels */}
          <div className="flex items-start gap-2 sm:gap-3 px-1 sm:px-2 mt-2">
            {data.map((d, idx) => (
              <div key={`${d.id}-lbl`} className="flex-1 min-w-[40px] text-center">
                {d.href ? (
                  <Link
                    href={d.href}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    className="block text-[10.5px] font-medium text-[#4B525C] hover:text-[#0F5C4D] leading-tight line-clamp-2"
                  >
                    {d.label}
                  </Link>
                ) : (
                  <span className="block text-[10.5px] font-medium text-[#4B525C] leading-tight line-clamp-2">
                    {d.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
