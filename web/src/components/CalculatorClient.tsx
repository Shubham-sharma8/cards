"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useFullCards, useFullR2Json } from "@/lib/useCatalog";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, Check, ChevronDown, ChevronUp, Info, Plus } from "lucide-react";
import type { CardSummaryItem, RewardConversionStrategy, SpendCategoryKey } from "@/lib/types";
import { CONVERSION_STRATEGIES, applyConversionStrategy } from "@/lib/conversion";
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  cardLocalImageUrl,
  formatInr,
} from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { LEDGER_EASE, fastTransition } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";
import {
  CategoryMultiBarChart,
  GradientStackedAreaChart,
  LineRaceChart,
} from "./AnalyticsCharts";
import {
  build12MonthLineRace,
  buildCalculatorCategoryStackedData,
} from "@/lib/chartDataBuilders";
import { SearchParamsSync } from "./SearchParamsSync";

export interface CardCalcExtraMeta {
  fee_waiver_spend_inr: number | null;
  monthly_capping_rules: string[];
  earn_unit: string;
  point_value_inr_default: number;
}

interface CalculatorClientProps {
  cards: CardSummaryItem[];
  extraByCardId: Record<string, CardCalcExtraMeta>;
  totalCardCount?: number;
}

const PRESETS: Record<
  string,
  { label: string; desc: string; spends: Partial<Record<SpendCategoryKey, number>> }
> = {
  salaried: {
    label: "Salaried Urban (₹50k/mo)",
    desc: "Online shopping, Swiggy/Zomato, quick groceries, UPI, utilities, fuel",
    spends: {
      online_shopping_general: 7000,
      amazon_flipkart_myntra: 8000,
      dining_swiggy_zomato: 5000,
      groceries_quick_commerce: 6000,
      travel_flights_hotels: 6000,
      upi_scan_and_pay: 6000,
      utilities_bills_telecom: 4000,
      fuel: 3000,
      insurance: 2000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 3000,
    },
  },
  online: {
    label: "Heavy Online Shopper (₹80k/mo)",
    desc: "Concentrated Amazon, Flipkart, D2C & food delivery spend",
    spends: {
      online_shopping_general: 20000,
      amazon_flipkart_myntra: 25000,
      dining_swiggy_zomato: 9000,
      groceries_quick_commerce: 10000,
      travel_flights_hotels: 6000,
      upi_scan_and_pay: 4000,
      utilities_bills_telecom: 4000,
      fuel: 0,
      insurance: 0,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 2000,
    },
  },
  flyer: {
    label: "Frequent Flyer & Forex (₹1.6L/mo)",
    desc: "Flights, hotels, international FX spend, dining, and insurance",
    spends: {
      online_shopping_general: 15000,
      amazon_flipkart_myntra: 12000,
      dining_swiggy_zomato: 14000,
      groceries_quick_commerce: 8000,
      travel_flights_hotels: 50000,
      upi_scan_and_pay: 5000,
      utilities_bills_telecom: 6000,
      fuel: 5000,
      insurance: 10000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 25000,
      offline_general_other: 10000,
    },
  },
  upi: {
    label: "Everyday UPI & Bills (₹28k/mo)",
    desc: "Kirana QR scans, groceries, mobile/electricity bills, fuel",
    spends: {
      online_shopping_general: 2000,
      amazon_flipkart_myntra: 3000,
      dining_swiggy_zomato: 2500,
      groceries_quick_commerce: 4500,
      travel_flights_hotels: 0,
      upi_scan_and_pay: 9000,
      utilities_bills_telecom: 3500,
      fuel: 2500,
      insurance: 0,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 1000,
    },
  },
};

