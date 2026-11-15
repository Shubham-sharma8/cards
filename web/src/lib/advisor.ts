import type {
  AdvisorCardMeta,
  AdvisorPriorityMode,
  AdvisorProfile,
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from "./types";
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META } from "./format";
import {
  applyConversionStrategy,
  cardSupportsStrategy,
  normalizeMinMonthlyIncomeInr,
  type CardConversionResult,
} from "./conversion";
import { isCardDiscontinuedForNewApplicants } from "./legacyCards";

export interface CategoryLimitRow {
  key: SpendCategoryKey;
  label: string;
  monthlySpendInr: number;
  headlinePct: number;
  effectivePct: number;
  monthlyCapInr: number | null;
  poolLabel: string | null;
  uncappedMonthlyRewardInr: number;
  actualMonthlyRewardInr: number;
  lostToCapInr: number;
  isSaturated: boolean;
  isZeroOrExcluded: boolean;
}

export interface AdvisorLimitAlert {
  severity: "warning" | "info" | "positive";
  tag: string;
  title: string;
  detail: string;
}

export interface CardEvaluation {
  card: CardSummaryItem;
  annualSpendInr: number;
  uncappedGrossAnnualRewardInr: number;
  grossAnnualRewardsInr: number;
  monthlyRewardLostToCapsInr: number;
  waiverSpendInr: number | null;
  waiverMet: boolean;
  waiverShortfallInr: number;
  waiverProgressPct: number;
  effectiveFeeInr: number;
  netAnnualBenefitInr: number;
  netReturnPct: number;
  effectiveBlendedReturnPct: number;
  peakReturnPct: number;
  saturatedCategories: SpendCategoryKey[];
  categoryLimitRows: CategoryLimitRow[];
  loungeSpendGateStatus: "no_spend" | "unlocked" | "spend_shortfall" | "none";
  loungeQuarterlyShortfallInr: number;
  loungeSpendCriteriaText: string | null;
  milestoneEstimatedValueInr: number;
  devaluationRiskScore: number;
  devaluationFrequency: string;
  conversionResult: CardConversionResult;
  minRequiredIncomeInr: number | null;
  minRequiredCibil: number;
  approvalNotes: string | null;
  eligibilityStatus: "likely_eligible" | "income_stretch" | "cibil_stretch" | "fd_or_invite";
  eligibilityLabel: string;
  limitAlerts: AdvisorLimitAlert[];
  fitScore: number;
  reasons: string[];
  capNotes: string[];
  topCategories: Array<{ key: SpendCategoryKey; pct: number; effectivePct: number; annualReward: number }>;
}

export interface TwoCardComboResult {
  cardA: CardSummaryItem;
  cardB: CardSummaryItem;
  annualSpendInr: number;
  cardAAnnualSpendInr: number;
  cardBAnnualSpendInr: number;
  cardAWaiverTargetInr: number | null;
  cardBWaiverTargetInr: number | null;
  cardAWaiverMet: boolean;
  cardBWaiverMet: boolean;
  comboGrossRewardsInr: number;
  cardAFeeChargedInr: number;
  cardBFeeChargedInr: number;
  comboNetAnnualInr: number;
  singleBestNetAnnualInr: number;
  extraGainOverSingleInr: number;
  conversionStrategy: RewardConversionStrategy;
  cardAConversion: CardConversionResult;
  cardBConversion: CardConversionResult;
  convertedSummaryLabel: string | null;
  spilloverNotes: string[];
  categorySplit: Array<{
    key: SpendCategoryKey;
    monthlySpendInr: number;
    useCard: "A" | "B" | "SPLIT";
    bestPct: number;
    effectivePct: number;
    annualRewardInr: number;
    splitNote?: string;
  }>;
}

export const SHARED_CAP_POOLS: Record<
  string,
  Array<{ keys: SpendCategoryKey[]; combinedCapInr: number; label: string }>
> = {
  hsbc_bank_live_plus_credit_card: [
    {
      keys: [
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
        "utilities_bills_telecom",
      ],
      combinedCapInr: 1200,
      label: "10% Dining, Groceries & Utilities pool capped at ₹1,000–₹1,200/mo (1.5% base on Amazon/Flipkart/Myntra & excess)",
    },
  ],
  hsbc_bank_rupay_cashback_credit_card: [
    {
      keys: ["dining_swiggy_zomato", "groceries_quick_commerce"],
      combinedCapInr: 400,
      label: "10% Dining + Grocery pool capped at ₹400/mo (1% base after)",
    },
  ],
  sbi_cashback_sbi_card: [
    {
      keys: [
        "online_shopping_general",
        "amazon_flipkart_myntra",
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
        "travel_flights_hotels",
      ],
      combinedCapInr: 2000,
      label: "5% online cashback across portals capped at ₹2,000/cycle (Apr 2026; 1% after up to ₹2,000 offline)",
    },
  ],
  yes_bank_paisabazaar_paisasave_credit_card: [
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra"],
      combinedCapInr: 1500,
      label: "3%–6% online pool capped at ₹1,500/mo (1.5% after)",
    },
  ],
  hdfc_bank_swiggy_credit_card: [
    {
      keys: ["dining_swiggy_zomato", "groceries_quick_commerce"],
      combinedCapInr: 1500,
      label: "10% Swiggy pool capped at ₹1,500/mo",
    },
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra"],
      combinedCapInr: 1500,
      label: "5% online MCC pool capped at ₹1,500/mo",
    },
  ],
  hdfc_bank_swiggy_ornge_hdfc_credit_card: [
    {
      keys: ["dining_swiggy_zomato", "groceries_quick_commerce"],
      combinedCapInr: 1500,
      label: "10% Swiggy pool capped at ₹1,500/mo",
    },
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra"],
      combinedCapInr: 1500,
      label: "5% online MCC pool capped at ₹1,500/mo",
    },
  ],
  hdfc_bank_swiggy_blck_hdfc_credit_card: [
    {
      keys: ["dining_swiggy_zomato", "groceries_quick_commerce"],
      combinedCapInr: 2000,
      label: "10% Swiggy BLCK pool capped at ₹2,000/mo",
    },
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra"],
      combinedCapInr: 1500,
      label: "5% online MCC pool capped at ₹1,500/mo",
    },
  ],
  hdfc_bank_phonepe_ultimo_credit_card: [
    {
      keys: ["utilities_bills_telecom", "travel_flights_hotels", "insurance"],
      combinedCapInr: 1000,
      label: "10% PhonePe bill/travel/insurance pool capped at ₹1,000/mo",
    },
    {
      keys: ["amazon_flipkart_myntra", "groceries_quick_commerce", "dining_swiggy_zomato"],
      combinedCapInr: 500,
      label: "5% partner merchant pool capped at ₹500/mo",
    },
  ],
  hdfc_bank_phonepe_uno_credit_card: [
    {
      keys: ["utilities_bills_telecom", "travel_flights_hotels", "insurance"],
      combinedCapInr: 500,
      label: "2% PhonePe utility/travel pool capped at ₹500/mo",
    },
  ],
  sbi_bank_phonepe_select_black_credit_card: [
    {
      keys: ["utilities_bills_telecom", "travel_flights_hotels"],
      combinedCapInr: 1500,
      label: "10% PhonePe utility & travel pool capped at 1,500 RP/mo",
    },
    {
      keys: [
        "online_shopping_general",
        "amazon_flipkart_myntra",
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
      ],
      combinedCapInr: 1000,
      label: "5% online spend pool capped at 1,000 RP/mo",
    },
    {
      keys: ["upi_scan_and_pay", "offline_general_other"],
      combinedCapInr: 2000,
      label: "1% UPI & offline pool capped at 2,000 RP/mo",
    },
  ],
  sbi_bank_phonepe_purple_credit_card: [
    {
      keys: ["utilities_bills_telecom", "travel_flights_hotels"],
      combinedCapInr: 750,
      label: "3% PhonePe utility/travel pool capped at 750 RP/mo",
    },
    {
      keys: [
        "online_shopping_general",
        "amazon_flipkart_myntra",
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
      ],
      combinedCapInr: 750,
      label: "2% online spend pool capped at 750 RP/mo",
    },
  ],
  hdfc_bank_millennia_credit_card: [
    {
      keys: ["amazon_flipkart_myntra", "dining_swiggy_zomato"],
      combinedCapInr: 1000,
      label: "5% CashPoints partner pool capped at 1,000 RP/mo",
    },
  ],
  axis_bank_airtel_axis_bank_credit_card: [
    {
      keys: ["dining_swiggy_zomato", "groceries_quick_commerce"],
      combinedCapInr: 400,
      label: "10% Zomato + Blinkit pool capped at ₹400/mo (₹200/partner, ₹499 MOV; eff. Apr 12, 2026)",
    },
  ],
  axis_bank_ace_credit_card: [
    {
      keys: ["utilities_bills_telecom", "dining_swiggy_zomato"],
      combinedCapInr: 500,
      label: "5% GPay utility + 4% Swiggy/Zomato/Ola combined cap of ₹500/mo",
    },
  ],
  hdfc_bank_infinia_credit_card: [
    {
      keys: ["amazon_flipkart_myntra", "travel_flights_hotels"],
      combinedCapInr: 15000,
      label: "SmartBuy 5X/10X bonus pool capped at 15,000 RP/mo",
    },
  ],
  hdfc_bank_biz_black_credit_card: [
    {
      keys: ["amazon_flipkart_myntra", "travel_flights_hotels"],
      combinedCapInr: 15000,
      label: "SmartBuy accelerated pool capped at 15,000 RP/mo",
    },
  ],
  hdfc_bank_hdfc_diners_club_black_credit_card: [
    {
      keys: ["amazon_flipkart_myntra", "travel_flights_hotels"],
      combinedCapInr: 10000,
      label: "SmartBuy accelerated pool capped at 10,000 RP/mo",
    },
  ],
  icici_bank_emeralde_private_metal_credit_card: [
    {
      keys: ["amazon_flipkart_myntra", "travel_flights_hotels"],
      combinedCapInr: 18000,
      label: "iShop accelerated bonus pool capped at 18,000 RP/mo",
    },
  ],
  kotak_mahindra_bank_kotak_cashback_plus_credit_card: [
    {
      keys: [
        "online_shopping_general",
        "amazon_flipkart_myntra",
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
      ],
      combinedCapInr: 1000,
      label: "5% e-commerce & grocery pool capped at ₹1,000/mo",
    },
  ],
  kotak_mahindra_bank_kotak_cashback_plus_prime_credit_card: [
    {
      keys: [
        "online_shopping_general",
        "amazon_flipkart_myntra",
        "dining_swiggy_zomato",
        "groceries_quick_commerce",
      ],
      combinedCapInr: 1500,
      label: "5% e-commerce & grocery pool capped at ₹1,500/mo",
    },
  ],
  axis_bank_axis_bank_cashback_credit_card: [
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra", "utilities_bills_telecom"],
      combinedCapInr: 4000,
      label: "Tiered online cashback capped at ₹4,000/mo",
    },
  ],
  idfc_first_bank_hello_cashback_credit_card: [
    {
      keys: ["online_shopping_general", "amazon_flipkart_myntra", "upi_scan_and_pay"],
      combinedCapInr: 1000,
      label: "Tiered online + UPI cashback capped at ₹1,000/mo",
    },
  ],
  hdfc_bank_indianoil_hdfc_bank_credit_card: [
    {
      keys: ["fuel", "groceries_quick_commerce", "utilities_bills_telecom"],
      combinedCapInr: 250,
      label: "5% Fuel Points shared across IndianOil, groceries & bills capped at 250 FP/mo (150 after 6m)",
    },
  ],
  hdfc_bank_hdfc_business_bharat_credit_card: [
    {
      keys: ["fuel", "groceries_quick_commerce", "utilities_bills_telecom"],
      combinedCapInr: 150,
      label: "5% cashback shared across bills, groceries & fuel capped at ₹150/mo",
    },
  ],
};

