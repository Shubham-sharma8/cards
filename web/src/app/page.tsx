import React from "react";
import { getAllCards, getBanksIndex, getDevaluationTracker, getLatestOffers } from "@/lib/data";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  const cards = getAllCards();
  const banksIndex = getBanksIndex();
  const deval = getDevaluationTracker();
  const latestOffers = getLatestOffers();

  const sortedBanks = [...banksIndex.banks].sort((a, b) => b.total_cards - a.total_cards);

  const stats = {
    totalCards: cards.length,
    totalBanks: banksIndex.total_banks,
    ltfCount: cards.filter((c) => c.filter_tags.is_ltf).length,
    noSpendLoungeCount: cards.filter((c) => c.filter_tags.no_spend_domestic_lounge).length,
    rupayCount: cards.filter((c) => c.filter_tags.is_rupay_upi).length,
    zeroLowForexCount: cards.filter((c) => c.filter_tags.zero_or_low_forex).length,
    fuelCount: cards.filter((c) => c.categories.includes("Fuel")).length,
    travelCount: cards.filter((c) => c.categories.includes("Travel & Miles")).length,
  };

  return (
    <HomeClient
      cards={cards}
      banks={sortedBanks}
      recentDevaluations={deval.timeline_2024_2026.slice(0, 4)}
      latestOffers={latestOffers.offers}
      stats={stats}
    />
  );
}
