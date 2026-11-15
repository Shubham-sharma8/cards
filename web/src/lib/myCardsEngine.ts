import type { CardSummaryItem, SpendCategoryKey } from "./types";
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META } from "./format";
import {
  SHARED_CAP_POOLS,
  baseFallbackRatePct,
  calculateAirtelAxisUtilityCap,
  cappedMonthlyCategoryReward,
  evaluateCardForSpend,
} from "./advisor";

export interface MatrixCellInfo {
  cardId: string;
  headlinePct: number;
  effectivePct: number;
  monthlyCapInr: number | null;
  eligibleSpendBeforeCapInr: number | null;
  monthlyRewardInr: number;
  isPrimary: boolean;
  isBackup: boolean;
  isZero: boolean;
}

export interface UtilizationMatrixRow {
  key: SpendCategoryKey;
  label: string;
  shortLabel: string;
  monthlySpendInr: number;
  bestCard: CardSummaryItem | null;
  backupCard: CardSummaryItem | null;
  bestEffectivePct: number;
  monthlyRewardInr: number;
  annualRewardInr: number;
  isWeakCoverage: boolean;
  hackTip: string;
  cellsByCardId: Record<string, MatrixCellInfo>;
}

export interface PortfolioCardAudit {
  card: CardSummaryItem;
  action: "KEEP" | "REVIEW_OR_DOWNGRADE";
  primaryCategoriesCount: number;
  primaryCategories: string[];
  attributedAnnualRewardInr: number;
  effectiveFeeInr: number;
  netAttributedValueInr: number;
  reason: string;
}

export interface RecommendedAddition {
  card: CardSummaryItem;
  incrementalAnnualGainInr: number;
  replacesOrBoosts: string[];
  fillsLoungeGap: boolean;
  fillsGolfGap: boolean;
  summaryReason: string;
}

export interface WalletAuditResult {
  ownedCards: CardSummaryItem[];
  matrixRows: UtilizationMatrixRow[];
  totalMonthlySpendInr: number;
  totalCurrentAnnualRewardsInr: number;
  totalCurrentFeesInr: number;
  netCurrentAnnualValueInr: number;
  blendedYieldPct: number;
  loungeAudit: {
    hasDomestic: boolean;
    hasNoSpendDomestic: boolean;
    hasInternational: boolean;
    hasRailway: boolean;
    hasGolf: boolean;
    bestLoungeCardName: string | null;
    bestGolfCardName: string | null;
    gaps: string[];
  };
  cardAudits: PortfolioCardAudit[];
  recommendedAdditions: RecommendedAddition[];
}

