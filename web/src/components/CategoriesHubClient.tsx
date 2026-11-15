"use client";

import React, { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  IndianRupee,
  MessageCircle,
  Plus,
  RotateCcw,
  Star,
  Table2,
} from "lucide-react";
import type { CategoryStatsItem } from "@/lib/types";
import type { CategoryStudyTable } from "@/lib/categoryStudies";
import { downloadCategoryStudyAsPng } from "@/lib/categoryTablePng";
import { exportCategoryStudyPdf } from "@/lib/pdfExport";
import { buildWhatsAppShareHref } from "@/lib/security";
import { SPEND_CATEGORY_META, cardLocalImageUrl } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { LedgerCardItem } from "./LedgerCardItem";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";
import { calmTransition, fastTransition } from "@/lib/motion";
import { CanvaFeatureIcon, resolveCategoryCanvaIcon } from "./FeatureIcon";
import { BumpRankingChart, CategoryMultiBarChart } from "./AnalyticsCharts";
import { buildBumpCategoryRanking } from "@/lib/chartDataBuilders";
import { SearchParamsSync } from "./SearchParamsSync";
import { getCategoryProTips } from "@/lib/categoryTips";
import { Sparkles } from "lucide-react";

interface CategoriesHubClientProps {
  categories: CategoryStatsItem[];
  studyTables: Record<string, CategoryStudyTable>;
}

