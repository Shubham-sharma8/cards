import React from "react";
import type { Metadata } from "next";
import { getAllCardsAsync, getDevaluationTrackerAsync } from "@/lib/data";
import { DevaluationsClient } from "@/components/DevaluationsClient";
import { JsonLd } from "@/components/JsonLd";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Credit Card Devaluation Tracker (2024–2026) | Cards by cogify",
  description:
    "Issuer devaluation risk scores, reward and lounge cuts (2024–2026), and per-card devaluation alert summaries across Indian banks.",
  path: "/devaluations",
  ogParams: { type: "devaluations" },
  ogAlt: "Indian Credit Card Devaluation Tracker (2024–2026) — Cards by cogify",
});

export default async function DevaluationsPage() {
  const [tracker, cards] = await Promise.all([
    getDevaluationTrackerAsync(),
    getAllCardsAsync(),
  ]);

  return (
    <>
      <JsonLd
        data={buildCollectionJsonLd({
          name: "Indian Credit Card Devaluation Tracker (2024–2026)",
          description:
            "Verified issuer reward cuts, lounge spend requirements, and devaluation risk ratings across Indian banks.",
          path: "/devaluations",
          itemCount: tracker.timeline_2024_2026.length,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Devaluations", path: "/devaluations" },
        ])}
      />
      <DevaluationsClient tracker={tracker} cards={cards} />
    </>
  );
}
