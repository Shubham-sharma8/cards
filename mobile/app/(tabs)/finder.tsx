import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Flag,
  Maximize2,
  Search,
  Share2,
  SlidersHorizontal,
  Wallet,
  X,
} from 'lucide-react-native';
import { ALL_BANKS, ALL_CARDS, getAdvisorMetaMap } from '../../src/lib/data';
import { CATEGORY_OPTIONS } from '../../src/lib/advisor';
import { getCategoryStudyTable } from '../../src/lib/categoryStudies';
import {
  CONVERSION_STRATEGIES,
  cardSupportsStrategy,
  computePersonalizedDirectoryScore,
  getCardConversionKeywords,
  normalizeMinMonthlyIncomeInr,
} from '../../src/lib/conversion';
import { matchesTokenizedQuery } from '../../src/lib/format';
import { LedgerTheme } from '../../src/lib/theme';
import { BankLogo } from '../../src/components/BankLogo';
import { CanvaFeatureIcon, resolveCategoryCanvaIcon } from '../../src/components/FeatureIcon';
import { LedgerCardItem } from '../../src/components/LedgerCardItem';
import {
  AnimatedReveal,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../../src/components/MotionPrimitives';
import { useCompare } from '../../src/components/CompareContext';
import type { CardSummaryItem, RewardConversionStrategy } from '../../src/lib/types';

function getPeakReturnPct(card: CardSummaryItem): number {
  let max = 0;
  for (const [k, v] of Object.entries(card.effective_return_pct_by_category || {})) {
    if (k === 'international_forex_net_of_markup') continue;
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}

export default function FinderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    bankSlug?: string;
    cat?: string;
    golf?: string;
    income?: string;
    strategy?: string;
  }>();
  const { savedIds, ownedIds } = useCompare();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [ltfOnly, setLtfOnly] = useState(false);
  const [upiOnly, setUpiOnly] = useState(false);
  const [noSpendLoungeOnly, setNoSpendLoungeOnly] = useState(false);
  const [golfOnly, setGolfOnly] = useState(false);
  const [zeroForexOnly, setZeroForexOnly] = useState(false);
  const [fdOnly, setFdOnly] = useState(false);
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [incomeFilter, setIncomeFilter] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<RewardConversionStrategy>('default_inr');
  const [bankSlug, setBankSlug] = useState('all');
  const [sortBy, setSortBy] = useState<'rating' | 'personalized' | 'fee_asc' | 'peak_pct'>('rating');
  const [studyOpen, setStudyOpen] = useState(false);
  const [studySheetModalOpen, setStudySheetModalOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  useEffect(() => {
    if (params.income) {
      const parsed = Number(params.income);
      if (Number.isFinite(parsed) && parsed >= 25000) {
        setIncomeFilter(parsed);
        setSortBy('personalized');
      }
    }
    if (
      params.strategy &&
      ['default_inr', 'cash_statement', 'air_miles', 'accor_all'].includes(params.strategy)
    ) {
      setStrategy(params.strategy as RewardConversionStrategy);
      if (params.strategy !== 'default_inr') setSortBy('personalized');
    }
  }, [params.income, params.strategy]);

  useEffect(() => {
    if (params.bankSlug && typeof params.bankSlug === 'string') {
      setBankSlug(params.bankSlug);
    }
  }, [params.bankSlug]);

  useEffect(() => {
    if (params.cat && typeof params.cat === 'string') {
      setSelectedCategory(params.cat);
    }
  }, [params.cat]);

  useEffect(() => {
    if (params.golf === '1') {
      setGolfOnly(true);
    }
  }, [params.golf]);

  const topBanks = useMemo(
    () => [...ALL_BANKS].sort((a, b) => b.total_cards - a.total_cards),
    []
  );

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const activeCategoryStudy = useMemo(() => {
    if (selectedCategory === 'all') return null;
    const opt = CATEGORY_OPTIONS.find((o) => o.datasetCategory === selectedCategory);
    if (!opt) return null;
    return getCategoryStudyTable(opt.id, ALL_CARDS, getAdvisorMetaMap());
  }, [selectedCategory]);

  const handleShareStudy = async () => {
    if (!activeCategoryStudy) return;
    const header = `${activeCategoryStudy.title}\n${activeCategoryStudy.subtitle}\nColumns: Card (Bank) | Fee | ${activeCategoryStudy.columns.join(' | ')}`;
    const body = activeCategoryStudy.rows
      .map(
        (r, i) =>
          `${i + 1}. ${r.cardName} (${r.bank}) · ${r.annualFee}\n   ${activeCategoryStudy.columns
            .map((c, idx) => `${c}: ${r.cells[idx] || '—'}`)
            .join(' | ')}`
      )
      .join('\n');
    try {
      await Share.share({
        title: activeCategoryStudy.title,
        message: `${header}\n\n${body}\n\n— CardLedger India Live Database`,
      });
    } catch {
      // ignore cancelled share
    }
  };

  const filtered = useMemo(() => {
    return ALL_CARDS.filter((c) => {
      if (bankSlug !== 'all' && c.bank_slug !== bankSlug) return false;
      if (
        selectedCategory !== 'all' &&
        c.primary_category !== selectedCategory &&
        !c.categories.includes(selectedCategory)
      ) {
        return false;
      }
      if (savedOnly && !savedSet.has(c.card_id)) return false;
      if (ownedOnly && !ownedSet.has(c.card_id)) return false;

      const t = c.filter_tags;
      if (ltfOnly && !t.is_ltf) return false;
      if (upiOnly && !t.is_rupay_upi) return false;
      if (noSpendLoungeOnly && !t.no_spend_domestic_lounge) return false;
      if (golfOnly && !t.has_golf && !c.categories.includes('Golf')) return false;
      if (zeroForexOnly && !t.zero_or_low_forex) return false;
      if (fdOnly && !t.is_fd_backed) return false;
      if (
        partnerOnly &&
        !cardSupportsStrategy(c.card_id, 'accor_all') &&
        !cardSupportsStrategy(c.card_id, 'air_miles')
      ) {
        return false;
      }
      if (
        premiumOnly &&
        !t.is_invite_only &&
        c.annual_fee_inr < 10000 &&
        !/super-?premium|metal|private|luxury/i.test(c.card_tier || '')
      ) {
        return false;
      }
      if (incomeFilter !== null) {
        const minInc = normalizeMinMonthlyIncomeInr(c, t.min_income_salaried_inr);
        if (minInc !== null && minInc > incomeFilter && !t.is_fd_backed) return false;
      }
      if (
        query.trim() &&
        !matchesTokenizedQuery(
          query,
          c.card_name,
          c.bank,
          c.primary_category,
          c.categories,
          t.best_for_tags,
          t.requirement_keywords,
          getCardConversionKeywords(c.card_id)
        )
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'personalized') {
        const sa = computePersonalizedDirectoryScore(a, {
          monthlyIncomeInr: incomeFilter,
          strategy,
        }).score;
        const sb = computePersonalizedDirectoryScore(b, {
          monthlyIncomeInr: incomeFilter,
          strategy,
        }).score;
        return sb - sa || b.overall_rating - a.overall_rating;
      }
      if (sortBy === 'fee_asc') {
        if (a.annual_fee_inr !== b.annual_fee_inr) return a.annual_fee_inr - b.annual_fee_inr;
        return b.overall_rating - a.overall_rating;
      }
      if (sortBy === 'peak_pct') {
        const diff = getPeakReturnPct(b) - getPeakReturnPct(a);
        if (Math.abs(diff) > 0.05) return diff;
        return b.overall_rating - a.overall_rating;
      }
      return b.overall_rating - a.overall_rating;
    });
  }, [
    query,
    selectedCategory,
    savedOnly,
    savedSet,
    ownedOnly,
    ownedSet,
    ltfOnly,
    upiOnly,
    noSpendLoungeOnly,
    golfOnly,
    zeroForexOnly,
    fdOnly,
    partnerOnly,
    premiumOnly,
    incomeFilter,
    strategy,
    bankSlug,
    sortBy,
  ]);

  const openCard = (card: CardSummaryItem) => {
    router.push({
      pathname: '/card/[bankSlug]/[cardSlug]',
      params: { bankSlug: card.bank_slug, cardSlug: card.card_slug },
    });
  };

  const togglePills = [
    {
      label: 'LTF',
      active: ltfOnly,
      onPress: () => setLtfOnly((v) => !v),
    },
    {
      label: 'RuPay UPI',
      active: upiOnly,
      onPress: () => setUpiOnly((v) => !v),
    },
    {
      label: 'No-Spend Lounge',
      active: noSpendLoungeOnly,
      onPress: () => setNoSpendLoungeOnly((v) => !v),
    },
    {
      label: 'Golf',
      active: golfOnly,
      onPress: () => setGolfOnly((v) => !v),
    },
    {
      label: 'Zero/Low Forex',
      active: zeroForexOnly,
      onPress: () => setZeroForexOnly((v) => !v),
    },
    {
      label: 'FD-Backed',
      active: fdOnly,
      onPress: () => setFdOnly((v) => !v),
    },
    {
      label: 'Air Miles/Accor',
      active: partnerOnly,
      onPress: () => setPartnerOnly((v) => !v),
    },
    {
      label: 'Premium Tier',
      active: premiumOnly,
      onPress: () => setPremiumOnly((v) => !v),
    },
  ];

  const hasFilters =
    ltfOnly ||
    upiOnly ||
    noSpendLoungeOnly ||
    golfOnly ||
    zeroForexOnly ||
    fdOnly ||
    partnerOnly ||
    premiumOnly ||
    incomeFilter !== null ||
    strategy !== 'default_inr' ||
    savedOnly ||
    ownedOnly ||
    selectedCategory !== 'all' ||
    bankSlug !== 'all' ||
    query.trim() !== '';

  const cycleSort = () => {
    setSortBy((s) =>
      s === 'rating'
        ? 'personalized'
        : s === 'personalized'
          ? 'fee_asc'
          : s === 'fee_asc'
            ? 'peak_pct'
            : 'rating'
    );
  };

  const resetAllFilters = () => {
    setQuery('');
    setSelectedCategory('all');
    setSavedOnly(false);
    setOwnedOnly(false);
    setLtfOnly(false);
    setUpiOnly(false);
    setNoSpendLoungeOnly(false);
    setGolfOnly(false);
    setZeroForexOnly(false);
    setFdOnly(false);
    setPartnerOnly(false);
    setPremiumOnly(false);
    setIncomeFilter(null);
    setStrategy('default_inr');
    setBankSlug('all');
  };

  const sortLabel =
    sortBy === 'personalized'
      ? 'Sort: For You'
      : sortBy === 'rating'
        ? 'Sort: Rating'
        : sortBy === 'fee_asc'
          ? 'Sort: Lowest Fee'
          : 'Sort: Peak Return';

  return (
    <View style={styles.container}>
      {/* Sticky Filter Header */}
      <View style={styles.controlsBox}>
        <View style={styles.searchRow}>
          <Search size={17} color={LedgerTheme.colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by card name, bank, or perk..."
            placeholderTextColor={LedgerTheme.colors.inkMuted}
            style={styles.searchInput}
          />
          {query.length > 0 && (
            <ScalePressable
              onPress={() => setQuery('')}
              hitSlop={8}
            >
              <X size={16} color={LedgerTheme.colors.inkMuted} />
            </ScalePressable>
          )}
        </View>

        {/* Category Filter Chips (13 Verticals) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <ScalePressable
            onPress={() => setSelectedCategory('all')}
            style={[styles.pill, selectedCategory === 'all' && styles.pillActive]}
          >
            <Text style={[styles.pillText, selectedCategory === 'all' && styles.pillTextActive]}>
              All Categories
            </Text>
          </ScalePressable>
          {CATEGORY_OPTIONS.map((opt) => {
            const active = selectedCategory === opt.datasetCategory;
            return (
              <ScalePressable
                key={opt.id}
                onPress={() => setSelectedCategory(active ? 'all' : opt.datasetCategory)}
                style={[styles.pill, styles.pillRow, active && styles.pillActive]}
              >
                <CanvaFeatureIcon
                  icon={resolveCategoryCanvaIcon(opt.datasetCategory)}
                  size={14}
                />
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {opt.shortLabel}
                </Text>
              </ScalePressable>
            );
          })}
        </ScrollView>

        {/* Perk, Saved & Owned Toggles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <ScalePressable
            onPress={() => setSavedOnly((v) => !v)}
            style={[styles.savedChip, savedOnly && styles.savedChipActive]}
          >
            <Bookmark
              size={13}
              color={savedOnly ? LedgerTheme.colors.surface : LedgerTheme.colors.accent}
            />
            <Text style={[styles.savedChipText, savedOnly && styles.pillTextActive]}>
              Saved ({savedIds.length})
            </Text>
          </ScalePressable>
          <ScalePressable
            onPress={() => setOwnedOnly((v) => !v)}
            style={[styles.savedChip, ownedOnly && styles.savedChipActive]}
          >
            <Wallet
              size={13}
              color={ownedOnly ? LedgerTheme.colors.surface : LedgerTheme.colors.accent}
            />
            <Text style={[styles.savedChipText, ownedOnly && styles.pillTextActive]}>
              Owned ({ownedIds.length})
            </Text>
          </ScalePressable>
          {togglePills.map((p) => (
            <ScalePressable
              key={p.label}
              onPress={p.onPress}
              style={[styles.pill, styles.pillRow, p.active && styles.pillActive]}
            >
              {p.label === 'Golf' && (
                <Flag
                  size={13}
                  color={p.active ? LedgerTheme.colors.surface : LedgerTheme.colors.inkSecondary}
                />
              )}
              <Text style={[styles.pillText, p.active && styles.pillTextActive]}>{p.label}</Text>
            </ScalePressable>
          ))}
        </ScrollView>

        <View style={styles.metaBar}>
          <Text style={styles.countText}>
            Showing {filtered.length} cards
          </Text>
          <View style={styles.sortGroup}>
            <ScalePressable
              onPress={() => router.push('/(tabs)/my-cards' as never)}
              style={styles.walletPill}
              hitSlop={6}
            >
              <Wallet size={12} color={LedgerTheme.colors.accent} />
              <Text style={styles.walletPillText}>
                My Cards{ownedIds.length > 0 ? ` (${ownedIds.length})` : ''}
              </Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setMoreFiltersOpen((v) => !v);
              }}
              style={[
                styles.walletPill,
                (moreFiltersOpen || bankSlug !== 'all' || incomeFilter !== null || strategy !== 'default_inr') && {
                  backgroundColor: LedgerTheme.colors.accent,
                  borderColor: LedgerTheme.colors.accent,
                },
              ]}
              hitSlop={6}
            >
              <SlidersHorizontal
                size={12}
                color={
                  moreFiltersOpen || bankSlug !== 'all' || incomeFilter !== null || strategy !== 'default_inr'
                    ? '#FFFFFF'
                    : LedgerTheme.colors.accent
                }
              />
              <Text
                style={[
                  styles.walletPillText,
                  (moreFiltersOpen || bankSlug !== 'all' || incomeFilter !== null || strategy !== 'default_inr') && {
                    color: '#FFFFFF',
                  },
                ]}
              >
                {moreFiltersOpen ? 'Less' : 'More'}
              </Text>
            </ScalePressable>
            {hasFilters && (
              <ScalePressable onPress={resetAllFilters} hitSlop={6}>
                <Text style={styles.resetText}>Reset</Text>
              </ScalePressable>
            )}
            <ScalePressable
              onPress={cycleSort}
              style={styles.sortBtn}
              hitSlop={6}
            >
              <Text style={styles.sortText}>{sortLabel}</Text>
            </ScalePressable>
          </View>
        </View>

        {moreFiltersOpen && (
          <AnimatedReveal style={{ gap: 10, paddingTop: 2 }}>
            {/* Issuing Banks Strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <ScalePressable
                onPress={() => setBankSlug('all')}
                style={[styles.bankPill, bankSlug === 'all' && styles.bankPillActive]}
              >
                <Text style={[styles.bankPillText, bankSlug === 'all' && styles.bankPillTextActive]}>
                  All Banks
                </Text>
              </ScalePressable>
              {topBanks.map((b) => (
                <ScalePressable
                  key={b.bank_slug}
                  onPress={() => setBankSlug(b.bank_slug === bankSlug ? 'all' : b.bank_slug)}
                  style={[styles.bankPill, bankSlug === b.bank_slug && styles.bankPillActive]}
                >
                  <BankLogo bankSlug={b.bank_slug} bank={b.bank} size="xs" />
                  <Text
                    style={[styles.bankPillText, bankSlug === b.bank_slug && styles.bankPillTextActive]}
                  >
                    {b.bank} ({b.total_cards})
                  </Text>
                </ScalePressable>
              ))}
            </ScrollView>

            {/* Personalize By Salary & Conversion Strategy */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {[
                { v: null as number | null, label: 'Salary: Any' },
                { v: 50000, label: '₹50k+' },
                { v: 150000, label: '₹1.5L+' },
                { v: 300000, label: '₹3L+' },
                { v: 500000, label: '₹5L+' },
              ].map((sal) => {
                const active = incomeFilter === sal.v;
                return (
                  <ScalePressable
                    key={sal.label}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setIncomeFilter(sal.v);
                      if (sal.v !== null) setSortBy('personalized');
                    }}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {sal.label}
                    </Text>
                  </ScalePressable>
                );
              })}
              {CONVERSION_STRATEGIES.map((st) => {
                const active = strategy === st.id;
                return (
                  <ScalePressable
                    key={st.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setStrategy(st.id);
                      if (st.id !== 'default_inr') setSortBy('personalized');
                    }}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {st.id === 'default_inr' ? 'Redeem: Default' : st.shortLabel}
                    </Text>
                  </ScalePressable>
                );
              })}
              <ScalePressable
                onPress={() =>
                  router.push({
                    pathname: '/advisor',
                    params: {
                      ...(incomeFilter ? { income: String(incomeFilter) } : {}),
                      ...(strategy !== 'default_inr' ? { strategy } : {}),
                    },
                  } as never)
                }
                style={[styles.pill, { borderColor: LedgerTheme.colors.accent }]}
              >
                <Text style={[styles.pillText, { color: LedgerTheme.colors.accent }]}>
                  Open in Advisor →
                </Text>
              </ScalePressable>
            </ScrollView>
          </AnimatedReveal>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.card_id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListHeaderComponent={
          activeCategoryStudy ? (
            <View style={styles.studyBox}>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setStudyOpen((v) => !v);
                }}
                style={styles.studyHeader}
              >
                <View style={styles.studyTitleWrap}>
                  <Text style={styles.studyTitle}>{activeCategoryStudy.title}</Text>
                  <Text style={styles.studySub} numberOfLines={studyOpen ? 3 : 1}>
                    {studyOpen ? activeCategoryStudy.subtitle : 'Tap to expand category comparison matrix'}
                  </Text>
                </View>
                {studyOpen ? (
                  <ChevronUp size={17} color={LedgerTheme.colors.inkMuted} />
                ) : (
                  <ChevronDown size={17} color={LedgerTheme.colors.inkMuted} />
                )}
              </ScalePressable>

              {studyOpen && (
                <AnimatedReveal>
                  <View style={styles.studyActionsRow}>
                    <ScalePressable
                      onPress={handleShareStudy}
                      style={styles.studyActionBtn}
                    >
                      <Share2 size={13} color={LedgerTheme.colors.accent} />
                      <Text style={styles.studyActionText}>Share Table</Text>
                    </ScalePressable>
                    <ScalePressable
                      onPress={() => setStudySheetModalOpen(true)}
                      style={[styles.studyActionBtn, styles.studyActionBtnPrimary]}
                    >
                      <Maximize2 size={13} color="#FFFFFF" />
                      <Text style={styles.studyActionTextPrimary}>Full Sheet View</Text>
                    </ScalePressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.studyTable}>
                      <View style={styles.studyHeadRow}>
                        <Text style={[styles.studyCardCol, styles.studyHeadText]}>Card</Text>
                        <Text style={[styles.studyFeeCol, styles.studyHeadText]}>Fee</Text>
                        {activeCategoryStudy.columns.map((col) => (
                          <Text key={col} style={[styles.studyDataCol, styles.studyHeadText]}>
                            {col}
                          </Text>
                        ))}
                      </View>
                      {activeCategoryStudy.rows.map((r, rIdx) => {
                        const canOpen = Boolean(r.bankSlug && r.cardSlug);
                        return (
                          <ScalePressable
                            key={`${r.cardId}_${rIdx}`}
                            disabled={!canOpen}
                            onPress={() => {
                              if (r.bankSlug && r.cardSlug) {
                                router.push({
                                  pathname: '/card/[bankSlug]/[cardSlug]',
                                  params: { bankSlug: r.bankSlug, cardSlug: r.cardSlug },
                                });
                              }
                            }}
                            style={[styles.studyRow, rIdx % 2 === 1 && styles.studyRowAlt]}
                          >
                            <View style={styles.studyCardCol}>
                              <Text numberOfLines={2} style={styles.studyCardName}>
                                {r.cardName}
                              </Text>
                              <Text numberOfLines={1} style={styles.studyBank}>
                                {r.bank}
                              </Text>
                            </View>
                            <Text style={styles.studyFeeCol}>{r.annualFee}</Text>
                            {r.cells.map((cell, cIdx) => (
                              <Text key={cIdx} style={styles.studyDataCol}>
                                {cell}
                              </Text>
                            ))}
                          </ScalePressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </AnimatedReveal>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const showPersonalNote =
            sortBy === 'personalized' ||
            incomeFilter !== null ||
            strategy !== 'default_inr';
          const personalNote = showPersonalNote
            ? (computePersonalizedDirectoryScore(item, {
                monthlyIncomeInr: incomeFilter,
                strategy,
              }).matchBadge ?? undefined)
            : undefined;
          return (
            <LedgerCardItem
              card={item}
              onPress={openCard}
              subtitleNote={personalNote}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No matching cards found</Text>
            <Text style={styles.emptySub}>Try broadening filters or clearing the search query.</Text>
            <ScalePressable onPress={resetAllFilters} style={styles.emptyResetBtn}>
              <Text style={styles.emptyResetText}>Reset All Filters</Text>
            </ScalePressable>
          </View>
        }
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        windowSize={7}
      />

      {activeCategoryStudy && (
        <Modal
          visible={studySheetModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setStudySheetModalOpen(false)}
        >
          <SafeAreaView style={styles.sheetModalSafe}>
            <View style={styles.sheetModalHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.sheetModalBadge}>CardLedger India · Live 2026 Sheet</Text>
                <Text style={styles.sheetModalTitle} numberOfLines={2}>
                  {activeCategoryStudy.title}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ScalePressable onPress={handleShareStudy} style={styles.studyActionBtn}>
                  <Share2 size={14} color={LedgerTheme.colors.accent} />
                  <Text style={styles.studyActionText}>Share</Text>
                </ScalePressable>
                <ScalePressable
                  onPress={() => setStudySheetModalOpen(false)}
                  style={styles.sheetCloseBtn}
                >
                  <X size={18} color={LedgerTheme.colors.inkPrimary} />
                </ScalePressable>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
              <Text style={[styles.studySub, { marginBottom: 10 }]}>
                {activeCategoryStudy.subtitle}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.studyTable}>
                  <View style={styles.studyHeadRow}>
                    <Text style={[styles.studyCardCol, styles.studyHeadText]}>Card</Text>
                    <Text style={[styles.studyFeeCol, styles.studyHeadText]}>Fee</Text>
                    {activeCategoryStudy.columns.map((col) => (
                      <Text key={col} style={[styles.studyDataCol, styles.studyHeadText]}>
                        {col}
                      </Text>
                    ))}
                  </View>
                  {activeCategoryStudy.rows.map((r, rIdx) => (
                    <ScalePressable
                      key={`modal_${r.cardId}_${rIdx}`}
                      onPress={() => {
                        setStudySheetModalOpen(false);
                        router.push({
                          pathname: '/card/[bankSlug]/[cardSlug]',
                          params: { bankSlug: r.bankSlug, cardSlug: r.cardSlug },
                        });
                      }}
                      style={[styles.studyRow, rIdx % 2 === 1 && styles.studyRowAlt]}
                    >
                      <View style={styles.studyCardCol}>
                        <Text style={styles.studyCardName}>{r.cardName}</Text>
                        <Text style={styles.studyBank}>{r.bank}</Text>
                      </View>
                      <Text style={styles.studyFeeCol}>{r.annualFee}</Text>
                      {r.cells.map((cell, cIdx) => (
                        <Text key={cIdx} style={styles.studyDataCol}>
                          {cell}
                        </Text>
                      ))}
                    </ScalePressable>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  controlsBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pillActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  pillText: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  pillTextActive: {
    color: LedgerTheme.colors.surface,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  savedChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  savedChipText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  bankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.subtle,
    justifyContent: 'center',
  },
  bankPillActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#A9CEC3',
  },
  bankPillText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
  },
  bankPillTextActive: {
    color: LedgerTheme.colors.accent,
    fontWeight: '500',
  },
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  countText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetText: {
    fontSize: 13,
    color: LedgerTheme.colors.warn,
    fontWeight: '500',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sortText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  walletPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  studyBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  studyTitleWrap: {
    flex: 1,
    gap: 3,
  },
  studyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  studySub: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 19,
  },
  studyTable: {
    minWidth: 540,
    gap: 3,
  },
  studyHeadRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  studyHeadText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  studyCardCol: {
    width: 156,
  },
  studyCardName: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    lineHeight: 18,
  },
  studyBank: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
  },
  studyFeeCol: {
    width: 80,
    fontSize: 12.5,
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  studyDataCol: {
    width: 154,
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17.5,
  },
  studyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  studyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  studyActionBtnPrimary: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  studyActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  studyActionTextPrimary: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  studyRowAlt: {
    backgroundColor: '#FAF9F6',
  },
  sheetModalSafe: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  sheetModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: LedgerTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  sheetModalBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  sheetModalTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LedgerTheme.colors.subtle,
  },
  listContent: {
    padding: 16,
    paddingBottom: 38,
  },
  emptyBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 6,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyResetText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
});
