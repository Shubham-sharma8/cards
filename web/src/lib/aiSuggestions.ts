import type {
  AdvisorPriorityMode,
  AdvisorProfile,
  RewardConversionStrategy,
  SpendCategoryKey,
} from "./types";
import type { CardEvaluation, TwoCardComboResult } from "./advisor";
import type { WalletAuditResult } from "./myCardsEngine";
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META, formatInr } from "./format";

export interface AiPromptExample {
  id: string;
  label: string;
  prompt: string;
}

export const AI_PROMPT_EXAMPLES: AiPromptExample[] = [
  {
    id: "hni-accor",
    label: "HNI Accor Strategist",
    prompt:
      "3.5L monthly salary, 30k flights & hotels, 15k dining, Accor ALL points, zero forex, golf",
  },
  {
    id: "miles-flyer",
    label: "₹1.8L Miles Flyer",
    prompt:
      "1.8L salary, 20k flights, 15k online shopping, Air Miles conversion, no-spend lounge",
  },
  {
    id: "cashback-upi",
    label: "₹80k Cashback + UPI",
    prompt:
      "80k salary, 10k Swiggy Zomato, 12k Amazon Flipkart, 8k UPI QR, low fee cashback",
  },
  {
    id: "ltf-starter",
    label: "₹35k Starter LTF",
    prompt: "35k salary, lifetime free only, 5k online, 4k UPI QR, 3k fuel",
  },
];

export interface ParsedAiProfilePatch {
  monthlyIncomeInr?: number;
  feePreference?: "any" | "ltf_only" | "low_fee";
  priorityMode?: AdvisorPriorityMode;
  conversionStrategy?: RewardConversionStrategy;
  avoidHighDevaluation?: boolean;
  needRupayUpi?: boolean;
  needNoSpendLounge?: boolean;
  needZeroLowForex?: boolean;
  needGolf?: boolean;
  preferredGoals?: string[];
  monthlySpend: Record<SpendCategoryKey, number>;
  detectedChips: string[];
}

function parseAmountToken(rawNum: string, suffix?: string): number {
  const num = parseFloat(rawNum.replace(/,/g, ""));
  if (!Number.isFinite(num) || num <= 0) return 0;
  const s = (suffix || "").toLowerCase().trim();
  if (s.startsWith("cr")) return num * 10000000;
  if (s === "l" || s.startsWith("lac") || s.startsWith("lakh")) return num * 100000;
  if (s === "k") return num * 1000;
  return num;
}

