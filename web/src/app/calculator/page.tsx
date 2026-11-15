import React from "react";
import type { Metadata } from "next";
import { getAllCards, getCardDossier } from "@/lib/data";
import { CalculatorClient, type CardCalcExtraMeta } from "@/components/CalculatorClient";
import { JsonLd } from "@/components/JsonLd";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebAppJsonLd } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const cardCount = getAllCards().length;
  return buildPageMetadata({
    title: `Real Cashback & Rewards Calculator (${cardCount} Cards) | Cards by cogify`,
    description: `Calculate real annual rupee returns after monthly caps, forex drag, and 18% GST annual fee across all ${cardCount} active Indian credit cards.`,
    path: "/calculator",
    ogParams: { type: "calculator" },
    ogAlt: `Indian Credit Card Real Cashback Calculator (${cardCount} Cards)`,
  });
}

export default function CalculatorPage() {
  const cards = getAllCards();
  const extraByCardId: Record<string, CardCalcExtraMeta> = {};

  for (const c of cards) {
    const dossier = getCardDossier(c.bank_slug, c.card_slug);
    if (dossier) {
      extraByCardId[c.card_id] = {
        fee_waiver_spend_inr: dossier.fees_and_charges_detailed?.fee_waiver_spend_inr ?? null,
        monthly_capping_rules: dossier.reward_calculator_model?.monthly_capping_rules || [],
        earn_unit: dossier.reward_calculator_model?.earn_unit || "Reward Points",
        point_value_inr_default: dossier.reward_calculator_model?.point_value_inr_default ?? 1,
      };
    }
  }

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
