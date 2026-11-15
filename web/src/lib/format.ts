import type { CategoryMetaItem, SpendCategoryKey } from "./types";

export const SPEND_CATEGORY_META: Record<
  SpendCategoryKey,
  { label: string; shortLabel: string; hint: string; defaultMonthlyInr: number; maxSliderInr: number }
> = {
  online_shopping_general: {
    label: "Online Shopping (D2C & General)",
    shortLabel: "Online",
    hint: "Apparel, electronics, D2C websites",
    defaultMonthlyInr: 8000,
    maxSliderInr: 100000,
  },
  amazon_flipkart_myntra: {
    label: "Amazon, Flipkart & Myntra",
    shortLabel: "Amazon / Flipkart",
    hint: "Marketplace & fashion portals",
    defaultMonthlyInr: 7000,
    maxSliderInr: 100000,
  },
  dining_swiggy_zomato: {
    label: "Dining, Swiggy & Zomato",
    shortLabel: "Dining",
    hint: "Food delivery & restaurants",
    defaultMonthlyInr: 5000,
    maxSliderInr: 60000,
  },
  groceries_quick_commerce: {
    label: "Groceries & Quick Commerce",
    shortLabel: "Groceries",
    hint: "Blinkit, Zepto, BigBasket, Instamart",
    defaultMonthlyInr: 6000,
    maxSliderInr: 60000,
  },
  travel_flights_hotels: {
    label: "Flights, Hotels & Holidays",
    shortLabel: "Travel",
    hint: "Airlines, OTAs, hotel bookings",
    defaultMonthlyInr: 8000,
    maxSliderInr: 150000,
  },
  upi_scan_and_pay: {
    label: "UPI Scan & Pay (RuPay)",
    shortLabel: "UPI QR",
    hint: "Kirana, metro, merchant QR scans",
    defaultMonthlyInr: 6000,
    maxSliderInr: 50000,
  },
  utilities_bills_telecom: {
    label: "Utilities, Bills & Telecom",
    shortLabel: "Utilities",
    hint: "Electricity, broadband, mobile recharges",
    defaultMonthlyInr: 4000,
    maxSliderInr: 50000,
  },
  fuel: {
    label: "Fuel (Petrol / Diesel)",
    shortLabel: "Fuel",
    hint: "BPCL, IOCL, HPCL, Shell",
    defaultMonthlyInr: 3500,
    maxSliderInr: 40000,
  },
  insurance: {
    label: "Insurance Premiums",
    shortLabel: "Insurance",
    hint: "Term, health, vehicle policies",
    defaultMonthlyInr: 2000,
    maxSliderInr: 50000,
  },
  education_rent_govt: {
    label: "Education, Rent & Govt/Tax",
    shortLabel: "Rent / Tax",
    hint: "Tuition fees, rent portals, GST/ITR",
    defaultMonthlyInr: 0,
    maxSliderInr: 100000,
  },
  international_forex_net_of_markup: {
    label: "International / Foreign Currency",
    shortLabel: "Forex Spend",
    hint: "FX POS, international subscriptions (net of markup)",
    defaultMonthlyInr: 0,
    maxSliderInr: 150000,
  },
  offline_general_other: {
    label: "Offline Retail & Other",
    shortLabel: "Offline",
    hint: "POS swipes, department stores",
    defaultMonthlyInr: 5000,
    maxSliderInr: 100000,
  },
};

export const SPEND_CATEGORY_KEYS = Object.keys(SPEND_CATEGORY_META) as SpendCategoryKey[];

export function formatInr(amount: number | null | undefined, showFreeForZero = false): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "N/A";
  if (showFreeForZero && amount === 0) return "₹0 (Free)";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.round(Math.abs(amount));
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

