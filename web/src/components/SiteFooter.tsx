import React from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { getSiteCounts } from "@/lib/data";
import { CATEGORY_META } from "@/lib/format";

export function SiteFooter() {
  const { totalCards: cardCount, totalBanks: bankCount } = getSiteCounts();

  return (
    <footer className="bg-[#F3F2EE] border-t border-[#E4E4DF] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-[#E4E4DF]">
          <div className="lg:col-span-2 space-y-3 pr-4">
            <BrandLogo showTagline cardCount={cardCount} bankCount={bankCount} />
            <p className="text-[13.5px] text-[#4B525C] leading-relaxed max-w-md pt-1">
              Cards by cogify — an independent, numbers-first Indian credit card ledger covering {cardCount} active cards
              across {bankCount} banks. Built to show real post-cap return rates, applicable
              airport &amp; railway lounge lists, MITC fees, and{" "}
              <span className="text-[#1A1D21]">r/CreditCardsIndia</span> community insights
              without sales clutter.
            </p>
            <p className="text-[12.5px] font-medium text-[#1A1D21]">
              A product of{" "}
              <a
                href="https://cogify.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0F5C4D] hover:underline"
              >
                cogify.me ❤️
              </a>
            </p>
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-[#1A1D21] mb-3">
              Categories &amp; Finders
            </h3>
            <ul className="space-y-2 text-[13px] text-[#4B525C]">
              <li>
                <Link href="/categories" prefetch={false} className="hover:text-[#0F5C4D]">
                  All {CATEGORY_META.length} Card Categories
                </Link>
              </li>
              <li>
                <Link href="/cards?cat=Fuel" prefetch={false} className="hover:text-[#0F5C4D]">
                  Fuel Credit Cards
                </Link>
              </li>
              <li>
                <Link href="/cards?cat=Cashback" prefetch={false} className="hover:text-[#0F5C4D]">
                  Cashback &amp; Online Shopping
                </Link>
              </li>
              <li>
                <Link href="/cards?cat=Travel%20%26%20Miles" prefetch={false} className="hover:text-[#0F5C4D]">
                  Travel &amp; Air Miles
                </Link>
              </li>
              <li>
                <Link href="/cards?rupay=1" prefetch={false} className="hover:text-[#0F5C4D]">
                  RuPay UPI &amp; LTF Cards
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-[#1A1D21] mb-3">
              Top Issuers
            </h3>
            <ul className="space-y-2 text-[13px] text-[#4B525C]">
              <li>
                <Link href="/cards?bank=hdfc-bank" prefetch={false} className="hover:text-[#0F5C4D]">
                  HDFC Bank
                </Link>
              </li>
              <li>
                <Link href="/cards?bank=sbi-card" prefetch={false} className="hover:text-[#0F5C4D]">
                  SBI Card
                </Link>
              </li>
              <li>
                <Link href="/cards?bank=icici-bank" prefetch={false} className="hover:text-[#0F5C4D]">
                  ICICI Bank
                </Link>
              </li>
              <li>
                <Link href="/cards?bank=axis-bank" prefetch={false} className="hover:text-[#0F5C4D]">
                  Axis Bank
                </Link>
              </li>
              <li>
                <Link href="/banks" prefetch={false} className="hover:text-[#0F5C4D]">
                  All {bankCount} Banks →
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[13px] font-medium text-[#1A1D21] mb-3">
              Tools &amp; Transparency
            </h3>
            <ul className="space-y-2 text-[13px] text-[#4B525C]">
              <li>
                <Link href="/advisor" prefetch={false} className="hover:text-[#0F5C4D]">
                  Personalized Card Advisor
                </Link>
              </li>
              <li>
                <Link href="/my-cards" prefetch={false} className="hover:text-[#0F5C4D]">
                  My Cards Wallet Optimizer
                </Link>
              </li>
              <li>
                <Link href="/calculator" prefetch={false} className="hover:text-[#0F5C4D]">
                  Spend &amp; Fee Waiver Calc
                </Link>
              </li>
              <li>
                <Link href="/lounges" prefetch={false} className="hover:text-[#0F5C4D]">
                  Airport &amp; Railway Lounges
                </Link>
              </li>
              <li>
                <Link href="/devaluations" prefetch={false} className="hover:text-[#0F5C4D]">
                  2024–2026 Devaluation Tracker
                </Link>
              </li>
              <li>
                <Link href="/compare" prefetch={false} className="hover:text-[#0F5C4D]">
                  Side-by-Side Comparison
                </Link>
              </li>
              <li>
                <Link href="/help" prefetch={false} className="hover:text-[#0F5C4D]">
                  Bank Helplines &amp; L1/L2/PNO Escalation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] text-[#717882]">
          <p>
            A product of{" "}
            <a
              href="https://cogify.me"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#1A1D21] hover:text-[#0F5C4D] hover:underline"
            >
              cogify.me ❤️
            </a>{" "}
            · Educational &amp; comparison ledger. Always verify final MITC terms, fee waivers,
            and lounge lists on the official bank PDF before applying.
          </p>
          <p className="tabular-nums shrink-0">
            card.cogify.me · Snapshot Nov 2026 · {cardCount} active cards
          </p>
        </div>
      </div>
    </footer>
  );
}
