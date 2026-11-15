"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  MessageCircle,
  Plane,
  Scale,
  Share2,
  ShieldAlert,
  Star,
  Tag,
  X,
} from "lucide-react";
import type { CardDossier } from "@/lib/types";
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  formatInr,
  formatLoungeQuota,
} from "@/lib/format";
import { exportComparisonPdf, shareUrlOrText } from "@/lib/pdfExport";
import { buildWhatsAppShareHref } from "@/lib/security";
import { calmTransition } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { CardArtwork } from "./CardArtwork";
import { useCompare } from "./CompareContext";
import {
  BumpRankingChart,
  CategoryMultiBarChart,
  GradientStackedAreaChart,
} from "./AnalyticsCharts";
import {
  buildBumpCategoryRanking,
  buildCardSpendStudyData,
} from "@/lib/chartDataBuilders";
import { CardBody, CardContainer, CardItem } from "./ui/3d-card";

interface CompareClientProps {
  initialCards: CardDossier[];
}

export function CompareClient({ initialCards }: CompareClientProps) {
  const { items, removeItem, clearAll } = useCompare();
  const [fetchedCards, setFetchedCards] = useState<CardDossier[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [fetchedForKey, setFetchedForKey] = useState<string>("");
  const [shareState, setShareState] = useState<"idle" | "done">("idle");

  const itemsKey = items.map((i) => i.card_id).join(",");

  useEffect(() => {
    if (initialCards.length > 0 || items.length === 0) return;
    let cancelled = false;
    fetch(`/api/card?ids=${encodeURIComponent(itemsKey)}`)
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled && Array.isArray(payload.cards)) {
          setFetchedCards(payload.cards);
          setFetchedForKey(itemsKey);
        }
      })
      .catch(() => {
        if (!cancelled) setFetchedForKey(itemsKey);
      });
    return () => {
      cancelled = true;
    };
  }, [initialCards.length, items.length, itemsKey]);

  const loading = initialCards.length === 0 && items.length > 0 && fetchedForKey !== itemsKey;
  const activeSource = initialCards.length > 0 ? initialCards : fetchedCards;
  const cards = activeSource.filter((c) => !removedIds.includes(c.identity.card_id));

  const handleRemove = (cardId: string) => {
    removeItem(cardId);
    setRemovedIds((prev) => [...prev, cardId]);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-[14px] text-[#4B525C]">
        Loading selected credit cards...
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={calmTransition}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4"
      >
        <div className="w-11 h-11 rounded-xl bg-[#EEF5F2] text-[#0F5C4D] flex items-center justify-center mx-auto">
          <Scale className="w-5 h-5" aria-hidden="true" />
        </div>
        <h1 className="text-[24px] font-medium text-[#1A1D21]">
          Side-by-Side Card Comparison
        </h1>
        <p className="text-[14.5px] text-[#4B525C]">
          Select up to 3 cards using the Compare button across Card Finder or any card page to compare fees, real category return rates, lounges, and policy risk.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/cards"
            className="text-[13.5px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-4 py-2 rounded-lg transition-colors"
          >
            Browse Card Finder
          </Link>
          <Link
            href="/compare?ids=hdfc_bank_hdfc_regalia_gold_credit_card,sbi_cashback_sbi_card,axis_bank_atlas_credit_card"
            className="text-[13.5px] text-[#0F5C4D] bg-[#EEF5F2] px-4 py-2 rounded-lg hover:bg-[#E1EDE8] transition-colors"
          >
            Load Sample Top 3
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={calmTransition}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-5">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-medium text-[#1A1D21] tracking-[-0.02em]">
            Side-by-Side Credit Card Comparison
          </h1>
          <p className="text-[14px] text-[#4B525C] mt-1">
            Comparing {cards.length} {cards.length === 1 ? "card" : "cards"} across fees, real reward return %, lounges, eligibility, and devaluation risk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearAll();
                setRemovedIds(cards.map((c) => c.identity.card_id));
              }}
              className="text-[13px] text-[#717882] hover:text-[#1A1D21] px-2.5 py-2 cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              const idsParam = cards.map((c) => c.identity.card_id).join(",");
              const url =
                typeof window !== "undefined"
                  ? `${window.location.origin}/compare?ids=${encodeURIComponent(idsParam)}`
                  : "";
              await shareUrlOrText({
                title: `Cards Comparison: ${cards.map((c) => c.identity.card_name).join(" vs ")}`,
                text: `Compare fees, category rewards, lounges, and Pros/Cons on Cards by cogify.`,
                url,
              });
              setShareState("done");
              setTimeout(() => setShareState("idle"), 2000);
            }}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1D21] bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/50 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {shareState === "done" ? <Check className="w-3.5 h-3.5 text-[#0F5C4D]" /> : <Share2 className="w-3.5 h-3.5 text-[#0F5C4D]" />}
            {shareState === "done" ? "Link Copied" : "Share Comparison"}
          </button>
          <a
            href={buildWhatsAppShareHref(
              `Side-by-side comparison on Cards by cogify: ${cards.map((c) => c.identity.card_name).join(" vs ")}`,
              `https://card.cogify.me/compare?ids=${encodeURIComponent(cards.map((c) => c.identity.card_id).join(","))}`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#15803D] bg-[#ECFDF5] border border-[#A7F3D0] hover:bg-[#D1FAE5] px-3.5 py-2 rounded-lg transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => exportComparisonPdf(cards)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            Export PDF (with Images)
          </button>
          <Link
            href="/cards"
            className="text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-3.5 py-2 rounded-lg hover:bg-[#E1EDE8] transition-colors"
          >
            + Add Card
          </Link>
        </div>
      </div>

      {/* Responsive Horizontal Comparison Table */}
      <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[740px]">
          <thead>
            <tr className="border-b border-[#E4E4DF] align-top">
              <th className="w-52 p-5 text-[12.5px] text-[#717882] font-medium bg-[#FAF9F6]">
                Card Attribute
              </th>
              {cards.map((c) => (
                <th key={c.identity.card_id} className="p-5 border-l border-[#E4E4DF] align-top">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/${c.identity.bank_slug}/${c.identity.card_slug}`}
                      className="flex flex-col gap-3 group"
                    >
                      <CardContainer tiltDivisor={16} containerClassName="justify-start">
                        <CardBody>
                          <CardItem translateZ={36}>
                            <CardArtwork
                              localImagePath={c.visual_assets.local_image_path}
                              cardName={c.identity.card_name}
                              bank={c.identity.bank}
                              network={c.identity.card_network}
                              cardTheme={c.visual_assets.card_theme}
                              size="md"
                            />
                          </CardItem>
                        </CardBody>
                      </CardContainer>
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#717882] font-normal">
                          <BankLogo bankSlug={c.identity.bank_slug} bank={c.identity.bank} size="xs" />
                          <span>{c.identity.bank}</span>
                        </span>
                        <span className="block text-[15px] font-medium text-[#1A1D21] group-hover:text-[#0F5C4D] leading-snug mt-0.5">
                          {c.identity.card_name}
                        </span>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(c.identity.card_id)}
                      aria-label={`Remove ${c.identity.card_name}`}
                      className="text-[#717882] hover:text-[#1A1D21] p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E4E4DF] text-[13px] tabular-nums">
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>Category &amp; Network</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                  {c.identity.primary_category} · {c.identity.card_network}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-[#9A5B13]" aria-hidden="true" />
                  <span>Market Rating</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                  ★ {c.ratings.overall_market_rating.toFixed(2)}/5
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>Joining / Annual Fee</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                  {formatInr(c.fees_and_charges_detailed.joining_fee_inr, true)} /{" "}
                  {c.fees_and_charges_detailed.annual_fee_inr === 0
                    ? "₹0 (LTF)"
                    : formatInr(c.fees_and_charges_detailed.annual_fee_inr)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>Fee Waiver Spend</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#4B525C]">
                  {c.fees_and_charges_detailed.fee_waiver_spend_inr
                    ? `${formatInr(c.fees_and_charges_detailed.fee_waiver_spend_inr)}/year`
                    : "None / LTF"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <Plane className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>Domestic Lounge</span>
                </span>
              </td>
              {cards.map((c) => {
                const quotaText = formatLoungeQuota(
                  c.lounge_access_detailed.domestic.visits_per_year,
                  c.lounge_access_detailed.domestic.visits_per_quarter
                );
                return (
                  <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                    {c.lounge_access_detailed.has_domestic_lounge
                      ? `${quotaText || "Included"} (${
                          c.lounge_access_detailed.no_spend_domestic_lounge ? "No-spend" : "Spend-linked"
                        })`
                      : "None"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>International Lounge</span>
                </span>
              </td>
              {cards.map((c) => {
                const intlQuota = formatLoungeQuota(
                  c.lounge_access_detailed.international.visits_per_year,
                  null
                );
                return (
                  <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                    {c.lounge_access_detailed.has_international_lounge
                      ? `${intlQuota || "Included"} (${c.lounge_access_detailed.international.program})`
                      : "None"}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <Gauge className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                  <span>Forex Markup</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#1A1D21]">
                  {c.fees_and_charges_detailed.forex_markup_pct}% + GST
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">
                <span className="inline-flex items-center gap-2">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#9A5B13]" aria-hidden="true" />
                  <span>Devaluation Risk</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF]">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[12px] ${
                      c.devaluation_analysis.devaluation_risk_score >= 7
                        ? "bg-[#FDF2F2] text-[#991B1B]"
                        : c.devaluation_analysis.devaluation_risk_score >= 5
                          ? "bg-[#FEF6EA] text-[#9A5B13]"
                          : "bg-[#EEF5F2] text-[#0F5C4D]"
                    }`}
                  >
                    {c.devaluation_analysis.devaluation_risk_score}/10 ({c.devaluation_analysis.devaluation_frequency})
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">Eligibility Floor</td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF] text-[#4B525C]">
                  {c.eligibility_detailed.min_monthly_income_salaried_inr
                    ? `${formatInr(c.eligibility_detailed.min_monthly_income_salaried_inr)}/mo · `
                    : ""}
                  CIBIL {c.eligibility_detailed.min_cibil_score}+
                </td>
              ))}
            </tr>

            {/* Effective Category Rates */}
            <tr className="bg-[#F3F2EE]">
              <td colSpan={cards.length + 1} className="px-5 py-2.5 text-[12px] font-medium text-[#1A1D21]">
                Effective Category Return Rates (% real INR value)
              </td>
            </tr>
            {SPEND_CATEGORY_KEYS.map((k) => {
              const vals = cards.map(
                (c) => c.reward_calculator_model.effective_return_pct_by_category?.[k] ?? 0
              );
              const maxVal = Math.max(...vals);
              return (
                <tr key={k}>
                  <td className="px-5 py-3.5 bg-[#FAF9F6] text-[#4B525C]">
                    {SPEND_CATEGORY_META[k].shortLabel}
                  </td>
                  {cards.map((c, idx) => {
                    const v = vals[idx];
                    const isBest = maxVal > 0 && v === maxVal;
                    return (
                      <td
                        key={c.identity.card_id}
                        className={`px-5 py-3.5 border-l border-[#E4E4DF] ${
                          isBest ? "text-[#0F5C4D] font-medium bg-[#EEF5F2]/40" : "text-[#4B525C]"
                        }`}
                      >
                        {v.toFixed(2)}%
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Distinct Pros & Cons Comparison Rows */}
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#0F5C4D] font-medium align-top">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                  <span>What Works (Pros)</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="p-4 border-l border-[#E4E4DF] align-top">
                  <div className="bg-[#EEF5F2]/75 border border-[#C5DFD6] rounded-lg p-3.5">
                    <ul className="space-y-2">
                      {(c.pros_and_cons.pros || []).slice(0, 4).map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[12.5px] text-[#1A1D21] leading-relaxed">
                          <Check className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </td>
              ))}
            </tr>

            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#9A5B13] font-medium align-top">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#9A5B13]" aria-hidden="true" />
                  <span>Watch-Outs (Cons)</span>
                </span>
              </td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="p-4 border-l border-[#E4E4DF] align-top">
                  <div className="bg-[#FEF6EA]/80 border border-[#EED8B5] rounded-lg p-3.5">
                    <ul className="space-y-2">
                      {(c.pros_and_cons.cons || []).slice(0, 4).map((con, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-[12.5px] text-[#4B525C] leading-relaxed">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#9A5B13] shrink-0 mt-0.5" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </td>
              ))}
            </tr>

            {/* Official Links */}
            <tr>
              <td className="px-5 py-4 bg-[#FAF9F6] text-[#4B525C] font-medium">Official Links</td>
              {cards.map((c) => (
                <td key={c.identity.card_id} className="px-5 py-4 border-l border-[#E4E4DF]">
                  <div className="flex flex-wrap gap-3 text-[12.5px]">
                    {c.official_and_reference_links.bank_url && (
                      <a
                        href={c.official_and_reference_links.bank_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1 text-[#0F5C4D] hover:underline"
                      >
                        Bank Site <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <Link
                      href={`/${c.identity.bank_slug}/${c.identity.card_slug}`}
                      className="text-[#4B525C] hover:text-[#1A1D21] underline"
                    >
                      Full Dossier
                    </Link>
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Visual Bar Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryMultiBarChart
          title="Overall Market Score (out of 5.0★)"
          subtitle="Composite rating across net return, lounge access, waivers & community sentiment."
          data={cards.map((c) => ({
            id: c.identity.card_id,
            label: c.identity.card_name.replace(/Credit Card/gi, "").trim(),
            sublabel: c.identity.bank,
            value: c.ratings.overall_market_rating,
            displayValue: `${c.ratings.overall_market_rating.toFixed(2)}★`,
            href: `/${c.identity.bank_slug}/${c.identity.card_slug}`,
          }))}
          height={155}
        />
        <CategoryMultiBarChart
          title="Peak Category Return Rate (%)"
          subtitle="Best single-category accelerated earn rate among the 12 Indian spend categories."
          data={cards.map((c) => {
            const vals = Object.values(c.reward_calculator_model?.effective_return_pct_by_category || {}).filter(
              (v) => typeof v === "number"
            );
            const peak = vals.length > 0 ? Math.max(...vals) : 0;
            return {
              id: c.identity.card_id,
              label: c.identity.card_name.replace(/Credit Card/gi, "").trim(),
              sublabel: c.identity.bank,
              value: Math.max(0.2, peak),
              displayValue: `${peak.toFixed(1)}%`,
              href: `/${c.identity.bank_slug}/${c.identity.card_slug}`,
            };
          })}
          height={155}
        />
      </div>

      {/* Deep Study Charts: Bump Ranking + 12-Month Value Stack */}
      {cards.length >= 2 && (() => {
        const bump = buildBumpCategoryRanking(
          cards.map((c) => ({
            id: c.identity.card_id,
            name: c.identity.card_name,
            rates: (c.reward_calculator_model?.effective_return_pct_by_category || {}) as Record<
              string,
              number | undefined
            >,
          }))
        );
        const studyX = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
        const stackedCompareSeries = cards.map((c) => {
          const study = buildCardSpendStudyData(c);
          // Use the ₹50k/mo point as balanced baseline annual reward
          const pt50k = study.curvePoints.find((p) => p.monthlySpendInr === 50000) || study.curvePoints[0];
          const monthlyNet = Math.max(0, Math.round(pt50k.netAnnualBenefitInr / 12));
          return {
            id: c.identity.card_id,
            name: c.identity.card_name.replace(/Credit Card/gi, "").trim(),
            values: studyX.map((_, mIdx) => monthlyNet * (mIdx + 1)),
          };
        });
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BumpRankingChart
              title="Category Strength Bump Chart (#1 Best → Backup)"
              subtitle="Ranks compared cards head-to-head across core Indian spend categories so overlaps are obvious."
              xLabels={bump.xLabels}
              series={bump.series}
              height={260}
            />
            <GradientStackedAreaChart
              title="Combined Wallet 12-Month Net Yield Stack (₹50k/mo Spend)"
              subtitle="Cumulative annual reward stacked across your compared cards."
              xLabels={studyX}
              series={stackedCompareSeries}
              valueUnit="₹"
              height={260}
            />
          </div>
        );
      })()}
    </motion.div>
  );
}