export function cardLocalImageUrl(localImagePath: string | null | undefined): string | null {
  if (!localImagePath) return null;
  // data/assets/card_images/hdfc-bank/hdfc-regalia-gold-credit-card.webp -> /card-images/hdfc-bank/hdfc-regalia-gold-credit-card.webp
  const prefix = "data/assets/card_images/";
  if (localImagePath.startsWith(prefix)) {
    return `/card-images/${localImagePath.slice(prefix.length)}`;
  }
  return null;
}

export function formatQuotaNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0";
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower.includes("unlimited") || Number(val) >= 999) return "Unlimited";
    return val;
  }
  if (val >= 999) return "Unlimited";
  return String(val);
}

export function formatLoungeQuota(
  visitsPerYear: number | string | null | undefined,
  visitsPerQuarter?: number | string | null | undefined,
  hasAccess = true
): string {
  if (!hasAccess) return "None";
  const yrStr = typeof visitsPerYear === "string" ? visitsPerYear.toLowerCase() : "";
  const qtrStr = typeof visitsPerQuarter === "string" ? visitsPerQuarter.toLowerCase() : "";
  const yrNum = typeof visitsPerYear === "number" ? visitsPerYear : Number(visitsPerYear);
  const qtrNum = typeof visitsPerQuarter === "number" ? visitsPerQuarter : Number(visitsPerQuarter);

  if (yrStr.includes("unlimited") || qtrStr.includes("unlimited") || yrNum >= 999 || qtrNum >= 999) {
    return "Unlimited";
  }
  if (!Number.isNaN(yrNum) && yrNum > 0) {
    return `${yrNum} / yr`;
  }
  if (!Number.isNaN(qtrNum) && qtrNum > 0) {
    return `${qtrNum} / qtr`;
  }
  return "Available";
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    better_ltf_alternative: "Lifetime Free Alternative",
    same_tier_competitor: "Same-Tier Competitor",
    upgrade_alternative: "Step-Up / Upgrade Option",
    category_standout_alternative: "Category Standout",
    current_card: "Current Card",
    category_peer: "Category Peer",
  };
  return map[role] || role.replace(/_/g, " ");
}

