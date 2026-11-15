"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  MessageSquareQuote,
  Plane,
  QrCode,
  Search,
  ShieldAlert,
  Star,
  Wallet,
} from "lucide-react";
import type {
  CardSummaryItem,
  GolfClubSpot,
  ParticipatingAirportLoungeSpot,
} from "@/lib/types";
import { formatFeeDisplay } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { BankLogo } from "./BankLogo";
import { useCompare } from "./CompareContext";

interface LoungeDetailClientProps {
  loungeSpot: ParticipatingAirportLoungeSpot | null;
  golfClub: GolfClubSpot | null;
  allCards: CardSummaryItem[];
}

export function LoungeDetailClient({
  loungeSpot,
  golfClub,
  allCards,
}: LoungeDetailClientProps) {
  const { ownedIds } = useCompare();
  const isGolf = Boolean(golfClub);
  const venue = loungeSpot || golfClub;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [cardQuery, setCardQuery] = useState("");
  const [showHighSpendCards, setShowHighSpendCards] = useState(false);

  const cardsById = useMemo(() => {
    const map = new Map<string, CardSummaryItem>();
    for (const c of allCards) {
      map.set(c.card_id, c);
    }
    return map;
  }, [allCards]);

  const photos = useMemo(() => {
    if (!venue) return [];
    const list =
      venue.gallery_photos && venue.gallery_photos.length > 0
        ? venue.gallery_photos
        : venue.local_photo_path
          ? [venue.local_photo_path]
          : [];
    return list.slice(0, 6);
  }, [venue]);

  const cardBuckets = useMemo(() => {
    if (!venue) {
      return {
        noSpendCards: [] as CardSummaryItem[],
        lowSpendCards: [] as CardSummaryItem[],
        highSpendCards: [] as CardSummaryItem[],
      };
    }

    const resolve = (ids: string[] | undefined) =>
      (ids || [])
        .map((id) => cardsById.get(id))
        .filter((c): c is CardSummaryItem => Boolean(c));

    if (loungeSpot) {
      return {
        noSpendCards: resolve(loungeSpot.eligible_no_spend_card_ids),
        lowSpendCards: resolve(loungeSpot.eligible_low_spend_card_ids),
        highSpendCards: resolve(loungeSpot.eligible_high_spend_card_ids),
      };
    }

    return {
      noSpendCards: resolve(golfClub?.eligible_no_spend_card_ids),
      lowSpendCards: [] as CardSummaryItem[],
      highSpendCards: resolve(golfClub?.eligible_high_spend_card_ids),
    };
  }, [venue, loungeSpot, golfClub, cardsById]);

  const myCardsVerdict = useMemo(() => {
    const ownedCards = ownedIds
      .map((id) => cardsById.get(id))
      .filter((c): c is CardSummaryItem => Boolean(c));

    const noSpendSet = new Set(cardBuckets.noSpendCards.map((c) => c.card_id));
    const lowSpendSet = new Set(cardBuckets.lowSpendCards.map((c) => c.card_id));
    const highSpendSet = new Set(cardBuckets.highSpendCards.map((c) => c.card_id));

    return {
      ownedCount: ownedCards.length,
      freeAccess: ownedCards.filter((c) => noSpendSet.has(c.card_id)),
      lowSpendAccess: ownedCards.filter((c) => lowSpendSet.has(c.card_id)),
      highSpendAccess: ownedCards.filter((c) => highSpendSet.has(c.card_id)),
    };
  }, [ownedIds, cardsById, cardBuckets]);

  const filteredPrimaryCards = useMemo(() => {
    const combined = [...cardBuckets.noSpendCards, ...cardBuckets.lowSpendCards];
    const q = cardQuery.trim().toLowerCase();
    if (!q) return combined;
    return combined.filter(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.bank.toLowerCase().includes(q) ||
        c.card_network.toLowerCase().includes(q)
    );
  }, [cardBuckets, cardQuery]);

  const filteredHighSpendCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    if (!q) return cardBuckets.highSpendCards;
    return cardBuckets.highSpendCards.filter(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.bank.toLowerCase().includes(q) ||
        c.card_network.toLowerCase().includes(q)
    );
  }, [cardBuckets, cardQuery]);

  if (!venue) return null;

  const venueName = loungeSpot ? loungeSpot.lounge_name : golfClub!.club_name;
  const venueLocation = loungeSpot
    ? `${loungeSpot.city} (${loungeSpot.airport_code}) · ${loungeSpot.terminal}`
    : `${golfClub!.city} · ${golfClub!.formatted_address}`;

  const renderCardTile = (c: CardSummaryItem, spendNote?: string) => {
    const fee = formatFeeDisplay(c.joining_fee_inr, c.annual_fee_inr);
    const inWallet = ownedIds.includes(c.card_id);
    return (
      <Link
        key={c.card_id}
        href={`/${c.bank_slug}/${c.card_slug}`}
        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
          inWallet
            ? "bg-[#EEF5F2] border-[#93C9B5] hover:bg-[#E2EFEA]"
            : "bg-[#FAF9F6] border-[#E4E4DF] hover:border-[#0F5C4D]"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13.5px] font-medium text-[#1A1D21] truncate">
                {c.card_name}
              </p>
              {inWallet && (
                <span className="shrink-0 text-[10.5px] font-semibold bg-[#0F5C4D] text-white px-2 py-0.5 rounded-full">
                  In My Cards
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#717882] truncate">
              {c.bank} · {c.card_network} · {fee.primaryText}
            </p>
            {spendNote && (
              <p className="text-[11.5px] text-[#9A5B13] font-medium mt-0.5">
                {spendNote}
              </p>
            )}
          </div>
        </div>
        <span className="text-[12px] font-medium text-[#0F5C4D] shrink-0">View →</span>
      </Link>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-7">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href={isGolf ? "/lounges?view=golf" : "/lounges"}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4B525C] hover:text-[#0F5C4D]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lounge &amp; Golf Explorer
        </Link>
        {loungeSpot?.lounge_code && (
          <span className="text-[12px] font-mono bg-[#F3F2EE] text-[#4B525C] px-2.5 py-1 rounded-md border border-[#E4E4DF]">
            Code: {loungeSpot.lounge_code}
          </span>
        )}
      </div>

      {/* My Cards Instant Access Check */}
      {myCardsVerdict.ownedCount === 0 ? (
        <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wallet className="w-5 h-5 text-[#0F5C4D] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[15px] font-semibold text-[#1A1D21]">
                Check Access With Your My Cards Wallet
              </h2>
              <p className="text-[13px] text-[#4B525C] mt-0.5">
                Save the cards you own in My Cards and Cardify will immediately tell you which card grants entry here.
              </p>
            </div>
          </div>
          <Link
            href="/my-cards"
            className="shrink-0 bg-[#0F5C4D] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#0B473B]"
          >
            Go to My Cards →
          </Link>
        </div>
      ) : myCardsVerdict.freeAccess.length > 0 || myCardsVerdict.lowSpendAccess.length > 0 ? (
        <div className="bg-[#EEF5F2] border border-[#B5D7C8] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#0F5C4D] shrink-0" />
            <h2 className="text-[16px] font-semibold text-[#0F5C4D]">
              Access Confirmed via Your Saved Cards
            </h2>
          </div>
          <p className="text-[13.5px] text-[#1A1D21]">
            {myCardsVerdict.freeAccess.length + myCardsVerdict.lowSpendAccess.length} card(s) in your wallet qualify here without high ₹15,000+ spend gates:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {[...myCardsVerdict.freeAccess, ...myCardsVerdict.lowSpendAccess].map((c) => (
              <Link
                key={c.card_id}
                href={`/${c.bank_slug}/${c.card_slug}`}
                className="flex items-center justify-between gap-2 bg-white border border-[#C6E1D5] rounded-xl px-3.5 py-2.5 hover:border-[#0F5C4D]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                  <span className="text-[13px] font-medium text-[#1A1D21] truncate">{c.card_name}</span>
                </div>
                <span className="text-[11px] font-semibold bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded shrink-0">
                  {c.lounge_spend_threshold_inr && c.lounge_spend_threshold_inr > 0
                    ? `₹${c.lounge_spend_threshold_inr.toLocaleString("en-IN")}`
                    : "No-Spend"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : myCardsVerdict.highSpendAccess.length > 0 ? (
        <div className="bg-[#FEF6EA] border border-[#E9CFA6] rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-[#9A5B13] shrink-0" />
            <h2 className="text-[16px] font-semibold text-[#9A5B13]">
              Spend-Gated Access on Your Saved Card(s)
            </h2>
          </div>
          <p className="text-[13.5px] text-[#4B525C]">
            Your card(s) unlock this venue only after hitting quarterly/monthly spend targets (≥ ₹15,000):
          </p>
          <div className="flex flex-wrap gap-2">
            {myCardsVerdict.highSpendAccess.map((c) => (
              <Link
                key={c.card_id}
                href={`/${c.bank_slug}/${c.card_slug}`}
                className="inline-flex items-center gap-2 bg-white border border-[#EAD4AD] rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[#1A1D21]"
              >
                <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                <span>{c.card_name}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[15.5px] font-semibold text-[#B91C1C]">
              Not Unlocked by Your Current My Cards Wallet
            </h2>
            <p className="text-[13px] text-[#7F1D1D] mt-0.5">
              None of your {myCardsVerdict.ownedCount} saved cards currently grant entry here. Browse qualifying zero-spend cards below.
            </p>
          </div>
        </div>
      )}

      {/* Hero Info + 6-Photo Gallery Grid */}
      <section className="bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-3">
          <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#F3F2EE] border border-[#E4E4DF]">
            {photos[activePhotoIdx] && (
              <Image
                src={resolveMediaUrl(photos[activePhotoIdx]) || "/illustrations/lounge-domestic-dining.webp"}
                alt={`${venueName} photo ${activePhotoIdx + 1}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            )}
            <span className="absolute bottom-3 right-3 bg-black/70 text-white text-[11.5px] font-medium px-2.5 py-1 rounded-full z-10">
              {activePhotoIdx + 1} / {photos.length} Photos
            </span>
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-6 gap-2">
              {photos.map((photoPath, idx) => (
                <button
                  key={`${photoPath}-${idx}`}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative aspect-[16/11] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                    idx === activePhotoIdx
                      ? "border-[#0F5C4D] ring-2 ring-[#0F5C4D]/20"
                      : "border-transparent opacity-75 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={resolveMediaUrl(photoPath) || "/illustrations/lounge-domestic-dining.webp"}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-[#EEF5F2] text-[#0F5C4D] border border-[#C6E1D5] px-2.5 py-1 rounded-full">
              {isGolf ? <Flag className="w-3.5 h-3.5" /> : <Plane className="w-3.5 h-3.5" />}
              {loungeSpot ? `${loungeSpot.terminal_type} Lounge` : "Indian Golf Club"}
            </span>
            {venue.google_rating && (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold bg-[#FEF6EA] text-[#9A5B13] border border-[#E9CFA6] px-2.5 py-1 rounded-full tabular-nums">
                <Star className="w-3.5 h-3.5 fill-[#B45309] text-[#B45309]" />
                {venue.google_rating.toFixed(1)} ({(venue.google_review_count || 0).toLocaleString("en-IN")} reviews)
              </span>
            )}
          </div>

          <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#1A1D21] tracking-tight leading-snug">
            {venueName}
          </h1>

          <div className="space-y-2.5 text-[13.5px] text-[#4B525C]">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#0F5C4D] shrink-0 mt-0.5" />
              <span>{venueLocation}</span>
            </div>
            {loungeSpot?.terminal_and_hours && (
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#717882] shrink-0 mt-0.5" />
                <span>{loungeSpot.terminal_and_hours}</span>
              </div>
            )}
          </div>

          {loungeSpot?.airport_guide_note && (
            <p className="text-[13px] text-[#4B525C] bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-3.5 leading-relaxed">
              {loungeSpot.airport_guide_note}
            </p>
          )}

          {venue.google_maps_url && (
            <div className="pt-1 flex flex-wrap gap-3">
              <a
                href={venue.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[13.5px] font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Open in Google Maps
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </section>

      {/* How to Access + People Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {(venue.how_to_access || []).length > 0 && (
          <section className="lg:col-span-7 bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#0F5C4D]" />
              <h2 className="text-[17px] font-semibold text-[#1A1D21]">
                How to Access &amp; Generate Pass
              </h2>
            </div>
            <div className="space-y-3">
              {(venue.how_to_access || []).map((method, idx) => (
                <div
                  key={`${method.channel}-${idx}`}
                  className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-[14px] font-semibold text-[#1A1D21]">{method.channel}</h3>
                    {method.url && (
                      <a
                        href={method.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-medium bg-[#EEF5F2] text-[#0F5C4D] border border-[#C6E1D5] px-2.5 py-1 rounded-lg hover:underline"
                      >
                        Open Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <ol className="space-y-1 text-[13px] text-[#4B525C] list-decimal list-inside">
                    {(method.steps || []).map((step, sIdx) => (
                      <li key={sIdx}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {(venue.people_reviews || []).length > 0 && (
          <section className="lg:col-span-5 bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="w-5 h-5 text-[#0F5C4D]" />
              <h2 className="text-[17px] font-semibold text-[#1A1D21]">
                Visitor &amp; Community Reviews
              </h2>
            </div>
            <div className="space-y-3">
              {(venue.people_reviews || []).map((rev, idx) => (
                <div
                  key={idx}
                  className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#1A1D21]">{rev.author}</span>
                    <div className="flex items-center gap-2">
                      {rev.tag && (
                        <span className="text-[11px] bg-[#EEF5F2] text-[#0F5C4D] font-medium px-2 py-0.5 rounded">
                          {rev.tag}
                        </span>
                      )}
                      <span className="text-[12px] font-semibold text-[#9A5B13]">
                        ★ {rev.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[13px] text-[#4B525C] italic leading-relaxed">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Accepted Credit Cards (Spend-Free Prioritized; ₹15,000+ Spend-Gated Collapsed Initially) */}
      <section className="bg-white border border-[#E4E4DF] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1A1D21]">
              Accepted Credit Cards ({cardBuckets.noSpendCards.length + cardBuckets.lowSpendCards.length} Spend-Free / Low-Spend)
            </h2>
            <p className="text-[13px] text-[#717882] mt-0.5">
              Zero-spend and low-spend (&lt; ₹15,000) cards are shown first. Cards requiring ₹15,000+ spend are tucked inside the expandable list below.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              placeholder="Filter bank, card, Visa / RuPay..."
              className="w-full pl-9 pr-3 py-2 text-[13px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>
        </div>

        {filteredPrimaryCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPrimaryCards.map((c) =>
              renderCardTile(
                c,
                c.lounge_spend_threshold_inr && c.lounge_spend_threshold_inr > 0
                  ? `Low spend: ₹${c.lounge_spend_threshold_inr.toLocaleString("en-IN")}`
                  : undefined
              )
            )}
          </div>
        ) : (
          <p className="text-[13.5px] text-[#717882]">
            No direct/low-spend cards matched &ldquo;{cardQuery}&rdquo;. Check the expandable ₹15,000+ spend-gated cards section below.
          </p>
        )}

        {cardBuckets.highSpendCards.length > 0 && (
          <div className="pt-4 border-t border-[#E4E4DF]">
            <button
              type="button"
              onClick={() => setShowHighSpendCards((p) => !p)}
              className="w-full flex items-center justify-between gap-3 bg-[#FAF9F6] hover:bg-[#F3F2EE] border border-[#E4E4DF] rounded-xl px-4 py-3 text-left cursor-pointer"
            >
              <div>
                <p className="text-[13.5px] font-semibold text-[#1A1D21]">
                  Spend-Gated Cards Requiring ₹15,000+ Prior Spend ({cardBuckets.highSpendCards.length} cards)
                </p>
                <p className="text-[12px] text-[#717882]">
                  De-prioritized by default so spend-free entry options stay visible first
                </p>
              </div>
              {showHighSpendCards ? (
                <ChevronUp className="w-5 h-5 text-[#4B525C] shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#4B525C] shrink-0" />
              )}
            </button>

            {showHighSpendCards && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {filteredHighSpendCards.map((c) =>
                  renderCardTile(
                    c,
                    c.lounge_spend_condition ||
                      (c.lounge_spend_threshold_inr
                        ? `Requires ₹${c.lounge_spend_threshold_inr.toLocaleString("en-IN")} spend`
                        : "Spend-gated access")
                  )
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
