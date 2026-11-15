"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  Flag,
  Pencil,
  Plane,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { CardSummaryItem, SpendCategoryKey } from "@/lib/types";
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  formatFeeDisplay,
  formatInr,
  matchesTokenizedQuery,
} from "@/lib/format";
import { analyzeOwnedPortfolio } from "@/lib/myCardsEngine";
import { generateMyCardsAiSummary } from "@/lib/aiSuggestions";
import { calmTransition } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";

interface MyCardsClientProps {
  cards: CardSummaryItem[];
  waiverMap: Record<string, number | null>;
}

const SPEND_PRESETS: Array<{
  id: string;
  label: string;
  spend: Record<SpendCategoryKey, number>;
}> = [
  {
    id: "everyday",
    label: "₹35k Everyday",
    spend: {
      online_shopping_general: 5000,
      amazon_flipkart_myntra: 5000,
      dining_swiggy_zomato: 4000,
      groceries_quick_commerce: 6000,
      travel_flights_hotels: 0,
      upi_scan_and_pay: 5000,
      utilities_bills_telecom: 4000,
      fuel: 3000,
      insurance: 0,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 3000,
    },
  },
  {
    id: "urban",
    label: "₹75k Urban Household",
    spend: {
      online_shopping_general: 12000,
      amazon_flipkart_myntra: 10000,
      dining_swiggy_zomato: 8000,
      groceries_quick_commerce: 12000,
      travel_flights_hotels: 8000,
      upi_scan_and_pay: 7000,
      utilities_bills_telecom: 6000,
      fuel: 4000,
      insurance: 3000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 5000,
    },
  },
  {
    id: "flyer",
    label: "₹1.5L High Spend & Travel",
    spend: {
      online_shopping_general: 22000,
      amazon_flipkart_myntra: 18000,
      dining_swiggy_zomato: 14000,
      groceries_quick_commerce: 14000,
      travel_flights_hotels: 32000,
      upi_scan_and_pay: 10000,
      utilities_bills_telecom: 8000,
      fuel: 5000,
      insurance: 5000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 12000,
      offline_general_other: 10000,
    },
  },
];

function findBestMatch(cards: CardSummaryItem[], patterns: string[]): string | null {
  for (const pat of patterns) {
    const q = pat.toLowerCase();
    const found = cards.find(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.card_id.toLowerCase().includes(q)
    );
    if (found) return found.card_id;
  }
  return null;
}

