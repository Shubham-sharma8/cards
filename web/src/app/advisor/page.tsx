import React from "react";
import type { Metadata } from "next";
import { AdvisorClient } from "@/components/AdvisorClient";
import { JsonLd } from "@/components/JsonLd";
import { getAdvisorMetaMap, getAllCards, getFeeWaiverMap } from "@/lib/data";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebAppJsonLd } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Card Advisor & 2-Card Combo Builder — Cards by cogify",
  description:
    "Match Indian credit cards by monthly income, CIBIL score, fee waiver fit, and category spend, or optimize a 2-card wallet combination.",
  path: "/advisor",
  ogParams: { type: "advisor" },
  ogAlt: "Personalized Credit Card Advisor & 2-Card Combo Builder — Cards by cogify",
});

export default function AdvisorPage() {
  const cards = getAllCards();
  const waiverMap = getFeeWaiverMap();
  const advisorMetaMap = getAdvisorMetaMap();

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
        cards={cards}
        waiverMap={waiverMap}
        advisorMetaMap={advisorMetaMap}
      />
    </>
  );
}