export function parseNaturalLanguagePromptToProfile(
  prompt: string,
  baseSpend: Record<SpendCategoryKey, number>
): ParsedAiProfilePatch {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const detectedChips: string[] = [];

  const patch: ParsedAiProfilePatch = {
    monthlySpend: { ...baseSpend },
    detectedChips,
  };

  // 1. Parse Salary / Income (handles "3.5L salary", "36 LPA", "80k income", "income 1.5 lakh")
  const incomePatterns = [
    /(?:salary|income|earn|earning|ctc|package|take\s*home|in-?hand)[^0-9]{0,16}(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)\s*(k|lpa|lakh|lakhs|lac|l|cr)?/i,
    /(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)\s*(k|lpa|lakh|lakhs|lac|l)\s*(?:per\s*month|\/mo|pm|monthly|salary|income|ctc|package|p\.?a\.?)?/i,
  ];

  let parsedMonthlyIncome: number | undefined;
  for (const pat of incomePatterns) {
    const match = lower.match(pat);
    if (match && match[1]) {
      const rawSuffix = (match[2] || "").toLowerCase();
      const fullSnippet = match[0].toLowerCase();
      const isAnnualContext =
        rawSuffix === "lpa" ||
        /(?:lpa|p\.?a\.?|per\s*annum|annual|yearly|ctc|package)/i.test(lower.slice(Math.max(0, (match.index ?? 0) - 8), (match.index ?? 0) + fullSnippet.length + 14));

      // Guard against capturing a pure spend token like "30k flights" when salary wasn't named
      const hasIncomeHint =
        /(?:salary|income|earn|ctc|package|lpa|in-?hand|take\s*home)/i.test(
          lower.slice(Math.max(0, (match.index ?? 0) - 18), (match.index ?? 0) + fullSnippet.length + 18)
        );
      if (!hasIncomeHint && pat === incomePatterns[1]) {
        // Check if followed by spend category words
        const trailing = lower.slice((match.index ?? 0) + fullSnippet.length, (match.index ?? 0) + fullSnippet.length + 22);
        if (/(?:flight|hotel|travel|dining|swiggy|zomato|amazon|flipkart|online|upi|qr|fuel|grocery|blinkit|rent|bill|forex)/i.test(trailing)) {
          continue;
        }
      }

      let amt = parseAmountToken(match[1], rawSuffix === "lpa" ? "l" : rawSuffix);
      if (isAnnualContext && amt >= 150000) {
        amt = Math.round(amt / 12);
      } else if (!isAnnualContext && rawSuffix.startsWith("l") && amt >= 1200000) {
        // e.g. "24L" without mentioning monthly -> assume annual CTC
        amt = Math.round(amt / 12);
      }
      if (amt >= 10000) {
        parsedMonthlyIncome = Math.max(15000, Math.min(1000000, Math.round(amt / 5000) * 5000));
        break;
      }
    }
  }

  if (parsedMonthlyIncome) {
    patch.monthlyIncomeInr = parsedMonthlyIncome;
    detectedChips.push(`Income ${formatInr(parsedMonthlyIncome)}/mo`);

    // Scale realistic default spends when high income & explicit spends aren't all filled
    if (parsedMonthlyIncome >= 250000) {
      patch.monthlySpend = {
        ...patch.monthlySpend,
        travel_flights_hotels: 28000,
        online_shopping_general: 20000,
        dining_swiggy_zomato: 14000,
        groceries_quick_commerce: 12000,
        offline_general_other: 12000,
      };
    } else if (parsedMonthlyIncome >= 150000) {
      patch.monthlySpend = {
        ...patch.monthlySpend,
        travel_flights_hotels: 15000,
        online_shopping_general: 14000,
        dining_swiggy_zomato: 10000,
        groceries_quick_commerce: 9000,
      };
    }
  }

  // 2. Conversion Strategy & Goals
  const goals = new Set<string>();
  if (/(?:accor|all\s+points?|hotel\s+transfer|marriott)/i.test(lower)) {
    patch.conversionStrategy = "accor_all";
    goals.add("Travel & Miles");
    goals.add("Super-Premium");
    detectedChips.push("Accor / Hotel Transfer");
  } else if (/(?:air\s*mile|miles?|krisflyer|avios|airline|flying\s+returns|maharaja|vistara)/i.test(lower)) {
    patch.conversionStrategy = "air_miles";
    goals.add("Travel & Miles");
    detectedChips.push("Air Miles (1:1)");
  } else if (/(?:statement\s*cash|direct\s*cash|cashback)/i.test(lower)) {
    patch.conversionStrategy = "cash_statement";
    goals.add("Cashback");
    detectedChips.push("Direct Cashback");
  }

  // 3. Fee Preference & Priority Mode
  if (/(?:ltf|lifetime\s*free|no\s*fee|zero\s*fee|free\s*card)/i.test(lower)) {
    patch.feePreference = "ltf_only";
    detectedChips.push("Lifetime Free Only");
  } else if (/(?:low\s*fee|budget|under\s*1000|under\s*1\.5k)/i.test(lower)) {
    patch.feePreference = "low_fee";
    detectedChips.push("Low Fee <= ₹1.5k");
  } else {
    patch.feePreference = "any";
  }

  if (/(?:uncapped|low\s*fee\s*uncapped|no\s*cap)/i.test(lower)) {
    patch.priorityMode = "low_fee_uncapped";
  } else if (/(?:lounge|flight|travel|miles|accor|hotel)/i.test(lower)) {
    patch.priorityMode = "travel_lounge";
  } else if (/(?:max\s*net|maximum\s*return|highest\s*cashback)/i.test(lower)) {
    patch.priorityMode = "max_net";
  }

  if (/(?:safe|stable|no\s*deval|low\s*deval)/i.test(lower)) {
    patch.avoidHighDevaluation = true;
    detectedChips.push("Devaluation-Safe");
  }

  // 4. Boolean Feature Requirements
  if (/(?:upi|rupay|qr\s*scan|bhim|gpay|phonepe)/i.test(lower)) {
    patch.needRupayUpi = true;
    goals.add("RuPay & UPI");
    detectedChips.push("RuPay UPI");
  }
  if (/(?:no[\s-]*spend\s*lounge|unconditional\s*lounge|lounge)/i.test(lower)) {
    patch.needNoSpendLounge = /(?:no[\s-]*spend|unconditional)/i.test(lower);
    goals.add("Airport Lounge");
    detectedChips.push(patch.needNoSpendLounge ? "No-Spend Lounge" : "Airport Lounge");
  }
  if (/(?:zero\s*forex|0\s*%?\s*forex|low\s*forex|no\s*forex|international\s*spend|usd)/i.test(lower)) {
    patch.needZeroLowForex = true;
    goals.add("Zero/Low Forex");
    detectedChips.push("Zero/Low Forex");
  }
  if (/(?:golf|green\s*fee|tee\s*off)/i.test(lower)) {
    patch.needGolf = true;
    goals.add("Golf");
    detectedChips.push("Golf Access");
  }

  // 5. Category-Specific Spend Amount Parsing
  const categoryKeywordMap: Array<{
    key: SpendCategoryKey;
    label: string;
    keywords: string[];
    defaultBoost: number;
  }> = [
    {
      key: "travel_flights_hotels",
      label: "Travel",
      keywords: ["flights?", "hotels?", "travel", "airlines?", "holidays?"],
      defaultBoost: 20000,
    },
    {
      key: "dining_swiggy_zomato",
      label: "Dining",
      keywords: ["dining", "restaurants?", "swiggy", "zomato", "food"],
      defaultBoost: 10000,
    },
    {
      key: "groceries_quick_commerce",
      label: "Groceries",
      keywords: ["grocer(?:y|ies)", "blinkit", "zepto", "instamart", "bigbasket"],
      defaultBoost: 8000,
    },
    {
      key: "amazon_flipkart_myntra",
      label: "Marketplaces",
      keywords: ["amazon", "flipkart", "myntra", "nykaa"],
      defaultBoost: 10000,
    },
    {
      key: "online_shopping_general",
      label: "Online",
      keywords: ["online\\s*shopping", "online", "shopping", "d2c"],
      defaultBoost: 12000,
    },
    {
      key: "upi_scan_and_pay",
      label: "UPI QR",
      keywords: ["upi\\s*qr", "upi", "qr\\s*scan", "merchant\\s*qr"],
      defaultBoost: 8000,
    },
    {
      key: "utilities_bills_telecom",
      label: "Utilities",
      keywords: ["utilities?", "bills?", "electricity", "broadband", "airtel", "telecom"],
      defaultBoost: 5000,
    },
    {
      key: "fuel",
      label: "Fuel",
      keywords: ["fuel", "petrol", "diesel", "bpcl", "iocl", "hpcl"],
      defaultBoost: 5000,
    },
    {
      key: "international_forex_net_of_markup",
      label: "Forex",
      keywords: ["forex", "international\\s*spend", "foreign\\s*currency", "usd"],
      defaultBoost: 15000,
    },
    {
      key: "insurance",
      label: "Insurance",
      keywords: ["insurance", "premiums?"],
      defaultBoost: 8000,
    },
    {
      key: "education_rent_govt",
      label: "Rent/Tax",
      keywords: ["rent", "tuition", "education", "advance\\s*tax", "gst"],
      defaultBoost: 20000,
    },
  ];

  let anyExplicitSpendMatched = false;
  for (const cat of categoryKeywordMap) {
    const kwGroup = cat.keywords.join("|");
    // Match "30k flights" or "flights 30k" or "flights & hotels 25,000"
    const beforePat = new RegExp(
      `(?:rs\\.?|inr|₹)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(k|lakh|lac|l)?\\s*(?:per\\s*month|\\/mo|on|for|in)?\\s*(?:${kwGroup})`,
      "i"
    );
    const afterPat = new RegExp(
      `(?:${kwGroup})[^0-9]{0,16}(?:rs\\.?|inr|₹)?\\s*(\\d+(?:[.,]\\d+)?)\\s*(k|lakh|lac|l)?`,
      "i"
    );

    const m = lower.match(beforePat) || lower.match(afterPat);
    if (m && m[1]) {
      const val = parseAmountToken(m[1], m[2]);
      if (val >= 500 && val <= 500000) {
        patch.monthlySpend[cat.key] = Math.round(val / 500) * 500;
        detectedChips.push(`${cat.label} ${formatInr(patch.monthlySpend[cat.key])}/mo`);
        anyExplicitSpendMatched = true;
      }
    } else if (new RegExp(`\\b(?:${kwGroup})\\b`, "i").test(lower)) {
      // Keyword mentioned without number -> ensure meaningful allocation if currently low
      if (patch.monthlySpend[cat.key] < cat.defaultBoost) {
        patch.monthlySpend[cat.key] = cat.defaultBoost;
        detectedChips.push(`${cat.label} prioritized`);
      }
    }
  }

  if (goals.size > 0) {
    patch.preferredGoals = Array.from(goals);
  } else if (anyExplicitSpendMatched) {
    // Auto-infer top spend goals cleanly
    const sorted = [...SPEND_CATEGORY_KEYS].sort(
      (a, b) => (patch.monthlySpend[b] || 0) - (patch.monthlySpend[a] || 0)
    );
    const top = sorted[0];
    if (top === "travel_flights_hotels") patch.preferredGoals = ["Travel & Miles"];
    else if (top === "dining_swiggy_zomato" || top === "groceries_quick_commerce") {
      patch.preferredGoals = ["Dining & Groceries", "Cashback"];
    } else if (top === "amazon_flipkart_myntra" || top === "online_shopping_general") {
      patch.preferredGoals = ["Online Shopping", "Cashback"];
    }
  }

  return patch;
}

