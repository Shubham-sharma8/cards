"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cardLocalImageUrl } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import type { CardTheme } from "@/lib/types";

interface CardArtworkProps {
  localImagePath: string | null | undefined;
  cardName: string;
  bank: string;
  network?: string;
  size?: "sm" | "md" | "lg";
  cardTheme?: CardTheme | null;
  showSplash?: boolean;
}

export function CardArtwork({
  localImagePath,
  cardName,
  bank,
  network,
  size = "md",
  cardTheme,
  showSplash = false,
}: CardArtworkProps) {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(cardLocalImageUrl(localImagePath));

  const boxClass =
    size === "sm"
      ? "w-[76px] h-[48px]"
      : size === "lg"
      ? "w-full max-w-[320px] aspect-[1.586/1]"
      : "w-[116px] h-[73px]";

  const splashColor = cardTheme?.wash_hex || cardTheme?.primary_hex || "#D7E2FF";
  const surfaceBg =
    showSplash && cardTheme?.soft_bg_hex ? cardTheme.soft_bg_hex : "#F3F2EE";
  const borderColor =
    showSplash && cardTheme?.border_hex ? cardTheme.border_hex : "#E4E4DF";

  const artworkNode =
    src && !failed ? (
      <div
        className={`${boxClass} relative rounded-lg overflow-hidden shrink-0 flex items-center justify-center`}
        style={{ backgroundColor: surfaceBg, border: `1px solid ${borderColor}` }}
      >
        <Image
          src={src}
          alt={`${cardName} artwork`}
          fill
          sizes={size === "lg" ? "320px" : size === "sm" ? "76px" : "116px"}
          onError={() => setFailed(true)}
          className="object-contain p-1"
        />
      </div>
    ) : (
      <div
        className={`${boxClass} relative rounded-lg overflow-hidden shrink-0 flex flex-col justify-between p-2.5 text-[#1A1D21]`}
        style={{ backgroundColor: surfaceBg, border: `1px solid ${borderColor}` }}
        aria-label={`${cardName} card preview`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9.5px] uppercase tracking-wider text-[#4B525C] truncate">
            {bank}
          </span>
          <span className="w-4 h-3 rounded-[2px] border border-[#C9C9C2] bg-[#E8E7E1] shrink-0" />
        </div>
        <div className="flex items-end justify-between gap-1">
          <span
            className={`${
              size === "sm" ? "text-[8.5px]" : size === "lg" ? "text-[13px]" : "text-[10px]"
            } font-medium leading-tight line-clamp-2 text-[#1A1D21]`}
          >
            {cardName}
          </span>
          {network && size !== "sm" && (
            <span className="text-[9px] text-[#717882] shrink-0">{network.split("/")[0]}</span>
          )}
        </div>
      </div>
    );

  if (!showSplash) {
    return artworkNode;
  }

  return (
    <div className="relative inline-flex items-center justify-center w-full max-w-[320px] py-2">
      {/* Subtle organic brush wash behind card matching card_theme */}
      <svg
        viewBox="0 0 360 230"
        fill="none"
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] opacity-55"
      >
        <path
          d="M28 168C10 132 22 68 62 42C102 16 178 14 244 26C300 36 344 74 340 128C336 184 282 212 206 214C132 216 48 208 28 168Z"
          fill={splashColor}
          fillOpacity="0.28"
        />
        <path
          d="M52 184C36 164 68 142 126 154C184 166 258 176 306 162C332 154 328 188 278 202C220 218 74 210 52 184Z"
          fill={cardTheme?.primary_hex || splashColor}
          fillOpacity="0.18"
        />
      </svg>
      <div className="relative z-10 w-full">{artworkNode}</div>
    </div>
  );
}
