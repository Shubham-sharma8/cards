"use client";

import React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bookmark, Check, Plus, Star, Table2, Wallet } from "lucide-react";
import type { CardSummaryItem } from "@/lib/types";
import { formatFeeDisplay } from "@/lib/format";
import { getDiscontinuedNotice } from "@/lib/legacyCards";
import { BankLogo } from "./BankLogo";
import { CardArtwork } from "./CardArtwork";
import { useCompare } from "./CompareContext";
import { CanvaFeatureIcon, type CanvaIconKey } from "./FeatureIcon";
import { CometCard } from "./ui/comet-card";
import { useExpandableCard } from "./ui/expandable-card";

interface LedgerCardItemProps {
  card: CardSummaryItem;
  highlightNote?: string;
  variant?: "default" | "comet";
}

interface TagPill {
  key: string;
  label: string;
  icon?: CanvaIconKey;
  tone: "green" | "blue" | "neutral";
}

export function LedgerCardItem({ card, highlightNote, variant = "default" }: LedgerCardItemProps) {
  const { isSelected, toggleItem, isSaved, toggleSaved, isOwned, toggleOwned } = useCompare();
  const { openCard } = useExpandableCard();
  const compared = isSelected(card.card_id);
  const saved = isSaved(card.card_id);
  const owned = isOwned(card.card_id);
  const discontinuedNotice = getDiscontinuedNotice(card);
  const t = card.filter_tags;

  const bestCats = Object.entries(card.effective_return_pct_by_category || {})
    .filter(([k, v]) => k !== "international_forex_net_of_markup" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const pills: TagPill[] = [];
  if (t.is_ltf) {
    pills.push({ key: "ltf", label: "Lifetime Free", icon: "cashback", tone: "green" });
  } else if (t.is_fyf) {
    pills.push({ key: "fyf", label: "First Year Free", tone: "neutral" });
  }
  if (t.is_rupay_upi) {
    pills.push({ key: "rupay", label: "RuPay UPI", icon: "cashback", tone: "blue" });
  }
  if (t.no_spend_domestic_lounge) {
    pills.push({ key: "no-spend-lounge", label: "No-Spend Lounge", icon: "lounge", tone: "blue" });
  } else if (t.has_domestic_lounge) {
    pills.push({ key: "lounge", label: "Domestic Lounge", icon: "lounge", tone: "neutral" });
  }
  if (t.zero_forex) {
    pills.push({ key: "zero-forex", label: "0% Forex", icon: "forex", tone: "green" });
  } else if (t.zero_or_low_forex) {
    pills.push({ key: "low-forex", label: "Low Forex", icon: "forex", tone: "neutral" });
  }
  if (t.has_golf) {
    pills.push({ key: "golf", label: "Golf", icon: "golf", tone: "green" });
  }

  const visiblePills = pills.slice(0, 3);
  const summaryText =
    highlightNote ||
    (t.best_for_tags && t.best_for_tags.length > 0
      ? `Best for: ${t.best_for_tags.slice(0, 2).join(" · ")}`
      : `${card.card_network} · ${card.card_tier} card with transparent fee & reward structure.`);

  const accentHex = card.card_theme?.primary_hex || "#0F5C4D";
  const isPicked = compared || owned;

  const cardNode = (
    <motion.article
      layout="position"
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className={`group relative h-full border rounded-xl p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between gap-4 overflow-hidden ${
        isPicked
          ? "bg-[#F8FCFA] border-[#0F5C4D]/55 ring-2 ring-[#0F5C4D]/15 shadow-[0_10px_28px_rgba(15,92,77,0.08)]"
          : `bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/45 hover:bg-[#FCFDFC] ${
              variant === "comet" ? "" : "hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(26,29,33,0.07)]"
            }`
      }`}
    >
      {/* Subtle dynamic card color hairline on hover or selection */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-0 inset-x-0 h-[2.5px] transition-opacity ${
          isPicked ? "opacity-100" : "opacity-40 group-hover:opacity-100"
        }`}
        style={{ backgroundColor: accentHex }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2.5">
          <Link
            href={`/${card.bank_slug}/${card.card_slug}`}
            className="flex items-start gap-3.5 min-w-0 flex-1"
          >
            <div className="transition-transform duration-200 group-hover:scale-[1.045] group-hover:-rotate-1 shrink-0 drop-shadow-[0_3px_10px_rgba(26,29,33,0.08)]">
              <CardArtwork
                localImagePath={card.local_image_path}
                cardName={card.card_name}
                bank={card.bank}
                network={card.card_network}
                cardTheme={card.card_theme}
                size="md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                <p className="text-[12px] text-[#717882] truncate">{card.bank}</p>
              </div>
              <h3 className="text-[15.5px] font-medium text-[#1A1D21] group-hover:text-[#0F5C4D] transition-colors leading-[1.35] line-clamp-2 min-h-[42px] mt-0.5">
                {card.card_name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[12px] text-[#1A1D21] bg-[#F3F2EE] px-2 py-0.5 rounded-md tabular-nums shrink-0">
                  <Star className="w-3 h-3 text-[#9A5B13]" aria-hidden="true" />
                  {card.overall_rating?.toFixed(2) ?? "N/A"}
                </span>
                <span className="text-[12px] text-[#717882] truncate">
                  {card.primary_category}
                </span>
              </div>
            </div>
          </Link>

          <div className="flex flex-col gap-1.5 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.86 }}
              onClick={() => toggleSaved(card.card_id)}
              aria-label={saved ? `Remove ${card.card_name} from watchlist` : `Save ${card.card_name} to watchlist`}
              title={saved ? "Saved in Watchlist" : "Save to Watchlist"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                saved
                  ? "bg-[#EEF5F2] border-[#0F5C4D]/45 text-[#0F5C4D] shadow-[0_2px_8px_rgba(15,92,77,0.14)]"
                  : "bg-white border-[#E4E4DF] text-[#717882] hover:text-[#1A1D21] hover:border-[#C9C9C2]"
              }`}
            >
              <motion.span
                key={saved ? "saved" : "unsaved"}
                initial={{ scale: 0.72 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
                className="block"
              >
                <Bookmark className="w-3.5 h-3.5" fill={saved ? "#0F5C4D" : "none"} aria-hidden="true" />
              </motion.span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.86 }}
              onClick={() => toggleOwned(card.card_id)}
              aria-label={owned ? `Remove ${card.card_name} from My Cards` : `Mark ${card.card_name} as owned`}
              title={owned ? "In My Cards Wallet" : "I Own This Card"}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                owned
                  ? "bg-[#EEF5F2] border-[#0F5C4D]/45 text-[#0F5C4D] shadow-[0_2px_8px_rgba(15,92,77,0.14)]"
                  : "bg-white border-[#E4E4DF] text-[#717882] hover:text-[#1A1D21] hover:border-[#C9C9C2]"
              }`}
            >
              <motion.span
                key={owned ? "owned" : "not-owned"}
                initial={{ scale: 0.72 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
                className="block"
              >
                <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
              </motion.span>
            </motion.button>
          </div>
        </div>

        {/* Key Feature Tags — Capped for Equal Card Heights */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
          {discontinuedNotice && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#FEF6EA] border border-[#F59E0B]/40 text-[#9A5B13] px-2 py-0.5 rounded-md whitespace-nowrap">
              {discontinuedNotice.badgeLabel}
            </span>
          )}
          {owned && (
            <span className="inline-flex items-center gap-1 text-[11px] bg-[#EEF5F2] border border-[#0F5C4D]/35 text-[#0F5C4D] px-2 py-0.5 rounded-md">
              <Check className="w-3 h-3" aria-hidden="true" />
              In My Wallet
            </span>
          )}
          {visiblePills.length > 0 ? (
            visiblePills.slice(0, owned || discontinuedNotice ? 2 : 3).map((p) => {
              const cls =
                p.tone === "green"
                  ? "bg-[#EEF5F2] border-[#CBE0D7] text-[#0F5C4D]"
                  : p.tone === "blue"
                    ? "bg-[#F3F6FF] border-[#D7E2FF] text-[#1A1D21]"
                    : "bg-[#F3F2EE] border-[#E4E4DF] text-[#4B525C]";
              return (
                <span
                  key={p.key}
                  className={`inline-flex items-center gap-1 text-[11.5px] border px-2 py-0.5 rounded-md whitespace-nowrap ${cls}`}
                >
                  {p.icon && <CanvaFeatureIcon icon={p.icon} size={12} />}
                  {p.label}
                </span>
              );
            })
          ) : (
            <span className="text-[11.5px] bg-[#F3F2EE] border border-[#E4E4DF] text-[#4B525C] px-2 py-0.5 rounded-md">
              {card.card_network} · {card.card_tier}
            </span>
          )}
        </div>

        {/* Highlight / Reward Snapshot — Fixed 2-line Footprint */}
        <p className="text-[12.5px] text-[#4B525C] leading-[19px] line-clamp-2 min-h-[38px]">
          {summaryText}
        </p>
      </div>

      {/* Bottom Metric Ledger Bar: Split cleanly into Metric Row + Action Row so zero overlap occurs */}
      <div className="pt-3 border-t border-[#E4E4DF] space-y-2.5">
        <div className="grid grid-cols-2 gap-3 text-[12.5px] tabular-nums">
          {(() => {
            const feeInfo = formatFeeDisplay(card.joining_fee_inr, card.annual_fee_inr);
            return (
              <div className="min-w-0">
                <span className="block text-[11px] text-[#717882]">{feeInfo.label}</span>
                <span className="text-[#1A1D21] font-medium whitespace-nowrap">
                  {feeInfo.isSplit
                    ? `${feeInfo.joiningText} / ${feeInfo.annualText}`
                    : feeInfo.primaryText}
                </span>
              </div>
            );
          })()}
          <div className="min-w-0 text-right">
            <span className="block text-[11px] text-[#717882]">Peak Return</span>
            <span className="text-[#0F5C4D] font-medium whitespace-nowrap">
              {bestCats[0] ? `${bestCats[0][1].toFixed(1)}%` : `${card.card_network}`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.93 }}
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
            className={`inline-flex items-center justify-center gap-1 text-[12px] px-2 py-1.5 rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
              compared
                ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium shadow-[0_3px_10px_rgba(15,92,77,0.18)]"
                : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#C9C9C2] text-[#4B525C]"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {compared ? (
                <motion.span
                  key="added"
                  initial={{ scale: 0.75, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.75, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 24 }}
                  className="inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Added
                </motion.span>
              ) : (
                <motion.span
                  key="compare"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Compare
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <button
            type="button"
            onClick={() => openCard(card)}
            title={`Quick tables & summary for ${card.card_name}`}
            className="inline-flex items-center justify-center gap-1 text-[12px] font-medium text-[#1A1D21] bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#E4E4DF] hover:border-[#C9C9C2] px-2 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Table2 className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" aria-hidden="true" />
            <span>Tables</span>
          </button>

          <Link
            href={`/${card.bank_slug}/${card.card_slug}`}
            className="inline-flex items-center justify-center gap-1 text-[12px] font-medium text-[#0F5C4D] hover:text-[#0B473B] px-2 py-1.5 rounded-lg bg-[#EEF5F2] hover:bg-[#E1EDE8] transition-colors whitespace-nowrap"
          >
            <span>More</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.article>
  );

  if (variant === "comet") {
    return (
      <CometCard rotateDepth={6} translateDepth={6} className="h-full">
        {cardNode}
      </CometCard>
    );
  }
  return cardNode;
}
