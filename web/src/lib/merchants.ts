import type { CardSummaryItem, SpendCategoryKey } from "./types";
import { cappedMonthlyCategoryReward } from "./advisor";
import { isCardDiscontinuedForNewApplicants } from "./legacyCards";

export interface MerchantStatementVariant {
  variant_id: string;
  platform_label: string;
  statement_descriptor: string;
  sbi_cashback_rate_pct: number | null;
  sbi_cashback_status: "5%" | "1%" | "0% Exempt" | "Unverified";
  sbi_exemption_category: string | null;
  probable_mcc: string | null;
  effective_spend_category: SpendCategoryKey;
  payment_page_tip: string | null;
  comment: string | null;
  last_tried_date: string | null;
  source_sheet: string;
}

export interface MerchantBrandRecord {
  brand_slug: string;
  brand_name: string;
  website: string;
  domain: string;
  logo_path: string | null;
  primary_segment: string;
  default_spend_category: SpendCategoryKey;
  overall_sbi_status:
    | "5% Safe"
    | "Mixed — Check Statement Name"
    | "0% Exempt"
    | "Check Status";
  sbi_exemption_reason: string | null;
  has_descriptor_trap: boolean;
  payment_watchout: string;
  variants: MerchantStatementVariant[];
}

export interface MerchantDirectoryPayload {
  schema_version: string;
  source_sheet_url: string;
  total_brands: number;
  total_descriptors: number;
  segments: string[];
  brands: MerchantBrandRecord[];
}

export interface MerchantCardMatch {
  card: CardSummaryItem;
  isOwned: boolean;
  isSbiExemptZero: boolean;
  effectivePct: number;
  monthlyRewardInr: number;
  annualRewardInr: number;
  monthlyCapInr: number | null;
  reason: string;
}

export interface MerchantRecommendationResult {
  monthlySpendInr: number;
  bestOwned: MerchantCardMatch | null;
  backupOwned: MerchantCardMatch | null;
  topOwned: MerchantCardMatch[];
  bestPortfolioAddition: MerchantCardMatch | null;
  incrementalAnnualGainInr: number;
  topMarket: MerchantCardMatch[];
  specialHackNote: string | null;
}

const SBI_CB_ID = "sbi_cashback_sbi_card";

