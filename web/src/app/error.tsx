"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Cards by cogify runtime error:", error);
  }, [error]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <div className="bg-white border border-[#E4E4DF] rounded-xl p-8 text-center space-y-4">
        <span className="inline-block text-[12px] bg-[#FEF6EA] text-[#9A5B13] px-3 py-1 rounded-md">
          Temporary View Error
        </span>
        <h1 className="text-[24px] font-medium text-[#1A1D21]">
          Something interrupted this view
        </h1>
        <p className="text-[14px] text-[#4B525C] max-w-md mx-auto leading-relaxed">
          Please retry loading the page. No card data was modified.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#0F5C4D] hover:bg-[#0B473B] text-white text-[13.5px] font-medium rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 bg-[#FAF9F6] border border-[#E4E4DF] text-[#1A1D21] text-[13.5px] rounded-lg"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
