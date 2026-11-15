"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import type {
  CardSummaryItem,
  DevaluationEvent,
  DevaluationTrackerPayload,
} from "@/lib/types";
import { formatInr, matchesTokenizedQuery } from "@/lib/format";
import { fastTransition, modalSurfaceVariants } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { CardArtwork } from "./CardArtwork";
import { useCompare } from "./CompareContext";
import { SearchParamsSync } from "./SearchParamsSync";
import { AnimatedMeterBar } from "./MotionReveal";
import { CategoryMultiBarChart } from "./AnalyticsCharts";

interface DevaluationsClientProps {
  tracker: DevaluationTrackerPayload;
  cards: CardSummaryItem[];
}

export interface DevalSelectionState {
  event: DevaluationEvent;
  cardNameMention: string | null;
  matchedCard: CardSummaryItem | null;
}

function splitSummaryClauses(summary: string): string[] {
  return summary
    .split(/;\s+|\.\s+(?=[A-Z0-9])/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
}

export function matchCardForDevalMention(
  issuer: string,
  mention: string,
  allCards: CardSummaryItem[]
): CardSummaryItem | null {
  const issuerLower = issuer.toLowerCase();
  const mentionLower = mention.toLowerCase().trim();
  const bankPool = allCards.filter(
    (c) =>
      c.bank.toLowerCase().includes(issuerLower) ||
      issuerLower.includes(c.bank.toLowerCase().split(" ")[0])
  );
  const pool = bankPool.length > 0 ? bankPool : allCards;

  const cleanMention = mentionLower.replace(/\bcredit\s*card\b/g, "").trim();
  const exact = pool.find((c) => {
    const cn = c.card_name.toLowerCase();
    return cn === mentionLower || cn.includes(cleanMention);
  });
  if (exact) return exact;

  const tokens = cleanMention.split(/[\s/&+-]+/).filter((t) => t.length >= 2);
  let best: CardSummaryItem | null = null;
  let bestScore = 0;
  for (const c of pool) {
    const hay = `${c.card_name} ${c.card_slug}`.toLowerCase();
    const hits = tokens.filter((t) => hay.includes(t)).length;
    if (hits > bestScore) {
      bestScore = hits;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}

export function DevaluationsClient({ tracker, cards }: DevaluationsClientProps) {
  const { ownedIds, toggleItem, isSelected } = useCompare();

  const [query, setQuery] = useState("");
  const [issuerFilter, setIssuerFilter] = useState("all");

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    const iss = sp.get("issuer");
    const q = sp.get("q");
    if (iss) setIssuerFilter(iss);
    if (q !== null) setQuery(q);
  }, []);
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium">("all");
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<DevalSelectionState | null>(null);

  const profiles = useMemo(
    () =>
      Object.entries(tracker.issuer_devaluation_profiles || {}).sort(
        (a, b) => b[1].risk_score - a[1].risk_score
      ),
    [tracker]
  );

  const events = useMemo(() => tracker.timeline_2024_2026 || [], [tracker]);

  const ownedCards = useMemo(() => {
    const set = new Set(ownedIds);
    return cards.filter((c) => set.has(c.card_id));
  }, [cards, ownedIds]);

  const ownedBanksLower = useMemo(
    () => new Set(ownedCards.map((c) => c.bank.toLowerCase())),
    [ownedCards]
  );

  const filteredEvents = useMemo(() => {
    const q = query.trim();
    return events.filter((ev) => {
      if (issuerFilter !== "all" && ev.issuer.toLowerCase() !== issuerFilter.toLowerCase()) {
        return false;
      }
      if (severityFilter !== "all" && ev.severity.toLowerCase() !== severityFilter) {
        return false;
      }
      if (onlyMyCards) {
        const hitOwned = ownedCards.some((oc) => {
          const sameBank =
            oc.bank.toLowerCase().includes(ev.issuer.toLowerCase()) ||
            ev.issuer.toLowerCase().includes(oc.bank.toLowerCase().split(" ")[0]);
          if (!sameBank) return false;
          return ev.cards_affected.some((m) => {
            const matched = matchCardForDevalMention(ev.issuer, m, [oc]);
            return Boolean(matched);
          });
        });
        if (!hitOwned) return false;
      }
      if (!q) return true;
      const hay = `${ev.issuer} ${ev.date} ${ev.severity} ${ev.summary} ${ev.cards_affected.join(" ")} ${ev.source_ref}`;
      return matchesTokenizedQuery(hay, q);
    });
  }, [events, issuerFilter, severityFilter, onlyMyCards, ownedCards, query]);

  const openCardDevalSummary = (event: DevaluationEvent, cardNameMention: string | null) => {
    const matchedCard = cardNameMention
      ? matchCardForDevalMention(event.issuer, cardNameMention, cards)
      : event.cards_affected[0]
      ? matchCardForDevalMention(event.issuer, event.cards_affected[0], cards)
      : null;
    setSelectedSummary({ event, cardNameMention, matchedCard });
  };

  const shieldAlternates = useMemo(() => {
    if (!selectedSummary?.matchedCard) return [];
    const target = selectedSummary.matchedCard;
    return cards
      .filter(
        (c) =>
          c.card_id !== target.card_id &&
          c.primary_category === target.primary_category &&
          c.status === "active"
      )
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 3);
  }, [cards, selectedSummary]);

  const walletImpactCount = useMemo(() => {
    if (ownedCards.length === 0) return 0;
    return events.filter((ev) =>
      ownedCards.some(
        (oc) =>
          ev.cards_affected.some((m) => matchCardForDevalMention(ev.issuer, m, [oc]) !== null)
      )
    ).length;
  }, [events, ownedCards]);

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      <SearchParamsSync onParams={syncFromParams} />
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#9A5B13] bg-[#FEF6EA] px-2.5 py-1 rounded-md">
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            2024–2026 Policy &amp; Cap Watchlist
          </span>
          <h1 className="text-[26px] sm:text-[30px] font-medium text-[#1A1D21] tracking-[-0.02em] mt-2">
            Credit Card Devaluation Tracker
          </h1>
          <p className="text-[14.5px] text-[#4B525C] mt-1 max-w-2xl">
            Click any issuer card, event row, or affected card badge to inspect the full devaluation
            impact summary, cap changes, and lower-risk replacement cards.
          </p>
        </div>

        {/* Wallet Exposure Pill */}
        {ownedCards.length > 0 && (
          <button
            type="button"
            onClick={() => setOnlyMyCards((p) => !p)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[13px] transition-colors cursor-pointer shrink-0 ${
              onlyMyCards
                ? "bg-[#9A5B13] border-[#9A5B13] text-white font-medium"
                : "bg-[#FEF6EA] border-[#9A5B13]/30 text-[#9A5B13] hover:border-[#9A5B13]"
            }`}
          >
            <Wallet className="w-4 h-4" aria-hidden="true" />
            <span>
              {walletImpactCount > 0
                ? `${walletImpactCount} events touch your wallet cards`
                : `${ownedCards.length} wallet cards shielded`}
            </span>
          </button>
        )}
      </div>

      {/* Issuer Risk Scorecards (Clickable to filter timeline!) */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-[19px] font-medium text-[#1A1D21]">
            Issuer Devaluation Risk Profiles
          </h2>
          {issuerFilter !== "all" && (
            <button
              type="button"
              onClick={() => setIssuerFilter("all")}
              className="text-[12.5px] text-[#0F5C4D] hover:underline cursor-pointer"
            >
              Show all issuers
            </button>
          )}
        </div>
        <div className="mb-5">
          <CategoryMultiBarChart
            title="Issuer Devaluation Risk Score (0–10 Scale)"
            subtitle="Higher bars indicate more frequent cap reductions, spend-based lounge gating, or partner cuts."
            data={profiles.map(([issuer, profile]) => ({
              id: issuer,
              label: issuer.replace(/\s*Bank\b/i, ""),
              sublabel: profile.frequency,
              value: profile.risk_score,
              displayValue: `${profile.risk_score}/10`,
              color:
                profile.risk_score >= 7
                  ? "#991B1B"
                  : profile.risk_score >= 5
                  ? "#9A5B13"
                  : "#0F5C4D",
            }))}
            height={170}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(([issuer, profile]) => {
            const high = profile.risk_score >= 7;
            const med = profile.risk_score >= 5 && profile.risk_score < 7;
            const active = issuerFilter.toLowerCase() === issuer.toLowerCase();
            const ownsBank = ownedBanksLower.has(issuer.toLowerCase());
            return (
              <motion.div
                key={issuer}
                role="button"
                tabIndex={0}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                transition={fastTransition}
                onClick={() => setIssuerFilter(active ? "all" : issuer)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIssuerFilter(active ? "all" : issuer);
                  }
                }}
                className={`text-left bg-white rounded-xl p-5 flex flex-col justify-between gap-3 border transition-all cursor-pointer ${
                  active
                    ? "border-[#0F5C4D] ring-2 ring-[#0F5C4D]/15 bg-[#F8FCFA]"
                    : "border-[#E4E4DF] hover:border-[#C9C9C2]"
                }`}
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BankLogo bank={issuer} size="sm" />
                      <h3 className="text-[16px] font-medium text-[#1A1D21] truncate">{issuer}</h3>
                      {ownsBank && (
                        <span className="text-[10.5px] bg-[#EEF5F2] text-[#0F5C4D] px-1.5 py-0.5 rounded shrink-0">
                          Owned
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[12px] px-2.5 py-0.5 rounded-md tabular-nums shrink-0 ${
                        high
                          ? "bg-[#FDF2F2] text-[#991B1B]"
                          : med
                          ? "bg-[#FEF6EA] text-[#9A5B13]"
                          : "bg-[#EEF5F2] text-[#0F5C4D]"
                      }`}
                    >
                      {profile.risk_score} / 10
                    </span>
                  </div>
                  <p className="text-[12px] text-[#717882] mt-0.5">
                    Frequency: {profile.frequency} · Click to filter events
                  </p>
                  <p className="text-[13.5px] text-[#4B525C] mt-2.5 leading-relaxed">
                    {profile.note}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {(profile.mitc_pdf_url || profile.devaluation_pdf_url || profile.bank_page_url) && (
                    <div
                      className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#F3F2EE]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {profile.mitc_pdf_url && (
                        <a
                          href={profile.mitc_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#EEF5F2] text-[#0F5C4D] hover:bg-[#DDECE6] px-2 py-1 rounded-md transition-colors"
                        >
                          <FileText className="w-3 h-3" aria-hidden="true" />
                          <span>MITC PDF</span>
                        </a>
                      )}
                      {(profile.devaluation_pdf_url || profile.bank_page_url) && (
                        <a
                          href={profile.devaluation_pdf_url || profile.bank_page_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-[#FAF9F6] border border-[#E4E4DF] text-[#1A1D21] hover:border-[#0F5C4D] px-2 py-1 rounded-md transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-[#0F5C4D]" aria-hidden="true" />
                          <span>{profile.devaluation_pdf_url ? "Revision / T&C" : "Bank Page"}</span>
                        </a>
                      )}
                    </div>
                  )}

                  <AnimatedMeterBar
                    percent={Math.min(100, profile.risk_score * 10)}
                    barClassName={
                      high ? "bg-[#991B1B]" : med ? "bg-[#9A5B13]" : "bg-[#0F5C4D]"
                    }
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Search & Severity Filters + Interactive Timeline */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2 className="text-[19px] font-medium text-[#1A1D21]">
            Timeline of Devaluations ({filteredEvents.length} Events)
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[220px]">
              <Search
                className="w-3.5 h-3.5 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search card, lounge, exclusion..."
                className="pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-[#E4E4DF] bg-white focus:border-[#0F5C4D] focus:outline-none w-full"
              />
            </div>

            {(["all", "high", "medium"] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] border capitalize transition-colors cursor-pointer ${
                  severityFilter === sev
                    ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                    : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                }`}
              >
                {sev === "all" ? "All Severities" : `${sev} Risk`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {filteredEvents.map((ev, i) => {
            const sevHigh = ev.severity.toLowerCase() === "high";
            return (
              <motion.div
                key={`${ev.date}-${ev.issuer}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...fastTransition, delay: Math.min(i * 0.02, 0.14) }}
                onClick={() => openCardDevalSummary(ev, null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openCardDevalSummary(ev, null);
                  }
                }}
                className="group bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/55 rounded-xl p-5 transition-all hover:shadow-[0_6px_22px_rgba(26,29,33,0.06)] cursor-pointer"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[12.5px] bg-[#F3F2EE] text-[#1A1D21] px-2.5 py-0.5 rounded-md tabular-nums">
                      <Calendar className="w-3 h-3 text-[#717882]" aria-hidden="true" />
                      {ev.date}
                    </span>
                    <BankLogo bank={ev.issuer} size="xs" />
                    <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{ev.issuer}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[12px] px-2.5 py-0.5 rounded-md ${
                        sevHigh
                          ? "bg-[#FDF2F2] text-[#991B1B]"
                          : "bg-[#FEF6EA] text-[#9A5B13]"
                      }`}
                    >
                      Severity: {ev.severity}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F5C4D] group-hover:translate-x-0.5 transition-transform">
                      View Summary
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>

                <p className="text-[14px] text-[#4B525C] mt-2.5 leading-relaxed">{ev.summary}</p>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {ev.cards_affected.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCardDevalSummary(ev, c);
                      }}
                      className="inline-flex items-center gap-1 text-[11.5px] bg-[#FAF9F6] hover:bg-[#EEF5F2] border border-[#E4E4DF] hover:border-[#0F5C4D] text-[#1A1D21] hover:text-[#0F5C4D] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                    >
                      <span>{c}</span>
                      <ChevronRight className="w-3 h-3 opacity-70" aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#F3F2EE]">
                  {ev.source_ref ? (
                    <p className="text-[11.5px] text-[#717882]">Source: {ev.source_ref}</p>
                  ) : (
                    <span />
                  )}
                  <div
                    className="flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ev.pdf_url && (
                      <a
                        href={ev.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium bg-[#0F5C4D] text-white hover:bg-[#0B473B] px-2.5 py-1 rounded-md transition-colors"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>Official Bank Circular / T&amp;C</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    )}
                    {ev.mitc_pdf_url && (
                      <a
                        href={ev.mitc_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11.5px] font-medium bg-[#EEF5F2] text-[#0F5C4D] hover:bg-[#DDECE6] px-2.5 py-1 rounded-md transition-colors"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        <span>Bank MITC PDF</span>
                      </a>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-8 text-center space-y-2">
              <p className="text-[15px] font-medium text-[#1A1D21]">
                No devaluation events match your current filters
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setIssuerFilter("all");
                  setSeverityFilter("all");
                  setOnlyMyCards(false);
                }}
                className="text-[13px] font-medium text-[#0F5C4D] hover:underline cursor-pointer"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Interactive Card Devaluation Summary Modal */}
      <AnimatePresence>
        {selectedSummary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fastTransition}
            onClick={() => setSelectedSummary(null)}
            className="fixed inset-0 z-50 bg-[#1A1D21]/45 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              variants={modalSurfaceVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-[#FAF9F6] border border-[#C9C9C2] rounded-2xl shadow-[0_24px_60px_rgba(26,29,33,0.22)]"
            >
              {/* Modal Top Bar */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E4E4DF] px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4.5 h-4.5 text-[#9A5B13] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11.5px] text-[#717882]">
                      {selectedSummary.event.issuer} · Effective {selectedSummary.event.date}
                    </p>
                    <h3 className="text-[16px] font-medium text-[#1A1D21] truncate">
                      {selectedSummary.cardNameMention
                        ? `${selectedSummary.cardNameMention} — Devaluation Summary`
                        : `${selectedSummary.event.issuer} Devaluation Breakdown`}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSummary(null)}
                  aria-label="Close devaluation summary"
                  className="p-1.5 rounded-full bg-[#F3F2EE] hover:bg-[#E4E4DF] text-[#4B525C] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Matched Card Header Box */}
                {selectedSummary.matchedCard && (() => {
                  const mc = selectedSummary.matchedCard;
                  const compared = isSelected(mc.card_id);
                  return (
                    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <CardArtwork
                        localImagePath={mc.local_image_path}
                        cardName={mc.card_name}
                        bank={mc.bank}
                        network={mc.card_network}
                        cardTheme={mc.card_theme}
                        size="md"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <BankLogo bankSlug={mc.bank_slug} bank={mc.bank} size="xs" />
                          <span className="text-[12px] text-[#4B525C]">{mc.bank}</span>
                        </div>
                        <p className="text-[16px] font-medium text-[#1A1D21] truncate">
                          {mc.card_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#4B525C] tabular-nums">
                          <span>
                            Fee:{" "}
                            <strong className="text-[#1A1D21]">
                              {mc.annual_fee_inr === 0 ? "₹0 (LTF)" : formatInr(mc.annual_fee_inr)}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Rating: <strong className="text-[#0F5C4D]">{mc.overall_rating.toFixed(1)}/10</strong>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link
                            href={`/${mc.bank_slug}/${mc.card_slug}`}
                            onClick={() => setSelectedSummary(null)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[12.5px] font-medium transition-colors"
                          >
                            Open Full Dossier
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              toggleItem({
                                card_id: mc.card_id,
                                card_name: mc.card_name,
                                bank: mc.bank,
                                bank_slug: mc.bank_slug,
                                card_slug: mc.card_slug,
                                annual_fee_inr: mc.annual_fee_inr,
                                overall_rating: mc.overall_rating,
                              })
                            }
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[12.5px] cursor-pointer transition-colors ${
                              compared
                                ? "bg-[#EEF5F2] border-[#0F5C4D] text-[#0F5C4D] font-medium"
                                : "bg-white border-[#E4E4DF] text-[#1A1D21] hover:border-[#C9C9C2]"
                            }`}
                          >
                            {compared ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            {compared ? "In Compare" : "Compare"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Structured Clauses Summary */}
                <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[14.5px] font-medium text-[#1A1D21]">
                      What Changed &amp; Impact Summary
                    </h4>
                    <span
                      className={`text-[11.5px] px-2.5 py-0.5 rounded-full font-medium ${
                        selectedSummary.event.severity.toLowerCase() === "high"
                          ? "bg-[#FDF2F2] text-[#991B1B]"
                          : "bg-[#FEF6EA] text-[#9A5B13]"
                      }`}
                    >
                      {selectedSummary.event.severity} Severity
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {splitSummaryClauses(selectedSummary.event.summary).map((clause, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-[13.5px] text-[#1A1D21] leading-relaxed bg-[#FAF9F6] border border-[#F3F2EE] rounded-lg px-3 py-2"
                      >
                        <AlertTriangle
                          className="w-4 h-4 text-[#9A5B13] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>{clause}</span>
                      </li>
                    ))}
                  </ul>

                  {selectedSummary.event.cards_affected.length > 0 && (
                    <div className="pt-2 border-t border-[#F3F2EE]">
                      <p className="text-[12px] text-[#717882] mb-2">
                        All Affected Cards in This Revision (click any to inspect):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSummary.event.cards_affected.map((c) => {
                          const isCurrent = selectedSummary.cardNameMention === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => openCardDevalSummary(selectedSummary.event, c)}
                              className={`px-2.5 py-1 rounded-full text-[11.5px] border transition-colors cursor-pointer ${
                                isCurrent
                                  ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                                  : "bg-[#FAF9F6] border-[#E4E4DF] text-[#1A1D21] hover:border-[#0F5C4D]"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(selectedSummary.event.source_ref ||
                    selectedSummary.event.pdf_url ||
                    selectedSummary.event.mitc_pdf_url) && (
                    <div className="pt-2 border-t border-[#F3F2EE] space-y-2">
                      {selectedSummary.event.source_ref && (
                        <p className="text-[11.5px] text-[#717882]">
                          Source verified: {selectedSummary.event.source_ref}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedSummary.event.pdf_url && (
                          <a
                            href={selectedSummary.event.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-[#0F5C4D] hover:bg-[#0B473B] text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Official Bank Revision / T&amp;C PDF</span>
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          </a>
                        )}
                        {selectedSummary.event.mitc_pdf_url && (
                          <a
                            href={selectedSummary.event.mitc_pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-[#EEF5F2] hover:bg-[#DDECE6] text-[#0F5C4D] px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Official Bank MITC PDF</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lower-Risk Alternatives in Same Category */}
                {shieldAlternates.length > 0 && (
                  <div className="bg-white border border-[#CBE0D7] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-[14px] font-medium text-[#0F5C4D]">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Top Alternatives in {selectedSummary.matchedCard?.primary_category}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {shieldAlternates.map((alt) => (
                        <Link
                          key={alt.card_id}
                          href={`/${alt.bank_slug}/${alt.card_slug}`}
                          onClick={() => setSelectedSummary(null)}
                          className="rounded-xl border border-[#E4E4DF] hover:border-[#0F5C4D] bg-[#FAF9F6] p-3 space-y-1 transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <BankLogo bankSlug={alt.bank_slug} bank={alt.bank} size="xs" />
                            <span className="text-[11px] text-[#717882] truncate">{alt.bank}</span>
                          </div>
                          <p className="text-[13px] font-medium text-[#1A1D21] line-clamp-2">
                            {alt.card_name}
                          </p>
                          <p className="text-[11.5px] text-[#0F5C4D] tabular-nums">
                            {alt.annual_fee_inr === 0 ? "LTF ₹0" : formatInr(alt.annual_fee_inr)} ·{" "}
                            {alt.overall_rating.toFixed(1)}/10
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
