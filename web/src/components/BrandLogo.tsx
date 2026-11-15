import React from "react";

interface BrandLogoProps {
  showTagline?: boolean;
  size?: "sm" | "md";
  cardCount?: number;
  bankCount?: number;
}

export function BrandLogo({
  showTagline = false,
  size = "md",
  cardCount = 509,
  bankCount = 37,
}: BrandLogoProps) {
  const iconSize = size === "sm" ? 28 : 34;

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="4" y="6" width="23" height="16" rx="3" fill="#1A1D21" />
        <rect
          x="9"
          y="13"
          width="23"
          height="16"
          rx="3"
          fill="#0F5C4D"
          stroke="#FAF9F6"
          strokeWidth="1.2"
        />
        <path
          d="M24 13V15.5C24 16.0523 24.4477 16.5 25 16.5H27.5C28.0523 16.5 28.5 16.0523 28.5 15.5V13"
          fill="#1A1D21"
        />
        <line
          x1="13"
          y1="23.5"
          x2="27.5"
          y2="23.5"
          stroke="#FAF9F6"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.88"
        />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[18px] tracking-[-0.02em] font-semibold text-[#1A1D21]">
          Cards
          <span className="ml-1.5 text-[11px] font-normal text-[#0F5C4D] tracking-tight align-baseline">
            by cogify
          </span>
        </span>
        {showTagline && (
          <span className="text-[11px] font-normal text-[#717882] mt-0.5">
            {cardCount} Cards · {bankCount} Banks · Clear Fee Math
          </span>
        )}
      </span>
    </span>
  );
}
