import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bookmark,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Gauge,
  Globe,
  IndianRupee,
  Layers,
  MessageCircle,
  Plane,
  Plus,
  Scale,
  Share2,
  ShieldAlert,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import { ALL_CARDS, getDossierById, TOTAL_CARDS } from '../src/lib/data';
import { evaluateTwoCardCombo } from '../src/lib/advisor';
import { formatInr, formatLoungeQuota, SPEND_CATEGORY_KEYS, SPEND_CATEGORY_META } from '../src/lib/format';
import { exportComparisonPdfMobile, shareComparisonSummary } from '../src/lib/pdfExport';
import { buildWhatsAppShareUrl, openExternalUrlSafely } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';
import { BankLogo } from '../src/components/BankLogo';
import { CardArtwork } from '../src/components/CardArtwork';
import { NativeMultiBarChart } from '../src/components/AnalyticsCharts';
import {
  CalmEntranceView,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../src/components/MotionPrimitives';
import { useCompare } from '../src/components/CompareContext';
import type { MobileCardDossier, SpendCategoryKey } from '../src/lib/types';

const DEFAULT_MONTHLY_SPEND: Record<SpendCategoryKey, number> = SPEND_CATEGORY_KEYS.reduce(
  (acc, k) => {
    acc[k] = SPEND_CATEGORY_META[k].defaultMonthlyInr;
    return acc;
  },
  {} as Record<SpendCategoryKey, number>
);

export default function CompareScreen() {
  const router = useRouter();
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const { items, removeItem, clearAll, toggleItem, isSelected, savedIds } = useCompare();
  const presetLoadedRef = useRef(false);

  const loadSamplePair = () => {
    triggerCalmLayoutTransition();
    clearAll();
    const preferredSlugs = [
      'hdfc-regalia-gold-credit-card',
      'cashback-sbi-card',
      'axis-bank-atlas-credit-card',
    ];
    for (const slug of preferredSlugs) {
      const card = ALL_CARDS.find((c) => c.card_slug === slug);
      if (card) {
        toggleItem({
          card_id: card.card_id,
          card_name: card.card_name,
          bank: card.bank,
          bank_slug: card.bank_slug,
          card_slug: card.card_slug,
          annual_fee_inr: card.annual_fee_inr,
          overall_rating: card.overall_rating,
        });
      }
    }
  };

  useEffect(() => {
    if (preset === 'trio' && !presetLoadedRef.current && items.length === 0) {
      presetLoadedRef.current = true;
      loadSamplePair();
    }
  }, [preset, items.length]);

  const dossiers = useMemo(
    () =>
      items
        .map((it) => getDossierById(it.card_id))
        .filter((d): d is MobileCardDossier => Boolean(d)),
    [items]
  );

  const savedCards = useMemo(() => {
    const map = new Map(ALL_CARDS.map((c) => [c.card_id, c]));
    return savedIds
      .map((id) => map.get(id))
      .filter((c): c is (typeof ALL_CARDS)[number] => Boolean(c));
  }, [savedIds]);

  const twoCardCombo = useMemo(() => {
    if (dossiers.length < 2) return null;
    const summary0 = ALL_CARDS.find((c) => c.card_id === dossiers[0].identity.card_id);
    const summary1 = ALL_CARDS.find((c) => c.card_id === dossiers[1].identity.card_id);
    if (!summary0 || !summary1) return null;
    return evaluateTwoCardCombo(summary0, summary1, DEFAULT_MONTHLY_SPEND, true);
  }, [dossiers]);

  const comparisonWinners = useMemo(() => {
    if (dossiers.length < 2) return null;
    const bestRating = Math.max(...dossiers.map((d) => d.ratings.overall_market_rating));
    const lowestFee = Math.min(...dossiers.map((d) => d.fees_and_charges_detailed.annual_fee_inr));
    const lowestForex = Math.min(...dossiers.map((d) => d.fees_and_charges_detailed.forex_markup_pct));
    const lowestDeval = Math.min(...dossiers.map((d) => d.devaluation_analysis.devaluation_risk_score));
    const bestByCat: Record<string, number> = {};
    for (const k of SPEND_CATEGORY_KEYS) {
      bestByCat[k] = Math.max(
        ...dossiers.map((d) => d.reward_calculator_model.effective_return_pct_by_category[k] ?? 0)
      );
    }
    return { bestRating, lowestFee, lowestForex, lowestDeval, bestByCat };
  }, [dossiers]);

  const renderSavedStrip = () => {
    if (savedCards.length === 0) return null;
    return (
      <View style={styles.savedStripBox}>
        <View style={styles.savedStripHeader}>
          <Bookmark size={14} color={LedgerTheme.colors.accent} />
          <Text style={styles.savedStripTitle}>Quick-Add from Saved Watchlist</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.savedChipsRow}
        >
          {savedCards.map((card) => {
            const added = isSelected(card.card_id);
            return (
              <ScalePressable
                key={card.card_id}
                onPress={() => {
                  triggerCalmLayoutTransition();
                  toggleItem({
                    card_id: card.card_id,
                    card_name: card.card_name,
                    bank: card.bank,
                    bank_slug: card.bank_slug,
                    card_slug: card.card_slug,
                    annual_fee_inr: card.annual_fee_inr,
                    overall_rating: card.overall_rating,
                  });
                }}
                style={[styles.savedQuickChip, added && styles.savedQuickChipActive]}
              >
                <Plus size={12} color={added ? LedgerTheme.colors.surface : LedgerTheme.colors.accent} />
                <Text
                  numberOfLines={1}
                  style={[styles.savedQuickText, added && { color: LedgerTheme.colors.surface }]}
                >
                  {card.card_name}
                </Text>
              </ScalePressable>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  if (dossiers.length === 0) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.emptyContainer}
        showsVerticalScrollIndicator={false}
      >
        <CalmEntranceView style={{ alignItems: 'center', gap: 12, width: '100%' }}>
          <View style={styles.emptyIcon}>
            <Scale size={24} color={LedgerTheme.colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No cards selected for comparison</Text>
          <Text style={styles.emptySub}>
            Tap "+ Compare" on any card across Discover, Finder, or Card Dossiers to compare up to 3 credit cards side-by-side.
          </Text>
          <ScalePressable onPress={loadSamplePair} style={styles.sampleBtn}>
            <Text style={styles.sampleBtnText}>
              Load Regalia Gold vs SBI Cashback vs Axis Atlas
            </Text>
          </ScalePressable>
          <ScalePressable onPress={() => router.back()} style={styles.browseBtn}>
            <Text style={styles.browseBtnText}>Browse All {TOTAL_CARDS} Cards</Text>
          </ScalePressable>
          {savedCards.length > 0 && <View style={{ width: '100%', marginTop: 12 }}>{renderSavedStrip()}</View>}
        </CalmEntranceView>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <Text style={styles.topText}>
          Comparing {dossiers.length} of 3 selected cards
        </Text>
        <View style={styles.topActions}>
          <ScalePressable
            onPress={() => shareComparisonSummary(dossiers)}
            style={styles.iconActionBtn}
          >
            <Share2 size={14} color={LedgerTheme.colors.accent} />
            <Text style={styles.iconActionBtnText}>Share</Text>
          </ScalePressable>
          <ScalePressable
            onPress={() => {
              const names = dossiers.map((d) => d.identity.card_name).join(' vs ');
              const ids = dossiers.map((d) => d.identity.card_id).join(',');
              const msg = `Cardify Comparison: ${names}\nhttps://card.cogify.me/compare?ids=${encodeURIComponent(ids)}`;
              void openExternalUrlSafely(buildWhatsAppShareUrl(msg)).then((ok) => {
                if (!ok) void shareComparisonSummary(dossiers);
              });
            }}
            style={[styles.iconActionBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
          >
            <MessageCircle size={14} color="#15803D" />
            <Text style={[styles.iconActionBtnText, { color: '#15803D' }]}>WhatsApp</Text>
          </ScalePressable>
          <ScalePressable
            onPress={() => exportComparisonPdfMobile(dossiers)}
            style={styles.pdfExportBtn}
          >
            <FileText size={14} color={LedgerTheme.colors.surface} />
            <Text style={styles.pdfExportBtnText}>PDF</Text>
          </ScalePressable>
          <ScalePressable
            onPress={() => {
              triggerCalmLayoutTransition();
              clearAll();
            }}
            style={styles.clearBtn}
          >
            <Trash2 size={14} color={LedgerTheme.colors.danger} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </ScalePressable>
        </View>
      </View>

      {renderSavedStrip()}

      {/* 2-Card Optimal Spend Split Preview */}
      {twoCardCombo && (
        <CalmEntranceView delayMs={40} style={styles.comboBox}>
          <View style={styles.comboTop}>
            <View style={styles.comboTitleRow}>
              <Layers size={15} color={LedgerTheme.colors.accent} />
              <Text style={styles.comboTitle}>
                2-Card Wallet Split (First 2 Selected Cards)
              </Text>
            </View>
            <Text style={styles.comboGain}>
              {formatInr(twoCardCombo.comboNetAnnualInr)} / yr net
            </Text>
          </View>
          <Text style={styles.comboSub}>
            Routing each spend category to the higher earner between {twoCardCombo.cardA.card_name} and{' '}
            {twoCardCombo.cardB.card_name} adds{' '}
            {formatInr(Math.max(0, twoCardCombo.extraGainOverSingleInr))}/yr over holding only one (at standard ₹46.5k/mo spend).
          </Text>
          <View style={styles.comboRoutes}>
            {twoCardCombo.categorySplit.slice(0, 6).map((row) => (
              <View key={row.key} style={styles.comboRouteChip}>
                <Text style={styles.comboRouteCat}>
                  {SPEND_CATEGORY_META[row.key].shortLabel} · {row.bestPct.toFixed(1)}%
                </Text>
                <Text numberOfLines={1} style={styles.comboRouteCard}>
                  Use {row.useCard === 'A' ? twoCardCombo.cardA.card_name : twoCardCombo.cardB.card_name}
                </Text>
              </View>
            ))}
          </View>
        </CalmEntranceView>
      )}

      {dossiers.length >= 2 && (
        <View style={{ marginBottom: 14, gap: 12 }}>
          <NativeMultiBarChart
            title="Peak Category Return % Comparison"
            subtitle="Highest effective reward rate across spend categories"
            chartHeight={155}
            data={dossiers.map((d) => {
              const vals = Object.values(
                d.reward_calculator_model.effective_return_pct_by_category || {}
              );
              const peak = Math.max(
                d.reward_calculator_model.base_reward_rate_pct || 0,
                ...(vals.length ? vals : [0])
              );
              return {
                id: d.identity.card_id,
                label: d.identity.card_name,
                value: Number(peak.toFixed(1)),
                displayValue: `${peak.toFixed(1)}%`,
                onPress: () =>
                  router.push({
                    pathname: '/card/[bankSlug]/[cardSlug]',
                    params: {
                      bankSlug: d.identity.bank_slug,
                      cardSlug: d.identity.card_slug,
                    },
                  }),
              };
            })}
          />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.columnsWrap}
      >
        {dossiers.map((d) => {
          const domQuota = formatLoungeQuota(
            d.lounge_access_detailed.domestic.visits_per_year,
            d.lounge_access_detailed.domestic.visits_per_quarter,
            d.lounge_access_detailed.has_domestic_lounge
          );
          const intlQuota = formatLoungeQuota(
            d.lounge_access_detailed.international.visits_per_year,
            0,
            d.lounge_access_detailed.has_international_lounge
          );
          const feeWin =
            comparisonWinners !== null &&
            d.fees_and_charges_detailed.annual_fee_inr === comparisonWinners.lowestFee;
          const ratingWin =
            comparisonWinners !== null &&
            d.ratings.overall_market_rating === comparisonWinners.bestRating;
          const forexWin =
            comparisonWinners !== null &&
            d.fees_and_charges_detailed.forex_markup_pct === comparisonWinners.lowestForex;
          const devalWin =
            comparisonWinners !== null &&
            d.devaluation_analysis.devaluation_risk_score === comparisonWinners.lowestDeval;

          return (
          <View key={d.identity.card_id} style={styles.compareCol}>
            <View style={styles.colHeader}>
              <CardArtwork
                localImagePath={d.visual_assets.local_image_path}
                imageUrl={d.visual_assets.image_url}
                bank={d.identity.bank}
                cardName={d.identity.card_name}
                network={d.identity.card_network}
                cardTheme={d.visual_assets.card_theme}
                showSplash
                size="md"
              />
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  removeItem(d.identity.card_id);
                }}
                style={styles.removeBtn}
                hitSlop={8}
              >
                <X size={14} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            </View>

            <ScalePressable
              onPress={() =>
                router.push({
                  pathname: '/card/[bankSlug]/[cardSlug]',
                  params: {
                    bankSlug: d.identity.bank_slug,
                    cardSlug: d.identity.card_slug,
                  },
                })
              }
            >
              <View style={styles.colBankRow}>
                <BankLogo bankSlug={d.identity.bank_slug} bank={d.identity.bank} size="xs" />
                <Text numberOfLines={1} style={styles.colBank}>
                  {d.identity.bank}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.colTitle}>
                {d.identity.card_name}
              </Text>
            </ScalePressable>

            <View style={styles.metricBlock}>
              <MetricRow
                icon={<IndianRupee size={13} color={LedgerTheme.colors.accent} />}
                label="Joining / Annual Fee"
                val={`${formatInr(d.fees_and_charges_detailed.joining_fee_inr, true)} / ${formatInr(d.fees_and_charges_detailed.annual_fee_inr, true)}`}
                highlight={feeWin}
              />
              <MetricRow
                icon={<CalendarCheck size={13} color={LedgerTheme.colors.accent} />}
                label="Fee Waiver"
                val={
                  d.fees_and_charges_detailed.fee_waiver_spend_inr
                    ? formatInr(d.fees_and_charges_detailed.fee_waiver_spend_inr)
                    : 'None'
                }
              />
              <MetricRow
                icon={<Star size={13} color={LedgerTheme.colors.warn} />}
                label="Market Rating"
                val={`${d.ratings.overall_market_rating.toFixed(2)} / 5`}
                highlight={ratingWin}
              />
              <MetricRow
                icon={<Globe size={13} color={LedgerTheme.colors.accent} />}
                label="Forex Markup"
                val={`${d.fees_and_charges_detailed.forex_markup_pct}%`}
                highlight={forexWin}
              />
              <MetricRow
                icon={<Plane size={13} color={LedgerTheme.colors.accent} />}
                label="Domestic Lounge"
                val={
                  d.lounge_access_detailed.domestic.spend_criteria
                    ? `${domQuota} · ${d.lounge_access_detailed.domestic.spend_criteria}`
                    : domQuota
                }
              />
              <MetricRow
                icon={<Globe size={13} color={LedgerTheme.colors.accent} />}
                label="Intl Lounge"
                val={
                  d.lounge_access_detailed.international.program &&
                  intlQuota !== 'None'
                    ? `${intlQuota} · ${d.lounge_access_detailed.international.program}`
                    : intlQuota
                }
              />
              <MetricRow
                icon={<ShieldAlert size={13} color={LedgerTheme.colors.warn} />}
                label="Devaluation Risk"
                val={`${d.devaluation_analysis.devaluation_risk_score.toFixed(1)}/10 (${d.devaluation_analysis.devaluation_frequency})`}
                highlight={devalWin}
              />
              <MetricRow
                icon={<Gauge size={13} color={LedgerTheme.colors.accent} />}
                label="Min CIBIL"
                val={`${d.eligibility_detailed.min_cibil_score}+`}
              />
            </View>

            <Text style={styles.subHeading}>Category Return Rates</Text>
            <View style={styles.ratesWrap}>
              {SPEND_CATEGORY_KEYS.map((key) => {
                const pct =
                  d.reward_calculator_model.effective_return_pct_by_category[key] ?? 0;
                const isWinner =
                  comparisonWinners !== null &&
                  pct > 0 &&
                  pct === comparisonWinners.bestByCat[key];
                return (
                  <View key={key} style={styles.rateItem}>
                    <Text style={styles.rateName}>{SPEND_CATEGORY_META[key].shortLabel}</Text>
                    <View style={isWinner ? styles.rateWinnerBadge : undefined}>
                      <Text
                        style={[
                          styles.rateNum,
                          (pct >= 3 || isWinner) && { color: LedgerTheme.colors.accent },
                        ]}
                      >
                        {pct.toFixed(1)}%{isWinner ? ' ✓' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Distinct Pros & Cons Inside Each Card Column */}
            <View style={styles.colProsBox}>
              <View style={styles.colPcHeader}>
                <CheckCircle2 size={13} color={LedgerTheme.colors.accent} />
                <Text style={styles.colProsTitle}>Top Pros</Text>
              </View>
              {(d.pros_and_cons.pros || []).slice(0, 3).map((pro, idx) => (
                <Text key={`p_${idx}`} style={styles.colProsText}>
                  • {pro}
                </Text>
              ))}
            </View>

            <View style={styles.colConsBox}>
              <View style={styles.colPcHeader}>
                <AlertTriangle size={13} color={LedgerTheme.colors.warn} />
                <Text style={styles.colConsTitle}>Watch-Outs (Cons)</Text>
              </View>
              {(d.pros_and_cons.cons || []).slice(0, 2).map((con, idx) => (
                <Text key={`c_${idx}`} style={styles.colConsText}>
                  • {con}
                </Text>
              ))}
            </View>
          </View>
          );
        })}
      </ScrollView>
    </ScrollView>
  );
}

function MetricRow({
  icon,
  label,
  val,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  val: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabelRow}>
        {icon}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricVal, highlight && { color: LedgerTheme.colors.accent }]}>
        {val}
        {highlight ? ' ✓' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: LedgerTheme.colors.canvas,
    gap: 10,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  sampleBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  browseBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  topText: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  iconActionBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  pdfExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.accent,
  },
  pdfExportBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.tintDanger,
  },
  clearBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.danger,
  },
  savedStripBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 11,
    padding: 10,
    gap: 8,
  },
  savedStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedStripTitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  savedChipsRow: {
    gap: 7,
  },
  savedQuickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
  },
  savedQuickChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  savedQuickText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  comboBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 12,
    padding: 13,
    gap: 8,
  },
  comboTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  comboTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  comboTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  comboGain: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  comboSub: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17,
  },
  comboRoutes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  comboRouteChip: {
    width: '48.5%',
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 2,
  },
  comboRouteCat: {
    fontSize: 11,
    color: LedgerTheme.colors.accent,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  comboRouteCard: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  columnsWrap: {
    gap: 18,
    paddingRight: 12,
  },
  compareCol: {
    width: 298,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  colHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: LedgerTheme.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colBank: {
    flex: 1,
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  colTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    marginTop: 2,
    lineHeight: 22,
  },
  metricBlock: {
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  metricRow: {
    gap: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricLabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  metricVal: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkPrimary,
    fontWeight: '500',
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  subHeading: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 4,
  },
  ratesWrap: {
    gap: 5,
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  rateWinnerBadge: {
    backgroundColor: '#EDF7F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rateName: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
  },
  rateNum: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  colProsBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 10,
    padding: 11,
    gap: 5,
  },
  colConsBox: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: '#EED8B5',
    borderRadius: 10,
    padding: 11,
    gap: 5,
  },
  colPcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  colProsTitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  colConsTitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  colProsText: {
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkPrimary,
  },
  colConsText: {
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkSecondary,
  },
});
