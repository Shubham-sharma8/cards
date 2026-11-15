"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Building2,
  ExternalLink,
  PhoneCall,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  BANK_HELP_DIRECTORY,
  RBI_OMBUDSMAN_INFO,
} from "@/lib/bankHelpDirectory";
import { BankLogo } from "./BankLogo";
import { sanitizeExternalHref } from "@/lib/security";
import { LEDGER_EASE } from "@/lib/motion";

export function HelpCenterClient() {
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"banks" | "rbi">("banks");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BANK_HELP_DIRECTORY;
    return BANK_HELP_DIRECTORY.filter((entry) =>
      `${entry.bank} ${entry.bank_slug} ${entry.helplineTollFree} ${entry.l1Email} ${entry.l2NodalEmail} ${entry.l3PnoEmail} ${entry.governanceEmail}`
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  const rbiHref = sanitizeExternalHref(RBI_OMBUDSMAN_INFO.portalUrl) || "https://cms.rbi.org.in";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-7">
      {/* Header + Clean Section Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E4E4DF] pb-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#0F5C4D] font-medium">
            <span>All {BANK_HELP_DIRECTORY.length} Credit Card Issuers</span>
            <span className="text-[#CBD5E1]">•</span>
            <span>RBI Grievance Redressal</span>
          </div>
          <h1 className="text-[28px] sm:text-[34px] font-medium text-[#1A1D21] tracking-[-0.02em] leading-tight">
            Credit Card Helplines, L1 / L2 / L3 PNO &amp; Escalation
          </h1>
          <p className="text-[14.5px] text-[#4B525C] max-w-2xl leading-relaxed">
            Tap any bank below to open its dedicated Direct Dial helpline, instant card block, and L1/L2/L3 Principal Nodal Officer page.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection("banks")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
              activeSection === "banks"
                ? "bg-[#0F5C4D] text-white"
                : "bg-white border border-[#E4E4DF] text-[#4B525C]"
            }`}
          >
            Banks ({BANK_HELP_DIRECTORY.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("rbi")}
            className={`px-4 py-2 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer ${
              activeSection === "rbi"
                ? "bg-[#0F5C4D] text-white"
                : "bg-white border border-[#E4E4DF] text-[#4B525C]"
            }`}
          >
            RBI Ombudsman &amp; 1930
          </button>
        </div>
      </div>

      {/* Section 1: RBI Escalation + Emergency 1930 */}
      {activeSection === "rbi" && (
        <div className="bg-white border border-[#E4E4DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F5C4D]">
                RBI Integrated Ombudsman Scheme · 4-Tier Redressal
              </span>
              <h2 className="text-[20px] font-semibold text-[#1A1D21] mt-0.5">
                Escalation Timeline &amp; Emergency Fraud Dial
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="tel:1930"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-[#B42318] hover:bg-[#991B1B] text-white px-4 py-2 rounded-lg transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial 1930 · Cyber Fraud</span>
              </a>
              <a
                href="tel:14448"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-[#EEF5F2] border border-[#CBE0D7] text-[#0F5C4D] px-4 py-2 rounded-lg"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial 14448 · RBI CRPC</span>
              </a>
              <a
                href={rbiHref}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-[#0F5C4D] hover:bg-[#0B463B] text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>RBI CMS Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                step: "Level 1 · Day 0–7",
                title: "24×7 Care & L1 Email Desk",
                desc: "Call the toll-free number or email L1 customer care. Always record your Complaint / Service Request (SR) ticket ID.",
                tone: "border-[#E4E4DF] bg-[#FAF9F6]",
                badge: "bg-[#EEF5F2] text-[#0F5C4D]",
                icon: PhoneCall,
              },
              {
                step: "Level 2 · Day 7–14",
                title: "Bank Nodal Grievance Officer",
                desc: "Escalate unresolved L1 complaints to the bank Grievance Officer citing your original SR number.",
                tone: "border-[#E4E4DF] bg-[#FAF9F6]",
                badge: "bg-[#EFF6FF] text-[#1D4ED8]",
                icon: Building2,
              },
              {
                step: "Level 3 · Day 14–21",
                title: "Principal Nodal Officer (PNO)",
                desc: "Write to the bank's L3 PNO & Compliance/Governance desk with dates, prior SR IDs, and exact ₹ dispute.",
                tone: "border-[#F2D7B4] bg-[#FEF6EA]/50",
                badge: "bg-[#FEF6EA] text-[#9A5B13]",
                icon: ShieldCheck,
              },
              {
                step: "Level 4 · After 30 Days",
                title: "RBI Ombudsman (cms.rbi.org.in)",
                desc: "Zero fee. Escalate free via RBI CMS portal or helpline 14448 if unresolved after 30 calendar days.",
                tone: "border-[#CBE0D7] bg-[#EEF5F2]/60",
                badge: "bg-[#0F5C4D] text-white",
                icon: Scale,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04, ease: LEDGER_EASE }}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-2 ${item.tone}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${item.badge}`}>
                      {item.step}
                    </span>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1A1D21]">{item.title}</h3>
                    <p className="text-[12px] text-[#4B525C] mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12.5px] text-[#991B1B]">
            <div className="flex items-start sm:items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Unauthorized Transaction / Cyber Fraud?</strong> Freeze card immediately via bank app, report on{" "}
                <span className="font-semibold">National Cyber Helpline 1930</span> &amp; email L1 + PNO within 3 working days for RBI zero-liability protection.
              </span>
            </div>
            <span className="text-[11.5px] font-medium shrink-0 bg-white/80 px-2.5 py-1 rounded border border-[#FECACA]">
              RBI CRPC: 14448 · crpc@rbi.org.in
            </span>
          </div>
        </div>
      )}

      {/* Section 2: Clean Square Bank Icon Grid -> Dedicated /help/[bankSlug] Pages */}
      {activeSection === "banks" && (
        <>
          <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#717882] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bank, PNO email, helpline (e.g. HDFC, SBI, Axis, Amex)..."
                className="w-full h-10 pl-9 pr-3 text-[14px] bg-[#FAF9F6] border border-[#E4E4DF] rounded-lg focus:outline-none focus:border-[#0F5C4D]"
              />
            </div>

            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[#0F5C4D] hover:underline cursor-pointer self-start sm:self-auto"
              >
                Clear search
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="text-[13px] text-[#717882]">
              Showing {filtered.length} of {BANK_HELP_DIRECTORY.length} banks · Click any square tile to open its dedicated support desk
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {filtered.map((bank) => (
                <Link
                  key={bank.bank_slug}
                  href={`/help/${bank.bank_slug}`}
                  className="bg-white border border-[#E4E4DF] hover:border-[#0F5C4D] hover:bg-[#FAF9F6] rounded-2xl p-4 aspect-square flex flex-col items-center justify-center text-center gap-2.5 transition-all shadow-xs"
                >
                  <BankLogo bank={bank.bank} bankSlug={bank.bank_slug} size="xl" />
                  <span className="text-[12.5px] font-semibold text-[#1A1D21] line-clamp-2 leading-snug">
                    {bank.bank}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Accuracy Note */}
      <div className="bg-[#F3F2EE] border border-[#E4E4DF] rounded-xl p-4 text-[12px] text-[#4B525C] leading-relaxed">
        <strong>Verification Note:</strong> All toll-free helplines and statutory L1/L2/L3 Principal Nodal Officer emails follow published Reserve Bank of India (RBI) grievance escalation policies. Regional nodal desk mail IDs or branch telephone extensions can change periodically — click{" "}
        <strong>Grievance Policy</strong> inside any bank&apos;s page to confirm directly on the bank&apos;s official website.
      </div>
    </div>
  );
}
