import type { CardDossier, SpendCategoryKey } from "./types";
import { SPEND_CATEGORY_META } from "./format";
import type {
  BumpSeriesInput,
  LineRaceSeriesInput,
  SpendCurvePoint,
  StackedAreaSeriesInput,
} from "@/components/AnalyticsCharts";

const STUDY_SPEND_STEPS = [5000, 10000, 20000, 35000, 50000, 75000, 100000, 150000, 200000];

const CATEGORY_STUDY_WEIGHTS: Array<{ key: SpendCategoryKey; weight: number }> = [
  { key: "online_shopping_general", weight: 0.22 },
  { key: "amazon_flipkart_myntra", weight: 0.16 },
  { key: "dining_swiggy_zomato", weight: 0.14 },
  { key: "groceries_quick_commerce", weight: 0.14 },
  { key: "travel_flights_hotels", weight: 0.14 },
  { key: "utilities_bills_telecom", weight: 0.08 },
  { key: "upi_scan_and_pay", weight: 0.06 },
  { key: "offline_general_other", weight: 0.06 },
];

function formatCompactSpend(inr: number): string {
  if (inr >= 100000) return `₹${(inr / 100000).toFixed(inr % 100000 === 0 ? 0 : 1)}L`;
  return `₹${Math.round(inr / 1000)}k`;
}

export function buildCardSpendStudyData(dossier: CardDossier): {
  curvePoints: SpendCurvePoint[];
  xLabels: string[];
  stackedSeries: StackedAreaSeriesInput[];
  annualFeeInr: number;
  waiverMonthlyInr: number | null;
} {
  const calc = dossier.reward_calculator_model;
  const fees = dossier.fees_and_charges_detailed;
  const feeCalc = calc.fee_waiver_and_milestone_calculator;
  const annualFeeInr = fees?.annual_fee_inr ?? feeCalc?.annual_fee_inr ?? 0;
  const waiverAnnual =
    fees?.fee_waiver_spend_inr ??
    feeCalc?.fee_waiver_spend_inr ??
    null;
  const waiverMonthlyInr =
    feeCalc?.monthly_spend_for_waiver_inr ??
    (waiverAnnual && waiverAnnual > 0 ? Math.round(waiverAnnual / 12) : null);

  const capValues = Object.values(calc.monthly_category_caps_inr || {}).filter(
    (v): v is number => typeof v === "number" && v > 0
  );
  const capInr = capValues.length > 0 ? Math.max(...capValues) : null;
  const basePct = Math.max(0.25, calc.base_reward_rate_pct || 1);
  const rates = calc.effective_return_pct_by_category || {};

  const weightedPct = CATEGORY_STUDY_WEIGHTS.reduce((sum, item) => {
    const r = typeof rates[item.key] === "number" ? rates[item.key] : basePct;
    return sum + Math.max(0, r) * item.weight;
  }, 0);

  const curvePoints: SpendCurvePoint[] = [];
  const accelArr: number[] = [];
  const baseArr: number[] = [];

  for (const monthlySpend of STUDY_SPEND_STEPS) {
    const annualSpend = monthlySpend * 12;
    const rawMonthlyReward = (monthlySpend * weightedPct) / 100;
    const cappedMonthlyAccel =
      capInr && capInr > 0 ? Math.min(rawMonthlyReward, capInr) : rawMonthlyReward;
    const overflowMonthlySpend =
      capInr && capInr > 0 && rawMonthlyReward > capInr && weightedPct > 0
        ? Math.max(0, monthlySpend - (capInr / weightedPct) * 100)
        : 0;
    const overflowMonthlyBase = (overflowMonthlySpend * Math.min(basePct, 1.5)) / 100;

    const annualAccel = Math.round(cappedMonthlyAccel * 12);
    const annualBase = Math.round(overflowMonthlyBase * 12);
    const grossAnnual = annualAccel + annualBase;
    const effectiveFee =
      waiverAnnual && annualSpend >= waiverAnnual ? 0 : annualFeeInr;
    const netAnnualBenefitInr = grossAnnual - effectiveFee;
    const effectiveYieldPct =
      annualSpend > 0 ? (netAnnualBenefitInr / annualSpend) * 100 : 0;

    const conservativeBenefitInr = Math.round(grossAnnual * 0.72 - effectiveFee);

    curvePoints.push({
      spendLabel: formatCompactSpend(monthlySpend),
      monthlySpendInr: monthlySpend,
      netAnnualBenefitInr,
      effectiveYieldPct,
      conservativeBenefitInr,
    });
    accelArr.push(annualAccel);
    baseArr.push(annualBase);
  }

  return {
    curvePoints,
    xLabels: curvePoints.map((p) => p.spendLabel),
    stackedSeries: [
      {
        id: "accelerated",
        name: "Accelerated Reward Value (₹/yr)",
        color: "#0F5C4D",
        values: accelArr,
      },
      {
        id: "overflow",
        name: "Post-Cap Base Spillover (₹/yr)",
        color: "#1D4ED8",
        values: baseArr,
      },
    ],
    annualFeeInr,
    waiverMonthlyInr,
  };
}