export function MyCardsClient({ cards, waiverMap }: MyCardsClientProps) {
  const {
    ownedIds,
    walletMeta,
    toggleOwned,
    setOwnedIds,
    moveOwnedCard,
    updateWalletMeta,
    clearOwned,
  } = useCompare();

  const [selectedCardModal, setSelectedCardModal] = useState<CardSummaryItem | null>(null);
  const [renewalDraft, setRenewalDraft] = useState("");
  const [last4Draft, setLast4Draft] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");

  const openCardModal = (card: CardSummaryItem) => {
    const m = walletMeta[card.card_id];
    setSelectedCardModal(card);
    setRenewalDraft(m?.renewalDate ?? "");
    setLast4Draft(m?.last4Digits ?? "");
    setNicknameDraft(m?.nickname ?? "");
  };

  const saveCardModalMeta = () => {
    if (!selectedCardModal) return;
    const cleanLast4 = last4Draft.replace(/\D/g, "").slice(0, 4);
    updateWalletMeta(selectedCardModal.card_id, {
      renewalDate: renewalDraft.trim() || undefined,
      last4Digits: cleanLast4 || undefined,
      nickname: nicknameDraft.trim() || undefined,
    });
    setSelectedCardModal(null);
  };

  const enrichedCards = useMemo(
    () =>
      cards.map((c) => ({
        ...c,
        fee_waiver_spend_inr: c.fee_waiver_spend_inr ?? waiverMap[c.card_id] ?? null,
      })),
    [cards, waiverMap]
  );

  const [cardSearch, setCardSearch] = useState("");
  const [spendPresetId, setSpendPresetId] = useState<string>("urban");
  const [monthlySpend, setMonthlySpend] = useState<Record<SpendCategoryKey, number>>(
    () => ({ ...SPEND_PRESETS[1].spend })
  );
  const [needDomesticLounge, setNeedDomesticLounge] = useState(true);
  const [needNoSpendLounge, setNeedNoSpendLounge] = useState(true);
  const [needInternationalLounge, setNeedInternationalLounge] = useState(false);
  const [needGolf, setNeedGolf] = useState(false);

  const starterStacks = useMemo(() => {
    const cashbackIds = [
      findBestMatch(enrichedCards, ["cashback sbi"]),
      findBestMatch(enrichedCards, ["hsbc live+"]),
      findBestMatch(enrichedCards, ["airtel axis", "amazon pay icici"]),
    ].filter((id): id is string => Boolean(id));

    const travelIds = [
      findBestMatch(enrichedCards, ["infinia metal", "diners club black", "regalia gold"]),
      findBestMatch(enrichedCards, ["axis bank atlas", "hsbc travelone"]),
      findBestMatch(enrichedCards, ["ixigo", "scapia"]),
    ].filter((id): id is string => Boolean(id));

    const ltfUpiIds = [
      findBestMatch(enrichedCards, ["amazon pay icici"]),
      findBestMatch(enrichedCards, ["tata neu plus", "kiwi", "hdfc pixel"]),
      findBestMatch(enrichedCards, ["scapia", "ixigo"]),
    ].filter((id): id is string => Boolean(id));

    return [
      { id: "cashback", label: "Try Cashback Trio", ids: Array.from(new Set(cashbackIds)) },
      { id: "travel", label: "Try Travel Stack", ids: Array.from(new Set(travelIds)) },
      { id: "ltf", label: "Try ₹0 LTF + UPI Stack", ids: Array.from(new Set(ltfUpiIds)) },
    ].filter((s) => s.ids.length > 0);
  }, [enrichedCards]);

  const searchMatches = useMemo(() => {
    if (!cardSearch.trim()) return [];
    return enrichedCards
      .filter((c) =>
        matchesTokenizedQuery(
          [c.card_name, c.bank, c.primary_category, c.card_network].filter(Boolean).join(" "),
          cardSearch
        )
      )
      .slice(0, 12);
  }, [enrichedCards, cardSearch]);

  const analysis = useMemo(
    () =>
      analyzeOwnedPortfolio(enrichedCards, ownedIds, monthlySpend, {
        needDomesticLounge,
        needNoSpendLounge,
        needInternationalLounge,
        needGolf,
      }),
    [
      enrichedCards,
      ownedIds,
      monthlySpend,
      needDomesticLounge,
      needNoSpendLounge,
      needInternationalLounge,
      needGolf,
    ]
  );

  const aiSummary = useMemo(() => generateMyCardsAiSummary(analysis), [analysis]);

  const applySpendPreset = (presetId: string) => {
    const found = SPEND_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setSpendPresetId(presetId);
    setMonthlySpend({ ...found.spend });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
            Portfolio Analyzer &amp; Swipe Hack Engine
          </span>
          <h1 className="text-[28px] sm:text-[34px] font-medium text-[#1A1D21] tracking-[-0.02em] mt-2">
            My Cards &amp; Wallet Utilization Optimizer
          </h1>
          <p className="text-[14.5px] text-[#4B525C] mt-1 max-w-2xl leading-relaxed">
            Pick the credit cards already in your wallet to see a ✅ category utilization table, cap-spillover swipe hacks, lounge &amp; golf coverage check, keep vs downgrade verdicts, and exact gap-filling upgrades.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {starterStacks.map((stack) => (
            <button
              key={stack.id}
              type="button"
              onClick={() => setOwnedIds(stack.ids)}
              className="text-[12.5px] bg-white hover:bg-[#F3F2EE] border border-[#E4E4DF] text-[#1A1D21] px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {stack.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Card Picker & Owned Stack */}
      <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-medium text-[#1A1D21]">
              1. Cards Currently in Your Wallet ({analysis.ownedCards.length})
            </h2>
            <p className="text-[12.5px] text-[#717882] mt-0.5">
              Search any of {enrichedCards.length} Indian credit cards (persisted automatically across sessions).
            </p>
          </div>
          {analysis.ownedCards.length > 0 && (
            <button
              type="button"
              onClick={clearOwned}
              className="inline-flex items-center gap-1.5 text-[12.5px] text-[#991B1B] hover:bg-[#FDF2F2] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer w-fit"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear Wallet
            </button>
          )}
        </div>

        {/* Search Picker */}
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#717882] absolute left-3.5 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            placeholder="Search by card or bank (e.g. 'hsbc live', 'sbi cashback', 'infinia', 'axis atlas')..."
            aria-label="Search credit cards to add to your wallet"
            className="w-full pl-10 pr-10 py-2.5 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
          />
          {cardSearch && (
            <button
              type="button"
              onClick={() => setCardSearch("")}
              aria-label="Clear card search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717882] hover:text-[#1A1D21] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dropdown Search Results */}
          {searchMatches.length > 0 && (
            <div className="mt-2 bg-white border border-[#E4E4DF] rounded-xl divide-y divide-[#E4E4DF] max-h-72 overflow-y-auto shadow-sm">
              {searchMatches.map((card) => {
                const added = ownedIds.includes(card.card_id);
                return (
                  <div
                    key={card.card_id}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#FAF9F6]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="sm" />
                      <div className="min-w-0">
                        <span className="block text-[13.5px] font-medium text-[#1A1D21] truncate">
                          {card.card_name}
                        </span>
                        <span className="block text-[11.5px] text-[#717882] truncate tabular-nums">
                          {card.bank} · {card.primary_category} ·{" "}
                          {card.annual_fee_inr === 0
                            ? "₹0 (LTF)"
                            : `${formatInr(card.annual_fee_inr)}/yr`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleOwned(card.card_id)}
                      className={`inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg border shrink-0 transition-colors cursor-pointer ${
                        added
                          ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                          : "bg-[#0F5C4D] border-[#0F5C4D] text-white hover:bg-[#0B473B]"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Add Card
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Owned Card Portfolio Deck with Reorder, Renewal Date & Check Airport & Golf */}
        {analysis.ownedCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {analysis.ownedCards.map((c, idx) => {
              const feeInfo = formatFeeDisplay(c.joining_fee_inr, c.annual_fee_inr);
              const meta = walletMeta[c.card_id];
              return (
                <div
                  key={c.card_id}
                  className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3.5 flex flex-col justify-between gap-2.5 hover:border-[#0F5C4D]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openCardModal(c)}
                      className="flex items-start gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                    >
                      <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] text-[#717882] flex items-center gap-1.5">
                          <span>{c.bank}</span>
                          {meta?.last4Digits && (
                            <span className="font-mono text-[#0F5C4D] bg-[#EEF5F2] px-1.5 py-0.2 rounded">
                              •••• {meta.last4Digits}
                            </span>
                          )}
                          {meta?.nickname && (
                            <span className="text-[#4B525C] truncate">· {meta.nickname}</span>
                          )}
                        </div>
                        <div className="font-semibold text-[14px] text-[#1A1D21] group-hover:text-[#0F5C4D] truncate mt-0.5">
                          {c.card_name}
                        </div>
                        <div className="text-[12px] text-[#0F5C4D] font-medium mt-0.5 tabular-nums">
                          {feeInfo.primaryText}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveOwnedCard(c.card_id, "up")}
                        title="Move up"
                        aria-label={`Move ${c.card_name} up`}
                        className="p-1 rounded bg-white border border-[#E4E4DF] text-[#4B525C] hover:text-[#1A1D21] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === analysis.ownedCards.length - 1}
                        onClick={() => moveOwnedCard(c.card_id, "down")}
                        title="Move down"
                        aria-label={`Move ${c.card_name} down`}
                        className="p-1 rounded bg-white border border-[#E4E4DF] text-[#4B525C] hover:text-[#1A1D21] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleOwned(c.card_id)}
                        aria-label={`Remove ${c.card_name} from wallet`}
                        className="p-1 text-[#717882] hover:text-[#991B1B] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E4E4DF] text-[12px]">
                    <button
                      type="button"
                      onClick={() => openCardModal(c)}
                      className="inline-flex items-center gap-1 text-[#4B525C] hover:text-[#0F5C4D] cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#0F5C4D]" />
                      <span>
                        {meta?.renewalDate ? `Renews ${meta.renewalDate}` : "Set renewal date"}
                      </span>
                      <Pencil className="w-3 h-3 opacity-70" />
                    </button>

                    <Link
                      href={`/lounges?card=${encodeURIComponent(c.card_id)}`}
                      className="inline-flex items-center gap-1 font-medium text-[#0F5C4D] hover:underline"
                    >
                      <Plane className="w-3.5 h-3.5" />
                      <span>Check Airport &amp; Golf</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#FAF9F6] border border-dashed border-[#D3D3CC] rounded-xl p-5 text-center space-y-2">
            <p className="text-[14px] text-[#4B525C]">
              Select cards above or pick a starter stack preset to inspect your category matrix and missing gaps.
            </p>
          </div>
        )}
      </section>

      {/* Section 2: Monthly Spend & Lifestyle Preferences */}
      <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-medium text-[#1A1D21]">
              2. Monthly Spend &amp; Lounge / Golf Requirements
            </h2>
            <p className="text-[12.5px] text-[#717882] mt-0.5 tabular-nums">
              Total Monthly Spend: {formatInr(analysis.totalMonthlySpendInr)} ({formatInr(analysis.totalMonthlySpendInr * 12)}/yr)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SPEND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applySpendPreset(preset.id)}
                className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  spendPresetId === preset.id
                    ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D]"
                    : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SPEND_CATEGORY_KEYS.map((key) => (
            <div key={key} className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3">
              <label
                htmlFor={`spend-${key}`}
                className="block text-[12px] text-[#4B525C] truncate"
              >
                {SPEND_CATEGORY_META[key].shortLabel}
              </label>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[12.5px] text-[#717882]">₹</span>
                <input
                  id={`spend-${key}`}
                  type="number"
                  min={0}
                  step={500}
                  value={monthlySpend[key] || 0}
                  onChange={(e) => {
                    setSpendPresetId("custom");
                    const val = Math.max(0, Number(e.target.value) || 0);
                    setMonthlySpend((prev) => ({ ...prev, [key]: val }));
                  }}
                  className="w-full bg-white border border-[#E4E4DF] rounded-md px-2 py-1 text-[13px] text-[#1A1D21] tabular-nums focus:outline-none focus:border-[#0F5C4D]"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Lounge & Golf Need Flags */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#E4E4DF] text-[13px] text-[#4B525C]">
          <span className="text-[12px] text-[#717882]">Required Lifestyle Perks:</span>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needDomesticLounge}
              onChange={(e) => setNeedDomesticLounge(e.target.checked)}
              className="accent-[#0F5C4D] w-3.5 h-3.5 cursor-pointer"
            />
            Domestic Lounge
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needNoSpendLounge}
              onChange={(e) => setNeedNoSpendLounge(e.target.checked)}
              className="accent-[#0F5C4D] w-3.5 h-3.5 cursor-pointer"
            />
            Zero Quarterly Spend Lounge
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needInternationalLounge}
              onChange={(e) => setNeedInternationalLounge(e.target.checked)}
              className="accent-[#0F5C4D] w-3.5 h-3.5 cursor-pointer"
            />
            International / Priority Pass
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={needGolf}
              onChange={(e) => setNeedGolf(e.target.checked)}
              className="accent-[#0F5C4D] w-3.5 h-3.5 cursor-pointer"
            />
            Golf Green Fees
          </label>
        </div>
      </section>

      {/* Portfolio Output Sections (Shown once >= 1 card is selected) */}
      <AnimatePresence mode="wait">
        {analysis.ownedCards.length > 0 && (
          <motion.div
            key={analysis.ownedCards.map((c) => c.card_id).join(",")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={calmTransition}
            className="space-y-6"
          >
            {/* AI Wallet Optimization Plan */}
            {aiSummary && (
              <div className="bg-white border border-[#0F5C4D]/30 rounded-xl p-4 sm:p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-md">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    AI Wallet Optimization Plan
                  </span>
                  <span className="text-[12px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-full">
                    {aiSummary.healthBadge}
                  </span>
                </div>
                <p className="text-[14.5px] font-medium text-[#1A1D21] leading-snug">
                  {aiSummary.headline}
                </p>
                <ul className="space-y-1 text-[13px] text-[#4B525C] list-disc pl-4">
                  {aiSummary.actionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* KPI Summary Strip */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 tabular-nums">
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                <span className="block text-[12px] text-[#717882]">Optimized Annual Rewards</span>
                <span className="block text-[22px] font-medium text-[#0F5C4D] mt-1">
                  +{formatInr(analysis.totalCurrentAnnualRewardsInr)}
                </span>
                <span className="block text-[11.5px] text-[#717882] mt-0.5">
                  Across {analysis.ownedCards.length} owned cards
                </span>
              </div>
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                <span className="block text-[12px] text-[#717882]">Effective Renewal Fees</span>
                <span className="block text-[22px] font-medium text-[#1A1D21] mt-1">
                  {analysis.totalCurrentFeesInr === 0
                    ? "₹0 (Waived / LTF)"
                    : `-${formatInr(analysis.totalCurrentFeesInr)}`}
                </span>
                <span className="block text-[11.5px] text-[#717882] mt-0.5">
                  Includes 18% GST if unwaived
                </span>
              </div>
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                <span className="block text-[12px] text-[#717882]">Net Portfolio Benefit</span>
                <span
                  className={`block text-[22px] font-medium mt-1 ${
                    analysis.netCurrentAnnualValueInr >= 0
                      ? "text-[#0F5C4D]"
                      : "text-[#991B1B]"
                  }`}
                >
                  {formatInr(analysis.netCurrentAnnualValueInr)}/yr
                </span>
                <span className="block text-[11.5px] text-[#717882] mt-0.5">
                  Rewards minus renewal fees
                </span>
              </div>
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-4">
                <span className="block text-[12px] text-[#717882]">Blended Net Yield</span>
                <span className="block text-[22px] font-medium text-[#1A1D21] mt-1">
                  {analysis.blendedYieldPct.toFixed(2)}%
                </span>
                <span className="block text-[11.5px] text-[#717882] mt-0.5">
                  On {formatInr(analysis.totalMonthlySpendInr)}/mo spend
                </span>
              </div>
            </section>

            {/* Tabular Utilization Matrix with Checkboxes & Swipe Hacks */}
            <section className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-[#E4E4DF]">
                <h2 className="text-[17px] font-medium text-[#1A1D21]">
                  3. Where to Swipe Each Card (✅ Utilization Matrix &amp; Cap Spillover Hacks)
                </h2>
                <p className="text-[13px] text-[#4B525C] mt-0.5">
                  Green ✅ marks the optimal card per spend category; 🔄 marks a spillover backup card when monthly caps get exhausted.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left border-collapse text-[12.5px] tabular-nums">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[#717882]">
                      <th className="py-3 px-4 font-medium">Spend Category</th>
                      <th className="py-3 px-3 font-medium">Spend/mo</th>
                      {analysis.ownedCards.map((c) => (
                        <th key={c.card_id} className="py-3 px-3 font-medium max-w-[160px]">
                          <div className="flex items-center gap-1.5">
                            <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                            <span className="truncate text-[#1A1D21]">{c.card_name}</span>
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-3 font-medium">Annual Earned</th>
                      <th className="py-3 px-4 font-medium min-w-[260px]">Optimal Swipe Hack</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4DF]">
                    {analysis.matrixRows.map((row) => (
                      <tr
                        key={row.key}
                        className={
                          row.isWeakCoverage
                            ? "bg-[#FEF6EA]/55"
                            : "hover:bg-[#FAF9F6] transition-colors"
                        }
                      >
                        <td className="py-3 px-4 text-[#1A1D21] font-medium">
                          {row.shortLabel}
                          {row.isWeakCoverage && (
                            <span className="block text-[11px] text-[#9A5B13] font-normal">
                              Weak yield (&lt;1.5%)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#4B525C]">
                          {formatInr(row.monthlySpendInr)}
                        </td>
                        {analysis.ownedCards.map((c) => {
                          const cell = row.cellsByCardId[c.card_id];
                          if (!cell) return <td key={c.card_id} className="py-3 px-3">—</td>;
                          return (
                            <td key={c.card_id} className="py-3 px-3">
                              {cell.isPrimary ? (
                                <span className="inline-flex items-center gap-1 bg-[#EEF5F2] border border-[#0F5C4D]/30 text-[#0F5C4D] px-2 py-0.5 rounded-md font-medium">
                                  <Check className="w-3 h-3" aria-hidden="true" />
                                  {cell.effectivePct.toFixed(1)}%
                                </span>
                              ) : cell.isBackup ? (
                                <span className="inline-flex items-center gap-1 bg-[#EFF6FF] border border-[#2563EB]/25 text-[#1D4ED8] px-2 py-0.5 rounded-md font-medium">
                                  Split {cell.effectivePct.toFixed(1)}%
                                </span>
                              ) : cell.isZero ? (
                                <span className="text-[#9AA1AC]">—</span>
                              ) : (
                                <span className="text-[#717882]">
                                  {cell.effectivePct.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-[#0F5C4D] font-medium">
                          {row.annualRewardInr > 0
                            ? `+${formatInr(row.annualRewardInr)}`
                            : "₹0"}
                        </td>
                        <td className="py-3 px-4 text-[#4B525C] leading-snug">
                          {row.hackTip}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Lounge & Golf Coverage Audit */}
            <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                  <h2 className="text-[16px] font-medium text-[#1A1D21]">
                    4. Lounge &amp; Golf Coverage Check
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
                  <Link
                    href="/lounges?airport=DEL"
                    className="font-medium text-[#0F5C4D] hover:underline"
                  >
                    Check Delhi (DEL) &amp; 42 Airport Terminals →
                  </Link>
                  <Link href="/categories?cat=golf" className="text-[#4B525C] hover:text-[#0F5C4D] hover:underline">
                    Golf Cards →
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-[12.5px]">
                {[
                  {
                    label: "Domestic Airport Lounge",
                    ok: analysis.loungeAudit.hasDomestic,
                    detail: analysis.loungeAudit.bestLoungeCardName || "Not covered",
                  },
                  {
                    label: "Zero-Spend Domestic Lounge",
                    ok: analysis.loungeAudit.hasNoSpendDomestic,
                    detail: analysis.loungeAudit.hasNoSpendDomestic
                      ? "Unconditional access active"
                      : "All cards require quarterly spend",
                  },
                  {
                    label: "International / Priority Pass",
                    ok: analysis.loungeAudit.hasInternational,
                    detail: analysis.loungeAudit.hasInternational ? "Covered" : "Not covered",
                  },
                  {
                    label: "Railway Lounge (IRCTC)",
                    ok: analysis.loungeAudit.hasRailway,
                    detail: analysis.loungeAudit.hasRailway ? "Covered" : "Not covered",
                  },
                  {
                    label: "Golf Green Fees",
                    ok: analysis.loungeAudit.hasGolf,
                    detail: analysis.loungeAudit.bestGolfCardName || "Not covered",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`border rounded-lg p-3 ${
                      stat.ok
                        ? "bg-[#EEF5F2]/60 border-[#0F5C4D]/25"
                        : "bg-[#FAF9F6] border-[#E4E4DF]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[#4B525C]">{stat.label}</span>
                      {stat.ok ? (
                        <Check className="w-4 h-4 text-[#0F5C4D] shrink-0" />
                      ) : (
                        <span className="text-[11px] text-[#717882]">Missing</span>
                      )}
                    </div>
                    <span className="block text-[#1A1D21] font-medium mt-1 truncate">
                      {stat.detail}
                    </span>
                  </div>
                ))}
              </div>

              {analysis.loungeAudit.gaps.length > 0 && (
                <div className="bg-[#FEF6EA] border border-[#9A5B13]/25 rounded-lg p-3.5 space-y-1 text-[13px] text-[#9A5B13]">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    Missing Requirement Gaps:
                  </span>
                  {analysis.loungeAudit.gaps.map((g) => (
                    <div key={g}>• {g}</div>
                  ))}
                </div>
              )}
            </section>

            {/* Keep / Review & Downgrade + Recommended Additions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Keep / Remove Audit */}
              <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
                <h2 className="text-[16px] font-medium text-[#1A1D21]">
                  5. Keep vs Review / Downgrade Verdict
                </h2>
                <div className="space-y-3">
                  {analysis.cardAudits.map((audit) => {
                    const isReview = audit.action === "REVIEW_OR_DOWNGRADE";
                    return (
                      <div
                        key={audit.card.card_id}
                        className={`border rounded-xl p-4 space-y-2 ${
                          isReview
                            ? "bg-[#FEF6EA]/50 border-[#9A5B13]/25"
                            : "bg-[#FAF9F6] border-[#E4E4DF]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <BankLogo
                              bankSlug={audit.card.bank_slug}
                              bank={audit.card.bank}
                              size="xs"
                            />
                            <Link
                              href={`/${audit.card.bank_slug}/${audit.card.card_slug}`}
                              className="text-[14px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] truncate"
                            >
                              {audit.card.card_name}
                            </Link>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-md shrink-0 font-medium ${
                              isReview
                                ? "bg-[#FEF6EA] text-[#9A5B13] border border-[#9A5B13]/30"
                                : "bg-[#EEF5F2] text-[#0F5C4D] border border-[#0F5C4D]/25"
                            }`}
                          >
                            {isReview ? "Review / Downgrade" : "Keep"}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#4B525C] leading-relaxed">
                          {audit.reason}
                        </p>
                        <div className="flex items-center justify-between text-[12px] text-[#717882] pt-2 border-t border-[#E4E4DF] tabular-nums">
                          <span>
                            Attributed: +{formatInr(audit.attributedAnnualRewardInr)}/yr
                          </span>
                          <span>
                            Eff. Fee:{" "}
                            {audit.effectiveFeeInr === 0
                              ? "₹0"
                              : formatInr(audit.effectiveFeeInr)}
                          </span>
                          <span
                            className={
                              audit.netAttributedValueInr >= 0
                                ? "text-[#0F5C4D] font-medium"
                                : "text-[#991B1B] font-medium"
                            }
                          >
                            Net {formatInr(audit.netAttributedValueInr)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recommended Additions */}
              <section className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                  <h2 className="text-[16px] font-medium text-[#1A1D21]">
                    6. Best Cards to Add Next (Closes Gaps &amp; Boosts Net Yield)
                  </h2>
                </div>

                {analysis.recommendedAdditions.length > 0 ? (
                  <div className="space-y-3">
                    {analysis.recommendedAdditions.map((rec) => (
                      <div
                        key={rec.card.card_id}
                        className="border border-[#E4E4DF] rounded-xl p-4 space-y-2.5 bg-[#FAF9F6]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <BankLogo
                                bankSlug={rec.card.bank_slug}
                                bank={rec.card.bank}
                                size="xs"
                              />
                              <span className="text-[11.5px] text-[#717882]">
                                {rec.card.bank} ·{" "}
                                {rec.card.annual_fee_inr === 0
                                  ? "₹0 (LTF)"
                                  : `${formatInr(rec.card.annual_fee_inr)}/yr`}
                              </span>
                            </div>
                            <Link
                              href={`/${rec.card.bank_slug}/${rec.card.card_slug}`}
                              className="block text-[14.5px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] mt-1"
                            >
                              {rec.card.card_name}
                            </Link>
                          </div>
                          <span className="text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-lg tabular-nums shrink-0">
                            {rec.incrementalAnnualGainInr >= 0
                              ? `+${formatInr(rec.incrementalAnnualGainInr)}/yr`
                              : `${formatInr(rec.incrementalAnnualGainInr)}/yr`}
                          </span>
                        </div>

                        <p className="text-[13px] text-[#4B525C]">{rec.summaryReason}</p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {rec.fillsLoungeGap && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded">
                              <Plane className="w-3 h-3" aria-hidden="true" />
                              Closes Lounge Gap
                            </span>
                          )}
                          {rec.fillsGolfGap && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded">
                              <Flag className="w-3 h-3" aria-hidden="true" />
                              Adds Golf Access
                            </span>
                          )}
                          {rec.replacesOrBoosts.map((b) => (
                            <span
                              key={b}
                              className="text-[11px] bg-white border border-[#E4E4DF] text-[#4B525C] px-2 py-0.5 rounded"
                            >
                              {b}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E4E4DF]">
                          <Link
                            href={`/${rec.card.bank_slug}/${rec.card.card_slug}`}
                            className="inline-flex items-center gap-1 text-[12.5px] text-[#0F5C4D] hover:underline"
                          >
                            Full Card Review
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => toggleOwned(rec.card.card_id)}
                            className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Simulate Adding to Wallet
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#EEF5F2]/60 border border-[#0F5C4D]/20 rounded-xl p-4 text-[13.5px] text-[#0F5C4D]">
                    Your current stack already captures near-peak returns across your active spend buckets with no unmet lounge/golf requirements.
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personal Saved Card Details Modal (Fees, Renewal Date, Check Airport & Golf) */}
      <AnimatePresence>
        {selectedCardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
            onClick={() => setSelectedCardModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <BankLogo bankSlug={selectedCardModal.bank_slug} bank={selectedCardModal.bank} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold text-[#1A1D21] truncate">
                      {selectedCardModal.card_name}
                    </h3>
                    <p className="text-[12.5px] text-[#717882]">
                      {selectedCardModal.bank} · {selectedCardModal.card_network}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCardModal(null)}
                  className="text-[#717882] hover:text-[#1A1D21] p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(() => {
                const feeInfo = formatFeeDisplay(
                  selectedCardModal.joining_fee_inr,
                  selectedCardModal.annual_fee_inr
                );
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[12.5px]">
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3">
                      <span className="text-[#717882] block text-[11px]">
                        {feeInfo.isSplit ? "Joining Fee" : "Joining / Card Fee"}
                      </span>
                      <span className="font-semibold text-[#1A1D21] tabular-nums">
                        {feeInfo.joiningText}
                      </span>
                    </div>
                    {feeInfo.isSplit && (
                      <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3">
                        <span className="text-[#717882] block text-[11px]">Annual Renewal Fee</span>
                        <span className="font-semibold text-[#1A1D21] tabular-nums">
                          {feeInfo.annualText}
                        </span>
                      </div>
                    )}
                    <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3">
                      <span className="text-[#717882] block text-[11px]">Indian Lounges</span>
                      <span className="font-semibold text-[#0F5C4D] tabular-nums">
                        {selectedCardModal.domestic_lounge_accessible_count ??
                          selectedCardModal.accessible_lounge_codes?.length ??
                          0}{" "}
                        verified
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 text-[13px]">
                <div>
                  <label className="block text-[12px] font-medium text-[#4B525C] mb-1">
                    Date of Renewal
                  </label>
                  <input
                    type="text"
                    value={renewalDraft}
                    onChange={(e) => setRenewalDraft(e.target.value)}
                    placeholder="e.g. 15 Nov 2026"
                    className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[#4B525C] mb-1">
                      Last 4 Digits
                    </label>
                    <input
                      type="text"
                      value={last4Draft}
                      onChange={(e) => setLast4Draft(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="4821"
                      maxLength={4}
                      className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#4B525C] mb-1">
                      Nickname / Label
                    </label>
                    <input
                      type="text"
                      value={nicknameDraft}
                      onChange={(e) => setNicknameDraft(e.target.value)}
                      placeholder="Personal / Add-on"
                      className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <Link
                  href={`/lounges?card=${encodeURIComponent(selectedCardModal.card_id)}`}
                  onClick={() => saveCardModalMeta()}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#1A1D21] hover:bg-[#2B3038] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Plane className="w-4 h-4" />
                  Check Airport &amp; Golf for This Card Only
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/${selectedCardModal.bank_slug}/${selectedCardModal.card_slug}`}
                    onClick={() => saveCardModalMeta()}
                    className="flex-1 text-center border border-[#E4E4DF] hover:border-[#0F5C4D] text-[#1A1D21] text-[13px] font-medium px-3 py-2 rounded-xl transition-colors"
                  >
                    Full Card Dossier →
                  </Link>
                  <button
                    type="button"
                    onClick={saveCardModalMeta}
                    className="flex-1 bg-[#0F5C4D] hover:bg-[#0B463B] text-white text-[13px] font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Save Details
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