export interface AdvisorAiSummary {
  headline: string;
  primaryReason: string;
  watchOutNote: string | null;
  comboNote: string | null;
}

export function generateAdvisorAiSummary(
  profile: AdvisorProfile,
  topCards: CardEvaluation[],
  bestCombo: TwoCardComboResult | null
): AdvisorAiSummary | null {
  if (topCards.length === 0) return null;
  const top = topCards[0];
  const second = topCards[1] ?? null;

  const stratText =
    profile.conversionStrategy === "accor_all"
      ? "with Accor ALL hotel transfer uplift"
      : profile.conversionStrategy === "air_miles"
        ? "with 1:1 airline mile valuation"
        : profile.conversionStrategy === "cash_statement"
          ? "counted strictly as liquid statement cash"
          : "under realistic Indian point value";

  const headline = `${top.card.card_name} leads your profile with ${formatInr(
    top.netAnnualBenefitInr
  )}/yr net return (${top.effectiveBlendedReturnPct.toFixed(1)}% effective) ${stratText}.`;

  let primaryReason = "";
  if (second) {
    const gap = Math.round(top.netAnnualBenefitInr - second.netAnnualBenefitInr);
    const gapText =
      gap > 1500
        ? `Beats #2 (${second.card.card_name}) by ${formatInr(gap)}/yr after annual fees & caps`
        : `Edges #2 (${second.card.card_name}) by ${formatInr(Math.max(0, gap))}/yr with stronger cap headroom`;
    const topCat = top.topCategories[0];
    const catLabel = topCat ? SPEND_CATEGORY_META[topCat.key]?.shortLabel ?? topCat.key : "core spends";
    primaryReason = `${gapText}; strongest anchor is ${catLabel} at ${top.topCategories[0]?.effectivePct.toFixed(1) ?? top.effectiveBlendedReturnPct.toFixed(1)}% post-cap.`;
  } else {
    primaryReason = top.reasons[0] || "Best net fit across your declared spend mix.";
  }

  let watchOutNote: string | null = null;
  if (top.eligibilityStatus === "income_stretch" && top.minRequiredIncomeInr) {
    watchOutNote = `Eligibility watch: ${top.card.card_name} typically asks for ~${formatInr(
      top.minRequiredIncomeInr
    )}/mo income or relationship upgrade—keep #2 ready as a direct approval backup.`;
  } else if (top.monthlyRewardLostToCapsInr >= 300) {
    const satNames = top.saturatedCategories
      .slice(0, 2)
      .map((k) => SPEND_CATEGORY_META[k]?.shortLabel || k)
      .join(" & ");
    watchOutNote = `Cap leakage detected: ${formatInr(
      top.monthlyRewardLostToCapsInr * 12
    )}/yr is clipped by monthly caps (${satNames || "accelerated tiers"}). Pair with a backup card to stop losing spillover.`;
  } else if (top.loungeSpendGateStatus === "spend_shortfall") {
    watchOutNote = `Lounge spend rule: requires ${formatInr(
      top.loungeQuarterlyShortfallInr
    )}/qtr more spend to unlock domestic airport lounges.`;
  } else if (top.devaluationRiskScore >= 7) {
    watchOutNote = `Devaluation caution (${top.devaluationRiskScore}/10 risk): bank has tightened reward caps or exclusions recently—redeem points regularly.`;
  }

  let comboNote: string | null = null;
  if (bestCombo && bestCombo.extraGainOverSingleInr >= 1500) {
    comboNote = `Two-card upgrade: pairing ${bestCombo.cardA.card_name} + ${bestCombo.cardB.card_name} adds +${formatInr(
      bestCombo.extraGainOverSingleInr
    )}/yr over any single card.`;
  }

  return {
    headline,
    primaryReason,
    watchOutNote,
    comboNote,
  };
}

