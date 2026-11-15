import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calculator,
  ChevronRight,
  ExternalLink,
  Headphones,
  Plane,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  X,
} from 'lucide-react-native';
import {
  ALL_CARDS,
  DEVALUATION_TRACKER,
  LATEST_OFFERS,
  TOTAL_BANKS,
  TOTAL_CARDS,
} from '../../src/lib/data';
import { CATEGORY_OPTIONS } from '../../src/lib/advisor';
import { getCardConversionKeywords } from '../../src/lib/conversion';
import {
  matchCardForDevalMention,
  splitDevalSummaryClauses,
} from '../../src/lib/devaluations';
import { formatFeeDisplay, formatInr, matchesTokenizedQuery } from '../../src/lib/format';
import { openExternalUrlSafely } from '../../src/lib/security';
import { resolveOpenMediaSource } from '../../src/lib/openMedia';
import { LedgerTheme } from '../../src/lib/theme';
import { BankLogo } from '../../src/components/BankLogo';
import { CardArtwork } from '../../src/components/CardArtwork';
import { LedgerCardItem } from '../../src/components/LedgerCardItem';
import {
  CanvaFeatureIcon,
  CanvaFeaturePill,
  resolveCategoryCanvaIcon,
} from '../../src/components/FeatureIcon';
import {
  AiOrb3D,
  AiShimmerStrip,
  CalmEntranceView,
  ParallaxShowcaseCard,
  ScalePressable,
} from '../../src/components/MotionPrimitives';
import { useCompare } from '../../src/components/CompareContext';
import type { CardSummaryItem } from '../../src/lib/types';

const SHOWCASE_WIDTH = 252;
const SHOWCASE_GAP = 14;
const SHOWCASE_STRIDE = SHOWCASE_WIDTH + SHOWCASE_GAP;

const QUICK_FILTERS = [
  { key: 'all', label: 'Top Picks' },
  { key: 'ltf', label: 'Lifetime Free' },
  { key: 'upi', label: 'RuPay UPI' },
  { key: 'lounge', label: 'No-Spend Lounge' },
  { key: 'golf', label: 'Golf' },
] as const;

function getPeakPct(card: CardSummaryItem): number {
  return Object.entries(card.effective_return_pct_by_category || {})
    .filter(([k]) => k !== 'international_forex_net_of_markup')
    .reduce((m, [, v]) => (v > m ? v : m), 0);
}

type HomeSection = 'featured' | 'categories' | 'tools';

