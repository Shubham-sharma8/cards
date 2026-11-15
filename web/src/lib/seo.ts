import type { Metadata } from "next";
import type { CardDossier } from "./types";
import { SPEND_CATEGORY_KEYS, formatInr, formatLoungeQuota } from "./format";

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const cfPagesUrl = process.env.CF_PAGES_URL?.trim();
  if (cfPagesUrl) return cfPagesUrl.replace(/\/+$/, "");
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) return `https://${vercelProd.replace(/\/+$/, "")}`;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/, "")}`;
  return "https://card.cogify.me";
}

export function buildOgImageUrl(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/og?${qs}` : "/og?type=home";
}

export function buildPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  canonicalPath?: string;
  keywords?: string[];
  ogParams?: Record<string, string | undefined>;
  ogAlt?: string;
  noIndex?: boolean;
}): Metadata {
  const ogUrl = buildOgImageUrl(opts.ogParams ?? { type: "home" });
  const alt = opts.ogAlt || opts.title;

  return {
    title: opts.title,
    description: opts.description,
    ...(opts.keywords && opts.keywords.length > 0 ? { keywords: opts.keywords } : {}),
    alternates: {
      canonical: opts.canonicalPath || opts.path,
    },
    robots: opts.noIndex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
    openGraph: {
      type: "website",
      locale: "en_IN",
      siteName: "Cards by cogify",
      url: opts.path,
      title: opts.title,
      description: opts.description,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          type: "image/png",
          alt,
        },
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          type: "image/png",
          alt: "Cards by cogify — Indian Credit Card Intelligence",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@cogifyme",
      creator: "@cogifyme",
      title: opts.title,
      description: opts.description,
      images: [
        {
          url: ogUrl,
          alt,
        },
      ],
    },
  };
}

export function buildOrganizationAndWebsiteJsonLd(cardCount: number, bankCount: number) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Cards by cogify",
        alternateName: "Cards",
        url: siteUrl,
        parentOrganization: {
          "@type": "Organization",
          name: "cogify.me",
          url: "https://cogify.me",
        },
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/icon.png`,
        },
        description: `Cards by cogify (a product of cogify.me) — independent Indian credit card intelligence tracking ${cardCount} active credit cards across ${bankCount} Indian banks, MITC charges, reward caps, airport lounges, golf benefits, and devaluations.`,
        areaServed: {
          "@type": "Country",
          name: "India",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Cards by cogify",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-IN",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/cards?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

export function buildCardProductJsonLd(dossier: CardDossier) {
  const siteUrl = getSiteUrl();
  const { identity, fees_and_charges_detailed: fees, ratings, lounge_access_detailed: lounge, reward_calculator_model: calc, pros_and_cons: pc } = dossier;
  const canonicalUrl = `${siteUrl}/${identity.bank_slug}/${identity.card_slug}`;
  const peakRate = Math.max(
    0,
    ...SPEND_CATEGORY_KEYS.map((k) => calc.effective_return_pct_by_category?.[k] ?? 0)
  );
  const domLounge = formatLoungeQuota(
    lounge.domestic.visits_per_year,
    lounge.domestic.visits_per_quarter
  );

  return {
    "@context": "https://schema.org",
    "@type": ["FinancialProduct", "CreditCard"],
    "@id": `${canonicalUrl}#product`,
    name: identity.card_name,
    url: canonicalUrl,
    image: `${siteUrl}/og?type=card&bank=${encodeURIComponent(identity.bank_slug)}&card=${encodeURIComponent(identity.card_slug)}`,
    description:
      pc.editorial_summary ||
      `${identity.card_name} from ${identity.bank}: up to ${peakRate.toFixed(1)}% real reward rate, ${fees.annual_fee_inr === 0 ? "Lifetime Free" : `${formatInr(fees.annual_fee_inr)} annual fee`}${domLounge ? `, ${domLounge} domestic lounge access` : ""}.`,
    category: identity.primary_category,
    brand: {
      "@type": "BankOrCreditUnion",
      name: identity.bank,
    },
    provider: {
      "@type": "BankOrCreditUnion",
      name: identity.bank,
    },
    areaServed: {
      "@type": "Country",
      name: "India",
    },
    feesAndCommissionsSpecification: `Joining fee ${formatInr(fees.joining_fee_inr, true)}, Annual fee ${fees.annual_fee_inr === 0 ? "₹0 (Lifetime Free)" : formatInr(fees.annual_fee_inr)}, Forex markup ${fees.forex_markup_pct}% + GST.`,
    offers: {
      "@type": "Offer",
      price: fees.annual_fee_inr,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: canonicalUrl,
    },
    ...(ratings.overall_market_rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.max(1, Math.min(5, Number(ratings.overall_market_rating.toFixed(2)))),
            bestRating: 5,
            worstRating: 1,
            ratingCount: Math.max(12, dossier.reddit_user_feedback?.reddit_mentions || 12),
          },
        }
      : {}),
  };
}

export function buildCollectionJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  itemCount: number;
}) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${siteUrl}${opts.path}`,
    isPartOf: { "@id": `${siteUrl}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.itemCount,
    },
  };
}

export function buildWebAppJsonLd(opts: {
  name: string;
  description: string;
  path: string;
}) {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: opts.name,
    description: opts.description,
    url: `${siteUrl}${opts.path}`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
    },
  };
}
