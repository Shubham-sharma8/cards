import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { getAllCardsAsync, getBanksIndexAsync } from "@/lib/data";

export default async function NotFound() {
  const [cards, banksIndex] = await Promise.all([getAllCardsAsync(), getBanksIndexAsync()]);
  const cardCount = cards.length;
  const bankCount = banksIndex.total_banks;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="bg-white border border-[#E4E4DF] rounded-xl p-8 text-center space-y-4">
        <span className="inline-block text-[12px] bg-[#EEF5F2] text-[#0F5C4D] px-3 py-1 rounded-md">
          404 · Page Not Found
        </span>
        <h1 className="text-[26px] font-medium text-[#1A1D21] tracking-[-0.015em]">
          We couldn&apos;t find that credit card or page
        </h1>
        <p className="text-[14px] text-[#4B525C] max-w-lg mx-auto leading-relaxed">
          The URL may have changed or been discontinued by the issuer. Browse all {cardCount} active
          Indian credit cards across {bankCount} banks below.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/cards"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[13.5px] font-medium rounded-lg transition-colors"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            Explore All Cards
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FAF9F6] border border-[#E4E4DF] hover:border-[#C9C9C2] text-[#1A1D21] text-[13.5px] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
