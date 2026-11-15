"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useFullCards } from "@/lib/useCatalog";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Filter, Layers, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import type { BankSummary, CardSummaryItem, RewardConversionStrategy } from "@/lib/types";
import { CATEGORY_META, matchesTokenizedQuery } from "@/lib/format";
import {
  CONVERSION_STRATEGIES,
  cardSupportsStrategy,
  computePersonalizedDirectoryScore,
  getCardConversionKeywords,
  normalizeMinMonthlyIncomeInr,
} from "@/lib/conversion";
import {
  evaluateMultiCategoryCards,
  matchesCategoryToken,
  parseCategoryListParam,
  resolveCategoryMeta,
  type MultiCategoryRankedCard,
} from "@/lib/multiCategoryMatcher";
import { fastTransition } from "@/lib/motion";
import { LedgerCardItem } from "./LedgerCardItem";
import { MultiCategoryBestCardPanel } from "./MultiCategoryBestCardPanel";
import { useCompare } from "./CompareContext";
import { SearchParamsSync } from "./SearchParamsSync";
import { GooeySearchInput } from "./ui/gooey-input";

interface CardsExplorerClientProps {
  cards: CardSummaryItem[];
  banks: BankSummary[];
  totalCardCount?: number;
}

const SORT_OPTIONS = [
  { id: "rating", label: "Highest Rating" },
  { id: "personalized", label: "Personalized Match (Salary + Strategy)" },
  { id: "fee_asc", label: "Lowest Annual Fee" },
  { id: "peak_return", label: "Highest Peak Return" },
  { id: "name_asc", label: "Name (A–Z)" },
] as const;

