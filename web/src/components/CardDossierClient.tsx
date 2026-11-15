"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Flag,
  Gauge,
  Globe,
  Info,
  MessageCircle,
  Phone,
  Plane,
  Plus,
  Receipt,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Train,
  Wallet,
} from "lucide-react";
import type {
  CardDossier,
  CardSummaryItem,
  RelatedCardFeatureRow,
  RewardConversionStrategy,
  SpendCategoryKey,
  StructuredBenefitTable,
} from "@/lib/types";
import { cappedMonthlyCategoryReward, evaluateCardForSpend } from "@/lib/advisor";
import { generateDossierAiVerdict } from "@/lib/aiSuggestions";
import { CONVERSION_STRATEGIES } from "@/lib/conversion";
import { matchGolfGuideForCard } from "@/lib/golfGuide";
import { exportSingleCardPdf, shareUrlOrText } from "@/lib/pdfExport";
import { buildWhatsAppShareHref, sanitizeExternalHref } from "@/lib/security";
import { getBankHelpBySlug } from "@/lib/bankHelpDirectory";
import { CategoryMultiBarChart } from "./AnalyticsCharts";
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  formatInr,
  formatLoungeQuota,
  formatLoungeSourceType,
  formatQuotaNumber,
  roleLabel,
} from "@/lib/format";
import { calmTransition, fastTransition } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { Interactive3DCardModel } from "./Interactive3DCardModel";
import { useCompare } from "./CompareContext";
import { GooeySearchInput } from "./ui/gooey-input";
import {
  CanvaFeatureIcon,
  CanvaFeaturePill,
  resolveBenefitCanvaIcon,
  resolveCategoryCanvaIcon,
  type CanvaIconKey,
} from "./FeatureIcon";

export interface CardAccessibleLoungeSummary {
  lounge_code?: string;
  airport_code?: string;
  city: string;
  lounge_name: string;
  terminal: string;
  terminal_type: string;
  google_rating?: number;
}

export interface CardAccessibleGolfSummary {
  slug: string;
  city: string;
  club_name: string;
  google_rating?: number;
}

interface CardDossierClientProps {
  dossier: CardDossier;
  relatedRows?: RelatedCardFeatureRow[];
  totalCardsCount?: number;
  accessibleIndianLounges?: CardAccessibleLoungeSummary[];
  accessibleGolfClubs?: CardAccessibleGolfSummary[];
  domesticLoungeCount?: number;
}

type DossierTab = "overview" | "rewards" | "lounges" | "fees" | "devals";

const TABS: Array<{ id: DossierTab; label: string }> = [
  { id: "overview", label: "Overview & Pros/Cons" },
  { id: "rewards", label: "Rewards & Simulator" },
  { id: "lounges", label: "Lounges & Travel" },
  { id: "fees", label: "Fees & Eligibility" },
  { id: "devals", label: "Devaluation & FAQs" },
];

const SIM_PRESETS: Array<{ key: SpendCategoryKey; label: string; step: number; max: number; initial: number }> = [
  { key: "online_shopping_general", label: "Online Shopping", step: 1000, max: 100000, initial: 8000 },
  { key: "amazon_flipkart_myntra", label: "Amazon / Flipkart / Myntra", step: 1000, max: 100000, initial: 6000 },
  { key: "groceries_quick_commerce", label: "Groceries & Quick Commerce", step: 500, max: 60000, initial: 5000 },
  { key: "dining_swiggy_zomato", label: "Dining, Swiggy & Zomato", step: 500, max: 60000, initial: 4000 },
  { key: "travel_flights_hotels", label: "Flights & Hotels", step: 2000, max: 150000, initial: 6000 },
  { key: "fuel", label: "Fuel", step: 500, max: 40000, initial: 2500 },
  { key: "upi_scan_and_pay", label: "UPI Scan & Pay (RuPay)", step: 500, max: 50000, initial: 4000 },
  { key: "utilities_bills_telecom", label: "Utilities & Bills", step: 500, max: 50000, initial: 3000 },
  { key: "insurance", label: "Insurance Premiums", step: 1000, max: 50000, initial: 2000 },
  { key: "education_rent_govt", label: "Education, Rent & Tax", step: 2000, max: 100000, initial: 0 },
  { key: "international_forex_net_of_markup", label: "International / Forex", step: 1000, max: 150000, initial: 0 },
  { key: "offline_general_other", label: "Offline POS / Retail", step: 1000, max: 100000, initial: 5000 },
];

const SPEND_SCENARIO_PRESETS: Array<{
  id: string;
  label: string;
  values: Partial<Record<SpendCategoryKey, number>>;
}> = [
  {
    id: "starter",
    label: "₹25k Starter",
    values: {
      online_shopping_general: 4000,
      amazon_flipkart_myntra: 4000,
      groceries_quick_commerce: 3500,
      dining_swiggy_zomato: 2500,
      travel_flights_hotels: 0,
      fuel: 2000,
      upi_scan_and_pay: 3500,
      utilities_bills_telecom: 2500,
      insurance: 1000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 2000,
    },
  },
  {
    id: "household",
    label: "₹50k Household",
    values: {
      online_shopping_general: 7000,
      amazon_flipkart_myntra: 6000,
      groceries_quick_commerce: 8000,
      dining_swiggy_zomato: 4500,
      travel_flights_hotels: 4000,
      fuel: 3500,
      upi_scan_and_pay: 5500,
      utilities_bills_telecom: 4500,
      insurance: 2500,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 4500,
    },
  },
  {
    id: "travel",
    label: "₹1L Travel & Online",
    values: {
      online_shopping_general: 15000,
      amazon_flipkart_myntra: 12000,
      groceries_quick_commerce: 9000,
      dining_swiggy_zomato: 9000,
      travel_flights_hotels: 22000,
      fuel: 4000,
      upi_scan_and_pay: 7000,
      utilities_bills_telecom: 5000,
      insurance: 4000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 5000,
      offline_general_other: 8000,
    },
  },
  {
    id: "premium",
    label: "₹2L High Spend",
    values: {
      online_shopping_general: 25000,
      amazon_flipkart_myntra: 20000,
      groceries_quick_commerce: 15000,
      dining_swiggy_zomato: 15000,
      travel_flights_hotels: 45000,
      fuel: 7000,
      upi_scan_and_pay: 10000,
      utilities_bills_telecom: 8000,
      insurance: 10000,
      education_rent_govt: 15000,
      international_forex_net_of_markup: 15000,
      offline_general_other: 15000,
    },
  },
];

function normalizeSubRatings(raw: Record<string, number> | null | undefined): Array<[string, number]> {
  if (!raw) return [];
  const seen = new Map<string, { label: string; score: number }>();
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val !== "number") continue;
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isTitleLike = /[A-Z]/.test(key);
    const formattedLabel = isTitleLike
      ? key.replace(/^branded/, "Branded")
      : key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
    const existing = seen.get(normKey);
    if (!existing || isTitleLike) {
      seen.set(normKey, { label: formattedLabel, score: val });
    }
  }
  return Array.from(seen.values()).map((v) => [v.label, v.score]);
}

function formatMatrixKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CardDossierClient({
  dossier,
  relatedRows = [],
  totalCardsCount,
  accessibleIndianLounges = [],
  accessibleGolfClubs = [],
  domesticLoungeCount,
}: CardDossierClientProps) {
  const { identity, visual_assets, official_and_reference_links, filter_tags } = dossier;
  const {
    reward_calculator_model: calc,
    lounge_access_detailed: lounge,
    fees_and_charges_detailed: fees,
    benefits_features_and_faqs: benefits,
    ratings,
    pros_and_cons: verdict,
    devaluation_analysis: deval,
    eligibility_detailed: elig,
    alternate_options: alts,
    latest_offers = [],
  } = dossier;

  const { isSelected, toggleItem, isSaved, toggleSaved, isOwned, toggleOwned } = useCompare();
  const compared = isSelected(identity.card_id);
  const [shareState, setShareState] = useState<"idle" | "done">("idle");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const saved = isSaved(identity.card_id);
  const owned = isOwned(identity.card_id);

  const summaryShim = useMemo<CardSummaryItem>(
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
      annual_fee_inr: fees.annual_fee_inr,
      fee_waiver_spend_inr:
        fees.fee_waiver_spend_inr ??
        calc.fee_waiver_and_milestone_calculator?.fee_waiver_spend_inr ??
        null,
      forex_markup_pct: fees.forex_markup_pct,
      overall_rating: ratings.overall_market_rating,
      local_image_path: visual_assets.local_image_path,
      image_url: visual_assets.image_url,
      card_theme: visual_assets.card_theme ?? null,
      filter_tags,
      effective_return_pct_by_category: calc.effective_return_pct_by_category,
      monthly_category_caps_inr: calc.monthly_category_caps_inr,
      golf_summary: benefits.golf_summary ?? null,
      json_path: "",
      md_path: "",
    }),
    [identity, fees, calc, ratings, visual_assets, filter_tags, benefits.golf_summary]
  );

  const [activeTab, setActiveTab] = useState<DossierTab>("overview");
  const [loungeQuery, setLoungeQuery] = useState("");
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [includeGst, setIncludeGst] = useState<boolean>(fees.gst_applicable);
  const [conversionStrategy, setConversionStrategy] =
    useState<RewardConversionStrategy>("default_inr");
  const [activePresetId, setActivePresetId] = useState<string>("custom");
  const [simSpend, setSimSpend] = useState<Record<SpendCategoryKey, number>>(() => {
    const init = {} as Record<SpendCategoryKey, number>;
    for (const k of SPEND_CATEGORY_KEYS) {
      const preset = SIM_PRESETS.find((p) => p.key === k);
      init[k] = preset ? preset.initial : 0;
    }
    return init;
  });

  const applySpendPreset = (presetId: string) => {
    const found = SPEND_SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePresetId(presetId);
    setSimSpend(() => {
      const next = {} as Record<SpendCategoryKey, number>;
      for (const k of SPEND_CATEGORY_KEYS) {
        next[k] = found.values[k] ?? 0;
      }
      return next;
    });
  };

  const simResult = useMemo(() => {
    const waiverThreshold =
      fees.fee_waiver_spend_inr ??
      calc.fee_waiver_and_milestone_calculator?.fee_waiver_spend_inr ??
      null;

    const evaluated = evaluateCardForSpend(
      summaryShim,
      simSpend,
      waiverThreshold,
      includeGst,
      conversionStrategy
    );

    const rows = SIM_PRESETS.map((p) => {
      const m = simSpend[p.key] ?? 0;
      const capInfo = cappedMonthlyCategoryReward(summaryShim, p.key, m);
      return {
        ...p,
        monthly: m,
        pct: capInfo.headlinePct,
        effectivePct: capInfo.effectivePct,
        capped: capInfo.capped,
        monthlyCapInr: capInfo.monthlyCapInr,
        annualRewardInr: capInfo.monthlyReward * 12,
      };
    });

    const monthlySpend = rows.reduce((sum, r) => sum + r.monthly, 0);
    const annualRewardInr = evaluated.grossAnnualRewardsInr;
    const annualSpend = evaluated.annualSpendInr;
    const waiverMet = evaluated.waiverMet;

    const feeBeforeWaiver = includeGst
      ? Math.round(fees.annual_fee_inr * 1.18)
      : fees.annual_fee_inr;

    const annualFeeCharged = evaluated.effectiveFeeInr;
    const feeSavedByWaiver =
      fees.annual_fee_inr > 0 && waiverMet ? feeBeforeWaiver : 0;

    const waiverProgressPct =
      waiverThreshold && waiverThreshold > 0
        ? Math.min(100, Math.round((annualSpend / waiverThreshold) * 100))
        : fees.annual_fee_inr === 0
          ? 100
          : 0;
    const remainingForWaiver =
      waiverThreshold && waiverThreshold > 0 ? Math.max(0, waiverThreshold - annualSpend) : 0;

    const netAnnualValue = evaluated.netAnnualBenefitInr;
    const effectiveOverallPct = evaluated.netReturnPct;

    return {
      rows,
      monthlySpend,
      annualSpend,
      annualRewardInr,
      conversionResult: evaluated.conversionResult,
      capNotes: evaluated.capNotes,
      feeBeforeWaiver,
      annualFeeCharged,
      feeSavedByWaiver,
      waiverMet,
      waiverThreshold,
      waiverProgressPct,
      remainingForWaiver,
      netAnnualValue,
      effectiveOverallPct,
    };
  }, [simSpend, calc, fees, includeGst, conversionStrategy, summaryShim]);

  const [benefitGroupFilter, setBenefitGroupFilter] = useState<'all' | 'highlights' | 'milestones' | 'lifestyle'>('all');

  const combinedIndianLounges = useMemo<CardAccessibleLoungeSummary[]>(() => {
    if (accessibleIndianLounges.length > 0) return accessibleIndianLounges;
    return (lounge.participating_lounges_matched || []).map((spot) => ({
      lounge_code: undefined,
      city: spot.city,
      lounge_name: spot.lounge_name,
      terminal: spot.terminal,
      terminal_type: spot.terminal_type,
      google_rating: undefined,
    }));
  }, [accessibleIndianLounges, lounge.participating_lounges_matched]);

  const effectiveDomesticLoungeCount =
    domesticLoungeCount ??
    combinedIndianLounges.filter((l) => !String(l.terminal_type || "").toLowerCase().includes("international")).length;

  const filteredLounges = useMemo(() => {
    const q = loungeQuery.trim().toLowerCase();
    if (!q) return combinedIndianLounges;
    return combinedIndianLounges.filter(
      (s) =>
        s.city.toLowerCase().includes(q) ||
        s.lounge_name.toLowerCase().includes(q) ||
        s.terminal.toLowerCase().includes(q)
    );
  }, [combinedIndianLounges, loungeQuery]);

  const subRatings = useMemo(
    () => normalizeSubRatings(ratings.category_sub_ratings),
    [ratings.category_sub_ratings]
  );

  const welcomeList = useMemo(() => {
    if (!benefits.welcome_benefit) return [];
    return Array.isArray(benefits.welcome_benefit)
      ? benefits.welcome_benefit
      : [benefits.welcome_benefit];
  }, [benefits.welcome_benefit]);

  const lifestyleGroups = [
    { title: "Dining Benefits", items: benefits.dining_benefits || [] },
    { title: "Movie Benefits", items: benefits.movie_benefits || [] },
    { title: "Golf Benefits", items: benefits.golf_benefits || [] },
    { title: "Insurance Cover", items: benefits.insurance_cover || [] },
    { title: "Concierge & Privileges", items: benefits.concierge_or_privilege || [] },
  ].filter((g) => g.items.length > 0);

  const riskScore = deval?.devaluation_risk_score ?? 0;
  const riskBadgeStyle =
    riskScore >= 7
      ? "bg-[#FDF2F2] text-[#991B1B] border-[#991B1B]/25"
      : riskScore >= 5
        ? "bg-[#FEF6EA] text-[#9A5B13] border-[#9A5B13]/25"
        : "bg-[#EEF5F2] text-[#0F5C4D] border-[#0F5C4D]/25";

  const cardTheme = visual_assets?.card_theme ?? null;

  const domLoungeQuota = formatLoungeQuota(
    lounge.domestic.visits_per_year,
    lounge.domestic.visits_per_quarter,
    lounge.has_domestic_lounge
  );
  const intlLoungeQuota = formatLoungeQuota(
    lounge.international.visits_per_year,
    0,
    lounge.has_international_lounge
  );
  const spendCriteriaHasThreshold = /(?:₹|rs\.?|inr|\d{3,})\s*(?:spend|quarter|qtr)/i.test(
    lounge.domestic.spend_criteria || ""
  );
  const isNoSpendLounge = Boolean(lounge.no_spend_domestic_lounge) && !spendCriteriaHasThreshold;

  const hasGolf = Boolean(
    filter_tags.has_golf ||
      benefits.golf_summary?.has_golf ||
      (benefits.golf_benefits && benefits.golf_benefits.length > 0)
  );

  const heroFeaturePills = useMemo(() => {
    const pills: Array<{ icon: CanvaIconKey; label: string }> = [];
    const seen = new Set<string>();
    const add = (icon: CanvaIconKey, label: string) => {
      if (seen.has(label) || pills.length >= 6) return;
      seen.add(label);
      pills.push({ icon, label });
    };

    const cats = new Set([identity.primary_category, ...(identity.categories || [])]);
    if (cats.has("Travel & Miles") || (calc.effective_return_pct_by_category?.travel_flights_hotels ?? 0) >= 2.5) {
      add("travel", "Travel");
    }
    if (lounge.has_domestic_lounge || lounge.has_international_lounge) {
      add("lounge", isNoSpendLounge ? "Lounge Access" : "Lounge Access (Spend-Linked)");
    }
    if (hasGolf) {
      add("golf", "Golf Privileges");
    }
    if (calc.accelerated_reward_rate_pct > 0 || cats.has("Super-Premium")) {
      add("rewards", "Rewards");
    }
    if (cats.has("Cashback") || filter_tags.is_ltf) {
      add("cashback", filter_tags.is_ltf ? "Lifetime Free" : "Cashback");
    }
    if (cats.has("Fuel") || (calc.effective_return_pct_by_category?.fuel ?? 0) >= 2) {
      add("fuel", "Fuel");
    }
    if (cats.has("Online Shopping") || cats.has("Dining, Groceries & Movies")) {
      add("shopping", "Shopping & Dining");
    }
    if (filter_tags.zero_forex || filter_tags.zero_or_low_forex) {
      add("forex", filter_tags.zero_forex ? "Zero Forex Markup" : "Low Forex");
    }
    if (filter_tags.is_rupay_upi) {
      add("cashback", "RuPay UPI Enabled");
    }
    if (pills.length === 0) {
      add(resolveCategoryCanvaIcon(identity.primary_category), identity.primary_category);
    }
    return pills;
  }, [identity, calc, lounge, filter_tags, isNoSpendLounge, hasGolf]);

  const highlightSummaryCards = useMemo(() => {
    const peakRate = Math.max(
      calc.accelerated_reward_rate_pct || 0,
      calc.base_reward_rate_pct || 0
    );
    const rewardSummary =
      benefits.highlights?.[0] && benefits.highlights[0].length <= 92
        ? benefits.highlights[0]
        : peakRate > 0
          ? `Up to ${peakRate.toFixed(1)}% value-back in ${identity.primary_category}`
          : calc.earn_unit || "Everyday reward earnings across card spends";

    const loungeSummary =
      lounge.has_domestic_lounge || lounge.has_international_lounge
        ? lounge.has_domestic_lounge && lounge.has_international_lounge
          ? `${domLoungeQuota} domestic & ${intlLoungeQuota} international visits`
          : lounge.has_domestic_lounge
            ? `${domLoungeQuota} domestic airport lounge visits${isNoSpendLounge ? " (no spend cap)" : ""}`
            : `${intlLoungeQuota} international airport lounge visits`
        : filter_tags.has_railway_lounge
          ? lounge.railway.summary || "Complimentary IRCTC railway lounge visits"
          : "No complimentary airport lounge visits included";

    const thirdCard = (() => {
      if (filter_tags.zero_forex || filter_tags.zero_or_low_forex) {
        return {
          icon: "forex" as CanvaIconKey,
          title: "Low Forex Markup",
          detail: `${fees.forex_markup_pct}% + GST foreign currency markup on international spends`,
        };
      }
      if ((identity.categories || []).includes("Fuel") || (calc.effective_return_pct_by_category?.fuel ?? 0) >= 2) {
        return {
          icon: "fuel" as CanvaIconKey,
          title: "Fuel Savings",
          detail: fees.fuel_surcharge_waiver || `Up to ${calc.effective_return_pct_by_category?.fuel?.toFixed(1) ?? "2.5"}% fuel return`,
        };
      }
      if (welcomeList.length > 0 && welcomeList[0]) {
        return {
          icon: "welcome" as CanvaIconKey,
          title: "Welcome Benefit",
          detail: welcomeList[0],
        };
      }
      const primaryIcon = resolveCategoryCanvaIcon(identity.primary_category);
      return {
        icon: (primaryIcon === "rewards" ? "travel" : primaryIcon) as CanvaIconKey,
        title: identity.primary_category === "Travel & Miles" ? "Travel & Redemption" : identity.primary_category,
        detail:
          benefits.highlights?.[1] ||
          benefits.about_overview ||
          `Built for ${verdict.best_for_whom || identity.primary_category}`,
      };
    })();

    return [
      {
        icon: "rewards" as CanvaIconKey,
        title: "Rewards",
        detail: rewardSummary,
      },
      {
        icon: "lounge" as CanvaIconKey,
        title: "Lounge Access",
        detail: loungeSummary,
      },
      thirdCard,
    ];
  }, [
    calc,
    benefits,
    identity,
    lounge,
    domLoungeQuota,
    intlLoungeQuota,
    isNoSpendLounge,
    filter_tags,
    fees,
    welcomeList,
    verdict,
  ]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-clip">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-[#717882] mb-5 flex-wrap">
        <Link href="/cards" className="inline-flex items-center gap-1 hover:text-[#1A1D21] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          All Cards
        </Link>
        <span>/</span>
        <Link href={`/cards?bank=${identity.bank_slug}`} className="hover:text-[#1A1D21] transition-colors">
          {identity.bank}
        </Link>
        <span>/</span>
        <span className="text-[#1A1D21] truncate max-w-[260px] sm:max-w-none">{identity.card_name}</span>
      </nav>

      {/* Hero Ledger Header */}
      <section
        className="border rounded-xl overflow-hidden transition-colors"
        style={{
          backgroundColor: cardTheme?.soft_bg_hex || "#FFFFFF",
          borderColor: cardTheme?.border_hex || "#E4E4DF",
        }}
      >
        {cardTheme?.primary_hex && (
          <div
            className="h-1.5 w-full"
            style={{ backgroundColor: cardTheme.primary_hex }}
            aria-hidden="true"
          />
        )}
        <div className="p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start justify-between">
          <div className="flex flex-col sm:flex-row gap-5 items-start min-w-0 flex-1 w-full">
            <Interactive3DCardModel
              localImagePath={visual_assets.local_image_path}
              cardName={identity.card_name}
              bank={identity.bank}
              network={identity.card_network}
              tier={identity.card_tier}
              annualFeeLabel={
                fees.annual_fee_inr === 0 ? "Lifetime Free (₹0)" : formatInr(fees.annual_fee_inr)
              }
              loungeLabel={formatLoungeQuota(
                lounge.domestic?.summary,
                lounge.international?.summary,
                filter_tags.no_spend_domestic_lounge
              )}
              rewardHighlight={
                verdict?.best_for_whom || identity.primary_category
              }
              cardTheme={cardTheme}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1 w-full">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-white border border-[#E4E4DF] px-2.5 py-0.5 rounded-md">
                  <BankLogo bankSlug={identity.bank_slug} bank={identity.bank} size="xs" />
                  <span>{identity.bank}</span>
                </span>
                <span className="text-[12px] text-[#4B525C] bg-white/85 border border-[#E4E4DF] px-2.5 py-0.5 rounded-md">
                  {identity.card_network} · {identity.card_tier}
                </span>
                {identity.status && identity.status !== "active" && (
                  <span className="text-[12px] text-[#9A5B13] bg-[#FEF6EA] px-2.5 py-0.5 rounded-md capitalize">
                    {identity.status}
                  </span>
                )}
              </div>

              <h1 className="text-[24px] sm:text-[28px] font-medium text-[#1A1D21] tracking-[-0.02em] leading-tight mt-2.5">
                {identity.card_name}
              </h1>
              <p className="text-[14px] text-[#4B525C] mt-1">
                {identity.primary_category}
                {identity.categories && identity.categories.length > 1
                  ? ` · Also fits ${identity.categories.slice(1, 3).join(", ")}`
                  : ""}
              </p>

              {/* Pastel Blue-Tinted Canva Icon Feature Pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                {heroFeaturePills.map((pill) => (
                  <CanvaFeaturePill key={pill.label} icon={pill.icon} label={pill.label} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Score + Action Box */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-3 shrink-0 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 border-[#E4E4DF]">
            <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-start lg:justify-end">
              <div className="flex items-center gap-1.5 bg-white border border-[#E4E4DF] px-3 py-1.5 rounded-lg tabular-nums">
                <Star className="w-4 h-4 text-[#9A5B13]" aria-hidden="true" />
                <span className="text-[16px] font-medium text-[#1A1D21]">
                  {ratings.overall_market_rating?.toFixed(2) ?? "N/A"}
                </span>
                <span className="text-[12px] text-[#717882]">/ 5</span>
              </div>

              <span className={`text-[12px] px-2.5 py-1.5 rounded-lg border tabular-nums ${riskBadgeStyle}`}>
                Deval Risk: {riskScore}/10
              </span>

              <button
                type="button"
                onClick={() => toggleOwned(identity.card_id)}
                className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  owned
                    ? "bg-[#EEF5F2] border-[#0F5C4D]/45 text-[#0F5C4D]"
                    : "bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/50 text-[#1A1D21]"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                {owned ? "In Wallet" : "+ Wallet"}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg border bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/50 text-[#1A1D21] transition-colors cursor-pointer"
                  aria-expanded={shareMenuOpen}
                >
                  <Share2 className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>{shareState === "done" ? "Shared" : "Share"}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#717882]" aria-hidden="true" />
                </button>

                {shareMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white border border-[#E4E4DF] rounded-xl shadow-lg p-1.5 z-30 space-y-1 text-left">
                    <a
                      href={buildWhatsAppShareHref(
                        `Check out ${identity.card_name} (${identity.bank}) on Cards by cogify — ${fees.annual_fee_inr === 0 ? "Lifetime Free" : `${formatInr(fees.annual_fee_inr)}/yr`} · Rating ${ratings.overall_market_rating.toFixed(2)}/5`,
                        `https://card.cogify.me/${identity.bank_slug}/${identity.card_slug}`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShareMenuOpen(false)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-[#15803D] hover:bg-[#ECFDF5] font-medium transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Share on WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setShareMenuOpen(false);
                        exportSingleCardPdf(dossier);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-[#1A1D21] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-[#0F5C4D] shrink-0" aria-hidden="true" />
                      <span>Export Visual PDF Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShareMenuOpen(false);
                        const res = await shareUrlOrText({
                          title: `${identity.card_name} (${identity.bank}) — Cards by cogify`,
                          text: `${verdict.verdict || identity.primary_category} · Annual Fee: ${fees.annual_fee_inr === 0 ? "LTF" : formatInr(fees.annual_fee_inr)} · Rating: ${ratings.overall_market_rating.toFixed(2)}/5`,
                        });
                        if (res !== "failed") {
                          setShareState("done");
                          setTimeout(() => setShareState("idle"), 2000);
                        }
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-[#1A1D21] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-[#0F5C4D] shrink-0" aria-hidden="true" />
                      <span>Copy Dossier Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShareMenuOpen(false);
                        toggleSaved(identity.card_id);
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] text-[#1A1D21] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                    >
                      <Bookmark className={`w-4 h-4 text-[#0F5C4D] shrink-0 ${saved ? "fill-[#0F5C4D]/20" : ""}`} aria-hidden="true" />
                      <span>{saved ? "Saved Bookmark ✓" : "Save Bookmark"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto lg:w-auto">
              <button
                type="button"
                onClick={() =>
                  toggleItem({
                    card_id: identity.card_id,
                    card_name: identity.card_name,
                    bank: identity.bank,
                    bank_slug: identity.bank_slug,
                    card_slug: identity.card_slug,
                    annual_fee_inr: fees.annual_fee_inr,
                    overall_rating: ratings.overall_market_rating,
                  })
                }
                className={`inline-flex items-center justify-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  compared
                    ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                    : "bg-white border-[#E4E4DF] hover:border-[#C9C9C2] text-[#1A1D21]"
                }`}
              >
                {compared ? <Check className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
                {compared ? "In Compare" : "Compare"}
              </button>

              {sanitizeExternalHref(official_and_reference_links.bank_url) && (
                <a
                  href={sanitizeExternalHref(official_and_reference_links.bank_url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="inline-flex items-center justify-center gap-1.5 text-[13px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  Official Bank Page
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 3-Column Highlight Summary Cards (Rewards, Lounge Access, Primary Perk) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-6">
          {highlightSummaryCards.map((item) => (
            <div
              key={item.title}
              className="bg-white border border-[#E4E4DF] rounded-xl p-4 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2">
                <CanvaFeatureIcon icon={item.icon} size={20} />
                <span className="text-[14px] font-medium text-[#1A1D21]">{item.title}</span>
              </div>
              <p className="text-[13px] text-[#4B525C] mt-2 leading-relaxed line-clamp-2">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Key Numbers Ledger Strip */}
        <div
          className={`grid grid-cols-2 ${
            fees.joining_fee_inr !== fees.annual_fee_inr ? "sm:grid-cols-5" : "sm:grid-cols-4"
          } gap-4 mt-5 pt-5 border-t border-[#E4E4DF] tabular-nums`}
        >
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882]">
              <Receipt className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
              Joining Fee
            </span>
            <span className="block text-[15px] font-medium text-[#1A1D21]">
              {fees.joining_fee_inr === 0 ? "₹0 (LTF)" : formatInr(fees.joining_fee_inr, true)}
            </span>
            {fees.joining_fee_inr === fees.annual_fee_inr && fees.fee_waiver_spend_inr ? (
              <span className="block text-[11px] text-[#717882]">
                Waived at {formatInr(fees.fee_waiver_spend_inr)}/yr
              </span>
            ) : null}
          </div>
          {fees.joining_fee_inr !== fees.annual_fee_inr && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882]">
                <Calendar className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                Annual Fee
              </span>
              <span className="block text-[15px] font-medium text-[#1A1D21]">
                {fees.annual_fee_inr === 0 ? "₹0 (LTF)" : formatInr(fees.annual_fee_inr)}
              </span>
              {fees.fee_waiver_spend_inr ? (
                <span className="block text-[11px] text-[#717882]">
                  Waived at {formatInr(fees.fee_waiver_spend_inr)}/yr
                </span>
              ) : null}
            </div>
          )}
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882]">
              <Plane className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
              Domestic Lounge
            </span>
            <span className="block text-[15px] font-medium text-[#1A1D21]">
              {domLoungeQuota}
            </span>
            {lounge.has_domestic_lounge && (
              <span className="block text-[11px] text-[#0F5C4D] font-medium truncate">
                {effectiveDomesticLoungeCount > 0
                  ? `${effectiveDomesticLoungeCount} Indian lounges`
                  : isNoSpendLounge
                    ? "No spend criteria"
                    : "Spend-based"}
              </span>
            )}
          </div>
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882]">
              <Globe className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
              Forex Markup
            </span>
            <span className="block text-[15px] font-medium text-[#1A1D21]">
              {fees.forex_markup_pct}% + GST
            </span>
          </div>
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 space-y-1 col-span-2 sm:col-span-1">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882]">
              <Gauge className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
              Eligibility Floor
            </span>
            <span className="block text-[15px] font-medium text-[#1A1D21]">
              {elig.min_monthly_income_salaried_inr
                ? `${formatInr(elig.min_monthly_income_salaried_inr)}/mo`
                : `CIBIL ${elig.min_cibil_score}+`}
            </span>
            <span className="block text-[11px] text-[#717882]">
              CIBIL {elig.min_cibil_score}+
            </span>
          </div>
        </div>

        {/* Hero metrics close cleanly; Official Bank MITC & Disclosures live at the bottom */}
        </div>
      </section>

      {/* Aceternity-adapted Animated Tabs Bar */}
      <div className="mt-6 border-b border-[#E4E4DF] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max pb-2" role="tablist" aria-label="Card details sections">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3.5 py-2 text-[13.5px] rounded-lg transition-colors cursor-pointer ${
                  active ? "text-[#0F5C4D] font-medium" : "text-[#4B525C] hover:text-[#1A1D21]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="dossier-tab-pill"
                    transition={fastTransition}
                    className="absolute inset-0 bg-[#EEF5F2] border border-[#0F5C4D]/25 rounded-lg -z-10"
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={calmTransition}
              className="space-y-6"
            >
              {/* Projected Annual Value Preview Strip */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D]">
                    <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                    Personalized Annual Value Check ({formatInr(simResult.monthlySpend)}/mo spend)
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-1 tabular-nums">
                    <span className="text-[18px] font-medium text-[#1A1D21]">
                      Net {formatInr(simResult.netAnnualValue)}/yr
                    </span>
                    <span className="text-[13px] text-[#4B525C]">
                      Rewards {formatInr(simResult.annualRewardInr)} ·{" "}
                      {simResult.waiverMet
                        ? "Fee Waived / ₹0"
                        : `Fee -${formatInr(simResult.annualFeeCharged)}`}
                    </span>
                    <span className="text-[12.5px] text-[#0F5C4D]">
                      {simResult.effectiveOverallPct.toFixed(2)}% net yield
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("rewards")}
                  className="text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EFE9] border border-[#0F5C4D]/25 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Customize 12 Spend Sliders →
                </button>
              </div>

              {/* AI Should You Apply? Verdict */}
              {(() => {
                const entries = Object.entries(calc.effective_return_pct_by_category || {}).filter(
                  ([k]) => k !== "international_forex_net_of_markup"
                ) as Array<[SpendCategoryKey, number]>;
                const topEntry = entries.sort((a, b) => b[1] - a[1])[0];
                const topCatLabel = topEntry
                  ? SPEND_CATEGORY_META[topEntry[0]]?.shortLabel ?? topEntry[0]
                  : identity.primary_category;
                const aiVerdict = generateDossierAiVerdict({
                  cardName: identity.card_name,
                  bank: identity.bank,
                  annualFeeInr: fees.annual_fee_inr,
                  feeWaiverSpendInr:
                    fees.fee_waiver_spend_inr ??
                    calc.fee_waiver_and_milestone_calculator?.fee_waiver_spend_inr ??
                    null,
                  overallRating: ratings.overall_market_rating,
                  isLtf: filter_tags.is_ltf,
                  isInviteOnly: filter_tags.is_invite_only,
                  hasNoSpendLounge: filter_tags.no_spend_domestic_lounge,
                  hasGolf: Boolean(filter_tags.has_golf),
                  zeroOrLowForex: filter_tags.zero_or_low_forex,
                  devaluationRiskScore: deval.devaluation_risk_score,
                  minIncomeInr: elig.min_monthly_income_salaried_inr,
                  transferPartnerNames: (calc.transfer_partners || []).map((p) =>
                    typeof p === "string" ? p : p.partner || ""
                  ),
                  topCategoryLabel: topCatLabel,
                  topCategoryPct: topEntry ? topEntry[1] : calc.accelerated_reward_rate_pct,
                });
                const badgeCls =
                  aiVerdict.tone === "positive"
                    ? "bg-[#EEF5F2] text-[#0F5C4D]"
                    : aiVerdict.tone === "caution"
                      ? "bg-[#FEF6EA] text-[#9A5B13]"
                      : "bg-[#F3F2EE] text-[#4B525C]";
                return (
                  <div className="space-y-4">
                    <div className="bg-white border border-[#0F5C4D]/25 rounded-xl p-4 sm:p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F5C4D]">
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          AI Card Analyst Verdict
                        </span>
                        <span className={`text-[11.5px] font-medium px-2.5 py-0.5 rounded-md ${badgeCls}`}>
                          {aiVerdict.badgeLabel}
                        </span>
                      </div>
                      <p className="text-[14px] text-[#1A1D21] leading-relaxed">{aiVerdict.summary}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
                        <div className="bg-[#EEF5F2]/70 border border-[#C5DFD5] rounded-lg px-3 py-2.5">
                          <span className="block text-[11px] font-medium text-[#0F5C4D] uppercase tracking-wide">
                            Apply If
                          </span>
                          <p className="text-[#1A1D21] mt-0.5 leading-relaxed">{aiVerdict.applyIf}</p>
                        </div>
                        <div className="bg-[#FEF6EA]/70 border border-[#EAD4AD] rounded-lg px-3 py-2.5">
                          <span className="block text-[11px] font-medium text-[#9A5B13] uppercase tracking-wide">
                            Skip If
                          </span>
                          <p className="text-[#1A1D21] mt-0.5 leading-relaxed">{aiVerdict.skipIf}</p>
                        </div>
                      </div>
                    </div>

                    <CategoryMultiBarChart
                      title="Effective Net Return Profile Across Indian Spend Categories (%)"
                      subtitle="Visual comparison of real INR return rates after cap & point valuation across 12 spend buckets."
                      data={SPEND_CATEGORY_KEYS.map((k) => {
                        const val = Number(calc.effective_return_pct_by_category?.[k] ?? 0);
                        return {
                          id: k,
                          label: SPEND_CATEGORY_META[k].shortLabel,
                          value: val,
                          displayValue: `${val.toFixed(1)}%`,
                          color: val >= 5 ? "#0F5C4D" : val >= 2 ? "#1D4ED8" : val < 0 ? "#DC2626" : "#64748B",
                        };
                      })}
                      height={175}
                    />
                  </div>
                );
              })()}

              {/* Latest Card & Bank Offers */}
              {latest_offers && latest_offers.length > 0 && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                      <h2 className="text-[16px] font-medium text-[#1A1D21]">
                        Latest {identity.bank} &amp; Card Offers
                      </h2>
                    </div>
                    {official_and_reference_links.bank_url && (
                      <a
                        href={official_and_reference_links.bank_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#0F5C4D] hover:underline"
                      >
                        Direct {identity.bank} Card Page
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {latest_offers.slice(0, 4).map((offer, idx) => {
                      const targetUrl =
                        offer.offer_url || official_and_reference_links.bank_url;
                      return (
                        <div
                          key={`${offer.offer_id || offer.title}-${idx}`}
                          className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded">
                                <BankLogo bankSlug={identity.bank_slug} bank={identity.bank} size="xs" />
                                <span>{offer.category}</span>
                              </span>
                              <span className="text-[11px] text-[#717882] truncate">
                                {offer.valid_till}
                              </span>
                            </div>
                            <h3 className="text-[14px] font-medium text-[#1A1D21] mt-2 leading-snug">
                              {offer.title}
                            </h3>
                            {offer.summary && offer.summary !== offer.title && (
                              <p className="text-[12.5px] text-[#4B525C] mt-1 leading-relaxed">
                                {offer.summary}
                              </p>
                            )}
                          </div>
                          {targetUrl && (
                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              referrerPolicy="no-referrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F5C4D] hover:underline w-fit"
                            >
                              View on Official Bank Portal
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Golf & Club Privileges Summary Card */}
              {hasGolf && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                      <h2 className="text-[16px] font-medium text-[#1A1D21]">
                        Golf &amp; Country Club Privileges
                      </h2>
                    </div>
                    <Link
                      href="/categories?cat=golf"
                      className="text-[12.5px] text-[#0F5C4D] hover:underline"
                    >
                      Compare all golf cards →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3.5 text-[13px]">
                    <div className="bg-[#EEF5F2]/60 border border-[#0F5C4D]/15 rounded-lg p-3.5">
                      <span className="block text-[11.5px] text-[#0F5C4D] font-medium">
                        Complimentary Rounds &amp; Lessons
                      </span>
                      <p className="text-[#1A1D21] mt-1 leading-relaxed">
                        {benefits.golf_summary?.complimentary_access ||
                          benefits.golf_benefits?.[0] ||
                          "Complimentary green fee waiver / coaching included"}
                      </p>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                      <span className="block text-[11.5px] text-[#717882] font-medium">
                        Eligible Courses
                      </span>
                      <p className="text-[#1A1D21] mt-1 leading-relaxed">
                        {benefits.golf_summary?.eligible_courses || "Domestic Indian & Network Courses"}
                      </p>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                      <span className="block text-[11.5px] text-[#717882] font-medium">
                        Spend / Booking Rule
                      </span>
                      <p className="text-[#4B525C] mt-1 leading-relaxed">
                        {benefits.golf_summary?.spend_condition ||
                          "Check bank golf concierge portal 5–7 days prior to tee-off"}
                      </p>
                      {benefits.golf_summary?.extra_notes && (
                        <p className="text-[12px] text-[#717882] mt-1">
                          {benefits.golf_summary.extra_notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2026 Program Updates & Live Rule Alerts */}
              {benefits.program_updates_2026 && benefits.program_updates_2026.length > 0 && (
                <div className="bg-[#FEF8F0] border border-[#E9CFA6] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#9A5B13]" aria-hidden="true" />
                      <h2 className="text-[16px] font-medium text-[#1A1D21]">
                        2026 Live Rule Changes &amp; Policy Status
                      </h2>
                    </div>
                    <Link
                      href="/devaluations"
                      className="text-[12px] font-medium text-[#9A5B13] hover:underline"
                    >
                      Devaluation Tracker →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
                    {benefits.program_updates_2026.map((note, idx) => (
                      <div
                        key={idx}
                        className="bg-white/90 border border-[#E9CFA6] rounded-lg px-3.5 py-2.5 text-[13px] text-[#1A1D21] leading-relaxed flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9A5B13] shrink-0 mt-2" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary + Verdict */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <h2 className="text-[18px] font-medium text-[#1A1D21]">Card Advisory Summary</h2>
                <p className="text-[14.5px] text-[#4B525C] leading-relaxed mt-2">
                  {verdict.editorial_summary || benefits.about_overview}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
                  <div className="bg-[#EEF5F2]/60 border border-[#0F5C4D]/15 rounded-lg p-3.5">
                    <span className="block text-[11.5px] text-[#0F5C4D] font-medium">Best For Whom</span>
                    <p className="text-[13.5px] text-[#1A1D21] mt-1 leading-relaxed">
                      {verdict.best_for_whom || "General everyday spenders matching category profile"}
                    </p>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                    <span className="block text-[11.5px] text-[#717882] font-medium">Not Ideal For</span>
                    <p className="text-[13.5px] text-[#4B525C] mt-1 leading-relaxed">
                      {verdict.not_ideal_for || "Spenders seeking flat rewards on excluded categories"}
                    </p>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                    <span className="block text-[11.5px] text-[#717882] font-medium">Recommended Spend &amp; Verdict</span>
                    <p className="text-[13.5px] text-[#1A1D21] mt-1 tabular-nums">
                      {verdict.recommended_monthly_spend_inr}
                    </p>
                    <p className="text-[12.5px] text-[#4B525C] mt-1">{verdict.verdict}</p>
                  </div>
                </div>
              </div>

              {/* Pros and Cons Distinct Two-Column Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#EEF5F2]/65 border border-[#C5DFD6] rounded-xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#C5DFD6]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#0F5C4D] text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <h3 className="text-[16px] font-medium text-[#0F5C4D]">What Works (Pros)</h3>
                    </div>
                    <span className="text-[11px] font-medium bg-white text-[#0F5C4D] border border-[#C5DFD6] px-2 py-0.5 rounded-full">
                      {(verdict.pros || []).length} strengths
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {(verdict.pros || []).map((pro, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#1A1D21] leading-relaxed bg-white/80 rounded-lg px-3.5 py-2.5 border border-[#D8EAE3]">
                        <Check className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#FEF6EA]/75 border border-[#EED8B5] rounded-xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EED8B5]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#9A5B13] text-white flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <h3 className="text-[16px] font-medium text-[#9A5B13]">Limitations (Cons)</h3>
                    </div>
                    <span className="text-[11px] font-medium bg-white text-[#9A5B13] border border-[#EED8B5] px-2 py-0.5 rounded-full">
                      {(verdict.cons || []).length} watch-outs
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {(verdict.cons || []).map((con, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[14px] text-[#4B525C] leading-relaxed bg-white/85 rounded-lg px-3.5 py-2.5 border border-[#F3E2C7]">
                        <AlertTriangle className="w-4 h-4 text-[#9A5B13] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Highlights + Sub-ratings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[16px] font-medium text-[#1A1D21]">Key Features &amp; Benefits</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          ["all", "All Perks"],
                          ["highlights", "Highlights"],
                          ["milestones", "Welcome & Milestones"],
                          ["lifestyle", "Lifestyle"],
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setBenefitGroupFilter(k)}
                          className={`px-2.5 py-1 text-[11.5px] rounded-full border transition-colors cursor-pointer ${
                            benefitGroupFilter === k
                              ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                              : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(benefitGroupFilter === "all" || benefitGroupFilter === "highlights") && benefits.highlights?.length > 0 && (
                    <ul className="mt-3 space-y-2.5">
                      {benefits.highlights.map((h, idx) => (
                        <li key={idx} className="text-[13.5px] text-[#4B525C] leading-relaxed flex items-start gap-2.5">
                          <CanvaFeatureIcon
                            icon={resolveBenefitCanvaIcon(h)}
                            size={18}
                            className="mt-0.5"
                          />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {(benefitGroupFilter === "all" || benefitGroupFilter === "milestones") && welcomeList.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#E4E4DF]">
                      <h4 className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#1A1D21]">
                        <CanvaFeatureIcon icon="welcome" size={18} />
                        <span>Welcome Benefit</span>
                      </h4>
                      <ul className="mt-1.5 space-y-1">
                        {welcomeList.map((w, i) => (
                          <li key={i} className="text-[13.5px] text-[#4B525C] leading-relaxed">{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(benefitGroupFilter === "all" || benefitGroupFilter === "milestones") && benefits.milestone_benefits?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#E4E4DF]">
                      <h4 className="inline-flex items-center gap-2 text-[13.5px] font-medium text-[#1A1D21]">
                        <CanvaFeatureIcon icon="rewards" size={18} />
                        <span>Milestone Benefits</span>
                      </h4>
                      <ul className="mt-1.5 space-y-1.5">
                        {benefits.milestone_benefits.map((m, i) => (
                          <li key={i} className="text-[13.5px] text-[#4B525C] leading-relaxed flex items-start gap-2.5">
                            <CanvaFeatureIcon icon={resolveBenefitCanvaIcon(m)} size={16} className="mt-0.5" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(benefitGroupFilter === "all" || benefitGroupFilter === "lifestyle") && lifestyleGroups.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#E4E4DF] grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {lifestyleGroups.map((grp) => (
                        <div key={grp.title}>
                          <h4 className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A1D21]">
                            <CanvaFeatureIcon icon={resolveBenefitCanvaIcon(grp.title)} size={16} />
                            <span>{grp.title}</span>
                          </h4>
                          <ul className="mt-1 space-y-1">
                            {grp.items.map((item, idx) => (
                              <li key={idx} className="text-[13px] text-[#4B525C] leading-relaxed">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-ratings */}
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                  <h3 className="text-[16px] font-medium text-[#1A1D21]">Rating Breakdown</h3>
                  <div className="mt-4 space-y-3 tabular-nums">
                    {subRatings.length > 0 ? (
                      subRatings.map(([label, score]) => (
                        <div key={label}>
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-[#4B525C]">{label}</span>
                            <span className="font-medium text-[#1A1D21]">{score.toFixed(1)} / 5</span>
                          </div>
                          <div className="h-1.5 bg-[#F3F2EE] rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-[#0F5C4D] rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, (score / 5) * 100))}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-[#717882]">
                        Overall market rating: {ratings.overall_market_rating?.toFixed(2)} / 5
                      </p>
                    )}
                  </div>

                  {benefits.get_this_card_if?.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#E4E4DF]">
                      <h4 className="text-[13px] font-medium text-[#1A1D21]">Get This Card If</h4>
                      <ul className="mt-2 space-y-1.5">
                        {benefits.get_this_card_if.map((item, idx) => (
                          <li key={idx} className="text-[13px] text-[#4B525C] leading-relaxed">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "rewards" && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={calmTransition}
              className="space-y-6"
            >
              {/* Effective Return Rates Grid */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[18px] font-medium text-[#1A1D21]">
                      Effective Category Reward Rates
                    </h2>
                    <p className="text-[13.5px] text-[#4B525C] mt-0.5">
                      Real INR value per ₹100 spent ({calc.earn_unit}; default ₹{calc.point_value_inr_default} per unit).
                    </p>
                  </div>
                  <div className="text-[12.5px] bg-[#F3F2EE] px-3 py-1.5 rounded-lg text-[#1A1D21] tabular-nums">
                    Base: {calc.base_reward_rate_pct}% · Peak: {calc.accelerated_reward_rate_pct}%
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4 tabular-nums">
                  {SPEND_CATEGORY_KEYS.map((k) => {
                    const pct = calc.effective_return_pct_by_category?.[k] ?? 0;
                    const caveat = calc.category_caveats?.[k];
                    return (
                      <div key={k} className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                        <span className="block text-[12px] text-[#4B525C]">
                          {SPEND_CATEGORY_META[k].shortLabel}
                        </span>
                        <span
                          className={`block text-[17px] font-medium mt-1 ${
                            pct >= 2 ? "text-[#0F5C4D]" : pct > 0 ? "text-[#1A1D21]" : "text-[#717882]"
                          }`}
                        >
                          {pct.toFixed(2)}%
                        </span>
                        {caveat && (
                          <span className="block text-[11px] text-[#9A5B13] mt-1 leading-snug">
                            ⚠ {caveat}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {calc.category_caveats && Object.keys(calc.category_caveats).length > 0 && (
                  <div className="mt-4 bg-[#FEF6EA] border border-[#F2D7B4] rounded-lg px-3.5 py-2.5 text-[12.5px] text-[#9A5B13] space-y-1">
                    <span className="font-medium block">Partner &amp; Category Conditions:</span>
                    {Object.entries(calc.category_caveats).map(([catKey, note]) => (
                      <p key={catKey} className="leading-snug">
                        • {SPEND_CATEGORY_META[catKey as SpendCategoryKey]?.shortLabel ?? catKey}: {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Single-Card Interactive Cashback Simulator */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E4E4DF]">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                      <h3 className="text-[16px] font-medium text-[#1A1D21]">
                        Personal Return &amp; Fee Waiver Simulator
                      </h3>
                    </div>
                    <p className="text-[12.5px] text-[#717882] mt-0.5">
                      Dial in monthly spend across all 12 categories to check yearly rewards vs renewal fee.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Link
                      href="/advisor"
                      className="text-[13px] text-[#0F5C4D] hover:underline"
                    >
                      Best Card Advisor →
                    </Link>
                    <Link
                      href="/calculator"
                      className="text-[13px] text-[#0F5C4D] hover:underline"
                    >
                      Compare all {totalCardsCount ?? "active"} cards →
                    </Link>
                  </div>
                </div>

                {/* Quick Spend Scenario Presets + GST Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] text-[#717882] mr-1">Monthly Preset:</span>
                    {SPEND_SCENARIO_PRESETS.map((preset) => {
                      const active = activePresetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applySpendPreset(preset.id)}
                          className={`text-[12px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                            active
                              ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                              : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#C9C9C2] text-[#4B525C]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {fees.annual_fee_inr > 0 && (
                    <label className="inline-flex items-center gap-2 text-[12.5px] text-[#4B525C] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includeGst}
                        onChange={(e) => setIncludeGst(e.target.checked)}
                        className="accent-[#0F5C4D] w-3.5 h-3.5 cursor-pointer"
                      />
                      Include 18% GST on renewal fee
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {simResult.rows.map((row) => (
                      <div key={row.key} className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                        <div className="flex items-center justify-between text-[13px] gap-2">
                          <span className="text-[#1A1D21] truncate">{row.label}</span>
                          <span className="tabular-nums font-medium text-[#1A1D21]">
                            {formatInr(row.monthly)}/mo
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={row.max}
                          step={row.step}
                          value={row.monthly}
                          aria-label={`Monthly ${row.label} spend`}
                          onChange={(e) => {
                            setActivePresetId("custom");
                            setSimSpend((prev) => ({
                              ...prev,
                              [row.key]: Number(e.target.value),
                            }));
                          }}
                          className="ledger-range w-full mt-2 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[11.5px] text-[#717882] mt-1 tabular-nums gap-2">
                          <span>
                            Rate: {row.pct.toFixed(2)}%
                            {row.capped && row.monthlyCapInr
                              ? ` · Cap ₹${row.monthlyCapInr.toLocaleString("en-IN")}/mo (Eff: ${row.effectivePct.toFixed(1)}%)`
                              : row.monthlyCapInr
                                ? ` · Cap ₹${row.monthlyCapInr.toLocaleString("en-IN")}/mo`
                                : ""}
                          </span>
                          <span className="text-[#0F5C4D] shrink-0">
                            +{formatInr(row.annualRewardInr)}/yr
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary ledger box */}
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-3 tabular-nums">
                      <span className="text-[12px] text-[#717882]">Projected Annual Outcome</span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CONVERSION_STRATEGIES.map((st) => {
                          const active = conversionStrategy === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setConversionStrategy(st.id)}
                              className={`px-2 py-1.5 rounded-lg text-[11.5px] border transition-colors cursor-pointer ${
                                active
                                  ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                                  : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                              }`}
                            >
                              {st.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                      {conversionStrategy !== "default_inr" && (
                        <div className="bg-[#EEF5F2] border border-[#C5DFD5] rounded-lg px-2.5 py-2 text-[11.5px] text-[#0F5C4D] space-y-0.5">
                          <span className="block">{simResult.conversionResult.ratioText}</span>
                          {simResult.conversionResult.supportsStrategy &&
                            simResult.conversionResult.convertedUnitsPerYear > 0 && (
                              <span className="block font-medium">
                                ~{simResult.conversionResult.convertedUnitsPerYear.toLocaleString("en-IN")}{" "}
                                {simResult.conversionResult.unitLabel} / yr
                              </span>
                            )}
                          {simResult.conversionResult.overflowNote && (
                            <span className="block text-[#9A5B13]">
                              {simResult.conversionResult.overflowNote}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#E4E4DF] flex items-center justify-between text-[13.5px]">
                        <span className="text-[#4B525C]">Monthly / Annual Spend</span>
                        <span className="text-[#1A1D21] font-medium">
                          {formatInr(simResult.monthlySpend)} · {formatInr(simResult.annualSpend)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="text-[#4B525C]">Gross Annual Rewards</span>
                        <span className="text-[#0F5C4D] font-medium">
                          +{formatInr(simResult.annualRewardInr)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="text-[#4B525C]">Renewal Fee Charged</span>
                        <span className="text-[#1A1D21]">
                          {simResult.waiverMet
                            ? simResult.feeSavedByWaiver > 0
                              ? `₹0 (Saved ${formatInr(simResult.feeSavedByWaiver)})`
                              : "₹0 (LTF)"
                            : `-${formatInr(simResult.annualFeeCharged)}`}
                        </span>
                      </div>

                      {/* Fee Waiver Progress Bar */}
                      <div className="pt-2 border-t border-[#E4E4DF]">
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="text-[#4B525C]">Fee Waiver Tracker</span>
                          <span className={simResult.waiverMet ? "text-[#0F5C4D] font-medium" : "text-[#9A5B13]"}>
                            {fees.annual_fee_inr === 0
                              ? "Lifetime Free"
                              : simResult.waiverThreshold && simResult.waiverThreshold > 0
                                ? simResult.waiverMet
                                  ? "Waived ✓"
                                  : `${simResult.waiverProgressPct}% (${formatInr(simResult.remainingForWaiver)} short)`
                                : "No spend-based waiver"}
                          </span>
                        </div>
                        {(fees.annual_fee_inr === 0 || (simResult.waiverThreshold && simResult.waiverThreshold > 0)) && (
                          <div className="h-2 bg-[#E4E4DF] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${simResult.waiverProgressPct}%` }}
                              transition={calmTransition}
                              className={`h-full rounded-full ${
                                simResult.waiverMet ? "bg-[#0F5C4D]" : "bg-[#9A5B13]"
                              }`}
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#E4E4DF] flex items-center justify-between">
                        <span className="text-[14px] font-medium text-[#1A1D21]">Net Annual Benefit</span>
                        <span
                          className={`text-[21px] font-medium ${
                            simResult.netAnnualValue >= 0 ? "text-[#0F5C4D]" : "text-[#991B1B]"
                          }`}
                        >
                          {formatInr(simResult.netAnnualValue)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#4B525C]">
                        Blended Net Yield:{" "}
                        <span className="font-medium text-[#1A1D21]">
                          {simResult.effectiveOverallPct.toFixed(2)}%
                        </span>{" "}
                        {simResult.netAnnualValue >= 0
                          ? `— Pays for itself (+${formatInr(simResult.netAnnualValue)} net).`
                          : "— Fee exceeds rewards at current spend."}
                      </p>
                    </div>

                    {/* Welcome & Milestone Slabs Context */}
                    <div className="space-y-2 pt-3 border-t border-[#E4E4DF]">
                      {calc.fee_waiver_and_milestone_calculator?.milestone_slabs?.length > 0 && (
                        <div>
                          <span className="block text-[11.5px] font-medium text-[#1A1D21]">
                            Milestone Bonuses (Not Added Above)
                          </span>
                          <ul className="mt-1 space-y-1">
                            {calc.fee_waiver_and_milestone_calculator.milestone_slabs.slice(0, 3).map((ms, i) => (
                              <li key={i} className="text-[11.5px] text-[#4B525C] leading-snug">
                                • {ms}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {simResult.capNotes.length > 0 && (
                        <div className="bg-[#FEF6EA] border border-[#9A5B13]/20 rounded-lg p-2.5 text-[11.5px] text-[#9A5B13] space-y-0.5">
                          {simResult.capNotes.map((note, idx) => (
                            <div key={`${note}-${idx}`}>• {note}</div>
                          ))}
                        </div>
                      )}
                      <p className="text-[11.5px] text-[#717882] leading-relaxed">
                        Simulation enforces monthly category reward caps and shared pools where applicable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earning Rules, Point Value Matrix, Capping, Exclusions, Transfer Partners */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-[15.5px] font-medium text-[#1A1D21]">Earning Rules &amp; Expiry</h3>
                    <p className="text-[13px] text-[#717882] mt-1">Point Expiry: {calc.point_expiry}</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {(calc.reward_earning_rules || []).map((rule, i) => (
                        <li key={i} className="text-[13.5px] text-[#4B525C] leading-relaxed">• {rule}</li>
                      ))}
                    </ul>
                  </div>

                  {calc.point_value_inr_matrix && Object.keys(calc.point_value_inr_matrix).length > 0 && (
                    <div className="pt-4 border-t border-[#E4E4DF]">
                      <h4 className="text-[14px] font-medium text-[#1A1D21]">Redemption Value Matrix</h4>
                      <div className="mt-2 space-y-1.5 tabular-nums">
                        {Object.entries(calc.point_value_inr_matrix).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between text-[13px] bg-[#FAF9F6] px-3 py-1.5 rounded-md">
                            <span className="text-[#4B525C]">{formatMatrixKey(k)}</span>
                            <span className="text-[#1A1D21] font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
                  {calc.monthly_capping_rules?.length > 0 && (
                    <div>
                      <h3 className="text-[15.5px] font-medium text-[#1A1D21]">Monthly Capping Rules</h3>
                      <ul className="mt-2 space-y-1.5">
                        {calc.monthly_capping_rules.map((c, i) => (
                          <li key={i} className="text-[13.5px] text-[#4B525C] leading-relaxed">• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {calc.excluded_categories?.length > 0 && (
                    <div className="pt-4 border-t border-[#E4E4DF]">
                      <h4 className="text-[14px] font-medium text-[#9A5B13]">Excluded Spend Categories</h4>
                      <p className="text-[13px] text-[#4B525C] mt-1.5 leading-relaxed">
                        {calc.excluded_categories.join(" · ")}
                      </p>
                    </div>
                  )}

                  {calc.transfer_partners && calc.transfer_partners.length > 0 && (
                    <div className="pt-4 border-t border-[#E4E4DF]">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[14.5px] font-medium text-[#1A1D21]">
                          Airline &amp; Hotel Transfer Partners
                        </h4>
                        <span className="text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-md font-medium">
                          {calc.transfer_partners.length} partners
                        </span>
                      </div>
                      {calc.transfer_partners.some((tp) => typeof tp === "object" && tp.ratio) ? (
                        <div className="mt-2.5 border border-[#E4E4DF] rounded-lg overflow-hidden">
                          <table className="w-full text-left text-[12.5px]">
                            <thead className="bg-[#EEF4FA] text-[#4B525C] uppercase text-[11px] tracking-wide">
                              <tr>
                                <th className="py-2 px-3 font-medium">Partner</th>
                                <th className="py-2 px-3 font-medium">Conversion Rate</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E4DF]">
                              {calc.transfer_partners.map((tp, i) => {
                                const partnerName =
                                  typeof tp === "string" ? tp : tp.partner ?? "Partner";
                                const ratioText =
                                  typeof tp === "string"
                                    ? "1:1 / Standard"
                                    : tp.ratio || "1:1";
                                const noteText =
                                  typeof tp === "string" ? "" : tp.notes || "";
                                return (
                                  <tr key={i} className={i % 2 === 1 ? "bg-[#FAF9F6]" : "bg-white"}>
                                    <td className="py-2 px-3 text-[#4B525C] font-medium">
                                      {partnerName}
                                      {noteText ? (
                                        <span className="block text-[11px] font-normal text-[#717882]">
                                          {noteText}
                                        </span>
                                      ) : null}
                                    </td>
                                    <td className="py-2 px-3 text-[#1A1D21] font-medium tabular-nums">
                                      {ratioText}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {calc.transfer_partners.map((tp, i) => {
                            const text =
                              typeof tp === "string"
                                ? tp
                                : `${tp.partner ?? ""} ${tp.ratio ? `(${tp.ratio})` : ""}`;
                            return (
                              <span key={i} className="text-[12px] bg-[#EEF5F2] text-[#0F5C4D] px-2.5 py-1 rounded-md">
                                {text}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Structured Bento Tables (Reward Slabs, Portals, Gold Collection, Milestones) */}
              {(() => {
                const rewardTables = (calc.structured_tables || []).filter(
                  (t) =>
                    t.rows?.length > 0 &&
                    !["fees_and_charges", "lounge_access", "eligibility"].includes(t.kind) &&
                    !(
                      t.kind === "transfer_partners" &&
                      calc.transfer_partners?.some((tp) => typeof tp === "object" && tp.ratio)
                    )
                );
                if (rewardTables.length === 0) return null;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {rewardTables.slice(0, 8).map((tbl) => (
                      <StructuredTableBentoCard key={tbl.id} table={tbl} />
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeTab === "lounges" && (
            <motion.div
              key="lounges"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={calmTransition}
              className="space-y-6"
            >
              {/* Domestic / International / Railway Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#0F5C4D]">
                    <Plane className="w-4 h-4" aria-hidden="true" />
                    <h3 className="text-[15px] font-medium text-[#1A1D21]">Domestic Airport Lounge</h3>
                  </div>
                  <p className="text-[13.5px] text-[#4B525C] mt-2 leading-relaxed">
                    {lounge.domestic.summary || "Not included on this card"}
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#E4E4DF] space-y-1 text-[12.5px] text-[#717882] tabular-nums">
                    <div>
                      Quota: {formatQuotaNumber(lounge.domestic.visits_per_year)} / yr ({formatQuotaNumber(lounge.domestic.visits_per_quarter)} / qtr)
                    </div>
                    <div>Spend Rule: {lounge.domestic.spend_criteria || "None"}</div>
                    <div>Add-on Holder: {String(lounge.domestic.add_on_allowed)}</div>
                  </div>
                </div>

                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#0F5C4D]">
                    <Plane className="w-4 h-4" aria-hidden="true" />
                    <h3 className="text-[15px] font-medium text-[#1A1D21]">International Lounge</h3>
                  </div>
                  <p className="text-[13.5px] text-[#4B525C] mt-2 leading-relaxed">
                    {lounge.international.summary || "Not included on this card"}
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#E4E4DF] space-y-1 text-[12.5px] text-[#717882] tabular-nums">
                    <div>Program: {lounge.international.program || "N/A"}</div>
                    <div>Quota: {formatLoungeQuota(lounge.international.visits_per_year, 0, lounge.has_international_lounge)}</div>
                    <div>Guest Fee: {lounge.international.guest_fee || "Check T&C"}</div>
                  </div>
                </div>

                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5">
                  <div className="flex items-center gap-2 text-[#0F5C4D]">
                    <Train className="w-4 h-4" aria-hidden="true" />
                    <h3 className="text-[15px] font-medium text-[#1A1D21]">Railway Lounge (IRCTC)</h3>
                  </div>
                  <p className="text-[13.5px] text-[#4B525C] mt-2 leading-relaxed">
                    {lounge.railway.summary || "Not included on this card"}
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#E4E4DF] space-y-1 text-[12.5px] text-[#717882] tabular-nums">
                    <div>
                      Quota: {formatQuotaNumber(lounge.railway.visits_per_year)} / yr ({formatQuotaNumber(lounge.railway.visits_per_quarter)} / qtr)
                    </div>
                  </div>
                </div>
              </div>

              {/* Golf & Country Club Details inside Lounges & Travel */}
              {hasGolf && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[#0F5C4D]">
                      <Flag className="w-4 h-4" aria-hidden="true" />
                      <h3 className="text-[15.5px] font-medium text-[#1A1D21]">
                        Golf Green Fee Waiver &amp; Lessons
                      </h3>
                    </div>
                    <Link
                      href="/categories?cat=golf"
                      className="text-[12.5px] text-[#0F5C4D] hover:underline"
                    >
                      Golf Comparison Matrix →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-[13px]">
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                      <span className="block text-[11.5px] text-[#717882]">Complimentary Rounds / Coaching</span>
                      <span className="block text-[#1A1D21] font-medium mt-1">
                        {benefits.golf_summary?.complimentary_access ||
                          benefits.golf_benefits?.[0] ||
                          "Complimentary green fee waiver"}
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                      <span className="block text-[11.5px] text-[#717882]">Eligible Courses</span>
                      <span className="block text-[#1A1D21] font-medium mt-1">
                        {benefits.golf_summary?.eligible_courses || "Domestic Courses"}
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                      <span className="block text-[11.5px] text-[#717882]">Spend &amp; Network Rule</span>
                      <span className="block text-[#4B525C] mt-1">
                        {benefits.golf_summary?.spend_condition || "Advance concierge booking required"}
                      </span>
                    </div>
                  </div>
                  {benefits.golf_benefits && benefits.golf_benefits.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[13px] text-[#4B525C]">
                      {benefits.golf_benefits.map((gb, i) => (
                        <li key={i}>• {gb}</li>
                      ))}
                    </ul>
                  )}

                  {(() => {
                    const guide = matchGolfGuideForCard(
                      identity.bank,
                      identity.card_network,
                      identity.card_name
                    );
                    return (
                      <div className="mt-4 pt-3 border-t border-[#E4E4DF] space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12.5px] font-medium text-[#1A1D21]">
                            How to Claim ({guide.programName})
                          </span>
                          <Link
                            href="/lounges?view=golf"
                            className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                          >
                            All Golf Portals &amp; Mastercard Courses →
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                          <a
                            href={guide.portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-1 bg-[#EEF5F2] text-[#0F5C4D] font-medium px-2.5 py-1 rounded-md hover:underline"
                          >
                            <span>Portal: {guide.portalLabel}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={`tel:${guide.helplinePhone.replace(/[^+\d]/g, "")}`}
                            className="inline-flex items-center gap-1 bg-[#FAF9F6] border border-[#E4E4DF] text-[#1A1D21] font-medium px-2.5 py-1 rounded-md tabular-nums"
                          >
                            <Phone className="w-3 h-3 text-[#0F5C4D]" />
                            <span>Helpline: {guide.helplinePhone}</span>
                          </a>
                          <span className="text-[#717882]">Book {guide.bookingWindow}</span>
                        </div>
                        <p className="text-[12px] text-[#4B525C]">
                          1. {guide.steps[0]} 2. {guide.steps[1]}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Applicable Official Lounge Links */}
              {lounge.applicable_lounge_links?.length > 0 && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[15.5px] font-medium text-[#1A1D21]">
                      Official Applicable Lounge Lists &amp; Online QR Portals
                    </h3>
                    <Link
                      href="/lounges"
                      className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                    >
                      Check Terminal QR Acceptance →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[12px]">
                    <a
                      href="https://www.loungeone.ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#EEF5F2] text-[#0F5C4D] font-medium px-2.5 py-1 rounded-md hover:underline inline-flex items-center gap-1"
                    >
                      LoungeOne QR (loungeone.ai) <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://www.loungeaccess.travelfoodservices.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#EEF5F2] text-[#0F5C4D] font-medium px-2.5 py-1 rounded-md hover:underline inline-flex items-center gap-1"
                    >
                      TFS Travel Club QR <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://www.lms.hoi.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#EEF5F2] text-[#0F5C4D] font-medium px-2.5 py-1 rounded-md hover:underline inline-flex items-center gap-1"
                    >
                      HOI Pass (lms.hoi.in) <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                    {lounge.applicable_lounge_links.map((lnk, idx) => (
                      <a
                        key={`${lnk.url}-${idx}`}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="flex items-center justify-between gap-3 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#E4E4DF] rounded-lg px-3.5 py-2.5 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="block text-[13.5px] font-medium text-[#1A1D21] truncate">
                            {lnk.title}
                          </span>
                          <span className="block text-[11.5px] text-[#717882] truncate">
                            {formatLoungeSourceType(lnk.source_type)}
                            {lnk.parsed_lounges_count ? ` · ${lnk.parsed_lounges_count} lounges indexed` : ""}
                          </span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-[#0F5C4D] shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Lounge Matrix Boxes */}
              {(() => {
                const loungeTables = (calc.structured_tables || []).filter(
                  (t) => t.kind === "lounge_access" && t.rows?.length > 0
                );
                if (loungeTables.length === 0) return null;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {loungeTables.slice(0, 4).map((tbl) => (
                      <StructuredTableBentoCard key={tbl.id} table={tbl} />
                    ))}
                  </div>
                );
              })()}

              {/* Searchable Participating Lounges Table (All Accessible Lounges in India) */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-medium text-[#1A1D21]">
                        Domestic Lounges Accessible in India ({combinedIndianLounges.length})
                      </h3>
                      {effectiveDomesticLoungeCount > 0 && (
                        <span className="text-[11.5px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-2.5 py-0.5 rounded-full tabular-nums">
                          {effectiveDomesticLoungeCount} domestic spots
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#717882] mt-0.5">
                      {lounge.no_lounge_note || "Tap any lounge below for terminal photos, hours, reviews, and step-by-step QR access."}
                    </p>
                  </div>
                  {combinedIndianLounges.length > 0 && (
                    <div className="w-full sm:w-72">
                      <GooeySearchInput
                        mode="bar"
                        value={loungeQuery}
                        onValueChange={setLoungeQuery}
                        placeholder="Filter by city, terminal, lounge..."
                        ariaLabel="Filter accessible Indian lounges"
                      />
                    </div>
                  )}
                </div>

                {filteredLounges.length > 0 ? (
                  <div className="mt-4 overflow-x-auto max-h-[420px] overflow-y-auto border border-[#E4E4DF] rounded-lg">
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-[#F3F2EE] text-[#4B525C] sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3.5 font-medium">City</th>
                          <th className="py-2.5 px-3.5 font-medium">Lounge Name</th>
                          <th className="py-2.5 px-3.5 font-medium">Terminal</th>
                          <th className="py-2.5 px-3.5 font-medium">Type</th>
                          <th className="py-2.5 px-3.5 font-medium text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4DF]">
                        {filteredLounges.map((spot, idx) => (
                          <tr key={`${spot.lounge_code || spot.city}-${spot.lounge_name}-${idx}`} className="hover:bg-[#FAF9F6]">
                            <td className="py-2.5 px-3.5 text-[#1A1D21] whitespace-nowrap">{spot.city}</td>
                            <td className="py-2.5 px-3.5 text-[#1A1D21] font-medium">
                              {spot.lounge_code ? (
                                <Link href={`/lounges/${spot.lounge_code}`} className="hover:text-[#0F5C4D] hover:underline">
                                  {spot.lounge_name}
                                </Link>
                              ) : (
                                spot.lounge_name
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-[#4B525C]">{spot.terminal || "—"}</td>
                            <td className="py-2.5 px-3.5 text-[#717882]">{spot.terminal_type || "Domestic"}</td>
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                              {spot.lounge_code ? (
                                <Link
                                  href={`/lounges/${spot.lounge_code}`}
                                  className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                                >
                                  View →
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[13.5px] text-[#717882] mt-4">
                    {combinedIndianLounges.length > 0
                      ? `No lounges matched "${loungeQuery}".`
                      : "No participating lounge list matched for this card."}
                  </p>
                )}

                {accessibleGolfClubs.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E4E4DF]">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h4 className="text-[14.5px] font-medium text-[#1A1D21]">
                        Golf Courses Accessible ({accessibleGolfClubs.length} Indian Clubs)
                      </h4>
                      <Link href={`/lounges?view=golf&card=${encodeURIComponent(identity.card_id)}`} className="text-[12px] font-medium text-[#0F5C4D] hover:underline">
                        Open in Lounge &amp; Golf Explorer →
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {accessibleGolfClubs.slice(0, 12).map((club) => (
                        <Link
                          key={club.slug}
                          href={`/lounges/${club.slug}`}
                          className="flex items-center justify-between gap-2 bg-[#FAF9F6] hover:bg-[#EEF5F2] border border-[#E4E4DF] rounded-lg px-3 py-2 text-[12.5px] transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[#1A1D21] truncate">{club.club_name}</p>
                            <p className="text-[11px] text-[#717882]">{club.city}</p>
                          </div>
                          {club.google_rating ? (
                            <span className="text-[11px] text-[#9A5B13] font-medium shrink-0">★ {club.google_rating}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "fees" && (
            <motion.div
              key="fees"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={calmTransition}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Fees & Charges Table */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <h2 className="text-[17px] font-medium text-[#1A1D21]">Fees, Interest &amp; Charges</h2>
                <div className="mt-4 divide-y divide-[#E4E4DF] text-[13.5px] tabular-nums">
                  {[
                    ["Joining Fee", `${formatInr(fees.joining_fee_inr, true)}${fees.joining_fee_waiver ? ` (${fees.joining_fee_waiver})` : ""}`],
                    ["Annual / Renewal Fee", fees.annual_fee_inr === 0 ? "₹0 (Lifetime Free)" : `${formatInr(fees.annual_fee_inr)}${fees.gst_applicable ? " + 18% GST" : ""}`],
                    ["Annual Fee Waiver Condition", fees.fee_waiver_spend_inr ? `Spend ${formatInr(fees.fee_waiver_spend_inr)} in a card year` : "None / LTF"],
                    ["Forex Markup", `${fees.forex_markup_pct}% + GST`],
                    ["Finance Charge (APR)", `${fees.apr_monthly_pct}% per month (${fees.apr_annual_pct}% p.a.)`],
                    ["Cash Advance Fee", fees.cash_advance_fee || "Check MITC"],
                    ["Fuel Surcharge Waiver", fees.fuel_surcharge_waiver || "Not specified"],
                    ["Reward Redemption Fee", fees.redemption_fee || "Check MITC"],
                    ["Add-on Card Fee", fees.add_on_card_fee || "Check MITC"],
                  ].map(([k, v]) => (
                    <div key={k} className="py-2.5 flex items-start justify-between gap-4">
                      <span className="text-[#4B525C] shrink-0">{k}</span>
                      <span className="text-[#1A1D21] text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {fees.late_payment_slabs?.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#E4E4DF]">
                    <h3 className="text-[14.5px] font-medium text-[#1A1D21]">Late Payment Fee Slabs</h3>
                    <div className="mt-2.5 border border-[#E4E4DF] rounded-lg overflow-hidden text-[12.5px] tabular-nums">
                      <table className="w-full text-left">
                        <thead className="bg-[#F3F2EE] text-[#4B525C]">
                          <tr>
                            <th className="py-2 px-3 font-medium">Statement Balance Slab</th>
                            <th className="py-2 px-3 font-medium text-right">Late Fee</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4DF]">
                          {fees.late_payment_slabs.map((slab, i) => {
                            const label =
                              typeof slab === "string"
                                ? slab
                                : slab.statement_balance_slab || slab.balance_range || "Slab";
                            const fee =
                              typeof slab === "string"
                                ? ""
                                : slab.late_fee_inr || slab.fee || "Check MITC";
                            return (
                              <tr key={i}>
                                <td className="py-2 px-3 text-[#4B525C]">{label}</td>
                                <td className="py-2 px-3 text-[#1A1D21] text-right">{fee}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Eligibility Criteria */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 h-fit">
                <h2 className="text-[17px] font-medium text-[#1A1D21]">Eligibility Criteria</h2>
                <div className="mt-4 divide-y divide-[#E4E4DF] text-[13.5px] tabular-nums">
                  {[
                    ["Occupation", elig.occupation],
                    ["Age Range", elig.age_range],
                    ["Min Monthly Income (Salaried)", elig.min_monthly_income_salaried_inr ? formatInr(elig.min_monthly_income_salaried_inr) : "Discretionary / Relationship"],
                    ["Min Annual ITR (Self-Employed)", elig.min_annual_itr_self_employed_inr ? formatInr(elig.min_annual_itr_self_employed_inr) : "Discretionary / Relationship"],
                    ["Min Recommended CIBIL", `${elig.min_cibil_score}+`],
                  ].map(([k, v]) => (
                    <div key={k} className="py-2.5 flex items-start justify-between gap-4">
                      <span className="text-[#4B525C]">{k}</span>
                      <span className="text-[#1A1D21] text-right">{v}</span>
                    </div>
                  ))}
                </div>

                {elig.govt_employee_income_note && (
                  <div className="mt-4 bg-[#EEF5F2] border border-[#0F5C4D]/20 rounded-lg p-3.5 text-[13px] text-[#0F5C4D]">
                    <span className="font-medium block">Government Employee / PSU Note</span>
                    <span className="mt-1 block text-[#1A1D21]">{elig.govt_employee_income_note}</span>
                  </div>
                )}

                {elig.approval_notes && (
                  <div className="mt-4 bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5 text-[13px] text-[#4B525C] flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{elig.approval_notes}</span>
                  </div>
                )}
              </div>
              </div>

              {/* Structured Fees & Eligibility Bento Boxes */}
              {(() => {
                const feeTables = (calc.structured_tables || []).filter(
                  (t) =>
                    (t.kind === "fees_and_charges" || t.kind === "eligibility") &&
                    t.rows?.length > 0
                );
                if (feeTables.length === 0) return null;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {feeTables.slice(0, 4).map((tbl) => (
                      <StructuredTableBentoCard key={tbl.id} table={tbl} />
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activeTab === "devals" && (
            <motion.div
              key="devals"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={calmTransition}
              className="space-y-6"
            >
              {/* Devaluation Risk Card */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-[#9A5B13]" aria-hidden="true" />
                    <h2 className="text-[17px] font-medium text-[#1A1D21]">Devaluation Risk &amp; Track Record</h2>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] tabular-nums">
                    <span className={`px-2.5 py-1 rounded-md border ${riskBadgeStyle}`}>
                      Risk Score: {deval.devaluation_risk_score} / 10
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-[#F3F2EE] text-[#4B525C] capitalize">
                      Frequency: {deval.devaluation_frequency}
                    </span>
                    {deval.last_devalued_on && (
                      <span className="px-2.5 py-1 rounded-md bg-[#F3F2EE] text-[#4B525C]">
                        Last: {deval.last_devalued_on}
                      </span>
                    )}
                  </div>
                </div>

                {deval.devaluation_history?.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13.5px] font-medium text-[#1A1D21]">Recorded Devaluation Changes</h3>
                      <Link
                        href={`/devaluations?issuer=${encodeURIComponent(identity.bank)}`}
                        className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                      >
                        Compare issuer timeline →
                      </Link>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {deval.devaluation_history.map((item, i) => (
                        <li
                          key={i}
                          className="text-[13.5px] text-[#1A1D21] leading-relaxed bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-[#9A5B13] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {deval.watch_out_vectors?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E4E4DF]">
                    <h3 className="text-[13.5px] font-medium text-[#1A1D21]">What to Watch Out For</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {deval.watch_out_vectors.map((vec, i) => (
                        <span key={i} className="text-[12.5px] bg-[#FEF6EA] text-[#9A5B13] px-2.5 py-1 rounded-md">
                          {vec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pro Hacks & Community Optimization Tips */}
              {(dossier.reddit_user_feedback?.optimization_tips || []).length > 0 && (
                <div className="bg-[#EEF5F2] border border-[#0F5C4D]/25 rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#0F5C4D]" aria-hidden="true" />
                      <h2 className="text-[17px] font-medium text-[#0F5C4D]">
                        Pro Hacks &amp; Reward Optimization Tips
                      </h2>
                    </div>
                    <span className="text-[11.5px] font-medium text-[#0F5C4D] bg-white/80 border border-[#0F5C4D]/20 px-2.5 py-0.5 rounded-full">
                      Verified Playbook
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {(dossier.reddit_user_feedback.optimization_tips || []).map((tip, i) => (
                      <li
                        key={i}
                        className="bg-white/90 border border-[#0F5C4D]/15 rounded-lg p-3.5 text-[13.5px] text-[#1A1D21] leading-relaxed flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Partner Conditions & Key Watch-Outs */}
              {((calc.category_caveats && Object.keys(calc.category_caveats).length > 0) ||
                (dossier.pros_and_cons.cons && dossier.pros_and_cons.cons.length > 0)) && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <CanvaFeatureIcon icon="devaluation" size={22} />
                    <h2 className="text-[17px] font-medium text-[#1A1D21]">
                      Important Conditions &amp; Category Exclusions
                    </h2>
                  </div>
                  {calc.category_caveats && Object.keys(calc.category_caveats).length > 0 && (
                    <div className="bg-[#FEF6EA] border border-[#F2D7B4] rounded-lg p-4 space-y-1.5">
                      <h3 className="text-[13.5px] font-medium text-[#9A5B13]">
                        Partner-Specific Cap &amp; Reward Rules
                      </h3>
                      <ul className="space-y-1">
                        {Object.entries(calc.category_caveats).map(([catKey, note]) => (
                          <li key={catKey} className="text-[13px] text-[#4B525C] leading-relaxed">
                            • <strong className="text-[#1A1D21]">{SPEND_CATEGORY_META[catKey as SpendCategoryKey]?.shortLabel ?? catKey}:</strong> {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {verdict.cons?.length > 0 && (
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-4">
                      <h3 className="text-[13.5px] font-medium text-[#1A1D21]">Key Watch-Outs</h3>
                      <ul className="mt-2 space-y-1.5">
                        {verdict.cons.map((w, i) => (
                          <li key={i} className="text-[13px] text-[#4B525C] leading-relaxed">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* FAQs Accordion */}
              {benefits.faqs?.length > 0 && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6">
                  <h2 className="text-[17px] font-medium text-[#1A1D21]">Frequently Asked Questions</h2>
                  <div className="mt-3 divide-y divide-[#E4E4DF]">
                    {benefits.faqs.map((faq, idx) => {
                      const question = faq.question || faq.q || "Question";
                      const answer = faq.answer || faq.a || "";
                      const isOpen = openFaqIdx === idx;
                      return (
                        <div key={idx} className="py-3">
                          <button
                            type="button"
                            onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-4 text-left text-[14px] font-medium text-[#1A1D21] cursor-pointer py-1"
                          >
                            <span>{question}</span>
                            <ChevronDown
                              className={`w-4 h-4 text-[#717882] shrink-0 transition-transform duration-200 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={fastTransition}
                                className="overflow-hidden"
                              >
                                <p className="text-[13.5px] text-[#4B525C] leading-relaxed pt-2">
                                  {answer}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Related Cards Feature Comparison Table */}
      {relatedRows.length > 1 && (
        <section className="mt-10 pt-8 border-t border-[#E4E4DF]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-[19px] font-medium text-[#1A1D21]">
                Related Cards Feature Matrix
              </h2>
              <p className="text-[13.5px] text-[#4B525C] mt-0.5">
                Side-by-side comparison of {identity.card_name} against direct alternatives and same-category peers.
              </p>
            </div>
            <Link
              href={`/compare?ids=${encodeURIComponent(
                relatedRows.slice(0, 4).map((r) => r.card_id).join(",")
              )}`}
              className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0"
            >
              Open Full 4-Card Comparator →
            </Link>
          </div>

          <div className="mt-4 bg-white border border-[#E4E4DF] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[920px] text-left border-collapse tabular-nums text-[12.5px]">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[#717882]">
                  <th className="py-3 px-4 font-medium">Card</th>
                  <th className="py-3 px-3 font-medium">Annual Fee</th>
                  <th className="py-3 px-3 font-medium">Waiver</th>
                  <th className="py-3 px-3 font-medium">Peak</th>
                  <th className="py-3 px-3 font-medium">Fuel</th>
                  <th className="py-3 px-3 font-medium">Grocery</th>
                  <th className="py-3 px-3 font-medium">Online</th>
                  <th className="py-3 px-3 font-medium">Travel</th>
                  <th className="py-3 px-3 font-medium">Dom Lounge</th>
                  <th className="py-3 px-3 font-medium">Forex</th>
                  <th className="py-3 px-3 font-medium">Ratings</th>
                  <th className="py-3 px-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4DF]">
                {relatedRows.map((row) => {
                  const rowCompared = isSelected(row.card_id);
                  return (
                    <tr
                      key={row.card_id}
                      className={row.is_current ? "bg-[#EEF5F2]/45" : "hover:bg-[#FAF9F6] transition-colors"}
                    >
                      <td className="py-3 px-4 max-w-[230px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10.5px] px-1.5 py-0.5 rounded ${
                              row.is_current
                                ? "bg-[#0F5C4D] text-white"
                                : "bg-[#F3F2EE] text-[#4B525C]"
                            }`}
                          >
                            {row.is_current ? "This Card" : roleLabel(row.relation_label)}
                          </span>
                          {row.is_rupay_upi && (
                            <span className="text-[10.5px] bg-[#EEF5F2] text-[#0F5C4D] px-1.5 py-0.5 rounded">
                              UPI
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/${row.bank_slug}/${row.card_slug}`}
                          className="block text-[13px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] mt-1 leading-snug"
                        >
                          {row.card_name}
                        </Link>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-[#717882]">
                          <BankLogo bankSlug={row.bank_slug} bank={row.bank} size="xs" />
                          <span>{row.bank}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#1A1D21]">
                        {row.annual_fee_inr === 0 ? "₹0 (LTF)" : formatInr(row.annual_fee_inr)}
                      </td>
                      <td className="py-3 px-3 text-[#4B525C]">
                        {row.annual_fee_inr === 0
                          ? "None"
                          : row.fee_waiver_spend_inr
                            ? formatInr(row.fee_waiver_spend_inr)
                            : "—"}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#0F5C4D]">
                        {row.peak_return_pct.toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 text-[#1A1D21]">{row.fuel_pct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-[#1A1D21]">{row.grocery_pct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-[#1A1D21]">{row.online_pct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-[#1A1D21]">{row.travel_pct.toFixed(1)}%</td>
                      <td className="py-3 px-3 text-[#4B525C] max-w-[115px]">{row.dom_lounge}</td>
                      <td className="py-3 px-3 text-[#4B525C]">{row.forex_markup_pct}%</td>
                      <td className="py-3 px-3 text-[#4B525C]">
                        <span className="block text-[#1A1D21]">★ {row.market_rating.toFixed(1)}</span>
                        <span className="block text-[11px] text-[#717882]">
                          Deval Risk {row.deval_risk_score}/10
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            toggleItem({
                              card_id: row.card_id,
                              card_name: row.card_name,
                              bank: row.bank,
                              bank_slug: row.bank_slug,
                              card_slug: row.card_slug,
                              annual_fee_inr: row.annual_fee_inr,
                              overall_rating: row.market_rating,
                            })
                          }
                          className={`inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                            rowCompared
                              ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                              : "bg-white border-[#E4E4DF] hover:border-[#C9C9C2] text-[#1A1D21]"
                          }`}
                        >
                          {rowCompared ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {rowCompared ? "Added" : "Compare"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bank Customer Care, L1/L2/L3 PNO & Governance Escalation Strip */}
      {(() => {
        const bankHelp = getBankHelpBySlug(identity.bank_slug);
        if (!bankHelp) return null;
        return (
          <section className="mt-10 bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                <h2 className="text-[16px] font-medium text-[#1A1D21]">
                  {bankHelp.bank} Customer Care, L1 / L2 / L3 PNO &amp; Blocking Helplines
                </h2>
              </div>
              <Link
                href={`/help?bank=${encodeURIComponent(identity.bank_slug)}`}
                className="text-[12.5px] font-medium text-[#0F5C4D] hover:underline"
              >
                Full Escalation &amp; RBI Guide →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[12.5px]">
              <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
                <span className="block text-[11px] text-[#717882] font-medium">24x7 Helpline / Block</span>
                <span className="block font-semibold text-[#1A1D21] mt-0.5">{bankHelp.helplineTollFree}</span>
                <span className="block text-[11px] text-[#B42318] mt-1">Block: {bankHelp.cardBlockNumber}</span>
              </div>
              <div className="bg-[#EEF5F2]/50 border border-[#CBE0D7] rounded-lg p-3">
                <span className="block text-[11px] text-[#0F5C4D] font-medium">L1 · Customer Care ({bankHelp.l1Sla})</span>
                <span className="block font-medium text-[#1A1D21] mt-0.5 break-all">{bankHelp.l1Email}</span>
              </div>
              <div className="bg-[#EFF6FF]/60 border border-[#BFDBFE] rounded-lg p-3">
                <span className="block text-[11px] text-[#1D4ED8] font-medium">L2 · Nodal Officer ({bankHelp.l2Sla})</span>
                <span className="block font-medium text-[#1A1D21] mt-0.5 break-all">{bankHelp.l2NodalEmail}</span>
              </div>
              <div className="bg-[#FEF6EA]/60 border border-[#F2D7B4] rounded-lg p-3">
                <span className="block text-[11px] text-[#9A5B13] font-medium">L3 · PNO &amp; Governance</span>
                <span className="block font-semibold text-[#1A1D21] mt-0.5 break-all">{bankHelp.l3PnoEmail}</span>
                <span className="block text-[11px] text-[#4B525C] mt-0.5 break-all">Gov: {bankHelp.governanceEmail}</span>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Official Bank MITC & Disclosures (Bottom Placement) */}
      {(official_and_reference_links.mitc_pdf_url ||
        official_and_reference_links.bank_url ||
        (lounge.applicable_lounge_links && lounge.applicable_lounge_links.length > 0)) && (
        <section className="mt-10 bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CanvaFeatureIcon icon="mitc" size={24} />
              <div>
                <h2 className="text-[16px] font-medium text-[#1A1D21]">
                  Official Bank MITC, Fee Schedule &amp; Disclosures
                </h2>
                <p className="text-[12.5px] text-[#4B525C]">
                  Always verify latest exclusions, monthly caps, and renewal criteria directly on issuer documents.
                </p>
              </div>
            </div>
            <Link
              href={`/devaluations?issuer=${encodeURIComponent(identity.bank)}`}
              className="text-[12.5px] font-medium text-[#0F5C4D] hover:underline"
            >
              View Bank Devaluation Tracker →
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {sanitizeExternalHref(official_and_reference_links.mitc_pdf_url) && (
              <a
                href={sanitizeExternalHref(official_and_reference_links.mitc_pdf_url)!}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-2 text-[13px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-4 py-2 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                Download {identity.bank} MITC / T&amp;C PDF
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
            {sanitizeExternalHref(official_and_reference_links.bank_url) && (
              <a
                href={sanitizeExternalHref(official_and_reference_links.bank_url)!}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-2 text-[13px] font-medium bg-[#FAF9F6] hover:bg-[#EEF5F2] border border-[#E4E4DF] text-[#1A1D21] px-4 py-2 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                Official {identity.bank} Card Page
              </a>
            )}
            {lounge.applicable_lounge_links?.slice(0, 3).map((lnk, idx) =>
              sanitizeExternalHref(lnk.url) ? (
                <a
                  key={`${lnk.url}-${idx}`}
                  href={sanitizeExternalHref(lnk.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="inline-flex items-center gap-1.5 text-[12.5px] bg-[#FAF9F6] hover:bg-[#EEF5F2] border border-[#E4E4DF] text-[#0F5C4D] px-3 py-2 rounded-lg transition-colors"
                >
                  <Plane className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{lnk.title}</span>
                </a>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* Alternate Options */}
      {alts && alts.length > 0 && (
        <section className="mt-10 pt-8 border-t border-[#E4E4DF]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[19px] font-medium text-[#1A1D21]">Alternate Options to Consider</h2>
              <p className="text-[13.5px] text-[#4B525C] mt-0.5">
                Same-tier competitors, lower-fee substitutes, or upgrade paths compared side by side.
              </p>
            </div>
            <Link
              href={`/compare?ids=${encodeURIComponent(
                [identity.card_id, ...alts.slice(0, 2).map((a) => a.card_id)].join(",")
              )}`}
              className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0"
            >
              Compare Top 3 →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {alts.map((alt) => (
              <Link
                key={alt.card_id}
                href={`/${alt.bank_slug}/${alt.card_slug}`}
                className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/45 rounded-xl p-4 transition-colors flex flex-col justify-between gap-3"
              >
                <div>
                  <span className="inline-block text-[11.5px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-md">
                    {roleLabel(alt.role)}
                  </span>
                  <h3 className="text-[15px] font-medium text-[#1A1D21] mt-2 leading-snug">
                    {alt.card_name}
                  </h3>
                  <p className="inline-flex items-center gap-1.5 text-[12px] text-[#717882] mt-1">
                    <BankLogo bankSlug={alt.bank_slug} bank={alt.bank} size="xs" />
                    <span>{alt.bank}</span>
                  </p>
                  <p className="text-[13px] text-[#4B525C] mt-2 leading-relaxed">{alt.reason}</p>
                </div>

                <div className="pt-2.5 border-t border-[#E4E4DF] flex items-center justify-between text-[12.5px] tabular-nums">
                  <span className="text-[#1A1D21]">
                    Fee: {alt.annual_fee_inr === 0 ? "₹0 (LTF)" : formatInr(alt.annual_fee_inr)}
                  </span>
                  <span className="text-[#4B525C]">★ {alt.overall_rating.toFixed(2)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TABLE_KIND_LABELS: Record<string, string> = {
  reward_structure: "Reward Matrix",
  accelerated_partners: "Accelerated Portals",
  redemption_catalog: "Redemption Value",
  milestone_benefits: "Milestones",
  lounge_access: "Lounge Matrix",
  fees_and_charges: "Fees & Limits",
  eligibility: "Eligibility",
  transfer_partners: "Transfer Ratios",
  other_table: "Breakdown",
};

function StructuredTableBentoCard({ table }: { table: StructuredBenefitTable }) {
  const isWide = table.headers.length >= 4 || table.rows.length >= 9;
  const badge = TABLE_KIND_LABELS[table.kind] || "Breakdown";
  return (
    <div
      className={`bg-white border border-[#E4E4DF] rounded-xl p-5 flex flex-col ${
        isWide ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-medium text-[#1A1D21] leading-snug">
          {table.title}
        </h3>
        <span className="shrink-0 text-[11px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-md">
          {badge}
        </span>
      </div>
      <div className="mt-3 border border-[#E4E4DF] rounded-lg overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-[#F3F2EE] text-[#4B525C] uppercase text-[11px] tracking-wide">
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="py-2 px-3 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E4DF]">
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-[#FAF9F6]" : "bg-white"}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`py-2 px-3 align-top leading-relaxed ${
                      cIdx === 0
                        ? "text-[#1A1D21] font-medium"
                        : "text-[#4B525C] tabular-nums"
                    }`}
                  >
                    {cell || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
