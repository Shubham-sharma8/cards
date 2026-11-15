"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  Plus,
  ShieldAlert,
  Sparkles,
  Store,
  Wallet,
  X,
} from "lucide-react";
import type { CardSummaryItem } from "@/lib/types";
import type {
  MerchantBrandRecord,
  MerchantDirectoryPayload,
  MerchantStatementVariant,
} from "@/lib/merchants";
import { recommendCardsForMerchant } from "@/lib/merchants";
import { formatInr, matchesTokenizedQuery } from "@/lib/format";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";
import { GooeySearchInput } from "./ui/gooey-input";
import { useExpandableCard } from "./ui/expandable-card";

interface MerchantsClientProps {
  directory: MerchantDirectoryPayload;
  cards: CardSummaryItem[];
}

const SPEND_QUICK_VALUES = [2000, 5000, 10000, 20000, 40000];

const STATUS_BADGE_MAP: Record<
  MerchantBrandRecord["overall_sbi_status"],
  { bg: string; text: string; border: string; label: string }
> = {
  "5% Safe": {
    bg: "bg-[#EEF5F2]",
    text: "text-[#0F5C4D]",
    border: "border-[#0F5C4D]/25",
    label: "SBI 5% Safe",
  },
  "Mixed — Check Statement Name": {
    bg: "bg-[#FEF6EA]",
    text: "text-[#9A5B13]",
    border: "border-[#9A5B13]/30",
    label: "Mixed — Check Statement",
  },
  "0% Exempt": {
    bg: "bg-[#FEE2E2]/70",
    text: "text-[#991B1B]",
    border: "border-[#991B1B]/25",
    label: "SBI 0% Exempt",
  },
  "Check Status": {
    bg: "bg-[#F3F2EE]",
    text: "text-[#4B525C]",
    border: "border-[#E4E4DF]",
    label: "Verify Descriptor",
  },
};

