import React from "react";
import type { Metadata } from "next";
import { AdvisorClient } from "@/components/AdvisorClient";
import { JsonLd } from "@/components/JsonLd";
import { getAdvisorMetaMapAsync, getAllCardsAsync, getFeeWaiverMapAsync, selectSsrCardSlice } from "@/lib/data";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebAppJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Card Advisor & 2-Card Combo Builder — Cards by cogify",
  description:
    "Match Indian credit cards by monthly income, CIBIL score, fee waiver fit, and category spend, or optimize a 2-card wallet combination.",
  path: "/advisor",
  ogParams: { type: "advisor" },
  ogAlt: "Personalized Credit Card Advisor & 2-Card Combo Builder — Cards by cogify",
});

export default async function AdvisorPage() {
  const [cards, fullWaiverMap, fullAdvisorMetaMap] = await Promise.all([
    getAllCardsAsync(),
    getFeeWaiverMapAsync(),
    getAdvisorMetaMapAsync(),
  ]);
  const ssrCards = selectSsrCardSlice(cards, 36);
  const waiverMap: typeof fullWaiverMap = {};
  const advisorMetaMap: typeof fullAdvisorMetaMap = {};
  for (const c of ssrCards) {
    if (c.card_id in fullWaiverMap) waiverMap[c.card_id] = fullWaiverMap[c.card_id];
    if (c.card_id in fullAdvisorMetaMap) advisorMetaMap[c.card_id] = fullAdvisorMetaMap[c.card_id];
  }

  return (
    <>
      <JsonLd
        data={buildWebAppJsonLd({
          name: "Cards by cogify — Card Advisor",
          description:
            "Eligibility-aware credit card recommender and two-card wallet combo optimizer for Indian spend profiles.",
          path: "/advisor",
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Card Advisor", path: "/advisor" },
        ])}
      />
      <AdvisorClient
        cards={ssrCards}
        waiverMap={waiverMap}
        advisorMetaMap={advisorMetaMap}
      />
    </>
  );
}
