"use client";

import React, { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  QrCode,
  ShieldAlert,
  Train,
} from "lucide-react";
import type { LoungeCatalogPayload } from "@/lib/types";
import {
  getAirportClaimPortals,
  getPortalLoungeMappings,
} from "@/lib/loungeChecker";
import { resolveMediaUrl } from "@/lib/mediaCdn";
import { SearchParamsSync } from "./SearchParamsSync";

interface LoungeGuideClientProps {
  catalog: LoungeCatalogPayload;
}

type GuideTab = "portals" | "steps" | "rules";

export function LoungeGuideClient({ catalog }: LoungeGuideClientProps) {
  const [initialAirport, setInitialAirport] = useState("");
  const [activeTab, setActiveTab] = useState<GuideTab>("portals");

  const syncFromParams = useCallback((sp: URLSearchParams) => {
    const ap = (sp.get("airport") || "").toUpperCase().trim();
    const sec = sp.get("section");
    if (ap) setInitialAirport(ap);
    if (sec === "steps" || sec === "rules" || sec === "portals") {
      setActiveTab(sec);
    }
  }, []);

  const mappings = useMemo(() => getPortalLoungeMappings(), []);
  const airportPortals = useMemo(
    () => (initialAirport ? getAirportClaimPortals(initialAirport) : []),
    [initialAirport]
  );
  const airportPortalIds = useMemo(
    () => new Set(airportPortals.map((p) => p.id)),
    [airportPortals]
  );
  const rules = catalog.network_rules;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <SearchParamsSync onParams={syncFromParams} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={initialAirport ? `/lounges?airport=${encodeURIComponent(initialAirport)}` : "/lounges"}
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#0F5C4D] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Airport &amp; Lounge Finder
        </Link>
        <a
          href={resolveMediaUrl("/category-posters/lounge-claim-guide.png") || "/category-posters/lounge-claim-guide.png"}
          download="cardledger-lounge-claim-qr-guide-2026.png"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-2 rounded-lg bg-[#0F5C4D] hover:bg-[#0B473B] text-white transition-colors"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Save QR Guide Poster
        </a>
      </div>

      {/* Header & Section Tabs */}
      <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0F5C4D] bg-[#EEF5F2] px-2.5 py-1 rounded-md">
            <QrCode className="w-3.5 h-3.5" />
            Cardless QR Guide &amp; Official Websites
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold text-[#1A1D21] tracking-tight">
            Which Portal Fits Which Indian Airport Lounge
          </h1>
          <p className="text-[14px] text-[#4B525C] max-w-2xl">
            Generate your QR pass in 60 seconds before security check — match each terminal operator to its official website or check network validation traps below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {(
            [
              { id: "portals", label: "Portals by Airport & Lounge" },
              { id: "steps", label: "4-Step Online QR Procedure" },
              { id: "rules", label: "Priority Pass & Network Auth Rules" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[42px] px-4 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-[#0F5C4D] text-white"
                  : "bg-[#F3F2EE] text-[#4B525C] hover:text-[#1A1D21]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "portals" && (
        <div className="space-y-4">
          {initialAirport && airportPortals.length > 0 && (
            <div className="bg-[#EEF5F2] border border-[#0F5C4D]/35 rounded-xl px-4 py-3 flex items-center gap-2.5 text-[14px] text-[#1A1D21]">
              <CheckCircle2 className="w-4 h-4 text-[#0F5C4D] shrink-0" />
              <span>
                For <strong>{initialAirport}</strong>, use{" "}
                <strong>{airportPortals.map((p) => p.name).join(" / ")}</strong> to claim your cardless QR pass.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mappings.map((item) => {
              const isMatch = initialAirport ? airportPortalIds.has(item.portal.id) : false;
              return (
                <div
                  key={item.portal.id}
                  className={`bg-white rounded-xl p-5 space-y-3.5 border ${
                    isMatch ? "border-[#0F5C4D] ring-1 ring-[#0F5C4D]/20" : "border-[#E4E4DF]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[#0F5C4D]" />
                        <h2 className="text-[16px] font-semibold text-[#1A1D21]">
                          {item.portal.name}
                        </h2>
                        {isMatch && (
                          <span className="text-[11px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-2 py-0.5 rounded-full">
                            {initialAirport} Match
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#4B525C] mt-0.5">{item.operators}</p>
                    </div>
                    <a
                      href={item.portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-2 rounded-lg bg-[#0F5C4D] hover:bg-[#0B473B] text-white shrink-0"
                    >
                      Open
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="pt-2 border-t border-[#E4E4DF] space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#0F5C4D]">
                      Which Lounges &amp; Airports
                    </div>
                    <p className="text-[13px] text-[#1A1D21] leading-relaxed">
                      {item.loungeExamples}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#E4E4DF] space-y-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4B525C]">
                      Eligible Cards
                    </div>
                    <p className="text-[13px] text-[#4B525C] leading-relaxed">
                      {item.acceptedCards}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.airports.map((ap) => (
                      <span
                        key={ap}
                        className="text-[11.5px] font-medium bg-[#FAF9F6] border border-[#E4E4DF] text-[#4B525C] px-2 py-0.5 rounded-md"
                      >
                        {ap}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "steps" && (
        <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                step: "Step 1 · Match Portal",
                title: "Pick Airport Website",
                body: "BOM/BLR/AMD -> LoungeOne.ai, DEL/HYD/GOX -> HOI LMS, MAA/CCU -> TFS Portal.",
                bg: "bg-[#EEF5F2] border-[#CBE0D7] text-[#0F5C4D]",
              },
              {
                step: "Step 2 · Check Quota",
                title: "Enter Card Details",
                body: "Add card number & expiry once to verify free visits or spend unlock balance.",
                bg: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1D4ED8]",
              },
              {
                step: "Step 3 · ₹2 Hold Auth",
                title: "Verify via OTP",
                body: "Authorize ₹2 or ₹25 refundable hold before reaching basement security queues.",
                bg: "bg-[#FAF9F6] border-[#E4E4DF] text-[#1A1D21]",
              },
              {
                step: "Step 4 · Scan QR",
                title: "Show Phone + Boarding Pass",
                body: "Scan the dynamic QR pass at the lounge desk — physical credit card not needed.",
                bg: "bg-[#FEF6EA] border-[#F2D7B4] text-[#9A5B13]",
              },
            ].map((st) => (
              <div key={st.step} className={`border rounded-xl p-3.5 space-y-1.5 ${st.bg}`}>
                <span className="text-[11px] font-semibold uppercase tracking-wide block">
                  {st.step}
                </span>
                <div className="text-[14px] font-semibold text-[#1A1D21]">{st.title}</div>
                <p className="text-[12.5px] text-[#4B525C] leading-snug">{st.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#E4E4DF] overflow-hidden bg-[#FAF9F6] p-2">
            <Image
              src={resolveMediaUrl("/category-posters/lounge-claim-guide.png") || "/category-posters/lounge-claim-guide.png"}
              alt="4-step Indian airport lounge QR claim guide"
              width={1200}
              height={760}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      )}

      {activeTab === "rules" && (
        <div className="space-y-4">
          {rules?.priority_pass_domestic_warning && (
            <div className="bg-[#FEF6EA] border border-[#EAD4AD] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#9A5B13] font-semibold text-[15px]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Priority Pass Domestic Fee Trap
              </div>
              <p className="text-[13.5px] text-[#1A1D21] leading-relaxed">
                {rules.priority_pass_domestic_warning}
              </p>
            </div>
          )}

          <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-[#1A1D21] font-semibold text-[15px]">
              <ShieldAlert className="w-4 h-4 text-[#0F5C4D]" />
              POS &amp; Online Authorization Charges
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13.5px]">
              {rules?.visa_validation_charge && (
                <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                  <div className="text-[11.5px] font-semibold uppercase text-[#0F5C4D] mb-1">
                    Visa &amp; RuPay
                  </div>
                  <p className="text-[#1A1D21]">{rules.visa_validation_charge}</p>
                </div>
              )}
              {rules?.mastercard_validation_charge && (
                <div className="bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg p-3.5">
                  <div className="text-[11.5px] font-semibold uppercase text-[#0F5C4D] mb-1">
                    Mastercard
                  </div>
                  <p className="text-[#1A1D21]">{rules.mastercard_validation_charge}</p>
                </div>
              )}
            </div>
          </div>

          {rules?.irctc_railway_lounge_terms?.quota && (
            <div className="bg-white border border-[#E4E4DF] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#1A1D21] font-semibold text-[15px]">
                <Train className="w-4 h-4 text-[#0F5C4D]" />
                IRCTC Executive Railway Lounges
              </div>
              <p className="text-[13.5px] text-[#4B525C] leading-relaxed">
                {rules.irctc_railway_lounge_terms.quota}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
