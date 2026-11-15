import React from "react";
import type { Metadata } from "next";
import { getAllCardsAsync, getCalculatorExtraMetaMapAsync } from "@/lib/data";
import { CalculatorClient, type CardCalcExtraMeta } from "@/components/CalculatorClient";
import { JsonLd } from "@/components/JsonLd";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebAppJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const cardCount = (await getAllCardsAsync()).length;
  return buildPageMetadata({
    title: `Real Cashback & Rewards Calculator (${cardCount} Cards) | Cards by cogify`,
    description: `Calculate real annual rupee returns after monthly caps, forex drag, and 18% GST annual fee across all ${cardCount} active Indian credit cards.`,
    path: "/calculator",
    ogParams: { type: "calculator" },
    ogAlt: `Indian Credit Card Real Cashback Calculator (${cardCount} Cards)`,
  });
}

export default async function CalculatorPage() {
  const [cards, extraMap] = await Promise.all([
    getAllCardsAsync(),
    getCalculatorExtraMetaMapAsync(),
  ]);
  const extraByCardId: Record<string, CardCalcExtraMeta> = extraMap;

  return (
    <>
      <JsonLd
        data={buildWebAppJsonLd({
          name: `Cards by cogify — Cashback Calculator (${cards.length} Indian Cards)`,
          description:
            "Calculate real annual rupee returns after monthly caps, forex markup, and 18% GST annual fee across active Indian credit cards.",
          path: "/calculator",
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Cashback Calculator", path: "/calculator" },
        ])}
      />
      <CalculatorClient cards={cards} extraByCardId={extraByCardId} />
    </>
  );
}
