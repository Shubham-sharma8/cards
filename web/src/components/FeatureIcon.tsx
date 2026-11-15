"use client";

import React from "react";
import Image from "next/image";
import { resolveMediaUrl } from "@/lib/mediaCdn";

export type CanvaIconKey =
  | "travel"
  | "lounge"
  | "rewards"
  | "welcome"
  | "cashback"
  | "fuel"
  | "shopping"
  | "forex"
  | "golf"
  | "insurance"
  | "upi"
  | "dining"
  | "grocery"
  | "devaluation"
  | "wallet"
  | "mitc";

export const CANVA_ICON_PATH: Record<CanvaIconKey, string> = {
  travel: "/icons/canva/travel.png",
  lounge: "/icons/canva/lounge.png",
  rewards: "/icons/canva/rewards.png",
  welcome: "/icons/canva/welcome.png",
  cashback: "/icons/canva/cashback.png",
  fuel: "/icons/canva/fuel.png",
  shopping: "/icons/canva/shopping.png",
  forex: "/icons/canva/forex.png",
  golf: "/icons/canva/golf.png",
  insurance: "/icons/canva/insurance.png",
  upi: "/icons/canva/upi.png",
  dining: "/icons/canva/dining.png",
  grocery: "/icons/canva/grocery.png",
  devaluation: "/icons/canva/devaluation.png",
  wallet: "/icons/canva/wallet.png",
  mitc: "/icons/canva/mitc.png",
};

interface CanvaFeatureIconProps {
  icon: CanvaIconKey;
  size?: number;
  alt?: string;
  className?: string;
}

export function CanvaFeatureIcon({
  icon,
  size = 18,
  alt = "",
  className = "",
}: CanvaFeatureIconProps) {
  return (
    <Image
      src={resolveMediaUrl(CANVA_ICON_PATH[icon]) || CANVA_ICON_PATH[icon]}
      alt={alt}
      width={size}
      height={size}
      aria-hidden={alt === "" ? true : undefined}
      className={`object-contain shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

interface CanvaFeaturePillProps {
  icon: CanvaIconKey;
  label: string;
  active?: boolean;
  tone?: "blue" | "neutral";
}

export function CanvaFeaturePill({
  icon,
  label,
  tone = "blue",
}: CanvaFeaturePillProps) {
  const palette =
    tone === "blue"
      ? "bg-[#F3F6FF] border-[#D7E2FF] text-[#1A1D21]"
      : "bg-[#FAF9F6] border-[#E4E4DF] text-[#1A1D21]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] ${palette}`}
    >
      <CanvaFeatureIcon icon={icon} size={15} />
      <span>{label}</span>
    </span>
  );
}

export function resolveBenefitCanvaIcon(titleOrText: string): CanvaIconKey {
  const t = titleOrText.toLowerCase();
  if (t.includes("mitc") || t.includes("terms") || t.includes("schedule") || t.includes("policy")) {
    return "mitc";
  }
  if (t.includes("devaluat") || t.includes("warning") || t.includes("capping") || t.includes("revision")) {
    return "devaluation";
  }
  if (t.includes("wallet") || t.includes("portfolio")) {
    return "wallet";
  }
  if (t.includes("insur") || t.includes("shield") || t.includes("air accident") || t.includes("cover")) {
    return "insurance";
  }
  if (t.includes("upi") || t.includes("rupay") || t.includes("scan") || t.includes("gpay") || t.includes("phonepe")) {
    return "upi";
  }
  if (t.includes("dining") || t.includes("restaurant") || t.includes("swiggy") || t.includes("zomato") || t.includes("eazydiner")) {
    return "dining";
  }
  if (t.includes("grocer") || t.includes("instamart") || t.includes("blinkit") || t.includes("zepto") || t.includes("bigbasket")) {
    return "grocery";
  }
  if (t.includes("golf") || t.includes("green fee") || t.includes("tee-off") || t.includes("tee off")) {
    return "golf";
  }
  if (t.includes("welcome") || t.includes("joining") || t.includes("gift") || t.includes("voucher")) {
    return "welcome";
  }
  if (t.includes("lounge") || t.includes("priority pass") || t.includes("railway")) {
    return "lounge";
  }
  if (t.includes("fuel") || t.includes("petrol") || t.includes("diesel") || t.includes("surcharge")) {
    return "fuel";
  }
  if (t.includes("forex") || t.includes("international") || t.includes("currency") || t.includes("markup")) {
    return "forex";
  }
  if (t.includes("cashback") || t.includes("bill") || t.includes("utility")) {
    return "cashback";
  }
  if (t.includes("shop") || t.includes("amazon") || t.includes("flipkart") || t.includes("myntra") || t.includes("movie")) {
    return "shopping";
  }
  if (t.includes("travel") || t.includes("flight") || t.includes("hotel") || t.includes("airline") || t.includes("miles")) {
    return "travel";
  }
  return "rewards";
}

export function resolveCategoryCanvaIcon(categoryIdOrName: string): CanvaIconKey {
  const t = categoryIdOrName.toLowerCase();
  if (t.includes("golf")) return "golf";
  if (t.includes("dining") || t.includes("restaurant")) return "dining";
  if (t.includes("grocer") || t.includes("supermarket")) return "grocery";
  if (t.includes("insur")) return "insurance";
  if (t.includes("rupay") || t.includes("upi")) return "upi";
  if (t.includes("fuel")) return "fuel";
  if (t.includes("lounge")) return "lounge";
  if (t.includes("forex")) return "forex";
  if (t.includes("travel") || t.includes("miles")) return "travel";
  if (
    t.includes("cashback") ||
    t.includes("ltf") ||
    t.includes("lifetime free") ||
    t.includes("utilit") ||
    t.includes("beginner") ||
    t.includes("entry")
  ) {
    return "cashback";
  }
  if (t.includes("gold") || t.includes("jewel") || t.includes("tax") || t.includes("business")) {
    return "rewards";
  }
  if (t.includes("shop") || t.includes("movie")) {
    return "shopping";
  }
  return "rewards";
}
