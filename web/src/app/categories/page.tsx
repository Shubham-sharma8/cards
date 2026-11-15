import React from "react";
import type { Metadata } from "next";
import { CategoriesHubClient } from "@/components/CategoriesHubClient";
import { JsonLd } from "@/components/JsonLd";
import { getAdvisorMetaMap, getAllCards, getCategoryStats } from "@/lib/data";
import { getCategoryStudyTable, type CategoryStudyTable } from "@/lib/categoryStudies";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Best Credit Card Categories in India — Cards by cogify",
  description:
    "Explore 13 curated Indian credit card verticals across Fuel, Cashback, Shopping, Groceries, Travel, Golf, Lounges, RuPay UPI, and Zero Forex.",
  path: "/categories",
  ogParams: { type: "categories" },
  ogAlt: "13 Curated Credit Card Category Study Tables — Cards by cogify",
});

export default function CategoriesPage() {
  const categories = getCategoryStats();
  const allCards = getAllCards();
  const advisorMetaMap = getAdvisorMetaMap();
  const studyTables: Record<string, CategoryStudyTable> = {};
  for (const cat of categories) {
    const tbl = getCategoryStudyTable(cat.id, allCards, advisorMetaMap);
    if (tbl) studyTables[cat.id] = tbl;
  }

  return (
    <>
      <JsonLd
        data={buildCollectionJsonLd({
          name: "Best Indian Credit Cards by Spend Category",
          description:
            "13 benchmark study tables across Golf, Travel, Lounge, Cashback, Dining, Fuel, RuPay UPI, and Zero Forex credit cards in India.",
          path: "/categories",
          itemCount: categories.length,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
        ])}
      />
      <CategoriesHubClient categories={categories} studyTables={studyTables} />
    </>
  );
}
