"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  CreditCard,
  ExternalLink,
  Fuel,
  Globe,
  Layers,
  Plane,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import type {
  BankSummary,
  CardSummaryItem,
  DevaluationEvent,
  LatestOffer,
  RewardConversionStrategy,
} from "@/lib/types";
import { BankLogo } from "./BankLogo";
import { CardArtwork } from "./CardArtwork";
import { LedgerCardItem } from "./LedgerCardItem";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { formatInr, matchesTokenizedQuery } from "@/lib/format";
import {
  CARD_TRANSFER_SPECS,
  CONVERSION_STRATEGIES,
  computePersonalizedDirectoryScore,
  getCardConversionKeywords,
  normalizeMinMonthlyIncomeInr,
} from "@/lib/conversion";
import {
  calmTransition,
  fastTransition,
  sectionRevealProps,
  springGentle,
} from "@/lib/motion";
import { CanvaFeatureIcon, resolveCategoryCanvaIcon, type CanvaIconKey } from "./FeatureIcon";
import {
  AiOrb3D,
  Card3DTilt,
  MovingBorderPill,
  SparklesField,
  SpotlightBeam,
} from "./Modern3DAi";
import { Interactive3DCardModel } from "./Interactive3DCardModel";

interface HomeClientProps {
  cards: CardSummaryItem[];
  banks: BankSummary[];
  recentDevaluations: DevaluationEvent[];
  latestOffers?: LatestOffer[];
  stats: {
    totalCards: number;
    totalBanks: number;
    ltfCount: number;
    noSpendLoungeCount: number;
    rupayCount: number;
    zeroLowForexCount: number;
    fuelCount: number;
    travelCount: number;
  };
}

const QUICK_CATEGORIES = [
  { label: "Fuel", dataset: "Fuel" },
  { label: "Cashback", dataset: "Cashback" },
  { label: "Online Shopping", dataset: "Online Shopping" },
  { label: "Groceries & Dining", dataset: "Dining, Groceries & Movies" },
  { label: "Travel & Miles", dataset: "Travel & Miles" },
  { label: "RuPay UPI", dataset: "RuPay & UPI" },
  { label: "Airport Lounge", dataset: "Airport Lounge" },
  { label: "Zero/Low Forex", dataset: "Zero/Low Forex" },
  { label: "Golf & Club Access", dataset: "Golf" },
  { label: "Super-Premium", dataset: "Super-Premium" },
  { label: "Lifetime Free", dataset: "Lifetime Free" },
  { label: "Entry & FD Secured", dataset: "Entry-Level & Secured (FD)" },
  { label: "Business & Tax", dataset: "Business & Tax" },
] as const;

const SPOTLIGHT_TABS = [
  { id: "cashback", label: "Online Cashback" },
  { id: "fuel", label: "Fuel" },
  { id: "groceries", label: "Groceries & Dining" },
  { id: "lounge", label: "No-Spend Lounges" },
  { id: "golf", label: "Golf" },
  { id: "ltf", label: "Lifetime Free" },
  { id: "rupay", label: "RuPay UPI" },
  { id: "forex", label: "Zero / Low Forex" },
  { id: "travel", label: "Travel & Miles" },
] as const;

type SpotlightTabId = (typeof SPOTLIGHT_TABS)[number]["id"];

interface DeckSlotSpec {
  id: string;
  title: string;
  subtitle: string;
  icon: CanvaIconKey;
  preferredSlugs: string[];
  fallbackCategory: string;
  rotateDeg: number;
  translateY: number;
  zIndex: number;
  fallbackBg: string;
  fallbackAccent: string;
  fallbackBorder: string;
}

const SHOWCASE_DECK_SPECS: DeckSlotSpec[] = [
  {
    id: "lifestyle",
    title: "Lifestyle & Dining",
    subtitle: "10% dining & grocery savings",
    icon: "rewards",
    preferredSlugs: ["hsbc-live-credit-card", "swiggy-hdfc-bank-credit-card", "hdfc-millennia-credit-card"],
    fallbackCategory: "Dining, Groceries & Movies",
    rotateDeg: -7.5,
    translateY: 22,
    zIndex: 10,
    fallbackBg: "#F4F1FA",
    fallbackAccent: "#5B449C",
    fallbackBorder: "#DCD4EF",
  },
  {
    id: "shopping",
    title: "Online Shopping",
    subtitle: "Direct 5% across D2C & carts",
    icon: "shopping",
    preferredSlugs: ["cashback-sbi-card", "amazon-pay-icici-bank-credit-card", "flipkart-axis-bank-credit-card"],
    fallbackCategory: "Online Shopping",
    rotateDeg: -3.5,
    translateY: 10,
    zIndex: 20,
    fallbackBg: "#FDF2F0",
    fallbackAccent: "#B34032",
    fallbackBorder: "#F2D2CC",
  },
  {
    id: "travel",
    title: "Travel & Lounges",
    subtitle: "Zero-spend lounges & miles",
    icon: "travel",
    preferredSlugs: ["axis-bank-atlas-credit-card", "hdfc-regalia-gold-credit-card", "federal-bank-scapia-credit-card"],
    fallbackCategory: "Travel & Miles",
    rotateDeg: 0,
    translateY: 0,
    zIndex: 30,
    fallbackBg: "#EEF5F2",
    fallbackAccent: "#0F5C4D",
    fallbackBorder: "#CBE0D7",
  },
  {
    id: "cashback",
    title: "Cashback & UPI",
    subtitle: "Earn daily on Scan & Pay",
    icon: "cashback",
    preferredSlugs: ["tata-neu-infinity-hdfc-bank-credit-card", "yes-bank-klick-kiwi-rupay-credit-card", "airtel-axis-bank-credit-card"],
    fallbackCategory: "Cashback",
    rotateDeg: 3.5,
    translateY: 10,
    zIndex: 20,
    fallbackBg: "#EFF6F3",
    fallbackAccent: "#166534",
    fallbackBorder: "#C5E2D3",
  },
  {
    id: "premium",
    title: "Golf & Super-Premium",
    subtitle: "Invite-tier & club privileges",
    icon: "golf",
    preferredSlugs: ["hdfc-infinia-metal-edition-credit-card", "hdfc-diners-club-black-metal-edition", "icici-bank-emeralde-private-metal-credit-card"],
    fallbackCategory: "Super-Premium",
    rotateDeg: 7.5,
    translateY: 22,
    zIndex: 10,
    fallbackBg: "#FBF6EC",
    fallbackAccent: "#8F5914",
    fallbackBorder: "#EAD9B7",
  },
];