export function evaluateCardForMerchantVariant(
  card: CardSummaryItem,
  brand: MerchantBrandRecord,
  variant: MerchantStatementVariant,
  monthlySpendInr: number,
  ownedSet: Set<string>
): MerchantCardMatch {
  const isOwned = ownedSet.has(card.card_id);
  const spend = Math.max(500, monthlySpendInr);
  const cat = variant.effective_spend_category || brand.default_spend_category;

  // Base modeled calculation on the resolved MCC spend category
  const base = cappedMonthlyCategoryReward(card, cat, spend);
  let effPct = base.effectivePct;
  let monthlyReward = base.monthlyReward;
  let monthlyCap = base.monthlyCapInr;
  let isSbiExemptZero = false;
  let reason =
    effPct > 0
      ? `Earns ~${effPct.toFixed(1)}% in ${cat.replace(/_/g, " ")}${monthlyCap ? ` (₹${monthlyCap.toLocaleString("en-IN")}/mo cap)` : ""}`
      : "No accelerated reward in this exempt MCC";

  const cid = card.card_id;
  const slug = brand.brand_slug;

  // 1. Exact community-verified SBI Cashback behavior per statement descriptor
  if (cid === SBI_CB_ID) {
    if (variant.sbi_cashback_rate_pct === 0) {
      isSbiExemptZero = true;
      effPct = 0;
      monthlyReward = 0;
      monthlyCap = null;
      reason = `0% Exempt on SBI Cashback (${variant.sbi_exemption_category || "Excluded MCC"})`;
    } else if (variant.sbi_cashback_rate_pct === 1) {
      effPct = 1.0;
      monthlyCap = 2000;
      monthlyReward = Math.min(2000, spend * 0.01);
      reason = "1% base/aggregator rate on this statement descriptor (₹2,000/cycle limit)";
    } else if (variant.sbi_cashback_rate_pct === 5) {
      const cap = 2000;
      monthlyCap = cap;
      const eligibleSpend = (cap / 5) * 100; // ₹40,000
      const mainReward = Math.min(spend, eligibleSpend) * 0.05;
      const overflowReward = Math.max(0, spend - eligibleSpend) * 0.01;
      monthlyReward = mainReward + overflowReward;
      effPct = (monthlyReward / spend) * 100;
      reason = `5% online verified on descriptor '${variant.statement_descriptor}' (₹2,000/mo cycle cap)`;
    }
  }

  // 2. Co-brand & issuer platform superpowers that outshine generic category rate
  if (slug === "amazon" && cat === "amazon_flipkart_myntra") {
    if (cid === "icici_amazon_pay_icici_bank_credit_card") {
      effPct = 5.0;
      monthlyReward = spend * 0.05;
      monthlyCap = null;
      reason = "Unlimited 5% for Prime members on Amazon India (Lifetime Free)";
    }
  } else if (slug === "amazon" && cat === "insurance") {
    if (cid === "icici_amazon_pay_icici_bank_credit_card") {
      effPct = 2.0;
      monthlyReward = spend * 0.02;
      monthlyCap = null;
      reason = "2% flat cashback on Amazon Pay Insurance payments";
    }
  } else if (slug === "amazon" && cat === "utilities_bills_telecom") {
    if (cid === "icici_amazon_pay_icici_bank_credit_card") {
      effPct = 2.0;
      monthlyReward = spend * 0.02;
      monthlyCap = null;
      reason = "2% flat on Amazon Pay Utilities without MCC trap";
    }
  }

  if (
    (slug === "tanishq" || slug === "caratlane" || slug === "tata-neu" || slug === "bigbasket" || slug === "tata-1mg" || slug === "tatacliq") &&
    cid === "hdfc_bank_tata_neu_infinity_hdfc_bank_credit_card"
  ) {
    effPct = 5.0;
    monthlyCap = null;
    monthlyReward = spend * 0.05;
    reason =
      slug === "tanishq" || slug === "caratlane"
        ? "5% NeuCoins via Tata Neu app on Tanishq & CaratLane (beats Jewellery MCC 0% cards!)"
        : "5% NeuCoins on Tata Neu partner brands (+up to 5% NeuPass bonus)";
  }

  if ((slug === "zepto" || slug === "blinkit" || slug === "bigbasket") && cid === "hsbc_bank_live_plus_credit_card") {
    const cap = 1000;
    monthlyCap = cap;
    const cappedAmt = Math.min(spend, 10000) * 0.1 + Math.max(0, spend - 10000) * 0.015;
    monthlyReward = cappedAmt;
    effPct = (monthlyReward / spend) * 100;
    reason = "10% accelerated cashback on Grocery/Dining MCCs (₹1,000/mo cap, then 1.5%)";
  }

  if (slug === "swiggy") {
    if (cid === "hdfc_bank_swiggy_blck_hdfc_credit_card" || cid === "hdfc_bank_swiggy_credit_card") {
      const cap = 1500;
      monthlyCap = cap;
      monthlyReward = Math.min(spend, 15000) * 0.1 + Math.max(0, spend - 15000) * 0.01;
      effPct = (monthlyReward / spend) * 100;
      reason = "10% Swiggy cashback on Food, Instamart & Dineout (₹1,500/cycle cap)";
    } else if (cid === "hdfc_bank_swiggy_ornge_hdfc_credit_card") {
      monthlyCap = 1500;
      monthlyReward = Math.min(spend, 30000) * 0.05 + Math.max(0, spend - 30000) * 0.01;
      effPct = (monthlyReward / spend) * 100;
      reason = "5% Swiggy cashback up to ₹1,500/cycle";
    }
  }

  if (slug === "irctc" && (variant.probable_mcc || "").includes("4112")) {
    if (cid === "sbi_card_irctc_sbi_premier_credit_card") {
      effPct = 10.0;
      monthlyReward = spend * 0.1;
      reason = "Up to 10% Value Back as Reward Points on AC train bookings via IRCTC";
    }
  }

  if ((slug === "income-tax-tin2" || slug === "nps-trust") && cid.includes("biz_black")) {
    effPct = 16.5;
    monthlyReward = Math.min(spend * 0.165, 7500);
    reason = "5X accelerated Reward Points on Income Tax / GST via PayZapp & Govt portals";
  }

  // Urban Company / Utilities MCC 0% penalty on cards that exclude Utility/Service MCCs
  if (cat === "utilities_bills_telecom" && variant.sbi_cashback_rate_pct === 0) {
    if (cid === "hdfc_bank_millennia_credit_card" || cid === "hdfc_bank_swiggy_blck_hdfc_credit_card") {
      // Utility stays at 1% base on Millennia/Swiggy BLCK
      const safeCap = Math.min(spend * 0.01, 1000);
      if (effPct > 1.5) {
        effPct = 1.0;
        monthlyReward = safeCap;
        reason = "1% base cashback on utility MCC transactions";
      }
    }
  }

  return {
    card,
    isOwned,
    isSbiExemptZero,
    effectivePct: Math.max(0, effPct),
    monthlyRewardInr: Math.round(monthlyReward),
    annualRewardInr: Math.round(monthlyReward * 12),
    monthlyCapInr: monthlyCap,
    reason,
  };
}