export function formatLoungeSourceType(sourceType?: string | null): string {
  if (!sourceType) return "Official Source";
  const norm = sourceType.trim().toUpperCase();
  const map: Record<string, string> = {
    OFFICIAL_PDF: "Official Bank PDF",
    OFFICIAL_BANK_PAGE: "Official Bank Page",
    CARD_NETWORK_LIST: "Card Network List",
    OFFICIAL_PARTNER_LIST: "Official Partner List",
    NETWORK_PORTAL: "Card Network List",
    ISSUER_PDF: "Official Bank PDF",
  };
  return map[norm] || sourceType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CATEGORY_META: CategoryMetaItem[] = [
  {
    id: "fuel",
    datasetCategory: "Fuel",
    label: "Fuel & Commute",
    shortLabel: "Fuel",
    description: "Co-branded HPCL, BPCL, IOCL & Shell cards giving 3%–7% net value after surcharge waiver.",
    whoShouldPick: "Daily riders & drivers spending ₹3,000+ monthly on petrol or diesel.",
    keyReturnKey: "fuel",
  },
  {
    id: "cashback",
    datasetCategory: "Cashback",
    label: "Direct Cashback",
    shortLabel: "Cashback",
    description: "No-nonsense statement credit and direct 1.5%–5% returns without point-conversion gymnastics.",
    whoShouldPick: "Anyone wanting predictable direct cash back on bills and online shopping.",
    keyReturnKey: "online_shopping_general",
  },
  {
    id: "online-shopping",
    datasetCategory: "Online Shopping",
    label: "Online Shopping",
    shortLabel: "Shopping",
    description: "Marketplaces like Amazon, Flipkart, Myntra & D2C brand portals with accelerated multipliers.",
    whoShouldPick: "E-commerce regulars ordering electronics, fashion, and home essentials online.",
    keyReturnKey: "amazon_flipkart_myntra",
  },
  {
    id: "travel",
    datasetCategory: "Travel & Miles",
    label: "Travel & Air Miles",
    shortLabel: "Travel",
    description: "Airline transfers, hotel partner points, travel portal 5X–10X rewards & trip protections.",
    whoShouldPick: "Frequent flyers taking 3+ domestic or international trips each year.",
    keyReturnKey: "travel_flights_hotels",
  },
  {
    id: "dining",
    datasetCategory: "Dining, Groceries & Movies",
    label: "Dining & Food Delivery",
    shortLabel: "Dining",
    description: "Up to 10%–15% back on Swiggy, Zomato, EazyDiner, fine dining & BOGO restaurant bills.",
    whoShouldPick: "Foodies, weekend diners, and frequent Swiggy/Zomato/EazyDiner spenders.",
    keyReturnKey: "dining_swiggy_zomato",
  },
  {
    id: "groceries",
    datasetCategory: "Dining, Groceries & Movies",
    label: "Groceries & Quick Commerce",
    shortLabel: "Groceries",
    description: "Accelerated returns on Blinkit, Zepto, BigBasket, DMart, Reliance Smart & supermarkets.",
    whoShouldPick: "Families buying weekly groceries online or at department stores.",
    keyReturnKey: "groceries_quick_commerce",
  },
  {
    id: "dining-groceries",
    datasetCategory: "Dining, Groceries & Movies",
    label: "Dining, Groceries & Movies",
    shortLabel: "Groceries & Dining",
    description: "Swiggy, Zomato, Blinkit, Zepto, BigBasket & BOGO movie ticket cards for weekly spends.",
    whoShouldPick: "Households ordering food delivery, quick groceries, and dining out weekly.",
    keyReturnKey: "groceries_quick_commerce",
  },
  {
    id: "utilities",
    datasetCategory: "Cashback",
    label: "Utility & Bill Payments",
    shortLabel: "Utilities",
    description: "Up to 10%–25% cashback on electricity, broadband, mobile recharge, gas & FASTag.",
    whoShouldPick: "Households routing Airtel, Jio, Tata Power & BBPS monthly bills via card.",
    keyReturnKey: "utilities_bills_telecom",
  },
  {
    id: "insurance",
    datasetCategory: "Cashback",
    label: "Insurance Premiums",
    shortLabel: "Insurance",
    description: "Cards that actually pay 3.3%–10% on LIC, term life, health & motor insurance renewals.",
    whoShouldPick: "Policyholders paying ₹25,000+ annual insurance premiums without MCC exclusions.",
    keyReturnKey: "insurance",
  },
  {
    id: "gold-jewellery",
    datasetCategory: "Super-Premium",
    label: "Gold & Jewellery Spends",
    shortLabel: "Gold & Jewellery",
    description: "Co-brand jewellery cards (Tanishq/Titan) plus uncapped base & milestone earners for bullion/jewels.",
    whoShouldPick: "Wedding shoppers & gold buyers avoiding cards that zero-out MCC 5944/5094.",
    keyReturnKey: "offline_general_other",
  },
  {
    id: "rupay-upi",
    datasetCategory: "RuPay & UPI",
    label: "RuPay Credit on UPI",
    shortLabel: "RuPay UPI",
    description: "Link directly to BHIM, GPay, PhonePe, or Paytm for Scan & Pay merchant QR rewards.",
    whoShouldPick: "Daily kirana, auto, pharmacy & offline QR spenders in India.",
    keyReturnKey: "upi_scan_and_pay",
  },
  {
    id: "lounge",
    datasetCategory: "Airport Lounge",
    label: "Airport & Railway Lounge",
    shortLabel: "Lounges",
    description: "Complimentary domestic airport, international Priority Pass & IRCTC railway lounge visits.",
    whoShouldPick: "Travelers checking both no-spend-condition and quarterly spend-linked access.",
    keyReturnKey: "travel_flights_hotels",
  },
  {
    id: "forex",
    datasetCategory: "Zero/Low Forex",
    label: "Zero & Low Forex",
    shortLabel: "Forex",
    description: "0% to 1.99% foreign currency markup cards for international trips and USD subscriptions.",
    whoShouldPick: "Abroad travelers, remote workers paying SaaS tools, and students.",
    keyReturnKey: "international_forex_net_of_markup",
  },
  {
    id: "super-premium",
    datasetCategory: "Super-Premium",
    label: "Super-Premium & Metal",
    shortLabel: "Super-Premium",
    description: "Invite-only & marquee metal cards with unlimited lounges, concierge & 1:1 airline transfers.",
    whoShouldPick: "High spenders above ₹8L/yr who optimize points transfers & milestone perks.",
    keyReturnKey: "travel_flights_hotels",
  },
  {
    id: "ltf",
    datasetCategory: "Lifetime Free",
    label: "Lifetime Free (LTF)",
    shortLabel: "Lifetime Free",
    description: "₹0 joining and ₹0 renewal fee forever—zero pressure to chase annual fee waiver targets.",
    whoShouldPick: "First-time holders, backup UPI cards, or low-to-moderate monthly spenders.",
    keyReturnKey: "online_shopping_general",
  },
  {
    id: "entry-fd",
    datasetCategory: "Entry-Level & Secured (FD)",
    label: "Beginners & FD Starter",
    shortLabel: "Beginners / FD",
    description: "First-time unsecured & fixed-deposit backed cards for students & zero-credit-history builders.",
    whoShouldPick: "Students, newcomers without salary slips, or credit builders below 720 CIBIL.",
    keyReturnKey: "offline_general_other",
  },
  {
    id: "business-tax",
    datasetCategory: "Business & Tax",
    label: "Tax, Govt & Business GST",
    shortLabel: "Tax & Govt",
    description: "Advance tax, GST challans, govt portal payments, vendor billing & MSME commercial cards.",
    whoShouldPick: "Founders, self-employed professionals, and taxpayers avoiding tax MCC exclusions.",
    keyReturnKey: "education_rent_govt",
  },
  {
    id: "golf",
    datasetCategory: "Golf",
    label: "Golf & Club Access",
    shortLabel: "Golf",
    description: "Complimentary domestic & international green fee waivers, tee-offs & private coaching lessons.",
    whoShouldPick: "Golfers & lifestyle spenders seeking free rounds, coaching lessons, and green fee waivers.",
    keyReturnKey: "offline_general_other",
  },
];

export function matchesTokenizedQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = haystack.toLowerCase();
  if (hay.includes(q)) return true;
  const tokens = q.split(/[\s,+/|-]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return true;
  return tokens.every((tok) => hay.includes(tok));
}

export interface FeeDisplayInfo {
  isSplit: boolean;
  label: string;
  primaryText: string;
  joiningText: string;
  annualText: string | null;
}

/**
 * Formats Joining Fee vs. Annual Fee:
 * Shows both Joining and Annual when they differ; otherwise shows only Joining Fee.
 */
export function formatFeeDisplay(
  joiningFeeInr: number | undefined | null,
  annualFeeInr: number
): FeeDisplayInfo {
  const joining = joiningFeeInr ?? annualFeeInr;
  const fmt = (val: number) => (val === 0 ? "₹0 (LTF)" : `₹${Math.round(val).toLocaleString("en-IN")}`);
  if (joining !== annualFeeInr) {
    return {
      isSplit: true,
      label: "Joining / Annual",
      primaryText: `Join ${fmt(joining)} · Annual ${annualFeeInr === 0 ? "₹0" : fmt(annualFeeInr)}`,
      joiningText: joining === 0 ? "₹0" : fmt(joining),
      annualText: annualFeeInr === 0 ? "₹0" : fmt(annualFeeInr),
    };
  }
  return {
    isSplit: false,
    label: "Joining Fee",
    primaryText: fmt(joining),
    joiningText: fmt(joining),
    annualText: null,
  };
}
