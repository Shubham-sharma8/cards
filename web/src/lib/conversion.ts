import type { CardSummaryItem, RewardConversionStrategy } from "./types";

export interface ConversionStrategyOption {
  id: RewardConversionStrategy;
  label: string;
  shortLabel: string;
  hint: string;
}

export const CONVERSION_STRATEGIES: ConversionStrategyOption[] = [
  {
    id: "default_inr",
    label: "Default / Modeled ₹",
    shortLabel: "Default ₹",
    hint: "Card's headline travel / default redemption",
  },
  {
    id: "cash_statement",
    label: "Statement Cashback",
    shortLabel: "Cashback",
    hint: "Direct statement credit value (penalizes low-cash travel points)",
  },
  {
    id: "air_miles",
    label: "Air Miles Transfer",
    shortLabel: "Air Miles",
    hint: "KrisFlyer, Avios & Air India Maharaja (~₹1.15/mile)",
  },
  {
    id: "accor_all",
    label: "Accor Points (ALL)",
    shortLabel: "Accor ALL",
    hint: "Accor Live Limitless hotel redemptions (~₹1.85/pt fixed)",
  },
];

export interface CardTransferSpec {
  supportsAirMiles: boolean;
  supportsAccor: boolean;
  /** Statement cash multiplier relative to modeled effective_return_pct */
  cashMultiplier: number;
  /** Air miles INR value multiplier relative to modeled effective_return_pct */
  airMilesMultiplier: number;
  /** How many Air Miles are earned per ₹1 of modeled reward value */
  airMilesPerModeledInr: number;
  /** Accor ALL INR value multiplier relative to modeled effective_return_pct */
  accorMultiplier: number;
  /** How many Accor ALL points are earned per ₹1 of modeled reward value */
  accorPerModeledInr: number;
  /** Annual Group A / partner transfer cap in converted partner units (miles or Accor ALL pts) */
  annualTransferCapUnits?: number;
  airMilesRatioText: string;
  accorRatioText: string;
  cashRatioText: string;
  keywords: string[];
}