function BrandAvatar({
  brand,
  size = "md",
}: {
  brand: MerchantBrandRecord;
  size?: "sm" | "md" | "lg";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const dim =
    size === "lg"
      ? "w-12 h-12 text-[16px]"
      : size === "md"
        ? "w-10 h-10 text-[13px]"
        : "w-8 h-8 text-[11px]";

  const initials = brand.brand_name
    .split(/[\s/&()-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  if (brand.logo_path && !imgFailed) {
    return (
      <div
        className={`${dim} rounded-xl bg-white border border-[#E4E4DF] p-1.5 flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <Image
          src={`/${brand.logo_path}`}
          alt={`${brand.brand_name} logo`}
          width={40}
          height={40}
          unoptimized
          className="w-full h-full object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-xl bg-[#EEF5F2] border border-[#0F5C4D]/20 text-[#0F5C4D] font-semibold flex items-center justify-center shrink-0`}
    >
      {initials || "MC"}
    </div>
  );
}

export function MerchantsClient({ directory, cards }: MerchantsClientProps) {
  const { ownedIds, toggleOwned } = useCompare();
  const { openCard } = useExpandableCard();

  const [query, setQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "5_safe" | "0_exempt" | "mixed"
  >("all");
  const [monthlySpendInr, setMonthlySpendInr] = useState<number>(10000);
  const [selectedBrandSlug, setSelectedBrandSlug] = useState<string>(
    directory.brands[0]?.brand_slug ?? "amazon"
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const cardMap = useMemo(() => {
    const m = new Map<string, CardSummaryItem>();
    for (const c of cards) m.set(c.card_id, c);
    return m;
  }, [cards]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { All: directory.brands.length };
    for (const b of directory.brands) {
      counts[b.primary_segment] = (counts[b.primary_segment] || 0) + 1;
    }
    return counts;
  }, [directory.brands]);

  const statusCounts = useMemo(() => {
    let safe = 0;
    let exempt = 0;
    let mixed = 0;
    for (const b of directory.brands) {
      if (b.overall_sbi_status === "5% Safe") safe++;
      else if (b.overall_sbi_status === "0% Exempt") exempt++;
      else if (b.overall_sbi_status === "Mixed — Check Statement Name") mixed++;
    }
    return { safe, exempt, mixed };
  }, [directory.brands]);

  const filteredBrands = useMemo(() => {
    return directory.brands.filter((b) => {
      if (selectedSegment !== "All" && b.primary_segment !== selectedSegment) {
        return false;
      }
      if (statusFilter === "5_safe" && b.overall_sbi_status !== "5% Safe") {
        return false;
      }
      if (statusFilter === "0_exempt" && b.overall_sbi_status !== "0% Exempt") {
        return false;
      }
      if (
        statusFilter === "mixed" &&
        b.overall_sbi_status !== "Mixed — Check Statement Name"
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const descriptorText = b.variants
        .map(
          (v) =>
            `${v.platform_label} ${v.statement_descriptor} ${v.sbi_exemption_category ?? ""} ${v.probable_mcc ?? ""} ${v.payment_page_tip ?? ""} ${v.comment ?? ""}`
        )
        .join(" ");
      const hay = `${b.brand_name} ${b.domain} ${b.primary_segment} ${b.sbi_exemption_reason ?? ""} ${b.payment_watchout} ${descriptorText}`;
      return matchesTokenizedQuery(hay, query);
    });
  }, [directory.brands, selectedSegment, statusFilter, query]);

  const activeBrand = useMemo(() => {
    return (
      filteredBrands.find((b) => b.brand_slug === selectedBrandSlug) ||
      directory.brands.find((b) => b.brand_slug === selectedBrandSlug) ||
      filteredBrands[0] ||
      directory.brands[0]
    );
  }, [filteredBrands, directory.brands, selectedBrandSlug]);

  const activeVariant: MerchantStatementVariant = useMemo(() => {
    if (!activeBrand) {
      throw new Error("Merchant directory is empty");
    }
    return (
      activeBrand.variants.find((v) => v.variant_id === selectedVariantId) ||
      activeBrand.variants[0]
    );
  }, [activeBrand, selectedVariantId]);

  const activeRec = useMemo(() => {
    if (!activeBrand || !activeVariant) return null;
    return recommendCardsForMerchant({
      brand: activeBrand,
      variant: activeVariant,
      allCards: cards,
      ownedIds,
      monthlySpendInr,
    });
  }, [activeBrand, activeVariant, cards, ownedIds, monthlySpendInr]);

  const selectBrand = (brand: MerchantBrandRecord, openDrawer = false) => {
    setSelectedBrandSlug(brand.brand_slug);
    setSelectedVariantId(brand.variants[0]?.variant_id ?? null);
    if (openDrawer) setMobileDetailOpen(true);
  };

  const detailContent = activeBrand && activeVariant && activeRec && (
    <div className="space-y-5">
      {/* Brand Summary Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandAvatar brand={activeBrand} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] font-medium text-[#1A1D21] truncate">
                {activeBrand.brand_name}
              </h2>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE_MAP[activeBrand.overall_sbi_status].bg} ${STATUS_BADGE_MAP[activeBrand.overall_sbi_status].text} ${STATUS_BADGE_MAP[activeBrand.overall_sbi_status].border}`}
              >
                {STATUS_BADGE_MAP[activeBrand.overall_sbi_status].label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-[#717882]">
              <span>{activeBrand.primary_segment}</span>
              <span>·</span>
              <a
                href={activeBrand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0F5C4D] hover:underline"
              >
                {activeBrand.domain}
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
        {mobileDetailOpen && (
          <button
            type="button"
            onClick={() => setMobileDetailOpen(false)}
            className="lg:hidden p-1.5 rounded-lg border border-[#E4E4DF] text-[#4B525C] hover:bg-[#F3F2EE]"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Watchout / SBI Exemption Explanation */}
      <div
        className={`rounded-xl p-3.5 border text-[12.5px] leading-relaxed flex items-start gap-2.5 ${
          activeBrand.overall_sbi_status === "0% Exempt"
            ? "bg-[#FEE2E2]/50 border-[#991B1B]/25 text-[#7F1D1D]"
            : activeBrand.has_descriptor_trap
              ? "bg-[#FEF6EA] border-[#9A5B13]/25 text-[#7C470D]"
              : "bg-[#EEF5F2]/75 border-[#0F5C4D]/20 text-[#1A1D21]"
        }`}
      >
        {activeBrand.overall_sbi_status === "0% Exempt" ? (
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#991B1B]" />
        ) : activeBrand.has_descriptor_trap ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#9A5B13]" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0F5C4D]" />
        )}
        <div className="space-y-1">
          <div className="font-medium">
            {activeBrand.sbi_exemption_reason
              ? `SBI Cashback Rule: Exempt (${activeBrand.sbi_exemption_reason})`
              : activeBrand.has_descriptor_trap
                ? "Payment Page / Billing Descriptor Watchout"
                : "Verified Eligible Online MCC"}
          </div>
          <p>{activeBrand.payment_watchout}</p>
        </div>
      </div>

      {/* Step 1: Verified Statement Descriptors */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-[#1A1D21] uppercase tracking-[0.04em]">
            1. Select Statement / Payment Descriptor ({activeBrand.variants.length})
          </h3>
          <span className="text-[11px] text-[#717882]">
            Tap row to simulate card return
          </span>
        </div>

        <div className="space-y-2">
          {activeBrand.variants.map((v) => {
            const isSelected = v.variant_id === activeVariant.variant_id;
            const rateColor =
              v.sbi_cashback_status === "5%"
                ? "bg-[#EEF5F2] text-[#0F5C4D] border-[#0F5C4D]/25"
                : v.sbi_cashback_status === "0% Exempt"
                  ? "bg-[#FEE2E2]/80 text-[#991B1B] border-[#991B1B]/25"
                  : "bg-[#F3F2EE] text-[#4B525C] border-[#E4E4DF]";
            return (
              <button
                key={v.variant_id}
                type="button"
                onClick={() => setSelectedVariantId(v.variant_id)}
                className={`w-full text-left rounded-xl p-3 border transition-colors ${
                  isSelected
                    ? "bg-white border-[#0F5C4D] ring-1 ring-[#0F5C4D]"
                    : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#C9C9C2]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#1A1D21]">
                      {v.platform_label}
                    </div>
                    <div className="font-mono text-[11.5px] text-[#4B525C] mt-0.5 break-all">
                      {v.statement_descriptor}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md border font-medium shrink-0 ${rateColor}`}
                  >
                    SBI CB: {v.sbi_cashback_status}
                  </span>
                </div>

                {(v.sbi_exemption_category || v.probable_mcc || v.payment_page_tip) && (
                  <div className="mt-2 pt-2 border-t border-[#E4E4DF]/80 flex flex-wrap items-center gap-2 text-[11.5px] text-[#717882]">
                    {v.probable_mcc && (
                      <span className="bg-white border border-[#E4E4DF] px-1.5 py-0.5 rounded text-[#1A1D21] font-mono">
                        MCC {v.probable_mcc}
                      </span>
                    )}
                    {v.sbi_exemption_category && (
                      <span className="text-[#991B1B] font-medium">
                        Exempt: {v.sbi_exemption_category}
                      </span>
                    )}
                    {v.payment_page_tip && (
                      <span className="text-[#4B525C]">{v.payment_page_tip}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Card from YOUR Wallet to Swipe */}
      <div className="space-y-2.5 pt-2 border-t border-[#E4E4DF]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-[#1A1D21] uppercase tracking-[0.04em] flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-[#0F5C4D]" />
            2. Best Card in Your Wallet ({ownedIds.length})
          </h3>
          <span className="text-[11.5px] text-[#717882] tabular-nums">
            At {formatInr(monthlySpendInr)}/mo
          </span>
        </div>

        {ownedIds.length === 0 ? (
          <div className="bg-[#FAF9F6] border border-dashed border-[#C9C9C2] rounded-xl p-4 text-[13px] text-[#4B525C] space-y-2">
            <p>
              Add the credit cards you currently own in <strong>My Cards</strong> to see
              exact swipe priority &amp; traps for this descriptor.
            </p>
            <Link
              href="/my-cards"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#0F5C4D] hover:underline"
            >
              Add your cards in My Cards
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : activeRec.topOwned.length > 0 ? (
          <div className="space-y-2">
            {activeRec.topOwned.slice(0, 3).map((match, idx) => (
              <div
                key={match.card.card_id}
                className={`rounded-xl p-3 border ${
                  idx === 0
                    ? "bg-[#EEF5F2]/80 border-[#0F5C4D]/35"
                    : "bg-[#FAF9F6] border-[#E4E4DF]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <BankLogo
                      bankSlug={match.card.bank_slug}
                      bank={match.card.bank}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] uppercase tracking-[0.04em] font-semibold px-1.5 py-0.5 rounded bg-white border border-[#E4E4DF] text-[#1A1D21]">
                          {idx === 0 ? "Swipe First" : idx === 1 ? "Backup" : "Alt Owned"}
                        </span>
                        <button
                          type="button"
                          onClick={() => openCard(match.card)}
                          className="text-[13.5px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] truncate text-left"
                        >
                          {match.card.card_name}
                        </button>
                      </div>
                      <p className="text-[12px] text-[#4B525C] mt-1">{match.reason}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div
                      className={`text-[14px] font-semibold ${
                        match.isSbiExemptZero || match.effectivePct === 0
                          ? "text-[#991B1B]"
                          : "text-[#0F5C4D]"
                      }`}
                    >
                      {match.effectivePct.toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-[#717882]">
                      +{formatInr(match.monthlyRewardInr)}/mo
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Step 3: Portfolio Upgrade Recommendation */}
      <div className="space-y-2.5 pt-2 border-t border-[#E4E4DF]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-[#1A1D21] uppercase tracking-[0.04em] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#0F5C4D]" />
            3. Best Card to Add / Top Market Picks
          </h3>
          {activeRec.bestPortfolioAddition && activeRec.incrementalAnnualGainInr > 0 && (
            <span className="text-[11.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded-full tabular-nums">
              +{formatInr(activeRec.incrementalAnnualGainInr)}/yr boost
            </span>
          )}
        </div>

        <div className="space-y-2">
          {activeRec.topMarket.slice(0, 4).map((match) => {
            const isAlreadyOwned = ownedSet.has(match.card.card_id);
            const cFull = cardMap.get(match.card.card_id) || match.card;
            return (
              <div
                key={match.card.card_id}
                className="rounded-xl p-3 border border-[#E4E4DF] bg-[#FAF9F6] flex items-start justify-between gap-2.5"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <BankLogo
                    bankSlug={match.card.bank_slug}
                    bank={match.card.bank}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={`/${match.card.bank_slug}/${match.card.card_slug}`}
                        className="text-[13px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] truncate"
                      >
                        {match.card.card_name}
                      </Link>
                      {isAlreadyOwned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF5F2] text-[#0F5C4D] border border-[#0F5C4D]/25 font-medium">
                          Owned
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[#4B525C] mt-0.5">{match.reason}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-[#717882]">
                      <span>
                        Fee:{" "}
                        {cFull.annual_fee_inr === 0
                          ? "₹0 LTF"
                          : formatInr(cFull.annual_fee_inr)}
                      </span>
                      {!isAlreadyOwned && (
                        <button
                          type="button"
                          onClick={() => toggleOwned(cFull.card_id)}
                          className="inline-flex items-center gap-1 text-[#0F5C4D] font-medium hover:underline"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Wallet
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  <div className="text-[13.5px] font-semibold text-[#0F5C4D]">
                    {match.effectivePct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-[#717882]">
                    +{formatInr(match.annualRewardInr)}/yr
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeRec.specialHackNote && (
          <div className="rounded-xl p-3 bg-[#EEF5F2] border border-[#0F5C4D]/25 text-[12px] text-[#0F5C4D] flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Voucher / Stack Workaround: </span>
              {activeRec.specialHackNote}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Page Hero */}
      <div className="bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-7 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] border border-[#0F5C4D]/20 px-2.5 py-1 rounded-full">
              <Store className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {directory.total_brands} Brands · {directory.total_descriptors} Verified
                Billing Descriptors
              </span>
            </div>
            <h1 className="text-[26px] sm:text-[32px] font-medium tracking-[-0.02em] text-[#1A1D21]">
              Merchant &amp; Statement MCC Advisor
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#4B525C] leading-relaxed">
              Check whether an app or checkout descriptor triggers{" "}
              <strong className="font-medium text-[#1A1D21]">
                SBI Cashback 5% vs 0% MCC exemption
              </strong>{" "}
              (Insurance, Utilities, Railways, Rent, Jewellery, Wallet) before you pay — and
              see the highest-yielding card from your{" "}
              <Link href="/my-cards" className="text-[#0F5C4D] underline underline-offset-2">
                My Cards wallet ({ownedIds.length})
              </Link>{" "}
              or best upgrade to add.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/my-cards"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-xl border border-[#E4E4DF] bg-[#FAF9F6] text-[#1A1D21] hover:border-[#0F5C4D] transition-colors"
            >
              <Wallet className="w-4 h-4 text-[#0F5C4D]" />
              Clear Wallet Clutter ({ownedIds.length})
            </Link>
          </div>
        </div>

        {/* Search + Monthly Spend Bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-[#E4E4DF]">
          <div className="lg:col-span-7 space-y-2">
            <label
              htmlFor="merchant-search-input"
              className="block text-[12px] font-medium text-[#4B525C]"
            >
              Search Brand, Payment Page Descriptor, or Exemption Category
            </label>
            <GooeySearchInput
              value={query}
              onChange={setQuery}
              placeholder="e.g. Cleartrip, WWW PHONEPE COM, AMAZON PAY INDIA, Acko, Tanishq..."
            />
          </div>

          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-[#4B525C]">
                Monthly Spend on This Merchant
              </span>
              <span className="font-semibold text-[#0F5C4D] tabular-nums">
                {formatInr(monthlySpendInr)}/mo ({formatInr(monthlySpendInr * 12)}/yr)
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={50000}
              step={1000}
              value={monthlySpendInr}
              onChange={(e) => setMonthlySpendInr(Number(e.target.value))}
              aria-label="Monthly spend on merchant"
              className="w-full accent-[#0F5C4D] cursor-pointer"
            />
            <div className="flex flex-wrap gap-1.5">
              {SPEND_QUICK_VALUES.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setMonthlySpendInr(amt)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border tabular-nums transition-colors ${
                    monthlySpendInr === amt
                      ? "bg-[#0F5C4D] text-white border-[#0F5C4D]"
                      : "bg-[#FAF9F6] text-[#4B525C] border-[#E4E4DF] hover:border-[#0F5C4D]/40"
                  }`}
                >
                  {formatInr(amt)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Status Filter Pills + Spend Segments */}
        <div className="space-y-2.5 pt-2 border-t border-[#E4E4DF]">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                {
                  id: "all",
                  label: `All Statuses (${directory.brands.length})`,
                },
                {
                  id: "5_safe",
                  label: `SBI 5% Safe (${statusCounts.safe})`,
                },
                {
                  id: "0_exempt",
                  label: `0% Exempt Traps (${statusCounts.exempt})`,
                },
                {
                  id: "mixed",
                  label: `Mixed Descriptor (${statusCounts.mixed})`,
                },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                className={`text-[12px] px-3 py-1.5 rounded-lg border transition-colors ${
                  statusFilter === pill.id
                    ? "bg-[#1A1D21] text-white border-[#1A1D21]"
                    : "bg-[#FAF9F6] text-[#4B525C] border-[#E4E4DF] hover:border-[#1A1D21]/30"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {["All", ...directory.segments].map((seg) => {
              const count = segmentCounts[seg] ?? 0;
              const active = selectedSegment === seg;
              return (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSelectedSegment(seg)}
                  className={`text-[11.5px] px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-[#0F5C4D] text-white border-[#0F5C4D]"
                      : "bg-white text-[#4B525C] border-[#E4E4DF] hover:border-[#0F5C4D]/40"
                  }`}
                >
                  {seg} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Merchant List / Grid */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-[12.5px] text-[#717882]">
            <span>
              Showing <strong className="text-[#1A1D21]">{filteredBrands.length}</strong>{" "}
              merchants matching filter
            </span>
            <span className="hidden sm:inline">
              Click any merchant to inspect exact statement descriptors &amp; winning cards
            </span>
          </div>

          {filteredBrands.length === 0 ? (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-8 text-center space-y-2">
              <p className="text-[15px] font-medium text-[#1A1D21]">
                No merchants matched &ldquo;{query}&rdquo;
              </p>
              <p className="text-[13px] text-[#717882]">
                Try clearing filters or searching part of the statement string like{" "}
                <code className="bg-[#FAF9F6] px-1.5 py-0.5 rounded">PHONEPE</code> or{" "}
                <code className="bg-[#FAF9F6] px-1.5 py-0.5 rounded">AMAZON</code>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedSegment("All");
                  setStatusFilter("all");
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5C4D] text-white text-[12.5px]"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredBrands.map((brand) => {
                const isSelected = activeBrand?.brand_slug === brand.brand_slug;
                const primaryVariant = brand.variants[0];
                const recPreview = recommendCardsForMerchant({
                  brand,
                  variant: primaryVariant,
                  allCards: cards,
                  ownedIds,
                  monthlySpendInr,
                });
                const winner = recPreview.bestOwned || recPreview.topMarket[0];
                const badge = STATUS_BADGE_MAP[brand.overall_sbi_status];

                return (
                  <button
                    key={brand.brand_slug}
                    type="button"
                    onClick={() => selectBrand(brand, true)}
                    className={`text-left rounded-xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-white border-[#0F5C4D] ring-1 ring-[#0F5C4D] shadow-[0_6px_20px_rgba(15,92,77,0.08)]"
                        : "bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/50"
                    }`}
                  >
                    <div className="space-y-2.5 w-full">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrandAvatar brand={brand} size="md" />
                          <div className="min-w-0">
                            <div className="text-[14.5px] font-medium text-[#1A1D21] truncate">
                              {brand.brand_name}
                            </div>
                            <div className="text-[11.5px] text-[#717882] truncate">
                              {brand.primary_segment} · {brand.variants.length}{" "}
                              {brand.variants.length === 1 ? "descriptor" : "descriptors"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10.5px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {brand.overall_sbi_status === "Mixed — Check Statement Name"
                            ? "Mixed"
                            : brand.overall_sbi_status}
                        </span>
                      </div>

                      <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[#4B525C] truncate">
                        {primaryVariant.statement_descriptor}
                      </div>
                    </div>

                    {winner && (
                      <div className="pt-2 border-t border-[#E4E4DF]/80 flex items-center justify-between gap-2 w-full text-[11.5px]">
                        <span className="inline-flex items-center gap-1 text-[#4B525C] truncate">
                          <CreditCard className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" />
                          <span className="truncate">
                            {recPreview.bestOwned ? "Use" : "Best"}:{" "}
                            <strong className="text-[#1A1D21]">
                              {winner.card.card_name}
                            </strong>
                          </span>
                        </span>
                        <span className="font-semibold text-[#0F5C4D] tabular-nums shrink-0">
                          {winner.effectivePct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Desktop Sticky Advisor Panel */}
        <aside className="hidden lg:block lg:col-span-5 sticky top-20 bg-white border border-[#E4E4DF] rounded-2xl p-5 shadow-[0_8px_30px_rgba(26,29,33,0.05)] max-h-[calc(100vh-6rem)] overflow-y-auto">
          {detailContent}
        </aside>
      </div>

      {/* Mobile Drawer Modal for Selected Merchant */}
      {mobileDetailOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setMobileDetailOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[88vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl border border-[#E4E4DF] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailContent}
          </div>
        </div>
      )}
    </div>
  );
}
