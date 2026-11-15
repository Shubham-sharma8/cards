import type { Metadata } from "next";
import { getAllCardsAsync, getMerchantDirectory } from "@/lib/data";
import { MerchantsClient } from "@/components/MerchantsClient";
import { buildPageMetadata } from "@/lib/seo";

const directory = getMerchantDirectory();

export const metadata: Metadata = buildPageMetadata({
  title: `Merchant MCC & Statement Descriptor Advisor (${directory.total_brands} Brands)`,
  description:
    "Verify whether an Indian merchant or payment-page billing descriptor qualifies for SBI Cashback 5% or triggers a 0% MCC exemption (Utilities, Insurance, Railways, Rent, Jewellery). See which card in your wallet to swipe.",
  path: "/merchants",
  keywords: [
    "SBI Cashback MCC list",
    "SBI Cashback 0% excluded merchants",
    "credit card statement descriptor check",
    "merchant category code India credit card",
    "which credit card to use on merchant",
  ],
  ogParams: {
    type: "home",
    title: "Merchant MCC & Billing Descriptor Advisor",
    sub: `${directory.total_brands} brands · ${directory.total_descriptors} descriptors`,
  },
});

export default async function MerchantsPage() {
  const cards = await getAllCardsAsync();
  return <MerchantsClient directory={directory} cards={cards} />;
}
