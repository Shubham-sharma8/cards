import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ExternalLink } from "lucide-react";
import { getBanksIndexAsync, getDevaluationTrackerAsync } from "@/lib/data";
import { BankLogo } from "@/components/BankLogo";
import { MotionRevealCard } from "@/components/MotionReveal";
import { JsonLd } from "@/components/JsonLd";
import { sanitizeExternalHref } from "@/lib/security";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const idx = await getBanksIndexAsync();
  return buildPageMetadata({
    title: `All ${idx.total_banks} Credit Card Issuers in India — Cards by cogify`,
    description: `Complete index of ${idx.total_banks} Indian banks and credit card issuers (${idx.total_cards} active cards) with LTF availability, UPI RuPay options, lounge coverage, and devaluation risk.`,
    path: "/banks",
    ogParams: { type: "home" },
    ogAlt: `All ${idx.total_banks} Indian Credit Card Issuers — Cards by cogify`,
  });
}

export default async function BanksPage() {
  const [banksIndex, devalTracker] = await Promise.all([
    getBanksIndexAsync(),
    getDevaluationTrackerAsync(),
  ]);
  const profiles = devalTracker.issuer_devaluation_profiles || {};

  const banks = [...banksIndex.banks].sort((a, b) => b.total_cards - a.total_cards);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <JsonLd
        data={buildCollectionJsonLd({
          name: `All ${banksIndex.total_banks} Indian Credit Card Issuers`,
          description: `Directory of ${banksIndex.total_banks} Indian banks & credit card issuers covering ${banksIndex.total_cards} active credit cards.`,
          path: "/banks",
          itemCount: banksIndex.total_banks,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Banks & Issuers", path: "/banks" },
        ])}
      />
      <div className="border-b border-[#E4E4DF] pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            {banksIndex.total_banks} Verified Indian Issuers
          </span>
          <h1 className="text-[26px] sm:text-[30px] font-medium text-[#1A1D21] tracking-[-0.02em] mt-2">
            Credit Cards by Bank &amp; Issuer
          </h1>
          <p className="text-[14.5px] text-[#4B525C] mt-1">
            Browse all {banksIndex.total_cards} cards organized across {banksIndex.total_banks} banks,
            co-brand fintech issuers, and cooperative banks.
          </p>
        </div>

        <Link
          href="/devaluations"
          className="text-[13px] font-medium text-[#0F5C4D] hover:underline shrink-0"
        >
          View Devaluation Tracker →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banks.map((b, idx) => {
          const risk = profiles[b.bank];
          return (
            <MotionRevealCard
              key={b.bank_slug}
              delay={Math.min(idx * 0.02, 0.16)}
              className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D]/45 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <BankLogo bankSlug={b.bank_slug} bank={b.bank} size="md" className="mt-0.5" />
                    <div className="min-w-0">
                      <h2 className="text-[17px] font-medium text-[#1A1D21] truncate">{b.bank}</h2>
                      <span className="text-[12.5px] text-[#717882] tabular-nums">
                        {b.total_cards} {b.total_cards === 1 ? "card" : "cards"} indexed
                      </span>
                    </div>
                  </div>
                  {risk && (
                    <span
                      className={`text-[11.5px] px-2 py-0.5 rounded-md tabular-nums ${
                        risk.risk_score >= 7
                          ? "bg-[#FDF2F2] text-[#991B1B]"
                          : risk.risk_score >= 5
                            ? "bg-[#FEF6EA] text-[#9A5B13]"
                            : "bg-[#EEF5F2] text-[#0F5C4D]"
                      }`}
                    >
                      Risk {risk.risk_score}/10
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-[12.5px] tabular-nums">
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2">
                    <span className="text-[#717882] block text-[11px]">Lifetime Free</span>
                    <span className="text-[#1A1D21] font-medium">{b.ltf_count} cards</span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2">
                    <span className="text-[#717882] block text-[11px]">Domestic Lounge</span>
                    <span className="text-[#1A1D21] font-medium">{b.domestic_lounge_count} cards</span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2">
                    <span className="text-[#717882] block text-[11px]">RuPay UPI</span>
                    <span className="text-[#1A1D21] font-medium">{b.rupay_upi_count} cards</span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg px-3 py-2">
                    <span className="text-[#717882] block text-[11px]">Zero/Low Forex</span>
                    <span className="text-[#1A1D21] font-medium">{b.zero_or_low_forex_count} cards</span>
                  </div>
                </div>

                {b.official_lounge_programs?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#E4E4DF]">
                    <span className="text-[11.5px] text-[#717882] block mb-1">
                      Official Lounge Links:
                    </span>
                    <div className="flex flex-col gap-1">
                      {b.official_lounge_programs.slice(0, 2).map((lnk) => {
                        const safeHref = sanitizeExternalHref(lnk.url);
                        if (!safeHref) return null;
                        return (
                          <a
                            key={safeHref}
                            href={safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            referrerPolicy="no-referrer"
                            className="text-[12px] text-[#0F5C4D] hover:underline inline-flex items-center gap-1 truncate"
                          >
                            <span className="truncate">{lnk.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={`/cards?bank=${b.bank_slug}`}
                className="inline-flex items-center justify-between text-[13px] font-medium text-[#0F5C4D] bg-[#EEF5F2] hover:bg-[#E1EDE8] px-3.5 py-2 rounded-lg transition-colors"
              >
                <span>Explore {b.bank} Cards</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </MotionRevealCard>
          );
        })}
      </div>
    </div>
  );
}
