import React from "react";
import type { Metadata } from "next";
import { getAllCardsAsync, getBanksIndexAsync, selectSsrCardSlice } from "@/lib/data";
import { CardsExplorerClient } from "@/components/CardsExplorerClient";
import { JsonLd } from "@/components/JsonLd";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [cards, banksIndex] = await Promise.all([getAllCardsAsync(), getBanksIndexAsync()]);
  const cardCount = cards.length;
  const bankCount = banksIndex.total_banks;
  return buildPageMetadata({
    title: `All ${cardCount} Indian Credit Cards — Filter & Search | Cards by cogify`,
    description: `Filter ${cardCount} active Indian credit cards across ${bankCount} banks by LTF, no-spend lounge access, RuPay UPI, zero forex markup, salary requirement, and reward rates.`,
    path: "/cards",
    ogParams: { type: "home" },
    ogAlt: `All ${cardCount} Active Indian Credit Cards — Cards by cogify`,
  });
}

export default async function CardsPage() {
  const [cards, banksIndex] = await Promise.all([getAllCardsAsync(), getBanksIndexAsync()]);

  return (
    <>
      <JsonLd
        data={buildCollectionJsonLd({
          name: `All ${cards.length} Indian Credit Cards Directory`,
          description: `Filter and search ${cards.length} Indian credit cards across ${banksIndex.total_banks} banks.`,
          path: "/cards",
          itemCount: cards.length,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "All Cards", path: "/cards" },
        ])}
      />
      <CardsExplorerClient
        cards={selectSsrCardSlice(cards, 36)}
        banks={banksIndex.banks}
        totalCardCount={cards.length}
      />
    </>
  );
}
