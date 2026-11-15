"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Scale, Wallet, X } from "lucide-react";
import type { CardSummaryItem } from "@/lib/types";
import {
  formatFeeDisplay,
  formatInr,
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
} from "@/lib/format";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { CardArtwork } from "@/components/CardArtwork";
import { BankLogo } from "@/components/BankLogo";
import { useCompare } from "@/components/CompareContext";

interface ExpandableCardContextValue {
  activeCard: CardSummaryItem | null;
  layoutPrefix: string;
  openCard: (card: CardSummaryItem, layoutKey?: string) => void;
  closeCard: () => void;
}

const ExpandableCardContext = createContext<ExpandableCardContextValue | null>(null);

export function ExpandableCardProvider({ children }: { children: ReactNode }) {
  const [activeCard, setActiveCard] = useState<CardSummaryItem | null>(null);
  const [layoutPrefix, setLayoutPrefix] = useState<string>("card");

  const openCard = useCallback((card: CardSummaryItem, layoutKey?: string) => {
    setLayoutPrefix(layoutKey || card.card_id);
    setActiveCard(card);
  }, []);

  const closeCard = useCallback(() => {
    setActiveCard(null);
  }, []);

  return (
    <ExpandableCardContext.Provider
      value={{ activeCard, layoutPrefix, openCard, closeCard }}
    >
      {children}
      <ExpandableCardOverlay />
    </ExpandableCardContext.Provider>
  );
}

const FALLBACK_EXPANDABLE: ExpandableCardContextValue = {
  activeCard: null,
  layoutPrefix: "card",
  openCard: () => {},
  closeCard: () => {},
};

export function useExpandableCard(): ExpandableCardContextValue {
  return useContext(ExpandableCardContext) ?? FALLBACK_EXPANDABLE;
}

/**
 * Aceternity ExpandableCard Standard Overlay:
 * Renders concise structured summary tables (Fees, Top Category Yields/Caps, Lounge Access Gate)
 * plus a "More Details →" link to the full dossier page.
 */
