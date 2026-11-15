"use client";

import React, { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Phone,
  Plane,
  QrCode,
  Search,
  Star,
  Train,
  X,
  XCircle,
} from "lucide-react";
import type {
  CardSummaryItem,
  GolfClubSpot,
  LoungeAccessMasterPayload,
  LoungeCatalogPayload,
} from "@/lib/types";
import { formatLoungeSourceType } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { SearchParamsSync } from "./SearchParamsSync";
import {
  evaluateAirportForOwnedCards,
  getAirportDirectory,
  getShortQuotaLabel,
  getShortSpendLabel,
} from "@/lib/loungeChecker";
import { GOLF_PROGRAM_GUIDES } from "@/lib/golfGuide";
import { fastTransition, LEDGER_EASE, springGentle } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";
import { LedgerCardItem } from "./LedgerCardItem";

interface LoungesClientProps {
  catalog: LoungeCatalogPayload;
  loungeMaster: LoungeAccessMasterPayload;
  golfClubs?: GolfClubSpot[];
  allCards: CardSummaryItem[];
  noSpendLoungeCards: CardSummaryItem[];
}

type ViewMode = "my_cards" | "matrix" | "golf" | "programs" | "spots" | "cards";

const POPULAR_AIRPORT_CODES = new Set(["DEL", "BOM", "BLR", "HYD", "MAA", "CCU", "AMD", "GOI", "GOX", "COK", "PNQ", "ATQ"]);

