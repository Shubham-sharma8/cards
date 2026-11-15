import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankHelpDetailClient } from "@/components/BankHelpDetailClient";
import { JsonLd } from "@/components/JsonLd";
import { BANK_HELP_DIRECTORY } from "@/lib/bankHelpDirectory";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return BANK_HELP_DIRECTORY.map((b) => ({ bankSlug: b.bank_slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bankSlug: string }>;
}): Promise<Metadata> {
  const { bankSlug } = await params;
  const bank = BANK_HELP_DIRECTORY.find((b) => b.bank_slug === bankSlug);
  if (!bank) {
    return buildPageMetadata({
      title: "Bank Support Not Found | Cards by cogify",
      description: "Credit card helpline and L1/L2/PNO directory.",
      path: "/help",
    });
  }
  return buildPageMetadata({
    title: `${bank.bank} Helpline, Card Block & PNO | Cards by cogify`,
    description: `24x7 care (${bank.helplineTollFree}), lost card block (${bank.cardBlockNumber}), L1 support, L2 Nodal Officer, and L3 PNO (${bank.l3PnoEmail}).`,
    path: `/help/${bank.bank_slug}`,
    ogParams: { type: "home" },
    ogAlt: `${bank.bank} Credit Card Support & PNO Desk`,
  });
}

export default async function BankHelpDetailPage({
  params,
}: {
  params: Promise<{ bankSlug: string }>;
}) {
  const { bankSlug } = await params;
  const bank = BANK_HELP_DIRECTORY.find((b) => b.bank_slug === bankSlug);
  if (!bank) notFound();

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Help & Escalation", path: "/help" },
          { name: bank.bank, path: `/help/${bank.bank_slug}` },
        ])}
      />
      <BankHelpDetailClient bank={bank} />
    </>
  );
}
