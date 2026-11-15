import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Flag,
  Globe,
  GraduationCap,
  Minus,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';
import { ALL_CARDS, CALC_META } from '../lib/data';
import {
  formatFeeDisplay,
  formatInr,
  matchesTokenizedQuery,
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
} from '../lib/format';
import { analyzeOwnedPortfolio } from '../lib/myCardsEngine';
import { generateMyCardsAiSummary } from '../lib/aiSuggestions';
import { parseCardLoungeAndGolfQuotas } from '../lib/loungeChecker';
import { LedgerTheme } from '../lib/theme';
import { BankLogo } from '../components/BankLogo';
import { CardArtwork } from '../components/CardArtwork';
import {
  NativeHorizontalBarChart,
  NativeUtilizationChart,
  NativeValueBreakdownChart,
} from '../components/AnalyticsCharts';
import {
  AnimatedReveal,
  CalmEntranceView,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../components/MotionPrimitives';
import { useCompare } from '../components/CompareContext';
import type { CardSummaryItem, SpendCategoryKey } from '../lib/types';

const SPEND_PRESETS: Array<{
  id: string;
  label: string;
  spend: Record<SpendCategoryKey, number>;
}> = [
  {
    id: 'everyday',
    label: '₹35k Everyday',
    spend: {
      online_shopping_general: 5000,
      amazon_flipkart_myntra: 5000,
      dining_swiggy_zomato: 4000,
      groceries_quick_commerce: 6000,
      travel_flights_hotels: 0,
      upi_scan_and_pay: 5000,
      utilities_bills_telecom: 4000,
      fuel: 3000,
      insurance: 0,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 3000,
    },
  },
  {
    id: 'urban',
    label: '₹75k Urban',
    spend: {
      online_shopping_general: 12000,
      amazon_flipkart_myntra: 10000,
      dining_swiggy_zomato: 8000,
      groceries_quick_commerce: 12000,
      travel_flights_hotels: 8000,
      upi_scan_and_pay: 7000,
      utilities_bills_telecom: 6000,
      fuel: 4000,
      insurance: 3000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 0,
      offline_general_other: 5000,
    },
  },
  {
    id: 'flyer',
    label: '₹1.5L Travel & Golf',
    spend: {
      online_shopping_general: 22000,
      amazon_flipkart_myntra: 18000,
      dining_swiggy_zomato: 14000,
      groceries_quick_commerce: 14000,
      travel_flights_hotels: 32000,
      upi_scan_and_pay: 10000,
      utilities_bills_telecom: 8000,
      fuel: 5000,
      insurance: 5000,
      education_rent_govt: 0,
      international_forex_net_of_markup: 12000,
      offline_general_other: 10000,
    },
  },
];

function findBestMatch(cards: CardSummaryItem[], patterns: string[]): string | null {
  for (const pat of patterns) {
    const q = pat.toLowerCase();
    const found = cards.find(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.card_id.toLowerCase().includes(q)
    );
    if (found) return found.card_id;
  }
  return null;
}

interface QuotaMeterRowProps {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  used: number;
  total: number | null;
  onDecrement: () => void;
  onIncrement: () => void;
}

function QuotaMeterRow({
  icon,
  label,
  subLabel,
  used,
  total,
  onDecrement,
  onIncrement,
}: QuotaMeterRowProps) {
  const isUnlimited = total === null;
  const remaining = isUnlimited ? null : Math.max(0, total - used);
  const ratio = isUnlimited ? 0 : total > 0 ? Math.min(1, used / total) : 0;

  return (
    <View style={styles.quotaRow}>
      <View style={styles.quotaTop}>
        <View style={styles.quotaLabelRow}>
          {icon}
          <View style={{ flex: 1 }}>
            <Text style={styles.quotaTitle}>{label}</Text>
            <Text style={styles.quotaSub} numberOfLines={1}>
              {subLabel}
            </Text>
          </View>
        </View>

        <View style={styles.stepperGroup}>
          <ScalePressable
            onPress={onDecrement}
            disabled={used <= 0}
            style={[styles.stepperBtn, used <= 0 && styles.stepperBtnDisabled]}
            hitSlop={6}
          >
            <Minus size={13} color={used <= 0 ? LedgerTheme.colors.inkMuted : LedgerTheme.colors.inkPrimary } />
          </ScalePressable>
          <View style={styles.stepperValueBox}>
            <Text style={styles.stepperValue}>
              {isUnlimited ? `${used} used` : `${remaining} left`}
            </Text>
            <Text style={styles.stepperTotal}>
              {isUnlimited ? 'Unlimited' : `${used}/${total} used`}
            </Text>
          </View>
          <ScalePressable
            onPress={onIncrement}
            disabled={!isUnlimited && total !== null && used >= total}
            style={[
              styles.stepperBtn,
              !isUnlimited && total !== null && used >= total && styles.stepperBtnDisabled,
            ]}
            hitSlop={6}
          >
            <Plus
              size={13}
              color={
                !isUnlimited && total !== null && used >= total
                  ? LedgerTheme.colors.inkMuted
                  : LedgerTheme.colors.accent
              }
            />
          </ScalePressable>
        </View>
      </View>

      {!isUnlimited && total > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.round(ratio * 100)}%`,
                backgroundColor:
                  remaining === 0 ? LedgerTheme.colors.warn : LedgerTheme.colors.accent,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

export function MyCardsScreenView() {
  const router = useRouter();
  const {
    ownedIds,
    walletMeta,
    toggleOwned,
    setOwnedIds,
    moveOwnedCard,
    updateWalletMeta,
    incrementUsage,
    resetUsageCycle,
    clearOwned,
  } = useCompare();

  const enrichedCards = useMemo(
    () =>
      ALL_CARDS.map((c) => ({
        ...c,
        fee_waiver_spend_inr:
          c.fee_waiver_spend_inr ?? CALC_META[c.card_id]?.waiver ?? null,
      })),
    []
  );

  const cardById = useMemo(() => {
    const map = new Map<string, CardSummaryItem>();
    for (const c of enrichedCards) map.set(c.card_id, c);
    return map;
  }, [enrichedCards]);

  const [cardSearch, setCardSearch] = useState('');
  const [editingLast4Card, setEditingLast4Card] = useState<CardSummaryItem | null>(null);
  const [last4Draft, setLast4Draft] = useState('');
  const [selectedWalletCard, setSelectedWalletCard] = useState<CardSummaryItem | null>(null);
  const [renewalDraft, setRenewalDraft] = useState('');
  const [detailLast4Draft, setDetailLast4Draft] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [showOptimizer, setShowOptimizer] = useState(false);

  const [spendPresetId, setSpendPresetId] = useState<string>('urban');
  const [monthlySpend, setMonthlySpend] = useState<Record<SpendCategoryKey, number>>(
    () => ({ ...SPEND_PRESETS[1].spend })
  );
  const [spendExpanded, setSpendExpanded] = useState(false);

  const starterStacks = useMemo(() => {
    const travelGolfIds = [
      findBestMatch(enrichedCards, ['infinia metal', 'diners club black', 'regalia gold']),
      findBestMatch(enrichedCards, ['axis bank atlas', 'hsbc travelone']),
      findBestMatch(enrichedCards, ['icici sapphiro', 'scapia']),
    ].filter((id): id is string => Boolean(id));

    const cashbackIds = [
      findBestMatch(enrichedCards, ['cashback sbi']),
      findBestMatch(enrichedCards, ['hsbc live+']),
      findBestMatch(enrichedCards, ['airtel axis', 'amazon pay icici']),
    ].filter((id): id is string => Boolean(id));

    const ltfUpiIds = [
      findBestMatch(enrichedCards, ['amazon pay icici']),
      findBestMatch(enrichedCards, ['tata neu plus', 'kiwi', 'hdfc pixel']),
      findBestMatch(enrichedCards, ['scapia', 'ixigo']),
    ].filter((id): id is string => Boolean(id));

    return [
      { id: 'travel-golf', label: 'Travel & Golf', ids: Array.from(new Set(travelGolfIds)) },
      { id: 'cashback', label: 'Cashback Trio', ids: Array.from(new Set(cashbackIds)) },
      { id: 'ltf', label: 'LTF + UPI', ids: Array.from(new Set(ltfUpiIds)) },
    ].filter((s) => s.ids.length > 0);
  }, [enrichedCards]);

  const ownedCards = useMemo(
    () => ownedIds.map((id) => cardById.get(id)).filter((c): c is CardSummaryItem => Boolean(c)),
    [ownedIds, cardById]
  );

  const searchMatches = useMemo(() => {
    if (!cardSearch.trim()) return [];
    return enrichedCards
      .filter((c) =>
        matchesTokenizedQuery(
          cardSearch,
          c.card_name,
          c.bank,
          c.primary_category,
          c.card_network
        )
      )
      .slice(0, 10);
  }, [enrichedCards, cardSearch]);

  // Compute aggregate remaining domestic lounge, intl lounge, golf rounds & golf lessons
  const walletPerkSummary = useMemo(() => {
    let domRemaining = 0;
    let domTotal = 0;
    let domUnlimited = false;

    let intlRemaining = 0;
    let intlTotal = 0;
    let intlUnlimited = false;

    let golfGamesRemaining = 0;
    let golfGamesTotal = 0;
    let golfGamesUnlimited = false;

    let golfLessonsRemaining = 0;
    let golfLessonsTotal = 0;
    let golfLessonsUnlimited = false;

    const perCard = ownedCards.map((card) => {
      const quota = parseCardLoungeAndGolfQuotas(card);
      const meta = walletMeta[card.card_id] ?? {
        usedDomesticLounge: 0,
        usedInternationalLounge: 0,
        usedGolfGames: 0,
        usedGolfLessons: 0,
      };

      if (quota.domesticEligible) {
        if (quota.domesticTotal === null) {
          domUnlimited = true;
        } else {
          domTotal += quota.domesticTotal;
          domRemaining += Math.max(0, quota.domesticTotal - meta.usedDomesticLounge);
        }
      }
      if (quota.intlEligible) {
        if (quota.intlTotal === null) {
          intlUnlimited = true;
        } else {
          intlTotal += quota.intlTotal;
          intlRemaining += Math.max(0, quota.intlTotal - meta.usedInternationalLounge);
        }
      }
      if (quota.golfEligible) {
        if (quota.golfGamesTotal === null && quota.golfGamesPeriod === 'unlimited') {
          golfGamesUnlimited = true;
        } else if (quota.golfGamesTotal) {
          golfGamesTotal += quota.golfGamesTotal;
          golfGamesRemaining += Math.max(0, quota.golfGamesTotal - meta.usedGolfGames);
        }

        if (quota.golfLessonsTotal === null && quota.golfLessonsPeriod === 'unlimited') {
          golfLessonsUnlimited = true;
        } else if (quota.golfLessonsTotal) {
          golfLessonsTotal += quota.golfLessonsTotal;
          golfLessonsRemaining += Math.max(0, quota.golfLessonsTotal - meta.usedGolfLessons);
        }
      }

      return { card, quota, meta };
    });

    return {
      perCard,
      domRemaining,
      domTotal,
      domUnlimited,
      intlRemaining,
      intlTotal,
      intlUnlimited,
      golfGamesRemaining,
      golfGamesTotal,
      golfGamesUnlimited,
      golfLessonsRemaining,
      golfLessonsTotal,
      golfLessonsUnlimited,
    };
  }, [ownedCards, walletMeta]);

  const analysis = useMemo(
    () =>
      analyzeOwnedPortfolio(enrichedCards, ownedIds, monthlySpend, {
        needDomesticLounge: true,
        needNoSpendLounge: true,
        needInternationalLounge: false,
        needGolf: false,
      }),
    [enrichedCards, ownedIds, monthlySpend]
  );

  const aiSummary = useMemo(() => generateMyCardsAiSummary(analysis), [analysis]);

  const openAddOrEditLast4 = (card: CardSummaryItem) => {
    setEditingLast4Card(card);
    setLast4Draft(walletMeta[card.card_id]?.last4Digits ?? '');
  };

  const openWalletCardDetails = (card: CardSummaryItem) => {
    const m = walletMeta[card.card_id];
    setSelectedWalletCard(card);
    setRenewalDraft(m?.renewalDate ?? '');
    setDetailLast4Draft(m?.last4Digits ?? '');
    setNicknameDraft(m?.nickname ?? '');
  };

  const saveWalletCardDetails = () => {
    if (!selectedWalletCard) return;
    const cleanLast4 = detailLast4Draft.replace(/\D/g, '').slice(0, 4);
    updateWalletMeta(selectedWalletCard.card_id, {
      last4Digits: cleanLast4 || undefined,
      renewalDate: renewalDraft.trim() || undefined,
      nickname: nicknameDraft.trim() || undefined,
    });
    setSelectedWalletCard(null);
  };

  const confirmLast4Modal = () => {
    if (!editingLast4Card) return;
    const clean = last4Draft.replace(/\D/g, '').slice(0, 4);
    if (!ownedIds.includes(editingLast4Card.card_id)) {
      toggleOwned(editingLast4Card.card_id, clean || undefined);
    } else {
      updateWalletMeta(editingLast4Card.card_id, { last4Digits: clean || undefined });
    }
    setEditingLast4Card(null);
    setLast4Draft('');
  };

  const applySpendPreset = (presetId: string) => {
    const found = SPEND_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    triggerCalmLayoutTransition();
    setSpendPresetId(presetId);
    setMonthlySpend({ ...found.spend });
  };

  const stepSpend = (key: SpendCategoryKey, delta: number) => {
    setSpendPresetId('custom');
    const maxInr = SPEND_CATEGORY_META[key].maxInr;
    setMonthlySpend((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(maxInr, (prev[key] || 0) + delta)),
    }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Clean Editorial Header */}
        <View style={styles.heroPanel}>
          <View style={styles.eyebrowRow}>
            <Wallet size={14} color={LedgerTheme.colors.accent} />
            <Text style={styles.eyebrowText}>Personal Card Vault &amp; Perk Tracker</Text>
          </View>
          <Text style={styles.heroTitle}>My Cards &amp; Lounge Tracker</Text>
          <Text style={styles.metaNote}>
            Save your cards with optional last 4 digits (stored locally on this phone only) to track remaining airport lounge visits, golf rounds &amp; coaching lessons.
          </Text>
        </View>

        {/* Summary Quota Banner when owned cards exist */}
        {ownedCards.length > 0 && (
          <AnimatedReveal style={styles.summaryBanner}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Available Wallet Quotas</Text>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  resetUsageCycle();
                }}
                style={styles.resetPill}
                hitSlop={8}
              >
                <RotateCcw size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.resetPillText}>Reset Cycle</Text>
              </ScalePressable>
            </View>

            <View style={styles.kpiGrid}>
              <View style={styles.kpiTile}>
                <View style={styles.kpiIconRow}>
                  <Plane size={15} color={LedgerTheme.colors.accent} />
                  <Text style={styles.kpiLabel}>Domestic Lounge</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {walletPerkSummary.domUnlimited
                    ? 'Unlimited'
                    : `${walletPerkSummary.domRemaining} / ${walletPerkSummary.domTotal}`}
                </Text>
                <Text style={styles.kpiHint}>visits remaining</Text>
              </View>

              <View style={styles.kpiTile}>
                <View style={styles.kpiIconRow}>
                  <Globe size={15} color={LedgerTheme.colors.accent} />
                  <Text style={styles.kpiLabel}>Intl Lounge</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {walletPerkSummary.intlUnlimited
                    ? 'Unlimited'
                    : `${walletPerkSummary.intlRemaining} / ${walletPerkSummary.intlTotal}`}
                </Text>
                <Text style={styles.kpiHint}>visits remaining</Text>
              </View>

              <View style={styles.kpiTile}>
                <View style={styles.kpiIconRow}>
                  <Flag size={15} color={LedgerTheme.colors.accent} />
                  <Text style={styles.kpiLabel}>Golf Games</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {walletPerkSummary.golfGamesUnlimited
                    ? 'Unlimited'
                    : `${walletPerkSummary.golfGamesRemaining} / ${walletPerkSummary.golfGamesTotal}`}
                </Text>
                <Text style={styles.kpiHint}>green-fee rounds</Text>
              </View>

              <View style={styles.kpiTile}>
                <View style={styles.kpiIconRow}>
                  <GraduationCap size={15} color={LedgerTheme.colors.accent} />
                  <Text style={styles.kpiLabel}>Golf Lessons</Text>
                </View>
                <Text style={styles.kpiValue}>
                  {walletPerkSummary.golfLessonsUnlimited
                    ? 'Unlimited'
                    : `${walletPerkSummary.golfLessonsRemaining} / ${walletPerkSummary.golfLessonsTotal}`}
                </Text>
                <Text style={styles.kpiHint}>coaching sessions</Text>
              </View>
            </View>
          </AnimatedReveal>
        )}

        {ownedCards.length > 0 && (
          <View style={{ gap: 14 }}>
            <NativeUtilizationChart
              title="Lounge & Golf Utilization"
              subtitle="Remaining complimentary quota across all saved cards"
              metrics={[
                {
                  id: 'dom',
                  label: 'Domestic Airport Lounges',
                  used: Math.max(0, walletPerkSummary.domTotal - walletPerkSummary.domRemaining),
                  total: walletPerkSummary.domTotal,
                  unlimited: walletPerkSummary.domUnlimited,
                  color: '#0C5B4C',
                },
                {
                  id: 'intl',
                  label: 'International Lounges',
                  used: Math.max(0, walletPerkSummary.intlTotal - walletPerkSummary.intlRemaining),
                  total: walletPerkSummary.intlTotal,
                  unlimited: walletPerkSummary.intlUnlimited,
                  color: '#1D4ED8',
                },
                {
                  id: 'golf_games',
                  label: 'Golf Green Fee Rounds',
                  used: Math.max(0, walletPerkSummary.golfGamesTotal - walletPerkSummary.golfGamesRemaining),
                  total: walletPerkSummary.golfGamesTotal,
                  unlimited: walletPerkSummary.golfGamesUnlimited,
                  color: '#15803D',
                },
                {
                  id: 'golf_lessons',
                  label: 'Golf Coaching Lessons',
                  used: Math.max(0, walletPerkSummary.golfLessonsTotal - walletPerkSummary.golfLessonsRemaining),
                  total: walletPerkSummary.golfLessonsTotal,
                  unlimited: walletPerkSummary.golfLessonsUnlimited,
                  color: '#B45309',
                },
              ]}
            />

            <NativeValueBreakdownChart
              title="Portfolio Annual Value vs. Fees"
              subtitle={`At ${formatInr(analysis.totalMonthlySpendInr)}/mo wallet spend (${analysis.blendedYieldPct.toFixed(1)}% blended yield)`}
              grossInr={analysis.totalCurrentAnnualRewardsInr}
              feeInr={analysis.totalCurrentFeesInr}
              netInr={analysis.netCurrentAnnualValueInr}
            />

            {analysis.cardAudits.length > 0 && (
              <NativeHorizontalBarChart
                title="Net Attributed Value by Card"
                subtitle="Annual reward value minus annual fee across your saved cards"
                data={analysis.cardAudits.map((audit) => ({
                  id: audit.card.card_id,
                  label: audit.card.card_name,
                  sublabel: `${audit.card.bank} · ${audit.primaryCategories.slice(0, 2).join(', ') || 'Backup role'}`,
                  value: Math.round(audit.netAttributedValueInr),
                  displayValue: formatInr(audit.netAttributedValueInr),
                  onPress: () =>
                    router.push(`/card/${audit.card.bank_slug}/${audit.card.card_slug}`),
                }))}
              />
            )}
          </View>
        )}

        {/* Section 1: Add from 506-Card Portfolio */}
        <View style={styles.panel}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleAccent} />
            <Text style={styles.sectionTitle}>Add Cards to Your Vault</Text>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={cardSearch}
              onChangeText={setCardSearch}
              placeholder="Search from 506 cards (e.g. Infinia, HSBC Live+, SBI Cashback)..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.searchInput}
            />
            {cardSearch.length > 0 && (
              <ScalePressable onPress={() => setCardSearch('')} hitSlop={8}>
                <X size={16} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            )}
          </View>

          {searchMatches.length > 0 && (
            <AnimatedReveal style={styles.searchResultsBox}>
              {searchMatches.map((card) => {
                const added = ownedIds.includes(card.card_id);
                return (
                  <View key={card.card_id} style={styles.searchRow}>
                    <ScalePressable
                      onPress={() =>
                        router.push(`/card/${card.bank_slug}/${card.card_slug}`)
                      }
                      style={styles.searchLeft}
                    >
                      <CardArtwork
                        localImagePath={card.local_image_path}
                        bank={card.bank}
                        cardName={card.card_name}
                        network={card.card_network}
                        size="sm"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.searchCardName} numberOfLines={1}>
                          {card.card_name}
                        </Text>
                        <Text style={styles.searchCardMeta} numberOfLines={1}>
                          {card.bank} · {card.annual_fee_inr === 0 ? '₹0 LTF' : formatInr(card.annual_fee_inr)}
                        </Text>
                      </View>
                    </ScalePressable>

                    <ScalePressable
                      onPress={() => {
                        triggerCalmLayoutTransition();
                        if (added) {
                          toggleOwned(card.card_id);
                        } else {
                          openAddOrEditLast4(card);
                        }
                      }}
                      style={[styles.addBtn, added && styles.addBtnActive]}
                    >
                      {added ? (
                        <Check size={13} color="#FFFFFF" />
                      ) : (
                        <Plus size={13} color={LedgerTheme.colors.accent} />
                      )}
                      <Text style={[styles.addBtnText, added && { color: '#FFFFFF' }]}>
                        {added ? 'Saved' : 'Add Card'}
                      </Text>
                    </ScalePressable>
                  </View>
                );
              })}
            </AnimatedReveal>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.starterRow}
          >
            {starterStacks.map((stack) => (
              <ScalePressable
                key={stack.id}
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setOwnedIds(stack.ids);
                }}
                style={styles.starterBtn}
              >
                <Sparkles size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.starterBtnText}>Load {stack.label}</Text>
              </ScalePressable>
            ))}
          </ScrollView>
        </View>

        {/* Section 2: Saved Card Portfolio with Last-4 & Lounge/Golf Utilization */}
        {ownedCards.length === 0 ? (
          <View style={styles.emptyPanel}>
            <CreditCard size={34} color={LedgerTheme.colors.accent} />
            <Text style={styles.emptyTitle}>No Cards Saved Yet</Text>
            <Text style={styles.emptyBody}>
              Search above or tap a quick starter stack to track your domestic/international lounge visits, golf rounds &amp; coaching sessions.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={styles.rowBetween}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleAccent} />
                <Text style={styles.sectionTitle}>
                  Saved Cards ({ownedCards.length})
                </Text>
              </View>
              <ScalePressable onPress={clearOwned} hitSlop={8} style={styles.clearBtn}>
                <Trash2 size={13} color={LedgerTheme.colors.danger} />
                <Text style={styles.clearText}>Clear All</Text>
              </ScalePressable>
            </View>

            {walletPerkSummary.perCard.map(({ card, quota, meta }, idx) => {
              const feeInfo = formatFeeDisplay(card.joining_fee_inr, card.annual_fee_inr);
              return (
              <CalmEntranceView key={card.card_id} delayMs={idx * 40} style={styles.walletCard}>
                {/* Card Identity Header */}
                <View style={styles.walletHeaderRow}>
                  <ScalePressable
                    onPress={() => openWalletCardDetails(card)}
                    style={styles.walletIdentityTouch}
                  >
                    <CardArtwork
                      localImagePath={card.local_image_path}
                      bank={card.bank}
                      cardName={card.card_name}
                      network={card.card_network}
                      size="sm"
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.bankTinyRow}>
                        <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                        <Text style={styles.walletBankLabel} numberOfLines={1}>
                          {card.bank}
                          {meta.nickname ? ` · ${meta.nickname}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.walletCardTitle} numberOfLines={2}>
                        {card.card_name}
                      </Text>
                      <Text style={styles.walletFeeMeta} numberOfLines={1}>
                        {feeInfo.primaryText}
                      </Text>
                      <View style={styles.tagRow}>
                        <ScalePressable
                          onPress={() => openWalletCardDetails(card)}
                          style={styles.last4Badge}
                        >
                          <Text style={styles.last4Text}>
                            {meta.last4Digits ? `•••• ${meta.last4Digits}` : '+ Last 4'}
                          </Text>
                          <Pencil size={10} color={LedgerTheme.colors.accent} />
                        </ScalePressable>

                        <ScalePressable
                          onPress={() => openWalletCardDetails(card)}
                          style={styles.renewalBadge}
                        >
                          <Calendar size={10} color={LedgerTheme.colors.inkSecondary} />
                          <Text style={styles.renewalBadgeText}>
                            {meta.renewalDate ? `Renews ${meta.renewalDate}` : '+ Renewal Date'}
                          </Text>
                        </ScalePressable>

                        {quota.domesticEligible && (
                          <View
                            style={[
                              styles.gateBadge,
                              quota.noSpendDomestic ? styles.gateBadgeGreen : styles.gateBadgeWarn,
                            ]}
                          >
                            <Text
                              style={[
                                styles.gateBadgeText,
                                {
                                  color: quota.noSpendDomestic
                                    ? LedgerTheme.colors.accent
                                    : LedgerTheme.colors.warn,
                                },
                              ]}
                            >
                              {quota.noSpendDomestic ? 'No-Spend Lounge' : 'Spend-Gated'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </ScalePressable>

                  <View style={styles.cardActionColumn}>
                    <View style={styles.reorderGroup}>
                      <ScalePressable
                        disabled={idx === 0}
                        onPress={() => {
                          triggerCalmLayoutTransition();
                          moveOwnedCard(card.card_id, 'up');
                        }}
                        hitSlop={4}
                        style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                      >
                        <ArrowUp size={13} color={LedgerTheme.colors.inkPrimary} />
                      </ScalePressable>
                      <ScalePressable
                        disabled={idx === walletPerkSummary.perCard.length - 1}
                        onPress={() => {
                          triggerCalmLayoutTransition();
                          moveOwnedCard(card.card_id, 'down');
                        }}
                        hitSlop={4}
                        style={[
                          styles.reorderBtn,
                          idx === walletPerkSummary.perCard.length - 1 && styles.reorderBtnDisabled,
                        ]}
                      >
                        <ArrowDown size={13} color={LedgerTheme.colors.inkPrimary} />
                      </ScalePressable>
                    </View>
                    <ScalePressable
                      onPress={() => {
                        triggerCalmLayoutTransition();
                        toggleOwned(card.card_id);
                      }}
                      hitSlop={8}
                      style={styles.removeCardBtn}
                    >
                      <X size={16} color={LedgerTheme.colors.inkMuted} />
                    </ScalePressable>
                  </View>
                </View>

                {quota.spendConditionText && !quota.noSpendDomestic && (
                  <View style={styles.spendAlertBox}>
                    <AlertTriangle size={13} color={LedgerTheme.colors.warn} />
                    <Text style={styles.spendAlertText}>{quota.spendConditionText}</Text>
                  </View>
                )}

                {/* Per-Card Lounge & Golf Utilization Steppers */}
                <View style={styles.quotaList}>
                  {quota.domesticEligible && (
                    <QuotaMeterRow
                      icon={<Plane size={15} color={LedgerTheme.colors.accent} />}
                      label={`Domestic Lounge (${quota.domesticPeriod === 'unlimited' ? 'Unlimited' : `per ${quota.domesticPeriod}`})`}
                      subLabel={quota.domesticText}
                      used={meta.usedDomesticLounge}
                      total={quota.domesticTotal}
                      onDecrement={() => incrementUsage(card.card_id, 'usedDomesticLounge', -1)}
                      onIncrement={() => incrementUsage(card.card_id, 'usedDomesticLounge', 1)}
                    />
                  )}

                  {quota.intlEligible && (
                    <QuotaMeterRow
                      icon={<Globe size={15} color={LedgerTheme.colors.accent} />}
                      label={`International Lounge (${quota.intlPeriod === 'unlimited' ? 'Unlimited' : `per ${quota.intlPeriod}`})`}
                      subLabel={quota.intlText}
                      used={meta.usedInternationalLounge}
                      total={quota.intlTotal}
                      onDecrement={() => incrementUsage(card.card_id, 'usedInternationalLounge', -1)}
                      onIncrement={() => incrementUsage(card.card_id, 'usedInternationalLounge', 1)}
                    />
                  )}

                  {quota.golfEligible && quota.golfGamesPeriod !== 'none' && (
                    <QuotaMeterRow
                      icon={<Flag size={15} color={LedgerTheme.colors.accent} />}
                      label={`Golf Rounds (${quota.golfGamesPeriod === 'unlimited' ? 'Unlimited' : `per ${quota.golfGamesPeriod}`})`}
                      subLabel={quota.golfSummaryText}
                      used={meta.usedGolfGames}
                      total={quota.golfGamesTotal}
                      onDecrement={() => incrementUsage(card.card_id, 'usedGolfGames', -1)}
                      onIncrement={() => incrementUsage(card.card_id, 'usedGolfGames', 1)}
                    />
                  )}

                  {quota.golfEligible && quota.golfLessonsPeriod !== 'none' && (
                    <QuotaMeterRow
                      icon={<GraduationCap size={15} color={LedgerTheme.colors.accent} />}
                      label={`Golf Coaching Lessons (${quota.golfLessonsPeriod === 'unlimited' ? 'Unlimited' : `per ${quota.golfLessonsPeriod}`})`}
                      subLabel="Book via network concierge 4–7 days prior"
                      used={meta.usedGolfLessons}
                      total={quota.golfLessonsTotal}
                      onDecrement={() => incrementUsage(card.card_id, 'usedGolfLessons', -1)}
                      onIncrement={() => incrementUsage(card.card_id, 'usedGolfLessons', 1)}
                    />
                  )}

                  {!quota.domesticEligible && !quota.intlEligible && !quota.golfEligible && (
                    <Text style={styles.noPerksNote}>
                      Cashback / retail card — no complimentary airport lounge or golf quota on file.
                    </Text>
                  )}
                </View>

                <View style={styles.cardFooterRow}>
                  <ScalePressable
                    onPress={() => openWalletCardDetails(card)}
                    style={styles.cardDetailLink}
                  >
                    <Text style={styles.cardDetailLinkText}>Fee &amp; Renewal</Text>
                    <Pencil size={12} color={LedgerTheme.colors.accent} />
                  </ScalePressable>

                  <ScalePressable
                    onPress={() =>
                      router.push(`/(tabs)/lounges?card=${encodeURIComponent(card.card_id)}` as never)
                    }
                    style={styles.cardDetailLink}
                  >
                    <Text style={styles.cardDetailLinkText}>Check Airports &amp; Golf</Text>
                    <ArrowRight size={13} color={LedgerTheme.colors.accent} />
                  </ScalePressable>
                </View>
              </CalmEntranceView>
              );
            })}

            {/* Collapsible Spend & Reward Optimizer */}
            <View style={styles.panel}>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setShowOptimizer((v) => !v);
                }}
                style={styles.rowBetween}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleAccent} />
                    <Text style={styles.sectionTitle}>Wallet Spend &amp; Swipe Hacks</Text>
                  </View>
                  <Text style={styles.metaNote}>
                    Est. {formatInr(analysis.netCurrentAnnualValueInr)}/yr net yield ({analysis.blendedYieldPct.toFixed(1)}%)
                  </Text>
                </View>
                {showOptimizer ? (
                  <ChevronUp size={18} color={LedgerTheme.colors.inkPrimary } />
                ) : (
                  <ChevronDown size={18} color={LedgerTheme.colors.inkPrimary } />
                )}
              </ScalePressable>

              {showOptimizer && (
                <AnimatedReveal style={{ gap: 14, marginTop: 8 }}>
                  {aiSummary && (
                    <View style={styles.aiInsightCard}>
                      <Text style={styles.aiHeadline}>{aiSummary.healthBadge}</Text>
                      <Text style={styles.aiVerdict}>{aiSummary.headline}</Text>
                      {aiSummary.actionItems.slice(0, 3).map((tip, i) => (
                        <Text key={i} style={styles.aiTip}>
                          • {tip}
                        </Text>
                      ))}
                    </View>
                  )}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.starterRow}
                  >
                    {SPEND_PRESETS.map((p) => {
                      const active = spendPresetId === p.id;
                      return (
                        <ScalePressable
                          key={p.id}
                          onPress={() => applySpendPreset(p.id)}
                          style={[styles.presetBtn, active && styles.presetBtnActive]}
                        >
                          <Text style={[styles.presetText, active && { color: '#FFFFFF' }]}>
                            {p.label}
                          </Text>
                        </ScalePressable>
                      );
                    })}
                    <ScalePressable
                      onPress={() => setSpendExpanded((v) => !v)}
                      style={styles.presetBtn}
                    >
                      <Text style={styles.presetText}>
                        {spendExpanded ? 'Hide Sliders' : 'Edit Monthly Spends'}
                      </Text>
                    </ScalePressable>
                  </ScrollView>

                  {spendExpanded && (
                    <View style={{ gap: 10 }}>
                      {SPEND_CATEGORY_KEYS.map((key) => (
                        <View key={key} style={styles.spendRow}>
                          <Text style={styles.spendLabel}>{SPEND_CATEGORY_META[key].label}</Text>
                          <View style={styles.spendStepper}>
                            <ScalePressable
                              onPress={() => stepSpend(key, -1000)}
                              style={styles.stepperBtn}
                            >
                              <Minus size={12} color={LedgerTheme.colors.inkPrimary } />
                            </ScalePressable>
                            <Text style={styles.spendAmount}>{formatInr(monthlySpend[key] || 0)}</Text>
                            <ScalePressable
                              onPress={() => stepSpend(key, 1000)}
                              style={styles.stepperBtn}
                            >
                              <Plus size={12} color={LedgerTheme.colors.accent} />
                            </ScalePressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Top 6 category winning card assignments */}
                  <View style={{ gap: 10 }}>
                    {analysis.matrixRows.slice(0, 6).map((row) => (
                      <View key={row.key} style={styles.swipeRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.swipeCat}>{row.label}</Text>
                          <Text style={styles.swipeCard}>
                            Use {row.bestCard?.card_name ?? 'No optimal card'} ({row.bestEffectivePct.toFixed(1)}%)
                          </Text>
                        </View>
                        <Text style={styles.swipeAnnual}>
                          +{formatInr(row.annualRewardInr)}/yr
                        </Text>
                      </View>
                    ))}
                  </View>
                </AnimatedReveal>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Saved Card Personal Details Modal (Annual Fee, Date of Renewal, Check Airport & Golf) */}
      <Modal
        visible={Boolean(selectedWalletCard)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedWalletCard(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelectedWalletCard(null)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {selectedWalletCard && (() => {
              const feeInfo = formatFeeDisplay(
                selectedWalletCard.joining_fee_inr,
                selectedWalletCard.annual_fee_inr
              );
              return (
                <>
                  <View style={styles.rowBetween}>
                    <Text style={styles.modalTitle}>Card Details &amp; Renewal</Text>
                    <ScalePressable onPress={() => setSelectedWalletCard(null)} hitSlop={8}>
                      <X size={18} color={LedgerTheme.colors.inkMuted} />
                    </ScalePressable>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <CardArtwork
                      localImagePath={selectedWalletCard.local_image_path}
                      bank={selectedWalletCard.bank}
                      cardName={selectedWalletCard.card_name}
                      network={selectedWalletCard.card_network}
                      size="sm"
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.modalSub}>{selectedWalletCard.card_name}</Text>
                      <Text style={styles.modalHint}>
                        {selectedWalletCard.bank} · {selectedWalletCard.card_network}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailStatsRow}>
                    <View style={styles.detailStatBox}>
                      <Text style={styles.detailStatLabel}>
                        {feeInfo.isSplit ? 'Joining Fee' : 'Joining / Card Fee'}
                      </Text>
                      <Text style={styles.detailStatVal}>{feeInfo.joiningText}</Text>
                    </View>
                    {feeInfo.isSplit && (
                      <View style={styles.detailStatBox}>
                        <Text style={styles.detailStatLabel}>Annual Renewal Fee</Text>
                        <Text style={styles.detailStatVal}>{feeInfo.annualText}</Text>
                      </View>
                    )}
                    <View style={styles.detailStatBox}>
                      <Text style={styles.detailStatLabel}>Indian Lounges</Text>
                      <Text style={styles.detailStatVal}>
                        {selectedWalletCard.domestic_lounge_accessible_count ??
                          selectedWalletCard.accessible_lounge_codes?.length ??
                          0}{' '}
                        verified
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text style={styles.inputFieldLabel}>Date of Renewal (e.g. 15 Nov 2026)</Text>
                    <TextInput
                      value={renewalDraft}
                      onChangeText={setRenewalDraft}
                      placeholder="DD MMM YYYY (e.g. 15 Nov 2026)"
                      placeholderTextColor={LedgerTheme.colors.inkMuted}
                      style={styles.detailInput}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.inputFieldLabel}>Last 4 Digits</Text>
                        <TextInput
                          value={detailLast4Draft}
                          onChangeText={(txt) =>
                            setDetailLast4Draft(txt.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="4821"
                          placeholderTextColor={LedgerTheme.colors.inkMuted}
                          keyboardType="number-pad"
                          maxLength={4}
                          style={styles.detailInput}
                        />
                      </View>
                      <View style={{ flex: 1.5, gap: 4 }}>
                        <Text style={styles.inputFieldLabel}>Card Nickname</Text>
                        <TextInput
                          value={nicknameDraft}
                          onChangeText={setNicknameDraft}
                          placeholder="Personal / Add-on"
                          placeholderTextColor={LedgerTheme.colors.inkMuted}
                          style={styles.detailInput}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={{ gap: 8, marginTop: 2 }}>
                    <ScalePressable
                      onPress={() => {
                        const targetId = selectedWalletCard.card_id;
                        saveWalletCardDetails();
                        router.push(
                          `/(tabs)/lounges?card=${encodeURIComponent(targetId)}` as never
                        );
                      }}
                      style={styles.modalPrimaryActionBtn}
                    >
                      <Plane size={15} color="#FFFFFF" />
                      <Text style={styles.modalSaveText}>Check Airport &amp; Golf for This Card</Text>
                    </ScalePressable>

                    <View style={styles.modalActions}>
                      <ScalePressable
                        onPress={() => {
                          const bSlug = selectedWalletCard.bank_slug;
                          const cSlug = selectedWalletCard.card_slug;
                          saveWalletCardDetails();
                          router.push(`/card/${bSlug}/${cSlug}`);
                        }}
                        style={styles.modalCancelBtn}
                      >
                        <Text style={styles.modalCancelText}>Full Card Dossier →</Text>
                      </ScalePressable>
                      <ScalePressable
                        onPress={saveWalletCardDetails}
                        style={styles.modalSaveBtn}
                      >
                        <Text style={styles.modalSaveText}>Save Details</Text>
                      </ScalePressable>
                    </View>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Optional Last 4 Digits Modal */}
      <Modal
        visible={Boolean(editingLast4Card)}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingLast4Card(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setEditingLast4Card(null)}
        >
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Optional Card Tag</Text>
              <ScalePressable onPress={() => setEditingLast4Card(null)} hitSlop={8}>
                <X size={18} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            </View>
            <Text style={styles.modalSub}>
              {editingLast4Card?.card_name}
            </Text>
            <Text style={styles.modalHint}>
              Enter optional last 4 digits (e.g. 4821) to tell duplicate family cards apart. Stored on this device only — never enter your full card number or CVV.
            </Text>
            <TextInput
              value={last4Draft}
              onChangeText={(txt) => setLast4Draft(txt.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 4821 (optional)"
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              keyboardType="number-pad"
              maxLength={4}
              style={styles.last4Input}
              autoFocus
            />
            <View style={styles.modalActions}>
              <ScalePressable
                onPress={() => setEditingLast4Card(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </ScalePressable>
              <ScalePressable
                onPress={confirmLast4Modal}
                style={styles.modalSaveBtn}
              >
                <Text style={styles.modalSaveText}>Save to My Cards</Text>
              </ScalePressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  content: {
    padding: 18,
    gap: 20,
    paddingBottom: 44,
  },
  heroPanel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 20,
    gap: 8,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.3,
  },
  metaNote: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  summaryBanner: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 18,
    gap: 14,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
    gap: 4,
  },
  kpiIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  kpiValue: {
    fontSize: 19,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
  },
  kpiHint: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  resetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  panel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 18,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: LedgerTheme.colors.accent,
  },
  sectionTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 0,
  },
  searchResultsBox: {
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    gap: 10,
  },
  searchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  searchCardName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  searchCardMeta: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
  },
  addBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  starterRow: { gap: 8, paddingVertical: 2 },
  starterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  starterBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  emptyPanel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  emptyBody: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.danger,
  },
  walletCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 18,
    gap: 14,
  },
  walletHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  walletIdentityTouch: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  bankTinyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletBankLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  walletCardTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 22,
  },
  walletFeeMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  renewalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  renewalBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  cardActionColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  reorderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.35,
  },
  last4Badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  last4Text: {
    fontSize: 12,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  gateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  gateBadgeGreen: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  gateBadgeWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  gateBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  removeCardBtn: {
    padding: 4,
  },
  spendAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: 10,
    padding: 10,
  },
  spendAlertText: {
    flex: 1,
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    lineHeight: 18,
  },
  quotaList: {
    gap: 10,
  },
  quotaRow: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
    gap: 8,
  },
  quotaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  quotaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  quotaTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  quotaSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 1,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.45,
  },
  stepperValueBox: {
    minWidth: 58,
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  stepperTotal: {
    fontSize: 10.5,
    color: LedgerTheme.colors.inkMuted,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: LedgerTheme.colors.hairline,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  noPerksNote: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    fontStyle: 'italic',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    paddingTop: 12,
  },
  cardDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDetailLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  aiInsightCard: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  aiHeadline: {
    fontSize: 14.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  aiVerdict: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 19,
  },
  aiTip: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 18,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  presetBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  spendLabel: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
    flex: 1,
  },
  spendStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spendAmount: {
    minWidth: 68,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  swipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  swipeCat: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  swipeCard: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
  swipeAnnual: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    padding: 22,
  },
  modalSheet: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalSub: {
    fontSize: 14,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  modalHint: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 18,
  },
  last4Input: {
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairlineStrong,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: LedgerTheme.colors.inkPrimary,
    textAlign: 'center',
  },
  detailStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailStatBox: {
    flex: 1,
    minWidth: 95,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  detailStatLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkMuted,
  },
  detailStatVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  inputFieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  detailInput: {
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairlineStrong,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalPrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1A1D21',
    borderRadius: 11,
    paddingVertical: 11,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  modalSaveBtn: {
    flex: 2,
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
