import { CATEGORY_OPTIONS, type MobileCategoryOption } from './advisor';
import {
  applyConversionStrategy,
  computePersonalizedDirectoryScore,
} from './conversion';
import type {
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from './types';

export interface FinderCategoryOption extends MobileCategoryOption {
  studyId: string;
}

const EXTRA_FINDER_OPTIONS: FinderCategoryOption[] = [
  {
    id: 'dining',
    datasetCategory: 'Dining, Groceries & Movies',
    shortLabel: 'Dining',
    blurb: 'Swiggy, Zomato, EazyDiner & restaurants',
    keyReturnKey: 'dining_swiggy_zomato',
    studyId: 'dining-groceries',
  },
  {
    id: 'groceries',
    datasetCategory: 'Dining, Groceries & Movies',
    shortLabel: 'Groceries',
    blurb: 'Blinkit, Zepto, BigBasket & supermarkets',
    keyReturnKey: 'groceries_quick_commerce',
    studyId: 'dining-groceries',
  },
  {
    id: 'utilities',
    datasetCategory: 'Cashback',
    shortLabel: 'Utilities',
    blurb: 'Electricity, broadband, mobile & BBPS bills',
    keyReturnKey: 'utilities_bills_telecom',
    studyId: 'cashback',
  },
  {
    id: 'insurance',
    datasetCategory: 'Cashback',
    shortLabel: 'Insurance',
    blurb: 'LIC, health & motor insurance renewals',
    keyReturnKey: 'insurance',
    studyId: 'cashback',
  },
  {
    id: 'gold-jewellery',
    datasetCategory: 'Super-Premium',
    shortLabel: 'Gold & Jewellery',
    blurb: 'Tanishq, Titan & bullion reward cards',
    keyReturnKey: 'offline_general_other',
    studyId: 'super-premium',
  },
];

export const FINDER_CATEGORY_OPTIONS: FinderCategoryOption[] = (() => {
  const base: FinderCategoryOption[] = CATEGORY_OPTIONS.map((o) => ({
    ...o,
    studyId: o.id,
  }));
  const travelIdx = base.findIndex((o) => o.id === 'travel');
  if (travelIdx >= 0) {
    base.splice(travelIdx + 1, 0, ...EXTRA_FINDER_OPTIONS);
    return base;
  }
  return [...base, ...EXTRA_FINDER_OPTIONS];
})();

/**
 * Resolves a URL or state category token (id or datasetCategory) to a canonical FinderCategoryOption.
 */
export function resolveFinderCategoryOption(
  token: string
): FinderCategoryOption | null {
  if (!token || token === 'all') return null;
  const lower = token.trim().toLowerCase();
  const byId = FINDER_CATEGORY_OPTIONS.find((o) => o.id.toLowerCase() === lower);
  if (byId) return byId;

  return (
    FINDER_CATEGORY_OPTIONS.find(
      (o) =>
        o.datasetCategory.toLowerCase() === lower &&
        ['cashback', 'dining-groceries', 'super-premium'].includes(o.id)
    ) ||
    FINDER_CATEGORY_OPTIONS.find(
      (o) => o.datasetCategory.toLowerCase() === lower
    ) ||
    null
  );
}

/**
 * Parses a comma-separated list of category tokens into unique canonical IDs.
 */
export function parseMobileCategoryList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const resolved = resolveFinderCategoryOption(part);
    const id = resolved ? resolved.id : part.trim();
    if (id && id !== 'all' && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Evaluates whether a card matches a canonical finder category ID or datasetCategory.
 */
export function matchesFinderCategory(
  card: CardSummaryItem,
  categoryToken: string
): boolean {
  if (!categoryToken || categoryToken === 'all') return true;
  const opt = resolveFinderCategoryOption(categoryToken);
  if (opt) {
    const ret = card.effective_return_pct_by_category;
    const t = card.filter_tags;
    const tagsHay = `${card.card_name} ${card.primary_category} ${(t.best_for_tags || []).join(' ')} ${(t.requirement_keywords || []).join(' ')}`;

    switch (opt.id) {
      case 'utilities':
        return (
          (ret?.utilities_bills_telecom ?? 0) >= 2.0 ||
          (card.categories.includes('Cashback') &&
            /utilit|bill|airtel|recharge|bbps|electric/i.test(tagsHay))
        );
      case 'insurance':
        return (
          (ret?.insurance ?? 0) >= 2.0 || /insurance|lic|policy/i.test(tagsHay)
        );
      case 'dining':
        return (
          (ret?.dining_swiggy_zomato ?? 0) >= 2.5 ||
          /dining|swiggy|zomato|eazydiner|restaurant/i.test(tagsHay)
        );
      case 'groceries':
        return (
          (ret?.groceries_quick_commerce ?? 0) >= 2.5 ||
          /grocer|blinkit|zepto|bigbasket|instamart|dmart|supermarket/i.test(
            tagsHay
          )
        );
      case 'gold-jewellery':
        return (
          /gold|jewel|tanishq|titan|caratlane|malabar|jewellery/i.test(
            tagsHay
          ) ||
          (card.categories.includes('Super-Premium') &&
            (ret?.offline_general_other ?? 0) >= 2.0)
        );
      case 'golf':
        return Boolean(t.has_golf) || card.categories.includes('Golf');
      case 'rupay-upi':
        return Boolean(t.is_rupay_upi) || card.categories.includes('RuPay & UPI');
      case 'ltf':
        return Boolean(t.is_ltf) || card.categories.includes('Lifetime Free');
      case 'entry-fd':
        return (
          Boolean(t.is_fd_backed) ||
          card.categories.includes('Entry-Level & Secured (FD)')
        );
      case 'lounge':
        return (
          Boolean(t.has_domestic_lounge || t.has_international_lounge) ||
          card.categories.includes('Airport Lounge')
        );
      case 'forex':
        return (
          Boolean(t.zero_or_low_forex) ||
          card.categories.includes('Zero/Low Forex')
        );
      default:
        return (
          card.categories.includes(opt.datasetCategory) ||
          card.primary_category === opt.datasetCategory
        );
    }
  }

  return (
    card.categories.includes(categoryToken) ||
    card.primary_category === categoryToken
  );
}

export interface MobileCategoryMetricResult {
  categoryId: string;
  shortLabel: string;
  matched: boolean;
  isPartialBase: boolean;
  displayMetric: string;
  ratePct: number | null;
  normalizedScore: number;
}

export interface MobileMultiCategoryRankedCard {
  card: CardSummaryItem;
  matchedIds: string[];
  matchedCount: number;
  totalSelected: number;
  isFullMatch: boolean;
  combinedScore: number;
  avgRatePct: number;
  categoryMetrics: MobileCategoryMetricResult[];
  summaryLine: string;
}

export interface MobileMultiCategoryComboPick {
  cardA: MobileMultiCategoryRankedCard;
  cardB: MobileMultiCategoryRankedCard;
  coveredCount: number;
  totalSelected: number;
  combinedAnnualFeeInr: number;
  assignment: Array<{
    categoryId: string;
    shortLabel: string;
    cardName: string;
    displayMetric: string;
  }>;
}

export interface MobileMultiCategoryRecommendation {
  selectedOptions: FinderCategoryOption[];
  rankedCards: MobileMultiCategoryRankedCard[];
  bestOverall: MobileMultiCategoryRankedCard | null;
  runnerUp: MobileMultiCategoryRankedCard | null;
  bestLtfPick: MobileMultiCategoryRankedCard | null;
  twoCardCombo: MobileMultiCategoryComboPick | null;
  fullMatchCount: number;
}

function getEffectiveRateForCategory(
  card: CardSummaryItem,
  categoryId: string,
  fallbackKey: SpendCategoryKey,
  strategy: RewardConversionStrategy
): number {
  const ret = card.effective_return_pct_by_category;
  let basePct = ret?.[fallbackKey] ?? 0;

  if (categoryId === 'cashback') {
    basePct = Math.max(
      ret?.online_shopping_general ?? 0,
      ret?.amazon_flipkart_myntra ?? 0,
      ret?.utilities_bills_telecom ?? 0,
      ret?.offline_general_other ?? 0
    );
  } else if (categoryId === 'travel') {
    basePct = Math.max(
      ret?.travel_flights_hotels ?? 0,
      ret?.international_forex_net_of_markup ?? 0
    );
  } else if (categoryId === 'dining-groceries') {
    basePct = Math.max(
      ret?.dining_swiggy_zomato ?? 0,
      ret?.groceries_quick_commerce ?? 0
    );
  }

  if (basePct <= 0) return 0;
  const converted = applyConversionStrategy(card, strategy, basePct * 100);
  return Math.round(basePct * converted.multiplier * 10) / 10;
}

function evaluateCardOnCategory(
  card: CardSummaryItem,
  categoryId: string,
  strategy: RewardConversionStrategy
): MobileCategoryMetricResult {
  const opt = resolveFinderCategoryOption(categoryId);
  const shortLabel = opt?.shortLabel || categoryId;
  const matched = matchesFinderCategory(card, categoryId);
  const t = card.filter_tags;

  if (!opt) {
    return {
      categoryId,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: matched ? 'Eligible' : '—',
      ratePct: null,
      normalizedScore: matched ? 45 : 0,
    };
  }

  if (opt.id === 'lounge') {
    const domCount = card.domestic_lounge_accessible_count || 0;
    let displayMetric = 'No Lounge';
    let score = 0;
    if (t.no_spend_domestic_lounge) {
      displayMetric = domCount > 0 ? `0-Spend · ${domCount}L` : 'No-Spend';
      score = 72 + Math.min(24, domCount * 0.35);
    } else if (t.has_domestic_lounge) {
      displayMetric = domCount > 0 ? `${domCount} Dom` : 'Spend-Gated';
      score = 46 + Math.min(20, domCount * 0.25);
    } else if (t.has_international_lounge) {
      displayMetric = "Int'l";
      score = 40;
    }
    return {
      categoryId: opt.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric,
      ratePct: null,
      normalizedScore: matched ? score : 0,
    };
  }

  if (opt.id === 'forex') {
    const fx = card.forex_markup_pct;
    const netFx = getEffectiveRateForCategory(
      card,
      'forex',
      'international_forex_net_of_markup',
      strategy
    );
    let score = 0;
    let displayMetric = fx !== undefined ? `${fx}% FX` : 'Standard';
    if (t.zero_forex || fx === 0) {
      displayMetric = netFx > 0 ? `0% · +${netFx.toFixed(1)}%` : '0% Markup';
      score = 82 + Math.min(18, netFx * 3);
    } else if (t.zero_or_low_forex) {
      displayMetric = fx !== undefined ? `${fx}% FX` : 'Low FX';
      score = 60 + Math.min(18, Math.max(0, netFx) * 2.5);
    }
    return {
      categoryId: opt.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric,
      ratePct: netFx > 0 ? netFx : null,
      normalizedScore: matched ? score : 0,
    };
  }

  if (opt.id === 'golf') {
    const coursesCount = card.accessible_golf_slugs?.length || 0;
    const golfText = card.golf_summary?.complimentary_access || '';
    return {
      categoryId: opt.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: matched
        ? coursesCount > 0
          ? `${coursesCount} Clubs`
          : 'Golf'
        : 'No Golf',
      ratePct: null,
      normalizedScore: matched
        ? 68 + Math.min(26, coursesCount * 0.8 + (/unlimited/i.test(golfText) ? 14 : 6))
        : 0,
    };
  }

  if (opt.id === 'ltf') {
    const baseRate = getEffectiveRateForCategory(
      card,
      'cashback',
      'online_shopping_general',
      strategy
    );
    return {
      categoryId: opt.id,
      shortLabel,
      matched,
      isPartialBase: false,
      displayMetric: t.is_ltf ? '₹0 LTF' : `₹${card.annual_fee_inr}/yr`,
      ratePct: t.is_ltf && baseRate > 0 ? baseRate : null,
      normalizedScore: matched ? 64 + Math.min(28, baseRate * 3.5) : 0,
    };
  }

  const effRate = getEffectiveRateForCategory(
    card,
    opt.id,
    opt.keyReturnKey,
    strategy
  );
  const isPartialBase = !matched && effRate >= 1.0;
  let normalizedScore = 0;

  if (matched) {
    normalizedScore = Math.max(42, Math.min(95, effRate * 6.2) + 18);
    if (opt.id === 'super-premium') {
      normalizedScore = Math.max(normalizedScore, 55 + card.overall_rating * 5);
    }
    if (opt.id === 'rupay-upi' && t.is_rupay_upi) {
      normalizedScore = Math.max(normalizedScore, 50 + effRate * 8);
    }
  } else if (isPartialBase) {
    normalizedScore = Math.min(24, effRate * 4.5);
  }

  return {
    categoryId: opt.id,
    shortLabel,
    matched,
    isPartialBase,
    displayMetric: effRate > 0 ? `${effRate.toFixed(1)}%` : matched ? 'Match' : '—',
    ratePct: effRate > 0 ? effRate : null,
    normalizedScore,
  };
}

/**
 * Ranks cards across 2+ selected categories and identifies the single best card,
 * LTF/runner-up pick, and optimal 2-card combo for mobile Finder.
 */
export function evaluateMobileMultiCategoryCards(
  cards: CardSummaryItem[],
  selectedCategoryIds: string[],
  options: {
    monthlyIncomeInr?: number | null;
    strategy?: RewardConversionStrategy;
  } = {}
): MobileMultiCategoryRecommendation {
  const { monthlyIncomeInr = null, strategy = 'default_inr' } = options;
  const selectedOptions = selectedCategoryIds
    .map((id) => resolveFinderCategoryOption(id))
    .filter((o): o is FinderCategoryOption => o !== null);

  if (selectedOptions.length === 0) {
    return {
      selectedOptions: [],
      rankedCards: [],
      bestOverall: null,
      runnerUp: null,
      bestLtfPick: null,
      twoCardCombo: null,
      fullMatchCount: 0,
    };
  }

  const totalSelected = selectedOptions.length;
  const rankedCards: MobileMultiCategoryRankedCard[] = [];

  for (const card of cards) {
    const categoryMetrics = selectedOptions.map((opt) =>
      evaluateCardOnCategory(card, opt.id, strategy)
    );
    const matchedIds = categoryMetrics
      .filter((m) => m.matched)
      .map((m) => m.categoryId);
    const matchedCount = matchedIds.length;
    if (matchedCount === 0) continue;

    const avgNormScore =
      categoryMetrics.reduce((s, m) => s + m.normalizedScore, 0) / totalSelected;
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

    const feeBonus =
      card.annual_fee_inr === 0
        ? 4
        : card.annual_fee_inr <= 1500
          ? 2
          : card.annual_fee_inr >= 10000
            ? -2
            : 0;

    const combinedScore =
      matchedCount * 100 +
      avgNormScore * 0.85 +
      card.overall_rating * 3.5 +
      personalScore * 0.08 +
      feeBonus;

    rankedCards.push({
      card,
      matchedIds,
      matchedCount,
      totalSelected,
      isFullMatch: matchedCount === totalSelected,
      combinedScore,
      avgRatePct,
      categoryMetrics,
      summaryLine: categoryMetrics
        .map((m) => `${m.shortLabel} ${m.displayMetric}`)
        .join(' · '),
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
      (r) => bestOverall && r.card.card_id !== bestOverall.card.card_id
    ) || null;
  const bestLtfPick =
    rankedCards.find(
      (r) =>
        r.card.filter_tags.is_ltf &&
        (!bestOverall || r.card.card_id !== bestOverall.card.card_id)
    ) || null;

  let twoCardCombo: MobileMultiCategoryComboPick | null = null;
  if (totalSelected >= 2 && rankedCards.length >= 2 && bestOverall) {
    const pool = rankedCards.slice(0, 26);
    let bestComboScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i];
        const b = pool[j];
        const coveredSet = new Set<string>([...a.matchedIds, ...b.matchedIds]);
        const coveredCount = coveredSet.size;
        const pairYield =
          selectedOptions.reduce(
            (sum, _opt, idx) =>
              sum +
              Math.max(
                a.categoryMetrics[idx].normalizedScore,
                b.categoryMetrics[idx].normalizedScore
              ),
            0
          ) / totalSelected;

        if (coveredCount <= bestOverall.matchedCount && bestOverall.isFullMatch) {
          const singleYield =
            bestOverall.categoryMetrics.reduce(
              (sum, m) => sum + m.normalizedScore,
              0
            ) / totalSelected;
          if (pairYield < singleYield + 14) continue;
        }

        const feeSum = a.card.annual_fee_inr + b.card.annual_fee_inr;
        const pairScore =
          coveredCount * 120 +
          pairYield +
          (a.card.overall_rating + b.card.overall_rating) * 2 -
          Math.min(12, feeSum / 2500);

        if (pairScore > bestComboScore) {
          bestComboScore = pairScore;
          twoCardCombo = {
            cardA: a,
            cardB: b,
            coveredCount,
            totalSelected,
            combinedAnnualFeeInr: feeSum,
            assignment: selectedOptions.map((opt, idx) => {
              const mA = a.categoryMetrics[idx];
              const mB = b.categoryMetrics[idx];
              const chooseA = mA.normalizedScore >= mB.normalizedScore;
              return {
                categoryId: opt.id,
                shortLabel: opt.shortLabel,
                cardName: (chooseA ? a.card : b.card).card_name,
                displayMetric: (chooseA ? mA : mB).displayMetric,
              };
            }),
          };
        }
      }
    }
  }

  return {
    selectedOptions,
    rankedCards,
    bestOverall,
    runnerUp,
    bestLtfPick,
    twoCardCombo,
    fullMatchCount,
  };
}
