"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Layers, Plus, Sparkles, Star, X } from "lucide-react";
import { formatFeeDisplay } from "@/lib/format";
import type { MultiCategoryRecommendation } from "@/lib/multiCategoryMatcher";
import { BankLogo } from "./BankLogo";
import { CardArtwork } from "./CardArtwork";
import { useCompare } from "./CompareContext";

interface MultiCategoryBestCardPanelProps {
  recommendation: MultiCategoryRecommendation;
  requireAllMatch: boolean;
  onToggleRequireAll: () => void;
  onRemoveCategory: (categoryId: string) => void;
  onClearAll: () => void;
}

export function MultiCategoryBestCardPanel({
  recommendation,
  requireAllMatch,
  onToggleRequireAll,
  onRemoveCategory,
  onClearAll,
}: MultiCategoryBestCardPanelProps) {
  const router = useRouter();
  const { isSelected, toggleItem } = useCompare();
  const {
    selectedMetas,
    bestOverall,
    runnerUp,
    bestLtfPick,
    twoCardCombo,
    fullMatchCount,
  } = recommendation;

  const toCompareItem = (c: NonNullable<typeof bestOverall>["card"]) => ({
    card_id: c.card_id,
    card_name: c.card_name,
    bank: c.bank,
    bank_slug: c.bank_slug,
    card_slug: c.card_slug,
    annual_fee_inr: c.annual_fee_inr,
    overall_rating: c.overall_rating,
  });

  if (selectedMetas.length < 2) return null;

  const secondaryPick =
    bestLtfPick && (!runnerUp || bestLtfPick.card.card_id !== runnerUp.card.card_id)
      ? { badge: "Best Lifetime-Free Pick", item: bestLtfPick }
      : runnerUp
      ? { badge: "Runner-Up Match", item: runnerUp }
      : null;

  return (
    <section
      aria-label="Best cards for selected categories"
      className="bg-gradient-to-br from-[#F4F9F6] via-white to-[#FAF9F6] border border-[#0F5C4D]/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-[0_8px_28px_rgba(15,92,77,0.06)]"
    >
      {/* Top Bar: Selected Category Chips + Match Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-[#0F5C4D] bg-[#E3F1EA] px-2.5 py-1 rounded-md shrink-0">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Best Card for {selectedMetas.length} Categories
          </span>
          {selectedMetas.map((meta) => (
            <button
              key={meta.id}
              type="button"
              onClick={() => onRemoveCategory(meta.id)}
              title={`Remove ${meta.shortLabel}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium bg-white border border-[#C9DBD2] text-[#1A1D21] hover:border-[#0F5C4D] transition-colors cursor-pointer"
            >
              <span>{meta.shortLabel}</span>
              <X className="w-3 h-3 text-[#717882]" aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleRequireAll}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
              requireAllMatch
                ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                : "bg-white border-[#D6D6CE] text-[#4B525C] hover:border-[#0F5C4D]"
            }`}
          >
            <span>Match All ({fullMatchCount})</span>
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-[12px] text-[#717882] hover:text-[#1A1D21] underline cursor-pointer"
          >
            Exit Multi
          </button>
        </div>
      </div>

      {/* #1 Best Single Card Winner */}
      {bestOverall ? (
        <div className="bg-white border border-[#D4E2DA] rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="shrink-0 hidden sm:block">
                <CardArtwork
                  localImagePath={bestOverall.card.local_image_path}
                  cardName={bestOverall.card.card_name}
                  bank={bestOverall.card.bank}
                  network={bestOverall.card.card_network}
                  size="sm"
                  cardTheme={bestOverall.card.card_theme}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#0F5C4D] text-white px-2 py-0.5 rounded">
                    #1 Best Overall Match
                  </span>
                  <span
                    className={`text-[11.5px] font-medium px-2 py-0.5 rounded tabular-nums ${
                      bestOverall.isFullMatch
                        ? "bg-[#EEF5F2] text-[#0F5C4D]"
                        : "bg-[#FFF7E6] text-[#946200]"
                    }`}
                  >
                    Covers {bestOverall.matchedCount}/{bestOverall.totalSelected} selected
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[11.5px] text-[#4B525C] tabular-nums">
                    <Star className="w-3 h-3 fill-[#D99B26] text-[#D99B26]" aria-hidden="true" />
                    {bestOverall.card.overall_rating.toFixed(1)}
                  </span>
                </div>

                <Link
                  href={`/${bestOverall.card.bank_slug}/${bestOverall.card.card_slug}`}
                  className="block text-[17px] sm:text-[18px] font-semibold text-[#1A1D21] hover:text-[#0F5C4D] transition-colors leading-snug"
                >
                  {bestOverall.card.card_name}
                </Link>

                <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#4B525C]">
                  <span className="inline-flex items-center gap-1.5">
                    <BankLogo
                      bankSlug={bestOverall.card.bank_slug}
                      bank={bestOverall.card.bank}
                      size="xs"
                    />
                    {bestOverall.card.bank}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {bestOverall.card.filter_tags.is_ltf
                      ? "Lifetime Free (₹0)"
                      : formatFeeDisplay(
                          bestOverall.card.joining_fee_inr,
                          bestOverall.card.annual_fee_inr
                        ).primaryText}
                  </span>
                  {bestOverall.avgRatePct > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#0F5C4D] font-medium tabular-nums">
                        Avg {bestOverall.avgRatePct.toFixed(1)}% return
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleItem(toCompareItem(bestOverall.card))}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium rounded-lg border transition-colors cursor-pointer ${
                  isSelected(bestOverall.card.card_id)
                    ? "bg-[#EEF5F2] border-[#0F5C4D] text-[#0F5C4D]"
                    : "bg-white border-[#E4E4DF] text-[#1A1D21] hover:border-[#0F5C4D]"
                }`}
              >
                {isSelected(bestOverall.card.card_id) ? (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Compare
              </button>
              <Link
                href={`/${bestOverall.card.bank_slug}/${bestOverall.card.card_slug}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[12.5px] font-medium rounded-lg transition-colors"
              >
                Full Dossier
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Per-Category Yield Breakdown */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#ECECE6]">
            {bestOverall.categoryMetrics.map((m) => (
              <span
                key={m.categoryId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] border tabular-nums ${
                  m.matched
                    ? "bg-[#EEF5F2] border-[#C9DBD2] text-[#0F5C4D] font-medium"
                    : m.isPartialBase
                    ? "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C]"
                    : "bg-[#FAF9F6] border-[#ECECE6] text-[#717882]"
                }`}
              >
                {m.matched && <Check className="w-3 h-3 shrink-0" aria-hidden="true" />}
                <span>{m.shortLabel}:</span>
                <span className="font-semibold">
                  {m.displayMetric}
                  {m.isPartialBase ? " base" : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 text-[13px] text-[#4B525C]">
          No single card matches with current sidebar filters. Try relaxing fee/income filters or switching off Match All.
        </div>
      )}

      {/* Runner-Up / Best LTF + 2-Card Combo */}
      {(secondaryPick || twoCardCombo) && (
        <div
          className={`grid grid-cols-1 gap-3 ${
            secondaryPick && twoCardCombo ? "md:grid-cols-2" : ""
          }`}
        >
          {secondaryPick && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#0F5C4D]">
                    {secondaryPick.badge}
                  </span>
                  <span className="text-[11px] text-[#717882] tabular-nums">
                    {secondaryPick.item.matchedCount}/{secondaryPick.item.totalSelected} match ·{" "}
                    {secondaryPick.item.card.filter_tags.is_ltf
                      ? "LTF ₹0"
                      : formatFeeDisplay(
                          secondaryPick.item.card.joining_fee_inr,
                          secondaryPick.item.card.annual_fee_inr
                        ).primaryText}
                  </span>
                </div>
                <Link
                  href={`/${secondaryPick.item.card.bank_slug}/${secondaryPick.item.card.card_slug}`}
                  className="block text-[14.5px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] truncate"
                >
                  {secondaryPick.item.card.card_name}
                </Link>
                <p className="text-[12px] text-[#4B525C] truncate">
                  {secondaryPick.item.summaryLine}
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11.5px] text-[#717882]">
                  {secondaryPick.item.card.bank}
                </span>
                <Link
                  href={`/${secondaryPick.item.card.bank_slug}/${secondaryPick.item.card.card_slug}`}
                  className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                >
                  Inspect →
                </Link>
              </div>
            </div>
          )}

          {twoCardCombo && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-3.5 flex flex-col justify-between gap-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#0F5C4D]">
                    <Layers className="w-3 h-3" aria-hidden="true" />
                    Best 2-Card Combo ({twoCardCombo.coveredCount}/{twoCardCombo.totalSelected})
                  </span>
                  <span className="text-[11px] text-[#717882] tabular-nums">
                    Combined{" "}
                    {twoCardCombo.combinedAnnualFeeInr === 0
                      ? "₹0 (LTF)"
                      : `₹${twoCardCombo.combinedAnnualFeeInr.toLocaleString("en-IN")}/yr`}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-[#1A1D21] truncate">
                  {twoCardCombo.cardA.card.card_name} + {twoCardCombo.cardB.card.card_name}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {twoCardCombo.assignment.map((slot) => (
                    <span
                      key={slot.categoryId}
                      className="text-[11px] bg-[#FAF9F6] border border-[#E4E4DF] rounded px-2 py-0.5 text-[#4B525C] truncate max-w-full"
                    >
                      <strong className="text-[#1A1D21]">{slot.shortLabel}</strong>: {slot.cardName.split(" ").slice(0, 3).join(" ")} ({slot.displayMetric})
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSelected(twoCardCombo.cardA.card.card_id)) {
                      toggleItem(toCompareItem(twoCardCombo.cardA.card));
                    }
                    if (!isSelected(twoCardCombo.cardB.card.card_id)) {
                      toggleItem(toCompareItem(twoCardCombo.cardB.card));
                    }
                    router.push("/compare");
                  }}
                  className="text-[12px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
                >
                  Compare Both Side-by-Side →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