export function buildCalculatorCategoryStackedData(
  breakdown: Array<{
    key: SpendCategoryKey;
    label: string;
    annualValue: number;
  }>,
  annualFeeInr: number
): {
  xLabels: string[];
  series: StackedAreaSeriesInput[];
  feeLine: number;
} {
  const sorted = [...breakdown]
    .filter((b) => b.annualValue > 0)
    .sort((a, b) => b.annualValue - a.annualValue);

  const topCats = sorted.slice(0, 4);
  const restTotal = sorted.slice(4).reduce((s, b) => s + b.annualValue, 0);
  if (restTotal > 0) {
    topCats.push({
      key: "offline_general_other",
      label: "Other Spends",
      annualValue: restTotal,
    });
  }

  const multipliers = [0.25, 0.5, 0.75, 1.0, 1.35, 1.75, 2.2];
  const xLabels = multipliers.map((m) =>
    m === 1 ? "1.0x (Your Spend)" : `${m}x Spend`
  );

  const colors = ["#0F5C4D", "#1D4ED8", "#B45309", "#7C3AED", "#64748B"];
  const series: StackedAreaSeriesInput[] = topCats.map((cat, idx) => ({
    id: cat.key,
    name: cat.label,
    color: colors[idx % colors.length],
    values: multipliers.map((m) => Math.round(cat.annualValue * m)),
  }));

  return { xLabels, series, feeLine: annualFeeInr };
}

export function build12MonthLineRace(
  items: Array<{
    id: string;
    name: string;
    annualGrossInr: number;
    effectiveFeeInr: number;
  }>
): { xLabels: string[]; series: LineRaceSeriesInput[] } {
  const xLabels = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);
  const colors = ["#0F5C4D", "#1D4ED8", "#B45309", "#7C3AED", "#0369A1"];
  const series: LineRaceSeriesInput[] = items.slice(0, 5).map((item, idx) => ({
    id: item.id,
    name: item.name,
    color: colors[idx % colors.length],
    values: xLabels.map((_, mIdx) =>
      Math.round((item.annualGrossInr / 12) * (mIdx + 1) - item.effectiveFeeInr)
    ),
  }));
  return { xLabels, series };
}

export const BUMP_CATEGORY_KEYS: SpendCategoryKey[] = [
  "online_shopping_general",
  "amazon_flipkart_myntra",
  "dining_swiggy_zomato",
  "groceries_quick_commerce",
  "travel_flights_hotels",
  "utilities_bills_telecom",
  "upi_scan_and_pay",
];

export function buildBumpCategoryRanking(
  cards: Array<{
    id: string;
    name: string;
    rates: Record<string, number | undefined>;
  }>,
  keys: SpendCategoryKey[] = BUMP_CATEGORY_KEYS
): { xLabels: string[]; series: BumpSeriesInput[] } {
  const top = cards.slice(0, 6);
  const xLabels = keys.map((k) => SPEND_CATEGORY_META[k]?.shortLabel || k);

  // Per category determine dense ranking (highest pct = #1)
  const rankMap: Record<string, number[]> = {};
  const rawMap: Record<string, string[]> = {};
  for (const c of top) {
    rankMap[c.id] = [];
    rawMap[c.id] = [];
  }

  for (const k of keys) {
    const scored = top.map((c) => ({
      id: c.id,
      pct: typeof c.rates[k] === "number" ? Number(c.rates[k]) : 0,
    }));
    const sorted = [...scored].sort((a, b) => b.pct - a.pct);
    for (const c of top) {
      const val = scored.find((s) => s.id === c.id)?.pct ?? 0;
      const r = sorted.findIndex((s) => s.pct === val) + 1;
      rankMap[c.id].push(r > 0 ? r : top.length);
      rawMap[c.id].push(`${val.toFixed(1)}%`);
    }
  }

  const colors = ["#0F5C4D", "#1D4ED8", "#B45309", "#7C3AED", "#0369A1", "#C2410C"];
  const series: BumpSeriesInput[] = top.map((c, idx) => ({
    id: c.id,
    name: c.name.replace(/Credit Card/gi, "").trim(),
    color: colors[idx % colors.length],
    ranks: rankMap[c.id],
    rawValues: rawMap[c.id],
  }));

  return { xLabels, series };
}
