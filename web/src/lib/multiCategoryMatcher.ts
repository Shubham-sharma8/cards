import {
  applyConversionStrategy,
  computePersonalizedDirectoryScore,
} from "./conversion";
import { CATEGORY_META } from "./format";
import type { CardSummaryItem, RewardConversionStrategy, SpendCategoryKey } from "./types";

export type CategoryMeta = (typeof CATEGORY_META)[number];

export interface CategoryMetricResult {
  categoryId: string;
  shortLabel: string;
  matched: boolean;
  isPartialBase: boolean;
  displayMetric: string;
  ratePct: number | null;
  normalizedScore: number;
}

export interface MultiCategoryRankedCard {
  card: CardSummaryItem;
  matchedIds: string[];
  matchedCount: number;
  totalSelected: number;
  isFullMatch: boolean;
  combinedScore: number;
  avgRatePct: number;
  categoryMetrics: CategoryMetricResult[];
  summaryLine: string;
}

export interface MultiCategoryComboPick {
  cardA: MultiCategoryRankedCard;
  cardB: MultiCategoryRankedCard;
  coveredIds: string[];
  coveredCount: number;
  totalSelected: number;
  combinedAnnualFeeInr: number;
  assignment: Array<{
    categoryId: string;
    shortLabel: string;
    owner: "A" | "B";
    cardName: string;
    displayMetric: string;
  }>;
}

export interface MultiCategoryRecommendation {
  selectedMetas: CategoryMeta[];
  rankedCards: MultiCategoryRankedCard[];
  bestOverall: MultiCategoryRankedCard | null;
  runnerUp: MultiCategoryRankedCard | null;
  bestLtfPick: MultiCategoryRankedCard | null;
  twoCardCombo: MultiCategoryComboPick | null;
  fullMatchCount: number;
}

/**
 * Resolves a category query token (meta id, dataset category name, or label)
 * to its canonical CategoryMeta entry.
 */
export function resolveCategoryMeta(token: string): CategoryMeta | null {
  if (!token || token === "all") return null;
  const normalized = token.trim();
  const lower = normalized.toLowerCase();
  const byId = CATEGORY_META.find((m) => m.id.toLowerCase() === lower);
  if (byId) return byId;

  return (
    CATEGORY_META.find(
      (m) =>
        m.label.toLowerCase() === lower &&
        m.datasetCategory.toLowerCase() === lower
    ) ||
    CATEGORY_META.find(
      (m) =>
        m.datasetCategory.toLowerCase() === lower &&
        ["cashback", "dining-groceries", "super-premium"].includes(m.id)
    ) ||
    CATEGORY_META.find((m) => m.datasetCategory.toLowerCase() === lower) ||
    null
  );
}

/**
 * Parses comma-separated multi-category URL parameters into deduplicated canonical IDs.
 */
