import React from "react";
import type { Metadata } from "next";
import { LoungesClient } from "@/components/LoungesClient";
import { JsonLd } from "@/components/JsonLd";
import { getAllCards, getGolfClubsMaster, getLoungeAccessMaster, getLoungeCatalog } from "@/lib/data";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Airport Lounge, Golf & Railway Finder — Cards by cogify",
  description:
    "Check DEL, BOM, BLR and 42+ Indian airport lounges, cardless QR claim portals (LoungeOne, Hoi, TFS), golf clubs, and no-spend lounge cards.",
  path: "/lounges",
  ogParams: { type: "lounge" },
  ogAlt: "Airport Lounge, Golf & Railway Lounge Directory — Cards by cogify",
});

export default function LoungesPage() {
  const catalog = getLoungeCatalog();
  const loungeMaster = getLoungeAccessMaster();
  const golfClubs = getGolfClubsMaster().clubs;
  const allCards = getAllCards();
  const noSpendLoungeCards = allCards
    .filter((c) => c.filter_tags.no_spend_domestic_lounge)
    .sort((a, b) => b.overall_rating - a.overall_rating);

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
        loungeMaster={loungeMaster}
        golfClubs={golfClubs}
        allCards={allCards}
        noSpendLoungeCards={noSpendLoungeCards}
      />
    </>
  );
}