export interface DossierAiVerdict {
  badgeLabel: string;
  tone: "positive" | "balanced" | "caution";
  summary: string;
  applyIf: string;
  skipIf: string;
}

export function generateDossierAiVerdict(input: {
  cardName: string;
  bank: string;
  annualFeeInr: number;
  feeWaiverSpendInr: number | null;
  overallRating: number;
  isLtf: boolean;
  isInviteOnly: boolean;
  hasNoSpendLounge: boolean;
  hasGolf: boolean;
  zeroOrLowForex: boolean;
  devaluationRiskScore: number;
  minIncomeInr: number | null;
  transferPartnerNames: string[];
  topCategoryLabel: string;
  topCategoryPct: number;
}): DossierAiVerdict {
  const highTransfer =
    input.transferPartnerNames.some((p) => /accor|krisflyer|avios|flying/i.test(p));

  let badgeLabel = "Solid Specialist";
  let tone: "positive" | "balanced" | "caution" = "balanced";

  if (input.overallRating >= 4.4 && input.devaluationRiskScore <= 6) {
    badgeLabel = input.isLtf ? "AI Top LTF Pick" : highTransfer ? "AI Miles / Accor Leader" : "AI Category Leader";
    tone = "positive";
  } else if (input.devaluationRiskScore >= 7) {
    badgeLabel = "Watch Recent Devaluations";
    tone = "caution";
  } else if (input.isInviteOnly) {
    badgeLabel = "Invite / HNI Relationship Tier";
    tone = "balanced";
  }

  const feeDesc = input.isLtf
    ? "₹0 lifetime annual fee"
    : input.feeWaiverSpendInr
      ? `${formatInr(input.annualFeeInr)}/yr fee (waived at ${formatInr(input.feeWaiverSpendInr)} spend)`
      : `${formatInr(input.annualFeeInr)}/yr renewal fee`;

  const standoutParts: string[] = [];
  if (input.topCategoryPct > 0) {
    standoutParts.push(`${input.topCategoryPct.toFixed(1)}% peak on ${input.topCategoryLabel}`);
  }
  if (highTransfer) standoutParts.push(`transferable partners (${input.transferPartnerNames.slice(0, 2).join(", ")})`);
  if (input.hasNoSpendLounge) standoutParts.push("no-spend airport lounge access");
  if (input.zeroOrLowForex) standoutParts.push("low/zero forex markup");
  if (input.hasGolf) standoutParts.push("complimentary golf rounds");

  const summary =
    standoutParts.length > 0
      ? `${input.cardName} offers ${feeDesc} paired with ${standoutParts.slice(0, 3).join(", ")}.`
      : `${input.cardName} carries a ${feeDesc} and rates ${input.overallRating.toFixed(2)}/5 across verified terms.`;

  const applyIf = input.minIncomeInr
    ? `You earn ${formatInr(input.minIncomeInr)}+/mo and concentrate spend in ${input.topCategoryLabel}${highTransfer ? " with mile/hotel redemptions" : ""}.`
    : `Your core spend aligns with ${input.topCategoryLabel}${input.isLtf ? " and you want zero renewal pressure." : " enough to comfortably out-earn the fee."}`;

  const skipIf =
    input.devaluationRiskScore >= 7
      ? `Avoid relying on uncapped utility/rent tricks—recent ${input.bank} capping revisions penalize skewed usage.`
      : input.annualFeeInr >= 4500 && !highTransfer
        ? `Skip if annual spend stays below ${formatInr(input.feeWaiverSpendInr || input.annualFeeInr * 40)}, as renewal fee drag will compress net return.`
        : `Skip if you mostly pay via UPI QR or zero-reward categories where dedicated co-branded LTF cards beat general earn rates.`;

  return {
    badgeLabel,
    tone,
    summary,
    applyIf,
    skipIf,
  };
}