export const CARD_TRANSFER_SPECS: Record<string, CardTransferSpec> = {
  axis_bank_atlas_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    annualTransferCapUnits: 60000,
    airMilesRatioText: "1 EDGE Mile → 2 Group A Miles (KrisFlyer, United, Air India · 30k EM/yr cap)",
    accorRatioText: "1 EDGE Mile → 2 Accor ALL (~₹3.70/EM · 30k EM = 60k ALL/yr Group A cap)",
    cashRatioText: "1 EDGE Mile = ₹1.00 on Travel EDGE (vs ₹3.70 in Accor ALL)",
    keywords: ["accor", "krisflyer", "united", "air india", "air miles", "edge miles", "transfer"],
  },
  axis_bank_magnus_burgundy_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    annualTransferCapUnits: 160000,
    airMilesRatioText: "5 EDGE RP → 4 Group A Air Miles (KrisFlyer, Avios, Air India · 2L/yr Group A)",
    accorRatioText: "5 EDGE RP → 4 Accor ALL (~₹1.48/RP · 2L/yr = 1.6L ALL/yr Group A cap)",
    cashRatioText: "Lower voucher / statement credit (~₹0.20–₹0.40/RP)",
    keywords: ["accor", "burgundy", "krisflyer", "avios", "air miles", "transfer"],
  },
  axis_bank_magnus_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.8,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    annualTransferCapUnits: 48000,
    airMilesRatioText: "5 EDGE RP → 2 Group A Air Miles (non-Burgundy cap)",
    accorRatioText: "5 EDGE RP → 2 Accor ALL (~₹0.74/RP)",
    cashRatioText: "₹0.20/RP voucher value",
    keywords: ["accor", "krisflyer", "air miles", "transfer"],
  },
  axis_bank_horizon_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 EDGE Mile → 1 Partner Air Mile",
    accorRatioText: "1 EDGE Mile → 1 Accor ALL Point (~₹1.85/EM)",
    cashRatioText: "1 EDGE Mile = ₹1.00 on Travel EDGE",
    keywords: ["accor", "air miles", "horizon", "edge miles", "transfer"],
  },
  axis_bank_olympus_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.2,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 Olympus EM → up to 4 Partner Air Miles",
    accorRatioText: "1 Olympus EM → up to 4 Accor ALL Points",
    cashRatioText: "Lower statement credit value vs travel transfers",
    keywords: ["accor", "olympus", "air miles", "transfer"],
  },
  hsbc_premier_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.4,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 HSBC RP → 1 Air Mile (KrisFlyer, BA Avios, Etihad, Air India · uncapped)",
    accorRatioText: "1 HSBC RP → 1 Accor ALL (~₹1.85/RP · uncapped 3% base = 5.55% Accor)",
    cashRatioText: "Statement / catalogue value ~₹0.40/RP",
    keywords: ["accor", "krisflyer", "avios", "etihad", "air miles", "hsbc premier", "transfer"],
  },
  hsbc_bank_travelone_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.4,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 HSBC RP → 1 Air Mile (KrisFlyer, Qatar, BA Avios, Air India)",
    accorRatioText: "1 HSBC RP → 1 Accor ALL (~₹1.85/RP · 3.7% base / 14.8% portal Accor)",
    cashRatioText: "Catalogue / cash redemption ~₹0.35–₹0.40/RP",
    keywords: ["accor", "krisflyer", "avios", "qatar", "air miles", "travelone", "transfer"],
  },
  hdfc_bank_infinia_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.3,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.925,
    accorPerModeledInr: 0.5,
    airMilesRatioText: "1 HDFC RP → 1 KrisFlyer / Avios / Air India Maharaja (~₹1.15/RP)",
    accorRatioText: "2 HDFC RP → 1 Accor ALL (~₹0.93/RP · 1:1 Air Miles/SmartBuy beats 2:1 Accor)",
    cashRatioText: "Statement cash ₹0.30/RP (vs ₹1.00 SmartBuy flights/Apple)",
    keywords: ["infinia", "krisflyer", "avios", "accor", "smartbuy", "air miles", "transfer"],
  },
  hdfc_bank_hdfc_diners_club_black_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.3,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.925,
    accorPerModeledInr: 0.5,
    airMilesRatioText: "1 HDFC RP → 1 KrisFlyer / Avios / Air India (~₹1.15/RP)",
    accorRatioText: "2 HDFC RP → 1 Accor ALL (~₹0.93/RP · 1:1 SmartBuy/Air Miles yields higher)",
    cashRatioText: "Statement cash ₹0.30/RP (vs ₹1.00 SmartBuy)",
    keywords: ["diners", "dcb", "krisflyer", "avios", "accor", "air miles", "transfer"],
  },
  hdfc_bank_biz_black_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.3,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.925,
    accorPerModeledInr: 0.5,
    airMilesRatioText: "1 HDFC RP → 1 KrisFlyer / Avios / Air India (~₹1.15/RP)",
    accorRatioText: "2 HDFC RP → 1 Accor ALL (~₹0.93/RP · 1:1 SmartBuy/Miles preferred)",
    cashRatioText: "Statement cash ₹0.30/RP",
    keywords: ["bizblack", "krisflyer", "avios", "accor", "air miles", "gst", "tax"],
  },
  hdfc_bank_hdfc_regalia_gold_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.4,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "2 HDFC RP → 1 Air Mile (KrisFlyer, Avios, Air India ~₹0.58/RP)",
    accorRatioText: "2 HDFC RP → 1 Accor ALL (~₹0.93/RP vs ₹0.50 SmartBuy / ₹0.20 cash)",
    cashRatioText: "Statement cash only ₹0.20/RP (travel/Accor gives 2.5x–4.6x more)",
    keywords: ["regalia", "accor", "krisflyer", "avios", "air miles", "transfer"],
  },
  hdfc_bank_diners_club_privilege_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.4,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "2 HDFC RP → 1 Air Mile (KrisFlyer / Avios / Air India)",
    accorRatioText: "2 HDFC RP → 1 Accor ALL (~₹0.93/RP vs ₹0.20 cash)",
    cashRatioText: "Statement cash ₹0.20/RP",
    keywords: ["dcp", "diners", "accor", "air miles", "transfer"],
  },
  indusind_indusind_bank_avios_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.35,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.85,
    accorPerModeledInr: 0,
    airMilesRatioText: "1:1 Direct Qatar Airways / British Airways Avios (~₹1.15/Avios)",
    accorRatioText: "No direct Accor 1:1 — earns Oneworld Avios directly",
    cashRatioText: "Travel miles card (low cash equivalent)",
    keywords: ["avios", "qatar", "british airways", "oneworld", "air miles", "transfer"],
  },
  indusind_bank_tiger_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.85,
    airMilesMultiplier: 1.5,
    airMilesPerModeledInr: 1.25,
    accorMultiplier: 0.85,
    accorPerModeledInr: 0,
    airMilesRatioText: "1 RP → 1 Air India Maharaja / KrisFlyer (added June 2026)",
    accorRatioText: "No direct Accor — transfers 1:1 to Air India Maharaja",
    cashRatioText: "Statement credit ~₹0.40/RP",
    keywords: ["air india", "maharaja", "krisflyer", "air miles", "tiger", "transfer"],
  },
  sbi_bank_sbi_miles_elite_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 Travel Credit → 1 Air Mile (Air India, KrisFlyer, SpiceJet)",
    accorRatioText: "1 Travel Credit → 1 Accor ALL Point (~₹1.85/credit)",
    cashRatioText: "Cash / catalogue value ~₹0.25–₹0.50/credit",
    keywords: ["sbi miles", "accor", "air miles", "travel credit", "transfer"],
  },
  sbi_bank_sbi_miles_prime_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 Travel Credit → 1 Partner Air Mile",
    accorRatioText: "1 Travel Credit → 1 Accor ALL Point",
    cashRatioText: "Catalogue value lower than travel transfer",
    keywords: ["sbi miles", "accor", "air miles", "transfer"],
  },
  sbi_bank_sbi_miles_credit_card: {
    supportsAirMiles: true,
    supportsAccor: true,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 1.85,
    accorPerModeledInr: 1.0,
    airMilesRatioText: "1 Travel Credit → 1 Partner Air Mile",
    accorRatioText: "1 Travel Credit → 1 Accor ALL Point",
    cashRatioText: "Catalogue value lower than travel transfer",
    keywords: ["sbi miles", "accor", "air miles", "transfer"],
  },
  amex_bank_american_express_platinum_travel_credit_cards: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.9,
    accorPerModeledInr: 0,
    airMilesRatioText: "2 Amex MR → 1 Avios / KrisFlyer (or 1:1 Marriott Bonvoy)",
    accorRatioText: "No direct Accor — best redeemed 1:1 into Marriott Bonvoy",
    cashRatioText: "Statement credit ₹0.25/MR (Marriott/miles give ₹0.55–₹0.80/MR)",
    keywords: ["amex", "marriott", "avios", "krisflyer", "air miles", "transfer"],
  },
  amex_american_express_platinum_charge_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.5,
    airMilesMultiplier: 1.15,
    airMilesPerModeledInr: 1.0,
    accorMultiplier: 0.9,
    accorPerModeledInr: 0,
    airMilesRatioText: "2 Amex MR → 1 Avios / KrisFlyer (or 1:1 Marriott Bonvoy)",
    accorRatioText: "No direct Accor — transfer 1:1 to Marriott Bonvoy / Hilton",
    cashRatioText: "Statement credit ₹0.25/MR",
    keywords: ["amex", "marriott", "hilton", "avios", "krisflyer", "air miles"],
  },
  amex_bank_membership_rewards_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 1.0,
    airMilesMultiplier: 2.0,
    airMilesPerModeledInr: 1.8,
    accorMultiplier: 1.0,
    accorPerModeledInr: 0,
    airMilesRatioText: "2 Amex MR → 1 Avios / KrisFlyer (doubles ₹0.25 base to ~₹0.55/MR)",
    accorRatioText: "No direct Accor — best used on Marriott Gold Collection / Air Miles",
    cashRatioText: "Cash / Amazon Pay Gold Collection ~₹0.25–₹0.33/MR",
    keywords: ["amex", "mrcc", "marriott", "avios", "air miles"],
  },
  amex_bank_american_express_gold_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 1.0,
    airMilesMultiplier: 2.0,
    airMilesPerModeledInr: 1.8,
    accorMultiplier: 1.0,
    accorPerModeledInr: 0,
    airMilesRatioText: "2 Amex MR → 1 Avios / KrisFlyer (stronger with 18k/24k Gold Collection)",
    accorRatioText: "No direct Accor — best via Marriott Bonvoy 1:1",
    cashRatioText: "Statement value ₹0.25/MR",
    keywords: ["amex", "marriott", "avios", "air miles"],
  },
  icici_bank_emeralde_private_metal_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.4,
    airMilesMultiplier: 1.08,
    airMilesPerModeledInr: 0.95,
    accorMultiplier: 0.95,
    accorPerModeledInr: 0,
    airMilesRatioText: "₹1.00/RP on iShop flights/hotels & select airline partner transfers",
    accorRatioText: "No direct Accor 1:1 — redeem ₹1.00/RP on iShop hotels & Taj",
    cashRatioText: "Statement cash value ~₹0.40/RP",
    keywords: ["emeralde", "ishop", "air india", "air miles", "super premium"],
  },
  hdfc_bank_marriott_bonvoy_hdfc_credit_card: {
    supportsAirMiles: true,
    supportsAccor: false,
    cashMultiplier: 0.4,
    airMilesMultiplier: 0.9,
    airMilesPerModeledInr: 0.7,
    accorMultiplier: 0.85,
    accorPerModeledInr: 0,
    airMilesRatioText: "3 Marriott Bonvoy Pts → 1 Air Mile (plus 1 Free Night Award/yr)",
    accorRatioText: "Earns Marriott Bonvoy Points directly (not Accor ALL)",
    cashRatioText: "Co-branded hotel points (not redeemable as cash)",
    keywords: ["marriott", "bonvoy", "hotel", "air miles"],
  },
};

