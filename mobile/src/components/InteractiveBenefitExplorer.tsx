import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Gift,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react-native';
import type {
  CardSummaryItem,
  MobileCardDossier,
  RewardConversionStrategy,
  SpendCategoryKey,
} from '../lib/types';
import { cappedMonthlyCategoryReward } from '../lib/advisor';
import { applyConversionStrategy, CONVERSION_STRATEGIES } from '../lib/conversion';
import { formatInr, SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META } from '../lib/format';
import { LedgerTheme } from '../lib/theme';
import { CanvaFeatureIcon, type CanvaIconKey } from './FeatureIcon';
import { AnimatedProgressBar, ScalePressable } from './MotionPrimitives';

interface InteractiveBenefitExplorerProps {
  dossier: MobileCardDossier;
}

function mapCategoryToCanvaIcon(catKey: SpendCategoryKey): CanvaIconKey {
  switch (catKey) {
    case 'amazon_flipkart_myntra':
    case 'online_shopping_general':
      return 'shopping';
    case 'dining_swiggy_zomato':
      return 'dining';
    case 'groceries_quick_commerce':
      return 'grocery';
    case 'travel_flights_hotels':
      return 'travel';
    case 'upi_scan_and_pay':
      return 'upi';
    case 'fuel':
      return 'fuel';
    case 'insurance':
      return 'insurance';
    case 'international_forex_net_of_markup':
      return 'forex';
    case 'utilities_bills_telecom':
      return 'rewards';
    default:
      return 'cashback';
  }
}