export function CardsExplorerClient({ cards: initialCards, banks, totalCardCount }: CardsExplorerClientProps) {
  const cards = useFullCards(initialCards);
  const displayTotalCards = totalCardCount ? Math.max(totalCardCount, cards.length) : cards.length;
  const { savedIds } = useCompare();

  const [query, setQuery] = useState("");
  const [bankSlug, setBankSlug] = useState("all");
  const [category, setCategory] = useState("all");
  const [multiMode, setMultiMode] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [requireAllMatch, setRequireAllMatch] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [onlyLtf, setOnlyLtf] = useState(false);
  const [onlyFyf, setOnlyFyf] = useState(false);
  const [onlyFd, setOnlyFd] = useState(false);
  const [onlyRupay, setOnlyRupay] = useState(false);
  const [onlyDomLounge, setOnlyDomLounge] = useState(false);
  const [onlyNoSpendLounge, setOnlyNoSpendLounge] = useState(false);
  const [onlyIntlLounge, setOnlyIntlLounge] = useState(false);
  const [onlyRailLounge, setOnlyRailLounge] = useState(false);
  const [onlyForex, setOnlyForex] = useState(false);
  const [onlyZeroForex, setOnlyZeroForex] = useState(false);
  const [onlyGolf, setOnlyGolf] = useState(false);
  const [onlyPartners, setOnlyPartners] = useState(false);
  const [onlySuperPremium, setOnlySuperPremium] = useState(false);
  const [maxFee, setMaxFee] = useState<string>("any");
  const [maxIncome, setMaxIncome] = useState<string>("any");
  const [strategy, setStrategy] = useState<RewardConversionStrategy>("default_inr");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["id"]>("rating");

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    const q = sp.get("q");
    const bank = sp.get("bank");
    const cat = sp.get("cat");
    const catsRaw = sp.get("cats");
    const inc = sp.get("income") || "any";
    const strat = (sp.get("strategy") || "default_inr") as RewardConversionStrategy;
    const srt = sp.get("sort");
    if (q !== null) setQuery(q);
    if (bank !== null) setBankSlug(bank);
    if (catsRaw !== null) {
      const parsed = parseCategoryListParam(catsRaw);
      if (parsed.length >= 2) {
        setMultiMode(true);
        setSelectedCategories(parsed);
        setCategory("all");
      } else if (parsed.length === 1) {
        setMultiMode(false);
        setSelectedCategories([]);
        setCategory(parsed[0]);
      }
    } else if (cat !== null) {
      setMultiMode(false);
      setSelectedCategories([]);
      setCategory(cat);
    }
    if (sp.get("saved") === "1") setOnlySaved(true);
    if (sp.get("ltf") === "1") setOnlyLtf(true);
    if (sp.get("fyf") === "1") setOnlyFyf(true);
    if (sp.get("fd") === "1") setOnlyFd(true);
    if (sp.get("rupay") === "1") setOnlyRupay(true);
    if (sp.get("domLounge") === "1") setOnlyDomLounge(true);
    if (sp.get("noSpendLounge") === "1") setOnlyNoSpendLounge(true);
    if (sp.get("intlLounge") === "1") setOnlyIntlLounge(true);
    if (sp.get("railLounge") === "1") setOnlyRailLounge(true);
    if (sp.get("forex") === "1") setOnlyForex(true);
    if (sp.get("zeroForex") === "1") setOnlyZeroForex(true);
    if (sp.get("golf") === "1") setOnlyGolf(true);
    if (sp.get("partners") === "1") setOnlyPartners(true);
    if (sp.get("premium") === "1") setOnlySuperPremium(true);
    if (inc !== "any") setMaxIncome(inc);
    if (["default_inr", "cash_statement", "air_miles", "accor_all"].includes(strat)) {
      setStrategy(strat);
    }
    const hasPersonal = inc !== "any" || strat !== "default_inr";
    if (srt === "personalized" || hasPersonal) setSortBy("personalized");
    else if (srt === "fee_asc" || srt === "peak_return" || srt === "name_asc") setSortBy(srt);
  }, []);
  const [visibleCount, setVisibleCount] = useState(24);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const allCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      for (const cat of c.categories || []) {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const resetAll = () => {
    setQuery("");
    setBankSlug("all");
    setCategory("all");
    setMultiMode(false);
    setSelectedCategories([]);
    setRequireAllMatch(false);
    setOnlySaved(false);
    setOnlyLtf(false);
    setOnlyFyf(false);
    setOnlyFd(false);
    setOnlyRupay(false);
    setOnlyDomLounge(false);
    setOnlyNoSpendLounge(false);
    setOnlyIntlLounge(false);
    setOnlyRailLounge(false);
    setOnlyForex(false);
    setOnlyZeroForex(false);
    setOnlyGolf(false);
    setOnlyPartners(false);
    setOnlySuperPremium(false);
    setMaxFee("any");
    setMaxIncome("any");
    setStrategy("default_inr");
    setSortBy("rating");
    setVisibleCount(24);
  };

  const parsedIncomeNum = maxIncome === "any" ? null : Number(maxIncome);

  const selectedCategoryMeta = useMemo(() => {
    if (multiMode) {
      return selectedCategories.length === 1
        ? resolveCategoryMeta(selectedCategories[0])
        : null;
    }
    return resolveCategoryMeta(category);
  }, [category, multiMode, selectedCategories]);

  const toggleMultiMode = () => {
    if (!multiMode) {
      const seed = selectedCategoryMeta ? [selectedCategoryMeta.id] : [];
      setSelectedCategories(seed);
      setMultiMode(true);
      setRequireAllMatch(false);
    } else {
      setCategory(selectedCategories[0] || "all");
      setSelectedCategories([]);
      setMultiMode(false);
      setRequireAllMatch(false);
    }
    setVisibleCount(24);
  };

  const toggleCategoryChip = (catId: string) => {
    if (multiMode) {
      setSelectedCategories((prev) =>
        prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
      );
    } else {
      const active = selectedCategoryMeta?.id === catId;
      setCategory(active ? "all" : catId);
    }
    setVisibleCount(24);
  };

  const nonCategoryFilteredCards = useMemo(() => {
    const q = query.trim();
    const maxFeeNum = maxFee === "any" ? Infinity : Number(maxFee);
    const maxIncomeNum = parsedIncomeNum ?? Infinity;

    return cards.filter((c) => {
      const t = c.filter_tags;
      if (onlySaved && !savedIds.includes(c.card_id)) return false;
      if (bankSlug !== "all" && c.bank_slug !== bankSlug) return false;
      if (onlyLtf && !t.is_ltf) return false;
      if (onlyFyf && !t.is_fyf) return false;
      if (onlyFd && !t.is_fd_backed) return false;
      if (onlyRupay && !t.is_rupay_upi) return false;
      if (onlyDomLounge && !t.has_domestic_lounge) return false;
      if (onlyNoSpendLounge && !t.no_spend_domestic_lounge) return false;
      if (onlyIntlLounge && !t.has_international_lounge) return false;
      if (onlyRailLounge && !t.has_railway_lounge) return false;
      if (onlyForex && !t.zero_or_low_forex) return false;
      if (onlyZeroForex && !t.zero_forex) return false;
      if (onlyGolf && !t.has_golf && !c.categories.includes("Golf")) return false;
      if (
        onlyPartners &&
        !cardSupportsStrategy(c.card_id, "accor_all") &&
        !cardSupportsStrategy(c.card_id, "air_miles")
      ) {
        return false;
      }
      if (
        onlySuperPremium &&
        !t.is_invite_only &&
        c.annual_fee_inr < 10000 &&
        !/super-?premium|metal|private|luxury/i.test(c.card_tier || "")
      ) {
        return false;
      }
      if (c.annual_fee_inr > maxFeeNum) return false;
      const normMinInc = normalizeMinMonthlyIncomeInr(c, t.min_income_salaried_inr);
      if (
        maxIncomeNum !== Infinity &&
        normMinInc !== null &&
        normMinInc > maxIncomeNum &&
        !t.is_fd_backed
      ) {
        return false;
      }
      if (q) {
        const hay = `${c.card_name} ${c.bank} ${c.card_network} ${c.card_tier} ${c.primary_category} ${c.categories.join(" ")} ${(
          t.best_for_tags || []
        ).join(" ")} ${(t.requirement_keywords || []).join(" ")} ${getCardConversionKeywords(c.card_id).join(" ")}`;
        if (!matchesTokenizedQuery(hay, q)) return false;
      }
      return true;
    });
  }, [
    cards,
    query,
    bankSlug,
    onlySaved,
    savedIds,
    onlyLtf,
    onlyFyf,
    onlyFd,
    onlyRupay,
    onlyDomLounge,
    onlyNoSpendLounge,
    onlyIntlLounge,
    onlyRailLounge,
    onlyForex,
    onlyZeroForex,
    onlyGolf,
    onlyPartners,
    onlySuperPremium,
    maxFee,
    parsedIncomeNum,
  ]);

  const multiRecommendation = useMemo(() => {
    if (!multiMode || selectedCategories.length < 2) return null;
    return evaluateMultiCategoryCards(nonCategoryFilteredCards, selectedCategories, {
      monthlyIncomeInr: parsedIncomeNum,
      strategy,
    });
  }, [multiMode, selectedCategories, nonCategoryFilteredCards, parsedIncomeNum, strategy]);

  const multiRankMap = useMemo(() => {
    const map = new Map<string, MultiCategoryRankedCard>();
    if (!multiRecommendation) return map;
    for (const item of multiRecommendation.rankedCards) {
      map.set(item.card.card_id, item);
    }
    return map;
  }, [multiRecommendation]);

  const filteredCards = useMemo(() => {
    let list: CardSummaryItem[];
    if (multiRecommendation) {
      list = multiRecommendation.rankedCards
        .filter((r) => (requireAllMatch ? r.isFullMatch : true))
        .map((r) => r.card);
    } else {
      const singleToken = multiMode
        ? selectedCategories[0] || "all"
        : category;
      list = nonCategoryFilteredCards.filter((c) =>
        matchesCategoryToken(c, singleToken)
      );
    }

    if (multiRecommendation && (sortBy === "rating" || sortBy === "personalized")) {
      return list;
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "personalized") {
        const sa = computePersonalizedDirectoryScore(a, {
          monthlyIncomeInr: parsedIncomeNum,
          strategy,
        }).score;
        const sb = computePersonalizedDirectoryScore(b, {
          monthlyIncomeInr: parsedIncomeNum,
          strategy,
        }).score;
        return sb - sa || b.overall_rating - a.overall_rating;
      }
      if (sortBy === "fee_asc") {
        return a.annual_fee_inr - b.annual_fee_inr || b.overall_rating - a.overall_rating;
      }
      if (sortBy === "peak_return") {
        const peakA = Math.max(
          0,
          ...Object.entries(a.effective_return_pct_by_category || {})
            .filter(([k]) => k !== "international_forex_net_of_markup")
            .map(([, v]) => v)
        );
        const peakB = Math.max(
          0,
          ...Object.entries(b.effective_return_pct_by_category || {})
            .filter(([k]) => k !== "international_forex_net_of_markup")
            .map(([, v]) => v)
        );
        return peakB - peakA || b.overall_rating - a.overall_rating;
      }
      if (sortBy === "name_asc") {
        return a.card_name.localeCompare(b.card_name);
      }
      return b.overall_rating - a.overall_rating;
    });

    return sorted;
  }, [
    multiRecommendation,
    requireAllMatch,
    multiMode,
    selectedCategories,
    category,
    nonCategoryFilteredCards,
    parsedIncomeNum,
    strategy,
    sortBy,
  ]);

  const activeFilterCount = [
    bankSlug !== "all",
    multiMode ? selectedCategories.length > 0 : category !== "all",
    onlySaved,
    onlyLtf,
    onlyFyf,
    onlyFd,
    onlyRupay,
    onlyDomLounge,
    onlyNoSpendLounge,
    onlyIntlLounge,
    onlyRailLounge,
    onlyForex,
    onlyZeroForex,
    onlyGolf,
    onlyPartners,
    onlySuperPremium,
    maxFee !== "any",
    maxIncome !== "any",
    strategy !== "default_inr",
    query.trim().length > 0,
  ].filter(Boolean).length;

  const FilterControls = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-[#1A1D21] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
          Filter Ledger
        </span>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 text-[12px] text-[#0F5C4D] hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            Reset ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Bank */}
      <div className="space-y-1.5">
        <label htmlFor="filter-bank" className="block text-[12.5px] font-medium text-[#4B525C]">
          Bank / Issuer ({banks.length})
        </label>
        <select
          id="filter-bank"
          value={bankSlug}
          onChange={(e) => {
            setBankSlug(e.target.value);
            setVisibleCount(24);
          }}
          className="w-full px-3 py-2 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg text-[#1A1D21] focus:outline-none focus:border-[#0F5C4D]"
        >
          <option value="all">All {banks.length} Banks ({displayTotalCards})</option>
          {banks
            .slice()
            .sort((a, b) => a.bank.localeCompare(b.bank))
            .map((b) => (
              <option key={b.bank_slug} value={b.bank_slug}>
                {b.bank} ({b.total_cards})
              </option>
            ))}
        </select>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label htmlFor="filter-category" className="block text-[12.5px] font-medium text-[#4B525C]">
          Card Category
        </label>
        <select
          id="filter-category"
          value={
            multiMode && selectedCategories.length >= 2
              ? "__multi__"
              : selectedCategoryMeta
              ? selectedCategoryMeta.datasetCategory
              : category
          }
          onChange={(e) => {
            if (e.target.value === "__multi__") return;
            setMultiMode(false);
            setSelectedCategories([]);
            setRequireAllMatch(false);
            setCategory(e.target.value);
            setVisibleCount(24);
          }}
          className="w-full px-3 py-2 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg text-[#1A1D21] focus:outline-none focus:border-[#0F5C4D]"
        >
          <option value="all">All Categories</option>
          {multiMode && selectedCategories.length >= 2 && (
            <option value="__multi__">
              Multi-Select Active ({selectedCategories.length} selected)
            </option>
          )}
          {allCategories.map(([catName, count]) => (
            <option key={catName} value={catName}>
              {catName} ({count})
            </option>
          ))}
        </select>
      </div>

      {/* Fee & Type Checkboxes */}
      <div className="space-y-2 pt-2 border-t border-[#E4E4DF]">
        <p className="text-[12.5px] font-medium text-[#4B525C]">Fees &amp; Network</p>
        {[
          { id: "f-saved", label: `Saved Watchlist (${savedIds.length})`, val: onlySaved, set: setOnlySaved },
          { id: "f-ltf", label: "Lifetime Free (LTF)", val: onlyLtf, set: setOnlyLtf },
          { id: "f-fyf", label: "First Year Free (FYF)", val: onlyFyf, set: setOnlyFyf },
          { id: "f-rupay", label: "RuPay UPI Scan & Pay", val: onlyRupay, set: setOnlyRupay },
          { id: "f-fd", label: "FD-Backed / No Income Proof", val: onlyFd, set: setOnlyFd },
        ].map((item) => (
          <label
            key={item.id}
            htmlFor={item.id}
            className="flex items-center gap-2.5 text-[13px] text-[#1A1D21] cursor-pointer py-0.5"
          >
            <input
              id={item.id}
              type="checkbox"
              checked={item.val}
              onChange={(e) => {
                item.set(e.target.checked);
                setVisibleCount(24);
              }}
              className="w-4 h-4 accent-[#0F5C4D] rounded border-[#C9C9C2]"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      {/* Lounge, Golf & Forex Checkboxes */}
      <div className="space-y-2 pt-2 border-t border-[#E4E4DF]">
        <p className="text-[12.5px] font-medium text-[#4B525C]">Lounges, Golf &amp; Forex</p>
        {[
          {
            id: "f-nospend-lounge",
            label: "No-Spend Domestic Lounge",
            val: onlyNoSpendLounge,
            set: setOnlyNoSpendLounge,
          },
          { id: "f-dom-lounge", label: "Any Domestic Lounge", val: onlyDomLounge, set: setOnlyDomLounge },
          {
            id: "f-intl-lounge",
            label: "International / Priority Pass",
            val: onlyIntlLounge,
            set: setOnlyIntlLounge,
          },
          { id: "f-rail-lounge", label: "IRCTC Railway Lounge", val: onlyRailLounge, set: setOnlyRailLounge },
          { id: "f-golf", label: "Golf & Club Access", val: onlyGolf, set: setOnlyGolf },
          { id: "f-zero-forex", label: "0% Forex Markup", val: onlyZeroForex, set: setOnlyZeroForex },
          { id: "f-low-forex", label: "Zero / Low Forex (<=2%)", val: onlyForex, set: setOnlyForex },
          { id: "f-partners", label: "Air Miles / Accor Transfer", val: onlyPartners, set: setOnlyPartners },
          { id: "f-premium", label: "Super-Premium / Invite Tier", val: onlySuperPremium, set: setOnlySuperPremium },
        ].map((item) => (
          <label
            key={item.id}
            htmlFor={item.id}
            className="flex items-center gap-2.5 text-[13px] text-[#1A1D21] cursor-pointer py-0.5"
          >
            <input
              id={item.id}
              type="checkbox"
              checked={item.val}
              onChange={(e) => {
                item.set(e.target.checked);
                setVisibleCount(24);
              }}
              className="w-4 h-4 accent-[#0F5C4D] rounded border-[#C9C9C2]"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>

      {/* Fee Ceiling & Income Ceiling */}
      <div className="space-y-3 pt-2 border-t border-[#E4E4DF]">
        <div>
          <label htmlFor="filter-max-fee" className="block text-[12.5px] font-medium text-[#4B525C] mb-1">
            Max Annual Fee
          </label>
          <select
            id="filter-max-fee"
            value={maxFee}
            onChange={(e) => setMaxFee(e.target.value)}
            className="w-full px-3 py-2 text-[13px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg text-[#1A1D21]"
          >
            <option value="any">Any Fee</option>
            <option value="0">₹0 (Free)</option>
            <option value="1000">Up to ₹1,000</option>
            <option value="3000">Up to ₹3,000</option>
            <option value="5000">Up to ₹5,000</option>
            <option value="12500">Up to ₹12,500</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-max-income" className="block text-[12.5px] font-medium text-[#4B525C] mb-1">
            My Monthly Income (Salaried)
          </label>
          <select
            id="filter-max-income"
            value={maxIncome}
            onChange={(e) => {
              setMaxIncome(e.target.value);
              if (e.target.value !== "any") setSortBy("personalized");
              setVisibleCount(24);
            }}
            className="w-full px-3 py-2 text-[13px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg text-[#1A1D21]"
          >
            <option value="any">Don&apos;t filter by salary</option>
            <option value="25000">Up to ₹25,000 / mo</option>
            <option value="50000">Up to ₹50,000 / mo</option>
            <option value="100000">Up to ₹1,00,000 / mo</option>
            <option value="200000">Up to ₹2,00,000 / mo</option>
            <option value="300000">Up to ₹3,00,000 / mo</option>
            <option value="500000">₹5,00,000+ / mo (HNI)</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <SearchParamsSync onParams={syncFromParams} />
      {/* Page Title & Controls */}
      <div className="border-b border-[#E4E4DF] pb-6 mb-6 flex flex-col gap-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[30px] font-medium tracking-[-0.015em] text-[#1A1D21]">
              All Active Credit Cards
            </h1>
            <p className="text-[13.5px] sm:text-[14px] text-[#4B525C] mt-1 tabular-nums">
              Showing {filteredCards.length} of {displayTotalCards} indexed Indian credit cards across{" "}
              {banks.length} banks.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="lg:hidden inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-[13px] bg-white border border-[#E4E4DF] rounded-lg text-[#1A1D21] cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
              Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
            </button>

            <label htmlFor="sort-cards" className="sr-only">
              Sort cards by
            </label>
            <select
              id="sort-cards"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]["id"])}
              className="flex-1 sm:flex-none min-w-0 px-3 py-2 text-[13px] sm:text-[13.5px] bg-white border border-[#E4E4DF] rounded-lg text-[#1A1D21] focus:outline-none focus:border-[#0F5C4D]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Field — Icon-only until clicked, expands to full bar */}
        <div className="flex items-center">
          <label htmlFor="directory-search" className="sr-only">
            Filter cards by keyword
          </label>
          <GooeySearchInput
            mode="morph"
            compactLabel=""
            collapsedWidth={44}
            expandedWidth={480}
            value={query}
            onValueChange={(val) => {
              setQuery(val);
              setVisibleCount(24);
            }}
            placeholder="Filter by card name, bank, requirement (e.g. Amazon, SmartBuy, airport lounge, UPI)..."
            ariaLabel="Filter cards by keyword"
          />
        </div>
        {/* Personalize Salary & Redemption Strategy Bar */}
        <div className="bg-white border border-[#E4E4DF] rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#717882]">My Salary:</span>
              {[
                { id: "any", label: "Any" },
                { id: "50000", label: "₹50k" },
                { id: "150000", label: "₹1.5L" },
                { id: "300000", label: "₹3L" },
                { id: "500000", label: "₹5L+" },
              ].map((opt) => {
                const active = maxIncome === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setMaxIncome(opt.id);
                      if (opt.id !== "any") setSortBy("personalized");
                      setVisibleCount(24);
                    }}
                    className={`px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                      active
                        ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                        : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <span className="text-[#D4D4CE] hidden md:inline">|</span>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[#717882]">Redeem For:</span>
              {CONVERSION_STRATEGIES.map((st) => {
                const active = strategy === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStrategy(st.id);
                      if (st.id !== "default_inr") setSortBy("personalized");
                      setVisibleCount(24);
                    }}
                    className={`px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                      active
                        ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                        : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                    }`}
                  >
                    {st.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <Link
            href={`/advisor?${new URLSearchParams({
              ...(parsedIncomeNum ? { income: String(parsedIncomeNum) } : {}),
              ...(strategy !== "default_inr" ? { strategy } : {}),
            }).toString()}`}
            className="text-[#0F5C4D] font-medium hover:underline shrink-0"
          >
            Simulate exact spend in Advisor →
          </Link>
        </div>

        {/* Clickable Category Strip + Multi-Select Toggle */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setMultiMode(false);
              setSelectedCategories([]);
              setRequireAllMatch(false);
              setCategory("all");
              setVisibleCount(24);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] border transition-colors cursor-pointer ${
              !multiMode && category === "all"
                ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
            }`}
          >
            All Categories
          </button>
          <button
            type="button"
            onClick={toggleMultiMode}
            aria-pressed={multiMode}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
              multiMode
                ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                : "bg-[#EEF5F2] border-[#C9DBD2] text-[#0F5C4D] hover:border-[#0F5C4D]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              Multi-Select
              {multiMode && selectedCategories.length > 0
                ? ` (${selectedCategories.length})`
                : ""}
            </span>
          </button>
          {CATEGORY_META.map((cat) => {
            const active = multiMode
              ? selectedCategories.includes(cat.id)
              : selectedCategoryMeta?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategoryChip(cat.id)}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                    : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                }`}
              >
                {multiMode && active && (
                  <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                )}
                <span>{cat.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#E4E4DF] rounded-xl p-5 sticky top-20">
          {FilterControls}
        </aside>

        {/* Mobile Filters Modal */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-[#1A1D21]/30"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <div className="relative w-full max-w-xs bg-white h-full overflow-y-auto p-5 border-r border-[#E4E4DF]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E4E4DF]">
                <span className="text-[15px] font-medium text-[#1A1D21]">Filters</span>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1 text-[#717882]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {FilterControls}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-6 w-full py-2.5 bg-[#0F5C4D] text-white text-[14px] font-medium rounded-lg"
              >
                Show {filteredCards.length} cards
              </button>
            </div>
          </div>
        )}

        {/* Cards Grid */}
        <div className="lg:col-span-9 space-y-6">
          {multiMode && selectedCategories.length < 2 && (
            <div className="bg-[#EEF5F2] border border-[#C9DBD2] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#0F5C4D]">
              <span>
                <strong>Multi-Select ON:</strong> Select{" "}
                {selectedCategories.length === 0 ? "2 or more categories" : "1 more category"} above to calculate the best single card &amp; 2-card combo for your mix.
              </span>
              <button
                type="button"
                onClick={toggleMultiMode}
                className="text-[12px] font-medium underline cursor-pointer shrink-0"
              >
                Switch to Single
              </button>
            </div>
          )}

          {multiRecommendation && (
            <MultiCategoryBestCardPanel
              recommendation={multiRecommendation}
              requireAllMatch={requireAllMatch}
              onToggleRequireAll={() => setRequireAllMatch((v) => !v)}
              onRemoveCategory={(catId) =>
                setSelectedCategories((prev) => prev.filter((id) => id !== catId))
              }
              onClearAll={() => {
                setMultiMode(false);
                setSelectedCategories([]);
                setRequireAllMatch(false);
                setCategory("all");
              }}
            />
          )}

          {!multiRecommendation && selectedCategoryMeta && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[#1A1D21]">
                  {selectedCategoryMeta.label} Study Guide
                </p>
                <p className="text-[12px] text-[#717882] truncate">
                  {selectedCategoryMeta.description}
                </p>
              </div>
              <Link
                href={`/categories?cat=${encodeURIComponent(selectedCategoryMeta.id)}`}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EDE8] px-3 py-1.5 rounded-lg shrink-0 transition-colors"
              >
                View {selectedCategoryMeta.shortLabel} Study Table
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-10 text-center space-y-3">
              <p className="text-[16px] font-medium text-[#1A1D21]">
                No cards match these filters
              </p>
              <p className="text-[13.5px] text-[#4B525C]">
                Try removing one or two constraints (for example, unchecking Zero Forex or raising Max Fee).
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-[13.5px] bg-[#EEF5F2] text-[#0F5C4D] rounded-lg cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredCards.slice(0, visibleCount).map((card) => {
                    const multiEntry = multiRankMap.get(card.card_id);
                    const showPersonalNote =
                      sortBy === "personalized" ||
                      maxIncome !== "any" ||
                      strategy !== "default_inr";
                    const cardNote = multiEntry
                      ? `${multiEntry.matchedCount}/${multiEntry.totalSelected} match · ${multiEntry.summaryLine}`
                      : showPersonalNote
                      ? computePersonalizedDirectoryScore(card, {
                          monthlyIncomeInr: parsedIncomeNum,
                          strategy,
                        }).matchBadge
                      : null;
                    return (
                      <motion.div
                        key={card.card_id}
                        layout="position"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={fastTransition}
                        className="h-full"
                      >
                        <LedgerCardItem
                          card={card}
                          variant="comet"
                          highlightNote={cardNote ?? undefined}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {visibleCount < filteredCards.length && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 24)}
                    className="px-5 py-2.5 text-[13.5px] font-medium bg-white border border-[#C9C9C2] hover:border-[#0F5C4D] text-[#1A1D21] rounded-xl transition-colors cursor-pointer tabular-nums"
                  >
                    Load 24 more ({filteredCards.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