export function baseFallbackRatePct(card: CardSummaryItem): number {
  const base = card.effective_return_pct_by_category?.offline_general_other ?? 0.5;
  return Math.max(0, Math.min(base, 3.3));
}

/** Apr 12, 2026 MITC: 25% Airtel (max ₹250) unlocks at 2x 1% base cashback; 10% Utility (max ₹250) at 1x base. */
export function calculateAirtelAxisUtilityCap(baseRetailMonthlySpend: number): number {
  if (baseRetailMonthlySpend <= 0) return 0;
  const airtelUnlocked = Math.min(250, Math.round(baseRetailMonthlySpend * 0.02));
  const utilityUnlocked = Math.min(250, Math.round(baseRetailMonthlySpend * 0.01));
  return airtelUnlocked + utilityUnlocked;
}

export function cappedMonthlyCategoryReward(
  card: CardSummaryItem,
  catKey: SpendCategoryKey,
  monthlySpendAmount: number
): {
  monthlyReward: number;
  capped: boolean;
  effectivePct: number;
  headlinePct: number;
  monthlyCapInr: number | null;
  eligibleSpendBeforeCapInr: number | null;
} {
  const headlinePct = card.effective_return_pct_by_category?.[catKey] ?? 0;
  const caps = card.monthly_category_caps_inr || {};
  const monthlyCapInr = typeof caps[catKey] === "number" && caps[catKey] > 0 ? caps[catKey] : null;

  if (monthlySpendAmount <= 0 || headlinePct <= 0) {
    return {
      monthlyReward: monthlySpendAmount * (headlinePct / 100),
      capped: false,
      effectivePct: headlinePct,
      headlinePct,
      monthlyCapInr,
      eligibleSpendBeforeCapInr:
        monthlyCapInr && headlinePct > 0 ? Math.round((monthlyCapInr / headlinePct) * 100) : null,
    };
  }

  const uncappedReward = monthlySpendAmount * (headlinePct / 100);
  if (!monthlyCapInr || uncappedReward <= monthlyCapInr) {
    return {
      monthlyReward: uncappedReward,
      capped: false,
      effectivePct: headlinePct,
      headlinePct,
      monthlyCapInr,
      eligibleSpendBeforeCapInr: monthlyCapInr ? Math.round((monthlyCapInr / headlinePct) * 100) : null,
    };
  }

  const spendAtHeadline = (monthlyCapInr / headlinePct) * 100;
  const excessSpend = Math.max(0, monthlySpendAmount - spendAtHeadline);
  const fallbackPct =
    catKey === "fuel" || catKey === "education_rent_govt" || catKey === "international_forex_net_of_markup"
      ? 0
      : Math.min(baseFallbackRatePct(card), headlinePct * 0.4);

  const monthlyReward = monthlyCapInr + excessSpend * (fallbackPct / 100);
  const effectivePct = (monthlyReward / monthlySpendAmount) * 100;

  return {
    monthlyReward,
    capped: true,
    effectivePct,
    headlinePct,
    monthlyCapInr,
    eligibleSpendBeforeCapInr: Math.round(spendAtHeadline),
  };
}

function parseQuarterlyLoungeThresholdInr(criteriaText: string | null | undefined): number | null {
  if (!criteriaText) return null;
  const low = criteriaText.toLowerCase();
  if (
    low.includes("no spend") ||
    low.includes("zero spend") ||
    low.includes("unconditional") ||
    low.includes("not applicable") ||
    low.includes("no lounge")
  ) {
    return 0;
  }
  const rx = /(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|k)?/i;
  const m = criteriaText.match(rx);
  if (!m) return null;
  let val = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(val) || val <= 0) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("lakh") || unit.startsWith("lac")) val *= 100000;
  else if (unit === "k") val *= 1000;

  if (/\/\s*mo|per\s*month|monthly/i.test(low)) return Math.round(val * 3);
  if (/per\s*year|annum|annual/i.test(low) && val >= 200000) return Math.round(val / 4);
  return Math.round(val);
}

function parseInrAmountFromText(raw: string): number | null {
  const m = raw.match(/(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|k)?/i);
  if (!m) return null;
  let v = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  const u = (m[2] || "").toLowerCase();
  if (u.startsWith("lakh") || u.startsWith("lac")) v *= 100000;
  else if (u === "k") v *= 1000;
  return Math.round(v);
}

function estimateAnnualMilestoneValueInr(
  annualSpendInr: number,
  milestoneSlabs: string[] | undefined,
  pointValueDefault: number
): number {
  if (!milestoneSlabs || milestoneSlabs.length === 0 || annualSpendInr < 100000) return 0;
  let totalCredit = 0;
  for (const slab of milestoneSlabs) {
    const low = slab.toLowerCase();
    if (
      low.includes("fee waiver") ||
      low.includes("waived") ||
      low.includes("lounge") ||
      low.includes("surcharge")
    ) {
      continue;
    }
    const spendMatch = slab.match(
      /(?:spend(?:ing|s)?\s+(?:worth\s+|of\s+)?)?(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|k)?/i
    );
    if (!spendMatch) continue;
    const reqSpend = parseInrAmountFromText(spendMatch[0]);
    if (!reqSpend || reqSpend < 50000) continue;
    const effectiveReq = /quarter/i.test(low) ? reqSpend * 4 : reqSpend;
    if (annualSpendInr < effectiveReq) continue;

    // Look for explicit voucher / cashback / points reward in the slab
    const voucherMatch = slab.match(
      /(?:voucher|gift\s*card|cashback|worth|credit|benefit)\s*(?:worth\s*|of\s*)?(?:rs\.?|₹|inr)\s*([\d,]+(?:\.\d+)?)\s*(k)?/i
    );
    if (voucherMatch) {
      const val = parseInrAmountFromText(voucherMatch[0].replace(/^(?:voucher|gift\s*card|cashback|worth|credit|benefit)\s*(?:worth\s*|of\s*)?/i, ""));
      if (val && val >= 250 && val <= 50000) {
        totalCredit += /quarter/i.test(low) ? val * 4 : val;
        continue;
      }
    }
    const ptsMatch = slab.match(/([\d,]+)\s*(?:bonus\s*)?(?:reward\s*points|points|rp|miles|neucoins|cashpoints)/i);
    if (ptsMatch) {
      const pts = Number(ptsMatch[1].replace(/,/g, ""));
      if (Number.isFinite(pts) && pts >= 250) {
        const val = Math.round(pts * Math.min(Math.max(pointValueDefault, 0.2), 1.0));
        totalCredit += /quarter/i.test(low) ? val * 4 : val;
      }
    }
  }
  // Keep conservative ceiling (at most 2.5% of annual spend)
  return Math.min(totalCredit, Math.round(annualSpendInr * 0.025));
}