export function HomeClient({
  cards,
  banks,
  recentDevaluations,
  latestOffers = [],
  stats,
}: HomeClientProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [heroIncome, setHeroIncome] = useState<number | null>(null);
  const [heroStrategy, setHeroStrategy] = useState<RewardConversionStrategy>("default_inr");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<SpotlightTabId>("cashback");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedOfferBank, setSelectedOfferBank] = useState<string>("all");
  const [hoveredDeckIdx, setHoveredDeckIdx] = useState<number | null>(null);
  const [studioIdx, setStudioIdx] = useState<number>(0);
  const [expandedDevalIdx, setExpandedDevalIdx] = useState<number | null>(null);

  const heroSuggestions = useMemo(() => {
    const q = searchInput.trim();
    if (!q && !heroIncome && heroStrategy === "default_inr") return [];
    const matched = cards.filter((c) => {
      if (!q) return true;
      const t = c.filter_tags;
      const hay = `${c.card_name} ${c.bank} ${c.card_network} ${c.card_tier} ${c.primary_category} ${c.categories.join(" ")} ${(
        t.best_for_tags || []
      ).join(" ")} ${(t.requirement_keywords || []).join(" ")} ${getCardConversionKeywords(c.card_id).join(" ")}`;
      return matchesTokenizedQuery(hay, q);
    });
    return matched
      .map((c) => ({
        card: c,
        personalized: computePersonalizedDirectoryScore(c, {
          monthlyIncomeInr: heroIncome,
          strategy: heroStrategy,
        }),
      }))
      .sort((a, b) => b.personalized.score - a.personalized.score)
      .slice(0, 6);
  }, [cards, searchInput, heroIncome, heroStrategy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const q = searchInput.trim();
    if (q) params.set("q", q);
    if (heroIncome) params.set("income", String(heroIncome));
    if (heroStrategy !== "default_inr") params.set("strategy", heroStrategy);
    if (heroIncome || heroStrategy !== "default_inr") params.set("sort", "personalized");
    const qs = params.toString();
    router.push(qs ? `/cards?${qs}` : "/cards");
  };

  // Pick 5 real flagship cards for the interactive fanned hero showcase deck
  const heroDeckCards = useMemo(() => {
    const usedIds = new Set<string>();
    return SHOWCASE_DECK_SPECS.map((spec) => {
      let chosen: CardSummaryItem | undefined;
      for (const slug of spec.preferredSlugs) {
        const hit = cards.find((c) => c.card_slug === slug && !usedIds.has(c.card_id));
        if (hit) {
          chosen = hit;
          break;
        }
      }
      if (!chosen) {
        chosen = cards
          .filter(
            (c) =>
              !usedIds.has(c.card_id) &&
              (c.primary_category === spec.fallbackCategory ||
                c.categories.includes(spec.fallbackCategory))
          )
          .sort((a, b) => b.overall_rating - a.overall_rating)[0];
      }
      if (!chosen) {
        chosen = cards.find((c) => !usedIds.has(c.card_id));
      }
      if (chosen) usedIds.add(chosen.card_id);
      return { spec, card: chosen };
    }).filter((entry): entry is { spec: DeckSlotSpec; card: CardSummaryItem } => Boolean(entry.card));
  }, [cards]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of QUICK_CATEGORIES) {
      counts[c.dataset] = cards.filter(
        (card) => card.categories.includes(c.dataset) || card.primary_category === c.dataset
      ).length;
    }
    return counts;
  }, [cards]);

  const selectedCatCards = useMemo(() => {
    if (!selectedCat) return [];
    return cards
      .filter(
        (card) => card.categories.includes(selectedCat) || card.primary_category === selectedCat
      )
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 6);
  }, [cards, selectedCat]);

  const offerBanks = useMemo(() => {
    const seen = new Set<string>();
    for (const o of latestOffers) {
      if (o.bank) seen.add(o.bank);
    }
    return Array.from(seen);
  }, [latestOffers]);

  const visibleOffers = useMemo(() => {
    const pool =
      selectedOfferBank === "all"
        ? latestOffers
        : latestOffers.filter((o) => o.bank === selectedOfferBank);
    return pool.slice(0, 6);
  }, [latestOffers, selectedOfferBank]);

  const tabCards = useMemo(() => {
    let filtered: CardSummaryItem[] = [];
    if (activeTab === "cashback") {
      filtered = [...cards]
        .filter((c) => c.categories.includes("Cashback") || c.primary_category === "Cashback")
        .sort((a, b) => {
          const rA = Math.max(
            a.effective_return_pct_by_category?.online_shopping_general || 0,
            a.effective_return_pct_by_category?.amazon_flipkart_myntra || 0
          );
          const rB = Math.max(
            b.effective_return_pct_by_category?.online_shopping_general || 0,
            b.effective_return_pct_by_category?.amazon_flipkart_myntra || 0
          );
          return rB - rA || b.overall_rating - a.overall_rating;
        });
    } else if (activeTab === "fuel") {
      filtered = [...cards]
        .filter((c) => c.categories.includes("Fuel") || c.primary_category === "Fuel")
        .sort((a, b) => {
          const rA = a.effective_return_pct_by_category?.fuel || 0;
          const rB = b.effective_return_pct_by_category?.fuel || 0;
          return rB - rA || b.overall_rating - a.overall_rating;
        });
    } else if (activeTab === "groceries") {
      filtered = [...cards]
        .filter(
          (c) =>
            c.categories.includes("Dining, Groceries & Movies") ||
            c.primary_category === "Dining, Groceries & Movies"
        )
        .sort((a, b) => {
          const rA = Math.max(
            a.effective_return_pct_by_category?.groceries_quick_commerce || 0,
            a.effective_return_pct_by_category?.dining_swiggy_zomato || 0
          );
          const rB = Math.max(
            b.effective_return_pct_by_category?.groceries_quick_commerce || 0,
            b.effective_return_pct_by_category?.dining_swiggy_zomato || 0
          );
          return rB - rA || b.overall_rating - a.overall_rating;
        });
    } else if (activeTab === "lounge") {
      filtered = [...cards]
        .filter((c) => c.filter_tags.no_spend_domestic_lounge)
        .sort((a, b) => b.overall_rating - a.overall_rating);
    } else if (activeTab === "golf") {
      filtered = [...cards]
        .filter((c) => c.filter_tags.has_golf || c.categories.includes("Golf"))
        .sort((a, b) => b.overall_rating - a.overall_rating);
    } else if (activeTab === "ltf") {
      filtered = [...cards]
        .filter((c) => c.filter_tags.is_ltf)
        .sort((a, b) => b.overall_rating - a.overall_rating);
    } else if (activeTab === "rupay") {
      filtered = [...cards]
        .filter((c) => c.filter_tags.is_rupay_upi)
        .sort((a, b) => b.overall_rating - a.overall_rating);
    } else if (activeTab === "forex") {
      filtered = [...cards]
        .filter((c) => c.filter_tags.zero_forex || c.filter_tags.zero_or_low_forex)
        .sort((a, b) => {
          const zA = a.filter_tags.zero_forex ? 1 : 0;
          const zB = b.filter_tags.zero_forex ? 1 : 0;
          return zB - zA || b.overall_rating - a.overall_rating;
        });
    } else {
      filtered = [...cards]
        .filter((c) => c.primary_category === "Travel & Miles" || c.categories.includes("Travel & Miles"))
        .sort((a, b) => b.overall_rating - a.overall_rating);
    }
    return filtered.slice(0, 6);
  }, [activeTab, cards]);

  const bentoPillars = [
    {
      title: "Lifetime Free (LTF)",
      count: `${stats.ltfCount} cards`,
      desc: "Zero annual fee commitment keepers with real rewards across Amazon, UPI, and travel.",
      href: "/cards?ltf=1",
      icon: ShieldCheck,
      span: "md:col-span-2",
    },
    {
      title: "No-Spend Lounge Access",
      count: `${stats.noSpendLoungeCount} cards`,
      desc: "Domestic airport lounges without quarterly ₹50k–₹1L spend conditions.",
      href: "/cards?noSpendLounge=1",
      icon: Plane,
      span: "md:col-span-1",
    },
    {
      title: "RuPay UPI Scan & Pay",
      count: `${stats.rupayCount} cards`,
      desc: "Link directly in GPay, PhonePe, or BHIM for merchant QR payments.",
      href: "/cards?rupay=1",
      icon: Smartphone,
      span: "md:col-span-1",
    },
    {
      title: "Zero & Low Forex",
      count: `${stats.zeroLowForexCount} cards`,
      desc: "Save 3.5% + GST markup on international flights, SaaS, and overseas POS.",
      href: "/cards?forex=1",
      icon: Globe,
      span: "md:col-span-1",
    },
    {
      title: "Fuel & Commute Savings",
      count: `${stats.fuelCount} cards`,
      desc: "Net post-surcharge savings at BPCL, IndianOil, and HPCL stations.",
      href: "/cards?cat=Fuel",
      icon: Fuel,
      span: "md:col-span-1",
    },
  ];

  return (
    <div className="space-y-16 pb-8">
      {/* PayCard-Inspired Calm Ledger Hero + Fanned Showcase Deck */}
      <section className="relative overflow-hidden border-b border-[#E4E4DF] bg-white">
        {/* Ambient AI Spotlight + Floating Emerald/Gold Sparkles */}
        <SpotlightBeam />
        <SparklesField density={20} color="#0F5C4D" secondaryColor="#9A5B13" className="opacity-55" />
        {/* Subtle hairline architectural ledger grid + soft radial wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(228,228,223,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(228,228,223,0.45) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 72% at 50% 34%, black 42%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 72% at 50% 34%, black 42%, transparent 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[780px] h-[360px] rounded-full opacity-55"
          style={{
            background:
              "radial-gradient(circle, rgba(238,245,242,0.95) 0%, rgba(250,249,246,0.2) 65%, transparent 100%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-12">
          {/* Floating Left & Right Tilted Perk Tiles (PayCard composition, calm colors) */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springGentle, delay: 0.15 }}
            className="hidden lg:flex flex-col gap-5 absolute left-6 top-16 z-10"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Link
                href="/cards?cat=Fuel"
                className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 shadow-[0_8px_22px_rgba(26,29,33,0.06)] -rotate-6 hover:rotate-0 transition-transform"
              >
                <span className="w-8 h-8 rounded-xl bg-[#EEF5F2] flex items-center justify-center">
                  <CanvaFeatureIcon icon="fuel" size={18} />
                </span>
                <div>
                  <span className="block text-[12px] font-medium text-[#1A1D21]">Fuel 7.5%</span>
                  <span className="block text-[11px] text-[#717882]">{stats.fuelCount} cards</span>
                </div>
              </Link>
            </motion.div>

            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 5.1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              className="ml-8"
            >
              <Link
                href="/cards?cat=Golf"
                className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 shadow-[0_8px_22px_rgba(26,29,33,0.06)] rotate-4 hover:rotate-0 transition-transform"
              >
                <span className="w-8 h-8 rounded-xl bg-[#FEF6EA] flex items-center justify-center">
                  <CanvaFeatureIcon icon="golf" size={18} />
                </span>
                <div>
                  <span className="block text-[12px] font-medium text-[#1A1D21]">Golf &amp; Club</span>
                  <span className="block text-[11px] text-[#717882]">Green fee waivers</span>
                </div>
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springGentle, delay: 0.18 }}
            className="hidden lg:flex flex-col gap-5 items-end absolute right-6 top-16 z-10"
          >
            <motion.div
              animate={{ y: [0, -7, 0] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            >
              <Link
                href="/cards?noSpendLounge=1"
                className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 shadow-[0_8px_22px_rgba(26,29,33,0.06)] rotate-6 hover:rotate-0 transition-transform"
              >
                <span className="w-8 h-8 rounded-xl bg-[#F3F6FF] flex items-center justify-center">
                  <CanvaFeatureIcon icon="lounge" size={18} />
                </span>
                <div>
                  <span className="block text-[12px] font-medium text-[#1A1D21]">No-Spend Lounge</span>
                  <span className="block text-[11px] text-[#717882]">
                    {stats.noSpendLoungeCount} cards verified
                  </span>
                </div>
              </Link>
            </motion.div>

            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5.3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="mr-8"
            >
              <Link
                href="/cards?forex=1"
                className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 shadow-[0_8px_22px_rgba(26,29,33,0.06)] -rotate-4 hover:rotate-0 transition-transform"
              >
                <span className="w-8 h-8 rounded-xl bg-[#EEF5F2] flex items-center justify-center">
                  <CanvaFeatureIcon icon="forex" size={18} />
                </span>
                <div>
                  <span className="block text-[12px] font-medium text-[#1A1D21]">0% / Low Forex</span>
                  <span className="block text-[11px] text-[#717882]">
                    {stats.zeroLowForexCount} international picks
                  </span>
                </div>
              </Link>
            </motion.div>
          </motion.div>

          {/* Centered Editorial Headline + Search + Primary CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={calmTransition}
            className="max-w-2xl mx-auto text-center space-y-5 relative z-10"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FAF9F6] border border-[#E4E4DF] text-[12.5px] text-[#4B525C] tabular-nums shadow-[0_1px_2px_rgba(26,29,33,0.03)]">
              <span className="w-2 h-2 rounded-full bg-[#0F5C4D]" aria-hidden="true" />
              <span>{stats.totalCards} Indian credit cards</span>
              <span aria-hidden="true">·</span>
              <span>{stats.totalBanks} issuers</span>
              <span aria-hidden="true">·</span>
              <span>Zero sponsored picks</span>
            </div>

            <h1 className="text-[32px] sm:text-[44px] font-medium tracking-[-0.025em] leading-[1.14] text-[#1A1D21]">
              Find the Right Credit Card{" "}
              <span className="text-[#0F5C4D]">for Every Spend</span>
            </h1>

            <p className="text-[15.5px] sm:text-[16.5px] text-[#4B525C] leading-relaxed max-w-xl mx-auto">
              Compare real post-cap cashback, spend-based lounge conditions, annual fee
              waivers, and <span className="text-[#1A1D21]">r/CreditCardsIndia</span> feedback in
              one calm ledger.
            </p>

            {/* Primary Search Pill + Live Autocomplete */}
            <div className="mt-2 max-w-xl mx-auto relative">
              <form
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <label htmlFor="hero-search" className="sr-only">
                  Search credit cards, banks, or features
                </label>
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-[#717882] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search"
                    type="text"
                    value={searchInput}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setSearchFocused(true);
                    }}
                    placeholder="Search Infinia, Accor ALL, KrisFlyer, zero forex, RuPay UPI..."
                    className="w-full pl-11 pr-4 py-3 text-[14px] text-[#1A1D21] placeholder:text-[#717882] bg-[#FAF9F6] border border-[#C9C9C2] focus:border-[#0F5C4D] focus:bg-white rounded-full focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 text-[14px] font-medium text-white bg-[#0F5C4D] hover:bg-[#0B473B] rounded-full transition-colors cursor-pointer shrink-0 shadow-[0_4px_14px_rgba(15,92,77,0.18)]"
                >
                  {heroIncome || heroStrategy !== "default_inr" ? "Personalized Match" : "Explore Cards"}
                </button>
              </form>

              {searchFocused && searchInput.trim().length >= 2 && heroSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[54px] z-50 bg-white border border-[#E4E4DF] rounded-2xl shadow-[0_16px_40px_rgba(26,29,33,0.12)] overflow-hidden text-left">
                  <div className="px-3.5 py-2 bg-[#FAF9F6] border-b border-[#E4E4DF] flex items-center justify-between text-[11.5px] text-[#717882]">
                    <span>Instant Matches ({heroSuggestions.length})</span>
                    {heroIncome && (
                      <span className="text-[#0F5C4D] font-medium">
                        Ranked for {formatInr(heroIncome)}/mo
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-[#F3F2EE] max-h-[300px] overflow-y-auto">
                    {heroSuggestions.map(({ card, personalized }) => {
                      const spec = CARD_TRANSFER_SPECS[card.card_id];
                      const minInc = normalizeMinMonthlyIncomeInr(
                        card,
                        card.filter_tags.min_income_salaried_inr
                      );
                      return (
                        <Link
                          key={card.card_id}
                          href={`/${card.bank_slug}/${card.card_slug}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#FAF9F6] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="sm" />
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-medium text-[#1A1D21] truncate">
                                {card.card_name}
                              </p>
                              <p className="text-[11.5px] text-[#717882] truncate">
                                {card.bank} · {card.annual_fee_inr === 0 ? "LTF" : `${formatInr(card.annual_fee_inr)}/yr`}
                                {minInc ? ` · ₹${Math.round(minInc / 1000)}k+/mo` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {personalized.matchBadge ? (
                              <span className="text-[11px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-full">
                                {personalized.matchBadge}
                              </span>
                            ) : spec?.supportsAccor ? (
                              <span className="text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-full">
                                Accor ALL
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Inline Personalize Search Bar (Salary + Conversion Strategy) */}
              <div className="mt-3 bg-[#FAF9F6] border border-[#E4E4DF] rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11.5px]">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[#717882] mr-0.5">Salary:</span>
                  {[
                    { v: null as number | null, label: "Any" },
                    { v: 75000, label: "₹75k+" },
                    { v: 150000, label: "₹1.5L+" },
                    { v: 300000, label: "₹3L+" },
                    { v: 500000, label: "₹5L+" },
                  ].map((opt) => {
                    const active = heroIncome === opt.v;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setHeroIncome(opt.v)}
                        className={`px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                          active
                            ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                            : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[#D4D4CE] hidden sm:inline">|</span>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[#717882] mr-0.5">Redeem for:</span>
                  {CONVERSION_STRATEGIES.map((st) => {
                    const active = heroStrategy === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setHeroStrategy(st.id)}
                        className={`px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                          active
                            ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                            : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                        }`}
                      >
                        {st.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <Link
                  href={`/advisor${
                    searchInput.trim() || heroIncome || heroStrategy !== "default_inr"
                      ? `?${new URLSearchParams({
                          ...(searchInput.trim() ? { q: searchInput.trim() } : {}),
                          ...(heroIncome ? { income: String(heroIncome) } : {}),
                          ...(heroStrategy !== "default_inr" ? { strategy: heroStrategy } : {}),
                        }).toString()}`
                      : ""
                  }`}
                  className="inline-flex items-center gap-1.5 text-[#0F5C4D] font-medium hover:underline"
                >
                  <AiOrb3D size="sm" className="scale-[0.72]" />
                  <span>
                    {heroIncome || heroStrategy !== "default_inr"
                      ? "Open in AI Advisor →"
                      : "AI Smart Profiler →"}
                  </span>
                </Link>
              </div>
            </div>

            {/* Quick Action CTA Strip */}
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
              <MovingBorderPill borderRadius="999px" duration={3400}>
                <Link
                  href="/advisor"
                  className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full bg-[#EEF5F2] text-[#0F5C4D] hover:bg-[#E1EDE8] transition-colors font-medium"
                >
                  <AiOrb3D size="sm" className="scale-[0.78]" />
                  <span>Best Card For Me (AI)</span>
                </Link>
              </MovingBorderPill>
              <Link
                href="/advisor?tab=combo"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 text-[#1A1D21] transition-colors"
              >
                <Layers className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                2-Card Combo
              </Link>
              <Link
                href="/my-cards"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 text-[#1A1D21] transition-colors"
              >
                <Wallet className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
                My Cards Matrix
              </Link>
              <Link
                href="/cards?ltf=1"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 text-[#4B525C] hover:text-[#0F5C4D] transition-colors"
              >
                Lifetime Free ({stats.ltfCount})
              </Link>
              <Link
                href="/cards?rupay=1"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 text-[#4B525C] hover:text-[#0F5C4D] transition-colors"
              >
                RuPay UPI ({stats.rupayCount})
              </Link>
            </div>
          </motion.div>

          {/* Interactive Fanned 5-Card Showcase Deck (Desktop Fan + Mobile Horizontal Carousel) */}
          <div className="mt-10 sm:mt-12 relative z-10">
            {/* Desktop Symmetric 5-Card Fanned Deck */}
            <div className="hidden md:flex items-end justify-center pt-4 pb-2">
              {heroDeckCards.map(({ spec, card }, idx) => {
                const isHovered = hoveredDeckIdx === idx;
                const peakPct = Object.entries(card.effective_return_pct_by_category || {})
                  .filter(([k, v]) => k !== "international_forex_net_of_markup" && v > 0)
                  .reduce((max, [, v]) => (v > max ? v : max), 0);

                const bgHex = card.card_theme?.soft_bg_hex || spec.fallbackBg;
                const accentHex = card.card_theme?.primary_hex || spec.fallbackAccent;
                const borderHex = card.card_theme?.border_hex || spec.fallbackBorder;

                return (
                  <motion.div
                    key={spec.id}
                    initial={{ opacity: 0, y: 28, rotate: spec.rotateDeg * 1.15 }}
                    animate={{
                      opacity: 1,
                      y: isHovered ? -18 : spec.translateY,
                      rotate: isHovered ? 0 : spec.rotateDeg,
                      scale: isHovered ? 1.055 : 1,
                    }}
                    transition={{
                      ...springGentle,
                      opacity: { duration: 0.35, delay: 0.06 * idx },
                    }}
                    onMouseEnter={() => setHoveredDeckIdx(idx)}
                    onMouseLeave={() => setHoveredDeckIdx(null)}
                    style={{
                      zIndex: isHovered ? 45 : spec.zIndex,
                      marginLeft: idx === 0 ? 0 : "-22px",
                    }}
                    className="relative"
                  >
                    <Card3DTilt maxTilt={11} glare className="rounded-2xl">
                      <Link
                        href={`/${card.bank_slug}/${card.card_slug}`}
                        className="block w-[212px] lg:w-[228px] h-[278px] rounded-2xl p-4 flex flex-col justify-between transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C4D]"
                        style={{
                          backgroundColor: bgHex,
                          border: `1px solid ${borderHex}`,
                          backgroundImage: `radial-gradient(circle at 88% 12%, ${accentHex}1F 0%, transparent 56%)`,
                          boxShadow: isHovered
                            ? "0 22px 44px rgba(26, 29, 33, 0.16)"
                            : "0 10px 26px rgba(26, 29, 33, 0.08)",
                        }}
                      >
                      {/* Top Category + Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className="inline-block text-[11.5px] font-medium px-2 py-0.5 rounded-md bg-white/85"
                            style={{ color: accentHex }}
                          >
                            {spec.title}
                          </span>
                          <p className="text-[11px] text-[#4B525C] mt-1 line-clamp-1">
                            {spec.subtitle}
                          </p>
                        </div>
                        <span className="w-8 h-8 rounded-full bg-white border border-[#E4E4DF] flex items-center justify-center shrink-0 shadow-[0_2px_6px_rgba(26,29,33,0.05)]">
                          <CanvaFeatureIcon icon={spec.icon} size={16} />
                        </span>
                      </div>

                      {/* Real Indian Card Artwork */}
                      <div className="my-auto flex items-center justify-center py-2">
                        <div className="scale-[1.18] lg:scale-[1.24] drop-shadow-[0_6px_14px_rgba(26,29,33,0.12)]">
                          <CardArtwork
                            localImagePath={card.local_image_path}
                            cardName={card.card_name}
                            bank={card.bank}
                            network={card.card_network}
                            cardTheme={card.card_theme}
                            size="md"
                          />
                        </div>
                      </div>

                      {/* Bottom Card Identity + Return Metric */}
                      <div className="pt-2.5 border-t border-black/8 space-y-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                          <span className="text-[11px] text-[#4B525C] truncate">{card.bank}</span>
                        </div>
                        <p className="text-[13px] font-medium text-[#1A1D21] truncate">
                          {card.card_name}
                        </p>
                        <div className="flex items-center justify-between text-[11.5px] tabular-nums">
                          <span className="text-[#4B525C]">
                            {card.annual_fee_inr === 0 ? "LTF (₹0)" : formatInr(card.annual_fee_inr)}
                          </span>
                          <span className="font-medium" style={{ color: accentHex }}>
                            {peakPct > 0 ? `Up to ${peakPct.toFixed(1)}%` : `${card.card_network}`}
                          </span>
                          </div>
                        </div>
                      </Link>
                    </Card3DTilt>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile Horizontal Swipeable Showcase Deck */}
            <div className="md:hidden flex items-stretch gap-3.5 overflow-x-auto pb-2 snap-x snap-mandatory">
              {heroDeckCards.map(({ spec, card }) => {
                const peakPct = Object.entries(card.effective_return_pct_by_category || {})
                  .filter(([k, v]) => k !== "international_forex_net_of_markup" && v > 0)
                  .reduce((max, [, v]) => (v > max ? v : max), 0);
                const bgHex = card.card_theme?.soft_bg_hex || spec.fallbackBg;
                const accentHex = card.card_theme?.primary_hex || spec.fallbackAccent;
                const borderHex = card.card_theme?.border_hex || spec.fallbackBorder;

                return (
                  <Link
                    key={spec.id}
                    href={`/${card.bank_slug}/${card.card_slug}`}
                    className="snap-start shrink-0 w-[238px] rounded-2xl p-4 flex flex-col justify-between gap-3"
                    style={{
                      backgroundColor: bgHex,
                      border: `1px solid ${borderHex}`,
                      boxShadow: "0 6px 18px rgba(26, 29, 33, 0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[11.5px] font-medium px-2 py-0.5 rounded-md bg-white/90"
                        style={{ color: accentHex }}
                      >
                        {spec.title}
                      </span>
                      <span className="w-7 h-7 rounded-full bg-white border border-[#E4E4DF] flex items-center justify-center shrink-0">
                        <CanvaFeatureIcon icon={spec.icon} size={15} />
                      </span>
                    </div>

                    <div className="flex justify-center py-1">
                      <CardArtwork
                        localImagePath={card.local_image_path}
                        cardName={card.card_name}
                        bank={card.bank}
                        network={card.card_network}
                        cardTheme={card.card_theme}
                        size="md"
                      />
                    </div>

                    <div className="pt-2 border-t border-black/8 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                        <span className="text-[11px] text-[#4B525C] truncate">{card.bank}</span>
                      </div>
                      <p className="text-[13.5px] font-medium text-[#1A1D21] truncate">
                        {card.card_name}
                      </p>
                      <div className="flex items-center justify-between text-[11.5px] tabular-nums">
                        <span className="text-[#4B525C]">
                          {card.annual_fee_inr === 0 ? "LTF (₹0)" : formatInr(card.annual_fee_inr)}
                        </span>
                        <span className="font-medium" style={{ color: accentHex }}>
                          {peakPct > 0 ? `Up to ${peakPct.toFixed(1)}%` : card.card_network}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 3D Card Studio + Visual Tool Hubs */}
      {heroDeckCards.length > 0 && (() => {
        const activeStudio = heroDeckCards[studioIdx % heroDeckCards.length] || heroDeckCards[0];
        const sc = activeStudio.card;
        const peakStudioPct = Object.entries(sc.effective_return_pct_by_category || {})
          .filter(([k, v]) => k !== "international_forex_net_of_markup" && v > 0)
          .reduce((max, [, v]) => (v > max ? v : max), 0);
        return (
          <motion.section
            {...sectionRevealProps}
            className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
          >
            {/* Interactive 3D Physical Card Inspector */}
            <div className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-[#CBE0D7] bg-white p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6 shadow-[0_10px_30px_rgba(15,92,77,0.06)]">
              <SparklesField density={12} color="#0F5C4D" secondaryColor="#9A5B13" className="opacity-35" />
              <div className="relative z-10 w-full sm:w-[270px] shrink-0 flex justify-center">
                <Interactive3DCardModel
                  key={sc.card_id}
                  localImagePath={sc.local_image_path}
                  cardName={sc.card_name}
                  bank={sc.bank}
                  network={sc.card_network}
                  tier={sc.card_tier}
                  annualFeeLabel={sc.annual_fee_inr === 0 ? "Lifetime Free (₹0)" : formatInr(sc.annual_fee_inr)}
                  loungeLabel={sc.domestic_lounge_summary || "See lounge rules"}
                  rewardHighlight={peakStudioPct > 0 ? `Up to ${peakStudioPct.toFixed(1)}% real return` : sc.primary_category}
                  cardTheme={sc.card_theme}
                  compact
                />
              </div>

              <div className="relative z-10 flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <AiOrb3D size="sm" />
                  <span className="text-[11.5px] font-medium uppercase tracking-wider text-[#0F5C4D]">
                    Card Spotlight
                  </span>
                </div>
                <h2 className="text-[19px] sm:text-[21px] font-medium text-[#1A1D21] leading-snug">
                  Explore {sc.card_name}
                </h2>
                <p className="text-[13px] text-[#4B525C] leading-relaxed">
                  High-resolution card artwork, live category yield breakdown, spend caps &amp; lounge eligibility across {cards.length} Indian cards.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {heroDeckCards.map((item, idx) => {
                    const selected = idx === (studioIdx % heroDeckCards.length);
                    return (
                      <button
                        key={item.spec.id}
                        type="button"
                        onClick={() => setStudioIdx(idx)}
                        className={`px-2.5 py-1 rounded-full text-[11.5px] border transition-colors cursor-pointer ${
                          selected
                            ? "bg-[#0F5C4D] border-[#0F5C4D] text-white font-medium"
                            : "bg-[#FAF9F6] border-[#E4E4DF] text-[#4B525C] hover:border-[#0F5C4D]/45"
                        }`}
                      >
                        {item.spec.title.split("&")[0].trim()}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1">
                  <Link
                    href={`/${sc.bank_slug}/${sc.card_slug}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0F5C4D] hover:underline"
                  >
                    Open Full Dossier for {sc.card_name}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Right Visual Tool Tiles */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <Link
                href="/lounges"
                className="group relative overflow-hidden rounded-2xl border border-[#E4E4DF] bg-white hover:border-[#0F5C4D]/50 transition-all flex items-stretch min-h-[126px]"
              >
                <div className="w-[120px] sm:w-[136px] shrink-0 relative overflow-hidden bg-[#F3F2EE]">
                  <img
                    src={resolveMediaUrl("/illustrations/airport-lounge-hero.webp") || "/illustrations/airport-lounge-hero.webp"}
                    alt="Airport lounge visual"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 flex flex-col justify-center min-w-0">
                  <span className="text-[11px] font-medium text-[#0F5C4D] uppercase tracking-wider">
                    Airport Lounges
                  </span>
                  <h3 className="text-[15px] font-medium text-[#1A1D21] mt-0.5">
                    DEL, BOM &amp; BLR Lounge Checker
                  </h3>
                  <p className="text-[12px] text-[#4B525C] mt-1 line-clamp-2">
                    Check which cards in your wallet unlock access today.
                  </p>
                </div>
              </Link>

              <Link
                href="/calculator"
                className="group relative overflow-hidden rounded-2xl border border-[#E4E4DF] bg-white hover:border-[#0F5C4D]/50 transition-all flex items-stretch min-h-[126px]"
              >
                <div className="w-[120px] sm:w-[136px] shrink-0 relative overflow-hidden bg-[#FAF9F6]">
                  <img
                    src={resolveMediaUrl("/illustrations/rewards-compass-3d.webp") || "/illustrations/rewards-compass-3d.webp"}
                    alt="3D rewards and air miles calculator visual"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 flex flex-col justify-center min-w-0">
                  <span className="text-[11px] font-medium text-[#9A5B13] uppercase tracking-wider">
                    Cashback &amp; Air Miles
                  </span>
                  <h3 className="text-[15px] font-medium text-[#1A1D21] mt-0.5">
                    Rupee Spend &amp; Accor Studio
                  </h3>
                  <p className="text-[12px] text-[#4B525C] mt-1 line-clamp-2">
                    Calculate net ₹ returns after caps &amp; Air Miles conversions.
                  </p>
                </div>
              </Link>
            </div>
          </motion.section>
        );
      })()}

      {/* Category Quick Rail -> Smooth Left-Rail Split on Click */}
      <motion.section
        {...sectionRevealProps}
        className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[17px] font-medium text-[#1A1D21]">
              Explore by Card Category
            </h2>
            {selectedCat && (
              <button
                type="button"
                onClick={() => setSelectedCat(null)}
                className="inline-flex items-center gap-1 text-[12px] text-[#4B525C] hover:text-[#1A1D21] bg-[#F3F2EE] border border-[#E4E4DF] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                Reset view
              </button>
            )}
          </div>
          <Link href="/categories" className="text-[13px] font-medium text-[#0F5C4D] hover:underline">
            All 13 category guides →
          </Link>
        </div>

        <motion.div
          layout
          transition={calmTransition}
          className={selectedCat ? "grid grid-cols-1 lg:grid-cols-12 gap-5 items-start" : ""}
        >
          <motion.div
            layout
            transition={calmTransition}
            className={
              selectedCat
                ? "lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible bg-white border border-[#E4E4DF] rounded-xl p-2.5 lg:sticky lg:top-20"
                : "flex flex-wrap items-center gap-2"
            }
          >
            {QUICK_CATEGORIES.map((c) => {
              const isSelected = selectedCat === c.dataset;
              return (
                <motion.button
                  layout
                  transition={fastTransition}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  key={c.dataset}
                  type="button"
                  onClick={() => setSelectedCat(isSelected ? null : c.dataset)}
                  aria-pressed={isSelected}
                  className={`shrink-0 inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-colors cursor-pointer ${
                    selectedCat ? "lg:w-full" : ""
                  } ${
                    isSelected
                      ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                      : "bg-[#F3F6FF]/65 border-[#D7E2FF] hover:border-[#0F5C4D] hover:bg-[#EEF5F2] text-[#1A1D21] hover:text-[#0F5C4D]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(c.dataset)} size={16} />
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span
                    className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded ${
                      isSelected ? "bg-white/20 text-white" : "bg-white/80 text-[#717882]"
                    }`}
                  >
                    {categoryCounts[c.dataset] ?? 0}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            {selectedCat && (
              <motion.div
                key={selectedCat}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={calmTransition}
                className="lg:col-span-9 space-y-4"
              >
                <div className="bg-white border border-[#E4E4DF] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(selectedCat)} size={20} />
                    <div className="min-w-0">
                      <h3 className="text-[15.5px] font-medium text-[#1A1D21] truncate">
                        {selectedCat} Cards ({categoryCounts[selectedCat] ?? selectedCatCards.length})
                      </h3>
                      <p className="text-[12.5px] text-[#717882]">
                        Top-rated active cards in {selectedCat} sorted by overall rating
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/cards?cat=${encodeURIComponent(selectedCat)}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EDE8] px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    Open all {categoryCounts[selectedCat] ?? ""} cards
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {selectedCatCards.map((card) => (
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.section>

      {/* Consumer Intent Pillars Bento Grid */}
      <motion.section
        {...sectionRevealProps}
        className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.015em] text-[#1A1D21]">
              Browse by what you actually spend on
            </h2>
            <p className="text-[14px] text-[#4B525C] mt-1">
              Curated slices across all {stats.totalCards} cards with zero sponsored placements.
            </p>
          </div>
          <Link
            href="/cards"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#0F5C4D] hover:underline"
          >
            View all {stats.totalCards} cards
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bentoPillars.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href={item.href}
                className={`${item.span} group bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/50 hover:shadow-[0_10px_28px_rgba(26,29,33,0.05)] rounded-xl p-5 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between gap-4`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EEF5F2] text-[#0F5C4D] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Icon className="w-4.5 h-4.5" aria-hidden="true" />
                  </div>
                  <span className="text-[12px] text-[#4B525C] bg-[#F3F2EE] px-2.5 py-1 rounded-md tabular-nums">
                    {item.count}
                  </span>
                </div>
                <div>
                  <h3 className="text-[16.5px] font-medium text-[#1A1D21] group-hover:text-[#0F5C4D] transition-colors flex items-center justify-between">
                    <span>{item.title}</span>
                    <ArrowRight className="w-4 h-4 text-[#717882] group-hover:text-[#0F5C4D] group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </h3>
                  <p className="text-[13.5px] text-[#4B525C] leading-relaxed mt-1.5">
                    {item.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.section>

      {/* Animated Tabs — Highest-Rated Cards by Category */}
      <motion.section
        {...sectionRevealProps}
        className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-medium tracking-[-0.015em] text-[#1A1D21]">
              Highest-rated cards by category
            </h2>
            <p className="text-[14px] text-[#4B525C] mt-1">
              Ranked using net post-cap reward math, editorial ratings, and community sentiment.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Category spotlight tabs"
            className="flex items-center gap-1 p-1 bg-[#F3F2EE] border border-[#E4E4DF] rounded-xl overflow-x-auto"
          >
            {SPOTLIGHT_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3.5 py-1.5 text-[13px] rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    isActive ? "text-[#1A1D21]" : "text-[#4B525C] hover:text-[#1A1D21]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="home-spotlight-pill"
                      transition={springGentle}
                      className="absolute inset-0 bg-white border border-[#E4E4DF] rounded-lg shadow-[0_1px_2px_rgba(26,29,33,0.05)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {tabCards.map((card) => (
              <motion.div
                key={`${activeTab}-${card.card_id}`}
                layout="position"
                initial={{ opacity: 0, scale: 0.97, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={fastTransition}
                className="h-full"
              >
                <LedgerCardItem card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* Latest Bank & Card Offers */}
      {latestOffers.length > 0 && (
        <motion.section
          {...sectionRevealProps}
          className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
                <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                Direct Issuer Portals · {offerBanks.length} Major Banks
              </span>
              <h2 className="text-[22px] font-medium tracking-[-0.015em] text-[#1A1D21] mt-2">
                Latest Bank &amp; Card Offers
              </h2>
              <p className="text-[14px] text-[#4B525C] mt-0.5">
                Current official card discounts, cashback promos, and dining deals directly from bank portals.
              </p>
            </div>
            <Link href="/cards" className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0">
              Browse cards by bank →
            </Link>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedOfferBank("all")}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] border transition-colors cursor-pointer ${
                selectedOfferBank === "all"
                  ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                  : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
              }`}
            >
              All Issuers ({latestOffers.length})
            </button>
            {offerBanks.map((bankName) => {
              const active = selectedOfferBank === bankName;
              return (
                <button
                  key={bankName}
                  type="button"
                  onClick={() => setSelectedOfferBank(active ? "all" : bankName)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                      : "bg-white border-[#E4E4DF] text-[#4B525C] hover:border-[#C9C9C2]"
                  }`}
                >
                  <BankLogo bank={bankName} size="xs" />
                  <span>{bankName}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {visibleOffers.map((offer) => (
                <motion.div
                  key={offer.offer_id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={fastTransition}
                  className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/45 hover:-translate-y-0.5 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded-md">
                        <BankLogo bank={offer.bank} size="xs" />
                        <span>{offer.bank}</span>
                      </span>
                      <span className="text-[11.5px] text-[#717882] truncate">
                        {offer.category}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-medium text-[#1A1D21] leading-snug">
                      {offer.title}
                    </h3>
                    {offer.summary && offer.summary !== offer.title && (
                      <p className="text-[13px] text-[#4B525C] line-clamp-2 leading-relaxed">
                        {offer.summary}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E4E4DF] flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[#717882] truncate">{offer.valid_till}</span>
                    {offer.offer_url && (
                      <a
                        href={offer.offer_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1 font-medium text-[#0F5C4D] hover:underline shrink-0"
                      >
                        Official Offer
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Interactive Spend Calculator & Advisor Split Callout */}
      <motion.section
        {...sectionRevealProps}
        className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-5"
      >
        <div className="bg-white border border-[#E4E4DF] rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Personalized Matching + 2-Card Combo
            </span>
            <h2 className="text-[21px] font-medium tracking-[-0.015em] text-[#1A1D21]">
              Get personalized card picks for your salary &amp; CIBIL
            </h2>
            <p className="text-[14px] text-[#4B525C] leading-relaxed">
              Match your income, CIBIL score, and Grocery/Fuel/Shopping spends to see
              likelihood of approval, net annual ₹ value after waiver, or test an optimal
              2-card combo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/advisor"
              className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 text-[13.5px] font-medium text-white bg-[#0F5C4D] hover:bg-[#0B473B] rounded-xl transition-colors"
            >
              Find Best Card For Me
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/my-cards"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EDE8] rounded-xl transition-colors"
            >
              Optimize My Cards
            </Link>
            <Link
              href="/advisor?tab=combo"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] text-[#1A1D21] bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#C9C9C2] rounded-xl transition-colors"
            >
              2-Card Combo
            </Link>
          </div>
        </div>

        <div className="bg-white border border-[#E4E4DF] rounded-2xl p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              12-Bucket Real Cashback Engine
            </span>
            <h2 className="text-[21px] font-medium tracking-[-0.015em] text-[#1A1D21]">
              Calculate real rupee savings across all {stats.totalCards} cards
            </h2>
            <p className="text-[14px] text-[#4B525C] leading-relaxed">
              Enter your exact monthly spend across Groceries, Swiggy, Amazon, UPI, Fuel,
              Utilities, and Forex to compare real post-fee annual ₹ profit side by side.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/calculator"
              className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 text-[13.5px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EDE8] rounded-xl transition-colors"
            >
              Open Cashback Calculator
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/calculator?preset=salaried"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] text-[#1A1D21] bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#C9C9C2] rounded-xl transition-colors"
            >
              Try ₹50k/mo Household Preset
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Banks & Recent Devaluations Split */}
      <motion.section
        {...sectionRevealProps}
        className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Top Issuers */}
        <div className="lg:col-span-7 bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-medium text-[#1A1D21] flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-[#0F5C4D]" aria-hidden="true" />
              Major Indian Card Issuers
            </h2>
            <Link href="/banks" className="text-[13px] text-[#0F5C4D] hover:underline">
              All {stats.totalBanks} banks →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {banks.slice(0, 9).map((b) => (
              <Link
                key={b.bank_slug}
                href={`/cards?bank=${b.bank_slug}`}
                className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#0F5C4D]/45 hover:bg-[#EEF5F2]/50 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BankLogo bankSlug={b.bank_slug} bank={b.bank} size="sm" />
                  <p className="text-[13.5px] font-medium text-[#1A1D21] truncate">
                    {b.bank}
                  </p>
                </div>
                <p className="text-[12px] text-[#717882] mt-1.5 tabular-nums">
                  {b.total_cards} cards · {b.ltf_count} LTF
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Latest Devaluations */}
        <div className="lg:col-span-5 bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-medium text-[#1A1D21] flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-[#9A5B13]" aria-hidden="true" />
              Recent Devaluation Alerts
            </h2>
            <Link href="/devaluations" className="text-[13px] text-[#0F5C4D] hover:underline">
              Full timeline →
            </Link>
          </div>

          <div className="divide-y divide-[#F3F2EE]">
            {recentDevaluations.slice(0, 3).map((ev, idx) => {
              const isOpen = expandedDevalIdx === idx;
              return (
                <div key={`${ev.date}-${ev.issuer}-${idx}`} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedDevalIdx(isOpen ? null : idx)}
                    className="w-full text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#1A1D21] group-hover:text-[#0F5C4D] transition-colors">
                        <BankLogo bank={ev.issuer} size="xs" />
                        <span>{ev.issuer}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#FEF6EA] text-[#9A5B13] tabular-nums">
                        {ev.date} · {ev.severity}
                      </span>
                    </div>
                    <p
                      className={`text-[13px] text-[#4B525C] leading-relaxed mt-1 ${
                        isOpen ? "" : "line-clamp-2"
                      }`}
                    >
                      {ev.summary}
                    </p>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={fastTransition}
                        className="overflow-hidden"
                      >
                        <div className="mt-2.5 p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E4DF] space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {(ev.cards_affected || []).map((cName) => (
                              <Link
                                key={cName}
                                href={`/devaluations?issuer=${encodeURIComponent(ev.issuer)}&q=${encodeURIComponent(cName)}`}
                                className="text-[11px] bg-white hover:bg-[#EEF5F2] border border-[#E4E4DF] hover:border-[#0F5C4D] text-[#1A1D21] hover:text-[#0F5C4D] px-2 py-0.5 rounded-full transition-colors"
                              >
                                {cName} →
                              </Link>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] text-[#717882]">
                            <span>{ev.source_ref || "Official Bank T&C"}</span>
                            <Link
                              href={`/devaluations?issuer=${encodeURIComponent(ev.issuer)}`}
                              className="text-[#0F5C4D] font-medium hover:underline"
                            >
                              Full impact summary →
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#E4E4DF] flex items-center justify-between text-[12.5px] text-[#4B525C]">
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#717882]" aria-hidden="true" />
              Includes Nov 2026 ICICI, HSBC &amp; YES updates
            </span>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