export function CalculatorClient({
  cards: initialCards,
  extraByCardId: initialExtra,
  totalCardCount,
}: CalculatorClientProps) {
  const cards = useFullCards(initialCards);
  const extraByCardId = useFullR2Json(
    "meta/calculator_extra_meta.json",
    initialExtra,
    initialCards.length < 400
  );
  const displayTotalCards = totalCardCount ? Math.max(totalCardCount, cards.length) : cards.length;
  const { isSelected, toggleItem } = useCompare();

  const [spends, setSpends] = useState<Record<SpendCategoryKey, number>>(() => {
    const out = {} as Record<SpendCategoryKey, number>;
    for (const k of SPEND_CATEGORY_KEYS) {
      out[k] = PRESETS.salaried.spends[k] ?? SPEND_CATEGORY_META[k].defaultMonthlyInr;
    }
    return out;
  });

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    const pKey = sp.get("preset");
    if (pKey && PRESETS[pKey]) {
      const pObj = PRESETS[pKey];
      const out = {} as Record<SpendCategoryKey, number>;
      for (const k of SPEND_CATEGORY_KEYS) {
        out[k] = pObj.spends[k] ?? SPEND_CATEGORY_META[k].defaultMonthlyInr;
      }
      setSpends(out);
    }
  }, []);

  const [onlyLtf, setOnlyLtf] = useState(false);
  const [onlyRupay, setOnlyRupay] = useState(false);
  const [onlyLounge, setOnlyLounge] = useState(false);
  const [includeGstFee, setIncludeGstFee] = useState(true);
  const [autoWaiveFee, setAutoWaiveFee] = useState(true);
  const [conversionStrategy, setConversionStrategy] =
    useState<RewardConversionStrategy>("default_inr");
  const [bankFilter, setBankFilter] = useState("all");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const totalMonthlySpend = useMemo(
    () => SPEND_CATEGORY_KEYS.reduce((acc, k) => acc + (spends[k] || 0), 0),
    [spends]
  );
  const totalAnnualSpend = totalMonthlySpend * 12;

  const bankList = useMemo(() => {
    return Array.from(new Set(cards.map((c) => c.bank))).sort();
  }, [cards]);

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    const next = {} as Record<SpendCategoryKey, number>;
    for (const k of SPEND_CATEGORY_KEYS) {
      next[k] = p.spends[k] ?? 0;
    }
    setSpends(next);
  };

  const rankedCards = useMemo(() => {
    const rows = cards
      .filter((c) => {
        if (onlyLtf && !c.filter_tags.is_ltf) return false;
        if (onlyRupay && !c.filter_tags.is_rupay_upi) return false;
        if (onlyLounge && !c.filter_tags.has_domestic_lounge) return false;
        if (bankFilter !== "all" && c.bank !== bankFilter) return false;
        return true;
      })
      .map((card) => {
        const extra = extraByCardId[card.card_id];
        const rates = card.effective_return_pct_by_category;
        const breakdown = SPEND_CATEGORY_KEYS.map((k) => {
          const monthlySpend = spends[k] || 0;
          const pct = rates?.[k] ?? 0;
          const monthlyValue = (monthlySpend * pct) / 100;
          return {
            key: k,
            label: SPEND_CATEGORY_META[k].shortLabel,
            monthlySpend,
            pct,
            annualValue: monthlyValue * 12,
          };
        });

        const rawAnnualGrossReward = breakdown.reduce((s, b) => s + b.annualValue, 0);
        const conversionResult = applyConversionStrategy(
          card,
          conversionStrategy,
          rawAnnualGrossReward
        );
        const annualGrossReward = conversionResult.effectiveAnnualRewardsInr;
        const waiverThreshold = extra?.fee_waiver_spend_inr ?? null;
        const feeWaived =
          card.annual_fee_inr === 0 ||
          (autoWaiveFee && waiverThreshold !== null && totalAnnualSpend >= waiverThreshold);
        const feeMultiplier = includeGstFee ? 1.18 : 1.0;
        const effectiveAnnualFee = feeWaived ? 0 : Math.round(card.annual_fee_inr * feeMultiplier);
        const netAnnualBenefit = annualGrossReward - effectiveAnnualFee;
        const netYieldPct =
          totalAnnualSpend > 0 ? (netAnnualBenefit / totalAnnualSpend) * 100 : 0;

        return {
          card,
          extra,
          breakdown,
          annualGrossReward,
          conversionResult,
          effectiveAnnualFee,
          feeWaived,
          waiverThreshold,
          netAnnualBenefit,
          netYieldPct,
        };
      })
      .sort((a, b) => b.netAnnualBenefit - a.netAnnualBenefit);

    return rows;
  }, [
    cards,
    extraByCardId,
    spends,
    onlyLtf,
    onlyRupay,
    onlyLounge,
    bankFilter,
    includeGstFee,
    autoWaiveFee,
    conversionStrategy,
    totalAnnualSpend,
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <SearchParamsSync onParams={syncFromParams} />
      <div className="border-b border-[#E4E4DF] pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md mb-2">
            <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
            Real Spend-to-Cashback Calculator
          </span>
          <h1 className="text-[26px] sm:text-[30px] font-medium tracking-[-0.015em] text-[#1A1D21]">
            Find which card nets the most rupees for your spend
          </h1>
          <p className="text-[14px] text-[#4B525C] mt-1 max-w-2xl">
            Every card is evaluated using its effective rupee redemption value per category
            (including forex markup drag and GST on annual fees). Expand any card to inspect
            monthly caps before applying.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="hidden sm:block relative w-[112px] h-[74px] rounded-xl overflow-hidden border border-[#E4E4DF] bg-[#FAF9F6] shrink-0">
            <Image
              src={resolveMediaUrl("/illustrations/rewards-compass-3d.webp") || "/illustrations/rewards-compass-3d.webp"}
              alt="3D studio illustration of metallic credit card, reward tokens, and compass"
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
          <div className="bg-white border border-[#E4E4DF] rounded-xl px-4 py-3 flex items-center gap-6 shrink-0 tabular-nums">
          <div>
            <span className="block text-[11.5px] text-[#717882]">Monthly Spend</span>
            <span className="text-[18px] font-medium text-[#1A1D21]">
              {formatInr(totalMonthlySpend)}
            </span>
          </div>
          <div className="h-8 w-px bg-[#E4E4DF]" />
          <div>
            <span className="block text-[11.5px] text-[#717882]">Annual Spend</span>
            <span className="text-[18px] font-medium text-[#0F5C4D]">
              {formatInr(totalAnnualSpend)}
            </span>
          </div>
          </div>
        </div>
      </div>

      {/* Presets Strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-[#717882] mr-1">Load preset:</span>
        {Object.entries(PRESETS).map(([key, p]) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="px-3 py-1.5 text-[12.5px] bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/50 hover:bg-[#EEF5F2]/50 text-[#1A1D21] rounded-lg transition-colors cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Spend Inputs */}
        <div className="lg:col-span-5 bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-5 lg:sticky lg:top-20">
          <div className="flex items-center justify-between border-b border-[#E4E4DF] pb-3">
            <h2 className="text-[16px] font-medium text-[#1A1D21]">
              Monthly Spend Breakdown
            </h2>
            <button
              type="button"
              onClick={() =>
                setSpends(
                  Object.fromEntries(SPEND_CATEGORY_KEYS.map((k) => [k, 0])) as Record<
                    SpendCategoryKey,
                    number
                  >
                )
              }
              className="text-[12px] text-[#717882] hover:text-[#1A1D21] cursor-pointer"
            >
              Zero all
            </button>
          </div>

          <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
            {SPEND_CATEGORY_KEYS.map((key) => {
              const meta = SPEND_CATEGORY_META[key];
              const value = spends[key] || 0;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`spend-${key}`}
                      className="text-[13px] font-medium text-[#1A1D21]"
                    >
                      {meta.label}
                    </label>
                    <div className="flex items-center gap-1 bg-[#FAF9F6] border border-[#E4E4DF] rounded-md px-2 py-1">
                      <span className="text-[12px] text-[#717882]">₹</span>
                      <input
                        id={`spend-${key}`}
                        type="number"
                        min={0}
                        step={500}
                        value={value}
                        onChange={(e) =>
                          setSpends((prev) => ({
                            ...prev,
                            [key]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-20 text-right text-[13px] text-[#1A1D21] bg-transparent focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>
                  <input
                    aria-label={`${meta.label} slider`}
                    type="range"
                    min={0}
                    max={meta.maxSliderInr}
                    step={500}
                    value={Math.min(value, meta.maxSliderInr)}
                    onChange={(e) =>
                      setSpends((prev) => ({
                        ...prev,
                        [key]: Number(e.target.value),
                      }))
                    }
                    className="w-full ledger-range"
                  />
                  <p className="text-[11.5px] text-[#717882]">{meta.hint}</p>
                </div>
              );
            })}
          </div>

          {/* Calculation Settings */}
          <div className="pt-4 border-t border-[#E4E4DF] space-y-2.5 text-[13px]">
            <div className="space-y-1.5 pb-2 border-b border-[#E4E4DF]">
              <p className="text-[12.5px] font-medium text-[#4B525C]">
                Reward Conversion Strategy
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {CONVERSION_STRATEGIES.map((st) => {
                  const active = conversionStrategy === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setConversionStrategy(st.id)}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#EEF5F2] border-[#0F5C4D]/55 text-[#0F5C4D] font-medium"
                          : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/40"
                      }`}
                    >
                      {st.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-[12.5px] font-medium text-[#4B525C]">
              Fee &amp; Eligibility Rules
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoWaiveFee}
                onChange={(e) => setAutoWaiveFee(e.target.checked)}
                className="w-4 h-4 accent-[#0F5C4D]"
              />
              <span>Auto-waive annual fee if annual spend meets waiver target</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeGstFee}
                onChange={(e) => setIncludeGstFee(e.target.checked)}
                className="w-4 h-4 accent-[#0F5C4D]"
              />
              <span>Include 18% GST on annual fee</span>
            </label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  checked={onlyLtf}
                  onChange={(e) => setOnlyLtf(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#0F5C4D]"
                />
                <span>LTF only</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  checked={onlyRupay}
                  onChange={(e) => setOnlyRupay(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#0F5C4D]"
                />
                <span>RuPay UPI</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12.5px]">
                <input
                  type="checkbox"
                  checked={onlyLounge}
                  onChange={(e) => setOnlyLounge(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#0F5C4D]"
                />
                <span>Lounge</span>
              </label>
            </div>
            <div className="pt-1">
              <label htmlFor="calc-bank" className="block text-[12px] text-[#717882] mb-1">
                Filter by issuer
              </label>
              <select
                id="calc-bank"
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg"
              >
                <option value="all">All {bankList.length} Banks ({displayTotalCards})</option>
                {bankList.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Ranked Results */}
        <div className="lg:col-span-7 space-y-4">
          {rankedCards.length >= 2 && (
            <div className="space-y-4">
              <CategoryMultiBarChart
                title="Top 8 Cards by Net Annual Benefit on Your Spend"
                subtitle="Post-cap reward value minus annual fee (including GST if enabled)."
                data={rankedCards.slice(0, 8).map((r) => ({
                  id: r.card.card_id,
                  label: r.card.card_name.replace(/Credit Card/gi, "").trim(),
                  sublabel: r.card.bank,
                  value: Math.round(r.netAnnualBenefit),
                  displayValue: formatInr(Math.round(r.netAnnualBenefit)),
                  href: `/${r.card.bank_slug}/${r.card.card_slug}`,
                }))}
                height={185}
              />

              {(() => {
                const winner = rankedCards[0];
                const stacked = buildCalculatorCategoryStackedData(
                  winner.breakdown,
                  winner.effectiveAnnualFee
                );
                const race = build12MonthLineRace(
                  rankedCards.slice(0, 4).map((r) => ({
                    id: r.card.card_id,
                    name: r.card.card_name.replace(/Credit Card/gi, "").trim(),
                    annualGrossInr: r.annualGrossReward,
                    effectiveFeeInr: r.effectiveAnnualFee,
                  }))
                );
                return (
                  <div className="grid grid-cols-1 gap-4">
                    <GradientStackedAreaChart
                      title={`Reward Composition Across Spend Scale (${winner.card.card_name})`}
                      subtitle="Gradient stacked area showing how your top categories build annual rewards vs fee line as monthly spend scales."
                      xLabels={stacked.xLabels}
                      series={stacked.series}
                      valueUnit="₹"
                      markLineY={stacked.feeLine > 0 ? stacked.feeLine : undefined}
                      markLineLabel={
                        stacked.feeLine > 0
                          ? `Fee ${formatInr(stacked.feeLine)}`
                          : undefined
                      }
                      height={260}
                    />
                    <LineRaceChart
                      title="12-Month Cumulative Net Profit Race (Top 4 Ranked Cards)"
                      subtitle="Starts after Month-1 renewal fee deduction and races net ₹ value earned across 12 billing cycles."
                      xLabels={race.xLabels}
                      series={race.series}
                      height={260}
                    />
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex items-center justify-between text-[13px] text-[#4B525C] px-1">
            <span>
              Top matches from <span className="text-[#1A1D21] font-medium">{rankedCards.length}</span>{" "}
              cards (showing top 25)
            </span>
            <span className="hidden sm:inline text-[12px] text-[#717882]">
              Sorted by Net Annual Benefit (₹)
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {rankedCards.slice(0, 25).map((row, idx) => {
              const { card, extra } = row;
              const imgSrc = resolveMediaUrl(cardLocalImageUrl(card.local_image_path));
              const expanded = expandedCardId === card.card_id;
              const compared = isSelected(card.card_id);
              const topNet = Math.max(1, rankedCards[0]?.netAnnualBenefit ?? 1);
              const barPct =
                row.netAnnualBenefit > 0
                  ? Math.min(100, Math.round((row.netAnnualBenefit / topNet) * 100))
                  : 0;

              return (
                <motion.div
                  key={card.card_id}
                  layout="position"
                  initial={{ opacity: 0, y: 6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={fastTransition}
                  className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden transition-colors hover:border-[#0F5C4D]/45"
                >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#F3F2EE] text-[#4B525C] text-[12.5px] font-medium flex items-center justify-center shrink-0 tabular-nums">
                      #{idx + 1}
                    </span>

                    <div className="relative w-[78px] h-[50px] rounded-md bg-[#F3F2EE] border border-[#E4E4DF] overflow-hidden shrink-0 flex items-center justify-center">
                      {imgSrc ? (
                        <Image
                          src={imgSrc}
                          alt={card.card_name}
                          fill
                          sizes="78px"
                          className="object-contain p-0.5"
                        />
                      ) : (
                        <span className="text-[10px] text-[#717882] px-1 text-center leading-tight">
                          {card.bank}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                        <p className="text-[12px] text-[#717882]">{card.bank}</p>
                      </div>
                      <Link
                        href={`/${card.bank_slug}/${card.card_slug}`}
                        className="text-[15.5px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] leading-snug block"
                      >
                        {card.card_name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-[#4B525C]">
                        <span>{extra?.earn_unit || "Reward Points"}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {card.annual_fee_inr === 0
                            ? "₹0 LTF"
                            : row.feeWaived
                            ? `Fee ₹${card.annual_fee_inr.toLocaleString("en-IN")} waived`
                            : `Fee -${formatInr(row.effectiveAnnualFee)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Metrics */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 tabular-nums">
                    <div className="text-left sm:text-right">
                      <span className="block text-[11.5px] text-[#717882]">
                        {row.conversionResult.supportsStrategy &&
                        row.conversionResult.convertedUnitsPerYear > 0
                          ? `Net Value (${row.conversionResult.unitLabel})`
                          : "Net Annual Profit"}
                      </span>
                      <span
                        className={`text-[19px] font-medium ${
                          row.netAnnualBenefit >= 0 ? "text-[#0F5C4D]" : "text-[#991B1B]"
                        }`}
                      >
                        {formatInr(row.netAnnualBenefit)}/yr
                      </span>
                      {row.conversionResult.supportsStrategy &&
                        row.conversionResult.convertedUnitsPerYear > 0 && (
                          <span className="block text-[11.5px] font-medium text-[#0F5C4D]">
                            ~{row.conversionResult.convertedUnitsPerYear.toLocaleString("en-IN")}{" "}
                            {row.conversionResult.unitLabel}/yr
                          </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="px-2 py-0.5 rounded bg-[#EEF5F2] text-[#0F5C4D]">
                        {row.netYieldPct.toFixed(2)}% net
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCardId(expanded ? null : card.card_id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E4E4DF] text-[#4B525C] hover:text-[#1A1D21] cursor-pointer"
                      >
                        Math
                        {expanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleItem({
                            card_id: card.card_id,
                            card_name: card.card_name,
                            bank: card.bank,
                            bank_slug: card.bank_slug,
                            card_slug: card.card_slug,
                            annual_fee_inr: card.annual_fee_inr,
                            overall_rating: card.overall_rating,
                          })
                        }
                        aria-label={`Compare ${card.card_name}`}
                        className={`p-1.5 rounded-md border cursor-pointer ${
                          compared
                            ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                            : "border-[#E4E4DF] text-[#4B525C]"
                        }`}
                      >
                        {compared ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="w-full sm:w-36 h-1 bg-[#F3F2EE] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.35, ease: LEDGER_EASE }}
                        className="h-full rounded-full bg-[#0F5C4D]"
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Math & Cap Advisory Drawer */}
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={fastTransition}
                      className="overflow-hidden border-t border-[#E4E4DF] bg-[#FAF9F6]"
                    >
                      <div className="px-4 sm:px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px] tabular-nums">
                      <div>
                        <span className="block text-[#717882]">Gross Rewards / yr</span>
                        <span className="font-medium text-[#1A1D21]">
                          {formatInr(row.annualGrossReward)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#717882]">Annual Fee Applied</span>
                        <span className="font-medium text-[#1A1D21]">
                          {row.effectiveAnnualFee === 0
                            ? "₹0"
                            : `-${formatInr(row.effectiveAnnualFee)}`}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#717882]">Fee Waiver Target</span>
                        <span className="font-medium text-[#1A1D21]">
                          {row.waiverThreshold ? formatInr(row.waiverThreshold) : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#717882]">1 Point Value</span>
                        <span className="font-medium text-[#1A1D21]">
                          ₹{extra?.point_value_inr_default ?? 1}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px] tabular-nums">
                        <thead>
                          <tr className="text-left text-[#717882] border-b border-[#E4E4DF]">
                            <th className="py-1.5 font-medium">Category</th>
                            <th className="py-1.5 font-medium text-right">Monthly Spend</th>
                            <th className="py-1.5 font-medium text-right">Eff. Rate</th>
                            <th className="py-1.5 font-medium text-right">Annual Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4DF]/60">
                          {row.breakdown
                            .filter((b) => b.monthlySpend > 0)
                            .map((b) => (
                              <tr key={b.key}>
                                <td className="py-1.5 text-[#1A1D21]">{b.label}</td>
                                <td className="py-1.5 text-right text-[#4B525C]">
                                  {formatInr(b.monthlySpend)}
                                </td>
                                <td
                                  className={`py-1.5 text-right ${
                                    b.pct < 0 ? "text-[#991B1B]" : "text-[#0F5C4D]"
                                  }`}
                                >
                                  {b.pct.toFixed(2)}%
                                </td>
                                <td
                                  className={`py-1.5 text-right font-medium ${
                                    b.annualValue < 0 ? "text-[#991B1B]" : "text-[#1A1D21]"
                                  }`}
                                >
                                  {formatInr(b.annualValue)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {extra?.monthly_capping_rules && extra.monthly_capping_rules.length > 0 && (
                      <div className="bg-[#FEF6EA] border border-[#EED9B7] rounded-lg p-3 text-[12.5px] text-[#7A460D] flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="font-medium">Monthly Capping &amp; Exclusion Notes</p>
                          <ul className="list-disc pl-4 mt-1 space-y-0.5">
                            {extra.monthly_capping_rules.slice(0, 3).map((rule, i) => (
                              <li key={i}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                      <div className="flex justify-end">
                        <Link
                          href={`/${card.bank_slug}/${card.card_slug}`}
                          className="text-[13px] font-medium text-[#0F5C4D] hover:underline"
                        >
                          Open full card dossier &amp; fee terms →
                        </Link>
                      </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