export interface CardConversionResult {
  strategy: RewardConversionStrategy;
  supportsStrategy: boolean;
  multiplier: number;
  convertedUnitsPerYear: number;
  unitLabel: string;
  effectiveAnnualRewardsInr: number;
  ratioText: string;
  overflowNote: string | null;
}

export function cardSupportsStrategy(
  cardId: string,
  strategy: RewardConversionStrategy
): boolean {
  const spec = CARD_TRANSFER_SPECS[cardId];
  if (!spec) return strategy === "default_inr" || strategy === "cash_statement";
  if (strategy === "air_miles") return spec.supportsAirMiles;
  if (strategy === "accor_all") return spec.supportsAccor;
  return true;
}

export function getCardConversionKeywords(cardId: string): string[] {
  return CARD_TRANSFER_SPECS[cardId]?.keywords ?? [];
}

/**
 * Applies a chosen reward conversion strategy (Default INR, Statement Cash,
 * Air Miles, or Accor ALL) to a card's post-cap annual reward in INR.
 * Enforces annual Group A transfer caps (e.g. Axis Atlas 30k EM = 60k ALL/yr).
 */
export function applyConversionStrategy(
  card: CardSummaryItem,
  strategy: RewardConversionStrategy = "default_inr",
  modeledAnnualRewardInr: number
): CardConversionResult {
  const spec = CARD_TRANSFER_SPECS[card.card_id];

  if (strategy === "default_inr" || !spec) {
    const noTransferNote =
      strategy === "accor_all"
        ? "Direct cashback / non-Accor card (no Accor ALL transfer)"
        : strategy === "air_miles"
          ? "Direct cashback / non-airline-transfer card"
          : "Modeled INR value";
    return {
      strategy,
      supportsStrategy: strategy === "default_inr" || strategy === "cash_statement",
      multiplier: 1,
      convertedUnitsPerYear: 0,
      unitLabel: "INR",
      effectiveAnnualRewardsInr: Math.round(modeledAnnualRewardInr),
      ratioText: noTransferNote,
      overflowNote: null,
    };
  }

  if (strategy === "cash_statement") {
    const eff = Math.round(modeledAnnualRewardInr * spec.cashMultiplier);
    return {
      strategy,
      supportsStrategy: true,
      multiplier: spec.cashMultiplier,
      convertedUnitsPerYear: 0,
      unitLabel: "INR Cash",
      effectiveAnnualRewardsInr: eff,
      ratioText: spec.cashRatioText,
      overflowNote: null,
    };
  }

  if (strategy === "air_miles") {
    if (!spec.supportsAirMiles) {
      return {
        strategy,
        supportsStrategy: false,
        multiplier: 1,
        convertedUnitsPerYear: 0,
        unitLabel: "INR",
        effectiveAnnualRewardsInr: Math.round(modeledAnnualRewardInr),
        ratioText: spec.airMilesRatioText,
        overflowNote: null,
      };
    }
    const rawUnits = Math.round(modeledAnnualRewardInr * spec.airMilesPerModeledInr);
    const cap = spec.annualTransferCapUnits;
    if (cap && rawUnits > cap) {
      const cappedShare = cap / rawUnits;
      const cappedVal = modeledAnnualRewardInr * cappedShare * spec.airMilesMultiplier;
      const overflowVal =
        modeledAnnualRewardInr * (1 - cappedShare) * Math.max(0.5, spec.cashMultiplier);
      return {
        strategy,
        supportsStrategy: true,
        multiplier: spec.airMilesMultiplier,
        convertedUnitsPerYear: cap,
        unitLabel: "Air Miles",
        effectiveAnnualRewardsInr: Math.round(cappedVal + overflowVal),
        ratioText: spec.airMilesRatioText,
        overflowNote: `Partner transfer capped at ${cap.toLocaleString("en-IN")} miles/yr; excess valued at Group B / portal rate`,
      };
    }
    return {
      strategy,
      supportsStrategy: true,
      multiplier: spec.airMilesMultiplier,
      convertedUnitsPerYear: rawUnits,
      unitLabel: "Air Miles",
      effectiveAnnualRewardsInr: Math.round(modeledAnnualRewardInr * spec.airMilesMultiplier),
      ratioText: spec.airMilesRatioText,
      overflowNote: null,
    };
  }

  // accor_all
  if (!spec.supportsAccor) {
    const eff = Math.round(modeledAnnualRewardInr * spec.accorMultiplier);
    return {
      strategy,
      supportsStrategy: false,
      multiplier: spec.accorMultiplier,
      convertedUnitsPerYear: 0,
      unitLabel: "INR",
      effectiveAnnualRewardsInr: eff,
      ratioText: spec.accorRatioText,
      overflowNote: null,
    };
  }

  const rawAccor = Math.round(modeledAnnualRewardInr * spec.accorPerModeledInr);
  const cap = spec.annualTransferCapUnits;
  if (cap && rawAccor > cap) {
    const cappedShare = cap / rawAccor;
    const cappedVal = modeledAnnualRewardInr * cappedShare * spec.accorMultiplier;
    const overflowVal =
      modeledAnnualRewardInr * (1 - cappedShare) * Math.max(0.5, spec.cashMultiplier);
    return {
      strategy,
      supportsStrategy: true,
      multiplier: spec.accorMultiplier,
      convertedUnitsPerYear: cap,
      unitLabel: "Accor ALL",
      effectiveAnnualRewardsInr: Math.round(cappedVal + overflowVal),
      ratioText: spec.accorRatioText,
      overflowNote: `Accor Group A transfer hits ${cap.toLocaleString("en-IN")} ALL/yr limit; excess valued at portal/Group B`,
    };
  }

  return {
    strategy,
    supportsStrategy: true,
    multiplier: spec.accorMultiplier,
    convertedUnitsPerYear: rawAccor,
    unitLabel: "Accor ALL",
    effectiveAnnualRewardsInr: Math.round(modeledAnnualRewardInr * spec.accorMultiplier),
    ratioText: spec.accorRatioText,
    overflowNote: null,
  };
}

