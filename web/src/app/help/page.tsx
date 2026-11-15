import React, { Suspense } from "react";
import type { Metadata } from "next";
import { HelpCenterClient } from "@/components/HelpCenterClient";
import { JsonLd } from "@/components/JsonLd";
import { BANK_HELP_DIRECTORY } from "@/lib/bankHelpDirectory";
import { buildBreadcrumbJsonLd, buildCollectionJsonLd, buildPageMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: `Credit Card Helplines & L1/L2/PNO (${BANK_HELP_DIRECTORY.length} Banks) | Cards by cogify`,
    description: `Verified 24x7 helplines, card blocking numbers, L1 Support, L2 Nodal Officers, L3 PNO emails, and RBI Ombudsman steps across ${BANK_HELP_DIRECTORY.length} banks.`,
    path: "/help",
    ogParams: { type: "home" },
    ogAlt: "Credit Card Helpline, L1/L2/L3 PNO & Grievance Escalation Matrix",
  });
}

export default function HelpPage() {
  return (
    <>
      <JsonLd
        data={buildCollectionJsonLd({
          name: "Indian Credit Card Helplines, L1/L2/L3 PNO & Grievance Redressal Directory",
          description: `L1, L2 Nodal Officer, L3 Principal Nodal Officer, Governance email, and 24x7 toll-free numbers for all ${BANK_HELP_DIRECTORY.length} Indian issuers.`,
          path: "/help",
          itemCount: BANK_HELP_DIRECTORY.length,
        })}
      />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Help & Escalation", path: "/help" },
        ])}
      />
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-[14px] text-[#717882]">
            Loading bank escalation matrix...
          </div>
        }
      >
        <HelpCenterClient />
      </Suspense>
    </>
  );
}
