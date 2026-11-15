"use client";

import React, { useState } from "react";
import { resolveMediaUrl } from "@/lib/mediaCdn";

export interface BankLogoProps {
  bankSlug?: string;
  bank?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SLUG_SIZE_PX: Record<NonNullable<BankLogoProps["size"]>, number> = {
  xs: 18,
  sm: 22,
  md: 28,
  lg: 36,
  xl: 64,
};

const KNOWN_BANK_SLUGS = new Set([
  "american-express",
  "au-small-finance-bank",
  "axis-bank",
  "bandhan-bank",
  "bank-of-india",
  "bank-of-maharashtra",
  "bobcard-bank-of-baroda",
  "canara-bank",
  "central-bank-of-india",
  "csb-bank",
  "dbs-bank",
  "federal-bank-scapia",
  "federal-bank",
  "hdfc-bank",
  "hsbc-bank",
  "icici-bank",
  "idbi-bank",
  "idfc-first-bank",
  "indian-bank",
  "indian-overseas-bank",
  "indusind-bank",
  "karur-vysya-bank",
  "kotak-mahindra-bank",
  "lic-cards-axis-bank",
  "onecard-co-branded",
  "punjab-national-bank",
  "rbl-bank",
  "sbi-card",
  "sbm-bank-india",
  "slice-small-finance-bank",
  "south-indian-bank",
  "standard-chartered-bank",
  "tamilnad-mercantile-bank",
  "uco-bank",
  "union-bank-of-india",
  "unity-small-finance-bank",
  "utkarsh-small-finance-bank",
  "yes-bank",
]);

export function resolveBankSlug(bankSlug?: string, bank?: string): string {
  const direct = (bankSlug || "").toLowerCase().trim();
  if (direct && KNOWN_BANK_SLUGS.has(direct)) return direct;
  const b = (bank || "").toLowerCase().trim();
  if (!b) return "default";
  if (b.includes("hdfc")) return "hdfc-bank";
  if (b.includes("icici")) return "icici-bank";
  if (b.includes("sbi")) return "sbi-card";
  if (b.includes("lic")) return "lic-cards-axis-bank";
  if (b.includes("axis")) return "axis-bank";
  if (b.includes("kotak")) return "kotak-mahindra-bank";
  if (b.includes("indusind")) return "indusind-bank";
  if (b.includes("idfc")) return "idfc-first-bank";
  if (b.includes("yes")) return "yes-bank";
  if (b.includes("american express") || b.includes("amex")) return "american-express";
  if (b.includes("hsbc")) return "hsbc-bank";
  if (b.includes("standard chartered")) return "standard-chartered-bank";
  if (b.includes("rbl")) return "rbl-bank";
  if (b.includes("au small") || b === "au bank") return "au-small-finance-bank";
  if (b.includes("bob") || b.includes("baroda")) return "bobcard-bank-of-baroda";
  if (b.includes("punjab") || b.includes("pnb")) return "punjab-national-bank";
  if (b.includes("scapia")) return "federal-bank-scapia";
  if (b.includes("federal")) return "federal-bank";
  if (b.includes("onecard")) return "onecard-co-branded";
  if (b.includes("dbs")) return "dbs-bank";
  if (b.includes("canara")) return "canara-bank";
  if (b.includes("union bank")) return "union-bank-of-india";
  if (b.includes("bank of india")) return "bank-of-india";
  if (b.includes("maharashtra")) return "bank-of-maharashtra";
  if (b.includes("indian overseas") || b.includes("iob")) return "indian-overseas-bank";
  if (b.includes("indian bank")) return "indian-bank";
  if (b.includes("central bank")) return "central-bank-of-india";
  if (b.includes("idbi")) return "idbi-bank";
  if (b.includes("uco")) return "uco-bank";
  if (b.includes("karur") || b.includes("kvb")) return "karur-vysya-bank";
  if (b.includes("south indian") || b.includes("sib")) return "south-indian-bank";
  if (b.includes("csb")) return "csb-bank";
  if (b.includes("tamilnad") || b.includes("tmb")) return "tamilnad-mercantile-bank";
  if (b.includes("sbm")) return "sbm-bank-india";
  if (b.includes("slice")) return "slice-small-finance-bank";
  if (b.includes("bandhan")) return "bandhan-bank";
  if (b.includes("unity")) return "unity-small-finance-bank";
  if (b.includes("utkarsh")) return "utkarsh-small-finance-bank";
  return "default";
}

function bankInitials(bank?: string, slug?: string): string {
  const src = (bank || slug || "BK").trim();
  const words = src.split(/\s+/).filter((w) => w.length > 0 && w.toLowerCase() !== "of");
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function BankLogo({
  bankSlug,
  bank,
  size = "sm",
  className = "",
}: BankLogoProps) {
  const px = SLUG_SIZE_PX[size];
  const slug = resolveBankSlug(bankSlug, bank);
  const [imgFailed, setImgFailed] = useState(false);

  if (slug === "default" || imgFailed) {
    return (
      <span
        style={{ width: px, height: px }}
        className={`inline-flex items-center justify-center rounded-md bg-[#EEF5F2] border border-[#DCE5E0] text-[#0F5C4D] font-medium shrink-0 select-none ${
          size === "xs" ? "text-[8px]" : size === "sm" ? "text-[9px]" : "text-[11px]"
        } ${className}`}
        aria-hidden="true"
      >
        {bankInitials(bank, bankSlug)}
      </span>
    );
  }

  return (
    <span
      style={{ width: px, height: px }}
      className={`inline-flex items-center justify-center rounded-md bg-white border border-[#E4E4DF] overflow-hidden shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveMediaUrl(`/logos/banks/${slug}.png`) || `/logos/banks/${slug}.png`}
        alt=""
        width={px}
        height={px}
        className="w-full h-full object-contain p-[1px]"
        onError={() => setImgFailed(true)}
      />
    </span>
  );
}
