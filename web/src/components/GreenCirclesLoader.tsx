import React from "react";

interface GreenCirclesLoaderProps {
  label?: string;
  fullScreen?: boolean;
  size?: "sm" | "md" | "lg";
}

const DOT_SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "w-2.5 h-2.5",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const GAP_SIZES: Record<"sm" | "md" | "lg", string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3.5",
};

/**
 * Three-circle emerald loader rendered across three distinct green shades:
 * Deep Pine (#0F5C4D), Vibrant Emerald (#16A34A), and Fresh Mint (#4ADE80).
 */
export function GreenCirclesLoader({
  label = "Loading Cards by cogify…",
  fullScreen = false,
  size = "lg",
}: GreenCirclesLoaderProps) {
  const dotClass = DOT_SIZES[size];
  const gapClass = GAP_SIZES[size];

  const inner = (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="inline-flex flex-col items-center justify-center gap-3.5"
    >
      <div className={`flex items-center justify-center ${gapClass}`}>
        <span
          className={`${dotClass} rounded-full animate-bounce shadow-sm`}
          style={{
            backgroundColor: "#0F5C4D",
            animationDelay: "0ms",
            animationDuration: "900ms",
          }}
        />
        <span
          className={`${dotClass} rounded-full animate-bounce shadow-sm`}
          style={{
            backgroundColor: "#16A34A",
            animationDelay: "160ms",
            animationDuration: "900ms",
          }}
        />
        <span
          className={`${dotClass} rounded-full animate-bounce shadow-sm`}
          style={{
            backgroundColor: "#4ADE80",
            animationDelay: "320ms",
            animationDuration: "900ms",
          }}
        />
      </div>
      {label ? (
        <span className="text-[13px] font-medium tracking-tight text-[#4B525C]">
          {label}
        </span>
      ) : null}
    </div>
  );

  if (!fullScreen) {
    return inner;
  }

  return (
    <div className="min-h-[65vh] w-full flex flex-col items-center justify-center bg-[#FAF9F6] px-4 py-16">
      <div className="rounded-2xl bg-white border border-[#E4E4DF] px-8 py-7 shadow-sm flex flex-col items-center gap-4">
        <div className="text-[15px] font-semibold tracking-tight text-[#0F5C4D]">
          Cards by cogify
        </div>
        {inner}
      </div>
    </div>
  );
}