export interface MyCardsAiSummary {
  healthBadge: string;
  headline: string;
  actionItems: string[];
}

export function generateMyCardsAiSummary(analysis: WalletAuditResult): MyCardsAiSummary | null {
  if (analysis.ownedCards.length === 0) return null;

  const weakCats = analysis.matrixRows.filter((r) => r.monthlySpendInr > 0 && r.isWeakCoverage);
  const dowgradeCards = analysis.cardAudits.filter((a) => a.action === "REVIEW_OR_DOWNGRADE");
  const topAdd = analysis.recommendedAdditions[0] ?? null;

  const healthBadge =
    analysis.blendedYieldPct >= 4.0 && weakCats.length <= 1
      ? "Optimized Stack"
      : analysis.blendedYieldPct >= 2.2
        ? "Room for +1.5–3% Lift"
        : "High Spend Leakage";

  const headline = `Your ${analysis.ownedCards.length}-card wallet nets ${formatInr(
    analysis.netCurrentAnnualValueInr
  )}/yr (${analysis.blendedYieldPct.toFixed(1)}% blended after fees) across ${formatInr(
    analysis.totalMonthlySpendInr
  )}/mo spend.`;

  const actionItems: string[] = [];

  if (weakCats.length > 0) {
    const names = weakCats
      .slice(0, 3)
      .map((r) => `${r.shortLabel} (${r.bestEffectivePct.toFixed(1)}%)`)
      .join(", ");
    actionItems.push(`Plug low-yield categories: ${names} are earning under 1.5%.`);
  }

  if (dowgradeCards.length > 0) {
    actionItems.push(
      `Fee trim candidate: ${dowgradeCards[0].card.card_name} costs ${formatInr(
        dowgradeCards[0].effectiveFeeInr
      )}/yr for limited primary category wins.`
    );
  }

  if (topAdd && topAdd.incrementalAnnualGainInr >= 1200) {
    actionItems.push(
      `Highest-ROI addition: adding ${topAdd.card.card_name} captures +${formatInr(
        topAdd.incrementalAnnualGainInr
      )}/yr incremental rewards.`
    );
  }

  if (analysis.loungeAudit.gaps.length > 0) {
    actionItems.push(`Travel gap: ${analysis.loungeAudit.gaps[0]}`);
  }

  if (actionItems.length === 0) {
    actionItems.push("Every active spend category is covered cleanly at >1.5% effective return.");
  }

  return {
    healthBadge,
    headline,
    actionItems,
  };
}
