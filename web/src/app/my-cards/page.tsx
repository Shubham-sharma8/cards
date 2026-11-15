import React, { Suspense } from "react";
import type { Metadata } from "next";
import { MyCardsClient } from "@/components/MyCardsClient";
import { getAllCardsAsync, getFeeWaiverMapAsync } from "@/lib/data";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "My Cards & Wallet Utilization Optimizer — Cards by cogify",
  description:
    "Select the Indian credit cards you own to generate a category-by-category swipe matrix with cap-spillover hacks, lounge & golf audit, keep/downgrade verdicts, and gap-filling recommendations.",
  path: "/my-cards",
  ogParams: { type: "advisor" },
  noIndex: true,
});

export default async function MyCardsPage() {
  const [cards, waiverMap] = await Promise.all([getAllCardsAsync(), getFeeWaiverMapAsync()]);

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-[14px] text-[#717882]">
          Loading My Cards wallet optimizer...
        </div>
      }
    >
      <MyCardsClient cards={cards} waiverMap={waiverMap} />
    </Suspense>
  );
}