/**
 * Resolves a realistic monthly salaried floor in INR, guarding against
 * scraped annual ITR amounts showing up on Entry-Level / LTF cards.
 */
export function normalizeMinMonthlyIncomeInr(
  card: CardSummaryItem,
  explicitMinInc: number | null | undefined,
  minItrAnnualInr?: number | null
): number | null {
  let minInc = explicitMinInc ?? card.filter_tags.min_income_salaried_inr ?? null;
  if (minInc === null && minItrAnnualInr && minItrAnnualInr >= 120000) {
    minInc = Math.round(minItrAnnualInr / 12);
  }
  const tier = card.card_tier || "";
  if (
    minInc !== null &&
    minInc >= 200000 &&
    card.annual_fee_inr === 0 &&
    /entry|ltf|student|beginner/i.test(tier)
  ) {
    minInc = Math.round(minInc / 12);
  }
  if (minInc === null && !card.filter_tags.is_fd_backed) {
    if (
      card.annual_fee_inr >= 10000 ||
      /super-?premium|private|metal/i.test(tier)
    ) {
      minInc = 250000;
    } else if (card.annual_fee_inr >= 3000) {
      minInc = 100000;
    } else if (card.annual_fee_inr >= 1000) {
      minInc = 50000;
    }
  }
  return minInc;
}

