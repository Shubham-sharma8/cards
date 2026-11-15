import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { MotionShell } from "@/components/MotionShell";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { getSiteCounts } from "@/lib/data";
import { buildOrganizationAndWebsiteJsonLd, getSiteUrl } from "@/lib/seo";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const siteUrl = getSiteUrl();

export function generateMetadata(): Metadata {
  const { totalCards: cardCount, totalBanks: bankCount } = getSiteCounts();
  const ogImg = "/og?type=home";

  return {
    metadataBase: new URL(siteUrl),
    applicationName: "Cards by cogify",
    title: {
      default: `Cards by cogify — Clear Math for ${cardCount} Indian Credit Cards`,
      template: "%s",
    },
    description: `Compare ${cardCount} Indian credit cards across ${bankCount} banks: real post-cap cashback calculator, airport & railway lounges, MITC fees, pro optimization hacks, and RBI L1/L2/PNO helplines.`,
    keywords: [
      "Cards by cogify",
      "card.cogify.me",
      "cogify.me",
      "Indian credit cards",
      "best credit cards in India 2026",
      "credit card cashback calculator India",
      "credit card airport lounge list India",
      "spend based lounge access India",
      "RuPay UPI credit cards India",
      "HSBC Live+ cashback cap 1200",
      "Cashback SBI card review",
      "HDFC Infinia SmartBuy calculator",
      "zero forex credit cards India",
      "credit card devaluation tracker 2026",
      "credit card comparison India",
      "bank L1 L2 PNO escalation helpline",
    ],
    authors: [{ name: "cogify.me", url: "https://cogify.me" }],
    creator: "cogify.me",
    publisher: "cogify.me",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      siteName: "Cards by cogify",
      url: "/",
      title: `Cards by cogify — Clear Math for ${cardCount} Indian Credit Cards`,
      description: `Compare reward rates, spend-based lounge conditions, MITC charges, and devaluation risk across ${cardCount} active Indian credit cards.`,
      images: [
        {
          url: ogImg,
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `Cards by cogify — ${cardCount} Indian Credit Cards & Airport Lounge Directory`,
        },
        {
          url: "/og-default.png",
          width: 1200,
          height: 630,
          type: "image/png",
          alt: "Cards by cogify — card.cogify.me",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@cogifyme",
      creator: "@cogifyme",
      title: `Cards by cogify — Clear Math for ${cardCount} Indian Credit Cards`,
      description: `Unbiased Indian credit card finder, spend-to-cashback calculator, and official lounge list index across ${bankCount} banks.`,
      images: [ogImg],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { totalCards: cardCount, totalBanks: bankCount } = getSiteCounts();
  const orgJsonLd = buildOrganizationAndWebsiteJsonLd(cardCount, bankCount);

  return (
    <html lang="en-IN" className={`${ibmPlexSans.variable} h-full antialiased`}>
      <head>
        <link
          rel="preconnect"
          href="https://pub-8a560aaca6404206b9adcd66799b1cee.r2.dev"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://pub-8a560aaca6404206b9adcd66799b1cee.r2.dev"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#FAF9F6] text-[#1A1D21]">
        <JsonLd data={orgJsonLd} />
        <MotionShell>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </MotionShell>
      </body>
    </html>
  );
}
