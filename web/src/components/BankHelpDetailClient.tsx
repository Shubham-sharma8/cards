"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, PhoneCall, Scale, ShieldAlert, ShieldCheck, Building2 } from "lucide-react";
import { BANK_HELP_DIRECTORY, RBI_OMBUDSMAN_INFO, type BankHelpEntry } from "@/lib/bankHelpDirectory";
import { BankLogo } from "./BankLogo";
import { sanitizeExternalHref } from "@/lib/security";

function buildTelHref(raw: string): string {
  const first = raw.split("/")[0].replace(/\(.*?\)/g, "").replace(/[^\d+]/g, "");
  return first.length >= 4 ? `tel:${first}` : "";
}

function buildMailtoHref(email: string, bank: string, tier: string): string {
  const clean = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return "#";
  const subject = encodeURIComponent(`[${tier} Credit Card Escalation] - ${bank}`);
  return `mailto:${clean}?subject=${subject}`;
}

function CopyPill({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${value}`}
      className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded bg-[#F3F2EE] hover:bg-[#E7ECE9] text-[#4B525C] hover:text-[#0F5C4D] transition-colors cursor-pointer shrink-0"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-[#0F5C4D]" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>{label || "Copy"}</span>
        </>
      )}
    </button>
  );
}

export function BankHelpDetailClient({ bank }: { bank: BankHelpEntry }) {
  const portalHref = sanitizeExternalHref(bank.l1PortalUrl) || "#";
  const grievanceHref = sanitizeExternalHref(bank.grievancePageUrl) || "#";
  const careTelHref = buildTelHref(bank.helplineTollFree);
  const altTelHref = buildTelHref(bank.helplineAlt);
  const blockTelHref = buildTelHref(bank.cardBlockNumber);
  const pnoTelHref = buildTelHref(bank.pnoPhone);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/help"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#0F5C4D] hover:underline"
        >
          <span>← All {BANK_HELP_DIRECTORY.length} Banks</span>
        </Link>
        <Link
          href={`/cards?bank=${encodeURIComponent(bank.bank_slug)}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-3 py-1.5 rounded-lg"
        >
          <span>View {bank.bank} Credit Cards →</span>
        </Link>
      </div>

      {/* Bank Header */}
      <div className="bg-white border border-[#E4E4DF] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-sm">
        <div className="flex items-center gap-4">
          <BankLogo bank={bank.bank} bankSlug={bank.bank_slug} size="xl" />
          <div>
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#0F5C4D]">
              24×7 Support &amp; Grievance Desk
            </span>
            <h1 className="text-[24px] sm:text-[28px] font-semibold text-[#1A1D21] leading-tight">
              {bank.bank}
            </h1>
            <p className="text-[13.5px] text-[#4B525C] mt-0.5">
              Direct dial helplines, emergency blocking, and RBI-compliant L1 / L2 / L3 PNO contacts.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={portalHref}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium border border-[#E4E4DF] hover:border-[#0F5C4D] text-[#1A1D21] px-3.5 py-2 rounded-lg"
          >
            <span>Support Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href={grievanceHref}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-[#EEF5F2] text-[#0F5C4D] px-3.5 py-2 rounded-lg"
          >
            <span>Grievance Policy</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Direct Dial Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-[#E4E4DF] rounded-2xl p-5 space-y-3">
          <span className="block text-[12px] font-semibold uppercase tracking-wider text-[#0F5C4D]">
            24×7 Customer Care Helpline
          </span>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[20px] font-semibold text-[#1A1D21] tabular-nums">
              {bank.helplineTollFree}
            </p>
            <CopyPill value={bank.helplineTollFree.split("/")[0].trim()} />
          </div>
          {bank.helplineAlt && (
            <p className="text-[13.5px] text-[#4B525C]">Alternate / NRI: {bank.helplineAlt}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {careTelHref && (
              <a
                href={careTelHref}
                className="inline-flex items-center gap-2 text-[14px] font-semibold bg-[#0F5C4D] hover:bg-[#0B463B] text-white px-4 py-2.5 rounded-xl transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Direct Dial Care</span>
              </a>
            )}
            {altTelHref && altTelHref !== careTelHref && (
              <a
                href={altTelHref}
                className="inline-flex items-center gap-2 text-[14px] font-semibold bg-[#EEF5F2] text-[#0F5C4D] border border-[#CBE0D7] px-4 py-2.5 rounded-xl"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Dial Alt Line</span>
              </a>
            )}
          </div>
        </div>

        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-5 space-y-3">
          <span className="block text-[12px] font-semibold uppercase tracking-wider text-[#B42318]">
            Lost / Stolen Card Blocking
          </span>
          <p className="text-[19px] font-semibold text-[#7F1D1D] leading-snug">
            {bank.cardBlockNumber}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {blockTelHref && (
              <a
                href={blockTelHref}
                className="inline-flex items-center gap-2 text-[14px] font-semibold bg-[#B42318] hover:bg-[#991B1B] text-white px-4 py-2.5 rounded-xl transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Direct Dial Card Block</span>
              </a>
            )}
            <a
              href="tel:1930"
              className="inline-flex items-center gap-2 text-[14px] font-semibold bg-white text-[#991B1B] border border-[#FECACA] px-4 py-2.5 rounded-xl"
            >
              <span>Cyber Fraud: 1930</span>
            </a>
          </div>
        </div>
      </div>

      {/* L1 / L2 / L3 PNO & Governance */}
      <div className="bg-white border border-[#E4E4DF] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[19px] font-semibold text-[#1A1D21]">
              L1 / L2 / L3 Principal Nodal Officer Escalation
            </h2>
            <p className="text-[13.5px] text-[#4B525C]">
              Keep your Level 1 Service Request (SR) number before escalating to Nodal or PNO.
            </p>
          </div>
          {pnoTelHref && (
            <a
              href={pnoTelHref}
              className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold bg-[#FEF6EA] text-[#9A5B13] border border-[#F2D7B4] px-3.5 py-2 rounded-lg"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Dial PNO Desk ({bank.pnoPhone})</span>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-[#CBE0D7] bg-[#EEF5F2]/50 rounded-xl p-4 space-y-2">
            <span className="text-[12px] font-semibold text-[#0F5C4D] uppercase">
              L1 · Care ({bank.l1Sla})
            </span>
            <a
              href={buildMailtoHref(bank.l1Email, bank.bank, "L1")}
              className="block text-[14.5px] font-medium text-[#1A1D21] hover:text-[#0F5C4D] break-all"
            >
              {bank.l1Email}
            </a>
            <CopyPill value={bank.l1Email} label="Copy L1" />
          </div>

          <div className="border border-[#BFDBFE] bg-[#EFF6FF]/60 rounded-xl p-4 space-y-2">
            <span className="text-[12px] font-semibold text-[#1D4ED8] uppercase">
              L2 · Nodal ({bank.l2Sla})
            </span>
            <a
              href={buildMailtoHref(bank.l2NodalEmail, bank.bank, "L2 Nodal")}
              className="block text-[14.5px] font-medium text-[#1A1D21] hover:text-[#1D4ED8] break-all"
            >
              {bank.l2NodalEmail}
            </a>
            <CopyPill value={bank.l2NodalEmail} label="Copy L2" />
          </div>

          <div className="border border-[#F2D7B4] bg-[#FEF6EA]/60 rounded-xl p-4 space-y-2">
            <span className="text-[12px] font-semibold text-[#9A5B13] uppercase">
              L3 · PNO ({bank.pnoPhone})
            </span>
            <a
              href={buildMailtoHref(bank.l3PnoEmail, bank.bank, "L3 PNO")}
              className="block text-[14.5px] font-semibold text-[#1A1D21] hover:text-[#9A5B13] break-all"
            >
              {bank.l3PnoEmail}
            </a>
            <p className="text-[12.5px] text-[#4B525C] break-all">
              Gov: {bank.governanceEmail}
            </p>
            <CopyPill value={bank.l3PnoEmail} label="Copy PNO" />
          </div>
        </div>

        <p className="text-[13px] text-[#4B525C] bg-[#FAF9F6] border border-[#E4E4DF] rounded-xl px-4 py-3">
          <strong>Escalation Note:</strong> {bank.escalationNote}
        </p>
      </div>

      {/* RBI Fallback Bar */}
      <div className="bg-[#EEF5F2] border border-[#CBE0D7] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Scale className="w-5 h-5 text-[#0F5C4D] shrink-0 mt-0.5" />
          <div>
            <p className="text-[15px] font-semibold text-[#1A1D21]">
              Unresolved after 30 calendar days? Escalate to RBI Ombudsman
            </p>
            <p className="text-[13px] text-[#4B525C]">
              Zero fee · Free online portal at {RBI_OMBUDSMAN_INFO.portalUrl} or helpline 14448.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="tel:14448"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold bg-[#0F5C4D] text-white px-4 py-2 rounded-lg"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call 14448</span>
          </a>
          <a
            href={sanitizeExternalHref(RBI_OMBUDSMAN_INFO.portalUrl) || "https://cms.rbi.org.in"}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold bg-white text-[#0F5C4D] border border-[#CBE0D7] px-4 py-2 rounded-lg"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>RBI Portal</span>
          </a>
          <span className="sr-only">
            <Building2 />
          </span>
        </div>
      </div>
    </div>
  );
}
