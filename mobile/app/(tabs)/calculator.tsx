import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  Minus,
  Plus,
  Search,
  Wallet,
  X,
} from 'lucide-react-native';
import { ALL_CARDS, CALC_META } from '../../src/lib/data';
import { evaluateCardForSpend } from '../../src/lib/advisor';
import { CONVERSION_STRATEGIES, type CardConversionResult } from '../../src/lib/conversion';
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
  formatInr,
  matchesTokenizedQuery,
} from '../../src/lib/format';
import { LedgerTheme } from '../../src/lib/theme';
import { BankLogo } from '../../src/components/BankLogo';
import { CardArtwork } from '../../src/components/CardArtwork';
import {
  NativeHorizontalBarChart,
  NativeValueBreakdownChart,
} from '../../src/components/AnalyticsCharts';
import { FullScreenGraphModal } from '../../src/components/FullScreenGraphModal';
import { CanvaFeatureIcon, resolveCategoryCanvaIcon } from '../../src/components/FeatureIcon';
import {
  AnimatedProgressBar,
  AnimatedReveal,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../../src/components/MotionPrimitives';
import { useCompare } from '../../src/components/CompareContext';
import type {
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from '../../src/lib/types';

const PERSONAS: Array<{ label: string; spend: Partial<Record<SpendCategoryKey, number>> }> = [
  {
    label: 'Online Shopper',
    spend: {
      online_shopping_general: 10000,
      amazon_flipkart_myntra: 12000,
      dining_swiggy_zomato: 5000,
      groceries_quick_commerce: 6000,
      upi_scan_and_pay: 4000,
      utilities_bills_telecom: 3500,
    },
  },
  {
    label: 'Travel & Miles',
    spend: {
      travel_flights_hotels: 22000,
      dining_swiggy_zomato: 8000,
      online_shopping_general: 8000,
      international_forex_net_of_markup: 10000,
      offline_general_other: 8000,
    },
  },
  {
    label: 'Daily UPI & Bills',
    spend: {
      upi_scan_and_pay: 14000,
      groceries_quick_commerce: 8000,
      utilities_bills_telecom: 6000,
      fuel: 4000,
      dining_swiggy_zomato: 4000,
    },
  },
];

function makeInitialSpend(): Record<SpendCategoryKey, number> {
  const out = {} as Record<SpendCategoryKey, number>;
  for (const k of SPEND_CATEGORY_KEYS) {
    out[k] = SPEND_CATEGORY_META[k].defaultMonthlyInr;
  }
  return out;
}

interface RankedCard {
  card: CardSummaryItem;
  annualSpend: number;
  grossAnnualReward: number;
  conversionResult: CardConversionResult;
  feeCharged: number;
  waiverMet: boolean;
  netProfit: number;
  effectivePct: number;
  topContributors: Array<{ label: string; rewardInr: number; pct: number }>;
  cappingNotes: string[];
}

export default function CalculatorScreen() {
  const router = useRouter();
  const { ownedIds } = useCompare();
  const [spend, setSpend] = useState<Record<SpendCategoryKey, number>>(makeInitialSpend);
  const [ltfOnly, setLtfOnly] = useState(false);
  const [upiOnly, setUpiOnly] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'net' | 'pct'>('net');
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [cardQuery, setCardQuery] = useState('');
  const [includeGst, setIncludeGst] = useState(true);
  const [conversionStrategy, setConversionStrategy] =
    useState<RewardConversionStrategy>('default_inr');
  const [spendExpanded, setSpendExpanded] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullGraphOpen, setFullGraphOpen] = useState(false);

  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const totalMonthlySpend = useMemo(
    () => SPEND_CATEGORY_KEYS.reduce((s, k) => s + (spend[k] || 0), 0),
    [spend]
  );

  const ranked = useMemo<RankedCard[]>(() => {
    const out: RankedCard[] = [];

    for (const card of ALL_CARDS) {
      if (ltfOnly && !card.filter_tags.is_ltf) continue;
      if (upiOnly && !card.filter_tags.is_rupay_upi) continue;
      if (ownedOnly && !ownedSet.has(card.card_id)) continue;
      if (
        cardQuery.trim() &&
        !matchesTokenizedQuery(
          cardQuery,
          card.card_name,
          card.bank,
          card.primary_category
        )
      ) {
        continue;
      }

      const meta = CALC_META[card.card_id];
      const waiver = card.fee_waiver_spend_inr ?? meta?.waiver ?? null;
      const ev = evaluateCardForSpend(
        card,
        spend,
        includeGst,
        waiver,
        conversionStrategy
      );
      const contribs = ev.categoryBreakdown
        .filter((c) => c.annualReward > 0)
        .sort((a, b) => b.annualReward - a.annualReward)
        .slice(0, 4)
        .map((c) => ({
          label: SPEND_CATEGORY_META[c.key].shortLabel,
          rewardInr: c.annualReward,
          pct: c.effectivePct,
        }));

      out.push({
        card,
        annualSpend: ev.annualSpendInr,
        grossAnnualReward: ev.grossAnnualRewardsInr,
        conversionResult: ev.conversionResult,
        feeCharged: ev.effectiveFeeInr,
        waiverMet: ev.waiverMet,
        netProfit: ev.netAnnualBenefitInr,
        effectivePct: ev.netReturnPct,
        topContributors: contribs,
        cappingNotes: [...ev.capNotes, ...(meta?.caps || [])],
      });
    }

    return out
      .sort((a, b) =>
        sortBy === 'pct'
          ? b.effectivePct - a.effectivePct || b.netProfit - a.netProfit
          : b.netProfit - a.netProfit
      )
      .slice(0, 50);
  }, [
    spend,
    ltfOnly,
    upiOnly,
    ownedOnly,
    ownedSet,
    cardQuery,
    sortBy,
    includeGst,
    conversionStrategy,
  ]);

  const applyPersona = (p: (typeof PERSONAS)[number]) => {
    triggerCalmLayoutTransition();
    setActivePersona(p.label);
    const next = {} as Record<SpendCategoryKey, number>;
    for (const k of SPEND_CATEGORY_KEYS) {
      next[k] = p.spend[k] ?? 0;
    }
    setSpend(next);
  };

  const clearSpends = () => {
    triggerCalmLayoutTransition();
    setActivePersona('Zero');
    const next = {} as Record<SpendCategoryKey, number>;
    for (const k of SPEND_CATEGORY_KEYS) next[k] = 0;
    setSpend(next);
  };

  const adjust = (k: SpendCategoryKey, delta: number) => {
    setActivePersona(null);
    setSpend((prev) => {
      const nextVal = Math.max(0, Math.min(SPEND_CATEGORY_META[k].maxInr, (prev[k] || 0) + delta));
      return { ...prev, [k]: nextVal };
    });
  };

  return (
    <>
      <FlatList
      data={ranked}
      keyExtractor={(item) => item.card.card_id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {/* Editorial 3D Rewards Studio Visual */}
          <View style={styles.studioBanner}>
            <Image
              source={require('../../assets/illustrations/rewards-compass-3d.webp')}
              style={styles.studioThumb}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Reward Math &amp; Conversion</Text>
              <Text style={styles.studioBannerTitle}>
                Net INR Cashback &amp; Air Miles Studio
              </Text>
              <Text style={styles.studioBannerSub}>
                Live after monthly caps, forex drag &amp; GST on fees
              </Text>
            </View>
          </View>

          {/* Spend Summary + Accordion */}
          <View style={styles.spendBox}>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setSpendExpanded((v) => !v);
              }}
              style={styles.spendHeader}
            >
              <View>
                <Text style={styles.eyebrow}>Reward Rate to Real Cashback</Text>
                <Text style={styles.totalSpend}>
                  {formatInr(totalMonthlySpend)} / mo ({formatInr(totalMonthlySpend * 12)} / yr)
                </Text>
              </View>
              {spendExpanded ? (
                <ChevronUp size={20} color={LedgerTheme.colors.inkSecondary} />
              ) : (
                <ChevronDown size={20} color={LedgerTheme.colors.inkSecondary} />
              )}
            </ScalePressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
              {PERSONAS.map((p) => {
                const active = activePersona === p.label;
                return (
                  <ScalePressable
                    key={p.label}
                    onPress={() => applyPersona(p)}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </ScalePressable>
                );
              })}
              <ScalePressable
                onPress={clearSpends}
                style={[styles.presetChip, activePersona === 'Zero' && styles.presetChipActive]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    activePersona === 'Zero' && styles.presetChipTextActive,
                  ]}
                >
                  Zero All
                </Text>
              </ScalePressable>
            </ScrollView>

            {spendExpanded && (
              <AnimatedReveal style={styles.steppersWrap}>
                {SPEND_CATEGORY_KEYS.map((k) => {
                  const val = spend[k] || 0;
                  return (
                    <View key={k} style={styles.stepperRow}>
                      <View style={styles.stepperLabelWrap}>
                        <CanvaFeatureIcon
                          icon={resolveCategoryCanvaIcon(SPEND_CATEGORY_META[k].shortLabel)}
                          size={14}
                        />
                        <Text numberOfLines={1} style={styles.stepperLabel}>
                          {SPEND_CATEGORY_META[k].shortLabel}
                        </Text>
                      </View>
                      <View style={styles.stepperControls}>
                        <ScalePressable
                          onPress={() => adjust(k, -1000)}
                          style={styles.stepBtn}
                          hitSlop={4}
                        >
                          <Minus size={14} color={LedgerTheme.colors.inkPrimary} />
                        </ScalePressable>
                        <Text style={styles.stepVal}>{formatInr(val)}</Text>
                        <ScalePressable
                          onPress={() => adjust(k, 1000)}
                          style={styles.stepBtn}
                          hitSlop={4}
                        >
                          <Plus size={14} color={LedgerTheme.colors.inkPrimary} />
                        </ScalePressable>
                      </View>
                    </View>
                  );
                })}
              </AnimatedReveal>
            )}

            <View style={styles.togglesRow}>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setLtfOnly((v) => !v);
                }}
                style={[styles.togglePill, ltfOnly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, ltfOnly && styles.toggleTextActive]}>
                  LTF Only
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setUpiOnly((v) => !v);
                }}
                style={[styles.togglePill, upiOnly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, upiOnly && styles.toggleTextActive]}>
                  RuPay UPI
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setOwnedOnly((v) => !v);
                }}
                style={[styles.togglePill, styles.toggleRowInline, ownedOnly && styles.toggleActive]}
              >
                <Wallet
                  size={12}
                  color={ownedOnly ? LedgerTheme.colors.accent : LedgerTheme.colors.inkSecondary}
                />
                <Text style={[styles.toggleText, ownedOnly && styles.toggleTextActive]}>
                  Owned ({ownedIds.length})
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setSortBy((v) => (v === 'net' ? 'pct' : 'net'));
                }}
                style={[styles.togglePill, sortBy === 'pct' && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, sortBy === 'pct' && styles.toggleTextActive]}>
                  Sort: {sortBy === 'net' ? 'Net ₹' : 'Net %'}
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => setIncludeGst((v) => !v)}
                style={[styles.togglePill, includeGst && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, includeGst && styles.toggleTextActive]}>
                  18% GST on Fee
                </Text>
              </ScalePressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.togglesRow}
            >
              {CONVERSION_STRATEGIES.map((st) => {
                const active = conversionStrategy === st.id;
                return (
                  <ScalePressable
                    key={st.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setConversionStrategy(st.id);
                    }}
                    style={[styles.togglePill, active && styles.toggleActive]}
                  >
                    <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                      {st.shortLabel}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.cardSearchRow}>
            <Search size={16} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={cardQuery}
              onChangeText={setCardQuery}
              placeholder="Filter cards or bank (HDFC, SBI Cashback, Axis)..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.cardSearchInput}
              returnKeyType="search"
            />
            {cardQuery.length > 0 && (
              <ScalePressable onPress={() => setCardQuery('')} hitSlop={8}>
                <X size={16} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            )}
          </View>

          <ScalePressable
            onPress={() => router.push('/advisor?tab=combo' as never)}
            style={styles.comboLinkBanner}
          >
            <Layers size={15} color={LedgerTheme.colors.accent} />
            <Text style={styles.comboLinkText}>Compare 2-Card Wallet Combo →</Text>
          </ScalePressable>

          {ranked.length > 1 && (
            <View style={{ gap: 12 }}>
              <NativeHorizontalBarChart
                title="Top Cards Ranked by Net Yield"
                subtitle="Full readable names with zero overlap · Tap to open dossier"
                onExpandPress={() => setFullGraphOpen(true)}
                data={ranked.slice(0, 6).map((r) => ({
                  id: `${r.card.card_id}_h`,
                  label: r.card.card_name,
                  sublabel: `${r.card.bank} · Fee ${r.feeCharged === 0 ? '₹0' : formatInr(r.feeCharged)}`,
                  value: Math.max(0, Number(r.effectivePct.toFixed(2))),
                  displayValue: `${r.effectivePct.toFixed(1)}% (${formatInr(r.netProfit)})`,
                  onPress: () =>
                    router.push({
                      pathname: '/card/[bankSlug]/[cardSlug]',
                      params: {
                        bankSlug: r.card.bank_slug,
                        cardSlug: r.card.card_slug,
                      },
                    }),
                }))}
              />

              <NativeValueBreakdownChart
                title={`Leader Breakdown: ${ranked[0].card.card_name}`}
                subtitle="Annual gross reward vs effective annual fee vs net profit"
                grossInr={ranked[0].grossAnnualReward}
                feeInr={ranked[0].feeCharged}
                netInr={ranked[0].netProfit}
              />
            </View>
          )}

          <Text style={styles.rankHeading}>
            {ownedOnly
              ? `Your Owned Cards Ranked (${ranked.length})`
              : `Top ${ranked.length} Cards Ranked by ${sortBy === 'pct' ? 'Net Return %' : 'Net Annual Value'}`}
          </Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const isOpen = expandedId === item.card.card_id;
        const maxContrib =
          item.topContributors.length > 0
            ? Math.max(...item.topContributors.map((x) => x.rewardInr), 1)
            : 1;
        return (
          <View style={styles.rankCard}>
            <ScalePressable
              onPress={() =>
                router.push({
                  pathname: '/card/[bankSlug]/[cardSlug]',
                  params: {
                    bankSlug: item.card.bank_slug,
                    cardSlug: item.card.card_slug,
                  },
                })
              }
              style={styles.rankTop}
            >
              <View style={styles.rankLeft}>
                <Text style={styles.rankNum}>#{index + 1}</Text>
                <CardArtwork
                  localImagePath={item.card.local_image_path}
                  imageUrl={item.card.image_url}
                  bank={item.card.bank}
                  cardName={item.card.card_name}
                  network={item.card.card_network}
                  cardTheme={item.card.card_theme}
                  size="sm"
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.rankBankRow}>
                    <BankLogo
                      bankSlug={item.card.bank_slug}
                      bank={item.card.bank}
                      size="xs"
                    />
                    <Text numberOfLines={1} style={styles.rankBank}>
                      {item.card.bank}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.rankTitle}>
                    {item.card.card_name}
                  </Text>
                </View>
              </View>

              <View style={styles.rankProfitCol}>
                <Text
                  style={[
                    styles.profitNum,
                    item.netProfit < 0 && { color: LedgerTheme.colors.danger },
                  ]}
                >
                  {formatInr(item.netProfit)}/yr
                </Text>
                {item.conversionResult.supportsStrategy &&
                  item.conversionResult.convertedUnitsPerYear > 0 && (
                    <Text style={styles.effPct}>
                      ~{item.conversionResult.convertedUnitsPerYear.toLocaleString('en-IN')}{' '}
                      {item.conversionResult.unitLabel}
                    </Text>
                  )}
                <Text style={styles.effPct}>{item.effectivePct.toFixed(2)}% net</Text>
              </View>
            </ScalePressable>

            <View style={styles.rankBottom}>
              <Text style={styles.feeNote}>
                Gross +{formatInr(item.grossAnnualReward)} ·{' '}
                {item.waiverMet ? 'Fee ₹0 (Waived/LTF)' : `Fee -${formatInr(item.feeCharged)}`}
              </Text>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setExpandedId(isOpen ? null : item.card.card_id);
                }}
                style={styles.mathBtn}
                hitSlop={6}
              >
                <Text style={styles.mathBtnText}>{isOpen ? 'Hide Math' : 'Breakdown'}</Text>
                <ChevronRight
                  size={14}
                  color={LedgerTheme.colors.accent}
                  style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                />
              </ScalePressable>
            </View>

            {isOpen && (
              <AnimatedReveal style={styles.breakdownBox}>
                {item.topContributors.map((c) => (
                  <View key={c.label} style={styles.contribBlock}>
                    <View style={styles.contribRow}>
                      <Text style={styles.contribLabel}>
                        {c.label} ({c.pct.toFixed(1)}%)
                      </Text>
                      <Text style={styles.contribVal}>+{formatInr(c.rewardInr)}/yr</Text>
                    </View>
                    <AnimatedProgressBar
                      percent={(c.rewardInr / maxContrib) * 100}
                      height={5}
                    />
                  </View>
                ))}
                {item.cappingNotes.length > 0 && (
                  <Text style={styles.capNote}>
                    Cap Note: {item.cappingNotes[0]}
                  </Text>
                )}
              </AnimatedReveal>
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No matching cards in Calculator</Text>
          <Text style={styles.emptySub}>
            {ownedOnly && ownedIds.length === 0
              ? 'You have no cards marked in My Cards yet. Add owned cards in My Cards or disable Owned filter.'
              : 'Clear your card filter or toggles to see ranked results.'}
          </Text>
        </View>
      }
    />
      <FullScreenGraphModal
        visible={fullGraphOpen}
        onClose={() => setFullGraphOpen(false)}
        title="Calculator: Net Annual Yield Comparison"
        subtitle="Comparing your Top 8 ranked cards across effective net yield"
        itemKind="card"
        annualFeeInr={ranked[0]?.card.annual_fee_inr ?? 0}
        categories={ranked.slice(0, 8).map((r) =>
          r.card.card_name.replace(/Credit Card/gi, '').trim()
        )}
        series={[
          {
            label: 'Effective Net Yield (%)',
            color: LedgerTheme.colors.accent,
            values: ranked.slice(0, 8).map((r) => Math.max(0, Number(r.effectivePct.toFixed(2)))),
          },
        ]}
        valueSuffix="%"
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 38,
  },
  headerBlock: {
    gap: 16,
    marginBottom: 16,
  },
  spendBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  spendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 12,
    color: LedgerTheme.colors.accent,
    fontWeight: '700',
  },
  totalSpend: {
    fontSize: 18,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  presetsRow: {
    gap: 7,
  },
  presetChip: {
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  presetChipText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkPrimary,
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: LedgerTheme.colors.accent,
  },
  steppersWrap: {
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    paddingTop: 10,
    gap: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 8,
  },
  stepperLabel: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    flex: 1,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    minWidth: 74,
    textAlign: 'right',
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  togglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingTop: 4,
  },
  togglePill: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    justifyContent: 'center',
  },
  toggleRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toggleActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  toggleText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: LedgerTheme.colors.accent,
  },
  cardSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  cardSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 8,
  },
  comboLinkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  comboLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  rankHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  rankCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  rankTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    flex: 1,
  },
  rankNum: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
  },
  rankBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rankBank: {
    flex: 1,
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  rankTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 20,
  },
  rankProfitCol: {
    alignItems: 'flex-end',
  },
  profitNum: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  effPct: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  rankBottom: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeNote: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  mathBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  mathBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  breakdownBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 8,
    padding: 10,
    gap: 7,
  },
  contribBlock: {
    gap: 4,
  },
  contribRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contribLabel: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  contribVal: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  capNote: {
    fontSize: 11.5,
    color: LedgerTheme.colors.warn,
    marginTop: 4,
    lineHeight: 16,
  },
  emptyCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: LedgerTheme.radius.lg,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  studioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: LedgerTheme.radius.lg,
    padding: 10,
  },
  studioThumb: {
    width: 90,
    height: 68,
    borderRadius: 10,
    resizeMode: 'cover',
    backgroundColor: LedgerTheme.colors.canvas,
  },
  studioBannerTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 1,
  },
  studioBannerSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
});
