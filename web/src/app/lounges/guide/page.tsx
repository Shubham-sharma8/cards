import React from "react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { LoungeGuideClient } from "@/components/LoungeGuideClient";
import { getLoungeCatalog } from "@/lib/data";
import { buildBreadcrumbJsonLd, buildPageMetadata, getSiteUrl } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Airport Lounge QR Portals & Claim Guide — Cards by cogify",
  description:
    "Match LoungeOne.ai, HOI LMS, TFS Lounge Access & Priority Pass to every Indian airport terminal and generate a cardless QR pass in 4 steps.",
  path: "/lounges/guide",
  ogParams: { type: "lounge" },
  ogAlt: "Airport Lounge QR Claim Guide & Portal Directory — Cards by cogify",
});

export default function LoungeGuidePage() {
  const catalog = getLoungeCatalog();
  const siteUrl = getSiteUrl();

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Generate an Instant Cardless QR Pass for Indian Airport Lounges",
    description:
      "Use official QR portals (LoungeOne.ai, Travel Food Services, HOI LMS, or DreamFolks) to verify credit card lounge eligibility and enter without carrying your physical card.",
    url: `${siteUrl}/lounges/guide`,
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Select the portal matching your airport terminal",
        text: "Open LoungeOne.ai, TFS (loungeaccess.travelfoodservices.com), HOI LMS (lms.hoi.in), or DreamFolks.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Enter your credit card number for live spend & quota check",
        text: "Link your card to check real-time complimentary lounge visits left and spend-threshold status.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Complete the refundable ₹2 or ₹25 OTP verification",
        text: "Verify one-time card tokenization via OTP; the ₹2/₹25 authorization reverses automatically.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Scan the generated QR pass at the lounge desk",
        text: "Show the mobile QR pass alongside your boarding pass for instant entry with no physical swipe.",
      },
    ],
  };

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Lounge & Golf", path: "/lounges" },
          { name: "QR Claim & Portal Guide", path: "/lounges/guide" },
        ])}
      />
      <JsonLd data={howToJsonLd} />
      <LoungeGuideClient catalog={catalog} />
    </>
  );
}