export function CategoriesHubClient({
  categories,
  studyTables,
}: CategoriesHubClientProps) {
  const router = useRouter();
  const { isSelected, toggleItem } = useCompare();
  const [catParam, setCatParam] = useState<string | null>(null);

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    setCatParam(sp.get("cat"));
  }, []);

  const resolvedInitial = useMemo(() => {
    if (!catParam) return null;
    const match = categories.find(
      (c) =>
        c.id.toLowerCase() === catParam.toLowerCase() ||
        c.datasetCategory.toLowerCase() === catParam.toLowerCase()
    );
    return match ? match.id : null;
  }, [categories, catParam]);

  const selectedId = resolvedInitial;

  const selectCategory = (catId: string | null) => {
    setCatParam(catId);
    if (catId) {
      router.replace(`/categories?cat=${encodeURIComponent(catId)}`, { scroll: false });
    } else {
      router.replace("/categories", { scroll: false });
    }
  };

  const activeCategory = useMemo(
    () => (selectedId ? categories.find((c) => c.id === selectedId) || null : null),
    [categories, selectedId]
  );

  const activeStudy = activeCategory ? studyTables[activeCategory.id] : null;
  const [pngStatus, setPngStatus] = useState<"idle" | "busy" | "done">("idle");

  const handleDownloadPng = async () => {
    if (!activeStudy || pngStatus === "busy") return;
    setPngStatus("busy");
    try {
      await downloadCategoryStudyAsPng(activeStudy);
      setPngStatus("done");
      setTimeout(() => setPngStatus("idle"), 2400);
    } catch {
      setPngStatus("idle");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-7">
      <SearchParamsSync onParams={syncFromParams} />
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-6">
        <div>
          <span className="inline-block text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            {categories.length} Spending &amp; Benefit Verticals
          </span>
          <h1 className="text-[28px] sm:text-[34px] font-medium text-[#1A1D21] tracking-[-0.02em] mt-2">
            Credit Card Categories Across India
          </h1>
          <p className="text-[14.5px] text-[#4B525C] max-w-2xl mt-1.5 leading-relaxed">
            Pick any vertical — Cashback, Online Shopping, Dining, Travel, Golf, Lounges, RuPay UPI,
            or Zero Forex — to view top-rated picks, side-by-side category study tables, or open the
            full filtered directory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!activeCategory && (
            <div className="hidden sm:block relative w-[104px] h-[64px] rounded-xl overflow-hidden border border-[#E4E4DF] bg-[#FAF9F6]">
              <Image
                src={resolveMediaUrl("/illustrations/ai-vault-3d.webp") || "/illustrations/ai-vault-3d.webp"}
                alt="3D credit card category vault"
                fill
                sizes="104px"
                className="object-cover"
              />
            </div>
          )}
          {activeCategory && (
            <button
              type="button"
              onClick={() => selectCategory(null)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#FAF9F6] border border-[#C9C9C2] hover:border-[#0F5C4D] text-[#1A1D21] text-[13px] font-medium rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              All {categories.length} Categories
            </button>
          )}
          <Link
            href="/advisor"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[13.5px] font-medium rounded-lg transition-colors"
          >
            Find Best Card For Me
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Category Grid -> Smooth Left-Rail Split Layout on Click */}
      <motion.div
        layout
        transition={calmTransition}
        className={activeCategory ? "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" : ""}
      >
        {/* Idle State: Equal-Height Category Boxes | Selected State: Left Vertical Rail */}
        <motion.section
          layout
          transition={calmTransition}
          aria-label="Category selector"
          className={
            activeCategory
              ? "lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible bg-white border border-[#E4E4DF] rounded-xl p-2.5 lg:sticky lg:top-20"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          }
        >
          {categories.map((cat) => {
            const isSelected = activeCategory?.id === cat.id;

            if (activeCategory) {
              return (
                <motion.button
                  layout
                  transition={fastTransition}
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(isSelected ? null : cat.id)}
                  aria-pressed={isSelected}
                  className={`shrink-0 lg:w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                      : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#0F5C4D]/60 hover:bg-[#EEF5F2] text-[#1A1D21] hover:text-[#0F5C4D]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(cat.id)} size={16} />
                    <span className="truncate">{cat.shortLabel}</span>
                  </span>
                  <span
                    className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded shrink-0 ${
                      isSelected ? "bg-white/20 text-white" : "bg-white text-[#717882]"
                    }`}
                  >
                    {cat.totalCards}
                  </span>
                </motion.button>
              );
            }

            return (
              <motion.button
                layout
                transition={fastTransition}
                key={cat.id}
                type="button"
                onClick={() => selectCategory(cat.id)}
                className="group h-full text-left p-4 sm:p-5 rounded-xl border border-[#E4E4DF] bg-white hover:border-[#0F5C4D]/60 hover:bg-[#FCFDFC] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-3 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg border bg-[#F3F6FF] border-[#D7E2FF] group-hover:bg-[#EEF5F2] group-hover:border-[#0F5C4D]/40 flex items-center justify-center transition-colors">
                      <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(cat.id)} size={21} />
                    </div>
                    <span className="text-[12px] text-[#717882] tabular-nums bg-[#F3F2EE] px-2 py-0.5 rounded-md">
                      {cat.totalCards} cards
                    </span>
                  </div>

                  <div>
                    <h2 className="text-[15.5px] font-medium text-[#1A1D21] group-hover:text-[#0F5C4D] transition-colors leading-snug min-h-[22px]">
                      {cat.label}
                    </h2>
                    <p className="text-[12.5px] text-[#4B525C] mt-1.5 line-clamp-2 min-h-[40px] leading-[20px]">
                      {cat.description}
                    </p>
                  </div>
                </div>

                <div className="w-full pt-2.5 border-t border-[#E4E4DF] flex items-center justify-between text-[12px] tabular-nums">
                  <span className="text-[#4B525C]">{cat.ltfCount} LTF options</span>
                  <span className="text-[#0F5C4D] font-medium inline-flex items-center gap-1">
                    {cat.peakReturnPct > 0 ? `Peak ${cat.peakReturnPct.toFixed(1)}%` : "Explore"}
                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </motion.section>

        {/* Selected Category Detail Split Panel */}
        <AnimatePresence mode="wait">
          {activeCategory && (
            <motion.section
              key={activeCategory.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={calmTransition}
              className="lg:col-span-9 space-y-6 min-w-0"
            >
              {/* Banner with Direct Link to Open /cards?cat=... */}
              <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(activeCategory.id)} size={22} />
                    <h2 className="text-[20px] font-medium text-[#1A1D21]">
                      {activeCategory.label} ({activeCategory.totalCards} Cards)
                    </h2>
                    {activeCategory.peakReturnPct > 0 && (
                      <span className="text-[12px] bg-[#EEF5F2] text-[#0F5C4D] px-2.5 py-0.5 rounded-md tabular-nums">
                        Focus rate: {SPEND_CATEGORY_META[activeCategory.keyReturnKey].shortLabel} (up to{" "}
                        {activeCategory.peakReturnPct.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-[#4B525C] leading-relaxed">
                    <span className="text-[#1A1D21] font-medium">Ideal for: </span>
                    {activeCategory.whoShouldPick}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    href={`/cards?cat=${encodeURIComponent(activeCategory.id)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[13px] font-medium rounded-lg transition-colors"
                  >
                    Open in All Cards ({activeCategory.totalCards})
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Equal-Height Top Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-medium text-[#1A1D21]">
                    Top-Rated Cards in {activeCategory.shortLabel}
                  </h3>
                  <Link
                    href={`/cards?cat=${encodeURIComponent(activeCategory.id)}`}
                    className="text-[13px] text-[#0F5C4D] hover:underline"
                  >
                    Filter all {activeCategory.totalCards} →
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {activeCategory.topCards.map((card) => {
                      const catPct =
                        card.effective_return_pct_by_category?.[activeCategory.keyReturnKey] ?? 0;
                      const golfHighlight =
                        activeCategory.id === "golf" && card.golf_summary?.complimentary_access
                          ? `Golf: ${card.golf_summary.complimentary_access}`
                          : undefined;
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
                            highlightNote={
                              golfHighlight ||
                              (catPct > 0
                                ? `${SPEND_CATEGORY_META[activeCategory.keyReturnKey].shortLabel} return: ${catPct.toFixed(1)}% · ${(card.filter_tags.best_for_tags || []).slice(0, 1).join("")}`
                                : undefined)
                            }
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              {/* Category Pro Playbook & Optimization Tips */}
              <div className="bg-[#EEF5F2] border border-[#0F5C4D]/25 rounded-xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#0F5C4D]" aria-hidden="true" />
                    <h3 className="text-[16px] font-medium text-[#0F5C4D]">
                      {activeCategory.shortLabel} Optimization Playbook &amp; Tricks
                    </h3>
                  </div>
                  <span className="text-[11.5px] font-medium text-[#0F5C4D] bg-white/80 border border-[#0F5C4D]/20 px-2.5 py-0.5 rounded-full">
                    Verified Strategies
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {getCategoryProTips(activeCategory.id).map((tip) => (
                    <div
                      key={tip.title}
                      className="bg-white/95 border border-[#0F5C4D]/15 rounded-lg p-4 space-y-1.5"
                    >
                      <div className="text-[13.5px] font-medium text-[#1A1D21]">{tip.title}</div>
                      <p className="text-[12.5px] text-[#4B525C] leading-relaxed">{tip.detail}</p>
                      {tip.cards && tip.cards.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {tip.cards.map((cname) => (
                            <span
                              key={cname}
                              className="text-[11px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded"
                            >
                              {cname}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Benchmark Poster + Interactive Analytics Graphs */}
              <div className="space-y-5">
                <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E4E4DF] flex flex-wrap items-center justify-between gap-2 bg-[#FAF9F6]/70">
                    <div>
                      <h3 className="text-[15.5px] font-medium text-[#1A1D21]">
                        Visual Benchmark Poster — {activeCategory.label}
                      </h3>
                      <p className="text-[12px] text-[#4B525C]">
                        Ready-to-save comparison infographic with card artwork, annual fees &amp; post-cap earn rates.
                      </p>
                    </div>
                    <a
                      href={resolveMediaUrl(`/category-posters/${activeCategory.id}.png`) || `/category-posters/${activeCategory.id}.png`}
                      download={`cardledger-${activeCategory.id}-poster-2026.png`}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-[#0F5C4D] hover:bg-[#0B473B] text-white transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      Save Infographic Poster
                    </a>
                  </div>
                  <div className="p-3 sm:p-4 bg-[#FAF9F6]">
                    <Image
                      src={resolveMediaUrl(`/category-posters/${activeCategory.id}.png`) || `/category-posters/${activeCategory.id}.png`}
                      alt={`${activeCategory.label} credit card comparison infographic`}
                      width={1200}
                      height={800}
                      className="w-full h-auto rounded-lg border border-[#E4E4DF]"
                    />
                  </div>
                </div>

                {activeCategory.topCards.length >= 2 && (
                  <>
                    <CategoryMultiBarChart
                      title={`${activeCategory.shortLabel} Return Rate & Market Comparison`}
                      subtitle={
                        activeCategory.peakReturnPct > 0
                          ? `Comparing ${SPEND_CATEGORY_META[activeCategory.keyReturnKey].shortLabel} % across top ${activeCategory.shortLabel} leaders`
                          : `Overall Cards rating (0–5★) across top ${activeCategory.shortLabel} picks`
                      }
                      data={activeCategory.topCards.map((c) => {
                        const pct = c.effective_return_pct_by_category?.[activeCategory.keyReturnKey] ?? 0;
                        const usePct = activeCategory.peakReturnPct > 0;
                        return {
                          id: c.card_id,
                          label: c.card_name.replace(/Credit Card/gi, "").trim(),
                          sublabel: c.bank,
                          value: usePct ? Math.max(0.2, pct) : c.overall_rating,
                          displayValue: usePct ? `${pct.toFixed(1)}%` : `${c.overall_rating.toFixed(1)}★`,
                          href: `/${c.bank_slug}/${c.card_slug}`,
                        };
                      })}
                      height={200}
                    />
                    {(() => {
                      const bump = buildBumpCategoryRanking(
                        activeCategory.topCards.slice(0, 5).map((c) => ({
                          id: c.card_id,
                          name: c.card_name,
                          rates: (c.effective_return_pct_by_category || {}) as Record<
                            string,
                            number | undefined
                          >,
                        }))
                      );
                      return (
                        <BumpRankingChart
                          title={`Top 5 ${activeCategory.shortLabel} Cards Across All Spend Categories (Bump Chart)`}
                          subtitle="See whether top cards in this category stay #1 elsewhere or specialize strictly in one bucket."
                          xLabels={bump.xLabels}
                          series={bump.series}
                          height={250}
                        />
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Curated Category Study & Comparison Table */}
              {activeStudy && (
                <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E4E4DF] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF9F6]/70">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-[#0F5C4D]" aria-hidden="true" />
                        <h3 className="text-[16px] font-medium text-[#1A1D21]">
                          {activeStudy.title}
                        </h3>
                      </div>
                      <p className="text-[12.5px] text-[#4B525C]">{activeStudy.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                      <span className="text-[11.5px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1.5 rounded-md">
                        {activeStudy.rows.length} live cards
                      </span>
                      <a
                        href={buildWhatsAppShareHref(
                          `${activeStudy.title} (${activeStudy.rows.length} verified Indian credit cards) on Cards by cogify`,
                          `https://card.cogify.me/categories?cat=${encodeURIComponent(activeCategory.id)}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#ECFDF5] border border-[#A7F3D0] hover:bg-[#D1FAE5] text-[#15803D] transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        onClick={() => exportCategoryStudyPdf(activeStudy)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/50 text-[#1A1D21] transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPng}
                        disabled={pngStatus === "busy"}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#0F5C4D] text-white hover:bg-[#0B473B] transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {pngStatus === "done" ? (
                          <>
                            <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            Saved PNG Image
                          </>
                        ) : pngStatus === "busy" ? (
                          <>
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            Rendering PNG…
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            Download Table PNG
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                      <thead className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[#717882] text-[12px]">
                        <tr>
                          <th className="py-3.5 px-5 font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                              Issuer &amp; Card
                            </span>
                          </th>
                          <th className="py-3.5 px-5 border-l border-[#EFEFE9] font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <IndianRupee className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                              Annual Fee
                            </span>
                          </th>
                          <th className="py-3.5 px-4 border-l border-[#EFEFE9] font-medium whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 text-[#9A5B13]" aria-hidden="true" />
                              Rating
                            </span>
                          </th>
                          {activeStudy.columns.map((col) => (
                            <th key={col} className="py-3.5 px-5 border-l border-[#EFEFE9] font-medium whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                          <th className="py-3.5 px-4 border-l border-[#EFEFE9] font-medium whitespace-nowrap">Compare</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F3F2EE]">
                        {activeStudy.rows.map((row) => {
                          const imgSrc = resolveMediaUrl(cardLocalImageUrl(row.localImagePath));
                          const compared = isSelected(row.cardId);
                          return (
                          <tr key={`${activeStudy.categoryId}-${row.cardId}`} className="hover:bg-[#FAF9F6]">
                            <td className="py-3.5 px-5 align-top min-w-[235px]">
                              <div className="flex items-start gap-3">
                                {imgSrc ? (
                                  <div className="relative w-12 h-8 rounded bg-[#F8F6F0] border border-[#E4E4DF] p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                                    <Image src={imgSrc} alt={row.cardName} fill sizes="48px" className="object-contain p-0.5" />
                                  </div>
                                ) : (
                                  <BankLogo bank={row.bank} size="xs" className="mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <span className="block text-[11.5px] text-[#717882]">{row.bank}</span>
                                  {row.href ? (
                                    <Link
                                      href={row.href}
                                      className="inline-flex items-center gap-1 font-medium text-[#0F5C4D] hover:underline"
                                    >
                                      <span>{row.cardName}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    </Link>
                                  ) : (
                                    <span className="font-medium text-[#1A1D21]">{row.cardName}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-5 border-l border-[#F3F2EE] align-top text-[#1A1D21] font-medium whitespace-nowrap tabular-nums">
                              {row.annualFee}
                            </td>
                            <td className="py-3.5 px-4 border-l border-[#F3F2EE] align-top whitespace-nowrap tabular-nums">
                              {typeof row.rating === "number" ? (
                                <span className="inline-flex items-center gap-1 text-[12px] bg-[#F3F2EE] text-[#1A1D21] px-2 py-0.5 rounded">
                                  <Star className="w-3 h-3 text-[#9A5B13]" aria-hidden="true" />
                                  {row.rating.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-[#717882]">—</span>
                              )}
                            </td>
                            {row.cells.map((cellVal, idx) => (
                              <td
                                key={`${row.cardId}-cell-${idx}`}
                                className="py-3.5 px-5 border-l border-[#F3F2EE] align-top text-[#4B525C] min-w-[180px] leading-relaxed"
                              >
                                {cellVal}
                              </td>
                            ))}
                            <td className="py-3.5 px-4 border-l border-[#F3F2EE] align-top whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  toggleItem({
                                    card_id: row.cardId,
                                    card_name: row.cardName,
                                    bank: row.bank,
                                    bank_slug: row.bankSlug,
                                    card_slug: row.cardSlug,
                                    annual_fee_inr: Number(row.annualFee.replace(/[^\d]/g, "")) || 0,
                                    overall_rating: row.rating,
                                  })
                                }
                                className={`inline-flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                                  compared
                                    ? "bg-[#EEF5F2] border-[#0F5C4D]/40 text-[#0F5C4D] font-medium"
                                    : "bg-white border-[#E4E4DF] hover:border-[#0F5C4D]/50 text-[#1A1D21]"
                                }`}
                              >
                                {compared ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                {compared ? "Added" : "Compare"}
                              </button>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
