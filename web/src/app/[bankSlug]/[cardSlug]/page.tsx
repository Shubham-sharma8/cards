import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardDossierClient } from "@/components/CardDossierClient";
import { JsonLd } from "@/components/JsonLd";
import {
  getAllCards,
  getCardDossier,
  getCardDossierAsync,
  getGolfClubsMasterAsync,
  getLoungeAccessMasterAsync,
  getRelatedCardFeatureRows,
  getSearchIndexAsync,
} from "@/lib/data";
import { formatInr, SPEND_CATEGORY_KEYS } from "@/lib/format";
import {
  buildBreadcrumbJsonLd,
  buildCardProductJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

interface PageProps {
  params: Promise<{ bankSlug: string; cardSlug: string }>;
}

export function generateStaticParams() {
  return getAllCards().map((c) => ({
    bankSlug: c.bank_slug,
    cardSlug: c.card_slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bankSlug, cardSlug } = await params;
  const dossier = getCardDossier(bankSlug, cardSlug);
  if (!dossier) {
    return buildPageMetadata({
      title: "Card Not Found — Cards by cogify",
      description: "The requested Indian credit card dossier could not be found.",
      path: "/cards",
      noIndex: true,
    });
  }

  const { identity, fees_and_charges_detailed: fees, reward_calculator_model: calc, pros_and_cons: pc } = dossier;
  const peakReturn = Math.max(
    0,
    ...SPEND_CATEGORY_KEYS.map((k) => calc.effective_return_pct_by_category?.[k] ?? 0)
  );
  const feeText = fees.annual_fee_inr === 0 ? "LTF (₹0)" : `${formatInr(fees.annual_fee_inr)}/yr`;

  return buildPageMetadata({
    title: `${identity.card_name} (${identity.bank}) Review, Rewards & Lounges — Cards by cogify`,
    description:
      pc.editorial_summary ||
      `${identity.card_name}: up to ${peakReturn.toFixed(1)}% real reward rate, ${feeText} fee, lounge access, MITC charges, and devaluation tracker.`,
    path: `/${identity.bank_slug}/${identity.card_slug}`,
    ogParams: {
      type: "card",
      bank: identity.bank_slug,
      card: identity.card_slug,
    },
    ogAlt: `${identity.card_name} (${identity.bank}) — Fee ${feeText}, Peak ${peakReturn.toFixed(1)}% Return`,
  });
}

export default async function CardDossierPage({ params }: PageProps) {
  const { bankSlug, cardSlug } = await params;
  const dossier = getCardDossier(bankSlug, cardSlug) || (await getCardDossierAsync(bankSlug, cardSlug));
  if (!dossier) {
    notFound();
  }
  const [searchIdx, loungeMaster, golfMaster] = await Promise.all([
    getSearchIndexAsync(),
    getLoungeAccessMasterAsync(),
    getGolfClubsMasterAsync(),
  ]);
  const cardSummary = searchIdx.cards.find((c) => c.card_id === dossier.identity.card_id);
  const codeSet = new Set((cardSummary?.accessible_lounge_codes || []).map((c) => c.toUpperCase()));
  const accessibleIndianLounges = (loungeMaster.participating_indian_airport_lounges || [])
    .filter((spot) => {
      if (spot.lounge_code && codeSet.has(spot.lounge_code.toUpperCase())) return true;
      const allIds = [
        ...(spot.eligible_no_spend_card_ids || []),
        ...(spot.eligible_low_spend_card_ids || []),
        ...(spot.eligible_high_spend_card_ids || []),
        ...(spot.verified_cardmaven_card_ids || []),
      ];
      return allIds.includes(dossier.identity.card_id);
    })
    .map((spot) => ({
      lounge_code: spot.lounge_code,
      airport_code: spot.airport_code,
      city: spot.city,
      lounge_name: spot.lounge_name,
      terminal: spot.terminal,
      terminal_type: spot.terminal_type,
      google_rating: spot.google_rating,
    }));
  const golfSlugSet = new Set(cardSummary?.accessible_golf_slugs || []);
  const accessibleGolfClubs = (golfMaster.clubs || [])
    .filter((club) => {
      if (golfSlugSet.has(club.slug)) return true;
      return (
        club.eligible_no_spend_card_ids?.includes(dossier.identity.card_id) ||
        club.eligible_high_spend_card_ids?.includes(dossier.identity.card_id)
      );
    })
    .map((club) => ({
      slug: club.slug,
      city: club.city,
      club_name: club.club_name,
      google_rating: club.google_rating ?? undefined,
    }));
  const relatedRows = getRelatedCardFeatureRows(dossier);
  const totalCardsCount = searchIdx.cards.length || getAllCards().length;
  const { identity } = dossier;

  const productJsonLd = buildCardProductJsonLd(dossier);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Credit Cards", path: "/cards" },
    { name: identity.bank, path: `/cards?bank=${identity.bank_slug}` },
    { name: identity.card_name, path: `/${identity.bank_slug}/${identity.card_slug}` },
  ]);

  return (
    <>
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      <CardDossierClient
        dossier={dossier}
        relatedRows={relatedRows}
        totalCardsCount={totalCardsCount}
        accessibleIndianLounges={accessibleIndianLounges}
        accessibleGolfClubs={accessibleGolfClubs}
        domesticLoungeCount={cardSummary?.domestic_lounge_accessible_count}
      />
    </>
  );
}