function ExpandableCardOverlay() {
  const ctx = useContext(ExpandableCardContext);
  const overlayRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const {
    items,
    isSelected,
    toggleItem,
    isOwned,
    toggleOwned,
  } = useCompare();

  const card = ctx?.activeCard ?? null;
  const closeCard = ctx?.closeCard ?? FALLBACK_EXPANDABLE.closeCard;
  const isMaxReached = card ? !isSelected(card.card_id) && items.length >= 3 : false;
  const inWallet = card ? isOwned(card.card_id) : false;

  useEffect(() => {
    if (!card) {
      document.body.style.overflow = "";
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCard();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [card, closeCard]);

  useOutsideClick(overlayRef, closeCard);

  if (!ctx) return null;

  const feeInfo = card
    ? formatFeeDisplay(card.joining_fee_inr, card.annual_fee_inr)
    : null;
  const topYields = card
    ? SPEND_CATEGORY_KEYS.map((key) => ({
        key,
        label: SPEND_CATEGORY_META[key].shortLabel,
        pct: card.effective_return_pct_by_category?.[key] ?? 0,
        cap: card.monthly_category_caps_inr?.[key],
      }))
        .filter((r) => r.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5)
    : [];

  return (
    <>
      <AnimatePresence>
        {card && (
          <motion.div
            key="expandable-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#1A1D21]/45 backdrop-blur-xs"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {card && feeInfo ? (
          <div
            key={`expandable-shell-${card.card_id}`}
            className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-5 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`expandable-title-${reactId}`}
          >
            <motion.div
              ref={overlayRef}
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 280, damping: 25 }}
              className="relative flex w-full max-w-[600px] max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[#E4E4DF] bg-white shadow-2xl"
            >
              {/* Top hero band */}
              <div
                className="relative flex flex-col sm:flex-row items-center gap-4 border-b border-[#E4E4DF] p-4 sm:p-5"
                style={{
                  backgroundColor: card.card_theme?.soft_bg_hex || "#FAF9F6",
                }}
              >
                <button
                  type="button"
                  onClick={closeCard}
                  aria-label="Close card preview"
                  className="absolute right-3.5 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E4E4DF] bg-white text-[#4B525C] hover:text-[#1A1D21] shadow-xs cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>

                <CardArtwork
                  localImagePath={card.local_image_path}
                  cardName={card.card_name}
                  bank={card.bank}
                  network={card.card_network}
                  cardTheme={card.card_theme}
                  showSplash={false}
                  size="md"
                />

                <div className="min-w-0 flex-1 text-center sm:text-left pr-6">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
                    <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#4B525C]">
                      {card.bank} · {card.card_tier}
                    </span>
                    <span className="rounded bg-white/90 border border-[#E4E4DF] px-1.5 py-0.5 text-[10.5px] font-medium text-[#0F5C4D] tabular-nums">
                      ★ {card.overall_rating?.toFixed(2) || "N/A"}
                    </span>
                  </div>
                  <h3
                    id={`expandable-title-${reactId}`}
                    className="text-[17px] sm:text-[18px] font-medium leading-snug text-[#1A1D21]"
                  >
                    {card.card_name}
                  </h3>
                  {card.best_for_short && (
                    <p className="mt-1 text-[12px] text-[#4B525C] line-clamp-2">
                      {card.best_for_short}
                    </p>
                  )}
                </div>
              </div>

              {/* Scrollable tabular breakdown */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Table 1: Core Fees, Waiver & Forex */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#717882] mb-1.5">
                    Fee & Eligibility Summary
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-[#E4E4DF]">
                    <table className="w-full text-left text-[12px]">
                      <tbody className="divide-y divide-[#E4E4DF]">
                        <tr className="bg-[#FAF9F6]/60">
                          <td className="px-3 py-2 text-[#4B525C]">{feeInfo.label}</td>
                          <td className="px-3 py-2 font-medium text-[#1A1D21] text-right tabular-nums">
                            {feeInfo.primaryText}
                          </td>
                        </tr>
                        {card.fee_waiver_spend_inr ? (
                          <tr>
                            <td className="px-3 py-2 text-[#4B525C]">Annual Fee Waiver</td>
                            <td className="px-3 py-2 font-medium text-[#1A1D21] text-right tabular-nums">
                              {formatInr(card.fee_waiver_spend_inr)} / year
                            </td>
                          </tr>
                        ) : null}
                        <tr className="bg-[#FAF9F6]/60">
                          <td className="px-3 py-2 text-[#4B525C]">Forex Markup</td>
                          <td className="px-3 py-2 font-medium text-[#1A1D21] text-right tabular-nums">
                            {card.forex_markup_pct !== undefined
                              ? `${card.forex_markup_pct}% + GST`
                              : "Standard 3.5%"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 text-[#4B525C]">Min. CIBIL / Network</td>
                          <td className="px-3 py-2 font-medium text-[#1A1D21] text-right">
                            {card.filter_tags?.min_cibil_score || 730}+ · {card.card_network}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table 2: Reward Rates & Monthly Caps */}
                {topYields.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#717882] mb-1.5">
                      Top Category Reward Yields
                    </h4>
                    <div className="overflow-hidden rounded-xl border border-[#E4E4DF]">
                      <table className="w-full text-left text-[12px]">
                        <thead className="bg-[#FAF9F6] text-[10.5px] uppercase tracking-wider text-[#717882] border-b border-[#E4E4DF]">
                          <tr>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2 text-right">Eff. Return</th>
                            <th className="px-3 py-2 text-right">Monthly Cap</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E4DF]">
                          {topYields.map((row) => (
                            <tr key={row.key}>
                              <td className="px-3 py-1.5 text-[#1A1D21]">{row.label}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-[#0F5C4D] tabular-nums">
                                {row.pct.toFixed(1)}%
                              </td>
                              <td className="px-3 py-1.5 text-right text-[#4B525C] tabular-nums">
                                {row.cap && row.cap > 0 ? formatInr(row.cap) : "Standard"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Table 3: Airport Lounge & Spend Criteria */}
                <div>
                  <h4 className="text-[11px] font-medium uppercase tracking-wider text-[#717882] mb-1.5">
                    Airport Lounge Access & Spend Gate
                  </h4>
                  <div className="overflow-hidden rounded-xl border border-[#E4E4DF]">
                    <table className="w-full text-left text-[12px]">
                      <tbody className="divide-y divide-[#E4E4DF]">
                        <tr>
                          <td className="px-3 py-2 text-[#4B525C]">Domestic Lounges</td>
                          <td className="px-3 py-2 text-right font-medium text-[#1A1D21]">
                            {card.filter_tags?.has_domestic_lounge
                              ? card.domestic_lounge_accessible_count
                                ? `${card.domestic_lounge_accessible_count} lounges mapped`
                                : "Complimentary Included"
                              : "Not included"}
                          </td>
                        </tr>
                        <tr className="bg-[#FAF9F6]/60">
                          <td className="px-3 py-2 text-[#4B525C]">Spend Criteria</td>
                          <td className="px-3 py-2 text-right">
                            {!card.filter_tags?.has_domestic_lounge ? (
                              <span className="text-[#717882]">Not Applicable</span>
                            ) : card.filter_tags?.no_spend_domestic_lounge ? (
                              <span className="inline-flex rounded bg-[#EEF5F2] px-2 py-0.5 text-[11px] font-medium text-[#0F5C4D]">
                                No Spend Criteria
                              </span>
                            ) : (
                              <span className="text-[#9A5B13] font-medium">
                                {card.lounge_spend_condition || "Spend-gated"}
                              </span>
                            )}
                          </td>
                        </tr>
                        {card.domestic_lounge_summary && (
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-[11.5px] text-[#4B525C]">
                              {card.domestic_lounge_summary}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer Actions + "More" CTA */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4E4DF] bg-[#FAF9F6] px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleOwned(card.card_id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors ${
                      inWallet
                        ? "border-[#0F5C4D] bg-[#EEF5F2] text-[#0F5C4D]"
                        : "border-[#E4E4DF] bg-white text-[#1A1D21] hover:border-[#C9C9C2]"
                    }`}
                  >
                    {inWallet ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> In My Wallet
                      </>
                    ) : (
                      <>
                        <Wallet className="h-3.5 w-3.5" /> + My Wallet
                      </>
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
                    disabled={!isSelected(card.card_id) && isMaxReached}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors disabled:opacity-45 ${
                      isSelected(card.card_id)
                        ? "border-[#0F5C4D] bg-[#EEF5F2] text-[#0F5C4D]"
                        : "border-[#E4E4DF] bg-white text-[#1A1D21] hover:border-[#C9C9C2]"
                    }`}
                  >
                    <Scale className="h-3.5 w-3.5" />
                    {isSelected(card.card_id) ? "Selected" : "Compare"}
                  </button>
                </div>

                <Link
                  href={`/${card.bank_slug}/${card.card_slug}`}
                  onClick={closeCard}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F5C4D] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#0B473B] transition-colors"
                >
                  More Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