export function evaluateCardForSpend(
  card: CardSummaryItem,
  monthlySpend: Record<SpendCategoryKey, number>,
  waiverSpendInr: number | null,
  includeGstOnFee = true,
  conversionStrategy: RewardConversionStrategy = "default_inr"
): {
  annualSpendInr: number;
  uncappedGrossAnnualRewardInr: number;
  grossAnnualRewardsInr: number;
  monthlyRewardLostToCapsInr: number;
  waiverMet: boolean;
  effectiveFeeInr: number;
  netAnnualBenefitInr: number;
  netReturnPct: number;
  effectiveBlendedReturnPct: number;
  peakReturnPct: number;
  saturatedCategories: SpendCategoryKey[];
  categoryLimitRows: CategoryLimitRow[];
  conversionResult: CardConversionResult;
  capNotes: string[];
  topCategories: Array<{ key: SpendCategoryKey; pct: number; effectivePct: number; annualReward: number }>;
} {
  let monthlyTotal = 0;
  let uncappedMonthlyTotal = 0;
  const rawMonthlyRewards: Partial<Record<SpendCategoryKey, number>> = {};
  const uncappedMonthlyRewards: Partial<Record<SpendCategoryKey, number>> = {};
  const headlinePcts: Partial<Record<SpendCategoryKey, number>> = {};
  const indCaps: Partial<Record<SpendCategoryKey, number | null>> = {};
  const poolLabels: Partial<Record<SpendCategoryKey, string>> = {};
  const capNotes: string[] = [];

  for (const k of SPEND_CATEGORY_KEYS) {
    const m = monthlySpend[k] || 0;
    monthlyTotal += m;
    const res = cappedMonthlyCategoryReward(card, k, m);
    const uncapped = m > 0 && res.headlinePct > 0 ? m * (res.headlinePct / 100) : Math.max(0, res.monthlyReward);
    uncappedMonthlyRewards[k] = m > 0 ? Math.max(0, uncapped) : 0;
    uncappedMonthlyTotal += uncappedMonthlyRewards[k] || 0;
    rawMonthlyRewards[k] = res.monthlyReward;
    headlinePcts[k] = res.headlinePct;
    indCaps[k] = res.monthlyCapInr;
    if (res.capped && res.monthlyCapInr) {
      capNotes.push(
        `${SPEND_CATEGORY_META[k].shortLabel} hits ₹${res.monthlyCapInr.toLocaleString("en-IN")}/mo cap`
      );
    }
  }

  // Enforce shared cap pools
  const pools = SHARED_CAP_POOLS[card.card_id] || [];
  for (const pool of pools) {
    for (const k of pool.keys) {
      poolLabels[k] = pool.label;
    }
    const poolSum = pool.keys.reduce((s, k) => s + Math.max(0, rawMonthlyRewards[k] || 0), 0);
    const baseRate = baseFallbackRatePct(card);
    const poolSpend = pool.keys.reduce((s, k) => s + (monthlySpend[k] || 0), 0);
    if (poolSum > pool.combinedCapInr && poolSpend > 0) {
      const avgHeadline = (poolSum / poolSpend) * 100;
      const cappedSpend = avgHeadline > 0 ? Math.min(poolSpend, (pool.combinedCapInr / avgHeadline) * 100) : 0;
      const excessSpend = Math.max(0, poolSpend - cappedSpend);
      const pooledTotalReward =
        pool.combinedCapInr + excessSpend * (Math.min(baseRate, avgHeadline * 0.4) / 100);
      const scale = pooledTotalReward / poolSum;
      for (const k of pool.keys) {
        rawMonthlyRewards[k] = (rawMonthlyRewards[k] || 0) * scale;
      }
      if (!capNotes.includes(pool.label)) {
        capNotes.push(pool.label);
      }
    }
  }

  // Airtel Axis Apr 12, 2026 rule: 25% Airtel (2x) & 10% Utility (1x) require matching 1% base retail cashback
  if (card.card_id === "axis_bank_airtel_axis_bank_credit_card") {
    const baseRetailSpend =
      (monthlySpend.online_shopping_general || 0) +
      (monthlySpend.amazon_flipkart_myntra || 0) +
      (monthlySpend.travel_flights_hotels || 0) +
      (monthlySpend.upi_scan_and_pay || 0) +
      (monthlySpend.offline_general_other || 0);
    const unlockedUtilityCeiling = calculateAirtelAxisUtilityCap(baseRetailSpend);
    const beforeGate = rawMonthlyRewards["utilities_bills_telecom"] || 0;
    poolLabels["utilities_bills_telecom"] =
      "Apr 2026 MITC: 25% Airtel (2× base, ₹250 max) + 10% Utility (1× base, ₹250 max) — requires 1% retail spends";
    if ((monthlySpend.utilities_bills_telecom || 0) > 0 && beforeGate > unlockedUtilityCeiling) {
      rawMonthlyRewards["utilities_bills_telecom"] = unlockedUtilityCeiling;
      capNotes.push(
        baseRetailSpend === 0
          ? "Utilities ₹0 unlocked: Apr 2026 Airtel rule requires 1% base retail spend first"
          : `Utilities gated to ₹${unlockedUtilityCeiling}/mo by ₹${baseRetailSpend.toLocaleString("en-IN")} base retail spend`
      );
    }
  }

  let grossAnnualRewardsInr = 0;
  let actualPositiveMonthlyTotal = 0;
  let uncappedPositiveMonthlyTotal = 0;
  const saturatedCategories: SpendCategoryKey[] = [];
  const categoryLimitRows: CategoryLimitRow[] = [];
  const catBreakdown: Array<{ key: SpendCategoryKey; pct: number; effectivePct: number; annualReward: number }> = [];

  for (const k of SPEND_CATEGORY_KEYS) {
    const m = monthlySpend[k] || 0;
    const mReward = rawMonthlyRewards[k] || 0;
    const uncappedM = uncappedMonthlyRewards[k] || 0;
    const ann = mReward * 12;
    grossAnnualRewardsInr += ann;
    if (m > 0) {
      actualPositiveMonthlyTotal += Math.max(0, mReward);
      uncappedPositiveMonthlyTotal += uncappedM;
    }
    const headlinePct = headlinePcts[k] ?? 0;
    const effectivePct = m > 0 ? (mReward / m) * 100 : headlinePct;
    const lostToCapInr = m > 0 ? Math.max(0, Math.round(uncappedM - mReward)) : 0;
    const isSaturated = m > 0 && lostToCapInr >= 10;
    if (isSaturated) saturatedCategories.push(k);

    if (m > 0 || headlinePct >= 2.5) {
      categoryLimitRows.push({
        key: k,
        label: SPEND_CATEGORY_META[k].shortLabel,
        monthlySpendInr: m,
        headlinePct: Number(headlinePct.toFixed(2)),
        effectivePct: Number(effectivePct.toFixed(2)),
        monthlyCapInr: indCaps[k] ?? null,
        poolLabel: poolLabels[k] ?? null,
        uncappedMonthlyRewardInr: Math.round(uncappedM),
        actualMonthlyRewardInr: Math.round(mReward),
        lostToCapInr,
        isSaturated,
        isZeroOrExcluded: headlinePct <= 0 && k !== "international_forex_net_of_markup",
      });
    }

    if (m > 0 || headlinePct > 0) {
      catBreakdown.push({ key: k, pct: headlinePct, effectivePct, annualReward: ann });
    }
  }

  const conversionResult = applyConversionStrategy(card, conversionStrategy, grossAnnualRewardsInr);
  const convScale =
    grossAnnualRewardsInr > 0
      ? conversionResult.effectiveAnnualRewardsInr / grossAnnualRewardsInr
      : conversionResult.multiplier;
  if (Math.abs(convScale - 1) > 0.001) {
    grossAnnualRewardsInr = conversionResult.effectiveAnnualRewardsInr;
    for (const r of categoryLimitRows) {
      r.headlinePct = Number((r.headlinePct * convScale).toFixed(2));
      r.effectivePct = Number((r.effectivePct * convScale).toFixed(2));
      r.actualMonthlyRewardInr = Math.round(r.actualMonthlyRewardInr * convScale);
      r.uncappedMonthlyRewardInr = Math.round(r.uncappedMonthlyRewardInr * convScale);
      r.lostToCapInr = Math.max(0, r.uncappedMonthlyRewardInr - r.actualMonthlyRewardInr);
    }
    for (const cb of catBreakdown) {
      cb.pct = cb.pct * convScale;
      cb.effectivePct = cb.effectivePct * convScale;
      cb.annualReward = cb.annualReward * convScale;
    }
  }
  if (conversionResult.overflowNote && !capNotes.includes(conversionResult.overflowNote)) {
    capNotes.push(conversionResult.overflowNote);
  }

  const effectiveWaiverTarget = waiverSpendInr ?? card.fee_waiver_spend_inr ?? null;
  const annualSpendInr = monthlyTotal * 12;
  const uncappedGrossAnnualRewardInr = Math.round(uncappedMonthlyTotal * 12 * convScale);
  const monthlyRewardLostToCapsInr = Math.max(
    0,
    Math.round((uncappedPositiveMonthlyTotal - actualPositiveMonthlyTotal) * convScale)
  );
  const waiverMet =
    card.annual_fee_inr === 0 ||
    (effectiveWaiverTarget !== null && effectiveWaiverTarget > 0 && annualSpendInr >= effectiveWaiverTarget);
  const rawFee = card.annual_fee_inr;
  const effectiveFeeInr = waiverMet ? 0 : includeGstOnFee ? Math.round(rawFee * 1.18) : rawFee;
  const netAnnualBenefitInr = grossAnnualRewardsInr - effectiveFeeInr;
  const netReturnPct = annualSpendInr > 0 ? (netAnnualBenefitInr / annualSpendInr) * 100 : 0;
  const effectiveBlendedReturnPct =
    annualSpendInr > 0 ? (grossAnnualRewardsInr / annualSpendInr) * 100 : 0;
  const peakReturnPct =
    Math.max(
      0,
      ...SPEND_CATEGORY_KEYS.filter((k) => k !== "international_forex_net_of_markup").map(
        (k) => headlinePcts[k] ?? 0
      )
    ) * convScale;

  catBreakdown.sort((a, b) => b.annualReward - a.annualReward || b.effectivePct - a.effectivePct);
  categoryLimitRows.sort(
    (a, b) =>
      b.monthlySpendInr - a.monthlySpendInr ||
      b.actualMonthlyRewardInr - a.actualMonthlyRewardInr ||
      b.headlinePct - a.headlinePct
  );

  return {
    annualSpendInr,
    uncappedGrossAnnualRewardInr,
    grossAnnualRewardsInr,
    monthlyRewardLostToCapsInr,
    waiverMet,
    effectiveFeeInr,
    netAnnualBenefitInr,
    netReturnPct,
    effectiveBlendedReturnPct,
    peakReturnPct,
    saturatedCategories,
    categoryLimitRows,
    conversionResult,
    capNotes: capNotes.slice(0, 4),
    topCategories: catBreakdown.slice(0, 3),
  };
}

