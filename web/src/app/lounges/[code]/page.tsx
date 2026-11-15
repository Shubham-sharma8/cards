import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoungeDetailClient } from "@/components/LoungeDetailClient";
import {
  getGolfClubsMaster,
  getGolfClubsMasterAsync,
  getLoungeAccessMaster,
  getLoungeAccessMasterAsync,
  getSearchIndexAsync,
} from "@/lib/data";
import { buildPageMetadata } from "@/lib/seo";

interface PageProps {
  params: Promise<{ code: string }>;
}

export function generateStaticParams() {
  const lounges = (getLoungeAccessMaster().participating_indian_airport_lounges || [])
    .filter((l) => Boolean(l.lounge_code))
    .map((l) => ({ code: String(l.lounge_code) }));
  const golf = (getGolfClubsMaster().clubs || []).map((g) => ({
    code: String(g.slug),
  }));
  return [...lounges, ...golf];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const codeLower = decodeURIComponent(code).toLowerCase();
  const [loungeMaster, golfMaster] = await Promise.all([
    getLoungeAccessMasterAsync(),
    getGolfClubsMasterAsync(),
  ]);

  const loungeSpot = (loungeMaster.participating_indian_airport_lounges || []).find(
    (l) => String(l.lounge_code || "").toLowerCase() === codeLower
  );
  const golfClub = !loungeSpot
    ? (golfMaster.clubs || []).find((g) => String(g.slug || "").toLowerCase() === codeLower)
    : undefined;

  if (!loungeSpot && !golfClub) {
    return buildPageMetadata({
      title: "Lounge or Golf Club Not Found — Cards by cogify",
      description: "Requested Indian airport lounge or golf course was not found.",
      path: "/lounges",
      noIndex: true,
    });
  }

  if (loungeSpot) {
    return buildPageMetadata({
      title: `${loungeSpot.lounge_name} (${loungeSpot.city} ${loungeSpot.airport_code}) — Cards, QR & Reviews — Cards by cogify`,
      description: `Check which Indian credit cards grant complimentary access to ${loungeSpot.lounge_name} at ${loungeSpot.city} ${loungeSpot.terminal}. Live ratings, photos, HOI/LoungeOne/TFS QR portals & reviews.`,
      path: `/lounges/${loungeSpot.lounge_code}`,
    });
  }

  return buildPageMetadata({
    title: `${golfClub!.club_name} (${golfClub!.city}) — Complimentary Golf Cards & Booking — Cards by cogify`,
    description: `See Indian credit cards unlocking complimentary golf at ${golfClub!.club_name} in ${golfClub!.city}. Booking helpline, ratings, photos & reviews.`,
    path: `/lounges/${golfClub!.slug}`,
  });
}

export default async function LoungeOrGolfDetailPage({ params }: PageProps) {
  const { code } = await params;
  const codeLower = decodeURIComponent(code).toLowerCase();

  const [loungeMaster, golfMaster, searchIdx] = await Promise.all([
    getLoungeAccessMasterAsync(),
    getGolfClubsMasterAsync(),
    getSearchIndexAsync(),
  ]);

  const loungeSpot =
    (loungeMaster.participating_indian_airport_lounges || []).find(
      (l) => String(l.lounge_code || "").toLowerCase() === codeLower
    ) ?? null;

  const golfClub = !loungeSpot
    ? (golfMaster.clubs || []).find((g) => String(g.slug || "").toLowerCase() === codeLower) ??
      null
    : null;

  if (!loungeSpot && !golfClub) {
    notFound();
  }

  const eligibleIds = new Set<string>(
    loungeSpot
      ? [
          ...(loungeSpot.eligible_no_spend_card_ids || []),
          ...(loungeSpot.eligible_low_spend_card_ids || []),
          ...(loungeSpot.eligible_high_spend_card_ids || []),
          ...(loungeSpot.verified_cardmaven_card_ids || []),
        ]
      : golfClub
        ? [
            ...(golfClub.eligible_no_spend_card_ids || []),
            ...(golfClub.eligible_high_spend_card_ids || []),
          ]
        : []
  );
  const relevantCards = (searchIdx.cards || []).filter((c) => eligibleIds.has(c.card_id));

  return (
    <LoungeDetailClient
      loungeSpot={loungeSpot}
      golfClub={golfClub}
      allCards={relevantCards}
    />
  );
}
