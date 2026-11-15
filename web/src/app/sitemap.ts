import type { MetadataRoute } from "next";
import { BANK_HELP_DIRECTORY } from "@/lib/bankHelpDirectory";
import { getAllCards, getGolfClubsMaster, getLoungeAccessMaster } from "@/lib/data";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "", freq: "daily" as const, prio: 1.0 },
    { path: "/cards", freq: "daily" as const, prio: 0.95 },
    { path: "/compare", freq: "weekly" as const, prio: 0.9 },
    { path: "/categories", freq: "weekly" as const, prio: 0.9 },
    { path: "/calculator", freq: "weekly" as const, prio: 0.9 },
    { path: "/advisor", freq: "weekly" as const, prio: 0.9 },
    { path: "/lounges", freq: "weekly" as const, prio: 0.9 },
    { path: "/lounges/guide", freq: "weekly" as const, prio: 0.85 },
    { path: "/devaluations", freq: "weekly" as const, prio: 0.85 },
    { path: "/banks", freq: "monthly" as const, prio: 0.85 },
    { path: "/help", freq: "monthly" as const, prio: 0.85 },
  ].map(({ path, freq, prio }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: freq,
    priority: prio,
  }));

  const helpBankRoutes: MetadataRoute.Sitemap = BANK_HELP_DIRECTORY.map((b) => ({
    url: `${baseUrl}/help/${b.bank_slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const cardRoutes: MetadataRoute.Sitemap = getAllCards().map((c) => ({
    url: `${baseUrl}/${c.bank_slug}/${c.card_slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.75,
  }));

  const loungeRoutes: MetadataRoute.Sitemap = (getLoungeAccessMaster().participating_indian_airport_lounges || [])
    .filter((l) => Boolean(l.lounge_code))
    .map((l) => ({
      url: `${baseUrl}/lounges/${l.lounge_code}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  const golfRoutes: MetadataRoute.Sitemap = (getGolfClubsMaster().clubs || []).map((g) => ({
    url: `${baseUrl}/lounges/${g.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.65,
  }));

  return [...staticRoutes, ...helpBankRoutes, ...cardRoutes, ...loungeRoutes, ...golfRoutes];
}