export function scoreCardsForProfile(
  cards: CardSummaryItem[],
  profile: AdvisorProfile,
  waiverMap: Record<string, number | null> = {},
  limit = 18,
  metaMap: Record<string, AdvisorCardMeta> = {}
): CardEvaluation[] {
  const results: CardEvaluation[] = [];
  const priorityMode: AdvisorPriorityMode = profile.priorityMode ?? "balanced";
  const conversionStrategy: RewardConversionStrategy = profile.conversionStrategy ?? "default_inr";
  const quarterlySpendInr =
    SPEND_CATEGORY_KEYS.reduce((s, k) => s + (profile.monthlySpend[k] || 0), 0) * 3;

  for (const card of cards) {
    if (isCardDiscontinuedForNewApplicants(card)) continue;
    const t = card.filter_tags;
    const meta = metaMap[card.card_id];

    // Hard feature filters
    if (profile.feePreference === "ltf_only" && !t.is_ltf) continue;
    if (profile.feePreference === "low_fee" && card.annual_fee_inr > 1500) continue;
    if (profile.needRupayUpi && !t.is_rupay_upi) continue;
    if (profile.needNoSpendLounge && !t.no_spend_domestic_lounge) continue;
    if (profile.needZeroLowForex && !t.zero_or_low_forex && !t.zero_forex) continue;
    if (profile.needGolf && !t.has_golf && !card.categories.includes("Golf")) continue;

    const devalScore = meta?.devaluationRiskScore ?? 4;
    const devalFreq = meta?.devaluationFrequency ?? "Moderate";
    if (profile.avoidHighDevaluation && devalScore >= 7) continue;

    const waiverSpendInr = waiverMap[card.card_id] ?? meta?.feeWaiverSpendInr ?? card.fee_waiver_spend_inr ?? null;
    const calc = evaluateCardForSpend(
      card,
      profile.monthlySpend,
      waiverSpendInr,
      true,
      conversionStrategy
    );

    // Eligibility check (normalized salaried income -> ITR/12 -> conservative tier floor)
    const minInc = normalizeMinMonthlyIncomeInr(
      card,
      meta?.minIncomeSalariedInr ?? t.min_income_salaried_inr,
      meta?.minItrAnnualInr
    );

    const minCibil = meta?.minCibilScore ?? t.min_cibil_score ?? 730;
    let eligibilityStatus: CardEvaluation["eligibilityStatus"] = "likely_eligible";
    let eligibilityLabel = "Likely Eligible";

    if (t.is_fd_backed) {
      eligibilityStatus = "likely_eligible";
      eligibilityLabel = "FD-Backed (High Approval)";
    } else if (profile.cibilScore < minCibil) {
      eligibilityStatus = "cibil_stretch";
      eligibilityLabel = `Needs ${minCibil}+ CIBIL`;
    } else if (t.is_invite_only) {
      const inviteFloor = minInc ?? 250000;
      if (profile.monthlyIncomeInr >= inviteFloor) {
        eligibilityStatus = "likely_eligible";
        eligibilityLabel = `Salary Unlocks Premium (RM / Invite)`;
      } else {
        eligibilityStatus = "fd_or_invite";
        eligibilityLabel = `Invite / RM (≥ ₹${Math.round(inviteFloor / 1000)}k/mo)`;
      }
    } else if (minInc !== null && profile.monthlyIncomeInr < minInc) {
      eligibilityStatus = "income_stretch";
      eligibilityLabel = `Needs ₹${Math.round(minInc / 1000)}k+/mo income`;
    }

    if (profile.strictEligibility && eligibilityStatus !== "likely_eligible") {
      continue;
    }

    // Fee waiver metrics
    const waiverShortfallInr =
      !calc.waiverMet && waiverSpendInr ? Math.max(0, Math.round(waiverSpendInr - calc.annualSpendInr)) : 0;
    const waiverProgressPct =
      card.annual_fee_inr === 0
        ? 100
        : waiverSpendInr && waiverSpendInr > 0
          ? Math.min(100, Math.round((calc.annualSpendInr / waiverSpendInr) * 100))
          : 0;

    // Quarterly Lounge Spend Gate check
    const loungeSpendCriteriaText = meta?.loungeSpendCriteria ?? card.lounge_spend_condition ?? null;
    let loungeSpendGateStatus: CardEvaluation["loungeSpendGateStatus"] = "none";
    let loungeQuarterlyShortfallInr = 0;

    if (t.has_domestic_lounge) {
      if (t.no_spend_domestic_lounge) {
        loungeSpendGateStatus = "no_spend";
      } else {
        const reqQuarterly = parseQuarterlyLoungeThresholdInr(loungeSpendCriteriaText);
        if (reqQuarterly === 0) {
          loungeSpendGateStatus = "no_spend";
        } else if (reqQuarterly !== null) {
          if (quarterlySpendInr >= reqQuarterly) {
            loungeSpendGateStatus = "unlocked";
          } else {
            loungeSpendGateStatus = "spend_shortfall";
            loungeQuarterlyShortfallInr = Math.round(reqQuarterly - quarterlySpendInr);
          }
        } else {
          loungeSpendGateStatus = "spend_shortfall";
        }
      }
    }

    // Milestone credit (conservative)
    const milestoneEstimatedValueInr = estimateAnnualMilestoneValueInr(
      calc.annualSpendInr,
      meta?.milestoneSlabs,
      meta?.pointValueDefault ?? 0.25
    );

    // Structured Limit & Real-World Alerts
    const limitAlerts: AdvisorLimitAlert[] = [];

    if (
      card.card_id === "axis_bank_airtel_axis_bank_credit_card" &&
      (profile.monthlySpend.utilities_bills_telecom || 0) > 0
    ) {
      const baseRetailSpend =
        (profile.monthlySpend.online_shopping_general || 0) +
        (profile.monthlySpend.amazon_flipkart_myntra || 0) +
        (profile.monthlySpend.travel_flights_hotels || 0) +
        (profile.monthlySpend.upi_scan_and_pay || 0) +
        (profile.monthlySpend.offline_general_other || 0);
      if (baseRetailSpend < 12500) {
        limitAlerts.push({
          severity: "warning",
          tag: "Apr 2026 Rule",
          title: "Utility/Airtel cashback requires 1% base retail spend",
          detail:
            baseRetailSpend === 0
              ? "Eff. Apr 12, 2026, ₹0 retail spend unlocks ₹0 on Airtel/utility bills. Also includes 0 domestic lounge visits."
              : `₹${baseRetailSpend.toLocaleString("en-IN")}/mo retail spend only unlocks up to ₹${Math.min(250, Math.round(baseRetailSpend * 0.015))}/mo utility CB (Zomato+Blinkit capped at ₹400/mo; 0 lounge visits).`,
        });
      }
    }

    if (calc.monthlyRewardLostToCapsInr >= 100 && calc.saturatedCategories.length > 0) {
      const catNames = calc.saturatedCategories
        .slice(0, 2)
        .map((ck) => SPEND_CATEGORY_META[ck].shortLabel)
        .join(", ");
      limitAlerts.push({
        severity: "warning",
        tag: "Cap Hit",
        title: `Losing ₹${calc.monthlyRewardLostToCapsInr.toLocaleString("en-IN")}/mo to monthly limits`,
        detail: `${catNames} saturates the monthly cap; blended rate drops from ${calc.peakReturnPct.toFixed(1)}% peak to ${calc.effectiveBlendedReturnPct.toFixed(1)}%. Consider splitting excess spend with a 2nd card.`,
      });
    }

    // Check high-spend zero-earn / excluded buckets
    const zeroBuckets = calc.categoryLimitRows.filter(
      (r) => r.monthlySpendInr >= 1000 && r.isZeroOrExcluded
    );
    if (zeroBuckets.length > 0) {
      const totalZeroMonthly = zeroBuckets.reduce((s, r) => s + r.monthlySpendInr, 0);
      const bucketNames = zeroBuckets.map((b) => b.label).join(", ");
      limitAlerts.push({
        severity: "warning",
        tag: "Excluded Spend",
        title: `0% earned on ₹${totalZeroMonthly.toLocaleString("en-IN")}/mo (${bucketNames})`,
        detail: meta?.excludedCategories?.length
          ? `Issuer excludes: ${meta.excludedCategories.slice(0, 3).join(", ")}.`
          : "This spend earns zero base rewards under issuer MCC rules.",
      });
    }

    // Fee waiver alert
    if (card.annual_fee_inr > 0) {
      if (calc.waiverMet && waiverSpendInr) {
        limitAlerts.push({
          severity: "positive",
          tag: "Fee Waived",
          title: `Annual fee ₹${card.annual_fee_inr.toLocaleString("en-IN")} waived`,
          detail: `Your ₹${(calc.annualSpendInr / 100000).toFixed(2)}L annual spend clears the ₹${(waiverSpendInr / 100000).toFixed(2)}L waiver threshold.`,
        });
      } else if (waiverSpendInr && !calc.waiverMet) {
        limitAlerts.push({
          severity: waiverShortfallInr <= 50000 ? "info" : "warning",
          tag: "Waiver Shortfall",
          title: `₹${waiverShortfallInr.toLocaleString("en-IN")}/yr short of fee waiver`,
          detail: `You pay ₹${calc.effectiveFeeInr.toLocaleString("en-IN")} (incl. GST) unless annual spend reaches ₹${waiverSpendInr.toLocaleString("en-IN")}.`,
        });
      }
    }

    // Lounge spend gate alert
    if (t.has_domestic_lounge) {
      if (loungeSpendGateStatus === "spend_shortfall") {
        limitAlerts.push({
          severity: "warning",
          tag: "Lounge Locked",
          title:
            loungeQuarterlyShortfallInr > 0
              ? `Short by ₹${loungeQuarterlyShortfallInr.toLocaleString("en-IN")}/qtr for domestic lounge`
              : "Domestic lounge requires quarterly spend criteria",
          detail: loungeSpendCriteriaText || "Verify quarterly spend trigger before relying on airport lounge entry.",
        });
      } else if (
        loungeSpendGateStatus === "no_spend" &&
        (profile.needNoSpendLounge ||
          priorityMode === "travel_lounge" ||
          profile.preferredGoals.includes("Airport Lounge") ||
          (profile.monthlySpend.travel_flights_hotels || 0) >= 3000)
      ) {
        limitAlerts.push({
          severity: "positive",
          tag: "Lounge Free",
          title: "Unconditional domestic lounge access",
          detail: "No quarterly spend prerequisite required for domestic airport lounges.",
        });
      }
    }

    // Point redemption value friction
    if (meta?.pointValueMatrix) {
      const cashVal = parseFloat((meta.pointValueMatrix.cashback_or_statement || "").replace(/[^\d.]/g, ""));
      if (Number.isFinite(cashVal) && cashVal > 0 && meta.pointValueDefault - cashVal >= 0.35) {
        limitAlerts.push({
          severity: "info",
          tag: "Point Value Note",
          title: `₹${cashVal.toFixed(2)} cash vs ₹${meta.pointValueDefault.toFixed(2)} travel/miles`,
          detail: "Headline return assumes travel portal / airline transfer redemption — statement cash value is lower.",
        });
      }
    }

    if (milestoneEstimatedValueInr >= 1000) {
      limitAlerts.push({
        severity: "positive",
        tag: "Milestone Unlocked",
        title: `~₹${milestoneEstimatedValueInr.toLocaleString("en-IN")}/yr extra milestone bonus`,
        detail: "Your annual spend qualifies for recurring milestone vouchers or bonus points.",
      });
    }

    if (devalScore >= 7) {
      limitAlerts.push({
        severity: "warning",
        tag: "High Deval Risk",
        title: `Devaluation risk ${devalScore}/10 (${devalFreq})`,
        detail:
          meta?.lastDevaluedOn
            ? `Last devalued ${meta.lastDevaluedOn}. Watch out for capping or exclusion revisions.`
            : "Issuer has made frequent reward/lounge revisions recently.",
      });
    }

    if (
      card.card_id === "axis_bank_airtel_axis_bank_credit_card" &&
      (profile.monthlySpend.utilities_bills_telecom || 0) > 0
    ) {
      const baseOtherSpend =
        (profile.monthlySpend.online_shopping_general || 0) +
        (profile.monthlySpend.amazon_flipkart_myntra || 0) +
        (profile.monthlySpend.travel_flights_hotels || 0) +
        (profile.monthlySpend.upi_scan_and_pay || 0) +
        (profile.monthlySpend.offline_general_other || 0);
      const unlocked = calculateAirtelAxisUtilityCap(baseOtherSpend);
      if (baseOtherSpend < 25000) {
        limitAlerts.push({
          severity: baseOtherSpend === 0 ? "warning" : "info",
          tag: "2× Base Unlock",
          title:
            baseOtherSpend === 0
              ? "₹0 Airtel/Utility unlocked without base spends"
              : `₹${unlocked}/mo Airtel+Utility unlocked (need ₹25k base spend for full ₹500)`,
          detail:
            "Apr 2026 MITC caps 25% Airtel at 2× your 1% base cashback and 10% Utility at 1× base cashback.",
        });
      }
    }

    if (card.card_id === "hdfc_bank_infinia_credit_card" && calc.annualSpendInr < 1800000) {
      limitAlerts.push({
        severity: "info",
        tag: "Retention Gate",
        title: "Requires ₹18L/yr spend or ₹50L HDFC RLV",
        detail:
          "₹10L/yr waives annual fee, while ₹18L/yr retail spend or ₹50L HDFC RLV is required to retain Infinia and prevent downgrade to DCB Metal.",
      });
    }

    // Score & Reasons calculation
    let goalBonus = 0;
    const reasons: string[] = [];

    if (calc.netAnnualBenefitInr > 0) {
      reasons.push(
        `Projects ₹${Math.round(calc.netAnnualBenefitInr).toLocaleString("en-IN")}/yr post-cap net return (${calc.effectiveBlendedReturnPct.toFixed(1)}% blended)`
      );
    }
    if (t.is_ltf) {
      reasons.push("Lifetime free (₹0 renewal pressure)");
    } else if (calc.waiverMet && waiverSpendInr) {
      reasons.push(
        `Spend waives ₹${card.annual_fee_inr.toLocaleString("en-IN")} fee (target ₹${waiverSpendInr.toLocaleString("en-IN")})`
      );
    }

    for (const g of profile.preferredGoals) {
      if (card.categories.includes(g) || card.primary_category === g) {
        goalBonus += 2100;
      }
    }

    const wantsLounge =
      profile.needNoSpendLounge ||
      priorityMode === "travel_lounge" ||
      profile.preferredGoals.includes("Airport Lounge") ||
      profile.preferredGoals.includes("Travel & Miles");

    if (loungeSpendGateStatus === "no_spend") {
      goalBonus += priorityMode === "travel_lounge" ? 2600 : 1000;
      if (reasons.length < 3) reasons.push("Domestic lounge with zero spend condition");
    } else if (loungeSpendGateStatus === "unlocked") {
      goalBonus += priorityMode === "travel_lounge" ? 1900 : 600;
      if (reasons.length < 3) reasons.push("Your quarterly spend unlocks domestic lounge");
    } else if (loungeSpendGateStatus === "spend_shortfall" && wantsLounge) {
      goalBonus -= 900;
    }

    if (priorityMode === "travel_lounge" && t.has_international_lounge) {
      goalBonus += 1400;
    }

    if ((t.has_golf || card.categories.includes("Golf")) && (profile.needGolf || profile.preferredGoals.includes("Golf"))) {
      goalBonus += 1200;
      if (reasons.length < 3 && card.golf_summary?.complimentary_access) {
        reasons.push(`Golf: ${card.golf_summary.complimentary_access}`);
      }
    }
    if (t.is_rupay_upi && (profile.monthlySpend.upi_scan_and_pay || 0) >= 2000) {
      goalBonus += 900;
      if (reasons.length < 3) reasons.push("Works on RuPay UPI QR payments");
    }
    if (t.zero_forex && (profile.monthlySpend.international_forex_net_of_markup || 0) > 0) {
      goalBonus += priorityMode === "travel_lounge" ? 2400 : 1500;
      if (reasons.length < 3) reasons.push("0% foreign currency markup");
    }

    const eligibilityPenalty =
      eligibilityStatus === "likely_eligible"
        ? 0
        : eligibilityStatus === "income_stretch"
          ? -4500
          : eligibilityStatus === "cibil_stretch"
            ? -6000
            : -4200;

    const devalPenalty = devalScore >= 7 ? -1200 : devalScore >= 5 ? -350 : 0;
    const capSaturationPenalty = Math.min(2500, calc.monthlyRewardLostToCapsInr * 0.6);

    // Higher-salary premium unlock fit boost (when eligible & not filtering for low-fee/LTF)
    let premiumTierFitBonus = 0;
    if (
      eligibilityStatus === "likely_eligible" &&
      profile.monthlyIncomeInr >= 150000 &&
      profile.feePreference === "any" &&
      priorityMode !== "low_fee_uncapped"
    ) {
      const effectiveFloor = minInc ?? 0;
      const isSuperTier =
        /super-?premium|private|luxury/i.test(card.card_tier || "") ||
        effectiveFloor >= 250000 ||
        card.annual_fee_inr >= 10000;
      const isMidPremium =
        /mid-?premium/i.test(card.card_tier || "") ||
        effectiveFloor >= 100000 ||
        card.annual_fee_inr >= 2500;

      if (isSuperTier && profile.monthlyIncomeInr >= 250000 && calc.netAnnualBenefitInr >= 0) {
        premiumTierFitBonus = profile.monthlyIncomeInr >= 450000 ? 4600 : 3400;
      } else if (isMidPremium && calc.netAnnualBenefitInr >= 0) {
        premiumTierFitBonus = 2200;
      }
      if (premiumTierFitBonus >= 2200 && reasons.length < 3) {
        reasons.push(
          `Unlocked at ₹${(profile.monthlyIncomeInr / 100000).toFixed(1)}L/mo tier`
        );
      }
    }

    // Conversion strategy alignment (Air Miles / Accor ALL partner ecosystem fit)
    let conversionStrategyBonus = 0;
    if (
      (conversionStrategy === "accor_all" || conversionStrategy === "air_miles") &&
      calc.conversionResult.supportsStrategy
    ) {
      conversionStrategyBonus =
        conversionStrategy === "accor_all" && calc.conversionResult.multiplier >= 1.8 ? 3200 : 2100;
      if (calc.conversionResult.convertedUnitsPerYear >= 500) {
        const tagName = conversionStrategy === "accor_all" ? "Accor ALL" : "Air Miles";
        limitAlerts.push({
          severity: "positive",
          tag: tagName,
          title: `~${calc.conversionResult.convertedUnitsPerYear.toLocaleString("en-IN")} ${calc.conversionResult.unitLabel}/yr`,
          detail: calc.conversionResult.ratioText,
        });
      }
    } else if (
      (conversionStrategy === "accor_all" || conversionStrategy === "air_miles") &&
      !calc.conversionResult.supportsStrategy
    ) {
      conversionStrategyBonus = -900;
    }

    let fitScore = 0;
    if (priorityMode === "max_net") {
      fitScore =
        calc.netAnnualBenefitInr * 1.25 +
        milestoneEstimatedValueInr * 0.9 +
        goalBonus * 0.65 +
        premiumTierFitBonus * 0.7 +
        conversionStrategyBonus +
        card.overall_rating * 650 +
        eligibilityPenalty +
        devalPenalty * 0.6;
    } else if (priorityMode === "low_fee_uncapped") {
      const ltfOrWaiverBoost = t.is_ltf ? 2600 : calc.waiverMet ? 1400 : -calc.effectiveFeeInr * 1.4;
      const capPenalty = calc.monthlyRewardLostToCapsInr * 1.6;
      fitScore =
        calc.netAnnualBenefitInr +
        ltfOrWaiverBoost -
        capPenalty +
        goalBonus * 0.7 +
        conversionStrategyBonus * 0.7 +
        card.overall_rating * 800 +
        eligibilityPenalty +
        devalPenalty;
    } else if (priorityMode === "travel_lounge") {
      const forexBoost = t.zero_forex ? 1800 : t.zero_or_low_forex ? 900 : 0;
      fitScore =
        calc.netAnnualBenefitInr * 0.85 +
        milestoneEstimatedValueInr * 0.8 +
        goalBonus * 1.35 +
        forexBoost +
        premiumTierFitBonus +
        conversionStrategyBonus * 1.25 +
        card.overall_rating * 950 +
        eligibilityPenalty +
        devalPenalty * 0.8;
    } else {
      fitScore =
        calc.netAnnualBenefitInr +
        milestoneEstimatedValueInr * 0.75 +
        goalBonus +
        premiumTierFitBonus +
        conversionStrategyBonus +
        card.overall_rating * 950 +
        eligibilityPenalty +
        devalPenalty -
        capSaturationPenalty;
    }

    limitAlerts.sort((a, b) => {
      const rank = { warning: 0, positive: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    });

    results.push({
      card,
      annualSpendInr: calc.annualSpendInr,
      uncappedGrossAnnualRewardInr: calc.uncappedGrossAnnualRewardInr,
      grossAnnualRewardsInr: calc.grossAnnualRewardsInr,
      monthlyRewardLostToCapsInr: calc.monthlyRewardLostToCapsInr,
      waiverSpendInr,
      waiverMet: calc.waiverMet,
      waiverShortfallInr,
      waiverProgressPct,
      effectiveFeeInr: calc.effectiveFeeInr,
      netAnnualBenefitInr: calc.netAnnualBenefitInr,
      netReturnPct: calc.netReturnPct,
      effectiveBlendedReturnPct: calc.effectiveBlendedReturnPct,
      peakReturnPct: calc.peakReturnPct,
      saturatedCategories: calc.saturatedCategories,
      categoryLimitRows: calc.categoryLimitRows,
      loungeSpendGateStatus,
      loungeQuarterlyShortfallInr,
      loungeSpendCriteriaText,
      milestoneEstimatedValueInr,
      devaluationRiskScore: devalScore,
      devaluationFrequency: devalFreq,
      conversionResult: calc.conversionResult,
      minRequiredIncomeInr: minInc,
      minRequiredCibil: minCibil,
      approvalNotes: meta?.approvalNotes ?? null,
      eligibilityStatus,
      eligibilityLabel,
      limitAlerts: limitAlerts.slice(0, 5),
      fitScore,
      reasons: reasons.slice(0, 3),
      capNotes: calc.capNotes,
      topCategories: calc.topCategories,
    });
  }

  results.sort((a, b) => b.fitScore - a.fitScore || b.netAnnualBenefitInr - a.netAnnualBenefitInr);
  return results.slice(0, limit);
}

/**
 * Evaluates a 2-Card Combo WITH both per-category AND shared-cap pool spillover:
 * When Card A saturates an individual monthly cap OR its shared monthly reward pool
 * (e.g., SBI Cashback ₹2,000/cycle online pool or HSBC Live+ ₹1,200/mo pool),
 * remaining spend in that bucket automatically spills over to Card B!
 */
export function evaluateTwoCardCombo(
  cardA: CardSummaryItem,
  cardB: CardSummaryItem,
  monthlySpend: Record<SpendCategoryKey, number>,
  waiverMap: Record<string, number | null> = {},
  includeGstOnFee = true,
  conversionStrategy: RewardConversionStrategy = "default_inr"
): TwoCardComboResult {
  let spendForA = 0;
  let spendForB = 0;
  let rewardAAnnualInr = 0;
  let rewardBAnnualInr = 0;
  let annualSpendInr = 0;
  let comboGrossRewardsInr = 0;
  const spilloverNotes: string[] = [];

  // Per-card strategy multiplier when routing spend across categories
  const multA = applyConversionStrategy(cardA, conversionStrategy, 10000).multiplier;
  const multB = applyConversionStrategy(cardB, conversionStrategy, 10000).multiplier;

  // Track remaining shared-pool headroom for A and B separately
  const poolsA = (SHARED_CAP_POOLS[cardA.card_id] || []).map((p) => ({
    ...p,
    remainingInr: p.combinedCapInr,
  }));
  const poolsB = (SHARED_CAP_POOLS[cardB.card_id] || []).map((p) => ({
    ...p,
    remainingInr: p.combinedCapInr,
  }));

  const AIRTEL_ID = "axis_bank_airtel_axis_bank_credit_card";
  const BASE_RETAIL_KEYS = new Set<SpendCategoryKey>([
    "online_shopping_general",
    "amazon_flipkart_myntra",
    "travel_flights_hotels",
    "upi_scan_and_pay",
    "offline_general_other",
  ]);
  const hasAirtel = cardA.card_id === AIRTEL_ID || cardB.card_id === AIRTEL_ID;
  let airtelBaseMonthlySpend = 0;

  // Order spend buckets so the strongest single-card advantage consumes shared pools first
  // (keep utilities_bills_telecom last when Airtel Axis is present so base retail spend accumulates first)
  const orderedKeys = [...SPEND_CATEGORY_KEYS].sort((ka, kb) => {
    if (hasAirtel) {
      if (ka === "utilities_bills_telecom" && kb !== "utilities_bills_telecom") return 1;
      if (kb === "utilities_bills_telecom" && ka !== "utilities_bills_telecom") return -1;
    }
    const rAa = (cardA.effective_return_pct_by_category?.[ka] ?? 0) * multA;
    const rBa = (cardB.effective_return_pct_by_category?.[ka] ?? 0) * multB;
    const rAb = (cardA.effective_return_pct_by_category?.[kb] ?? 0) * multA;
    const rBb = (cardB.effective_return_pct_by_category?.[kb] ?? 0) * multB;
    return Math.abs(rAb - rBb) - Math.abs(rAa - rBa);
  });

  const splitByKey = new Map<SpendCategoryKey, TwoCardComboResult["categorySplit"][number]>();

  const getHeadroomRewardCap = (
    card: CardSummaryItem,
    pools: Array<{ keys: SpendCategoryKey[]; combinedCapInr: number; remainingInr: number; label: string }>,
    catKey: SpendCategoryKey
  ): { capInr: number | null; activePool: { remainingInr: number; label: string } | null } => {
    const indCap = card.monthly_category_caps_inr?.[catKey];
    let minCap: number | null = typeof indCap === "number" && indCap > 0 ? indCap : null;
    if (card.card_id === AIRTEL_ID && catKey === "utilities_bills_telecom") {
      const unlocked = calculateAirtelAxisUtilityCap(airtelBaseMonthlySpend);
      minCap = minCap === null ? unlocked : Math.min(minCap, unlocked);
    }
    let activePool: { remainingInr: number; label: string } | null = null;
    for (const p of pools) {
      if (p.keys.includes(catKey)) {
        activePool = p;
        minCap = minCap === null ? p.remainingInr : Math.min(minCap, p.remainingInr);
      }
    }
    return { capInr: minCap, activePool };
  };

  for (const k of orderedKeys) {
    const m = monthlySpend[k] || 0;
    const annSpend = m * 12;
    annualSpendInr += annSpend;

    const prevSpendA = spendForA;
    const prevSpendB = spendForB;
    const rawRateA = cardA.effective_return_pct_by_category?.[k] ?? 0;
    const rawRateB = cardB.effective_return_pct_by_category?.[k] ?? 0;

    let baseRateA = rawRateA;
    let baseRateB = rawRateB;

    if (k === "utilities_bills_telecom" && hasAirtel) {
      const unlockedCap = calculateAirtelAxisUtilityCap(airtelBaseMonthlySpend);
      if (cardA.card_id === AIRTEL_ID) {
        baseRateA =
          unlockedCap <= 0
            ? 0
            : m > 0
              ? Math.min(baseRateA, (Math.min(m * (baseRateA / 100), unlockedCap) / m) * 100)
              : 0;
      }
      if (cardB.card_id === AIRTEL_ID) {
        baseRateB =
          unlockedCap <= 0
            ? 0
            : m > 0
              ? Math.min(baseRateB, (Math.min(m * (baseRateB / 100), unlockedCap) / m) * 100)
              : 0;
      }
    }

    const effRateA = baseRateA * multA;
    const effRateB = baseRateB * multB;

    const primaryIsA = effRateA >= effRateB;
    const firstCard = primaryIsA ? cardA : cardB;
    const secondCard = primaryIsA ? cardB : cardA;
    const firstPools = primaryIsA ? poolsA : poolsB;
    const secondPools = primaryIsA ? poolsB : poolsA;
    const firstRate = primaryIsA ? baseRateA : baseRateB;
    const secondRate = primaryIsA ? baseRateB : baseRateA;
    const firstMult = primaryIsA ? multA : multB;
    const secondMult = primaryIsA ? multB : multA;

    let monthlyBaseA = 0;
    let monthlyBaseB = 0;
    let monthlyDisplayReward = 0;
    let useCard: "A" | "B" | "SPLIT" = primaryIsA ? "A" : "B";
    let splitNote: string | undefined;

    const addPrimaryBase = (amt: number) => {
      if (primaryIsA) monthlyBaseA += amt;
      else monthlyBaseB += amt;
    };
    const addSecondaryBase = (amt: number) => {
      if (primaryIsA) monthlyBaseB += amt;
      else monthlyBaseA += amt;
    };

    if (m > 0) {
      const { capInr: firstCapInr, activePool: firstPool } = getHeadroomRewardCap(
        firstCard,
        firstPools,
        k
      );
      const { capInr: secondCapInr, activePool: secondPool } = getHeadroomRewardCap(
        secondCard,
        secondPools,
        k
      );

      if (firstCapInr !== null && firstRate > 0) {
        const capSpend = Math.min(m, (firstCapInr / firstRate) * 100);
        const primaryRewardAtCap = capSpend * (firstRate / 100);
        if (m > capSpend + 1) {
          const excessSpend = m - capSpend;
          const firstFallback =
            k === "fuel" || k === "education_rent_govt" || k === "international_forex_net_of_markup"
              ? 0
              : Math.min(baseFallbackRatePct(firstCard), firstRate * 0.4);
          const firstExcessReward = excessSpend * (firstFallback / 100);

          let secondReward = 0;
          if (secondRate > 0) {
            if (secondCapInr !== null) {
              const secCapSpend = Math.min(excessSpend, (secondCapInr / secondRate) * 100);
              const secFallback =
                k === "fuel" || k === "education_rent_govt" || k === "international_forex_net_of_markup"
                  ? 0
                  : Math.min(baseFallbackRatePct(secondCard), secondRate * 0.4);
              secondReward =
                secCapSpend * (secondRate / 100) +
                Math.max(0, excessSpend - secCapSpend) * (secFallback / 100);
            } else {
              secondReward = excessSpend * (secondRate / 100);
            }
          }

          if (secondReward * secondMult > firstExcessReward * firstMult && secondRate * secondMult > firstFallback * firstMult) {
            useCard = capSpend > 0 ? "SPLIT" : primaryIsA ? "B" : "A";
            addPrimaryBase(primaryRewardAtCap);
            addSecondaryBase(secondReward);
            monthlyDisplayReward = primaryRewardAtCap * firstMult + secondReward * secondMult;
            if (firstPool) firstPool.remainingInr = Math.max(0, firstPool.remainingInr - primaryRewardAtCap);
            if (secondPool) secondPool.remainingInr = Math.max(0, secondPool.remainingInr - Math.min(secondCapInr ?? secondReward, secondReward));
            if (primaryIsA) {
              spendForA += capSpend * 12;
              spendForB += excessSpend * 12;
            } else {
              spendForB += capSpend * 12;
              spendForA += excessSpend * 12;
            }
            const firstShort = firstCard.card_name.split(" ")[0];
            const secondShort = secondCard.card_name.split(" ")[0];
            splitNote =
              capSpend > 0
                ? `First ₹${Math.round(capSpend).toLocaleString("en-IN")} on ${firstShort} (${(firstRate * firstMult).toFixed(1)}% cap), rest ₹${Math.round(excessSpend).toLocaleString("en-IN")} on ${secondShort}`
                : `${firstShort} pool exhausted — routed ₹${Math.round(excessSpend).toLocaleString("en-IN")} to ${secondShort} (${(secondRate * secondMult).toFixed(1)}%)`;
            if (spilloverNotes.length < 4) {
              spilloverNotes.push(`${SPEND_CATEGORY_META[k].shortLabel}: ${splitNote}`);
            }
          } else {
            const totalFirstBase = primaryRewardAtCap + firstExcessReward;
            addPrimaryBase(totalFirstBase);
            monthlyDisplayReward = totalFirstBase * firstMult;
            if (firstPool) firstPool.remainingInr = Math.max(0, firstPool.remainingInr - primaryRewardAtCap);
            if (primaryIsA) spendForA += annSpend;
            else spendForB += annSpend;
          }
        } else {
          const baseAmt = m * (firstRate / 100);
          addPrimaryBase(baseAmt);
          monthlyDisplayReward = baseAmt * firstMult;
          if (firstPool) firstPool.remainingInr = Math.max(0, firstPool.remainingInr - baseAmt);
          if (primaryIsA) spendForA += annSpend;
          else spendForB += annSpend;
        }
      } else {
        const baseAmt = m * (firstRate / 100);
        addPrimaryBase(baseAmt);
        monthlyDisplayReward = baseAmt * firstMult;
        if (firstPool) firstPool.remainingInr = Math.max(0, firstPool.remainingInr - baseAmt);
        if (primaryIsA) spendForA += annSpend;
        else spendForB += annSpend;
      }
    }

    rewardAAnnualInr += monthlyBaseA * 12;
    rewardBAnnualInr += monthlyBaseB * 12;
    const annReward = monthlyDisplayReward * 12;
    const effectivePct = m > 0 ? (monthlyDisplayReward / m) * 100 : Math.max(effRateA, effRateB);

    if (hasAirtel && BASE_RETAIL_KEYS.has(k)) {
      if (cardA.card_id === AIRTEL_ID) airtelBaseMonthlySpend += (spendForA - prevSpendA) / 12;
      if (cardB.card_id === AIRTEL_ID) airtelBaseMonthlySpend += (spendForB - prevSpendB) / 12;
    }

    if (m > 0) {
      splitByKey.set(k, {
        key: k,
        monthlySpendInr: m,
        useCard,
        bestPct: Number(Math.max(effRateA, effRateB).toFixed(2)),
        effectivePct: Number(effectivePct.toFixed(2)),
        annualRewardInr: annReward,
        splitNote,
      });
    }
  }

  const cardAConversion = applyConversionStrategy(cardA, conversionStrategy, rewardAAnnualInr);
  const cardBConversion = applyConversionStrategy(cardB, conversionStrategy, rewardBAnnualInr);
  comboGrossRewardsInr =
    cardAConversion.effectiveAnnualRewardsInr + cardBConversion.effectiveAnnualRewardsInr;
  if (cardAConversion.overflowNote) spilloverNotes.push(`${cardA.card_name.split(" ")[0]}: ${cardAConversion.overflowNote}`);
  if (cardBConversion.overflowNote) spilloverNotes.push(`${cardB.card_name.split(" ")[0]}: ${cardBConversion.overflowNote}`);

  const wA = waiverMap[cardA.card_id] ?? cardA.fee_waiver_spend_inr ?? null;
  const wB = waiverMap[cardB.card_id] ?? cardB.fee_waiver_spend_inr ?? null;

  const aWaived = cardA.annual_fee_inr === 0 || (wA !== null && wA > 0 && spendForA >= wA);
  const bWaived = cardB.annual_fee_inr === 0 || (wB !== null && wB > 0 && spendForB >= wB);

  const cardAFeeChargedInr = aWaived
    ? 0
    : includeGstOnFee
      ? Math.round(cardA.annual_fee_inr * 1.18)
      : cardA.annual_fee_inr;
  const cardBFeeChargedInr = bWaived
    ? 0
    : includeGstOnFee
      ? Math.round(cardB.annual_fee_inr * 1.18)
      : cardB.annual_fee_inr;

  const comboNetAnnualInr = comboGrossRewardsInr - cardAFeeChargedInr - cardBFeeChargedInr;

  const singleA = evaluateCardForSpend(cardA, monthlySpend, wA, includeGstOnFee, conversionStrategy);
  const singleB = evaluateCardForSpend(cardB, monthlySpend, wB, includeGstOnFee, conversionStrategy);
  const singleBestNetAnnualInr = Math.max(singleA.netAnnualBenefitInr, singleB.netAnnualBenefitInr);

  const categorySplit = Array.from(splitByKey.values()).sort(
    (a, b) => b.annualRewardInr - a.annualRewardInr
  );

  const totalPartnerUnits =
    (cardAConversion.supportsStrategy ? cardAConversion.convertedUnitsPerYear : 0) +
    (cardBConversion.supportsStrategy ? cardBConversion.convertedUnitsPerYear : 0);
  const convertedSummaryLabel =
    (conversionStrategy === "accor_all" || conversionStrategy === "air_miles") && totalPartnerUnits > 0
      ? `~${totalPartnerUnits.toLocaleString("en-IN")} ${
          conversionStrategy === "accor_all" ? "Accor ALL Pts" : "Air Miles"
        }/yr`
      : null;

  return {
    cardA,
    cardB,
    annualSpendInr,
    cardAAnnualSpendInr: Math.round(spendForA),
    cardBAnnualSpendInr: Math.round(spendForB),
    cardAWaiverTargetInr: wA,
    cardBWaiverTargetInr: wB,
    cardAWaiverMet: aWaived,
    cardBWaiverMet: bWaived,
    comboGrossRewardsInr,
    cardAFeeChargedInr,
    cardBFeeChargedInr,
    comboNetAnnualInr,
    singleBestNetAnnualInr,
    extraGainOverSingleInr: comboNetAnnualInr - singleBestNetAnnualInr,
    conversionStrategy,
    cardAConversion,
    cardBConversion,
    convertedSummaryLabel,
    spilloverNotes,
    categorySplit,
  };
}

export function findBestTwoCardCombo(
  cards: CardSummaryItem[],
  monthlySpend: Record<SpendCategoryKey, number>,
  waiverMap: Record<string, number | null> = {},
  includeGstOnFee = true,
  options?: {
    profile?: Partial<AdvisorProfile>;
    metaMap?: Record<string, AdvisorCardMeta>;
    conversionStrategy?: RewardConversionStrategy;
  }
): TwoCardComboResult | null {
  const conversionStrategy: RewardConversionStrategy =
    options?.conversionStrategy ?? options?.profile?.conversionStrategy ?? "default_inr";
  let eligiblePool = cards.filter((c) => !isCardDiscontinuedForNewApplicants(c));
  if (options?.profile) {
    const p = options.profile;
    const metaMap = options.metaMap || {};
    eligiblePool = eligiblePool.filter((c) => {
      const t = c.filter_tags;
      const meta = metaMap[c.card_id];
      if (p.feePreference === "ltf_only" && !t.is_ltf) return false;
      if (p.feePreference === "low_fee" && c.annual_fee_inr > 1500) return false;
      if (p.avoidHighDevaluation && (meta?.devaluationRiskScore ?? 4) >= 7) return false;
      if (p.strictEligibility) {
        const minCibil = meta?.minCibilScore ?? t.min_cibil_score ?? 730;
        if ((p.cibilScore ?? 780) < minCibil && !t.is_fd_backed) return false;
        const minInc = normalizeMinMonthlyIncomeInr(
          c,
          meta?.minIncomeSalariedInr ?? t.min_income_salaried_inr,
          meta?.minItrAnnualInr
        );
        const effFloor = minInc ?? (t.is_invite_only ? 250000 : null);
        if (effFloor !== null && (p.monthlyIncomeInr ?? 85000) < effFloor && !t.is_fd_backed) {
          return false;
        }
      }
      return true;
    });
  }

  const rankedSingle = eligiblePool
    .map((c) => ({
      card: c,
      net: evaluateCardForSpend(
        c,
        monthlySpend,
        waiverMap[c.card_id] ?? c.fee_waiver_spend_inr ?? null,
        includeGstOnFee,
        conversionStrategy
      ).netAnnualBenefitInr,
    }))
    .sort((a, b) => b.net - a.net);

  const poolSet = new Map<string, CardSummaryItem>();
  for (const r of rankedSingle.slice(0, 18)) {
    poolSet.set(r.card.card_id, r.card);
  }
  const topRupay = eligiblePool
    .filter((c) => c.filter_tags.is_rupay_upi)
    .sort((a, b) => b.overall_rating - a.overall_rating)[0];
  if (topRupay) poolSet.set(topRupay.card_id, topRupay);

  if (conversionStrategy === "accor_all" || conversionStrategy === "air_miles") {
    for (const c of eligiblePool) {
      if (cardSupportsStrategy(c.card_id, conversionStrategy)) {
        poolSet.set(c.card_id, c);
      }
    }
  }

  const pool = Array.from(poolSet.values()).slice(0, 26);
  if (pool.length < 2) return null;

  let best: TwoCardComboResult | null = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const res = evaluateTwoCardCombo(
        pool[i],
        pool[j],
        monthlySpend,
        waiverMap,
        includeGstOnFee,
        conversionStrategy
      );
      if (!best || res.comboNetAnnualInr > best.comboNetAnnualInr) {
        best = res;
      }
    }
  }
  return best;
}