export default function DiscoverScreen() {
  const router = useRouter();
  const { ownedIds } = useCompare();
  const [homeSection, setHomeSection] = useState<HomeSection>('featured');
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<(typeof QUICK_FILTERS)[number]['key']>('all');
  const [recentDevalOpen, setRecentDevalOpen] = useState(false);

  const showcaseScrollX = useSharedValue(0);
  const onShowcaseScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      showcaseScrollX.value = event.contentOffset.x;
    },
  });

  const isSearching = query.trim().length > 0;

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const opt of CATEGORY_OPTIONS) {
      map[opt.datasetCategory] = ALL_CARDS.filter(
        (c) =>
          c.primary_category === opt.datasetCategory ||
          c.categories.includes(opt.datasetCategory)
      ).length;
    }
    return map;
  }, []);

  const displayedCategories = useMemo(() => CATEGORY_OPTIONS.slice(0, 8), []);

  const flagshipShowcaseCards = useMemo(() => {
    const findFirst = (patterns: string[], fallbackCategory?: string): CardSummaryItem | undefined => {
      for (const pat of patterns) {
        const q = pat.toLowerCase();
        const found = ALL_CARDS.find(
          (c) =>
            (c.local_image_path || c.image_url) &&
            (c.card_name.toLowerCase().includes(q) || c.card_id.toLowerCase().includes(q))
        );
        if (found) return found;
      }
      if (fallbackCategory) {
        return [...ALL_CARDS]
          .filter(
            (c) =>
              (c.local_image_path || c.image_url) &&
              (c.primary_category === fallbackCategory || c.categories.includes(fallbackCategory))
          )
          .sort((a, b) => b.overall_rating - a.overall_rating)[0];
      }
      return undefined;
    };

    const picks: Array<{ lane: string; card: CardSummaryItem | undefined }> = [
      { lane: 'Dining & Groceries', card: findFirst(['hsbc live+'], 'Dining, Groceries & Movies') },
      { lane: 'Online Cashback', card: findFirst(['cashback sbi'], 'Cashback') },
      { lane: 'Travel & Miles', card: findFirst(['axis bank atlas', 'hdfc regalia gold'], 'Travel & Miles') },
      { lane: 'RuPay on UPI', card: findFirst(['tata neu infinity', 'kiwi'], 'RuPay & UPI') },
      { lane: 'Super-Premium Golf', card: findFirst(['infinia metal', 'hsbc premier'], 'Super-Premium') },
    ];

    const seen = new Set<string>();
    const out: Array<{ lane: string; card: CardSummaryItem }> = [];
    for (const item of picks) {
      if (item.card && !seen.has(item.card.card_id)) {
        seen.add(item.card.card_id);
        out.push({ lane: item.lane, card: item.card });
      }
    }
    return out;
  }, []);

  const topOffers = useMemo(() => LATEST_OFFERS.slice(0, 3), []);

  const filteredCards = useMemo(() => {
    const cap = isSearching ? 12 : 6;
    return ALL_CARDS.filter((c) => {
      const t = c.filter_tags;
      if (
        isSearching &&
        !matchesTokenizedQuery(
          query,
          c.card_name,
          c.bank,
          c.primary_category,
          c.categories,
          c.card_network,
          t.best_for_tags,
          t.requirement_keywords,
          getCardConversionKeywords(c.card_id)
        )
      ) {
        return false;
      }
      if (quickFilter === 'ltf' && !t.is_ltf) return false;
      if (quickFilter === 'upi' && !t.is_rupay_upi) return false;
      if (quickFilter === 'lounge' && !t.no_spend_domestic_lounge) return false;
      if (quickFilter === 'golf' && !t.has_golf && !c.categories.includes('Golf')) {
        return false;
      }
      return true;
    })
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, cap);
  }, [isSearching, query, quickFilter]);

  const recentDeval = DEVALUATION_TRACKER.timeline_2024_2026[0];

  const openCard = (card: CardSummaryItem) => {
    router.push({
      pathname: '/card/[bankSlug]/[cardSlug]',
      params: { bankSlug: card.bank_slug, cardSlug: card.card_slug },
    });
  };

  return (
    <>
      <FlatList
      data={isSearching || homeSection === 'featured' ? filteredCards : []}
      keyExtractor={(item) => item.card_id}
      style={styles.screen}
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      removeClippedSubviews={Platform.OS !== 'web'}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={
        <View style={styles.headerBlock}>
          {/* Spacious Editorial Hero */}
          <CalmEntranceView>
            <View style={styles.heroCard}>
              <Text style={styles.heroHeadline}>
                Pick the right card{' '}
                <Text style={styles.heroHeadlineAccent}>for every spend.</Text>
              </Text>
              <Text style={styles.heroLead}>
                Real net returns after caps, lounge rules, and bank MITC terms.
              </Text>

              <View style={styles.searchPill}>
                <Search size={20} color={LedgerTheme.colors.inkMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search card, bank, or perk..."
                  placeholderTextColor={LedgerTheme.colors.inkMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {isSearching && (
                  <ScalePressable onPress={() => setQuery('')} hitSlop={10}>
                    <X size={19} color={LedgerTheme.colors.inkMuted} />
                  </ScalePressable>
                )}
              </View>
            </View>
          </CalmEntranceView>

          {!isSearching && (
            <>
              {/* Segmented Section Switcher — Break Home Into Focused Views */}
              <View style={styles.homeSegmentBar}>
                {(
                  [
                    { key: 'featured', label: 'Featured' },
                    { key: 'categories', label: 'Categories' },
                    { key: 'tools', label: 'Tools & Help' },
                  ] as const
                ).map((seg) => {
                  const active = homeSection === seg.key;
                  return (
                    <ScalePressable
                      key={seg.key}
                      onPress={() => setHomeSection(seg.key)}
                      style={[styles.homeSegmentPill, active && styles.homeSegmentPillActive]}
                    >
                      <Text
                        style={[
                          styles.homeSegmentText,
                          active && styles.homeSegmentTextActive,
                        ]}
                      >
                        {seg.label}
                      </Text>
                    </ScalePressable>
                  );
                })}
              </View>

              {homeSection === 'featured' && (
                /* Scroll-Linked Parallax Flagship Deck */
                <CalmEntranceView delayMs={60}>
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sectionTitle}>Standout Cards</Text>
                        <Text style={styles.sectionSub}>Swipe top picks or tap any card to inspect in 3D</Text>
                      </View>
                    </View>

                    <Animated.ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={SHOWCASE_STRIDE}
                      snapToAlignment="start"
                      scrollEventThrottle={16}
                      onScroll={onShowcaseScroll}
                      contentContainerStyle={styles.showcaseScroll}
                    >
                      {flagshipShowcaseCards.map(({ lane, card }, index) => {
                        const peakPct = getPeakPct(card);
                        const themeBg = card.card_theme?.soft_bg_hex || '#EEF5F2';
                        const themeBorder =
                          card.card_theme?.border_hex || LedgerTheme.colors.hairline;
                        const themeAccent =
                          card.card_theme?.primary_hex || LedgerTheme.colors.accent;
                        return (
                          <ParallaxShowcaseCard
                            key={card.card_id}
                            scrollX={showcaseScrollX}
                            index={index}
                            stride={SHOWCASE_STRIDE}
                          >
                            <ScalePressable
                              onPress={() => openCard(card)}
                              style={[
                                styles.showcaseCard,
                                { backgroundColor: themeBg, borderColor: themeBorder },
                              ]}
                            >
                              <View
                                style={[styles.showcaseStrip, { backgroundColor: themeAccent }]}
                              />

                              <View style={styles.showcaseLaneRow}>
                                <CanvaFeaturePill
                                  icon={resolveCategoryCanvaIcon(card.primary_category)}
                                  label={lane}
                                />
                              </View>

                              <View style={styles.showcaseArtCenter}>
                                <CardArtwork
                                  localImagePath={card.local_image_path}
                                  imageUrl={card.image_url}
                                  bank={card.bank}
                                  cardName={card.card_name}
                                  network={card.card_network}
                                  cardTheme={card.card_theme}
                                  size="hero"
                                  showSplash
                                />
                              </View>

                              <View style={styles.showcaseBody}>
                                <View style={styles.bankRow}>
                                  <BankLogo bankSlug={card.bank_slug} bank={card.bank} size="xs" />
                                  <Text numberOfLines={1} style={styles.showcaseBankText}>
                                    {card.bank}
                                  </Text>
                                </View>
                                <Text numberOfLines={2} style={styles.showcaseTitle}>
                                  {card.card_name}
                                </Text>
                              </View>

                              <View style={styles.showcaseFooter}>
                                {(() => {
                                  const feeInfo = formatFeeDisplay(
                                    card.joining_fee_inr,
                                    card.annual_fee_inr
                                  );
                                  return (
                                    <View style={{ flex: 1, paddingRight: 6 }}>
                                      <Text style={styles.showcaseMetricLabel}>{feeInfo.label}</Text>
                                      <Text style={styles.showcaseMetricVal} numberOfLines={1}>
                                        {feeInfo.isSplit
                                          ? `${feeInfo.joiningText} / ${feeInfo.annualText}`
                                          : feeInfo.primaryText}
                                      </Text>
                                    </View>
                                  );
                                })()}
                                {peakPct > 0 && (
                                  <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.showcaseMetricLabel}>Peak Reward</Text>
                                    <Text style={[styles.showcaseMetricVal, { color: themeAccent }]}>
                                      {peakPct.toFixed(1)}%
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </ScalePressable>
                          </ParallaxShowcaseCard>
                        );
                      })}
                    </Animated.ScrollView>
                  </View>
                </CalmEntranceView>
              )}

              {homeSection === 'tools' && (
                <CalmEntranceView delayMs={60}>
                  <View style={styles.storyStack}>
                    <ScalePressable
                      onPress={() => router.push('/advisor')}
                      style={[styles.advisorStoryCard, { overflow: 'hidden' }]}
                    >
                      <AiShimmerStrip />
                      <AiOrb3D size={42} />
                      <View style={styles.storyCopy}>
                        <Text style={styles.storyTitle}>Personalized AI Card Advisor</Text>
                        <Text style={styles.storySub}>
                          Best single card or 2-card split for your income &amp; monthly spend
                        </Text>
                      </View>
                      <Image
                        source={require('../../assets/illustrations/ai-vault-3d.webp')}
                        style={styles.storyThumbMini}
                      />
                    </ScalePressable>

                    <ScalePressable
                      onPress={() => router.push('/(tabs)/my-cards' as never)}
                      style={styles.walletStoryCard}
                    >
                      <Image
                        source={require('../../assets/illustrations/airport-lounge-hero.webp')}
                        style={styles.storyThumbMini}
                      />
                      <View style={styles.storyCopy}>
                        <Text style={styles.storyTitle}>My Cards &amp; Quota Tracker</Text>
                        <Text style={styles.storySub}>
                          {ownedIds.length > 0
                            ? `${ownedIds.length} saved cards · Track lounge & golf utilization`
                            : 'Save cards with last 4 digits to track lounge & golf limits'}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={LedgerTheme.colors.warn} />
                    </ScalePressable>

                    <ScalePressable
                      onPress={() => router.push('/help' as never)}
                      style={[styles.walletStoryCard, { borderColor: '#C5DFD6', backgroundColor: '#F6FBF9' }]}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 14,
                          backgroundColor: LedgerTheme.colors.tintPrimary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Headphones size={24} color={LedgerTheme.colors.accent} />
                      </View>
                      <View style={styles.storyCopy}>
                        <Text style={styles.storyTitle}>Bank Helplines, Card Block &amp; L1/L2/PNO</Text>
                        <Text style={styles.storySub}>
                          2-column issuer grid with direct dial numbers &amp; RBI escalations
                        </Text>
                      </View>
                      <ChevronRight size={20} color={LedgerTheme.colors.accent} />
                    </ScalePressable>

                    <View style={styles.quickActionLinksRow}>
                      <ScalePressable
                        onPress={() => router.push('/(tabs)/lounges')}
                        style={styles.quickPillLink}
                      >
                        <CanvaFeatureIcon icon="lounge" size={18} />
                        <Text style={styles.quickPillLinkText}>Lounge &amp; Golf</Text>
                      </ScalePressable>

                      <ScalePressable
                        onPress={() => router.push('/(tabs)/calculator')}
                        style={styles.quickPillLink}
                      >
                        <CanvaFeatureIcon icon="rewards" size={18} />
                        <Text style={styles.quickPillLinkText}>Calculator</Text>
                      </ScalePressable>

                      <ScalePressable
                        onPress={() => router.push('/devaluations')}
                        style={styles.quickPillLink}
                      >
                        <CanvaFeatureIcon icon="devaluation" size={18} />
                        <Text style={styles.quickPillLinkText}>Devaluations</Text>
                      </ScalePressable>
                    </View>

                    {topOffers.length > 0 && (
                      <View style={styles.sectionBlock}>
                        <View style={styles.sectionHeader}>
                          <View style={styles.offersTitleRow}>
                            <Tag size={17} color={LedgerTheme.colors.accent} />
                            <Text style={styles.sectionTitle}>Latest Issuer Offers</Text>
                          </View>
                          <Text style={styles.offersBadgeCount}>{LATEST_OFFERS.length} verified</Text>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.offersScroll}
                        >
                          {topOffers.map((offer) => (
                            <ScalePressable
                              key={offer.offer_id}
                              onPress={() => openExternalUrlSafely(offer.offer_url)}
                              style={styles.offerCard}
                            >
                              <View style={styles.offerCardTop}>
                                <BankLogo bank={offer.bank} size="xs" />
                                <Text numberOfLines={1} style={styles.offerBankLabel}>
                                  {offer.bank}
                                </Text>
                                <ExternalLink size={14} color={LedgerTheme.colors.accent} />
                              </View>
                              <Text numberOfLines={2} style={styles.offerTitle}>
                                {offer.title}
                              </Text>
                              <Text numberOfLines={1} style={styles.offerValid}>
                                {offer.valid_till}
                              </Text>
                            </ScalePressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {recentDeval && (
                      <ScalePressable
                        onPress={() => setRecentDevalOpen(true)}
                        style={styles.devalBanner}
                      >
                        <ShieldAlert size={20} color={LedgerTheme.colors.warn} />
                        <View style={styles.devalLeft}>
                          <Text numberOfLines={1} style={styles.devalTag}>
                            Recent Devaluation · {recentDeval.issuer} ({recentDeval.date})
                          </Text>
                          <Text numberOfLines={2} style={styles.devalText}>
                            {recentDeval.summary} — Tap for impact summary
                          </Text>
                        </View>
                        <ChevronRight size={20} color={LedgerTheme.colors.warn} />
                      </ScalePressable>
                    )}
                  </View>
                </CalmEntranceView>
              )}

              {homeSection === 'categories' && (
                <CalmEntranceView delayMs={60}>
                  <View style={{ gap: 22 }}>
                    {/* Open-Internet Visual Experience Gallery */}
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionTitle}>Explore Visual Experiences</Text>
                          <Text style={styles.sectionSub}>Tap any benefit zone to open its dedicated page</Text>
                        </View>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 10 }}>
                        {[
                          { title: 'Airport Lounges', sub: '115+ India Terminals', topic: 'airport-lounge' as const, icon: 'lounge' as const, onPress: () => router.push('/(tabs)/lounges') },
                          { title: 'Golf Rounds', sub: '40+ India Courses', topic: 'golf-course' as const, icon: 'golf' as const, onPress: () => router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'golf' } } as never) },
                          { title: 'Dining & Swiggy', sub: 'Up to 10% Returns', topic: 'indian-dining' as const, icon: 'dining' as const, onPress: () => router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'dining-groceries' } } as never) },
                          { title: 'Travel & Miles', sub: 'Business Class Value', topic: 'airline-business' as const, icon: 'travel' as const, onPress: () => router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'travel' } } as never) },
                          { title: 'Shopping & Online', sub: '5% Online Cashback', topic: 'retail-shopping' as const, icon: 'shopping' as const, onPress: () => router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'online-shopping' } } as never) },
                          { title: 'Fuel Cashback', sub: 'HPCL · IOCL · BPCL', topic: 'fuel-station' as const, icon: 'fuel' as const, onPress: () => router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'fuel' } } as never) },
                        ].map((exp) => (
                          <ScalePressable key={exp.title} onPress={exp.onPress} style={styles.expVisualCard}>
                            <Image source={resolveOpenMediaSource(exp.topic)} style={styles.expVisualImg} />
                            <View style={styles.expVisualOverlay}>
                              <View style={styles.expVisualIconBadge}>
                                <CanvaFeatureIcon icon={exp.icon} size={16} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.expVisualTitle} numberOfLines={1}>{exp.title}</Text>
                                <Text style={styles.expVisualSub} numberOfLines={1}>{exp.sub}</Text>
                              </View>
                            </View>
                          </ScalePressable>
                        ))}
                      </ScrollView>
                    </View>

                    {/* Focused Spending Categories -> Dedicated Multi-Page Navigation */}
                    <View style={styles.sectionBlock}>
                      <View style={styles.sectionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sectionTitle}>Browse by Spend</Text>
                          <Text style={styles.sectionSub}>Tap any category to open its full chart &amp; card page</Text>
                        </View>
                        <ScalePressable
                          onPress={() => router.push('/categories' as never)}
                          style={styles.seeAllBtn}
                          hitSlop={8}
                        >
                          <Text style={styles.seeAllText}>All {CATEGORY_OPTIONS.length}</Text>
                          <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                        </ScalePressable>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryBoxesScroll}
                      >
                        {displayedCategories.map((opt) => (
                          <ScalePressable
                            key={opt.id}
                            onPress={() =>
                              router.push({
                                pathname: '/categories/[categoryId]',
                                params: { categoryId: opt.id },
                              } as never)
                            }
                            style={styles.categorySquareBox}
                          >
                            <View style={styles.categoryBoxTop}>
                              <View style={styles.categoryIconCircle}>
                                <CanvaFeatureIcon
                                  icon={resolveCategoryCanvaIcon(opt.datasetCategory)}
                                  size={20}
                                />
                              </View>
                              <Text style={styles.categoryCountPill}>
                                {categoryCounts[opt.datasetCategory] ?? 0}
                              </Text>
                            </View>
                            <Text numberOfLines={1} style={styles.categoryBoxTitle}>
                              {opt.shortLabel}
                            </Text>
                          </ScalePressable>
                        ))}
                      </ScrollView>

                      <ScalePressable
                        onPress={() => router.push('/categories' as never)}
                        style={styles.viewAllCategoryBtn}
                      >
                        <Text style={styles.viewAllCategoryBtnText}>
                          Open Categories Hub &amp; Yield Chart ({CATEGORY_OPTIONS.length})
                        </Text>
                        <ArrowRight size={15} color={LedgerTheme.colors.accent} />
                      </ScalePressable>
                    </View>
                  </View>
                </CalmEntranceView>
              )}
            </>
          )}

          {(isSearching || homeSection === 'featured') && (
            /* Starter Card Feed Header + Quick Chips */
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isSearching ? `Search Matches (${filteredCards.length})` : 'Starter Picks'}
                </Text>
                <ScalePressable
                  onPress={() => router.push('/(tabs)/finder')}
                  style={styles.seeAllBtn}
                  hitSlop={8}
                >
                  <Text style={styles.seeAllText}>All {TOTAL_CARDS}</Text>
                  <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                </ScalePressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {QUICK_FILTERS.map((f) => {
                  const active = quickFilter === f.key;
                  return (
                    <ScalePressable
                      key={f.key}
                      onPress={() => setQuickFilter(f.key)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {f.label}
                      </Text>
                    </ScalePressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <LedgerCardItem card={item} onPress={openCard} compact />
        </Animated.View>
      )}
      ListEmptyComponent={
        isSearching || homeSection === 'featured' ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No matching cards found</Text>
            <Text style={styles.emptySub}>Try clearing your search or quick filter.</Text>
            <ScalePressable
              onPress={() => {
                setQuery('');
                setQuickFilter('all');
              }}
              style={styles.emptyResetBtn}
            >
              <Text style={styles.emptyResetText}>Reset Filters</Text>
            </ScalePressable>
          </View>
        ) : undefined
      }
      ListFooterComponent={
        <View style={styles.footerGroup}>
          <ScalePressable
            onPress={() => router.push('/(tabs)/finder')}
            style={styles.primaryFinderCta}
          >
            <Text style={styles.primaryFinderCtaText}>Explore all {TOTAL_CARDS} audited cards</Text>
            <ArrowRight size={17} color={LedgerTheme.colors.surface} />
          </ScalePressable>

          <ScalePressable
            onPress={() =>
              router.push({
                pathname: '/(tabs)/lounges',
                params: { subTab: 'banks' },
              })
            }
            style={styles.footerCta}
          >
            <Building2 size={18} color={LedgerTheme.colors.accent} />
            <Text style={styles.footerCtaText}>Browse {TOTAL_BANKS} Issuing Banks</Text>
            <ChevronRight size={17} color={LedgerTheme.colors.accent} />
          </ScalePressable>
        </View>
      }
    />

    {recentDeval && (
      <Modal
        visible={recentDevalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRecentDevalOpen(false)}
      >
        <View style={styles.devalModalScreen}>
          <View style={styles.devalModalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.devalModalEyebrow}>
                {recentDeval.issuer} · {recentDeval.date}
              </Text>
              <Text style={styles.devalModalTitle}>Devaluation Impact Summary</Text>
            </View>
            <ScalePressable
              onPress={() => setRecentDevalOpen(false)}
              style={styles.devalModalCloseBtn}
            >
              <X size={18} color={LedgerTheme.colors.inkPrimary} />
            </ScalePressable>
          </View>

          <ScrollView contentContainerStyle={styles.devalModalContent}>
            <View style={styles.devalModalCard}>
              <Text style={styles.devalModalSectionLabel}>What Changed & Impact</Text>
              <View style={{ gap: 8 }}>
                {splitDevalSummaryClauses(recentDeval.summary).map((clause, idx) => (
                  <View key={idx} style={styles.devalClauseRow}>
                    <AlertTriangle
                      size={14}
                      color={LedgerTheme.colors.warn}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={styles.devalClauseText}>{clause}</Text>
                  </View>
                ))}
              </View>
            </View>

            {recentDeval.cards_affected.length > 0 && (
              <View style={styles.devalModalCard}>
                <Text style={styles.devalModalSectionLabel}>
                  Affected Cards ({recentDeval.cards_affected.length})
                </Text>
                <View style={styles.devalChipsWrap}>
                  {recentDeval.cards_affected.map((mention, idx) => {
                    const matched = matchCardForDevalMention(
                      recentDeval.issuer,
                      mention,
                      ALL_CARDS
                    );
                    const owned = matched && ownedIds.includes(matched.card_id);
                    return (
                      <ScalePressable
                        key={`${mention}_${idx}`}
                        disabled={!matched}
                        onPress={() => {
                          if (!matched) return;
                          setRecentDevalOpen(false);
                          openCard(matched);
                        }}
                        style={[
                          styles.devalAffectedChip,
                          owned && styles.devalAffectedChipOwned,
                        ]}
                      >
                        <Text
                          style={[
                            styles.devalAffectedChipText,
                            owned && { color: LedgerTheme.colors.warn },
                          ]}
                        >
                          {mention}
                          {matched ? ' · Open →' : ''}
                        </Text>
                      </ScalePressable>
                    );
                  })}
                </View>
              </View>
            )}

            <ScalePressable
              onPress={() => {
                setRecentDevalOpen(false);
                router.push('/devaluations');
              }}
              style={styles.primaryFinderCta}
            >
              <ShieldAlert size={17} color={LedgerTheme.colors.surface} />
              <Text style={styles.primaryFinderCtaText}>Open Full Devaluation Tracker</Text>
              <ArrowRight size={17} color={LedgerTheme.colors.surface} />
            </ScalePressable>
          </ScrollView>
        </View>
      </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 44,
  },
  headerBlock: {
    gap: 30,
    marginBottom: 20,
  },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 24,
    padding: 22,
    gap: 14,
    ...LedgerTheme.shadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  liveCountBadge: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  walletShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  walletShortcutText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroHeadline: {
    fontSize: 32,
    lineHeight: 39,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.7,
    marginTop: 2,
  },
  heroHeadlineAccent: {
    color: LedgerTheme.colors.accent,
  },
  heroLead: {
    fontSize: 16,
    lineHeight: 23,
    color: LedgerTheme.colors.inkSecondary,
  },
  searchPill: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairlineStrong,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 15.5,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 11,
  },
  sectionBlock: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.35,
  },
  sectionSub: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  resetPillText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  showcaseScroll: {
    gap: SHOWCASE_GAP,
    paddingVertical: 6,
    paddingRight: 18,
  },
  showcaseCard: {
    width: SHOWCASE_WIDTH,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
    ...LedgerTheme.shadow.card,
  },
  showcaseStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  showcaseLaneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showcaseArtCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  showcaseBody: {
    gap: 5,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showcaseBankText: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  showcaseTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  showcaseFooter: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(25,28,32,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  showcaseMetricLabel: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
  },
  showcaseMetricVal: {
    fontSize: 16.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  storyStack: {
    gap: 16,
  },
  advisorStoryCard: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  walletStoryCard: {
    backgroundColor: LedgerTheme.colors.creamWarm,
    borderWidth: 1,
    borderColor: '#E8D9BF',
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  storyIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: LedgerTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCopy: {
    flex: 1,
    gap: 4,
  },
  storyTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  storySub: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
  quickActionLinksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickPillLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  quickPillLinkText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  categoryBoxesScroll: {
    gap: 12,
    paddingVertical: 2,
    paddingRight: 8,
  },
  categorySquareBox: {
    width: 152,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 15,
    gap: 10,
    ...LedgerTheme.shadow.card,
  },
  categorySquareBoxActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.accent,
  },
  categoryBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: LedgerTheme.colors.creamWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCountPill: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  categoryCountPillActive: {
    color: LedgerTheme.colors.accent,
  },
  categoryBoxTitle: {
    fontSize: 16.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  expandedCategoryPanel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  expandedCardStack: {
    gap: 10,
  },
  widePreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 13,
  },
  widePreviewInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  widePreviewBank: {
    flex: 1,
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
  },
  widePreviewTitle: {
    fontSize: 16.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  widePreviewMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  widePreviewFee: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  widePreviewReturn: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  viewAllCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  viewAllCategoryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  offersTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  offersBadgeCount: {
    fontSize: 13.5,
    color: LedgerTheme.colors.accent,
    fontWeight: '500',
  },
  offersScroll: {
    gap: 12,
    paddingVertical: 2,
    paddingRight: 8,
  },
  offerCard: {
    width: 262,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    ...LedgerTheme.shadow.card,
  },
  offerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerBankLabel: {
    flex: 1,
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  offerTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  offerValid: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
  },
  devalBanner: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: '#EAD2AC',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  devalLeft: {
    flex: 1,
    gap: 2,
  },
  devalTag: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  devalText: {
    fontSize: 14.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  chipTextActive: {
    color: LedgerTheme.colors.surface,
  },
  emptyBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: LedgerTheme.colors.inkMuted,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 8,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyResetText: {
    color: LedgerTheme.colors.surface,
    fontSize: 14,
    fontWeight: '500',
  },
  footerGroup: {
    marginTop: 22,
    gap: 12,
  },
  primaryFinderCta: {
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: 18,
    paddingVertical: 17,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryFinderCtaText: {
    fontSize: 16,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  footerCta: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerCtaText: {
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  studio3DCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  studio3DHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studio3DBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studio3DEyebrow: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    letterSpacing: 0.4,
  },
  studio3DTitle: {
    fontSize: 16.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  studio3DSub: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  studioChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  studioChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  studioChipText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  studioChipTextActive: {
    color: '#FFFFFF',
  },
  storyThumbMini: {
    width: 48,
    height: 48,
    borderRadius: 12,
    resizeMode: 'cover',
    backgroundColor: LedgerTheme.colors.canvas,
  },
  devalModalScreen: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  devalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  devalModalEyebrow: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  devalModalTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
  },
  devalModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devalModalContent: {
    padding: 18,
    gap: 14,
    paddingBottom: 36,
  },
  devalModalCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  devalModalSectionLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
  },
  devalClauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  devalClauseText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkPrimary,
  },
  devalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  devalAffectedChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  devalAffectedChipOwned: {
    borderColor: 'rgba(180, 83, 9, 0.35)',
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  devalAffectedChipText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  expVisualCard: {
    width: 212,
    height: 134,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: '#1E293B',
  },
  expVisualImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  expVisualOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
  },
  expVisualIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expVisualTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  expVisualSub: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  homeSegmentBar: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: LedgerTheme.colors.surface,
    padding: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  homeSegmentPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  homeSegmentPillActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  homeSegmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: LedgerTheme.colors.inkSecondary,
  },
  homeSegmentTextActive: {
    color: '#FFFFFF',
  },
});