export function LoungesClient({
  catalog,
  loungeMaster,
  golfClubs = [],
  allCards,
  noSpendLoungeCards,
}: LoungesClientProps) {
  const { ownedIds } = useCompare();

  const airportDirectory = useMemo(
    () => getAirportDirectory(loungeMaster),
    [loungeMaster]
  );

  const [viewMode, setViewMode] = useState<ViewMode>("my_cards");
  const [selectedAirport, setSelectedAirport] = useState<string>("DEL");
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  const syncFromParams = useCallback(
    (sp: URLSearchParams) => {
      const apParam = sp.get("airport")?.trim().toUpperCase() || "";
      const vParam = sp.get("view")?.trim() || "";
      const cardParam = sp.get("card")?.trim() || "";
      if (cardParam) {
        setFocusedCardId(cardParam);
      } else {
        setFocusedCardId(null);
      }
      const hasAp = airportDirectory.some((a) => a.airportCode === apParam);
      if (hasAp) {
        setSelectedAirport(apParam);
        setViewMode("my_cards");
      } else if (
        vParam === "programs" ||
        vParam === "spots" ||
        vParam === "cards" ||
        vParam === "my_cards" ||
        vParam === "matrix" ||
        vParam === "golf"
      ) {
        setViewMode(vParam);
      }
    },
    [airportDirectory]
  );
  const [terminalFilter, setTerminalFilter] = useState<"all" | "domestic" | "international">("all");
  const [airportQuery, setAirportQuery] = useState("");
  const [airportFilterMode, setAirportFilterMode] = useState<"popular" | "all" | "intl">("popular");
  const [query, setQuery] = useState("");
  const [golfCourseQuery, setGolfCourseQuery] = useState("");
  const [bankFilter, setBankFilter] = useState("all");

  const cardById = useMemo(() => {
    const m = new Map<string, CardSummaryItem>();
    for (const c of allCards) {
      m.set(c.card_id, c);
    }
    return m;
  }, [allCards]);

  const ownedCards = useMemo(
    () =>
      ownedIds
        .map((id) => cardById.get(id))
        .filter((c): c is CardSummaryItem => Boolean(c)),
    [ownedIds, cardById]
  );

  const focusedCard = useMemo(
    () => (focusedCardId ? cardById.get(focusedCardId) ?? null : null),
    [focusedCardId, cardById]
  );

  const activeEvalCards = useMemo(
    () => (focusedCard ? [focusedCard] : ownedCards),
    [focusedCard, ownedCards]
  );

  const airportReport = useMemo(
    () => evaluateAirportForOwnedCards(selectedAirport, loungeMaster, activeEvalCards),
    [selectedAirport, loungeMaster, activeEvalCards]
  );

  const cardToLoungeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (loungeMaster.participating_indian_airport_lounges || []).filter((spot) => {
      if (focusedCard) {
        const codeSet = new Set((focusedCard.accessible_lounge_codes || []).map((c) => c.toUpperCase()));
        if (spot.lounge_code && !codeSet.has(spot.lounge_code.toUpperCase())) return false;
      }
      if (!q) return true;
      const hitCard = [...(spot.eligible_no_spend_card_ids || []), ...(spot.eligible_low_spend_card_ids || [])]
        .slice(0, 20)
        .some((cid) => {
          const card = cardById.get(cid);
          return card ? card.card_name.toLowerCase().includes(q) || card.bank.toLowerCase().includes(q) : false;
        });
      return (
        spot.city.toLowerCase().includes(q) ||
        spot.lounge_name.toLowerCase().includes(q) ||
        spot.airport_code.toLowerCase().includes(q) ||
        spot.terminal.toLowerCase().includes(q) ||
        hitCard
      );
    });
  }, [loungeMaster, query, focusedCard, cardById]);

  const filteredAirports = useMemo(() => {
    const q = airportQuery.trim().toLowerCase();
    return airportDirectory.filter((a) => {
      if (!q) {
        if (airportFilterMode === "popular") return POPULAR_AIRPORT_CODES.has(a.airportCode);
        if (airportFilterMode === "intl") return a.internationalCount > 0;
        return true;
      }
      return (
        a.city.toLowerCase().includes(q) ||
        a.airportCode.toLowerCase().includes(q) ||
        a.loungeNames.some((n) => n.toLowerCase().includes(q))
      );
    });
  }, [airportDirectory, airportQuery, airportFilterMode]);

  const filteredGolfClubs = useMemo(() => {
    const q = golfCourseQuery.trim().toLowerCase();
    return golfClubs.filter((c) => {
      if (focusedCard && focusedCard.accessible_golf_slugs?.length) {
        if (!focusedCard.accessible_golf_slugs.includes(c.slug)) return false;
      }
      return (
        !q ||
        c.city.toLowerCase().includes(q) ||
        c.club_name.toLowerCase().includes(q) ||
        (c.formatted_address || "").toLowerCase().includes(q)
      );
    });
  }, [golfClubs, golfCourseQuery, focusedCard]);

  const programs = useMemo(
    () =>
      Object.values(catalog.programs || {}).sort((a, b) =>
        a.bank.localeCompare(b.bank)
      ),
    [catalog.programs]
  );

  const banks = useMemo(
    () => Array.from(new Set(programs.map((p) => p.bank))).sort(),
    [programs]
  );

  const filteredPrograms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      if (bankFilter !== "all" && p.bank !== bankFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.bank.toLowerCase().includes(q) ||
        p.parsed_lounges.some(
          (spot) =>
            spot.city.toLowerCase().includes(q) ||
            spot.lounge_name.toLowerCase().includes(q)
        )
      );
    });
  }, [programs, query, bankFilter]);

  const allSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Array<{
      city: string;
      lounge_name: string;
      terminal: string;
      terminal_type: string;
      bank: string;
      program_title: string;
      official_url: string;
    }> = [];
    for (const p of programs) {
      if (bankFilter !== "all" && p.bank !== bankFilter) continue;
      for (const spot of p.parsed_lounges || []) {
        if (
          q &&
          !spot.city.toLowerCase().includes(q) &&
          !spot.lounge_name.toLowerCase().includes(q) &&
          !p.bank.toLowerCase().includes(q) &&
          !p.title.toLowerCase().includes(q)
        ) {
          continue;
        }
        out.push({
          ...spot,
          bank: p.bank,
          program_title: p.title,
          official_url: p.official_url,
        });
      }
    }
    return out.slice(0, 250);
  }, [programs, query, bankFilter]);

  const rules = catalog.network_rules;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <SearchParamsSync onParams={syncFromParams} />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            <Plane className="w-3.5 h-3.5" aria-hidden="true" />
            {airportDirectory.length} Indian Airports &amp; Official Lounge Lists
          </span>
          <h1 className="text-[26px] sm:text-[30px] font-semibold text-[#1A1D21] tracking-[-0.02em] mt-2">
            Indian Airport Lounge &amp; Golf Concierge
          </h1>
          <p className="text-[14.5px] text-[#4B525C] mt-1 max-w-2xl">
            Check exact terminal lounge eligibility, complimentary golf rounds &amp; coaching lessons across Delhi (DEL), Mumbai (BOM), Bengaluru
            (BLR), and {airportDirectory.length} Indian airports, or browse {catalog.total_programs} official bank PDFs.
          </p>
        </div>

        <Link
          href="/cards?noSpendLounge=1"
          className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0"
        >
          View all {noSpendLoungeCards.length} No-Spend Lounge cards →
        </Link>
      </div>

      {/* Editorial VIP Lounge Visual Strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fastTransition}
        className="relative overflow-hidden rounded-2xl border border-[#E4E4DF] bg-white grid grid-cols-1 md:grid-cols-12 items-stretch"
      >
        <div className="md:col-span-5 relative min-h-[168px] sm:min-h-[196px] overflow-hidden bg-[#F3F2EE]">
          <Image
            src={resolveMediaUrl("/illustrations/airport-lounge-hero.webp") || "/illustrations/airport-lounge-hero.webp"}
            alt="Sunlit Indian airport VIP lounge overlooking runway"
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
            className="object-cover transition-transform duration-700 hover:scale-[1.03]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1D21]/45 via-transparent to-transparent"
          />
          <span className="absolute bottom-3 left-3 text-[11.5px] font-medium text-white bg-[#1A1D21]/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Live Terminal Rules · Updated 2026
          </span>
        </div>
        <div className="md:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div>
            <span className="text-[11.5px] uppercase tracking-wider text-[#0F5C4D] font-medium">
              Airport Access Intelligence
            </span>
            <h2 className="text-[17px] sm:text-[18px] font-medium text-[#1A1D21] mt-1">
              Check if your cards unlock Delhi (DEL), Mumbai (BOM) &amp; Bengaluru (BLR) lounges today
            </h2>
            <p className="text-[13px] text-[#4B525C] mt-1 leading-relaxed">
              Includes spend-gated domestic visits (e.g. ₹50k–₹75k prior quarter spend), Dreamfolks / RuPay / Visa / Mastercard portals, and Priority Pass domestic fee traps.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px]">
            <span className="px-2.5 py-1 rounded-full bg-[#EEF5F2] text-[#0F5C4D] font-medium">
              {airportDirectory.length} Airports Mapped
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#F3F2EE] text-[#4B525C]">
              {catalog.total_programs} Official Bank Lists
            </span>
            <span className="px-2.5 py-1 rounded-full bg-[#FEF6EA] text-[#9A5B13]">
              Spend-Gate Warnings Included
            </span>
          </div>
        </div>
      </motion.div>

      {/* Priority Pass Warning & Validation Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#FEF6EA] border border-[#9A5B13]/25 rounded-xl p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#9A5B13] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-[14.5px] font-medium text-[#9A5B13]">
                Priority Pass Domestic Warning
              </h2>
              <p className="text-[13px] text-[#1A1D21] mt-1 leading-relaxed">
                {rules.priority_pass_domestic_warning}
              </p>
              {rules.priority_pass_guest_fee && (
                <p className="text-[12px] text-[#9A5B13] mt-1.5 tabular-nums">
                  Guest charge: {rules.priority_pass_guest_fee}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 text-[13px] space-y-2">
          <h2 className="text-[14.5px] font-medium text-[#1A1D21]">
            Card Network Validation Holds &amp; Railway Terms
          </h2>
          <p className="text-[#4B525C]">
            <span className="text-[#1A1D21] font-medium">Visa:</span> {rules.visa_validation_charge}
          </p>
          <p className="text-[#4B525C]">
            <span className="text-[#1A1D21] font-medium">Mastercard:</span> {rules.mastercard_validation_charge}
          </p>
          <p className="text-[#4B525C]">
            <span className="text-[#1A1D21] font-medium">RuPay:</span> {rules.rupay_validation_charge}
          </p>
          {rules.irctc_railway_lounge_terms && (
            <p className="text-[#4B525C] pt-1 border-t border-[#E4E4DF] flex items-start gap-1.5">
              <Train className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                <span className="text-[#1A1D21] font-medium">IRCTC Railway:</span>{" "}
                {rules.irctc_railway_lounge_terms.quota} ·{" "}
                {rules.irctc_railway_lounge_terms.inclusions?.slice(0, 3).join(", ")}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#F3F2EE] p-1 rounded-lg w-fit">
          {[
            { id: "my_cards", label: "My Cards Airport Check" },
            { id: "matrix", label: "Card ↔ Lounge Table" },
            { id: "golf", label: "Golf Claim & Courses" },
            { id: "programs", label: `Official Programs (${filteredPrograms.length})` },
            { id: "spots", label: "Search Bank PDFs" },
            { id: "cards", label: `No-Spend Cards (${noSpendLoungeCards.length})` },
          ].map((tab) => {
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`relative px-3 py-1.5 rounded-md text-[13px] transition-colors cursor-pointer ${
                  active
                    ? "text-[#1A1D21] font-medium"
                    : "text-[#4B525C] hover:text-[#1A1D21]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="lounge-view-pill"
                    transition={springGentle}
                    className="absolute inset-0 rounded-md bg-white shadow-xs"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {(viewMode === "programs" || viewMode === "spots" || viewMode === "matrix") && (
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1 lg:max-w-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city (Delhi, Mumbai), lounge, or bank..."
                className="w-full pl-9 pr-3 py-2 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
              />
            </div>
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              aria-label="Filter lounge programs by bank"
              className="px-3 py-2 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="all">All Banks ({programs.length})</option>
              {banks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Focused Card Banner (from My Cards -> Check Airport & Golf) */}
      {focusedCard && (
        <div className="bg-[#EEF5F2] border border-[#0F5C4D]/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BankLogo bank={focusedCard.bank} size="sm" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-[#1A1D21] truncate">
                Checking Access Only for {focusedCard.card_name}
              </div>
              <div className="text-[12px] text-[#0F5C4D]">
                {focusedCard.domestic_lounge_accessible_count ?? focusedCard.accessible_lounge_codes?.length ?? 0} Indian domestic lounges ·{" "}
                {focusedCard.accessible_golf_slugs?.length ?? 0} partner golf clubs
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${focusedCard.bank_slug}/${focusedCard.card_slug}`}
              className="text-[12px] font-medium text-[#0F5C4D] bg-white border border-[#0F5C4D]/25 px-2.5 py-1.5 rounded-lg hover:bg-[#FAF9F6]"
            >
              Card Dossier →
            </Link>
            <button
              type="button"
              onClick={() => setFocusedCardId(null)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1A1D21] bg-white border border-[#E4E4DF] px-2.5 py-1.5 rounded-lg hover:border-[#0F5C4D]/40 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Show All My Cards
            </button>
          </div>
        </div>
      )}

      {/* View Content: My Cards Airport Terminal Checker */}
      {viewMode === "my_cards" && (
        <div className="space-y-5">
          {/* Airport Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Full-Width Interactive Airport Picker */}
            <div className="lg:col-span-12 bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1A1D21]">
                    1. Choose Your Airport ({airportDirectory.length} Indian Hubs)
                  </h2>
                  <p className="text-[12px] text-[#717882]">
                    Search by city, IATA code (DEL, BOM, BLR), or lounge (Privé, 080, Encalm)
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold bg-[#EEF5F2] text-[#0F5C4D] px-2.5 py-1 rounded-full tabular-nums">
                  <Plane className="w-3.5 h-3.5" aria-hidden="true" />
                  {airportReport.airportCode} Selected
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  value={airportQuery}
                  onChange={(e) => setAirportQuery(e.target.value)}
                  placeholder="Search Delhi, Mumbai, Privé, 080, Goa, Noida DXN, NMI..."
                  className="w-full pl-9 pr-8 py-2 text-[13.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                />
                {airportQuery && (
                  <button
                    type="button"
                    onClick={() => setAirportQuery("")}
                    aria-label="Clear airport search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#717882] hover:text-[#1A1D21] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!airportQuery && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "popular", label: `Top Hubs (12)` },
                    { id: "intl", label: `Int'l Terminals` },
                    { id: "all", label: `All ${airportDirectory.length} Airports` },
                  ].map((tab) => {
                    const active = airportFilterMode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAirportFilterMode(tab.id as "popular" | "all" | "intl")}
                        className={`px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
                          active
                            ? "bg-[#1A1D21] text-white border-[#1A1D21]"
                            : "bg-[#FAF9F6] text-[#4B525C] border-[#E4E4DF] hover:border-[#0F5C4D]/40"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[268px] overflow-y-auto pr-1">
                {filteredAirports.map((a) => {
                  const active = selectedAirport === a.airportCode;
                  return (
                    <button
                      key={a.airportCode}
                      type="button"
                      onClick={() => setSelectedAirport(a.airportCode)}
                      className={`text-left rounded-xl p-2.5 border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? "bg-[#0F5C4D] text-white border-[#0F5C4D] shadow-sm"
                          : "bg-[#FAF9F6] text-[#1A1D21] border-[#E4E4DF] hover:border-[#0F5C4D]/50 hover:bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                              active ? "bg-white/20 text-white" : "bg-[#E9EFEA] text-[#0F5C4D]"
                            }`}
                          >
                            {a.airportCode}
                          </span>
                          <span className="text-[13px] font-semibold truncate">{a.city}</span>
                        </div>
                        <div
                          className={`text-[11px] mt-1 tabular-nums ${
                            active ? "text-white/85" : "text-[#717882]"
                          }`}
                        >
                          {a.totalSpots} lounge{a.totalSpots === 1 ? "" : "s"}
                          {a.internationalCount > 0 ? ` · ${a.internationalCount} Int'l` : " · Domestic"}
                        </div>
                      </div>
                      {a.topRating !== null && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11.5px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 tabular-nums ${
                            active ? "bg-white text-[#0F5C4D]" : "bg-[#FEF6EA] text-[#9A5B13]"
                          }`}
                        >
                          <Star className="w-3 h-3 fill-current" />
                          {a.topRating.toFixed(1)}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredAirports.length === 0 && (
                  <p className="col-span-2 text-[12.5px] text-[#717882] py-4 text-center">
                    No Indian airport matched “{airportQuery}”.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Summary Verdict Banner */}
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-md">
                {airportReport.airportCode} Terminal Access Summary
              </span>
              <h3 className="text-[18px] font-medium text-[#1A1D21] mt-1.5">
                {airportReport.city} ({airportReport.airportCode}) —{" "}
                {airportReport.totalSpots} Participating Lounge
                {airportReport.totalSpots === 1 ? "" : "s"}
              </h3>
              <p className="text-[13px] text-[#4B525C] mt-0.5">
                {activeEvalCards.length === 0
                  ? `Showing all terminals at ${airportReport.city}. Add your cards in My Cards to evaluate exact entry per terminal.`
                  : `With ${activeEvalCards.length} active card${activeEvalCards.length === 1 ? "" : "s"}: ${airportReport.accessibleNoSpendCount} unconditional no-spend, ${airportReport.spendGatedCount} spend-gated, ${airportReport.notCoveredCount} not covered.`}
              </p>
              {activeEvalCards.length > 0 && airportReport.totalSpots > 0 && (
                <div className="mt-2.5 max-w-md space-y-1">
                  <div className="h-1.5 bg-[#F3F2EE] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.round(
                          ((airportReport.accessibleNoSpendCount + airportReport.spendGatedCount) /
                            airportReport.totalSpots) *
                            100
                        )}%`,
                      }}
                      transition={{ duration: 0.45, ease: LEDGER_EASE }}
                      className="h-full bg-[#0F5C4D] rounded-full"
                    />
                  </div>
                  <span className="block text-[11.5px] text-[#4B525C] tabular-nums">
                    {airportReport.accessibleNoSpendCount + airportReport.spendGatedCount} of{" "}
                    {airportReport.totalSpots} terminals covered (
                    {Math.round(
                      ((airportReport.accessibleNoSpendCount + airportReport.spendGatedCount) /
                        airportReport.totalSpots) *
                        100
                    )}
                    %)
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 shrink-0">
              <div className="bg-[#EEF5F2] border border-[#0F5C4D]/25 rounded-lg px-3.5 py-2.5 text-center">
                <div className="text-[18px] font-medium text-[#0F5C4D] tabular-nums">
                  {airportReport.accessibleNoSpendCount}
                </div>
                <div className="text-[11.5px] text-[#0F5C4D]">No-Spend Open</div>
              </div>
              <div className="bg-[#FEF6EA] border border-[#9A5B13]/25 rounded-lg px-3.5 py-2.5 text-center">
                <div className="text-[18px] font-medium text-[#9A5B13] tabular-nums">
                  {airportReport.spendGatedCount}
                </div>
                <div className="text-[11.5px] text-[#9A5B13]">Spend-Gated</div>
              </div>
              <div className="bg-[#F3F2EE] border border-[#E4E4DF] rounded-lg px-3.5 py-2.5 text-center">
                <div className="text-[18px] font-medium text-[#4B525C] tabular-nums">
                  {airportReport.notCoveredCount}
                </div>
                <div className="text-[11.5px] text-[#4B525C]">Not Covered</div>
              </div>
            </div>
          </div>

          {/* Compact Action Bar: Terminal Filters + Dedicated Guide Sub-Page Link */}
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["all", `All Terminals (${airportReport.spotEvaluations.length})`],
                    ["domestic", "Domestic"],
                    ["international", "International"],
                  ] as const
                ).map(([id, lbl]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTerminalFilter(id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                      terminalFilter === id
                        ? "bg-[#0F5C4D] text-white font-medium"
                        : "bg-[#F3F2EE] text-[#4B525C] hover:text-[#1A1D21]"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href={`/lounges/guide?airport=${encodeURIComponent(airportReport.airportCode)}`}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#EEF5F2] border border-[#0F5C4D]/25 text-[#0F5C4D] text-[13px] font-medium hover:bg-[#E2EFE9] transition-colors"
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" />
                  <span>
                    QR Portals &amp; Claim Guide ({airportReport.claimPortals.map((p) => p.name).join(" · ")}) →
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setViewMode("golf")}
                  className="text-[13px] font-medium text-[#4B525C] hover:text-[#0F5C4D] cursor-pointer px-2 py-1"
                >
                  Golf Claim →
                </button>
              </div>
            </div>

            {airportReport.bestTerminalTip && (
              <div className="flex items-start gap-2 text-[12.5px] text-[#1A1D21] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3.5 py-2.5 leading-relaxed">
                <Award className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{airportReport.bestTerminalTip}</span>
              </div>
            )}
          </div>

          {/* Terminal Lounges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <AnimatePresence mode="popLayout">
              {airportReport.spotEvaluations
                .filter((ev) =>
                  terminalFilter === "all"
                    ? true
                    : /international/i.test(ev.spot.terminal_type) ===
                      (terminalFilter === "international")
                )
                .map((ev) => {
                const { spot, verdict, noSpendCards, spendGatedCards, blockedCards, bestLoungeBadge, claimPortals } = ev;
                const isIntl = /international/i.test(spot.terminal_type);
                const spotImg =
                  resolveMediaUrl(
                    spot.local_photo_path ||
                      (isIntl
                        ? "/illustrations/lounge-intl-suite.webp"
                        : bestLoungeBadge
                          ? "/illustrations/airport-lounge-hero.webp"
                          : "/illustrations/lounge-domestic-dining.webp")
                  ) || "/illustrations/lounge-domestic-dining.webp";
                const statusBg =
                  verdict === "accessible_no_spend"
                    ? "bg-[#EEF5F2] text-[#0F5C4D] border-[#0F5C4D]/25"
                    : verdict === "spend_gated"
                      ? "bg-[#FEF6EA] text-[#9A5B13] border-[#9A5B13]/25"
                      : "bg-[#F3F2EE] text-[#4B525C] border-[#E4E4DF]";

                return (
                  <motion.div
                    key={spot.lounge_code}
                    layout="position"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={fastTransition}
                    className={`bg-white border rounded-xl overflow-hidden flex flex-col justify-between ${
                      bestLoungeBadge ? "border-[#0F5C4D]/45" : "border-[#E4E4DF]"
                    }`}
                  >
                    <Link
                      href={`/lounges/${spot.lounge_code}`}
                      className="block relative h-44 w-full overflow-hidden bg-[#F3F2EE] group"
                    >
                      <Image
                        src={spotImg}
                        alt={spot.google_place_name || `${spot.lounge_name} real lounge photo`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                      {typeof spot.google_rating === "number" && (
                        <div className="absolute top-2.5 right-3 flex items-center gap-1 bg-white/95 text-[#1A1D21] px-2.5 py-1 rounded-full shadow-sm text-[11.5px] font-semibold tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706]" />
                          <span>{spot.google_rating.toFixed(1)}</span>
                          {spot.google_review_count ? (
                            <span className="text-[#717882] font-normal">
                              ({spot.google_review_count.toLocaleString("en-IN")})
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="bg-white/95 text-[#1A1D21] font-medium px-2 py-0.5 rounded-md">
                            {spot.terminal}
                          </span>
                          <span className="bg-white/90 text-[#0F5C4D] font-medium px-2 py-0.5 rounded-md">
                            {spot.terminal_type}
                          </span>
                        </div>
                        {bestLoungeBadge && (
                          <span className="inline-flex items-center gap-1 bg-[#0F5C4D] text-white text-[11px] font-medium px-2 py-0.5 rounded-md">
                            <Award className="w-3 h-3" />
                            {bestLoungeBadge.label}
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="p-5 flex flex-col justify-between gap-4 flex-1">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <h4 className="text-[16px] font-medium text-[#1A1D21] leading-snug">
                            <Link href={`/lounges/${spot.lounge_code}`} className="hover:text-[#0F5C4D] hover:underline">
                              {spot.lounge_name}
                            </Link>
                          </h4>
                          {bestLoungeBadge && (
                            <p className="text-[12px] text-[#0F5C4D]">{bestLoungeBadge.reason}</p>
                          )}
                        </div>

                        {activeEvalCards.length > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 text-[12px] font-medium border px-2.5 py-1 rounded-lg shrink-0 ${statusBg}`}
                          >
                            {verdict === "accessible_no_spend" && (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Accessible
                              </>
                            )}
                            {verdict === "spend_gated" && (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                Spend-Gated
                              </>
                            )}
                            {verdict === "not_covered" && (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                Not Covered
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-[12px] text-[#4B525C]">
                        Accepts: {spot.accepted_networks.join(" · ")}
                      </p>

                      {/* Qualifying Cards (Concise) */}
                      {(noSpendCards.length > 0 || spendGatedCards.length > 0) && (
                        <div className="space-y-2 pt-1">
                          {noSpendCards.map((item) => {
                            const primaryPortal = claimPortals[0];
                            return (
                              <Link
                                key={`ok-${item.card.card_id}`}
                                href={`/${item.card.bank_slug}/${item.card.card_slug}`}
                                className="block bg-[#EEF5F2]/70 border border-[#0F5C4D]/25 rounded-lg p-2.5 hover:border-[#0F5C4D]/50 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1D21]">
                                    <BankLogo
                                      bankSlug={item.card.bank_slug}
                                      bank={item.card.bank}
                                      size="xs"
                                    />
                                    <span>{item.card.card_name}</span>
                                  </span>
                                  <span className="text-[11px] font-semibold bg-[#0F5C4D] text-white px-2 py-0.5 rounded-full shrink-0">
                                    {getShortQuotaLabel(item.quotaSummary)}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[#4B525C] mt-1">
                                  {item.matchedNetwork} · Claim QR on {primaryPortal?.name || "Portal"}
                                </p>
                              </Link>
                            );
                          })}

                          {spendGatedCards.map((item) => (
                            <Link
                              key={`sg-${item.card.card_id}`}
                              href={`/${item.card.bank_slug}/${item.card.card_slug}`}
                              className="block bg-[#FEF6EA]/80 border border-[#9A5B13]/25 rounded-lg p-2.5 hover:border-[#9A5B13]/50 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1D21]">
                                  <BankLogo
                                    bankSlug={item.card.bank_slug}
                                    bank={item.card.bank}
                                    size="xs"
                                  />
                                  <span>{item.card.card_name}</span>
                                </span>
                                <span className="text-[11px] font-semibold text-[#9A5B13] bg-white border border-[#EAD4AD] px-2 py-0.5 rounded-full shrink-0">
                                  {getShortSpendLabel(item.spendCondition)}
                                </span>
                              </div>
                              <p className="text-[12px] text-[#9A5B13] mt-1">
                                {getShortQuotaLabel(item.quotaSummary)} · {item.matchedNetwork}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}

                      {/* Blocked owned cards collapsed by default */}
                      {blockedCards.length > 0 && (
                        <details className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2 text-[12px]">
                          <summary className="text-[#4B525C] cursor-pointer font-medium select-none">
                            {blockedCards.length} wallet card{blockedCards.length === 1 ? "" : "s"} not eligible here
                          </summary>
                          <div className="space-y-1 mt-2 pt-2 border-t border-[#E4E4DF]">
                            {blockedCards.map((b) => (
                              <div key={`blk-${b.card.card_id}`} className="text-[#4B525C] leading-snug">
                                • <span className="text-[#1A1D21]">{b.card.card_name}:</span> {b.reason}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-[#E4E4DF] space-y-2">
                      {spot.terminal_and_hours && (
                        <div className="text-[12px] text-[#717882] truncate">
                          {spot.terminal_and_hours}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        <Link
                          href={`/lounges/${spot.lounge_code}`}
                          className="inline-flex items-center gap-1.5 text-white bg-[#0F5C4D] hover:bg-[#0B473B] px-2.5 py-1 rounded-md font-medium"
                        >
                          <span>Details, 6 Photos &amp; Reviews</span>
                        </Link>
                        {claimPortals[0] && (
                          <a
                            href={claimPortals[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-1 text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md font-medium hover:underline"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{claimPortals[0].name}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {spot.google_maps_url && (
                          <a
                            href={spot.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-1 text-[#9A5B13] bg-[#FEF6EA] px-2 py-0.5 rounded-md font-medium hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Google Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* View Content: Golf Claim Portals, Procedure & Mastercard Course Directory */}
      {viewMode === "golf" && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-md font-medium">
                <Flag className="w-3.5 h-3.5" />
                Golf Tee-Time &amp; Coaching Claim Directory (2026)
              </span>
              <h2 className="text-[19px] font-medium text-[#1A1D21] mt-1.5">
                How to Book Complimentary Golf via RuPay, Mastercard, Visa &amp; Bank Concierges
              </h2>
              <p className="text-[13px] text-[#4B525C] mt-1">
                Advance booking windows (4–15 days prior), official portals (including{" "}
                <a
                  href="https://rupayselect.truztee.com/#/offers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F5C4D] underline"
                >
                  rupayselect.truztee.com/#/offers
                </a>
                ), toll-free booking numbers, and participating courses across India.
              </p>
            </div>
            <Link
              href="/categories?cat=golf"
              className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0"
            >
              Browse Best Golf Credit Cards →
            </Link>
          </div>

          {golfClubs.length > 0 && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-[#1A1D21]">
                    Indian Golf Clubs — Real Photos &amp; Verified Google Maps Ratings ({filteredGolfClubs.length})
                  </h3>
                  <p className="text-[12.5px] text-[#717882]">
                    Live Google Maps scores, total reviews, and real course photos across major Indian golf clubs.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="text"
                    value={golfCourseQuery}
                    onChange={(e) => setGolfCourseQuery(e.target.value)}
                    placeholder="Filter city or golf club..."
                    className="w-full pl-9 pr-3 py-1.5 text-[13px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGolfClubs.map((club) => (
                  <div
                    key={club.slug}
                    className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative h-40 w-full bg-[#EFECE5] overflow-hidden">
                      <Image
                        src={
                          resolveMediaUrl(club.local_photo_path || "/illustrations/lounge-golf-club.webp") ||
                          "/illustrations/lounge-golf-club.webp"
                        }
                        alt={`${club.club_name} (${club.city}) real photo`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                      <span className="absolute top-2.5 left-2.5 bg-white/95 text-[#1A1D21] text-[11px] font-semibold px-2 py-0.5 rounded-md">
                        {club.city}
                      </span>
                      {typeof club.google_rating === "number" && (
                        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-white/95 text-[#1A1D21] px-2 py-0.5 rounded-full text-[11.5px] font-semibold tabular-nums">
                          <Star className="w-3 h-3 fill-[#D97706] text-[#D97706]" />
                          {club.google_rating.toFixed(1)}
                          {club.google_review_count ? (
                            <span className="text-[#717882] font-normal">
                              ({club.google_review_count.toLocaleString("en-IN")})
                            </span>
                          ) : null}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-[14px] font-semibold text-[#1A1D21] leading-snug">
                          <Link href={`/lounges/${club.slug}`} className="hover:text-[#0F5C4D] hover:underline">
                            {club.club_name}
                          </Link>
                        </h4>
                        {club.formatted_address && (
                          <p className="text-[11.5px] text-[#717882] line-clamp-2 mt-1">
                            {club.formatted_address}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Link
                          href={`/lounges/${club.slug}`}
                          className="text-[12px] font-medium text-[#0F5C4D] hover:underline"
                        >
                          Details, Photos &amp; Cards →
                        </Link>
                        {club.google_maps_url && (
                          <a
                            href={club.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#9A5B13] hover:underline"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Maps</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {GOLF_PROGRAM_GUIDES.map((g) => (
              <div
                key={g.id}
                className="bg-white border border-[#E4E4DF] rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-0.5 rounded-md">
                      {g.networkOrBank}
                    </span>
                    <span className="text-[11.5px] text-[#717882]">Window: {g.bookingWindow}</span>
                  </div>

                  <div>
                    <h3 className="text-[16px] font-medium text-[#1A1D21]">{g.programName}</h3>
                    <p className="text-[12px] text-[#717882] mt-0.5">{g.hours}</p>
                  </div>

                  {/* Action pills: Portal + Phone */}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={g.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-[#0F5C4D] text-white px-3 py-1.5 rounded-lg hover:bg-[#0B463B] transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{g.portalLabel}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`tel:${g.helplinePhone.replace(/[^+\d]/g, "")}`}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-[#FAF9F6] border border-[#E4E4DF] text-[#1A1D21] px-3 py-1.5 rounded-lg hover:border-[#0F5C4D]/50 tabular-nums"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#0F5C4D]" />
                      <span>{g.helplinePhone}</span>
                    </a>
                    {g.altPhone && (
                      <a
                        href={`tel:${g.altPhone.replace(/[^+\d]/g, "")}`}
                        className="inline-flex items-center gap-1.5 text-[12px] bg-[#FAF9F6] border border-[#E4E4DF] text-[#4B525C] px-2.5 py-1.5 rounded-lg tabular-nums"
                      >
                        Alt: {g.altPhone}
                      </a>
                    )}
                  </div>

                  {g.supportEmail && (
                    <p className="text-[12px] text-[#4B525C]">
                      Email: <span className="text-[#1A1D21] font-medium">{g.supportEmail}</span>
                    </p>
                  )}

                  {/* Booking Steps */}
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3 space-y-1.5">
                    <div className="text-[12px] font-medium text-[#1A1D21]">
                      Step-by-Step Booking Procedure
                    </div>
                    {g.steps.map((st, idx) => (
                      <p key={idx} className="text-[12.5px] text-[#4B525C] leading-relaxed">
                        {idx + 1}. {st}
                      </p>
                    ))}
                  </div>

                  {g.notes.length > 0 && (
                    <div className="space-y-1">
                      {g.notes.map((n, idx) => (
                        <p key={idx} className="text-[12px] text-[#9A5B13]">
                          • {n}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Mastercard India Participating Courses List */}
                  {g.courseGroups && (
                    <div className="border-t border-[#E4E4DF] pt-3 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-[13.5px] font-medium text-[#1A1D21]">
                          Mastercard India Participating Golf Courses
                        </h4>
                        <input
                          type="text"
                          value={golfCourseQuery}
                          onChange={(e) => setGolfCourseQuery(e.target.value)}
                          placeholder="Filter city or golf club..."
                          className="px-2.5 py-1 text-[12px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-md focus:outline-none focus:border-[#0F5C4D]"
                        />
                      </div>
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {g.courseGroups.map((grp) => {
                          const q = golfCourseQuery.trim().toLowerCase();
                          const matchedCities = grp.cities.filter(
                            (c) =>
                              !q ||
                              c.city.toLowerCase().includes(q) ||
                              c.courses.toLowerCase().includes(q)
                          );
                          if (matchedCities.length === 0) return null;
                          return (
                            <div key={grp.type} className="space-y-1">
                              <div className="text-[11.5px] font-medium text-[#0F5C4D] uppercase tracking-wide">
                                {grp.type}
                              </div>
                              {matchedCities.map((row) => (
                                <div
                                  key={`${grp.type}-${row.city}`}
                                  className="text-[12px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-md px-2.5 py-1.5"
                                >
                                  <span className="font-medium text-[#1A1D21]">{row.city}: </span>
                                  <span className="text-[#4B525C]">{row.courses}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Content: Card <-> Lounge Matrix Table */}
      {viewMode === "matrix" && (
        <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E4DF] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1A1D21]">
                Card ↔ Indian Airport Lounge Eligibility Table ({cardToLoungeRows.length})
              </h2>
              <p className="text-[12px] text-[#717882]">
                Verify which credit cards enter each Indian terminal lounge without spend criteria, and open full lounge guides.
              </p>
            </div>
            <span className="text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-full font-medium">
              Spend-free cards prioritized
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#FAF9F6] border-b border-[#E4E4DF] text-[11.5px] uppercase tracking-wider text-[#717882]">
                  <th className="py-3 px-4 font-semibold">Airport</th>
                  <th className="py-3 px-4 font-semibold">Lounge &amp; Terminal</th>
                  <th className="py-3 px-4 font-semibold">Rating</th>
                  <th className="py-3 px-4 font-semibold">Top No-Spend Eligible Cards</th>
                  <th className="py-3 px-4 font-semibold">How to Claim / Guide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4DF]">
                {cardToLoungeRows.slice(0, 100).map((spot) => {
                  const noSpendCards = (spot.eligible_no_spend_card_ids || [])
                    .map((cid) => cardById.get(cid))
                    .filter((c): c is CardSummaryItem => Boolean(c));
                  const gatedCount =
                    (spot.eligible_low_spend_card_ids?.length || 0) +
                    (spot.eligible_high_spend_card_ids?.length || 0);
                  const accessTitle = spot.how_to_access?.[0]?.channel || "LoungeOne / HOI LMS / Bank QR";
                  return (
                    <tr key={spot.lounge_code} className="hover:bg-[#FAF9F6]/70 align-top">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block bg-[#EEF5F2] text-[#0F5C4D] font-semibold text-[11.5px] px-2 py-0.5 rounded tabular-nums">
                          {spot.airport_code}
                        </span>
                        <div className="text-[12px] text-[#4B525C] mt-1">{spot.city}</div>
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <Link
                          href={`/lounges/${spot.lounge_code}`}
                          className="font-semibold text-[#1A1D21] hover:text-[#0F5C4D] hover:underline"
                        >
                          {spot.lounge_name}
                        </Link>
                        <div className="text-[11.5px] text-[#717882] mt-0.5">
                          {spot.terminal} · {spot.terminal_type}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        {typeof spot.google_rating === "number" ? (
                          <span className="inline-flex items-center gap-1 text-[#1A1D21] font-medium">
                            <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706]" />
                            {spot.google_rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-[#717882]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 min-w-[240px]">
                        <div className="flex flex-wrap gap-1.5">
                          {noSpendCards.slice(0, 4).map((c) => (
                            <Link
                              key={c.card_id}
                              href={`/${c.bank_slug}/${c.card_slug}`}
                              className="inline-flex items-center gap-1 text-[11.5px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-md px-2 py-0.5 text-[#1A1D21] hover:border-[#0F5C4D]"
                            >
                              {c.card_name}
                            </Link>
                          ))}
                          {noSpendCards.length > 4 && (
                            <span className="text-[11.5px] text-[#0F5C4D] font-medium px-1.5 py-0.5">
                              +{noSpendCards.length - 4} spend-free
                            </span>
                          )}
                          {noSpendCards.length === 0 && (
                            <span className="text-[11.5px] text-[#9A5B13]">
                              {gatedCount} spend-gated / Priority Pass cards
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-[12px] text-[#4B525C] max-w-[180px] truncate">{accessTitle}</div>
                        <Link
                          href={`/lounges/${spot.lounge_code}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0F5C4D] hover:underline mt-0.5"
                        >
                          6 Photos &amp; Access →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cardToLoungeRows.length === 0 && (
              <p className="text-center text-[13px] text-[#717882] py-8">
                No Indian lounges matched your filter.
              </p>
            )}
          </div>
        </div>
      )}

      {/* View Content: Official Bank Programs */}
      {viewMode === "programs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredPrograms.map((p) => (
              <motion.div
                key={p.program_id}
                layout="position"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={fastTransition}
                className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded-md">
                      <BankLogo bank={p.bank} size="xs" />
                      <span>{p.bank}</span>
                    </span>
                    <span className="text-[11.5px] text-[#717882]">
                      {formatLoungeSourceType(p.source_type)}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-medium text-[#1A1D21] mt-2.5 leading-snug">
                    {p.title}
                  </h3>
                  <p className="text-[12.5px] text-[#4B525C] mt-1 tabular-nums">
                    {p.parsed_lounges_count > 0
                      ? `${p.parsed_lounges_count} participating lounges indexed`
                      : "Official bank / network lounge list"}
                  </p>

                  {p.parsed_lounges?.length > 0 && (
                    <p className="text-[12px] text-[#717882] mt-2 line-clamp-2">
                      Cities:{" "}
                      {Array.from(new Set(p.parsed_lounges.map((s) => s.city)))
                        .slice(0, 6)
                        .join(", ")}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E4E4DF] flex items-center justify-between gap-2 text-[12.5px]">
                  <a
                    href={p.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="inline-flex items-center gap-1.5 font-medium text-[#0F5C4D] hover:underline"
                  >
                    Open Official List
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                  {p.secondary_url && (
                    <a
                      href={p.secondary_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="text-[#4B525C] hover:text-[#1A1D21] hover:underline"
                    >
                      Backup Link
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* View Content: Search Bank PDFs Spots */}
      {viewMode === "spots" && (
        <div className="bg-white border border-[#E4E4DF] rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-[#F3F2EE] text-[#4B525C] sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-medium">City</th>
                  <th className="py-2.5 px-4 font-medium">Lounge Name</th>
                  <th className="py-2.5 px-4 font-medium">Terminal</th>
                  <th className="py-2.5 px-4 font-medium">Bank</th>
                  <th className="py-2.5 px-4 font-medium">Program</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4DF]">
                {allSpots.map((s, idx) => (
                  <tr
                    key={`${s.bank}-${s.city}-${s.lounge_name}-${idx}`}
                    className="hover:bg-[#FAF9F6]"
                  >
                    <td className="py-2.5 px-4 text-[#1A1D21] whitespace-nowrap">
                      {s.city}
                    </td>
                    <td className="py-2.5 px-4 text-[#1A1D21]">{s.lounge_name}</td>
                    <td className="py-2.5 px-4 text-[#4B525C]">
                      {s.terminal || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-[#4B525C] whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <BankLogo bank={s.bank} size="xs" />
                        <span>{s.bank}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <a
                        href={s.official_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="text-[#0F5C4D] hover:underline inline-flex items-center gap-1"
                      >
                        <span className="max-w-[220px] truncate">
                          {s.program_title}
                        </span>
                        <ExternalLink
                          className="w-3 h-3 shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allSpots.length === 0 && (
            <p className="p-6 text-[13.5px] text-[#717882] text-center">
              No lounge spots matched your filter. Try searching a major city like
              Delhi, Mumbai, Bengaluru, or Hyderabad.
            </p>
          )}
        </div>
      )}

      {/* View Content: No-Spend Lounge Cards */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {noSpendLoungeCards.map((card) => (
              <motion.div
                key={card.card_id}
                layout="position"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={fastTransition}
                className="h-full"
              >
                <LedgerCardItem card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