export function recommendCardsForMerchant(params: {
  brand: MerchantBrandRecord;
  variant: MerchantStatementVariant;
  allCards: CardSummaryItem[];
  ownedIds: string[];
  monthlySpendInr: number;
}): MerchantRecommendationResult {
  const { brand, variant, allCards, ownedIds, monthlySpendInr } = params;
  const ownedSet = new Set(ownedIds);

  const ownedCards = allCards.filter((c) => ownedSet.has(c.card_id));
  const ownedMatches = ownedCards
    .map((c) => evaluateCardForMerchantVariant(c, brand, variant, monthlySpendInr, ownedSet))
    .sort(
      (a, b) =>
        b.monthlyRewardInr - a.monthlyRewardInr ||
        b.effectivePct - a.effectivePct ||
        b.card.overall_rating - a.card.overall_rating
    );

  const activeMarketMatches = allCards
    .filter((c) => !isCardDiscontinuedForNewApplicants(c))
    .map((c) => evaluateCardForMerchantVariant(c, brand, variant, monthlySpendInr, ownedSet))
    .sort(
      (a, b) =>
        b.monthlyRewardInr - a.monthlyRewardInr ||
        b.effectivePct - a.effectivePct ||
        (a.card.annual_fee_inr - b.card.annual_fee_inr) * 0.001 ||
        b.card.overall_rating - a.card.overall_rating
    );

  const bestOwned = ownedMatches[0] ?? null;
  const backupOwned = ownedMatches.length > 1 ? ownedMatches[1] : null;
  const bestNonOwned = activeMarketMatches.find((m) => !m.isOwned) ?? null;

  const currentOwnedMonthly = bestOwned?.monthlyRewardInr ?? 0;
  const bestMarketNotOwnedMonthly = bestNonOwned?.monthlyRewardInr ?? 0;
  const incrementalAnnualGainInr = Math.max(
    0,
    (bestMarketNotOwnedMonthly - currentOwnedMonthly) * 12
  );

  let specialHackNote: string | null = null;
  if (
    brand.brand_slug === "policybazaar" ||
    brand.brand_slug === "acko" ||
    (brand.brand_slug === "amazon" && variant.effective_spend_category === "insurance") ||
    variant.effective_spend_category === "utilities_bills_telecom"
  ) {
    specialHackNote =
      "Pro Hack: Buy Amazon Pay Gift Cards on Zepto using HSBC Live+ (10% up to ₹1,000/mo on ₹10k spend), load into Amazon Pay Wallet, and pay Insurance/Utility bills on Amazon or Policybazaar.";
  } else if (brand.brand_slug === "grt-jewellers") {
    specialHackNote =
      "Pro Hack: Avoid direct Jewellery POS (0% MCC 5944); buy GRT Gift Cards via Amazon ('AMAZON PAY INDIA PRIVATE') to unlock 5% cashback on SBI Cashback.";
  } else if (brand.has_descriptor_trap && variant.payment_page_tip) {
    specialHackNote = variant.payment_page_tip;
  }

  return {
    monthlySpendInr,
    bestOwned,
    backupOwned,
    topOwned: ownedMatches.slice(0, 3),
    bestPortfolioAddition:
      bestNonOwned && incrementalAnnualGainInr >= 300 ? bestNonOwned : null,
    incrementalAnnualGainInr,
    topMarket: activeMarketMatches.slice(0, 4),
    specialHackNote,
  };
}
