"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Menu,
  Scale,
  Search,
  SlidersHorizontal,
  Table2,
  Wallet,
  X,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useCompare } from "./CompareContext";
import type { CardSummaryItem, SearchIndexPayload } from "@/lib/types";
import { formatInr, matchesTokenizedQuery } from "@/lib/format";
import { calmTransition, fastTransition, modalSurfaceVariants } from "@/lib/motion";
import { BankLogo } from "./BankLogo";
import { GooeySearchInput } from "./ui/gooey-input";
import { CometCard } from "./ui/comet-card";
import { useExpandableCard } from "./ui/expandable-card";

const NAV_LINKS = [
  { href: "/categories", label: "Categories" },
  { href: "/merchants", label: "Merchants" },
  { href: "/advisor", label: "Advisor" },
  { href: "/cards", label: "Cards" },
  { href: "/calculator", label: "Calculator" },
  { href: "/lounges", label: "Lounge & Golf" },
  { href: "/help", label: "Help & PNO" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { items, savedIds, ownedIds } = useCompare();
  const { openCard } = useExpandableCard();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [inlineFocused, setInlineFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CardSummaryItem[]>([]);
  const inlineWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setSearchModalOpen(false);
        setInlineFocused(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (inlineWrapRef.current && !inlineWrapRef.current.contains(e.target as Node)) {
        setInlineFocused(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if ((!searchModalOpen && !inlineFocused) || cards.length > 0) return;
    fetch("/data/search-index.json")
      .then((res) => res.json())
      .then((data: SearchIndexPayload) => setCards(data.cards || []))
      .catch(() => {});
  }, [searchModalOpen, inlineFocused, cards.length]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return cards.slice(0, 7);
    return cards
      .filter((c) => {
        const hay = `${c.card_name} ${c.bank} ${c.primary_category} ${c.categories.join(" ")} ${(c.filter_tags?.requirement_keywords || []).join(" ")} ${(c.filter_tags?.best_for_tags || []).join(" ")}`;
        return matchesTokenizedQuery(hay, q);
      })
      .slice(0, 8);
  }, [cards, query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchModalOpen(false);
    setInlineFocused(false);
    router.push(`/cards?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-30 w-full transition-all duration-200 ${
          scrolled
            ? "bg-[#FAF9F6]/94 backdrop-blur-md border-b border-[#E4E4DF] py-2.5 shadow-[0_4px_20px_rgba(26,29,33,0.04)]"
            : "bg-[#FAF9F6]/88 backdrop-blur-sm border-b border-[#E4E4DF]/75 py-3"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Left: Brand + Primary Nav Links */}
          <div className="flex items-center gap-3 lg:gap-5 min-w-0">
            <Link
              href="/"
              prefetch={false}
              className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C4D] rounded-md"
            >
              <BrandLogo />
            </Link>

            <nav aria-label="Primary" className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className={`relative inline-flex items-center gap-1 px-2.5 py-1.5 text-[13.5px] rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? "text-[#0F5C4D] bg-[#EEF5F2]"
                        : "text-[#4B525C] hover:text-[#1A1D21] hover:bg-[#F3F2EE]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="header-active-nav"
                        transition={fastTransition}
                        className="absolute inset-0 bg-[#EEF5F2] rounded-lg -z-10"
                      />
                    )}
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Utility Actions — Top-right Search next to My Cards & Compare */}
          <div className="flex items-center gap-2 shrink-0">
            {pathname !== "/" && (
              <div ref={inlineWrapRef} className="relative hidden md:flex items-center justify-end shrink-0">
                <form
                  onSubmit={handleSearchSubmit}
                  onFocus={() => setInlineFocused(true)}
                >
                  <GooeySearchInput
                    mode="morph"
                    compactVariant="outline"
                    compactSize="sm"
                    open={inlineFocused}
                    onOpenChange={setInlineFocused}
                    compactLabel=""
                    collapsedWidth={36}
                    expandedWidth={290}
                    value={query}
                    onValueChange={(val) => {
                      setQuery(val);
                      setInlineFocused(true);
                    }}
                    onSubmit={() => {
                      setSearchModalOpen(false);
                      setInlineFocused(false);
                      router.push(`/cards?q=${encodeURIComponent(query.trim())}`);
                    }}
                    placeholder="Search cards, banks, perks..."
                    ariaLabel="Search credit cards, banks, and offers"
                    rightSlot={
                      <span className="flex items-center gap-1 shrink-0">
                        {!query && (
                          <kbd className="hidden xl:inline-block text-[10.5px] text-[#717882] bg-[#F3F2EE] px-1.5 py-0.5 rounded">
                            ⌘K
                          </kbd>
                        )}
                        <Link
                          href={query.trim() ? `/cards?q=${encodeURIComponent(query.trim())}` : "/cards"}
                          title="Open advanced card filters"
                          aria-label="Open card directory filters"
                          className="p-1 rounded-full text-[#4B525C] hover:text-[#0F5C4D] hover:bg-[#EEF5F2] transition-colors shrink-0"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </span>
                    }
                  />
                </form>

                {/* Live Search Popover with CometCard results + Quick Table trigger */}
                <AnimatePresence>
                  {inlineFocused && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.99 }}
                      transition={fastTransition}
                      className="absolute right-0 top-[calc(100%+8px)] w-[360px] bg-white border border-[#C9C9C2] rounded-2xl shadow-[0_14px_34px_rgba(26,29,33,0.12)] overflow-hidden z-40"
                    >
                      <div className="max-h-[340px] overflow-y-auto p-2 space-y-1.5">
                        {results.length === 0 ? (
                          <p className="py-6 text-center text-[13px] text-[#717882]">
                            No cards matched &ldquo;{query}&rdquo;.
                          </p>
                        ) : (
                          results.map((c) => (
                            <CometCard key={c.card_id} rotateDepth={4} translateDepth={3}>
                              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[#EFEFE9] bg-white hover:border-[#0F5C4D]/40 transition-colors">
                                <Link
                                  href={`/${c.bank_slug}/${c.card_slug}`}
                                  onClick={() => setInlineFocused(false)}
                                  className="flex items-center gap-2.5 min-w-0 flex-1"
                                >
                                  <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-medium text-[#1A1D21] truncate">
                                      {c.card_name}
                                    </p>
                                    <p className="text-[11.5px] text-[#717882] truncate">
                                      {c.bank} · {c.primary_category}
                                    </p>
                                  </div>
                                </Link>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInlineFocused(false);
                                      openCard(c);
                                    }}
                                    title="Quick tables & summary"
                                    className="p-1.5 rounded-lg border border-[#E4E4DF] bg-[#FAF9F6] text-[#0F5C4D] hover:bg-[#EEF5F2] transition-colors cursor-pointer"
                                  >
                                    <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  </button>
                                  <span className="text-[11.5px] text-[#0F5C4D] bg-[#EEF5F2] px-2 py-0.5 rounded tabular-nums">
                                    {c.annual_fee_inr === 0 ? "LTF" : formatInr(c.annual_fee_inr)}
                                  </span>
                                </div>
                              </div>
                            </CometCard>
                          ))
                        )}
                      </div>
                      <div className="bg-[#FAF9F6] border-t border-[#E4E4DF] px-3.5 py-2 flex items-center justify-between text-[11.5px] text-[#717882]">
                        <span>Enter for all matches</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineFocused(false);
                            router.push(`/cards?q=${encodeURIComponent(query.trim())}`);
                          }}
                          className="text-[#0F5C4D] hover:underline cursor-pointer"
                        >
                          View full directory →
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {pathname !== "/" && (
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="md:hidden inline-flex items-center justify-center w-9 h-9 bg-white border border-[#E4E4DF] hover:border-[#C9C9C2] text-[#0F5C4D] rounded-full transition-colors cursor-pointer"
                aria-label="Search cards (Cmd+K)"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
              </button>
            )}

            <Link
              href="/my-cards"
              prefetch={false}
              className={`inline-flex items-center gap-1.5 h-9 px-3 text-[13px] rounded-full border transition-colors whitespace-nowrap ${
                pathname === "/my-cards"
                  ? "bg-[#0F5C4D] border-[#0F5C4D] text-white"
                  : "bg-white border-[#E4E4DF] hover:border-[#C9C9C2] text-[#1A1D21]"
              }`}
            >
              <Wallet
                className={`w-3.5 h-3.5 ${pathname === "/my-cards" ? "text-white" : "text-[#0F5C4D]"}`}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">My Cards</span>
              {ownedIds.length > 0 && (
                <span
                  className={`text-[11px] px-1.5 rounded-full tabular-nums ${
                    pathname === "/my-cards"
                      ? "bg-white/20 text-white"
                      : "bg-[#EEF5F2] text-[#0F5C4D]"
                  }`}
                >
                  {ownedIds.length}
                </span>
              )}
            </Link>

            <Link
              prefetch={false}
              href={
                items.length > 0
                  ? `/compare?ids=${encodeURIComponent(items.map((i) => i.card_id).join(","))}`
                  : "/compare"
              }
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-[13px] text-[#1A1D21] bg-white border border-[#E4E4DF] hover:border-[#C9C9C2] rounded-full transition-colors whitespace-nowrap"
            >
              <Scale className="w-3.5 h-3.5 text-[#0F5C4D]" aria-hidden="true" />
              <span>Compare</span>
              {items.length > 0 && (
                <span className="text-[11px] bg-[#EEF5F2] text-[#0F5C4D] px-1.5 rounded-full tabular-nums">
                  {items.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((p) => !p)}
              aria-label="Toggle navigation menu"
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#E4E4DF] bg-white text-[#1A1D21] cursor-pointer"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tablet/Mobile Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={calmTransition}
              className="lg:hidden overflow-hidden border-t border-[#E4E4DF] bg-[#FAF9F6]"
            >
              <nav className="px-4 py-3 flex flex-col gap-1">
                {NAV_LINKS.map((link) => {
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`px-3 py-2.5 rounded-lg text-[14.5px] ${
                        active
                          ? "bg-[#EEF5F2] text-[#0F5C4D] font-medium"
                          : "text-[#1A1D21] hover:bg-[#F3F2EE]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <Link
                  href="/banks"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14.5px] text-[#1A1D21] hover:bg-[#F3F2EE]"
                >
                  All Card Issuers (Banks)
                </Link>
                <Link
                  href="/advisor?tab=saved"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14.5px] text-[#1A1D21] hover:bg-[#F3F2EE]"
                >
                  Saved Watchlist ({savedIds.length})
                </Link>
                <Link
                  href="/devaluations"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14.5px] text-[#1A1D21] hover:bg-[#F3F2EE]"
                >
                  Devaluation Tracker
                </Link>
                <Link
                  href="/compare"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-[14.5px] text-[#1A1D21] hover:bg-[#F3F2EE]"
                >
                  Side-by-Side Compare ({items.length})
                </Link>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Command Search Dialog (Cmd+K / Mobile) */}
      <AnimatePresence>
        {searchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchModalOpen(false)}
              className="fixed inset-0 bg-[#1A1D21]/30 backdrop-blur-[2px]"
            />
            <motion.div
              variants={modalSurfaceVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-label="Quick credit card search"
              className="relative w-full max-w-xl bg-white border border-[#C9C9C2] rounded-xl shadow-[0_16px_40px_rgba(26,29,33,0.14)] overflow-hidden"
            >
              <form onSubmit={handleSearchSubmit} className="p-3 border-b border-[#E4E4DF] bg-[#FAF9F6]">
                <GooeySearchInput
                  mode="bar"
                  value={query}
                  onValueChange={setQuery}
                  onSubmit={() => {
                    setSearchModalOpen(false);
                    router.push(`/cards?q=${encodeURIComponent(query.trim())}`);
                  }}
                  placeholder="Search HDFC Regalia, zero forex, RuPay UPI, SBI Cashback..."
                  ariaLabel="Search cards in command palette"
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setSearchModalOpen(false)}
                      aria-label="Close search"
                      className="text-[11.5px] text-[#717882] hover:text-[#1A1D21] px-2 py-0.5 rounded bg-[#F3F2EE] cursor-pointer"
                    >
                      Esc
                    </button>
                  }
                />
              </form>

              <div className="max-h-[360px] overflow-y-auto p-2.5 space-y-1.5">
                {results.length === 0 ? (
                  <p className="py-8 text-center text-[13.5px] text-[#717882]">
                    No cards matched &ldquo;{query}&rdquo;. Try bank name or category.
                  </p>
                ) : (
                  results.map((c) => (
                    <CometCard key={c.card_id} rotateDepth={4} translateDepth={3}>
                      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-[#EFEFE9] bg-white hover:border-[#0F5C4D]/40 transition-colors">
                        <Link
                          href={`/${c.bank_slug}/${c.card_slug}`}
                          onClick={() => setSearchModalOpen(false)}
                          className="flex items-center gap-2.5 min-w-0 flex-1"
                        >
                          <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="sm" />
                          <div className="min-w-0">
                            <p className="text-[14px] font-medium text-[#1A1D21] truncate">
                              {c.card_name}
                            </p>
                            <p className="text-[12px] text-[#717882] truncate">
                              {c.bank} · {c.primary_category}
                            </p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchModalOpen(false);
                              openCard(c);
                            }}
                            title={`Quick tables for ${c.card_name}`}
                            className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-lg border border-[#E4E4DF] bg-[#FAF9F6] text-[#0F5C4D] hover:bg-[#EEF5F2] cursor-pointer"
                          >
                            <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Tables</span>
                          </button>
                          <span className="text-[12px] text-[#4B525C] tabular-nums shrink-0">
                            {c.annual_fee_inr === 0 ? "LTF" : formatInr(c.annual_fee_inr)}
                          </span>
                        </div>
                      </div>
                    </CometCard>
                  ))
                )}
              </div>

              <div className="bg-[#FAF9F6] border-t border-[#E4E4DF] px-4 py-2.5 flex items-center justify-between text-[12px] text-[#717882]">
                <span>Press Enter to see all results in directory</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchModalOpen(false);
                    router.push(`/cards?q=${encodeURIComponent(query.trim())}`);
                  }}
                  className="text-[#0F5C4D] hover:underline cursor-pointer"
                >
                  Open full filter view →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