/**
 * Scores a card for personalized search/directory sorting given optional
 * monthly income + preferred reward conversion strategy.
 */
export function computePersonalizedDirectoryScore(
  card: CardSummaryItem,
  options: {
    monthlyIncomeInr?: number | null;
    strategy?: RewardConversionStrategy;
  }
): { score: number; matchBadge: string | null } {
  const { monthlyIncomeInr = null, strategy = "default_inr" } = options;
  const spec = CARD_TRANSFER_SPECS[card.card_id];
  const minInc = normalizeMinMonthlyIncomeInr(card, card.filter_tags.min_income_salaried_inr);
  const peakBase = Math.max(
    0,
    ...Object.entries(card.effective_return_pct_by_category || {})
      .filter(([k]) => k !== "international_forex_net_of_markup")
      .map(([, v]) => v)
  );

  let score = card.overall_rating * 12 + peakBase * 1.4;
  let matchBadge: string | null = null;

  if (strategy === "accor_all") {
    if (spec?.supportsAccor) {
      score += 24 + (spec.accorMultiplier - 1) * 16;
      matchBadge = spec.accorMultiplier >= 1.8 ? "Top Accor Transfer" : "Accor Partner";
    } else {
      score -= 8;
    }
  } else if (strategy === "air_miles") {
    if (spec?.supportsAirMiles) {
      score += 22 + (spec.airMilesMultiplier - 1) * 14;
      matchBadge = "Air Miles Partner";
    } else {
      score -= 8;
    }
  } else if (strategy === "cash_statement") {
    if (!spec || spec.cashMultiplier >= 0.85) {
      score += 14;
      if (card.primary_category === "Cashback" || card.categories.includes("Cashback")) {
        score += 8;
        matchBadge = "Direct Cashback";
      }
    } else {
      score -= 6;
    }
  }

  if (monthlyIncomeInr && monthlyIncomeInr > 0) {
    if (minInc !== null && minInc > monthlyIncomeInr && !card.filter_tags.is_fd_backed) {
      score -= 45;
    } else {
      const effectiveFloor = minInc ?? (card.filter_tags.is_invite_only ? 250000 : 25000);
      if (monthlyIncomeInr >= 150000 && effectiveFloor >= 100000) {
        const tierBoost =
          effectiveFloor >= 300000
            ? 24
            : effectiveFloor >= 200000
              ? 18
              : 13;
        score += tierBoost;
        if (!matchBadge) {
          matchBadge =
            effectiveFloor >= 250000 ? "Super-Premium Match" : "Premium Unlocked";
        }
      } else if (card.filter_tags.no_spend_domestic_lounge && monthlyIncomeInr >= 75000) {
        score += 5;
      }
    }
  }

  return { score, matchBadge };
}
