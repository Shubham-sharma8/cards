"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type {
  AdvisorCardMeta,
  AdvisorPriorityMode,
  AdvisorProfile,
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from "@/lib/types";
import { CONVERSION_STRATEGIES } from "@/lib/conversion";
import {
  CATEGORY_META,
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  formatInr,
  matchesTokenizedQuery,
} from "@/lib/format";
import {
  evaluateTwoCardCombo,
  findBestTwoCardCombo,
  scoreCardsForProfile,
} from "@/lib/advisor";
import {
  AI_PROMPT_EXAMPLES,
  generateAdvisorAiSummary,
  parseNaturalLanguagePromptToProfile,
} from "@/lib/aiSuggestions";
import { BankLogo } from "./BankLogo";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { CardArtwork } from "./CardArtwork";
import { LedgerCardItem } from "./LedgerCardItem";
import { AiOrb3D, MovingBorderPill, SparklesField } from "./Modern3DAi";
import { useCompare } from "./CompareContext";
import { SearchParamsSync } from "./SearchParamsSync";
import { calmTransition, fastTransition, springGentle } from "@/lib/motion";

interface AdvisorClientProps {
  cards: CardSummaryItem[];
  waiverMap: Record<string, number | null>;
  advisorMetaMap?: Record<string, AdvisorCardMeta>;
}

type AdvisorTab = "advisor" | "combo" | "saved";

const GOAL_OPTIONS = [
  "Cashback",
  "Online Shopping",
  "Dining, Groceries & Movies",
  "Fuel",
  "Travel & Miles",
  "RuPay & UPI",
  "Airport Lounge",
  "Zero/Low Forex",
  "Golf",
];

const INITIAL_MONTHLY_SPEND: Record<SpendCategoryKey, number> = {
  online_shopping_general: 7000,
  amazon_flipkart_myntra: 6000,
  dining_swiggy_zomato: 4000,
  groceries_quick_commerce: 6000,
  travel_flights_hotels: 5000,
  upi_scan_and_pay: 5000,
  utilities_bills_telecom: 3500,
  fuel: 3500,
  insurance: 2000,
  education_rent_govt: 0,
  international_forex_net_of_markup: 0,
  offline_general_other: 4000,
};

const QUICK_SPEND_KEYS: SpendCategoryKey[] = [
  "groceries_quick_commerce",
  "fuel",
  "online_shopping_general",
  "amazon_flipkart_myntra",
  "dining_swiggy_zomato",
  "travel_flights_hotels",
  "upi_scan_and_pay",
  "utilities_bills_telecom",
  "insurance",
  "international_forex_net_of_markup",
];

const EXTRA_SPEND_KEYS: SpendCategoryKey[] = [
  "education_rent_govt",
  "offline_general_other",
];

const PRIORITY_MODES: Array<{ id: AdvisorPriorityMode; label: string; hint: string }> = [
  { id: "balanced", label: "Balanced", hint: "Net ₹ + limits + fit" },
  { id: "max_net", label: "Max Net ₹", hint: "Highest net rewards" },
  { id: "low_fee_uncapped", label: "Low Fee & Uncapped", hint: "Avoid steep caps/fees" },
  { id: "travel_lounge", label: "Travel & Lounge", hint: "Miles, forex & lounges" },
];

