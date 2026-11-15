"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Gift,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import type {
  CardDossier,
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from "@/lib/types";
import { cappedMonthlyCategoryReward } from "@/lib/advisor";
import { applyConversionStrategy, CONVERSION_STRATEGIES } from "@/lib/conversion";
import { formatInr, SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META } from "@/lib/format";
import { CanvaFeatureIcon, type CanvaIconKey } from "./FeatureIcon";

interface InteractiveBenefitExplorerProps {
  dossier: CardDossier;
}

function mapCategoryToCanvaIcon(catKey: SpendCategoryKey): CanvaIconKey {
  switch (catKey) {
    case "amazon_flipkart_myntra":
    case "online_shopping_general":
      return "shopping";
    case "dining_swiggy_zomato":
      return "dining";
    case "groceries_quick_commerce":
      return "grocery";
    case "travel_flights_hotels":
      return "travel";
    case "upi_scan_and_pay":
      return "upi";
    case "fuel":
      return "fuel";
    case "insurance":
      return "insurance";
    case "international_forex_net_of_markup":
      return "forex";
    case "utilities_bills_telecom":
      return "rewards";
    default:
      return "cashback";
  }
}

export function InteractiveBenefitExplorer({ dossier }: InteractiveBenefitExplorerProps) {
  const {
    identity,
    reward_calculator_model: calc,
    fees_and_charges_detailed: fees,
    lounge_access_detailed: lounge,
    benefits_features_and_faqs: benefits,
    filter_tags: tags,
    ratings,
  } = dossier;

  const cardSummary: CardSummaryItem = useMemo(
    () => ({
      card_id: identity.card_id,
      card_name: identity.card_name,
      bank: identity.bank,
      bank_slug: identity.bank_slug,
      card_slug: identity.card_slug,
      primary_category: identity.primary_category,
      categories: identity.categories || [],
      card_network: identity.card_network,
      card_tier: identity.card_tier,
      status: identity.status,
      joining_fee_inr: fees.joining_fee_inr,
      joining_fee_waiver: fees.joining_fee_waiver,
      annual_fee_inr: fees.annual_fee_inr,
      fee_waiver_spend_inr: fees.fee_waiver_spend_inr,
      forex_markup_pct: fees.forex_markup_pct,
      overall_rating: ratings.overall_market_rating,
      local_image_path: dossier.visual_assets.local_image_path,
      image_url: dossier.visual_assets.image_url,
      card_theme: dossier.visual_assets.card_theme,
      filter_tags: tags,
      effective_return_pct_by_category: calc.effective_return_pct_by_category,
      monthly_category_caps_inr: calc.monthly_category_caps_inr,
      category_caveats: calc.category_caveats,
      domestic_lounge_summary: lounge.domestic?.summary ?? null,
      international_lounge_summary: lounge.international?.summary ?? null,
      lounge_spend_condition: lounge.domestic?.spend_criteria ?? null,
      domestic_lounge_accessible_count: lounge.domestic_lounge_accessible_count,
      international_lounge_accessible_count: lounge.international_lounge_accessible_count,
      accessible_lounge_codes: lounge.accessible_lounge_codes,
      accessible_golf_slugs: lounge.accessible_golf_slugs,
      json_path: "",
      md_path: "",
    }),
    [identity, fees, ratings, dossier.visual_assets, tags, calc, lounge]
  );

  const [strategy, setStrategy] = useState<RewardConversionStrategy>("default_inr");

  const strategyMult = useMemo(() => {
    const sample = applyConversionStrategy(cardSummary, strategy, 10000);
    return sample.supportsStrategy ? sample.multiplier : 1;
  }, [cardSummary, strategy]);

  const strategyLabel = useMemo(() => {
    const active = CONVERSION_STRATEGIES.find((s) => s.id === strategy);
    return active?.shortLabel ?? "Default ₹";
  }, [strategy]);

  const rankedZones = useMemo(() => {
    return SPEND_CATEGORY_KEYS.map((key) => {
      const headline = calc.effective_return_pct_by_category?.[key] ?? 0;
      const monthlyCap = calc.monthly_category_caps_inr?.[key] ?? null;
      const adjRate = headline * strategyMult;
      const caveat = calc.category_caveats?.[key] || null;
      return {
        key,
        meta: SPEND_CATEGORY_META[key],
        headline,
        adjRate,
        monthlyCap: typeof monthlyCap === "number" && monthlyCap > 0 ? monthlyCap : null,
        caveat,
      };
    })
      .filter((z) => z.headline > 0)
      .sort((a, b) => b.adjRate - a.adjRate)
      .slice(0, 6);
  }, [calc.effective_return_pct_by_category, calc.monthly_category_caps_inr, calc.category_caveats, strategyMult]);

  const [selectedKey, setSelectedKey] = useState<SpendCategoryKey>(
    () => rankedZones[0]?.key ?? "online_shopping_general"
  );

  const activeZone = useMemo(
    () => rankedZones.find((z) => z.key === selectedKey) ?? rankedZones[0] ?? null,
    [rankedZones, selectedKey]
  );

  const sweetSpotSpend = useMemo(() => {
    if (!activeZone || !activeZone.monthlyCap || activeZone.headline <= 0) return 10000;
    return Math.max(1000, Math.round((activeZone.monthlyCap / activeZone.headline) * 100));
  }, [activeZone]);

  const [monthlySpend, setMonthlySpend] = useState<number>(8000);

  const sliderMax = useMemo(() => {
    const baseMax = Math.max(30000, Math.round(sweetSpotSpend * 2.2));
    return Math.min(200000, Math.ceil(baseMax / 5000) * 5000);
  }, [sweetSpotSpend]);

  const clampedSpend = Math.min(sliderMax, Math.max(500, monthlySpend));

  const zoneEval = useMemo(() => {
    if (!activeZone) return null;
    const raw = cappedMonthlyCategoryReward(cardSummary, activeZone.key, clampedSpend);
    const convMonthly = applyConversionStrategy(cardSummary, strategy, raw.monthlyReward * 12);
    const adjustedMonthlyReward = convMonthly.effectiveAnnualRewardsInr / 12;
    const adjustedAnnualReward = convMonthly.effectiveAnnualRewardsInr;
    const adjustedEffectivePct =
      clampedSpend > 0 ? (adjustedMonthlyReward / clampedSpend) * 100 : raw.effectivePct * strategyMult;
    const capUsedPct = raw.monthlyCapInr
      ? Math.min(100, Math.round((Math.min(raw.monthlyReward, raw.monthlyCapInr) / raw.monthlyCapInr) * 100))
      : 0;
    const spendProgressPct = raw.eligibleSpendBeforeCapInr
      ? Math.min(100, Math.round((clampedSpend / raw.eligibleSpendBeforeCapInr) * 100))
      : 100;
    const isNearCap = Boolean(raw.monthlyCapInr && !raw.capped && spendProgressPct >= 75);
    const headroomInr = raw.monthlyCapInr
      ? Math.max(0, Math.round(raw.monthlyCapInr - Math.min(raw.monthlyReward, raw.monthlyCapInr)))
      : null;
    const overflowSpendInr =
      raw.capped && raw.eligibleSpendBeforeCapInr
        ? Math.max(0, clampedSpend - raw.eligibleSpendBeforeCapInr)
        : 0;

    return {
      ...raw,
      adjustedMonthlyReward,
      adjustedAnnualReward,
      adjustedEffectivePct,
      capUsedPct,
      spendProgressPct,
      isNearCap,
      headroomInr,
      overflowSpendInr,
      ratioText: convMonthly.ratioText,
      supportsStrategy: convMonthly.supportsStrategy,
    };
  }, [activeZone, cardSummary, clampedSpend, strategy, strategyMult]);

  const peakAdjRate = rankedZones[0]?.adjRate ?? 5;

  const welcomeSummaryText = useMemo(() => {
    const wb = benefits.welcome_benefit;
    if (Array.isArray(wb) && wb.length > 0) return wb[0];
    if (typeof wb === "string" && wb.trim().length > 0) return wb;
    if (fees.joining_fee_inr === 0) return "Zero joining fee entry — earn rewards from your very first transaction.";
    return "Joining fee welcome bonus activates on initial fee payment / activation spend.";
  }, [benefits.welcome_benefit, fees.joining_fee_inr]);

  const waiverGateText = useMemo(() => {
    const waiver = fees.fee_waiver_spend_inr;
    const loungeText = lounge.no_spend_domestic_lounge
      ? "Zero spend gate for domestic lounges"
      : lounge.domestic?.spend_criteria || (lounge.has_domestic_lounge ? "Standard card lounge access" : "No complimentary airport lounge");
    if (fees.annual_fee_inr === 0) return `Lifetime Free (₹0/yr) · ${loungeText}`;
    if (waiver && waiver > 0) {
      return `Spend ${formatInr(waiver)}/yr (${formatInr(Math.round(waiver / 12))}/mo) to waive ${formatInr(fees.annual_fee_inr)} fee · ${loungeText}`;
    }
    return `Annual fee ${formatInr(fees.annual_fee_inr)} · ${loungeText}`;
  }, [fees.annual_fee_inr, fees.fee_waiver_spend_inr, lounge]);

  if (rankedZones.length === 0 || !activeZone || !zoneEval) return null;

  const barTone = zoneEval.capped
    ? "from-[#0F5C4D] via-[#D97706] to-[#B45309]"
    : zoneEval.isNearCap
      ? "from-[#0F5C4D] to-[#D97706]"
      : "from-[#0F5C4D] to-[#1D7F6B]";

  return (
    <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-5">
      {/* Section Header + Strategy Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-[#0F5C4D] bg-[#EEF5F2] border border-[#0F5C4D]/20 px-2.5 py-0.5 rounded-md">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Visual Benefit &amp; Cap Explorer
          </span>
          <h2 className="text-[18px] sm:text-[19px] font-medium text-[#1A1D21] mt-1.5">
            Tap any spend zone to see real rewards before &amp; after monthly caps
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CONVERSION_STRATEGIES.map((st) => {
            const active = strategy === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setStrategy(st.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[12px] border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                    : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/40 hover:text-[#1A1D21]"
                }`}
                title={st.hint}
              >
                {st.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clickable Spend-Zone Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {rankedZones.map((zone) => {
          const isSelected = zone.key === activeZone.key;
          const barWidthPct = peakAdjRate > 0 ? Math.max(10, Math.min(100, (zone.adjRate / peakAdjRate) * 100)) : 20;
          return (
            <motion.button
              key={zone.key}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedKey(zone.key);
                if (zone.monthlyCap && zone.headline > 0) {
                  const zoneSweet = Math.max(1000, Math.round((zone.monthlyCap / zone.headline) * 100));
                  setMonthlySpend(Math.min(60000, Math.round(zoneSweet * 0.8 / 500) * 500 || 5000));
                }
              }}
              className={`relative text-left p-3 rounded-xl border transition-all cursor-pointer overflow-hidden ${
                isSelected
                  ? "bg-[#F4FAF7] border-[#0F5C4D] ring-2 ring-[#0F5C4D]/15 shadow-xs"
                  : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#0F5C4D]/45 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <CanvaFeatureIcon icon={mapCategoryToCanvaIcon(zone.key)} size={16} />
                <span
                  className={`text-[14px] font-semibold tabular-nums ${
                    isSelected ? "text-[#0F5C4D]" : "text-[#1A1D21]"
                  }`}
                >
                  {zone.adjRate.toFixed(1)}%
                </span>
              </div>
              <p className="text-[12.5px] font-medium text-[#1A1D21] mt-2 truncate">
                {zone.meta.shortLabel}
              </p>
              <p className="text-[11px] text-[#717882] mt-0.5 truncate">
                {zone.monthlyCap ? `${formatInr(zone.monthlyCap)}/mo cap` : "Uncapped rate"}
              </p>

              {/* Relative rate mini progress meter */}
              <div className="mt-2 h-1.5 w-full bg-[#E4E4DF]/80 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidthPct}%` }}
                  transition={{ duration: 0.35 }}
                  className={`h-full rounded-full ${isSelected ? "bg-[#0F5C4D]" : "bg-[#0F5C4D]/55"}`}
                />
              </div>

              {isSelected && (
                <motion.span
                  layoutId="benefit-zone-active-bar"
                  className="absolute inset-x-0 bottom-0 h-[3px] bg-[#0F5C4D]"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Live Spend vs Monthly Cap Utilization Gauge */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeZone.key}-${strategy}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-medium text-[#1A1D21]">
                  {activeZone.meta.label}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-white border border-[#E4E4DF] text-[#4B525C]">
                  {strategyLabel}
                </span>
              </div>
              <p className="text-[12px] text-[#717882] mt-0.5">
                {activeZone.meta.hint}
                {zoneEval.eligibleSpendBeforeCapInr
                  ? ` · Sweet-spot max spend before cap: ${formatInr(zoneEval.eligibleSpendBeforeCapInr)}/mo`
                  : " · No fixed monthly reward cap on this zone"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "₹2.5k", value: 2500 },
                ...(zoneEval.eligibleSpendBeforeCapInr
                  ? [
                      {
                        label: `Sweet Spot (${formatInr(zoneEval.eligibleSpendBeforeCapInr)})`,
                        value: zoneEval.eligibleSpendBeforeCapInr,
                      },
                      {
                        label: "2× Cap Test",
                        value: Math.min(sliderMax, zoneEval.eligibleSpendBeforeCapInr * 2),
                      },
                    ]
                  : [
                      { label: "₹10k", value: 10000 },
                      { label: "₹25k", value: 25000 },
                    ]),
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setMonthlySpend(preset.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] border transition-colors cursor-pointer ${
                    Math.abs(clampedSpend - preset.value) <= 250
                      ? "bg-[#EEF5F2] border-[#0F5C4D] text-[#0F5C4D] font-medium"
                      : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/40"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Monthly Spend Slider + Visual Cap Saturation Bar */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[13px] tabular-nums">
              <span className="text-[#4B525C]">
                Simulated Monthly Spend:{" "}
                <strong className="text-[#1A1D21] text-[15px]">{formatInr(clampedSpend)}</strong>
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                  zoneEval.capped
                    ? "text-[#B45309]"
                    : zoneEval.isNearCap
                      ? "text-[#9A5B13]"
                      : "text-[#0F5C4D]"
                }`}
              >
                {zoneEval.capped ? (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                    Cap Maxed · {formatInr(zoneEval.overflowSpendInr)} overflow at base rate
                  </>
                ) : zoneEval.monthlyCapInr ? (
                  <>
                    <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                    {zoneEval.spendProgressPct}% of monthly cap sweet-spot used
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                    Uncapped earning at {(zoneEval.headlinePct * strategyMult).toFixed(1)}%
                  </>
                )}
              </span>
            </div>

            <input
              type="range"
              min={500}
              max={sliderMax}
              step={500}
              value={clampedSpend}
              onChange={(e) => setMonthlySpend(Number(e.target.value))}
              aria-label={`Simulate monthly spend on ${activeZone.meta.label}`}
              className="w-full accent-[#0F5C4D] cursor-pointer h-2"
            />

            {/* Visual Cap Meter Track */}
            <div className="h-3 w-full bg-[#E4E4DF] rounded-full overflow-hidden relative">
              <motion.div
                initial={false}
                animate={{
                  width: `${
                    zoneEval.monthlyCapInr
                      ? zoneEval.capped
                        ? 100
                        : Math.max(6, zoneEval.spendProgressPct)
                      : Math.max(12, Math.min(100, (clampedSpend / sliderMax) * 100))
                  }%`,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`h-full rounded-full bg-gradient-to-r ${barTone}`}
              />
            </div>

            {/* 3 Live Outcome KPI Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 tabular-nums">
              <div className="bg-white border border-[#E4E4DF] rounded-lg p-3">
                <span className="block text-[11px] text-[#717882]">Estimated Reward Value</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[18px] font-semibold text-[#0F5C4D]">
                    {formatInr(zoneEval.adjustedMonthlyReward)}/mo
                  </span>
                  <span className="text-[12px] text-[#717882]">
                    ({formatInr(zoneEval.adjustedAnnualReward)}/yr)
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#E4E4DF] rounded-lg p-3">
                <span className="block text-[11px] text-[#717882]">Real Post-Cap Blended Rate</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[18px] font-semibold text-[#1A1D21]">
                    {zoneEval.adjustedEffectivePct.toFixed(2)}%
                  </span>
                  {zoneEval.capped && (
                    <span className="text-[11.5px] text-[#B45309]">
                      down from {(zoneEval.headlinePct * strategyMult).toFixed(1)}% headline
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-[#E4E4DF] rounded-lg p-3">
                <span className="block text-[11px] text-[#717882]">Monthly Cap Headroom</span>
                <span className="block text-[15px] font-medium text-[#1A1D21] mt-1">
                  {zoneEval.monthlyCapInr
                    ? zoneEval.capped
                      ? `${formatInr(zoneEval.monthlyCapInr)} max hit`
                      : `${formatInr(zoneEval.headroomInr)} cap left (${zoneEval.capUsedPct}% used)`
                    : "Uncapped category"}
                </span>
              </div>
            </div>
          </div>

          {/* Counts vs Excluded Caveat Box */}
          {(activeZone.caveat || (calc.excluded_categories && calc.excluded_categories.length > 0)) && (
            <div className="bg-white border border-[#E4E4DF] rounded-lg p-3.5 space-y-2">
              {activeZone.caveat && (
                <div className="flex items-start gap-2 text-[12.5px] text-[#1A1D21]">
                  <AlertCircle className="w-4 h-4 text-[#9A5B13] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <span className="font-medium text-[#9A5B13]">Rule &amp; Cap Caveat: </span>
                    <span className="text-[#4B525C]">{activeZone.caveat}</span>
                  </div>
                </div>
              )}
              {calc.excluded_categories && calc.excluded_categories.length > 0 && (
                <p className="text-[12px] text-[#717882]">
                  <strong className="text-[#4B525C] font-medium">Common Exclusions: </strong>
                  {calc.excluded_categories.slice(0, 4).join(" · ")}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* 3-Stage Benefit Unlock Journey Track */}
      <div className="space-y-2.5">
        <span className="block text-[12px] font-medium text-[#4B525C]">
          How {identity.card_name} Unlocks Maximum Value
        </span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#EEF5F2] border border-[#0F5C4D]/25 text-[#0F5C4D] text-[12px] font-semibold flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#1A1D21]">1. Activation &amp; Welcome</p>
              <p className="text-[12px] text-[#4B525C] leading-[1.45] mt-0.5 line-clamp-3">
                {welcomeSummaryText}
              </p>
            </div>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#EEF5F2] border border-[#0F5C4D]/25 text-[#0F5C4D] text-[12px] font-semibold flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#1A1D21]">
                2. Monthly Sweet-Spot ({activeZone.meta.shortLabel})
              </p>
              <p className="text-[12px] text-[#4B525C] leading-[1.45] mt-0.5">
                {activeZone.monthlyCap && zoneEval.eligibleSpendBeforeCapInr
                  ? `Spend up to ${formatInr(zoneEval.eligibleSpendBeforeCapInr)}/mo to lock full ${activeZone.adjRate.toFixed(1)}% (${formatInr(activeZone.monthlyCap)}/mo cap) before fallback kicks in.`
                  : `Earn steady ${activeZone.adjRate.toFixed(1)}% on ${activeZone.meta.shortLabel} with ${strategyLabel}.`}
              </p>
            </div>
          </div>

          <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3.5 flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#EEF5F2] border border-[#0F5C4D]/25 text-[#0F5C4D] text-[12px] font-semibold flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[#1A1D21]">3. Fee Waiver &amp; Lounge Gate</p>
              <p className="text-[12px] text-[#4B525C] leading-[1.45] mt-0.5 line-clamp-3">
                {waiverGateText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
