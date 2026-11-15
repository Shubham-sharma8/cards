import React from "react";
import type { Metadata } from "next";
import { CompareClient } from "@/components/CompareClient";
import { JsonLd } from "@/components/JsonLd";
import { getCardsByIdsAsync } from "@/lib/data";
import { sanitizeCardIdList } from "@/lib/security";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildWebAppJsonLd } from "@/lib/seo";

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>;
}

export async function generateMetadata({ searchParams }: ComparePageProps): Promise<Metadata> {
  const sp = await searchParams;
  const ids = sanitizeCardIdList(sp.ids, 3);
  const selected = ids.length > 0 ? await getCardsByIdsAsync(ids) : [];

  if (selected.length > 0) {
    const names = selected.map((c) => c.identity.card_name).join(" vs ");
    return buildPageMetadata({
      title: `${names} — Side-by-Side Comparison | Cards by cogify`,
      description: `Compare ${names} across annual fees, waiver spends, real category reward %, airport & golf access, forex markup, and pros vs cons on card.cogify.me.`,
      path: `/compare?ids=${encodeURIComponent(selected.map((c) => c.identity.card_id).join(","))}`,
      canonicalPath: "/compare",
      ogParams: {
        type: "compare",
        cards: selected.map((c) => c.identity.card_id).join(","),
      },
      ogAlt: `${names} Comparison — Cards by cogify`,
    });
  }

  return buildPageMetadata({
    title: "Side-by-Side Credit Card Comparison | Cards by cogify",
    description:
      "Compare up to 3 Indian credit cards side by side across annual fees, waiver thresholds, effective category cashback, lounge visits, and devaluation risk.",
    path: "/compare",
    ogParams: { type: "compare" },
    ogAlt: "Side-by-Side Indian Credit Card Comparison — Cards by cogify",
  });
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const sp = await searchParams;
  const ids = sanitizeCardIdList(sp.ids, 3);
  const initialCards = ids.length > 0 ? await getCardsByIdsAsync(ids) : [];

  return (
    <>
      <JsonLd
        data={buildWebAppJsonLd({
          name: "Cards by cogify — Side-by-Side Card Comparator",
          description: "Compare up to 3 Indian credit cards across fees, real reward return %, lounges, and devaluations.",
          path: "/compare",
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Compare Cards", path: "/compare" },
        ])}
      />
      <CompareClient initialCards={initialCards} />
    </>
  );
}