export function analyzeOwnedPortfolio(
  allCards: CardSummaryItem[],
  ownedIds: string[],
  monthlySpend: Record<SpendCategoryKey, number>,
  options: {
    needDomesticLounge?: boolean;
    needNoSpendLounge?: boolean;
    needInternationalLounge?: boolean;
    needGolf?: boolean;
  } = {}
): WalletAuditResult {
  const byId = new Map(allCards.map((c) => [c.card_id, c]));
  const ownedCards = ownedIds
    .map((id) => byId.get(id))
    .filter((c): c is CardSummaryItem => Boolean(c));

  const totalMonthlySpendInr = SPEND_CATEGORY_KEYS.reduce(
    (sum, k) => sum + (monthlySpend[k] || 0),
    0
  );

  // Track annual attributed spend & rewards per owned card
  const spendAssignedPerCard: Record<string, number> = {};
  const rewardAssignedPerCard: Record<string, number> = {};
  const wonCatsPerCard: Record<string, string[]> = {};
  for (const c of ownedCards) {
    spendAssignedPerCard[c.card_id] = 0;
    rewardAssignedPerCard[c.card_id] = 0;
    wonCatsPerCard[c.card_id] = [];
  }

  const AIRTEL_ID = "axis_bank_airtel_axis_bank_credit_card";
  const BASE_RETAIL_KEYS = new Set<SpendCategoryKey>([
    "online_shopping_general",
    "amazon_flipkart_myntra",
    "travel_flights_hotels",
    "upi_scan_and_pay",
    "offline_general_other",
  ]);
  const ownsAirtel = ownedCards.some((c) => c.card_id === AIRTEL_ID);
  let airtelBaseMonthlySpend = 0;

  const poolStateByCard: Record<
    string,
    Array<{ keys: SpendCategoryKey[]; combinedCapInr: number; remainingInr: number; label: string }>
  > = {};
  for (const c of ownedCards) {
    poolStateByCard[c.card_id] = (SHARED_CAP_POOLS[c.card_id] || []).map((p) => ({
      ...p,
      remainingInr: p.combinedCapInr,
    }));
  }

  const orderedCats = [...SPEND_CATEGORY_KEYS].sort((a, b) => {
    if (ownsAirtel) {
      if (a === "utilities_bills_telecom" && b !== "utilities_bills_telecom") return 1;
      if (b === "utilities_bills_telecom" && a !== "utilities_bills_telecom") return -1;
    }
    const maxA = ownedCards.reduce(
      (mx, c) => Math.max(mx, c.effective_return_pct_by_category?.[a] ?? 0),
      0
    );
    const maxB = ownedCards.reduce(
      (mx, c) => Math.max(mx, c.effective_return_pct_by_category?.[b] ?? 0),
      0
    );
    return maxB - maxA;
  });

  const evalOwnedCap = (card: CardSummaryItem, catKey: SpendCategoryKey, spendAmt: number) => {
    let res = cappedMonthlyCategoryReward(card, catKey, spendAmt);
    if (card.card_id === AIRTEL_ID && catKey === "utilities_bills_telecom") {
      const unlockedUtilCap = calculateAirtelAxisUtilityCap(airtelBaseMonthlySpend);
      const clampedReward = Math.min(res.monthlyReward, unlockedUtilCap);
      const effPct = spendAmt > 0 ? (clampedReward / spendAmt) * 100 : unlockedUtilCap > 0 ? res.headlinePct : 0;
      const eligBeforeCap =
        unlockedUtilCap > 0 && res.headlinePct > 0
          ? Math.round((unlockedUtilCap / res.headlinePct) * 100)
          : 0;
      res = {
        ...res,
        headlinePct: unlockedUtilCap > 0 ? res.headlinePct : 0,
        effectivePct: effPct,
        monthlyReward: clampedReward,
        monthlyCapInr: unlockedUtilCap,
        eligibleSpendBeforeCapInr: eligBeforeCap,
        capped: clampedReward < res.monthlyReward || res.capped,
      };
    }

    const activePool = (poolStateByCard[card.card_id] || []).find((p) =>
      p.keys.includes(catKey)
    );
    if (activePool && res.headlinePct > 0) {
      const effectivePoolCap = Math.max(
        0,
        Math.min(res.monthlyCapInr ?? Number.POSITIVE_INFINITY, activePool.remainingInr)
      );
      if (effectivePoolCap < (res.monthlyCapInr ?? Number.POSITIVE_INFINITY)) {
        const fallbackPct =
          catKey === "fuel" ||
          catKey === "education_rent_govt" ||
          catKey === "international_forex_net_of_markup"
            ? 0
            : Math.min(baseFallbackRatePct(card), res.headlinePct * 0.4);
        if (effectivePoolCap <= 0) {
          const fallbackReward = spendAmt > 0 ? spendAmt * (fallbackPct / 100) : 0;
          return {
            ...res,
            headlinePct: fallbackPct,
            effectivePct: fallbackPct,
            monthlyReward: fallbackReward,
            monthlyCapInr: 0,
            eligibleSpendBeforeCapInr: 0,
            capped: true,
          };
        }
        const eligSpend = (effectivePoolCap / res.headlinePct) * 100;
        const clampedSpend = Math.min(spendAmt, eligSpend);
        const excessSpend = Math.max(0, spendAmt - clampedSpend);
        const monthlyReward =
          clampedSpend * (res.headlinePct / 100) + excessSpend * (fallbackPct / 100);
        const effectivePct = spendAmt > 0 ? (monthlyReward / spendAmt) * 100 : res.headlinePct;
        return {
          ...res,
          effectivePct,
          monthlyReward,
          monthlyCapInr: Math.round(effectivePoolCap),
          eligibleSpendBeforeCapInr: Math.round(eligSpend),
          capped: spendAmt > eligSpend || res.capped,
        };
      }
    }
    return res;
  };

  const consumeSharedPool = (
    cardId: string,
    catKey: SpendCategoryKey,
    assignedRewardInr: number
  ) => {
    const activePool = (poolStateByCard[cardId] || []).find((p) => p.keys.includes(catKey));
    if (activePool && assignedRewardInr > 0) {
      activePool.remainingInr = Math.max(0, activePool.remainingInr - assignedRewardInr);
    }
  };

  let totalCurrentAnnualRewardsInr = 0;
  const rowByKey = new Map<SpendCategoryKey, UtilizationMatrixRow>();

  for (const k of orderedCats) {
    const mSpend = monthlySpend[k] || 0;
    const evalSpendForRate = mSpend > 0 ? mSpend : 5000;

    // Score each owned card on this category
    const perCardEval = ownedCards.map((card) => {
      const capRes = evalOwnedCap(card, k, evalSpendForRate);
      return { card, capRes };
    });

    perCardEval.sort(
      (a, b) =>
        b.capRes.effectivePct - a.capRes.effectivePct ||
        b.card.overall_rating - a.card.overall_rating
    );

    const best = perCardEval[0] ?? null;
    const second = perCardEval.length > 1 ? perCardEval[1] : null;

    let monthlyRewardInr = 0;
    let bestEffectivePct = 0;
    let backupCard: CardSummaryItem | null = null;
    let hackTip = "Add a card in this vertical to unlock positive return.";

    if (best && best.capRes.headlinePct > 0) {
      if (mSpend > 0) {
        if (
          best.capRes.capped &&
          best.capRes.eligibleSpendBeforeCapInr !== null &&
          second &&
          second.capRes.headlinePct > 0.5 &&
          second.capRes.headlinePct > best.capRes.headlinePct * 0.4
        ) {
          const firstSpend = best.capRes.eligibleSpendBeforeCapInr;
          const restSpend = Math.max(0, mSpend - firstSpend);
          const firstReward = firstSpend * (best.capRes.headlinePct / 100);
          const restRes = evalOwnedCap(second.card, k, restSpend);
          monthlyRewardInr = firstReward + restRes.monthlyReward;
          bestEffectivePct = (monthlyRewardInr / mSpend) * 100;
          backupCard = second.card;

          spendAssignedPerCard[best.card.card_id] += firstSpend * 12;
          rewardAssignedPerCard[best.card.card_id] += firstReward * 12;
          spendAssignedPerCard[second.card.card_id] += restSpend * 12;
          rewardAssignedPerCard[second.card.card_id] += restRes.monthlyReward * 12;
          wonCatsPerCard[best.card.card_id].push(SPEND_CATEGORY_META[k].shortLabel);
          consumeSharedPool(best.card.card_id, k, firstReward);
          consumeSharedPool(second.card.card_id, k, restRes.monthlyReward);

          if (ownsAirtel && BASE_RETAIL_KEYS.has(k)) {
            if (best.card.card_id === AIRTEL_ID) airtelBaseMonthlySpend += firstSpend;
            if (second.card.card_id === AIRTEL_ID) airtelBaseMonthlySpend += restSpend;
          }

          hackTip = `Swipe ${best.card.card_name} first up to ₹${firstSpend.toLocaleString("en-IN")}/mo (${best.capRes.headlinePct}% cap), then shift remaining ₹${restSpend.toLocaleString("en-IN")} to ${second.card.card_name} (${restRes.effectivePct.toFixed(1)}%).`;
        } else {
          const actual = evalOwnedCap(best.card, k, mSpend);
          monthlyRewardInr = actual.monthlyReward;
          bestEffectivePct = actual.effectivePct;
          spendAssignedPerCard[best.card.card_id] += mSpend * 12;
          rewardAssignedPerCard[best.card.card_id] += actual.monthlyReward * 12;
          wonCatsPerCard[best.card.card_id].push(SPEND_CATEGORY_META[k].shortLabel);
          consumeSharedPool(best.card.card_id, k, actual.monthlyReward);

          if (ownsAirtel && BASE_RETAIL_KEYS.has(k) && best.card.card_id === AIRTEL_ID) {
            airtelBaseMonthlySpend += mSpend;
          }

          if (actual.capped && actual.monthlyCapInr) {
            hackTip = `${best.card.card_name} earns ${actual.headlinePct}% up to ₹${actual.monthlyCapInr.toLocaleString("en-IN")}/mo cap, then drops to base rate — pair with a second card if spend stays high.`;
          } else if (actual.monthlyCapInr) {
            hackTip = `Use ${best.card.card_name} (${actual.headlinePct}% · capped at ₹${actual.monthlyCapInr.toLocaleString("en-IN")}/mo).`;
          } else {
            hackTip = `Use ${best.card.card_name} for uncapped ${actual.headlinePct.toFixed(1)}% return.`;
          }
        }
      } else {
        bestEffectivePct = best.capRes.effectivePct;
        hackTip = `Ready on ${best.card.card_name} at ${best.capRes.headlinePct.toFixed(1)}%.`;
      }
    } else if (k === "education_rent_govt") {
      hackTip = "Most Indian cards exclude rent/govt; consider BizBlack (for tax) or RedGirraffe + Amex/IDFC Vistara milestones only if surcharge stays below 1.5%.";
    } else if (k === "international_forex_net_of_markup" && best) {
      hackTip = `${best.card.card_name} loses money on FX markup (${bestEffectivePct.toFixed(1)}% net). Add a 0% Forex LTF card (ixigo AU / Scapia / Uni).`;
    }

    if (ownsAirtel && k === "utilities_bills_telecom" && airtelBaseMonthlySpend < 25000) {
      const note =
        airtelBaseMonthlySpend === 0
          ? "Apr 2026 MITC: Airtel Axis earns ₹0 Airtel/Utility cashback without 1% base retail spend on it."
          : `Apr 2026 MITC: ₹${Math.round(airtelBaseMonthlySpend).toLocaleString("en-IN")} base spend unlocks max ₹${calculateAirtelAxisUtilityCap(airtelBaseMonthlySpend)}/mo (2× Airtel + 1× Utility) on Airtel Axis.`;
      hackTip = best && best.capRes.headlinePct > 0 ? `${hackTip} (${note})` : note;
    }

    const annualRewardInr = monthlyRewardInr * 12;
    totalCurrentAnnualRewardsInr += annualRewardInr;

    const cellsByCardId: Record<string, MatrixCellInfo> = {};
    for (const { card, capRes } of perCardEval) {
      const actualRes = capRes;
      cellsByCardId[card.card_id] = {
        cardId: card.card_id,
        headlinePct: actualRes.headlinePct,
        effectivePct: Number(actualRes.effectivePct.toFixed(2)),
        monthlyCapInr: actualRes.monthlyCapInr,
        eligibleSpendBeforeCapInr: actualRes.eligibleSpendBeforeCapInr,
        monthlyRewardInr: actualRes.monthlyReward,
        isPrimary: best?.card.card_id === card.card_id && actualRes.headlinePct > 0,
        isBackup: backupCard?.card_id === card.card_id,
        isZero: actualRes.headlinePct <= 0,
      };
    }

    const isWeakCoverage =
      ownedCards.length > 0 &&
      mSpend >= 1500 &&
      k !== "education_rent_govt" &&
      bestEffectivePct < 1.5;

    rowByKey.set(k, {
      key: k,
      label: SPEND_CATEGORY_META[k].label,
      shortLabel: SPEND_CATEGORY_META[k].shortLabel,
      monthlySpendInr: mSpend,
      bestCard: best && best.capRes.headlinePct > 0 ? best.card : null,
      backupCard,
      bestEffectivePct: Number(bestEffectivePct.toFixed(2)),
      monthlyRewardInr,
      annualRewardInr,
      isWeakCoverage,
      hackTip,
      cellsByCardId,
    });
  }

  const matrixRows: UtilizationMatrixRow[] = SPEND_CATEGORY_KEYS.map((k) => rowByKey.get(k)!);

  // Audit Lounge & Golf
  const domCards = ownedCards.filter((c) => c.filter_tags.has_domestic_lounge);
  const noSpendDomCards = ownedCards.filter((c) => c.filter_tags.no_spend_domestic_lounge);
  const intlCards = ownedCards.filter((c) => c.filter_tags.has_international_lounge);
  const railCards = ownedCards.filter((c) => c.filter_tags.has_railway_lounge);
  const golfCards = ownedCards.filter((c) => c.filter_tags.has_golf || c.categories.includes("Golf"));

  const gaps: string[] = [];
  if (options.needDomesticLounge && domCards.length === 0) {
    gaps.push("Zero Domestic Airport Lounge access in your current stack");
  }
  if (options.needNoSpendLounge && noSpendDomCards.length === 0) {
    gaps.push("No unconditional (zero quarterly spend) Domestic Lounge card in your wallet");
  }
  if (options.needInternationalLounge && intlCards.length === 0) {
    gaps.push("Zero International / Priority Pass lounge visits in your current cards");
  }
  if (options.needGolf && golfCards.length === 0) {
    gaps.push("No complimentary Golf green-fee or coaching card in your wallet");
  }

  // Portfolio Keep / Remove audit
  let totalCurrentFeesInr = 0;
  const cardAudits: PortfolioCardAudit[] = ownedCards.map((card) => {
    const waiverSpend = card.fee_waiver_spend_inr ?? null;
    const assignedSpend = spendAssignedPerCard[card.card_id] || 0;
    const assignedRewards = rewardAssignedPerCard[card.card_id] || 0;
    const waived =
      card.annual_fee_inr === 0 ||
      (waiverSpend !== null && waiverSpend > 0 && assignedSpend >= waiverSpend);
    const effFee = waived ? 0 : Math.round(card.annual_fee_inr * 1.18);
    totalCurrentFeesInr += effFee;

    const wonCats = wonCatsPerCard[card.card_id] || [];
    const uniquePerk =
      (card.filter_tags.no_spend_domestic_lounge && noSpendDomCards.length === 1) ||
      (card.filter_tags.has_international_lounge && intlCards.length === 1) ||
      ((card.filter_tags.has_golf || card.categories.includes("Golf")) && golfCards.length === 1);

    const netVal = assignedRewards - effFee;
    const shouldReview =
      !card.filter_tags.is_ltf &&
      card.annual_fee_inr > 0 &&
      wonCats.length === 0 &&
      !uniquePerk;

    let reason = "";
    if (shouldReview) {
      reason = `Paying ${Math.round(effFee).toLocaleString("en-IN")} INR effective renewal while other cards in your wallet beat it in every spend bucket.`;
    } else if (card.filter_tags.is_ltf && wonCats.length === 0) {
      reason = "Lifetime Free (₹0 fee) — keep active as a zero-cost CIBIL age & bank-sale discount backup.";
    } else if (wonCats.length > 0) {
      reason = `Top card in your wallet for ${wonCats.slice(0, 3).join(", ")} generating ₹${Math.round(assignedRewards).toLocaleString("en-IN")}/yr.`;
    } else {
      reason = "Provides unique lounge/golf privileges not covered by your other cards.";
    }

    return {
      card,
      action: shouldReview ? "REVIEW_OR_DOWNGRADE" : "KEEP",
      primaryCategoriesCount: wonCats.length,
      primaryCategories: wonCats,
      attributedAnnualRewardInr: assignedRewards,
      effectiveFeeInr: effFee,
      netAttributedValueInr: netVal,
      reason,
    };
  });

  // Recommend top additions from cards NOT yet owned
  const ownedSet = new Set(ownedCards.map((c) => c.card_id));
  const candidates = allCards
    .filter((c) => !ownedSet.has(c.card_id))
    .map((cand) => {
      let incGain = 0;
      const boosts: string[] = [];

      for (const row of matrixRows) {
        if (row.monthlySpendInr <= 0) continue;
        let candRes = cappedMonthlyCategoryReward(cand, row.key, row.monthlySpendInr);
        if (cand.card_id === AIRTEL_ID && row.key === "utilities_bills_telecom") {
          const retailMonthly =
            (monthlySpend.online_shopping_general || 0) +
            (monthlySpend.amazon_flipkart_myntra || 0) +
            (monthlySpend.travel_flights_hotels || 0) +
            (monthlySpend.upi_scan_and_pay || 0) +
            (monthlySpend.offline_general_other || 0);
          const unlocked = Math.min(250, Math.round(retailMonthly * 0.015));
          candRes = { ...candRes, monthlyReward: Math.min(candRes.monthlyReward, unlocked) };
        }
        const currentBestMonthly = row.monthlyRewardInr;
        if (candRes.monthlyReward > currentBestMonthly) {
          const diffAnnual = (candRes.monthlyReward - currentBestMonthly) * 12;
          incGain += diffAnnual;
          if (diffAnnual >= 400) {
            boosts.push(`${row.shortLabel} (+₹${Math.round(diffAnnual).toLocaleString("en-IN")}/yr)`);
          }
        }
      }

      const evalFull = evaluateCardForSpend(cand, monthlySpend, cand.fee_waiver_spend_inr ?? null, true);
      const waiverTarget = cand.fee_waiver_spend_inr ?? null;
      const newSpend = Math.min(totalMonthlySpendInr * 12, incGain * 4);
      const waived =
        cand.annual_fee_inr === 0 ||
        (waiverTarget !== null && waiverTarget > 0 && newSpend >= waiverTarget);
      const feeCost = waived ? 0 : Math.round(cand.annual_fee_inr * 1.18);
      const netInc = incGain - feeCost;

      const fillsLoungeGap =
        ((options.needNoSpendLounge && noSpendDomCards.length === 0 && cand.filter_tags.no_spend_domestic_lounge) ||
          (options.needInternationalLounge && intlCards.length === 0 && cand.filter_tags.has_international_lounge) ||
          (options.needDomesticLounge && domCards.length === 0 && cand.filter_tags.has_domestic_lounge)) ?? false;

      const fillsGolfGap =
        Boolean(options.needGolf && golfCards.length === 0 && (cand.filter_tags.has_golf || cand.categories.includes("Golf")));

      const rankScore =
        netInc +
        (fillsLoungeGap ? 3500 : 0) +
        (fillsGolfGap ? 3000 : 0) +
        cand.overall_rating * 400 +
        (evalFull.netAnnualBenefitInr > 0 ? 300 : 0);

      let summaryReason = "";
      if (boosts.length > 0) {
        summaryReason = `Boosts ${boosts.slice(0, 2).join(" & ")}`;
      } else if (fillsLoungeGap) {
        summaryReason = "Closes your missing airport lounge coverage";
      } else if (fillsGolfGap) {
        summaryReason = `Adds Golf access (${cand.golf_summary?.complimentary_access ?? "complimentary rounds"})`;
      }

      return {
        card: cand,
        incrementalAnnualGainInr: netInc,
        replacesOrBoosts: boosts.slice(0, 3),
        fillsLoungeGap,
        fillsGolfGap,
        summaryReason,
        rankScore,
      };
    })
    .filter((x) => x.incrementalAnnualGainInr > 500 || x.fillsLoungeGap || x.fillsGolfGap)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 4)
    .map((item) => ({
      card: item.card,
      incrementalAnnualGainInr: item.incrementalAnnualGainInr,
      replacesOrBoosts: item.replacesOrBoosts,
      fillsLoungeGap: item.fillsLoungeGap,
      fillsGolfGap: item.fillsGolfGap,
      summaryReason: item.summaryReason,
    }));

  const netCurrentAnnualValueInr = totalCurrentAnnualRewardsInr - totalCurrentFeesInr;
  const annualTotalSpend = totalMonthlySpendInr * 12;
  const blendedYieldPct =
    annualTotalSpend > 0 ? (netCurrentAnnualValueInr / annualTotalSpend) * 100 : 0;

  return {
    ownedCards,
    matrixRows,
    totalMonthlySpendInr,
    totalCurrentAnnualRewardsInr,
    totalCurrentFeesInr,
    netCurrentAnnualValueInr,
    blendedYieldPct,
    loungeAudit: {
      hasDomestic: domCards.length > 0,
      hasNoSpendDomestic: noSpendDomCards.length > 0,
      hasInternational: intlCards.length > 0,
      hasRailway: railCards.length > 0,
      hasGolf: golfCards.length > 0,
      bestLoungeCardName: (noSpendDomCards[0] ?? domCards[0])?.card_name ?? null,
      bestGolfCardName: golfCards[0]?.card_name ?? null,
      gaps,
    },
    cardAudits,
    recommendedAdditions: candidates,
  };
}