export function InteractiveBenefitExplorer({ dossier }: InteractiveBenefitExplorerProps) {
  const {
    identity,
    reward_calculator_model: calc,
    fees_and_charges_detailed: fees,
    lounge_access_detailed: lounge,
    benefits_features_and_faqs: benefits,
    filter_tags: tags,
    ratings,
  } = dossier;

  const cardSummary: CardSummaryItem = useMemo(
    () => ({
      card_id: identity.card_id,
      card_name: identity.card_name,
      bank: identity.bank,
      bank_slug: identity.bank_slug,
      card_slug: identity.card_slug,
      primary_category: identity.primary_category,
      categories: identity.categories || [],
      card_network: identity.card_network,
      card_tier: identity.card_tier,
      status: identity.status,
      joining_fee_inr: fees.joining_fee_inr,
      joining_fee_waiver: fees.joining_fee_waiver,
      annual_fee_inr: fees.annual_fee_inr,
      fee_waiver_spend_inr: fees.fee_waiver_spend_inr,
      forex_markup_pct: fees.forex_markup_pct,
      overall_rating: ratings.overall_market_rating,
      local_image_path: dossier.visual_assets.local_image_path,
      image_url: dossier.visual_assets.image_url,
      card_theme: dossier.visual_assets.card_theme,
      filter_tags: tags,
      effective_return_pct_by_category: calc.effective_return_pct_by_category,
      monthly_category_caps_inr: calc.monthly_category_caps_inr,
      category_caveats: calc.category_caveats,
      domestic_lounge_summary: lounge.domestic?.summary ?? null,
      international_lounge_summary: lounge.international?.summary ?? null,
      lounge_spend_condition: lounge.domestic?.spend_criteria ?? null,
      domestic_lounge_accessible_count: lounge.domestic_lounge_accessible_count,
      international_lounge_accessible_count: lounge.international_lounge_accessible_count,
      accessible_lounge_codes: lounge.accessible_lounge_codes,
      accessible_golf_slugs: lounge.accessible_golf_slugs,
    }),
    [identity, fees, ratings, dossier.visual_assets, tags, calc, lounge]
  );

  const [strategy, setStrategy] = useState<RewardConversionStrategy>('default_inr');

  const strategyMult = useMemo(() => {
    const sample = applyConversionStrategy(cardSummary, strategy, 10000);
    return sample.supportsStrategy ? sample.multiplier : 1;
  }, [cardSummary, strategy]);

  const rankedZones = useMemo(() => {
    return SPEND_CATEGORY_KEYS.map((key) => {
      const headline = calc.effective_return_pct_by_category?.[key] ?? 0;
      const monthlyCap = calc.monthly_category_caps_inr?.[key] ?? null;
      const adjRate = headline * strategyMult;
      const caveat = calc.category_caveats?.[key] || null;
      return {
        key,
        meta: SPEND_CATEGORY_META[key],
        headline,
        adjRate,
        monthlyCap: typeof monthlyCap === 'number' && monthlyCap > 0 ? monthlyCap : null,
        caveat,
      };
    })
      .filter((z) => z.headline > 0)
      .sort((a, b) => b.adjRate - a.adjRate)
      .slice(0, 6);
  }, [calc.effective_return_pct_by_category, calc.monthly_category_caps_inr, calc.category_caveats, strategyMult]);

  const [selectedKey, setSelectedKey] = useState<SpendCategoryKey>(
    () => rankedZones[0]?.key ?? 'online_shopping_general'
  );

  const activeZone = useMemo(
    () => rankedZones.find((z) => z.key === selectedKey) ?? rankedZones[0] ?? null,
    [rankedZones, selectedKey]
  );

  const sweetSpotSpend = useMemo(() => {
    if (!activeZone || !activeZone.monthlyCap || activeZone.headline <= 0) return 10000;
    return Math.max(1000, Math.round((activeZone.monthlyCap / activeZone.headline) * 100));
  }, [activeZone]);

  const [monthlySpend, setMonthlySpend] = useState<number>(8000);

  const sliderMax = useMemo(() => {
    const baseMax = Math.max(30000, Math.round(sweetSpotSpend * 2.2));
    return Math.min(200000, Math.ceil(baseMax / 5000) * 5000);
  }, [sweetSpotSpend]);

  const clampedSpend = Math.min(sliderMax, Math.max(1000, monthlySpend));

  const zoneEval = useMemo(() => {
    if (!activeZone) return null;
    const raw = cappedMonthlyCategoryReward(cardSummary, activeZone.key, clampedSpend);
    const convMonthly = applyConversionStrategy(cardSummary, strategy, raw.monthlyReward * 12);
    const adjustedMonthlyReward = convMonthly.effectiveAnnualRewardsInr / 12;
    const adjustedAnnualReward = convMonthly.effectiveAnnualRewardsInr;
    const adjustedEffectivePct =
      clampedSpend > 0 ? (adjustedMonthlyReward / clampedSpend) * 100 : raw.effectivePct * strategyMult;
    const capUsedPct = raw.monthlyCapInr
      ? Math.min(100, Math.round((Math.min(raw.monthlyReward, raw.monthlyCapInr) / raw.monthlyCapInr) * 100))
      : 0;
    const spendProgressPct = raw.eligibleSpendBeforeCapInr
      ? Math.min(100, Math.round((clampedSpend / raw.eligibleSpendBeforeCapInr) * 100))
      : 100;
    const isNearCap = Boolean(raw.monthlyCapInr && !raw.capped && spendProgressPct >= 75);
    const headroomInr = raw.monthlyCapInr
      ? Math.max(0, Math.round(raw.monthlyCapInr - Math.min(raw.monthlyReward, raw.monthlyCapInr)))
      : null;
    const overflowSpendInr =
      raw.capped && raw.eligibleSpendBeforeCapInr
        ? Math.max(0, clampedSpend - raw.eligibleSpendBeforeCapInr)
        : 0;

    return {
      ...raw,
      adjustedMonthlyReward,
      adjustedAnnualReward,
      adjustedEffectivePct,
      capUsedPct,
      spendProgressPct,
      isNearCap,
      headroomInr,
      overflowSpendInr,
    };
  }, [activeZone, cardSummary, clampedSpend, strategy, strategyMult]);

  const welcomeSummaryText = useMemo(() => {
    const wb = benefits.welcome_benefit;
    if (Array.isArray(wb) && wb.length > 0) return wb[0];
    if (typeof wb === 'string' && wb.trim().length > 0) return wb;
    if (fees.joining_fee_inr === 0) return 'Zero joining fee — starts earning from your first swipe.';
    return 'Welcome benefit activates on joining fee payment / first spend.';
  }, [benefits.welcome_benefit, fees.joining_fee_inr]);

  const waiverGateText = useMemo(() => {
    const waiver = fees.fee_waiver_spend_inr;
    const loungeText = lounge.no_spend_domestic_lounge
      ? 'Zero spend gate for domestic lounges'
      : lounge.domestic?.spend_criteria ||
        (lounge.has_domestic_lounge ? 'Standard lounge access' : 'No complimentary airport lounge');
    if (fees.annual_fee_inr === 0) return `Lifetime Free (₹0/yr) · ${loungeText}`;
    if (waiver && waiver > 0) {
      return `Spend ${formatInr(waiver)}/yr to waive ${formatInr(fees.annual_fee_inr)} fee · ${loungeText}`;
    }
    return `Annual fee ${formatInr(fees.annual_fee_inr)} · ${loungeText}`;
  }, [fees.annual_fee_inr, fees.fee_waiver_spend_inr, lounge]);

  if (rankedZones.length === 0 || !activeZone || !zoneEval) return null;

  const gaugeColor = zoneEval.capped
    ? '#B45309'
    : zoneEval.isNearCap
      ? '#D97706'
      : LedgerTheme.colors.accent;

  const gaugePct = zoneEval.monthlyCapInr
    ? zoneEval.capped
      ? 100
      : Math.max(6, zoneEval.spendProgressPct)
    : Math.max(15, Math.min(100, Math.round((clampedSpend / sliderMax) * 100)));

  return (
    <View style={styles.panel}>
      <View style={styles.badgeRow}>
        <View style={styles.eyebrowPill}>
          <Sparkles size={13} color={LedgerTheme.colors.accent} />
          <Text style={styles.eyebrowText}>Interactive Benefit Explorer</Text>
        </View>
      </View>

      <Text style={styles.title}>
        Tap any spend zone to visualize rewards &amp; monthly caps
      </Text>

      {/* Conversion Strategy Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strategyRow}
      >
        {CONVERSION_STRATEGIES.map((st) => {
          const active = strategy === st.id;
          return (
            <ScalePressable
              key={st.id}
              onPress={() => setStrategy(st.id)}
              style={[styles.strategyChip, active && styles.strategyChipActive]}
            >
              <Text style={[styles.strategyChipTxt, active && styles.strategyChipTxtActive]}>
                {st.shortLabel}
              </Text>
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* Interactive Spend-Zone Tiles */}
      <View style={styles.zoneGrid}>
        {rankedZones.map((zone) => {
          const isSelected = zone.key === activeZone.key;
          return (
            <ScalePressable
              key={zone.key}
              onPress={() => {
                setSelectedKey(zone.key);
                if (zone.monthlyCap && zone.headline > 0) {
                  const zoneSweet = Math.max(1000, Math.round((zone.monthlyCap / zone.headline) * 100));
                  setMonthlySpend(
                    Math.min(60000, Math.round((zoneSweet * 0.8) / 500) * 500 || 5000)
                  );
                }
              }}
              style={[styles.zoneTile, isSelected && styles.zoneTileActive]}
            >
              <View style={styles.zoneTileTop}>
                <CanvaFeatureIcon icon={mapCategoryToCanvaIcon(zone.key)} size={16} />
                <Text style={[styles.zoneRate, isSelected && { color: LedgerTheme.colors.accent }]}>
                  {zone.adjRate.toFixed(1)}%
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.zoneLabel}>
                {zone.meta.shortLabel}
              </Text>
              <Text numberOfLines={1} style={styles.zoneCapSub}>
                {zone.monthlyCap ? `${formatInr(zone.monthlyCap)}/mo cap` : 'Uncapped'}
              </Text>
            </ScalePressable>
          );
        })}
      </View>

      {/* Active Spend Zone Live Cap Gauge Card */}
      <View style={styles.labCard}>
        <Text style={styles.labTitle}>{activeZone.meta.label}</Text>
        <Text style={styles.labHint}>
          {zoneEval.eligibleSpendBeforeCapInr
            ? `Sweet-spot max before monthly cap: ${formatInr(zoneEval.eligibleSpendBeforeCapInr)}/mo`
            : 'No fixed monthly reward cap on this spend zone'}
        </Text>

        {/* Spend Stepper + Quick Jump Chips */}
        <View style={styles.stepperRow}>
          <ScalePressable
            onPress={() => setMonthlySpend((s) => Math.max(1000, s - 1000))}
            style={styles.stepBtn}
            accessibilityLabel="Decrease simulated monthly spend"
          >
            <Minus size={15} color={LedgerTheme.colors.inkPrimary} />
          </ScalePressable>
          <View style={styles.spendCenter}>
            <Text style={styles.spendCenterLabel}>Simulated Spend</Text>
            <Text style={styles.spendCenterVal}>{formatInr(clampedSpend)}/mo</Text>
          </View>
          <ScalePressable
            onPress={() => setMonthlySpend((s) => Math.min(sliderMax, s + 1000))}
            style={styles.stepBtn}
            accessibilityLabel="Increase simulated monthly spend"
          >
            <Plus size={15} color={LedgerTheme.colors.inkPrimary} />
          </ScalePressable>
        </View>

        <View style={styles.presetsRow}>
          {[
            { label: '₹2.5k', value: 2500 },
            ...(zoneEval.eligibleSpendBeforeCapInr
              ? [
                  {
                    label: `Sweet Spot (${formatInr(zoneEval.eligibleSpendBeforeCapInr)})`,
                    value: zoneEval.eligibleSpendBeforeCapInr,
                  },
                  {
                    label: '2× Cap',
                    value: Math.min(sliderMax, zoneEval.eligibleSpendBeforeCapInr * 2),
                  },
                ]
              : [
                  { label: '₹10k', value: 10000 },
                  { label: '₹25k', value: 25000 },
                ]),
          ].map((preset) => {
            const active = Math.abs(clampedSpend - preset.value) <= 250;
            return (
              <ScalePressable
                key={preset.label}
                onPress={() => setMonthlySpend(preset.value)}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipTxt, active && styles.presetChipTxtActive]}>
                  {preset.label}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        {/* Visual Animated Cap Bar */}
        <View style={{ gap: 6 }}>
          <View style={styles.capStatusRow}>
            {zoneEval.capped ? (
              <TrendingDown size={14} color="#B45309" />
            ) : zoneEval.monthlyCapInr ? (
              <Gauge size={14} color={gaugeColor} />
            ) : (
              <Zap size={14} color={LedgerTheme.colors.accent} />
            )}
            <Text style={[styles.capStatusTxt, { color: gaugeColor }]}>
              {zoneEval.capped
                ? `Cap maxed · ${formatInr(zoneEval.overflowSpendInr)} overflow at base rate`
                : zoneEval.monthlyCapInr
                  ? `${zoneEval.spendProgressPct}% of monthly cap sweet-spot used`
                  : `Uncapped at ${(zoneEval.headlinePct * strategyMult).toFixed(1)}%`}
            </Text>
          </View>
          <AnimatedProgressBar percent={gaugePct} fillColor={gaugeColor} height={10} />
        </View>

        {/* Live KPI Pair */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Est. Reward</Text>
            <Text style={[styles.kpiVal, { color: LedgerTheme.colors.accent }]}>
              {formatInr(zoneEval.adjustedMonthlyReward)}/mo
            </Text>
            <Text style={styles.kpiSub}>{formatInr(zoneEval.adjustedAnnualReward)}/yr</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Real Blended Rate</Text>
            <Text style={styles.kpiVal}>{zoneEval.adjustedEffectivePct.toFixed(2)}%</Text>
            <Text style={styles.kpiSub}>
              {zoneEval.monthlyCapInr
                ? zoneEval.capped
                  ? `${formatInr(zoneEval.monthlyCapInr)} cap hit`
                  : `${formatInr(zoneEval.headroomInr)} cap left`
                : 'Uncapped'}
            </Text>
          </View>
        </View>

        {activeZone.caveat ? (
          <View style={styles.caveatBox}>
            <AlertCircle size={14} color={LedgerTheme.colors.warn} style={{ marginTop: 2 }} />
            <Text style={styles.caveatTxt}>
              <Text style={{ fontWeight: '700', color: LedgerTheme.colors.warn }}>Caveat: </Text>
              {activeZone.caveat}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 3-Stage Unlock Journey */}
      <View style={styles.journeyStack}>
        <Text style={styles.journeyHeader}>How {identity.card_name} Unlocks Full Value</Text>
        <View style={styles.journeyRow}>
          <View style={styles.journeyIcon}>
            <Gift size={14} color={LedgerTheme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyStageTitle}>1. Welcome &amp; Activation</Text>
            <Text style={styles.journeyStageBody}>{welcomeSummaryText}</Text>
          </View>
        </View>
        <View style={styles.journeyRow}>
          <View style={styles.journeyIcon}>
            <CheckCircle2 size={14} color={LedgerTheme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyStageTitle}>
              2. Sweet Spot ({activeZone.meta.shortLabel})
            </Text>
            <Text style={styles.journeyStageBody}>
              {activeZone.monthlyCap && zoneEval.eligibleSpendBeforeCapInr
                ? `Spend up to ${formatInr(zoneEval.eligibleSpendBeforeCapInr)}/mo to earn full ${activeZone.adjRate.toFixed(1)}% (${formatInr(activeZone.monthlyCap)}/mo cap).`
                : `Earn steady ${activeZone.adjRate.toFixed(1)}% on ${activeZone.meta.shortLabel}.`}
            </Text>
          </View>
        </View>
        <View style={styles.journeyRow}>
          <View style={styles.journeyIcon}>
            <ShieldCheck size={14} color={LedgerTheme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyStageTitle}>3. Fee Waiver &amp; Lounge Gate</Text>
            <Text style={styles.journeyStageBody}>{waiverGateText}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  eyebrowText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 22,
  },
  strategyRow: {
    gap: 8,
    paddingVertical: 2,
  },
  strategyChip: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  strategyChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  strategyChipTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  strategyChipTxtActive: {
    color: '#FFFFFF',
  },
  zoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneTile: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 11,
    gap: 4,
  },
  zoneTileActive: {
    backgroundColor: '#F4FAF7',
    borderColor: LedgerTheme.colors.accent,
    borderWidth: 1.5,
  },
  zoneTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoneRate: {
    fontSize: 15,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  zoneLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
  },
  zoneCapSub: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  labCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  labTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  labHint: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    lineHeight: 17,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.creamWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spendCenter: {
    alignItems: 'center',
  },
  spendCenterLabel: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  spendCenterVal: {
    fontSize: 16,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  presetChipActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.accent,
  },
  presetChipTxt: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '600',
  },
  presetChipTxtActive: {
    color: LedgerTheme.colors.accent,
  },
  capStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capStatusTxt: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 2,
  },
  caveatBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#F2E2CF',
    borderRadius: 10,
    padding: 10,
  },
  caveatTxt: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkSecondary,
  },
  journeyStack: {
    gap: 9,
    paddingTop: 4,
  },
  journeyHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 11,
  },
  journeyIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyStageTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  journeyStageBody: {
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
});