export function AdvisorClient({ cards, waiverMap, advisorMetaMap }: AdvisorClientProps) {
  const { savedIds, toggleSaved, isSaved, clearSaved, isSelected, toggleItem } = useCompare();

  const [activeTab, setActiveTab] = useState<AdvisorTab>("advisor");

  const [profile, setProfile] = useState<AdvisorProfile>({
    monthlyIncomeInr: 75000,
    cibilScore: 760,
    feePreference: "any",
    priorityMode: "balanced",
    conversionStrategy: "default_inr",
    avoidHighDevaluation: false,
    strictEligibility: false,
    needRupayUpi: false,
    needNoSpendLounge: false,
    needZeroLowForex: false,
    needGolf: false,
    preferredGoals: ["Cashback", "Online Shopping"],
    monthlySpend: INITIAL_MONTHLY_SPEND,
  });

  const [showExtraSpends, setShowExtraSpends] = useState(false);
  const [expandedLimitsMap, setExpandedLimitsMap] = useState<Record<string, boolean>>({});
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiDetectedChips, setAiDetectedChips] = useState<string[]>([]);

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    const tabParam = sp.get("tab");
    if (tabParam === "saved" || tabParam === "combo" || tabParam === "advisor") {
      setActiveTab(tabParam);
    }

    const incParam = sp.get("income");
    const stratParam = sp.get("strategy") as RewardConversionStrategy | null;
    const goalParam = sp.get("goal");
    const qParam = sp.get("q")?.trim() || "";
    if (!incParam && !stratParam && !goalParam && !qParam) return;

    const aiPatch = qParam
      ? parseNaturalLanguagePromptToProfile(qParam, INITIAL_MONTHLY_SPEND)
      : null;

    if (qParam && aiPatch) {
      setAiPrompt(qParam);
      setAiDetectedChips(aiPatch.detectedChips ?? []);
    }

    let monthlyIncomeInr = aiPatch?.monthlyIncomeInr ?? 75000;
    let monthlySpend: Record<SpendCategoryKey, number> =
      aiPatch?.monthlySpend ?? INITIAL_MONTHLY_SPEND;

    if (incParam) {
      const parsed = Number(incParam);
      if (Number.isFinite(parsed) && parsed >= 15000) {
        monthlyIncomeInr = Math.min(1000000, parsed);
        if (!aiPatch) {
          if (parsed >= 250000) {
            monthlySpend = {
              ...INITIAL_MONTHLY_SPEND,
              travel_flights_hotels: 28000,
              online_shopping_general: 20000,
              dining_swiggy_zomato: 14000,
              groceries_quick_commerce: 12000,
              international_forex_net_of_markup: 15000,
              offline_general_other: 12000,
            };
          } else if (parsed >= 150000) {
            monthlySpend = {
              ...INITIAL_MONTHLY_SPEND,
              travel_flights_hotels: 15000,
              online_shopping_general: 14000,
              dining_swiggy_zomato: 10000,
              groceries_quick_commerce: 9000,
              offline_general_other: 8000,
            };
          }
        }
      }
    }

    const conversionStrategy: RewardConversionStrategy =
      stratParam &&
      ["default_inr", "cash_statement", "air_miles", "accor_all"].includes(stratParam)
        ? stratParam
        : (aiPatch?.conversionStrategy ?? "default_inr");

    setProfile((prev) => ({
      ...prev,
      monthlyIncomeInr,
      feePreference: aiPatch?.feePreference ?? prev.feePreference,
      priorityMode: aiPatch?.priorityMode ?? prev.priorityMode,
      conversionStrategy,
      avoidHighDevaluation: aiPatch?.avoidHighDevaluation ?? prev.avoidHighDevaluation,
      needRupayUpi: aiPatch?.needRupayUpi ?? prev.needRupayUpi,
      needNoSpendLounge: aiPatch?.needNoSpendLounge ?? prev.needNoSpendLounge,
      needZeroLowForex: aiPatch?.needZeroLowForex ?? prev.needZeroLowForex,
      needGolf: aiPatch?.needGolf ?? prev.needGolf,
      preferredGoals: goalParam ? [goalParam] : (aiPatch?.preferredGoals ?? prev.preferredGoals),
      monthlySpend,
    }));
  }, []);

  // 2-Card Combo manual override IDs (empty means auto-best combo)
  const [manualCardAId, setManualCardAId] = useState<string>("");
  const [manualCardBId, setManualCardBId] = useState<string>("");
  const [pickerTarget, setPickerTarget] = useState<"A" | "B" | null>(null);
  const [pickerQuery, setPickerQuery] = useState<string>("");
  const [pickerFilter, setPickerFilter] = useState<
    "all" | "ltf" | "upi" | "Cashback" | "Travel & Miles" | "Fuel" | "Dining, Groceries & Movies"
  >("all");

  const toggleGoal = (goal: string) => {
    setProfile((prev) => {
      const exists = prev.preferredGoals.includes(goal);
      return {
        ...prev,
        preferredGoals: exists
          ? prev.preferredGoals.filter((g) => g !== goal)
          : [...prev.preferredGoals, goal].slice(0, 4),
      };
    });
  };

  const applyAiPrompt = (promptText: string) => {
    const clean = promptText.trim();
    if (!clean) return;
    setAiPrompt(clean);
    const patch = parseNaturalLanguagePromptToProfile(clean, INITIAL_MONTHLY_SPEND);
    setAiDetectedChips(patch.detectedChips);
    setProfile((prev) => ({
      ...prev,
      monthlyIncomeInr: patch.monthlyIncomeInr ?? prev.monthlyIncomeInr,
      feePreference: patch.feePreference ?? prev.feePreference,
      priorityMode: patch.priorityMode ?? prev.priorityMode,
      conversionStrategy: patch.conversionStrategy ?? prev.conversionStrategy,
      avoidHighDevaluation:
        patch.avoidHighDevaluation !== undefined
          ? patch.avoidHighDevaluation
          : prev.avoidHighDevaluation,
      needRupayUpi: patch.needRupayUpi ?? false,
      needNoSpendLounge: patch.needNoSpendLounge ?? false,
      needZeroLowForex: patch.needZeroLowForex ?? false,
      needGolf: patch.needGolf ?? false,
      preferredGoals: patch.preferredGoals ?? prev.preferredGoals,
      monthlySpend: patch.monthlySpend,
    }));
  };

  const recommendations = useMemo(
    () => scoreCardsForProfile(cards, profile, waiverMap, 12, advisorMetaMap),
    [cards, profile, waiverMap, advisorMetaMap]
  );

  const unlockedPremiumPicks = useMemo(() => {
    if (profile.monthlyIncomeInr < 150000) return [];
    return recommendations.filter(
      (r) =>
        r.eligibilityStatus === "likely_eligible" &&
        !r.card.filter_tags.is_fd_backed &&
        ((r.minRequiredIncomeInr ?? 0) >= 100000 ||
          r.card.filter_tags.is_invite_only ||
          /super-?premium|metal|private|luxury/i.test(r.card.card_tier || ""))
    );
  }, [recommendations, profile.monthlyIncomeInr]);

  const autoCombo = useMemo(
    () =>
      findBestTwoCardCombo(cards, profile.monthlySpend, waiverMap, true, {
        profile,
        metaMap: advisorMetaMap,
        conversionStrategy: profile.conversionStrategy ?? "default_inr",
      }),
    [cards, profile, waiverMap, advisorMetaMap]
  );

  const aiSummary = useMemo(
    () => generateAdvisorAiSummary(profile, recommendations, autoCombo),
    [profile, recommendations, autoCombo]
  );

  const activeCombo = useMemo(() => {
    const resolvedAId = manualCardAId || autoCombo?.cardA.card_id || "";
    const resolvedBId = manualCardBId || autoCombo?.cardB.card_id || "";
    if (!manualCardAId && !manualCardBId) return autoCombo;
    const cardA = cards.find((c) => c.card_id === resolvedAId);
    const cardB = cards.find((c) => c.card_id === resolvedBId);
    if (cardA && cardB && cardA.card_id !== cardB.card_id) {
      return evaluateTwoCardCombo(
        cardA,
        cardB,
        profile.monthlySpend,
        waiverMap,
        true,
        profile.conversionStrategy ?? "default_inr"
      );
    }
    return autoCombo;
  }, [
    cards,
    manualCardAId,
    manualCardBId,
    profile.monthlySpend,
    profile.conversionStrategy,
    waiverMap,
    autoCombo,
  ]);

  const savedCards = useMemo(() => {
    const map = new Map(cards.map((c) => [c.card_id, c]));
    return savedIds.map((id) => map.get(id)).filter((c): c is CardSummaryItem => Boolean(c));
  }, [cards, savedIds]);

  const curatedCombos = useMemo(() => {
    const findByPattern = (patterns: string[]) => {
      for (const pat of patterns) {
        const q = pat.toLowerCase();
        const hit = cards.find(
          (c) => c.card_name.toLowerCase().includes(q) || c.card_id.toLowerCase().includes(q)
        );
        if (hit) return hit;
      }
      return undefined;
    };

    const defs: Array<{ id: string; label: string; tag: string; aPats: string[]; bPats: string[] }> = [
      {
        id: "hni-accor",
        label: "HDFC Infinia + Axis Atlas",
        tag: "HNI Travel & Accor ALL",
        aPats: ["hdfc infinia", "infinia"],
        bPats: ["axis bank atlas"],
      },
      {
        id: "hni-premier",
        label: "HSBC Premier + Axis Atlas",
        tag: "Premier Miles + 1:2 Accor",
        aPats: ["hsbc premier"],
        bPats: ["axis bank atlas"],
      },
      {
        id: "cb-duo",
        label: "Cashback SBI + HSBC Live+",
        tag: "Max Online + Grocery/Dining",
        aPats: ["cashback sbi"],
        bPats: ["hsbc live+"],
      },
      {
        id: "travel-upi",
        label: "Axis Atlas + Tata Neu Infinity",
        tag: "Travel Miles + RuPay UPI",
        aPats: ["axis bank atlas", "hdfc regalia gold"],
        bPats: ["tata neu infinity", "tata neu plus"],
      },
      {
        id: "ltf-duo",
        label: "Amazon Pay ICICI + Swiggy HDFC",
        tag: "Low-Fee Everyday",
        aPats: ["amazon pay icici"],
        bPats: ["swiggy hdfc", "airtel axis"],
      },
      {
        id: "bills-dining",
        label: "Airtel Axis + HSBC Live+",
        tag: "Bills 25% + Dining 10%",
        aPats: ["airtel axis"],
        bPats: ["hsbc live+"],
      },
    ];

    return defs
      .map((d) => {
        const cardA = findByPattern(d.aPats);
        const cardB = findByPattern(d.bPats);
        if (!cardA || !cardB || cardA.card_id === cardB.card_id) return null;
        return { ...d, cardA, cardB };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cards]);

  const filteredPickerCards = useMemo(() => {
    return cards
      .filter((c) => {
        if (pickerFilter === "ltf" && !c.filter_tags.is_ltf) return false;
        if (pickerFilter === "upi" && !c.filter_tags.is_rupay_upi) return false;
        if (
          pickerFilter === "Cashback" ||
          pickerFilter === "Travel & Miles" ||
          pickerFilter === "Fuel" ||
          pickerFilter === "Dining, Groceries & Movies"
        ) {
          if (
            c.primary_category !== pickerFilter &&
            !c.categories.includes(pickerFilter)
          ) {
            return false;
          }
        }
        if (
          pickerQuery.trim() &&
          !matchesTokenizedQuery(
            `${c.card_name} ${c.bank} ${c.primary_category} ${c.card_network} ${c.filter_tags.best_for_tags.join(" ")}`,
            pickerQuery
          )
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 36);
  }, [cards, pickerFilter, pickerQuery]);

  const totalMonthlySpend = useMemo(
    () =>
      SPEND_CATEGORY_KEYS.reduce((sum, k) => sum + (profile.monthlySpend[k] || 0), 0),
    [profile.monthlySpend]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">
      <SearchParamsSync onParams={syncFromParams} />
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-6">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Limit &amp; Constraint-Aware Matching Engine
          </span>
          <h1 className="text-[28px] sm:text-[34px] font-medium text-[#1A1D21] tracking-[-0.02em] mt-2">
            Card Advisor, 2-Card Combo &amp; Watchlist
          </h1>
          <p className="text-[14.5px] text-[#4B525C] max-w-2xl mt-1.5 leading-relaxed">
            Models monthly caps, shared reward pools, exclusions, fee-waiver progress, quarterly lounge
            spend gates, devaluation risk, and eligibility — not just headline cashback percentage.
          </p>
        </div>

        <div className="inline-flex bg-[#F3F2EE] border border-[#E4E4DF] p-1 rounded-xl self-start lg:self-auto">
          {[
            { id: "advisor" as const, label: "Best Card For Me", icon: Sliders },
            { id: "combo" as const, label: "2-Card Combo", icon: Layers },
            { id: "saved" as const, label: `Saved (${savedCards.length})`, icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] rounded-lg transition-colors cursor-pointer ${
                  active
                    ? "text-[#0F5C4D] font-medium"
                    : "text-[#4B525C] hover:text-[#1A1D21]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="advisor-mode-pill"
                    transition={springGentle}
                    className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(26,29,33,0.08)]"
                  />
                )}
                <Icon className="relative z-10 w-3.5 h-3.5" aria-hidden="true" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Smart Profiler Bar */}
      {activeTab !== "saved" && (
        <div className="relative overflow-hidden bg-white border border-[#CBE0D7] rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-[0_8px_28px_rgba(15,92,77,0.06)]">
          <SparklesField density={16} color="#0F5C4D" secondaryColor="#9A5B13" className="opacity-45" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-[13.5px] font-medium text-[#1A1D21]">
              <AiOrb3D size="md" />
              <div className="hidden md:block w-12 h-9 rounded-lg overflow-hidden border border-[#CBE0D7] bg-[#FAF9F6] shrink-0">
                <img
                  src={resolveMediaUrl("/illustrations/ai-vault-3d.webp") || "/illustrations/ai-vault-3d.webp"}
                  alt="3D AI vault"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>Cards AI Smart Profiler</span>
                  <span className="text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-full">
                    3D Live Engine
                  </span>
                </div>
                <span className="block text-[11.5px] font-normal text-[#4B525C]">
                  Describe salary, spends, Accor / Air Miles, lounge or golf needs
                </span>
              </div>
            </div>
            {aiDetectedChips.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAiPrompt("");
                  setAiDetectedChips([]);
                }}
                className="text-[11.5px] text-[#717882] hover:text-[#1A1D21] cursor-pointer self-start sm:self-auto"
              >
                Clear AI prompt
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyAiPrompt(aiPrompt);
            }}
            className="relative z-10 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center"
          >
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder='Try: "3.5L salary, 30k flights, 15k dining, Accor ALL points, zero forex, golf"'
              className="flex-1 bg-[#FAF9F6] border border-[#E4E4DF] focus:border-[#0F5C4D] rounded-xl px-3.5 py-2.5 text-[13.5px] text-[#1A1D21] placeholder:text-[#717882] outline-none transition-colors"
            />
            <MovingBorderPill borderRadius="12px" duration={3200}>
              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#0F5C4D] hover:bg-[#0B463A] text-white text-[13px] font-medium px-4 py-2.5 rounded-[10.5px] transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Auto-Tune Profile
              </motion.button>
            </MovingBorderPill>
          </form>

          <div className="relative z-10 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] text-[#717882] mr-1">1-tap scenarios:</span>
            {AI_PROMPT_EXAMPLES.map((ex) => (
              <motion.button
                key={ex.id}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => applyAiPrompt(ex.prompt)}
                className="text-[11.5px] bg-[#F3F2EE] hover:bg-[#EEF5F2] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 text-[#1A1D21] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
              >
                {ex.label}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {aiDetectedChips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={calmTransition}
                className="relative z-10 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#F0EFEA]"
              >
                <span className="text-[11px] text-[#0F5C4D] font-medium mr-1">AI extracted:</span>
                {aiDetectedChips.map((chip, idx) => (
                  <motion.span
                    key={`${chip}-${idx}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24, delay: idx * 0.035 }}
                    className="text-[11px] bg-[#EEF5F2] border border-[#CBE0D7] text-[#0F5C4D] px-2 py-0.5 rounded-md tabular-nums"
                  >
                    {chip}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === "advisor" && (
          <motion.div
            key="advisor"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={calmTransition}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            {/* Left Controls */}
            <aside className="lg:col-span-4 bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-5 lg:sticky lg:top-20">
              <div>
                <h2 className="text-[16px] font-medium text-[#1A1D21]">Your Profile &amp; Constraints</h2>
                <p className="text-[12.5px] text-[#717882] mt-0.5 tabular-nums">
                  Total modeled spend: {formatInr(totalMonthlySpend)}/mo ({formatInr(totalMonthlySpend * 12)}/yr)
                </p>
              </div>

              {/* Monthly Income */}
              <div className="space-y-2">
                <div className="flex justify-between text-[13px] tabular-nums">
                  <span className="text-[#4B525C]">Monthly Net Income</span>
                  <span className="text-[#1A1D21] font-medium">
                    {formatInr(profile.monthlyIncomeInr)}
                  </span>
                </div>
                <input
                  type="range"
                  min={15000}
                  max={1000000}
                  step={5000}
                  value={profile.monthlyIncomeInr}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, monthlyIncomeInr: Number(e.target.value) }))
                  }
                  className="ledger-range w-full cursor-pointer"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {[
                    { v: 35000, label: "₹35k" },
                    { v: 75000, label: "₹75k" },
                    { v: 150000, label: "₹1.5L" },
                    { v: 300000, label: "₹3L" },
                    { v: 500000, label: "₹5L" },
                    { v: 800000, label: "₹8L+" },
                  ].map((preset) => {
                    const active = profile.monthlyIncomeInr === preset.v;
                    return (
                      <button
                        key={preset.v}
                        type="button"
                        onClick={() =>
                          setProfile((p) => ({ ...p, monthlyIncomeInr: preset.v }))
                        }
                        className={`px-2 py-0.5 text-[11px] rounded-md border cursor-pointer transition-colors tabular-nums ${
                          active
                            ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                            : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                {profile.monthlyIncomeInr >= 150000 && (
                  <button
                    type="button"
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        monthlySpend: {
                          ...p.monthlySpend,
                          travel_flights_hotels:
                            p.monthlyIncomeInr >= 300000 ? 30000 : 16000,
                          online_shopping_general:
                            p.monthlyIncomeInr >= 300000 ? 22000 : 14000,
                          dining_swiggy_zomato:
                            p.monthlyIncomeInr >= 300000 ? 15000 : 10000,
                          groceries_quick_commerce: 12000,
                          international_forex_net_of_markup:
                            p.monthlyIncomeInr >= 300000 ? 15000 : 5000,
                          offline_general_other:
                            p.monthlyIncomeInr >= 300000 ? 15000 : 8000,
                        },
                      }))
                    }
                    className="w-full text-[11.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EFE9] border border-[#0F5C4D]/25 rounded-lg py-1.5 px-2.5 text-center transition-colors cursor-pointer"
                  >
                    Match monthly spend to ₹
                    {Math.round(profile.monthlyIncomeInr / 1000)}k salary tier
                  </button>
                )}
              </div>

              {/* CIBIL */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[13px] tabular-nums">
                  <span className="text-[#4B525C]">Approx. CIBIL Score</span>
                  <span className="text-[#1A1D21] font-medium">{profile.cibilScore}</span>
                </div>
                <input
                  type="range"
                  min={650}
                  max={850}
                  step={10}
                  value={profile.cibilScore}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, cibilScore: Number(e.target.value) }))
                  }
                  className="ledger-range w-full cursor-pointer"
                />
              </div>

              {/* Fee preference */}
              <div className="space-y-1.5">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Fee Preference
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: "any" as const, label: "All Fees" },
                    { id: "low_fee" as const, label: "≤ ₹1,500" },
                    { id: "ltf_only" as const, label: "LTF Only" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setProfile((p) => ({ ...p, feePreference: opt.id }))}
                      className={`py-1.5 px-2 text-[12px] rounded-lg border cursor-pointer transition-colors ${
                        profile.feePreference === opt.id
                          ? "bg-[#EEF5F2] border-[#0F5C4D]/50 text-[#0F5C4D] font-medium"
                          : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optimization Priority */}
              <div className="space-y-1.5 pt-2 border-t border-[#E4E4DF]">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Optimization Priority
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRIORITY_MODES.map((mode) => {
                    const active = (profile.priorityMode ?? "balanced") === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          setProfile((p) => ({ ...p, priorityMode: mode.id }))
                        }
                        className={`text-left px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                          active
                            ? "bg-[#EEF5F2] border-[#0F5C4D]/50 text-[#0F5C4D]"
                            : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                        }`}
                      >
                        <span className="block text-[12px] font-medium leading-tight">
                          {mode.label}
                        </span>
                        <span className="block text-[10.5px] opacity-80 mt-0.5 leading-tight">
                          {mode.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reward Conversion Strategy */}
              <div className="space-y-1.5 pt-2 border-t border-[#E4E4DF]">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Reward Conversion Strategy
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {CONVERSION_STRATEGIES.map((st) => {
                    const active = (profile.conversionStrategy ?? "default_inr") === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          setProfile((p) => ({ ...p, conversionStrategy: st.id }))
                        }
                        className={`text-left px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
                          active
                            ? "bg-[#EEF5F2] border-[#0F5C4D]/50 text-[#0F5C4D]"
                            : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                        }`}
                      >
                        <span className="block text-[12px] font-medium leading-tight">
                          {st.shortLabel}
                        </span>
                        <span className="block text-[10.5px] opacity-80 mt-0.5 leading-tight line-clamp-2">
                          {st.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reality & Risk Filters */}
              <div className="space-y-2 pt-2 border-t border-[#E4E4DF]">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Eligibility &amp; Devaluation Guardrails
                </span>
                {[
                  {
                    label: "Strict eligibility only (hide stretch/invite)",
                    checked: Boolean(profile.strictEligibility),
                    toggle: () =>
                      setProfile((p) => ({
                        ...p,
                        strictEligibility: !p.strictEligibility,
                      })),
                  },
                  {
                    label: "Avoid high devaluation risk (≥ 7/10)",
                    checked: Boolean(profile.avoidHighDevaluation),
                    toggle: () =>
                      setProfile((p) => ({
                        ...p,
                        avoidHighDevaluation: !p.avoidHighDevaluation,
                      })),
                  },
                ].map((f) => (
                  <label
                    key={f.label}
                    className="flex items-center gap-2.5 text-[12.5px] text-[#1A1D21] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={f.checked}
                      onChange={f.toggle}
                      className="rounded border-[#C9C9C2] text-[#0F5C4D] focus:ring-[#0F5C4D]"
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              {/* Must-haves */}
              <div className="space-y-2 pt-2 border-t border-[#E4E4DF]">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Must-Have Perks
                </span>
                {[
                  {
                    label: "RuPay UPI Scan & Pay",
                    checked: profile.needRupayUpi,
                    toggle: () => setProfile((p) => ({ ...p, needRupayUpi: !p.needRupayUpi })),
                  },
                  {
                    label: "No-Spend Domestic Lounge",
                    checked: profile.needNoSpendLounge,
                    toggle: () =>
                      setProfile((p) => ({ ...p, needNoSpendLounge: !p.needNoSpendLounge })),
                  },
                  {
                    label: "Zero / Low Forex Markup",
                    checked: profile.needZeroLowForex,
                    toggle: () =>
                      setProfile((p) => ({ ...p, needZeroLowForex: !p.needZeroLowForex })),
                  },
                  {
                    label: "Golf & Club Privileges",
                    checked: Boolean(profile.needGolf),
                    toggle: () =>
                      setProfile((p) => ({ ...p, needGolf: !p.needGolf })),
                  },
                ].map((m) => (
                  <label key={m.label} className="flex items-center gap-2.5 text-[13px] text-[#1A1D21] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={m.checked}
                      onChange={m.toggle}
                      className="rounded border-[#C9C9C2] text-[#0F5C4D] focus:ring-[#0F5C4D]"
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>

              {/* Goals */}
              <div className="space-y-2 pt-2 border-t border-[#E4E4DF]">
                <span className="block text-[12.5px] font-medium text-[#4B525C]">
                  Priority Spend Goals
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_OPTIONS.map((g) => {
                    const active = profile.preferredGoals.includes(g);
                    const meta = CATEGORY_META.find((c) => c.datasetCategory === g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGoal(g)}
                        className={`text-[12px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                          active
                            ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                            : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                        }`}
                      >
                        {meta?.shortLabel || g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Spend Inputs */}
              <div className="space-y-2.5 pt-2 border-t border-[#E4E4DF]">
                <div className="flex items-center justify-between gap-2">
                  <span className="block text-[12.5px] font-medium text-[#4B525C]">
                    Monthly Spends (₹)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowExtraSpends((v) => !v)}
                    className="text-[11.5px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
                  >
                    {showExtraSpends ? "Hide Rent/Offline" : "+ Rent, Govt & Offline (+2)"}
                  </button>
                </div>
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {[...QUICK_SPEND_KEYS, ...(showExtraSpends ? EXTRA_SPEND_KEYS : [])].map((key) => {
                    const meta = SPEND_CATEGORY_META[key];
                    const val = profile.monthlySpend[key] || 0;
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[12px] tabular-nums">
                          <span className="text-[#4B525C]">{meta.shortLabel}</span>
                          <span className="text-[#1A1D21] font-medium">{formatInr(val)}</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={meta.maxSliderInr}
                          step={500}
                          value={val}
                          onChange={(e) =>
                            setProfile((prev) => ({
                              ...prev,
                              monthlySpend: {
                                ...prev.monthlySpend,
                                [key]: Number(e.target.value),
                              },
                            }))
                          }
                          className="ledger-range w-full mt-1 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Right Results */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-[#E4E4DF] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="text-[#4B525C]">
                  Showing top <span className="font-medium text-[#1A1D21]">{recommendations.length}</span> matched cards ranked by Net Annual Benefit, Caps, Waiver &amp; Eligibility Fit
                </span>
                <div className="flex items-center gap-4">
                  <Link href="/my-cards" className="text-[#0F5C4D] hover:underline font-medium">
                    Already own cards? Optimize My Cards →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveTab("combo")}
                    className="text-[#0F5C4D] hover:underline font-medium cursor-pointer"
                  >
                    Check 2-Card Combo →
                  </button>
                </div>
              </div>

              {/* Cards by cogify Verdict Summary */}
              {aiSummary && (
                <motion.div
                  key={aiSummary.headline}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={calmTransition}
                  className="relative overflow-hidden bg-white border border-[#0F5C4D]/35 rounded-xl p-4 sm:p-5 space-y-2 shadow-[0_6px_22px_rgba(15,92,77,0.06)]"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-[#0F5C4D]/[0.06] to-transparent animate-ledger-sheen"
                  />
                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-md">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      AI Portfolio Verdict
                    </span>
                    {aiSummary.comboNote && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("combo")}
                        className="text-[12px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
                      >
                        Inspect 2-Card Combo →
                      </button>
                    )}
                  </div>
                  <p className="relative z-10 text-[14.5px] font-medium text-[#1A1D21] leading-snug">
                    {aiSummary.headline}
                  </p>
                  <p className="relative z-10 text-[13px] text-[#4B525C] leading-relaxed">
                    {aiSummary.primaryReason}
                  </p>
                  {(aiSummary.watchOutNote || aiSummary.comboNote) && (
                    <div className="relative z-10 pt-2 border-t border-[#F0EFEA] space-y-1 text-[12.5px]">
                      {aiSummary.watchOutNote && (
                        <p className="text-[#9A5B13]">{aiSummary.watchOutNote}</p>
                      )}
                      {aiSummary.comboNote && (
                        <p className="text-[#0F5C4D] font-medium">{aiSummary.comboNote}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* High-Salary Premium Tier Unlocked Spotlight */}
              {unlockedPremiumPicks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={calmTransition}
                  className="bg-[#EEF5F2] border border-[#C5DFD5] rounded-xl p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium text-[#0F5C4D]">
                      <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        Unlocked for Your {formatInr(profile.monthlyIncomeInr)}/mo Salary — Super-Premium &amp; Flagship Picks
                      </span>
                    </div>
                    {(profile.conversionStrategy ?? "default_inr") === "default_inr" && (
                      <div className="flex items-center gap-1.5">
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() =>
                            setProfile((p) => ({ ...p, conversionStrategy: "accor_all" }))
                          }
                          className="text-[11.5px] font-medium bg-white border border-[#0F5C4D]/30 text-[#0F5C4D] hover:bg-[#0F5C4D] hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Simulate Accor ALL
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="button"
                          onClick={() =>
                            setProfile((p) => ({ ...p, conversionStrategy: "air_miles" }))
                          }
                          className="text-[11.5px] font-medium bg-white border border-[#0F5C4D]/30 text-[#0F5C4D] hover:bg-[#0F5C4D] hover:text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          Simulate Air Miles
                        </motion.button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {unlockedPremiumPicks.slice(0, 3).map((pick, pIdx) => (
                      <motion.div
                        key={pick.card.card_id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2, scale: 1.015 }}
                        transition={{ ...springGentle, delay: pIdx * 0.04 }}
                      >
                        <Link
                          href={`/${pick.card.bank_slug}/${pick.card.card_slug}`}
                          className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/55 rounded-lg px-3 py-2 flex items-center justify-between gap-2 transition-colors shadow-[0_2px_8px_rgba(26,29,33,0.04)]"
                        >
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-[#1A1D21] truncate">
                              {pick.card.card_name}
                            </p>
                            <p className="text-[11px] text-[#0F5C4D] tabular-nums">
                              {pick.conversionResult.supportsStrategy &&
                              pick.conversionResult.convertedUnitsPerYear > 0
                                ? `${pick.conversionResult.convertedUnitsPerYear.toLocaleString("en-IN")} ${pick.conversionResult.unitLabel}/yr`
                                : `${formatInr(pick.netAnnualBenefitInr)} net/yr`}
                            </p>
                          </div>
                          <span className="text-[11px] text-[#717882] shrink-0">View →</span>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {recommendations.length === 0 ? (
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-10 text-center space-y-2">
                  <p className="text-[16px] font-medium text-[#1A1D21]">No exact matches</p>
                  <p className="text-[13.5px] text-[#4B525C]">
                    Relax one constraint (for example switch LTF Only to ≤ ₹1,500, turn off Strict Eligibility, or uncheck one perk filter).
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  <AnimatePresence mode="popLayout">
                    {recommendations.map((rec, index) => {
                      const c = rec.card;
                      const saved = isSaved(c.card_id);
                      const compared = isSelected(c.card_id);
                      const limitsOpen = Boolean(expandedLimitsMap[c.card_id]);
                      const eligColors =
                        rec.eligibilityStatus === "likely_eligible"
                          ? "bg-[#EEF5F2] text-[#0F5C4D]"
                          : "bg-[#FEF6EA] text-[#9A5B13]";
                      const devalColors =
                        rec.devaluationRiskScore <= 3
                          ? "bg-[#EEF5F2] text-[#0F5C4D]"
                          : rec.devaluationRiskScore >= 7
                            ? "bg-[#FEF6EA] text-[#9A5B13]"
                            : "bg-[#F3F2EE] text-[#4B525C]";

                      return (
                        <motion.div
                          key={c.card_id}
                          layout="position"
                          initial={{ opacity: 0, y: 6, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={fastTransition}
                          style={{
                            borderTopWidth: 2,
                            borderTopColor: c.card_theme?.primary_hex || "#E4E4DF",
                          }}
                          className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/45 rounded-xl p-4 sm:p-5 transition-colors space-y-3.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3.5 min-w-0">
                              <span className="w-7 h-7 rounded-full bg-[#F3F2EE] text-[#1A1D21] text-[12.5px] font-medium flex items-center justify-center shrink-0 tabular-nums">
                                #{index + 1}
                              </span>
                              <CardArtwork
                                localImagePath={c.local_image_path}
                                cardName={c.card_name}
                                bank={c.bank}
                                network={c.card_network}
                                cardTheme={c.card_theme}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#717882]">
                                    <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                                    <span>{c.bank}</span>
                                  </span>
                                  <span className={`text-[11.5px] px-2 py-0.5 rounded-md font-medium ${eligColors}`}>
                                    {rec.eligibilityLabel}
                                  </span>
                                </div>
                                <Link
                                  href={`/${c.bank_slug}/${c.card_slug}`}
                                  className="block text-[17px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] mt-0.5"
                                >
                                  {c.card_name}
                                </Link>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {rec.reasons.map((r, idx) => (
                                    <span
                                      key={`${r}-${idx}`}
                                      className="text-[11.5px] bg-[#FAF9F6] border border-[#E4E4DF] text-[#4B525C] px-2 py-0.5 rounded-md"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Net Value Metric (Post-Cap) */}
                            <div className="sm:text-right shrink-0 tabular-nums bg-[#FAF9F6] sm:bg-transparent p-3 sm:p-0 rounded-lg space-y-0.5">
                              <span className="block text-[11.5px] text-[#717882]">
                                {rec.conversionResult.supportsStrategy &&
                                rec.conversionResult.convertedUnitsPerYear > 0
                                  ? `Converted Value / Year (${rec.conversionResult.unitLabel})`
                                  : "Est. Net Benefit / Year"}
                              </span>
                              <span
                                className={`block text-[22px] font-medium ${
                                  rec.netAnnualBenefitInr >= 0 ? "text-[#0F5C4D]" : "text-[#991B1B]"
                                }`}
                              >
                                {rec.netAnnualBenefitInr >= 0 ? "+" : ""}
                                {formatInr(rec.netAnnualBenefitInr)}
                              </span>
                              {rec.conversionResult.supportsStrategy &&
                                rec.conversionResult.convertedUnitsPerYear > 0 && (
                                  <span className="inline-block text-[12px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded-md">
                                    ~{rec.conversionResult.convertedUnitsPerYear.toLocaleString("en-IN")}{" "}
                                    {rec.conversionResult.unitLabel} / yr
                                  </span>
                                )}
                              <span className="block text-[12px] text-[#4B525C]">
                                Blended {rec.effectiveBlendedReturnPct.toFixed(2)}%
                                {rec.peakReturnPct > rec.effectiveBlendedReturnPct + 0.4 && (
                                  <span className="text-[#717882]"> vs Peak {rec.peakReturnPct.toFixed(1)}%</span>
                                )}{" "}
                                · Fee {rec.effectiveFeeInr === 0 ? "₹0" : formatInr(rec.effectiveFeeInr)}
                              </span>
                              {rec.monthlyRewardLostToCapsInr >= 100 && (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-[#FEF6EA] text-[#9A5B13] px-2 py-0.5 rounded-md font-medium">
                                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                                  −{formatInr(rec.monthlyRewardLostToCapsInr)}/mo lost to caps
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Reality & Constraint Strip */}
                          <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] tabular-nums">
                            {/* Eligibility Floor */}
                            <span className="text-[#4B525C]">
                              Floor:{" "}
                              <span className="font-medium text-[#1A1D21]">
                                {c.filter_tags.is_fd_backed
                                  ? "FD Secured"
                                  : rec.minRequiredIncomeInr
                                    ? `≥ ${formatInr(rec.minRequiredIncomeInr)}/mo`
                                    : "Standard"}
                              </span>{" "}
                              · CIBIL {rec.minRequiredCibil}+
                            </span>

                            <span className="text-[#D4D4CE] hidden sm:inline">|</span>

                            {/* Fee & Waiver Progress */}
                            <div className="flex items-center gap-2">
                              {c.annual_fee_inr === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[#0F5C4D] font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  LTF ₹0
                                </span>
                              ) : rec.waiverSpendInr && rec.waiverSpendInr > 0 ? (
                                rec.waiverMet ? (
                                  <span className="inline-flex items-center gap-1 text-[#0F5C4D] font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    Fee Waived (≥ {formatInr(rec.waiverSpendInr)})
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-[#E4E4DF] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-[#9A5B13] rounded-full"
                                        style={{ width: `${Math.min(100, Math.max(4, rec.waiverProgressPct))}%` }}
                                      />
                                    </div>
                                    <span className="text-[#9A5B13]">
                                      Short {formatInr(rec.waiverShortfallInr)} for {formatInr(rec.waiverSpendInr)} waiver
                                    </span>
                                  </div>
                                )
                              ) : (
                                <span className="text-[#4B525C]">
                                  No waiver ({formatInr(rec.effectiveFeeInr)}/yr)
                                </span>
                              )}
                            </div>

                            {/* Lounge Gate */}
                            {rec.loungeSpendGateStatus !== "none" && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium ${
                                  rec.loungeSpendGateStatus === "spend_shortfall"
                                    ? "bg-[#FEF6EA] text-[#9A5B13]"
                                    : "bg-[#EEF5F2] text-[#0F5C4D]"
                                }`}
                              >
                                {rec.loungeSpendGateStatus === "no_spend"
                                  ? "No-Spend Lounge"
                                  : rec.loungeSpendGateStatus === "unlocked"
                                    ? "Lounge Unlocked"
                                    : `Lounge Short ${formatInr(rec.loungeQuarterlyShortfallInr)}/qtr`}
                              </span>
                            )}

                            {/* Devaluation Risk Score */}
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium ${devalColors}`}
                            >
                              {rec.devaluationRiskScore >= 7 && (
                                <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                              )}
                              Deval {rec.devaluationRiskScore}/10
                            </span>

                            {/* Milestone Bonus */}
                            {rec.milestoneEstimatedValueInr > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-medium bg-[#F3F6FF] text-[#1D3B8B]">
                                +{formatInr(rec.milestoneEstimatedValueInr)}/yr milestones
                              </span>
                            )}
                          </div>

                          {/* Limits, Caps & Real-World Check */}
                          {rec.limitAlerts.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="block text-[11.5px] font-medium text-[#717882]">
                                Limits, Caps &amp; Real-World Check
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {rec.limitAlerts.slice(0, 4).map((alert, aIdx) => {
                                  const alertStyle =
                                    alert.severity === "warning"
                                      ? "bg-[#FEF6EA] border-[#F3D9B1] text-[#9A5B13]"
                                      : alert.severity === "positive"
                                        ? "bg-[#EEF5F2] border-[#C5DFD5] text-[#0F5C4D]"
                                        : "bg-[#F3F6FF] border-[#D7E2FF] text-[#1D3B8B]";
                                  const AlertIcon =
                                    alert.severity === "warning"
                                      ? AlertTriangle
                                      : alert.severity === "positive"
                                        ? CheckCircle2
                                        : Info;
                                  return (
                                    <div
                                      key={`${alert.tag}-${aIdx}`}
                                      className={`rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2 ${alertStyle}`}
                                    >
                                      <AlertIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                                      <div className="min-w-0 leading-snug">
                                        <span className="font-medium">{alert.title}</span>
                                        <span className="block text-[11.5px] opacity-90 mt-0.5">
                                          {alert.detail}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Expandable Category Limit & Cap Math */}
                          {rec.categoryLimitRows.length > 0 && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLimitsMap((prev) => ({
                                    ...prev,
                                    [c.card_id]: !prev[c.card_id],
                                  }))
                                }
                                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    limitsOpen ? "rotate-180" : ""
                                  }`}
                                  aria-hidden="true"
                                />
                                {limitsOpen
                                  ? "Hide Category Limit & Cap Math"
                                  : `Inspect Category Limit & Cap Math (${rec.categoryLimitRows.length} buckets)`}
                              </button>

                              <AnimatePresence initial={false}>
                                {limitsOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={fastTransition}
                                    className="overflow-hidden"
                                  >
                                    <div className="overflow-x-auto border border-[#E4E4DF] rounded-xl">
                                      <table className="w-full text-left border-collapse text-[12px] tabular-nums">
                                        <thead className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[#717882]">
                                          <tr>
                                            <th className="py-2 px-3 font-medium">Category</th>
                                            <th className="py-2 px-3 font-medium">Spend/mo</th>
                                            <th className="py-2 px-3 font-medium">Headline</th>
                                            <th className="py-2 px-3 font-medium">Monthly Cap</th>
                                            <th className="py-2 px-3 font-medium">Post-Cap</th>
                                            <th className="py-2 px-3 font-medium text-right">Actual ₹/mo</th>
                                            <th className="py-2 px-3 font-medium text-right">Lost/mo</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#F3F2EE]">
                                          {rec.categoryLimitRows.map((row) => (
                                            <tr
                                              key={row.key}
                                              className={
                                                row.isSaturated
                                                  ? "bg-[#FEF6EA]/60"
                                                  : row.isZeroOrExcluded
                                                    ? "bg-[#FAF9F6]/70 text-[#717882]"
                                                    : "bg-white"
                                              }
                                            >
                                              <td className="py-2 px-3 text-[#1A1D21]">
                                                <span>{row.label}</span>
                                                {row.poolLabel && (
                                                  <span className="block text-[10.5px] text-[#717882]">
                                                    {row.poolLabel}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-[#4B525C]">
                                                {formatInr(row.monthlySpendInr)}
                                              </td>
                                              <td className="py-2 px-3 text-[#4B525C]">
                                                {row.headlinePct.toFixed(1)}%
                                              </td>
                                              <td className="py-2 px-3 text-[#4B525C]">
                                                {row.monthlyCapInr !== null
                                                  ? `${formatInr(row.monthlyCapInr)}/mo`
                                                  : "Uncapped"}
                                              </td>
                                              <td
                                                className={`py-2 px-3 font-medium ${
                                                  row.isSaturated
                                                    ? "text-[#9A5B13]"
                                                    : row.isZeroOrExcluded
                                                      ? "text-[#991B1B]"
                                                      : "text-[#0F5C4D]"
                                                }`}
                                              >
                                                {row.effectivePct.toFixed(2)}%
                                              </td>
                                              <td className="py-2 px-3 text-right font-medium text-[#1A1D21]">
                                                +{formatInr(row.actualMonthlyRewardInr)}
                                              </td>
                                              <td className="py-2 px-3 text-right">
                                                {row.lostToCapInr >= 10 ? (
                                                  <span className="text-[#9A5B13] font-medium">
                                                    −{formatInr(row.lostToCapInr)}
                                                  </span>
                                                ) : (
                                                  <span className="text-[#717882]">₹0</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          <div className="pt-3 border-t border-[#E4E4DF] flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#4B525C] tabular-nums">
                              {rec.topCategories.map((tc) => (
                                <span key={tc.key}>
                                  {SPEND_CATEGORY_META[tc.key].shortLabel}:{" "}
                                  <span className="font-medium text-[#1A1D21]">
                                    {tc.effectivePct.toFixed(1)}%
                                  </span>
                                  {tc.effectivePct + 0.05 < tc.pct && (
                                    <span className="text-[#717882] ml-1">
                                      (was {tc.pct.toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleSaved(c.card_id)}
                                className={`inline-flex items-center gap-1 text-[12.5px] px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                                  saved
                                    ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                                    : "bg-white border-[#E4E4DF] text-[#4B525C]"
                                }`}
                              >
                                <Bookmark className="w-3.5 h-3.5" fill={saved ? "#0F5C4D" : "none"} />
                                {saved ? "Saved" : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleItem({
                                    card_id: c.card_id,
                                    card_name: c.card_name,
                                    bank: c.bank,
                                    bank_slug: c.bank_slug,
                                    card_slug: c.card_slug,
                                    annual_fee_inr: c.annual_fee_inr,
                                    overall_rating: c.overall_rating,
                                  })
                                }
                                className={`inline-flex items-center gap-1 text-[12.5px] px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                                  compared
                                    ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                                    : "bg-white border-[#E4E4DF] text-[#4B525C]"
                                }`}
                              >
                                {compared ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                {compared ? "Added" : "Compare"}
                              </button>

                              <Link
                                href={`/${c.bank_slug}/${c.card_slug}`}
                                className="text-[12.5px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Open Dossier
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "combo" && (
          <motion.div
            key="combo"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={calmTransition}
            className="space-y-6"
          >
            {/* Card Pair Box-Type Selector */}
            <div className="bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[19px] font-medium text-[#1A1D21]">
                    2-Card Wallet Strategy Optimizer
                  </h2>
                  <p className="text-[13.5px] text-[#4B525C] mt-0.5">
                    Pick two cards using visual slot boxes or quick Indian wallet combos. Each spend
                    bucket routes automatically to whichever card yields the highest post-cap return.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {activeCombo && (
                    <button
                      type="button"
                      onClick={() => {
                        const curA = activeCombo.cardA.card_id;
                        const curB = activeCombo.cardB.card_id;
                        setManualCardAId(curB);
                        setManualCardBId(curA);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] rounded-lg border border-[#E4E4DF] bg-[#FAF9F6] hover:border-[#0F5C4D]/45 text-[#1A1D21] cursor-pointer transition-colors"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                      Swap A ↔ B
                    </button>
                  )}
                  {(manualCardAId || manualCardBId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualCardAId("");
                        setManualCardBId("");
                        setPickerTarget(null);
                      }}
                      className="text-[13px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
                    >
                      Reset to Auto-Best
                    </button>
                  )}
                </div>
              </div>

              {/* Quick 1-Click Curated 2-Card Combos */}
              {curatedCombos.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-[12px] text-[#717882]">
                    Popular 2-Card Indian Stacks (1-click load):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {curatedCombos.map((preset) => {
                      const isActive =
                        activeCombo?.cardA.card_id === preset.cardA.card_id &&
                        activeCombo?.cardB.card_id === preset.cardB.card_id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setManualCardAId(preset.cardA.card_id);
                            setManualCardBId(preset.cardB.card_id);
                            setPickerTarget(null);
                          }}
                          className={`text-left rounded-xl p-3 border transition-all cursor-pointer ${
                            isActive
                              ? "bg-[#EEF5F2] border-[#0F5C4D]/55"
                              : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#0F5C4D]/40 hover:bg-white"
                          }`}
                        >
                          <div className="text-[12.5px] font-medium text-[#1A1D21] line-clamp-1">
                            {preset.label}
                          </div>
                          <div className="text-[11.5px] text-[#0F5C4D] mt-0.5 line-clamp-1">
                            {preset.tag}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive Card A & Card B Slot Boxes */}
              {activeCombo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    [
                      {
                        slot: "A" as const,
                        heading: "Card A · Primary Spend Card",
                        card: activeCombo.cardA,
                        feeCharged: activeCombo.cardAFeeChargedInr,
                        annualSpendInr: activeCombo.cardAAnnualSpendInr,
                        waiverTarget: activeCombo.cardAWaiverTargetInr,
                        waiverMet: activeCombo.cardAWaiverMet,
                        conversion: activeCombo.cardAConversion,
                        badgeClass: "bg-[#EEF5F2] text-[#0F5C4D] border-[#0F5C4D]/25",
                      },
                      {
                        slot: "B" as const,
                        heading: "Card B · Backup / UPI / Travel Partner",
                        card: activeCombo.cardB,
                        feeCharged: activeCombo.cardBFeeChargedInr,
                        annualSpendInr: activeCombo.cardBAnnualSpendInr,
                        waiverTarget: activeCombo.cardBWaiverTargetInr,
                        waiverMet: activeCombo.cardBWaiverMet,
                        conversion: activeCombo.cardBConversion,
                        badgeClass: "bg-[#F3F6FF] text-[#1D3B8B] border-[#D7E2FF]",
                      },
                    ] as const
                  ).map((box) => {
                    const isOpen = pickerTarget === box.slot;
                    const themeBg = box.card.card_theme?.soft_bg_hex || "#FAF9F6";
                    const peakPct = Object.entries(box.card.effective_return_pct_by_category || {})
                      .filter(([k]) => k !== "international_forex_net_of_markup")
                      .reduce((m, [, v]) => (v > m ? v : m), 0);
                    const waiverShortfall =
                      box.waiverTarget && box.waiverTarget > 0 && !box.waiverMet
                        ? Math.max(0, box.waiverTarget - box.annualSpendInr)
                        : 0;

                    return (
                      <div
                        key={box.slot}
                        onClick={() => {
                          setPickerTarget(isOpen ? null : box.slot);
                          setPickerQuery("");
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPickerTarget(isOpen ? null : box.slot);
                            setPickerQuery("");
                          }
                        }}
                        className={`group relative rounded-2xl border p-4 transition-all cursor-pointer ${
                          isOpen
                            ? "border-[#0F5C4D] ring-2 ring-[#0F5C4D]/15 bg-white"
                            : "border-[#E4E4DF] hover:border-[#0F5C4D]/55 bg-[#FAF9F6]/65 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className={`text-[11.5px] font-medium px-2.5 py-0.5 rounded-full border ${box.badgeClass}`}>
                            {box.heading}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F5C4D]">
                            {isOpen ? "Close Picker" : "Choose / Change"}
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </span>
                        </div>

                        <div className="flex items-center gap-4 min-w-0">
                          <div
                            className="rounded-xl p-1.5 shrink-0 border border-[#E4E4DF]"
                            style={{ backgroundColor: themeBg }}
                          >
                            <CardArtwork
                              localImagePath={box.card.local_image_path}
                              cardName={box.card.card_name}
                              bank={box.card.bank}
                              network={box.card.card_network}
                              cardTheme={box.card.card_theme}
                              size="sm"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 text-[12px] text-[#717882]">
                              <BankLogo bankSlug={box.card.bank_slug} bank={box.card.bank} size="xs" />
                              <span className="truncate">{box.card.bank}</span>
                              <span className="inline-flex items-center gap-0.5 text-[#9A5B13] tabular-nums ml-auto shrink-0">
                                <Star className="w-3 h-3 fill-[#9A5B13]" aria-hidden="true" />
                                {box.card.overall_rating.toFixed(1)}
                              </span>
                            </div>

                            <h3 className="text-[15.5px] font-medium text-[#1A1D21] truncate">
                              {box.card.card_name}
                            </h3>

                            <div className="flex items-center flex-wrap gap-2 text-[12px] tabular-nums text-[#4B525C]">
                              <span>{formatInr(box.annualSpendInr)}/yr spend</span>
                              <span className="text-[#C9C9C2]">·</span>
                              <span>
                                Fee:{" "}
                                {box.feeCharged === 0
                                  ? "₹0 (Waived/LTF)"
                                  : formatInr(box.feeCharged)}
                              </span>
                              {peakPct > 0 && (
                                <>
                                  <span className="text-[#C9C9C2]">·</span>
                                  <span className="text-[#0F5C4D] font-medium">
                                    Peak {peakPct.toFixed(1)}%
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {box.card.annual_fee_inr === 0 ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#EEF5F2] text-[#0F5C4D] font-medium">
                                  LTF ₹0
                                </span>
                              ) : box.waiverMet ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#EEF5F2] text-[#0F5C4D] font-medium">
                                  Waiver Met ({formatInr(box.waiverTarget || 0)})
                                </span>
                              ) : waiverShortfall > 0 ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#FEF6EA] text-[#9A5B13] font-medium">
                                  Need {formatInr(waiverShortfall)} more for waiver
                                </span>
                              ) : null}
                              {box.conversion.supportsStrategy &&
                                box.conversion.convertedUnitsPerYear > 0 && (
                                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#EEF5F2] text-[#0F5C4D] font-medium">
                                    ~{box.conversion.convertedUnitsPerYear.toLocaleString("en-IN")}{" "}
                                    {box.conversion.unitLabel}/yr
                                  </span>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Animated Box-Grid Selector Panel */}
              <AnimatePresence>
                {pickerTarget && (
                  <motion.div
                    key={pickerTarget}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={fastTransition}
                    className="bg-[#FAF9F6] border border-[#0F5C4D]/30 rounded-2xl p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[14.5px] font-medium text-[#1A1D21]">
                          Select Card {pickerTarget} Box
                        </p>
                        <p className="text-[12px] text-[#717882]">
                          Click any card box below to assign it to Card {pickerTarget}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerTarget(null)}
                        className="inline-flex items-center gap-1 self-start sm:self-auto px-2.5 py-1 rounded-lg border border-[#E4E4DF] bg-white text-[12px] text-[#4B525C] hover:text-[#1A1D21] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        Done
                      </button>
                    </div>

                    {/* Search & Category Pills */}
                    <div className="flex flex-col lg:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search
                          className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={pickerQuery}
                          onChange={(e) => setPickerQuery(e.target.value)}
                          placeholder="Search card or bank (e.g. HSBC Live+, SBI Cashback, Atlas, Tata Neu)..."
                          className="w-full pl-9 pr-8 py-2 bg-white border border-[#E4E4DF] focus:border-[#0F5C4D] rounded-xl text-[13.5px] text-[#1A1D21] outline-none"
                        />
                        {pickerQuery && (
                          <button
                            type="button"
                            onClick={() => setPickerQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717882] hover:text-[#1A1D21] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ["all", "All"],
                            ["ltf", "Lifetime Free"],
                            ["upi", "RuPay UPI"],
                            ["Cashback", "Cashback"],
                            ["Travel & Miles", "Travel"],
                            ["Dining, Groceries & Movies", "Dining"],
                            ["Fuel", "Fuel"],
                          ] as const
                        ).map(([fKey, fLabel]) => {
                          const active = pickerFilter === fKey;
                          return (
                            <button
                              key={fKey}
                              type="button"
                              onClick={() => setPickerFilter(fKey)}
                              className={`px-2.5 py-1.5 rounded-lg text-[12px] border cursor-pointer transition-colors ${
                                active
                                  ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                                  : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/40"
                              }`}
                            >
                              {fLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Box Grid Options */}
                    {filteredPickerCards.length === 0 ? (
                      <div className="bg-white border border-[#E4E4DF] rounded-xl p-6 text-center text-[13px] text-[#717882]">
                        No cards match &ldquo;{pickerQuery}&rdquo;. Try clearing search or filter pills.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {filteredPickerCards.map((c) => {
                          const currentA = activeCombo?.cardA.card_id;
                          const currentB = activeCombo?.cardB.card_id;
                          const isChosenHere =
                            pickerTarget === "A" ? currentA === c.card_id : currentB === c.card_id;
                          const isOtherSlot =
                            pickerTarget === "A" ? currentB === c.card_id : currentA === c.card_id;
                          const peakPct = Object.entries(c.effective_return_pct_by_category || {})
                            .filter(([k]) => k !== "international_forex_net_of_markup")
                            .reduce((m, [, v]) => (v > m ? v : m), 0);

                          return (
                            <button
                              key={c.card_id}
                              type="button"
                              disabled={isOtherSlot}
                              onClick={() => {
                                if (pickerTarget === "A") {
                                  setManualCardAId(c.card_id);
                                  if (!manualCardBId && activeCombo?.cardB.card_id) {
                                    setManualCardBId(activeCombo.cardB.card_id);
                                  }
                                } else {
                                  setManualCardBId(c.card_id);
                                  if (!manualCardAId && activeCombo?.cardA.card_id) {
                                    setManualCardAId(activeCombo.cardA.card_id);
                                  }
                                }
                                setPickerTarget(null);
                              }}
                              className={`text-left rounded-xl p-3 border transition-all flex items-center gap-3 ${
                                isChosenHere
                                  ? "bg-[#EEF5F2] border-[#0F5C4D] cursor-pointer"
                                  : isOtherSlot
                                    ? "bg-[#F3F2EE] border-[#E4E4DF] opacity-55 cursor-not-allowed"
                                    : "bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/55 hover:-translate-y-0.5 cursor-pointer"
                              }`}
                            >
                              <CardArtwork
                                localImagePath={c.local_image_path}
                                cardName={c.card_name}
                                bank={c.bank}
                                network={c.card_network}
                                cardTheme={c.card_theme}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[11px] text-[#717882]">
                                  <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                                  <span className="truncate">{c.bank}</span>
                                  {isChosenHere && (
                                    <span className="ml-auto text-[#0F5C4D] font-medium">Selected</span>
                                  )}
                                  {isOtherSlot && (
                                    <span className="ml-auto text-[#717882]">
                                      In Card {pickerTarget === "A" ? "B" : "A"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[13.5px] font-medium text-[#1A1D21] truncate mt-0.5">
                                  {c.card_name}
                                </p>
                                <p className="text-[11.5px] text-[#4B525C] tabular-nums mt-0.5">
                                  {c.annual_fee_inr === 0 ? "LTF" : formatInr(c.annual_fee_inr)} ·{" "}
                                  {peakPct > 0 ? `Peak ${peakPct.toFixed(1)}%` : c.primary_category}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {activeCombo && (
              <>
                {/* Combo Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                  <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                    <span className="text-[12px] text-[#717882]">Combined Gross Rewards</span>
                    <p className="text-[22px] font-medium text-[#1A1D21] mt-1">
                      +{formatInr(activeCombo.comboGrossRewardsInr)}
                    </p>
                    <span className="text-[12px] text-[#4B525C]">
                      On {formatInr(activeCombo.annualSpendInr)}/yr total spend
                    </span>
                  </div>
                  <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                    <span className="text-[12px] text-[#717882]">Combined Effective Fees</span>
                    <p className="text-[22px] font-medium text-[#1A1D21] mt-1">
                      {formatInr(activeCombo.cardAFeeChargedInr + activeCombo.cardBFeeChargedInr)}
                    </p>
                    <span className="text-[12px] text-[#4B525C]">
                      Card A: {formatInr(activeCombo.cardAFeeChargedInr)} · Card B:{" "}
                      {formatInr(activeCombo.cardBFeeChargedInr)}
                    </span>
                  </div>
                  <div className="bg-[#EEF5F2] border border-[#0F5C4D]/35 rounded-xl p-4">
                    <span className="text-[12px] text-[#0F5C4D]">
                      {activeCombo.convertedSummaryLabel ? "Combo Profit (Partner Value)" : "Combo Net Annual Profit"}
                    </span>
                    <p className="text-[22px] font-medium text-[#0F5C4D] mt-1">
                      +{formatInr(activeCombo.comboNetAnnualInr)}
                    </p>
                    {activeCombo.convertedSummaryLabel ? (
                      <span className="text-[12px] font-medium text-[#0F5C4D] block mt-0.5">
                        {activeCombo.convertedSummaryLabel} · Single card: {formatInr(activeCombo.singleBestNetAnnualInr)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#0F5C4D]">
                        Best single card alone: {formatInr(activeCombo.singleBestNetAnnualInr)}
                      </span>
                    )}
                  </div>
                  <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                    <span className="text-[12px] text-[#717882]">2-Card Uplift</span>
                    <p className="text-[22px] font-medium text-[#166534] mt-1">
                      +{formatInr(Math.max(0, activeCombo.extraGainOverSingleInr))}/yr
                    </p>
                    <span className="text-[12px] text-[#4B525C]">
                      Extra earnings vs carrying 1 card
                    </span>
                  </div>
                </div>

                {/* Cap & Shared-Pool Spillover Optimizations */}
                {activeCombo.spilloverNotes.length > 0 && (
                  <div className="bg-[#EEF5F2] border border-[#C5DFD5] rounded-xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#0F5C4D]">
                      <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Monthly Cap &amp; Shared-Pool Spillover Strategy</span>
                    </div>
                    <ul className="space-y-1 text-[12.5px] text-[#1A1D21] list-disc pl-5">
                      {activeCombo.spilloverNotes.map((note, idx) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Category Routing Table */}
                <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E4E4DF] flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-[16px] font-medium text-[#1A1D21]">
                      Which Card to Swipe Where
                    </h3>
                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 text-[#0F5C4D]">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Card A: {activeCombo.cardA.card_name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#2C3E50]">
                        <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                        Card B: {activeCombo.cardB.card_name}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13.5px] tabular-nums">
                      <thead className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[#717882] text-[12px]">
                        <tr>
                          <th className="py-2.5 px-4 font-medium">Spend Category</th>
                          <th className="py-2.5 px-4 font-medium">Monthly Spend</th>
                          <th className="py-2.5 px-4 font-medium">Best Card to Use</th>
                          <th className="py-2.5 px-4 font-medium">Post-Cap Rate</th>
                          <th className="py-2.5 px-4 font-medium text-right">Annual Reward</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F2EE]">
                        {activeCombo.categorySplit.map((row) => {
                          const useCardObj =
                            row.useCard === "B" ? activeCombo.cardB : activeCombo.cardA;
                          return (
                            <tr key={row.key} className="hover:bg-[#FAF9F6]">
                              <td className="py-3 px-4 text-[#1A1D21]">
                                <span>{SPEND_CATEGORY_META[row.key].label}</span>
                                {row.splitNote && (
                                  <span className="block text-[11.5px] text-[#0F5C4D] mt-0.5">
                                    {row.splitNote}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-[#4B525C]">
                                {formatInr(row.monthlySpendInr)}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 text-[12px] px-2 py-0.5 rounded-md ${
                                    row.useCard === "A"
                                      ? "bg-[#EEF5F2] text-[#0F5C4D]"
                                      : row.useCard === "SPLIT"
                                        ? "bg-[#FEF6EA] text-[#9A5B13]"
                                        : "bg-[#F3F2EE] text-[#2C3E50]"
                                  }`}
                                >
                                  <BankLogo bankSlug={useCardObj.bank_slug} bank={useCardObj.bank} size="xs" />
                                  <span>
                                    {row.useCard === "SPLIT"
                                      ? `Split: ${activeCombo.cardA.card_name} → ${activeCombo.cardB.card_name}`
                                      : `Card ${row.useCard}: ${useCardObj.card_name}`}
                                  </span>
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-[#1A1D21]">
                                {row.effectivePct.toFixed(2)}%
                                {row.effectivePct + 0.05 < row.bestPct && (
                                  <span className="block text-[11px] text-[#717882] font-normal">
                                    Headline {row.bestPct.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-[#0F5C4D]">
                                +{formatInr(row.annualRewardInr)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "saved" && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={calmTransition}
            className="space-y-4"
          >
            <div className="bg-white border border-[#E4E4DF] rounded-xl px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-medium text-[#1A1D21]">
                  Saved Watchlist ({savedCards.length})
                </h2>
                <p className="text-[13px] text-[#4B525C]">
                  Shortlist cards while browsing categories or dossiers, then compare them side by side.
                </p>
              </div>
              {savedCards.length > 0 && (
                <button
                  type="button"
                  onClick={clearSaved}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-[#991B1B] hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Clear Watchlist
                </button>
              )}
            </div>

            {savedCards.length === 0 ? (
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-10 text-center space-y-3">
                <p className="text-[16px] font-medium text-[#1A1D21]">
                  Your watchlist is empty
                </p>
                <p className="text-[13.5px] text-[#4B525C] max-w-md mx-auto">
                  Tap the bookmark icon on any card in the explorer, category guide, or card
                  dossier to save it here.
                </p>
                <Link
                  href="/categories"
                  className="inline-flex items-center px-4 py-2 bg-[#0F5C4D] text-white text-[13px] font-medium rounded-lg"
                >
                  Explore Categories
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {savedCards.map((c) => (
                    <motion.div
                      key={c.card_id}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={fastTransition}
                      className="h-full"
                    >
                      <LedgerCardItem card={c} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