export function parseCategoryListParam(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const resolved = resolveCategoryMeta(part);
    const id = resolved ? resolved.id : part.trim();
    if (id && id !== "all" && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Evaluates whether a card genuinely belongs to a single canonical category ID
 * (or raw dataset category string).
 */
export function matchesCategoryToken(
  card: CardSummaryItem,
  categoryToken: string
): boolean {
  if (!categoryToken || categoryToken === "all") return true;
  const meta = resolveCategoryMeta(categoryToken);
  if (meta && meta.id === categoryToken) {
    const ret = card.effective_return_pct_by_category;
    const t = card.filter_tags;
    const tagsHay = `${card.card_name} ${card.primary_category} ${(t.best_for_tags || []).join(" ")} ${(t.requirement_keywords || []).join(" ")}`;

    switch (meta.id) {
      case "utilities":
        return (
          (ret?.utilities_bills_telecom ?? 0) >= 2.0 ||
          (card.categories.includes("Cashback") &&
            /utilit|bill|airtel|recharge|bbps|electric/i.test(tagsHay))
        );
      case "insurance":
        return (
          (ret?.insurance ?? 0) >= 2.0 ||
          /insurance|lic|policy/i.test(tagsHay)
        );
      case "dining":
        return (
          (ret?.dining_swiggy_zomato ?? 0) >= 2.5 ||
          /dining|swiggy|zomato|eazydiner|restaurant/i.test(tagsHay)
        );
      case "groceries":
        return (
          (ret?.groceries_quick_commerce ?? 0) >= 2.5 ||
          /grocer|blinkit|zepto|bigbasket|instamart|dmart|supermarket/i.test(
            tagsHay
          )
        );
      case "gold-jewellery":
        return (
          /gold|jewel|tanishq|titan|caratlane|malabar|jewellery/i.test(
            tagsHay
          ) ||
          (card.categories.includes("Super-Premium") &&
            (ret?.offline_general_other ?? 0) >= 2.0)
        );
      case "golf":
        return Boolean(t.has_golf) || card.categories.includes("Golf");
      case "rupay-upi":
        return Boolean(t.is_rupay_upi) || card.categories.includes("RuPay & UPI");
      case "ltf":
        return Boolean(t.is_ltf) || card.categories.includes("Lifetime Free");
      case "entry-fd":
        return (
          Boolean(t.is_fd_backed) ||
          card.categories.includes("Entry-Level & Secured (FD)")
        );
      case "lounge":
        return (
          Boolean(t.has_domestic_lounge || t.has_international_lounge) ||
          card.categories.includes("Airport Lounge")
        );
      case "forex":
        return (
          Boolean(t.zero_or_low_forex) ||
          card.categories.includes("Zero/Low Forex")
        );
      default:
        return (
          card.categories.includes(meta.datasetCategory) ||
          card.primary_category === meta.datasetCategory
        );
    }
  }

  return (
    card.categories.includes(categoryToken) ||
    card.primary_category === categoryToken
  );
}

function getEffectiveRateForCategory(
  card: CardSummaryItem,
  categoryId: string,
  fallbackKey: SpendCategoryKey,
  strategy: RewardConversionStrategy
): number {
  const ret = card.effective_return_pct_by_category;
  let basePct = ret?.[fallbackKey] ?? 0;

  if (categoryId === "cashback") {
    basePct = Math.max(
      ret?.online_shopping_general ?? 0,
      ret?.amazon_flipkart_myntra ?? 0,
      ret?.utilities_bills_telecom ?? 0,
      ret?.offline_general_other ?? 0
    );
  } else if (categoryId === "travel") {
    basePct = Math.max(
      ret?.travel_flights_hotels ?? 0,
      ret?.international_forex_net_of_markup ?? 0
    );
  } else if (categoryId === "dining-groceries") {
    basePct = Math.max(
      ret?.dining_swiggy_zomato ?? 0,
      ret?.groceries_quick_commerce ?? 0
    );
  }

  if (basePct <= 0) return 0;
  const converted = applyConversionStrategy(card, strategy, basePct * 100);
  return Math.round(basePct * converted.multiplier * 10) / 10;
}

/**
 * Computes per-category yield, display badge text, and normalized 0-100 score
 * for a single card and category ID.
 */
export function evaluateCardOnCategory(
  card: CardSummaryItem,
  categoryId: string,
  strategy: RewardConversionStrategy
): CategoryMetricResult {
  const meta = resolveCategoryMeta(categoryId);
  const shortLabel = meta?.shortLabel || categoryId;
  const matched = matchesCategoryToken(card, categoryId);
  const t = card.filter_tags;

  if (!meta) {
    return {
      categoryId,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: matched ? "Eligible" : "—",
      ratePct: null,
      normalizedScore: matched ? 45 : 0,
    };
  }

  if (meta.id === "lounge") {
    const domCount = card.domestic_lounge_accessible_count || 0;
    let displayMetric = "No Lounge";
    let score = 0;
    if (t.no_spend_domestic_lounge) {
      displayMetric = domCount > 0 ? `0-Spend · ${domCount}L` : "No-Spend Lounge";
      score = 72 + Math.min(24, domCount * 0.35);
    } else if (t.has_domestic_lounge) {
      displayMetric = domCount > 0 ? `${domCount} Dom Lounges` : "Spend-Gated";
      score = 46 + Math.min(20, domCount * 0.25);
    } else if (t.has_international_lounge) {
      displayMetric = "Int'l Lounge";
      score = 40;
    }
    return {
      categoryId: meta.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric,
      ratePct: null,
      normalizedScore: matched ? score : 0,
    };
  }

  if (meta.id === "forex") {
    const fx = card.forex_markup_pct;
    const netFx = getEffectiveRateForCategory(
      card,
      "forex",
      "international_forex_net_of_markup",
      strategy
    );
    let score = 0;
    let displayMetric = fx !== undefined ? `${fx}% Forex` : "Standard FX";
    if (t.zero_forex || fx === 0) {
      displayMetric = netFx > 0 ? `0% FX · +${netFx.toFixed(1)}%` : "0% Markup";
      score = 82 + Math.min(18, netFx * 3);
    } else if (t.zero_or_low_forex) {
      displayMetric = fx !== undefined ? `${fx}% Forex` : "Low Forex";
      score = 60 + Math.min(18, Math.max(0, netFx) * 2.5);
    }
    return {
      categoryId: meta.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric,
      ratePct: netFx > 0 ? netFx : null,
      normalizedScore: matched ? score : 0,
    };
  }

  if (meta.id === "golf") {
    const golfText = card.golf_summary?.complimentary_access || "";
    const coursesCount = card.accessible_golf_slugs?.length || 0;
    const score = matched
      ? 68 + Math.min(26, coursesCount * 0.8 + (/unlimited/i.test(golfText) ? 14 : 6))
      : 0;
    return {
      categoryId: meta.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: matched
        ? coursesCount > 0
          ? `${coursesCount} Golf Clubs`
          : "Golf Access"
        : "No Golf",
      ratePct: null,
      normalizedScore: score,
    };
  }

  if (meta.id === "ltf") {
    const baseRate = getEffectiveRateForCategory(
      card,
      "cashback",
      "online_shopping_general",
      strategy
    );
    return {
      categoryId: meta.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: t.is_ltf ? "₹0 LTF" : `₹${card.annual_fee_inr.toLocaleString("en-IN")}/yr`,
      ratePct: t.is_ltf && baseRate > 0 ? baseRate : null,
      normalizedScore: matched ? 64 + Math.min(28, baseRate * 3.5) : 0,
    };
  }

  if (meta.id === "entry-fd") {
    const rate = getEffectiveRateForCategory(
      card,
      meta.id,
      meta.keyReturnKey,
      strategy
    );
    return {
      categoryId: meta.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: t.is_fd_backed
        ? "FD Starter"
        : matched
        ? `${rate.toFixed(1)}%`
        : "Not Starter",
      ratePct: matched && rate > 0 ? rate : null,
      normalizedScore: matched ? 55 + Math.min(25, rate * 4) : 0,
    };
  }

  const effRate = getEffectiveRateForCategory(
    card,
    meta.id,
    meta.keyReturnKey,
    strategy
  );

  // Reward & spend verticals (Fuel, Cashback, Shopping, Travel, Dining, Groceries, Utilities, Insurance, Gold, UPI, Tax)
  const isPartialBase = !matched && effRate >= 1.0;
  const clampedRateScore = Math.min(95, effRate * 6.2);
  let normalizedScore = 0;

  if (matched) {
    normalizedScore = Math.max(42, clampedRateScore + 18);
    if (meta.id === "super-premium") {
      normalizedScore = Math.max(normalizedScore, 55 + card.overall_rating * 5);
    }
    if (meta.id === "rupay-upi" && t.is_rupay_upi) {
      normalizedScore = Math.max(normalizedScore, 50 + effRate * 8);
    }
  } else if (isPartialBase) {
    // Non-matching card with decent passive base rate gets light credit for multi-category tie-breaks
    normalizedScore = Math.min(24, effRate * 4.5);
  }

  const displayMetric =
    effRate > 0
      ? `${effRate.toFixed(1)}%`
      : matched
      ? "Matched"
      : "—";

  return {
    categoryId: meta.id,
    shortLabel,
    matched,
    isPartialBase,
    displayMetric,
    ratePct: effRate > 0 ? effRate : null,
    normalizedScore,
  };
}

/**
 * Ranks all candidate cards across 2+ selected categories and identifies
 * Best Overall Single Card, Runner-Up, Best Lifetime-Free Pick, and Best 2-Card Combo.
 */
export function evaluateMultiCategoryCards(
  cards: CardSummaryItem[],
  selectedCategoryIds: string[],
  options: {
    monthlyIncomeInr?: number | null;
    strategy?: RewardConversionStrategy;
  } = {}
): MultiCategoryRecommendation {
  const { monthlyIncomeInr = null, strategy = "default_inr" } = options;
  const selectedMetas = selectedCategoryIds
    .map((id) => resolveCategoryMeta(id))
    .filter((m): m is CategoryMeta => m !== null);

  if (selectedMetas.length === 0) {
    return {
      selectedMetas: [],
      rankedCards: [],
      bestOverall: null,
      runnerUp: null,
      bestLtfPick: null,
      twoCardCombo: null,
      fullMatchCount: 0,
    };
  }

  const totalSelected = selectedMetas.length;
  const rankedCards: MultiCategoryRankedCard[] = [];

  for (const card of cards) {
    const categoryMetrics = selectedMetas.map((meta) =>
      evaluateCardOnCategory(card, meta.id, strategy)
    );
    const matchedIds = categoryMetrics
      .filter((m) => m.matched)
      .map((m) => m.categoryId);
    const matchedCount = matchedIds.length;

    if (matchedCount === 0) continue;

    const avgNormScore =
      categoryMetrics.reduce((sum, m) => sum + m.normalizedScore, 0) /
      totalSelected;
    const rateMetrics = categoryMetrics.filter((m) => m.ratePct !== null);
    const avgRatePct =
      rateMetrics.length > 0
        ? Math.round(
            (rateMetrics.reduce((s, m) => s + (m.ratePct || 0), 0) /
              rateMetrics.length) *
              10
          ) / 10
        : 0;

    const personalScore = computePersonalizedDirectoryScore(card, {
      monthlyIncomeInr,
      strategy,
    }).score;

    const feeEfficiencyBonus =
      card.annual_fee_inr === 0
        ? 4
        : card.annual_fee_inr <= 1500
        ? 2
        : card.annual_fee_inr >= 10000
        ? -2
        : 0;

    // Coverage ratio dominates first (3/3 beats 2/3), then average category strength + rating + personal fit
    const combinedScore =
      matchedCount * 100 +
      avgNormScore * 0.85 +
      card.overall_rating * 3.5 +
      personalScore * 0.08 +
      feeEfficiencyBonus;

    const summaryLine = categoryMetrics
      .map((m) => `${m.shortLabel} ${m.displayMetric}`)
      .join(" · ");

    rankedCards.push({
      card,
      matchedIds,
      matchedCount,
      totalSelected,
      isFullMatch: matchedCount === totalSelected,
      combinedScore,
      avgRatePct,
      categoryMetrics,
      summaryLine,
    });
  }

  rankedCards.sort(
    (a, b) =>
      b.matchedCount - a.matchedCount ||
      b.combinedScore - a.combinedScore ||
      b.card.overall_rating - a.card.overall_rating
  );

  const fullMatchCount = rankedCards.filter((r) => r.isFullMatch).length;
  const bestOverall = rankedCards[0] || null;
  const runnerUp =
    rankedCards.find(
      (r) =>
        bestOverall &&
        r.card.card_id !== bestOverall.card.card_id
    ) || null;
  const bestLtfPick =
    rankedCards.find(
      (r) =>
        r.card.filter_tags.is_ltf &&
        (!bestOverall || r.card.card_id !== bestOverall.card.card_id)
    ) || null;

  // Build optimal 2-Card Combo from top candidates when useful
  let twoCardCombo: MultiCategoryComboPick | null = null;
  if (totalSelected >= 2 && rankedCards.length >= 2 && bestOverall) {
    const pool = rankedCards.slice(0, 28);
    let bestComboScore = -Infinity;
    let bestCombo: MultiCategoryComboPick | null = null;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i];
        const b = pool[j];
        const coveredSet = new Set<string>([...a.matchedIds, ...b.matchedIds]);
        const coveredCount = coveredSet.size;
        if (coveredCount <= bestOverall.matchedCount && bestOverall.isFullMatch) {
          // Only suggest a combo over a 100%-matching single card if it adds meaningful yield upside
          const comboPeakAvg =
            selectedMetas.reduce(
              (sum, _meta, idx) =>
                sum +
                Math.max(
                  a.categoryMetrics[idx].normalizedScore,
                  b.categoryMetrics[idx].normalizedScore
                ),
              0
            ) / totalSelected;
          const singlePeakAvg =
            bestOverall.categoryMetrics.reduce(
              (sum, m) => sum + m.normalizedScore,
              0
            ) / totalSelected;
          if (comboPeakAvg < singlePeakAvg + 14) continue;
        }

        const assignment = selectedMetas.map((meta, idx) => {
          const mA = a.categoryMetrics[idx];
          const mB = b.categoryMetrics[idx];
          const chooseA = mA.normalizedScore >= mB.normalizedScore;
          const winnerMetric = chooseA ? mA : mB;
          const winnerCard = chooseA ? a.card : b.card;
          return {
            categoryId: meta.id,
            shortLabel: meta.shortLabel,
            owner: (chooseA ? "A" : "B") as "A" | "B",
            cardName: winnerCard.card_name,
            displayMetric: winnerMetric.displayMetric,
          };
        });

        const pairYield =
          selectedMetas.reduce(
            (sum, _meta, idx) =>
              sum +
              Math.max(
                a.categoryMetrics[idx].normalizedScore,
                b.categoryMetrics[idx].normalizedScore
              ),
            0
          ) / totalSelected;
        const feeSum = a.card.annual_fee_inr + b.card.annual_fee_inr;
        const pairScore =
          coveredCount * 120 +
          pairYield +
          (a.card.overall_rating + b.card.overall_rating) * 2 -
          Math.min(12, feeSum / 2500);

        if (pairScore > bestComboScore) {
          bestComboScore = pairScore;
          bestCombo = {
            cardA: a,
            cardB: b,
            coveredIds: [...coveredSet],
            coveredCount,
            totalSelected,
            combinedAnnualFeeInr: feeSum,
            assignment,
          };
        }
      }
    }

    if (
      bestCombo &&
      (bestCombo.coveredCount > bestOverall.matchedCount ||
        !bestOverall.isFullMatch ||
        bestComboScore > 0)
    ) {
      twoCardCombo = bestCombo;
    }
  }

  return {
    selectedMetas,
    rankedCards,
    bestOverall,
    runnerUp,
    bestLtfPick,
    twoCardCombo,
    fullMatchCount,
  };
}
