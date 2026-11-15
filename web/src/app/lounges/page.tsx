import React from "react";
import type { Metadata } from "next";
import { LoungesClient } from "@/components/LoungesClient";
import { JsonLd } from "@/components/JsonLd";
import {
  getAllCardsAsync,
  getGolfClubsMasterAsync,
  getLoungeAccessMasterAsync,
  getLoungeCatalogAsync,
  selectSsrCardSlice,
} from "@/lib/data";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Airport Lounge, Golf & Railway Finder — Cards by cogify",
  description:
    "Check DEL, BOM, BLR and 42+ Indian airport lounges, cardless QR claim portals (LoungeOne, Hoi, TFS), golf clubs, and no-spend lounge cards.",
  path: "/lounges",
  ogParams: { type: "lounge" },
  ogAlt: "Airport Lounge, Golf & Railway Lounge Directory — Cards by cogify",
});

export default async function LoungesPage() {
  const [catalog, loungeMaster, golfMaster, allCards] = await Promise.all([
    getLoungeCatalogAsync(),
    getLoungeAccessMasterAsync(),
    getGolfClubsMasterAsync(),
    getAllCardsAsync(),
  ]);
  const golfClubs = golfMaster.clubs;
  const noSpendLoungeCards = allCards
    .filter((c) => c.filter_tags.no_spend_domestic_lounge)
    .sort((a, b) => b.overall_rating - a.overall_rating);
  const ssrLounges = {
    ...loungeMaster,
    participating_indian_airport_lounges: (loungeMaster.participating_indian_airport_lounges || [])
      .slice()
      .sort((a, b) => {
        const pri = (code: string) => (code === "DEL" ? 3 : code === "BOM" ? 2 : code === "BLR" ? 1 : 0);
        return pri(b.airport_code) - pri(a.airport_code);
      })
      .slice(0, 36),
  };

  return (
    <>
      <JsonLd
        data={buildCollectionJsonLd({
          name: "Indian Airport Lounge, Golf & Railway Lounge Directory",
          description:
            "Directory of airport terminal lounges, online QR claim portals, no-spend lounge credit cards, and golf privileges in India.",
          path: "/lounges",
          itemCount: loungeMaster.participating_indian_airport_lounges_count,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Lounge & Golf", path: "/lounges" },
        ])}
      />
      <LoungesClient
        catalog={catalog}
        loungeMaster={ssrLounges}
        golfClubs={golfClubs}
        allCards={selectSsrCardSlice(allCards, 36)}
        noSpendLoungeCards={noSpendLoungeCards.slice(0, 24)}
      />
    </>
  );
}
