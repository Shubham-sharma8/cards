import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  Globe,
  GraduationCap,
  MapPin,
  Phone,
  Plane,
  Plus,
  QrCode,
  Search,
  Star,
  Wallet,
  X,
  XCircle,
} from 'lucide-react-native';
import {
  ALL_BANKS,
  ALL_CARDS,
  DEVALUATION_TRACKER,
  GOLF_CLUBS_MASTER,
  LOUNGE_ACCESS_MASTER,
  LOUNGE_CATALOG,
  TOTAL_BANKS,
} from '../../src/lib/data';
import { getGolfPhotoSource, getLoungePhotoSource } from '../../src/lib/venuePhotos';
import { formatLoungeSourceType, matchesTokenizedQuery } from '../../src/lib/format';
import {
  evaluateAirportForOwnedCards,
  getAirportDirectory,
  getOnlineCardlessStatus,
  getShortQuotaLabel,
  getShortSpendLabel,
  parseCardLoungeAndGolfQuotas,
} from '../../src/lib/loungeChecker';
import { GOLF_PROGRAM_GUIDES } from '../../src/lib/golfGuide';
import { openExternalUrlSafely } from '../../src/lib/security';
import { LedgerTheme } from '../../src/lib/theme';
import { BankLogo } from '../../src/components/BankLogo';
import { CardArtwork } from '../../src/components/CardArtwork';
import { useCompare } from '../../src/components/CompareContext';
import {
  AnimatedProgressBar,
  AnimatedReveal,
  CalmFilterItem,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../../src/components/MotionPrimitives';
import type {
  BankSummary,
  CardSummaryItem,
  LoungeProgramEntry,
  LoungeSpot,
} from '../../src/lib/types';

type SubTab = 'my_cards' | 'golf' | 'matrix' | 'programs' | 'spots' | 'banks';

interface SpotWithProgram extends LoungeSpot {
  key: string;
  bank: string;
  programTitle: string;
  officialUrl: string;
}

const QUICK_HUB_CODES = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU'];

function findCardIdByPattern(
  cards: CardSummaryItem[],
  patterns: string[]
): string | null {
  for (const pat of patterns) {
    const q = pat.toLowerCase();
    const match = cards.find(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.card_id.toLowerCase().includes(q)
    );
    if (match) return match.card_id;
  }
  return null;
}

export default function LoungesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subTab?: string; airport?: string; card?: string }>();
  const { ownedIds } = useCompare();

  const airportDirectory = useMemo(
    () => getAirportDirectory(LOUNGE_ACCESS_MASTER),
    []
  );

  const [subTab, setSubTab] = useState<SubTab>(
    params.subTab === 'banks' ||
      params.subTab === 'spots' ||
      params.subTab === 'programs' ||
      params.subTab === 'matrix' ||
      params.subTab === 'my_cards' ||
      params.subTab === 'golf'
      ? params.subTab
      : 'my_cards'
  );
  const [focusedCardId, setFocusedCardId] = useState<string | null>(
    params.card ? String(params.card).trim() : null
  );
  const [selectedAirport, setSelectedAirport] = useState<string>('DEL');
  const [airportSearch, setAirportSearch] = useState('');
  const [airportHubFilter, setAirportHubFilter] = useState<'top' | 'intl' | 'all'>('top');
  const [terminalFilter, setTerminalFilter] = useState<'all' | 'domestic' | 'international'>('all');
  const [query, setQuery] = useState('');
  const [golfCourseQuery, setGolfCourseQuery] = useState('');
  const [golfFilter, setGolfFilter] = useState<'all' | 'games_lessons' | 'lessons' | 'unlimited'>('all');
  const [golfSubSection, setGolfSubSection] = useState<'cards' | 'clubs' | 'steps'>('clubs');
  const [expandedBlocked, setExpandedBlocked] = useState<Record<string, boolean>>({});
  const [expandedSpendGated, setExpandedSpendGated] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (
      params.subTab === 'banks' ||
      params.subTab === 'spots' ||
      params.subTab === 'programs' ||
      params.subTab === 'matrix' ||
      params.subTab === 'my_cards' ||
      params.subTab === 'golf'
    ) {
      setSubTab(params.subTab);
    }
    if (params.card !== undefined) {
      setFocusedCardId(params.card ? String(params.card).trim() : null);
    }
    if (params.airport) {
      const code = params.airport.trim().toUpperCase();
      if (airportDirectory.some((a) => a.airportCode === code)) {
        setSelectedAirport(code);
        setSubTab('my_cards');
      }
    }
  }, [params.subTab, params.airport, params.card, airportDirectory]);

  const cardById = useMemo(() => {
    const m = new Map<string, CardSummaryItem>();
    for (const c of ALL_CARDS) {
      m.set(c.card_id, c);
    }
    return m;
  }, []);

  const ownedCards = useMemo(
    () =>
      ownedIds
        .map((id) => cardById.get(id))
        .filter((c): c is CardSummaryItem => Boolean(c)),
    [ownedIds, cardById]
  );

  const focusedCard = useMemo(
    () => (focusedCardId ? cardById.get(focusedCardId) ?? null : null),
    [focusedCardId, cardById]
  );

  const activeEvalCards = useMemo(
    () => (focusedCard ? [focusedCard] : ownedCards),
    [focusedCard, ownedCards]
  );

  const golfEligibleCards = useMemo(() => {
    return ALL_CARDS.filter((c) => {
      const hasGolf = Boolean(
        c.filter_tags?.has_golf || c.golf_summary?.has_golf || c.categories.includes('Golf')
      );
      if (!hasGolf) return false;
      const quota = parseCardLoungeAndGolfQuotas(c);
      if (golfFilter === 'lessons') {
        return quota.golfLessonsPeriod !== 'none';
      }
      if (golfFilter === 'games_lessons') {
        return quota.golfGamesPeriod !== 'none' && quota.golfLessonsPeriod !== 'none';
      }
      if (golfFilter === 'unlimited') {
        return quota.golfGamesPeriod === 'unlimited' || quota.golfLessonsPeriod === 'unlimited';
      }
      return true;
    })
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 12);
  }, [golfFilter]);

  const quickPresets = useMemo(() => {
    const regaliaId = findCardIdByPattern(ALL_CARDS, ['regalia gold']);
    const airtelId = findCardIdByPattern(ALL_CARDS, ['airtel axis']);
    const hsbcLiveId = findCardIdByPattern(ALL_CARDS, ['hsbc live+']);
    const scapiaId = findCardIdByPattern(ALL_CARDS, ['scapia', 'ixigo']);
    const items = [
      regaliaId ? { label: '+ Regalia Gold', id: regaliaId } : null,
      airtelId ? { label: '+ Airtel Axis', id: airtelId } : null,
      hsbcLiveId ? { label: '+ HSBC Live+', id: hsbcLiveId } : null,
      scapiaId ? { label: '+ Scapia', id: scapiaId } : null,
    ].filter((x): x is { label: string; id: string } => Boolean(x));
    const trio = [regaliaId, airtelId, hsbcLiveId].filter((x): x is string =>
      Boolean(x)
    );
    return { items, trio };
  }, []);

  const filteredAirports = useMemo(() => {
    const q = airportSearch.trim().toLowerCase();
    if (q) {
      return airportDirectory
        .filter(
          (a) =>
            a.city.toLowerCase().includes(q) ||
            a.airportCode.toLowerCase().includes(q) ||
            (a.loungeNames || []).some((ln) => ln.toLowerCase().includes(q))
        )
        .slice(0, 18);
    }
    if (airportHubFilter === 'intl') {
      return airportDirectory.filter((a) => a.internationalCount > 0);
    }
    if (airportHubFilter === 'all') {
      return airportDirectory;
    }
    const topCodes = ['DEL', 'BOM', 'BLR', 'HYD', 'MAA', 'CCU', 'GOI', 'COK'];
    return topCodes
      .map((code) => airportDirectory.find((a) => a.airportCode === code))
      .filter((a): a is NonNullable<typeof a> => Boolean(a));
  }, [airportDirectory, airportSearch, airportHubFilter]);

  const airportReport = useMemo(
    () =>
      evaluateAirportForOwnedCards(
        selectedAirport,
        LOUNGE_ACCESS_MASTER,
        activeEvalCards
      ),
    [selectedAirport, activeEvalCards]
  );

  const cardToLoungeRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (LOUNGE_ACCESS_MASTER.participating_indian_airport_lounges || []).filter((spot) => {
      if (focusedCard) {
        const codes = new Set((focusedCard.accessible_lounge_codes || []).map((x) => x.toUpperCase()));
        if (spot.lounge_code && !codes.has(spot.lounge_code.toUpperCase())) return false;
      }
      if (!q) return true;
      const sampleCardHit = [...(spot.eligible_no_spend_card_ids || []), ...(spot.eligible_low_spend_card_ids || [])]
        .slice(0, 20)
        .some((cid) => {
          const c = cardById.get(cid);
          return c ? c.card_name.toLowerCase().includes(q) || c.bank.toLowerCase().includes(q) : false;
        });
      return (
        spot.city.toLowerCase().includes(q) ||
        spot.lounge_name.toLowerCase().includes(q) ||
        spot.airport_code.toLowerCase().includes(q) ||
        spot.terminal.toLowerCase().includes(q) ||
        sampleCardHit
      );
    });
    return list;
  }, [query, focusedCard, cardById]);

  const programs = useMemo(
    () =>
      Object.values(LOUNGE_CATALOG.programs || {}).sort((a, b) =>
        a.bank.localeCompare(b.bank)
      ),
    []
  );

  const allSpots = useMemo(() => {
    const out: SpotWithProgram[] = [];
    for (const p of programs) {
      for (const s of p.parsed_lounges || []) {
        out.push({
          ...s,
          key: `${p.program_id}_${s.city}_${s.lounge_name}_${s.terminal}`,
          bank: p.bank,
          programTitle: p.title,
          officialUrl: p.official_url,
        });
      }
    }
    return out;
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) =>
        p.bank.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.parsed_lounges || []).some(
          (s) =>
            s.city.toLowerCase().includes(q) ||
            s.lounge_name.toLowerCase().includes(q) ||
            s.terminal.toLowerCase().includes(q)
        )
    );
  }, [programs, query]);

  const filteredSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? allSpots
      : allSpots.filter(
          (s) =>
            s.city.toLowerCase().includes(q) ||
            s.lounge_name.toLowerCase().includes(q) ||
            s.terminal.toLowerCase().includes(q) ||
            s.bank.toLowerCase().includes(q)
        );
    return list.slice(0, 120);
  }, [allSpots, query]);

  const filteredBanks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...ALL_BANKS].sort((a, b) => b.total_cards - a.total_cards);
    if (!q) return sorted;
    return sorted.filter((b) => b.bank.toLowerCase().includes(q));
  }, [query]);

  const openUrl = (url?: string) => {
    void openExternalUrlSafely(url);
  };

  const renderProgram = ({ item }: { item: LoungeProgramEntry }) => (
    <CalmFilterItem>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={styles.bankInlineRow}>
              <BankLogo bank={item.bank} size="xs" />
              <Text style={styles.bankEyebrow}>{item.bank}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {item.parsed_lounges_count > 0
                ? `${item.parsed_lounges_count} lounges`
                : formatLoungeSourceType(item.source_type)}
            </Text>
          </View>
        </View>

        {(item.parsed_lounges || []).length > 0 && (
          <View style={styles.previewSpots}>
            {item.parsed_lounges.slice(0, 3).map((spot, idx) => (
              <Text key={`${spot.city}_${idx}`} numberOfLines={1} style={styles.spotLine}>
                · {spot.city}: {spot.lounge_name} ({spot.terminal || spot.terminal_type})
              </Text>
            ))}
          </View>
        )}

        <View style={styles.linksRow}>
          <ScalePressable
            onPress={() => openUrl(item.official_url)}
            style={styles.linkBtnPrimary}
          >
            <ExternalLink size={15} color={LedgerTheme.colors.accent} />
            <Text style={styles.linkBtnPrimaryText}>Official Lounge List</Text>
          </ScalePressable>
          {item.secondary_url ? (
            <ScalePressable
              onPress={() => openUrl(item.secondary_url)}
              style={styles.linkBtnSecondary}
            >
              <Text style={styles.linkBtnSecondaryText}>Alternate PDF</Text>
            </ScalePressable>
          ) : null}
        </View>
      </View>
    </CalmFilterItem>
  );

  const renderSpot = ({ item }: { item: SpotWithProgram }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.cityRow}>
            <MapPin size={14} color={LedgerTheme.colors.accent} />
            <Text style={styles.bankEyebrow}>{item.city}</Text>
            <Text style={styles.terminalTag}>{item.terminal_type}</Text>
          </View>
          <Text style={styles.cardTitle}>{item.lounge_name}</Text>
          <View style={styles.bankInlineRow}>
            <BankLogo bank={item.bank} size="xs" />
            <Text numberOfLines={1} style={styles.spotSub}>
              {item.terminal ? `${item.terminal} · ` : ''}
              {item.bank} ({item.programTitle})
            </Text>
          </View>
        </View>
        <ScalePressable
          onPress={() => openUrl(item.officialUrl)}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <ExternalLink size={16} color={LedgerTheme.colors.accent} />
        </ScalePressable>
      </View>
    </View>
  );

  const renderBank = ({ item }: { item: BankSummary }) => {
    const devalProfile = DEVALUATION_TRACKER.issuer_devaluation_profiles[item.bank];
    const riskHigh = (devalProfile?.risk_score ?? 0) >= 6.5;
    return (
      <ScalePressable
        onPress={() =>
          router.push({
            pathname: '/(tabs)/finder',
            params: { bankSlug: item.bank_slug },
          })
        }
        style={styles.card}
      >
        <View style={styles.cardHeader}>
          <BankLogo bankSlug={item.bank_slug} bank={item.bank} size="md" />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.cardTitle}>{item.bank}</Text>
            <Text style={styles.spotSub}>
              {item.total_cards} cards · {item.ltf_count} LTF · {item.domestic_lounge_count} Lounge
            </Text>
          </View>
          <ChevronRight size={18} color={LedgerTheme.colors.inkMuted} />
        </View>

        <View style={styles.bankMetricsRow}>
          <View style={styles.pillMuted}>
            <Text style={styles.pillMutedText}>UPI: {item.rupay_upi_count}</Text>
          </View>
          <View style={styles.pillMuted}>
            <Text style={styles.pillMutedText}>
              Low Forex: {item.zero_or_low_forex_count}
            </Text>
          </View>
          {devalProfile && (
            <View style={[styles.pillMuted, riskHigh && styles.pillWarn]}>
              <Text style={[styles.pillMutedText, riskHigh && styles.pillWarnText]}>
                Deval Risk {devalProfile.risk_score.toFixed(1)}/10
              </Text>
            </View>
          )}
        </View>
      </ScalePressable>
    );
  };

  const rules = LOUNGE_CATALOG.network_rules;

  const segmentedHeader = (
    <View style={styles.headerBlock}>
      {/* Editorial Indian Airport VIP Lounge Visual Hero */}
      <View style={styles.loungeHeroBanner}>
        <Image
          source={require('../../assets/illustrations/airport-lounge-hero.webp')}
          style={styles.loungeHeroImg}
        />
        <View style={styles.loungeHeroOverlay}>
          <Text style={styles.loungeHeroBadge}>
            {airportDirectory.length} Airports · {programs.length} Official Lists
          </Text>
          <Text style={styles.loungeHeroTitle}>
            Airport Lounge &amp; Golf Concierge
          </Text>
        </View>
      </View>

      {/* Segmented Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentedScroll}
      >
        {[
          { id: 'my_cards' as SubTab, label: 'Airport Check', icon: 'wallet' },
          { id: 'matrix' as SubTab, label: 'Card-Lounge Table', icon: 'pin' },
          { id: 'golf' as SubTab, label: 'Golf Claim', icon: 'golf' },
          {
            id: 'programs' as SubTab,
            label: `Programs (${programs.length})`,
            icon: 'plane',
          },
          {
            id: 'spots' as SubTab,
            label: 'Terminals',
            icon: 'pin',
          },
          {
            id: 'banks' as SubTab,
            label: `${TOTAL_BANKS} Banks`,
            icon: 'bank',
          },
        ].map((tab) => {
          const active = subTab === tab.id;
          const color = active
            ? LedgerTheme.colors.surface
            : LedgerTheme.colors.inkSecondary;
          return (
            <ScalePressable
              key={tab.id}
              onPress={() => {
                triggerCalmLayoutTransition();
                setSubTab(tab.id);
              }}
              style={[styles.segBtn, active && styles.segBtnActive]}
            >
              {tab.icon === 'wallet' && <Wallet size={15} color={color} />}
              {tab.icon === 'golf' && <Flag size={15} color={color} />}
              {tab.icon === 'plane' && <Plane size={15} color={color} />}
              {tab.icon === 'pin' && <MapPin size={15} color={color} />}
              {tab.icon === 'bank' && <Building2 size={15} color={color} />}
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {tab.label}
              </Text>
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* Focused Card Banner (when launched from My Cards Check Airport & Golf) */}
      {focusedCard && (
        <View style={styles.compactGuideBanner}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.compactGuideText} numberOfLines={1}>
              Filtering Airport &amp; Golf for {focusedCard.card_name}
            </Text>
            <Text style={styles.spotNote} numberOfLines={1}>
              {focusedCard.domestic_lounge_accessible_count || 0} Indian lounges · {(focusedCard.accessible_golf_slugs || []).length} golf clubs
            </Text>
          </View>
          <ScalePressable
            onPress={() => {
              setFocusedCardId(null);
              router.setParams({ card: undefined } as never);
            }}
            style={styles.spotPortalPill}
          >
            <Text style={styles.spotPortalPillText}>Show All</Text>
          </ScalePressable>
        </View>
      )}

      {subTab !== 'my_cards' && subTab !== 'golf' && (
        <>
          <View style={styles.searchBox}>
            <Search size={17} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={(text) => {
                triggerCalmLayoutTransition();
                setQuery(text);
              }}
              placeholder={
                subTab === 'programs'
                  ? 'Search bank or city (HDFC, Delhi, T3)...'
                  : subTab === 'matrix'
                    ? 'Search lounge, city (DEL, BOM) or card name...'
                    : subTab === 'spots'
                      ? 'Search city, terminal, or lounge...'
                      : `Search ${TOTAL_BANKS} Indian issuing banks...`
              }
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.searchInput}
            />
          </View>

          {subTab !== 'banks' && (
            <ScalePressable
              onPress={() => router.push('/lounge-guide' as never)}
              accessibilityRole="button"
              accessibilityLabel="Open QR claim guide and portal directory"
              style={styles.compactGuideBanner}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <QrCode size={16} color={LedgerTheme.colors.accent} />
                <Text style={styles.compactGuideText} numberOfLines={1}>
                  QR Portals, Priority Pass Traps &amp; Rules
                </Text>
              </View>
              <ChevronRight size={16} color={LedgerTheme.colors.accent} />
            </ScalePressable>
          )}
        </>
      )}
    </View>
  );

  if (subTab === 'my_cards') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}
        contentContainerStyle={styles.listContent}
      >
        {segmentedHeader}

        {/* Airport Picker */}
        <View style={styles.card}>
          <View style={styles.sectionTopRow}>
            <Text style={styles.sectionTitle}>
              1. Pick Indian Airport ({airportDirectory.length})
            </Text>
            <Text style={styles.sectionHint}>
              Selected: {selectedAirport}
            </Text>
          </View>

          <View style={styles.searchBoxInner}>
            <Search size={16} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={airportSearch}
              onChangeText={setAirportSearch}
              placeholder="Search city, code, or lounge (Privé, BOM, DEL, GAU)..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.searchInput}
            />
            {airportSearch.length > 0 && (
              <ScalePressable onPress={() => setAirportSearch('')} hitSlop={8}>
                <X size={16} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            )}
          </View>

          {!airportSearch.trim() && (
            <View style={styles.termFilterRow}>
              {[
                { id: 'top' as const, label: 'Top 8 Hubs' },
                { id: 'intl' as const, label: 'Int\'l Terminals' },
                { id: 'all' as const, label: `All (${airportDirectory.length})` },
              ].map((pill) => {
                const active = airportHubFilter === pill.id;
                return (
                  <ScalePressable
                    key={pill.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setAirportHubFilter(pill.id);
                    }}
                    style={[
                      styles.termFilterPill,
                      active && styles.termFilterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.termFilterText,
                        active && styles.termFilterTextActive,
                      ]}
                    >
                      {pill.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>
          )}

          <View style={styles.airportHubGrid}>
            {filteredAirports.map((ap) => {
              const active = selectedAirport === ap.airportCode;
              return (
                <ScalePressable
                  key={ap.airportCode}
                  onPress={() => {
                    triggerCalmLayoutTransition();
                    setSelectedAirport(ap.airportCode);
                  }}
                  style={[styles.airportHubCard, active && styles.airportHubCardActive]}
                >
                  <View style={styles.airportHubTop}>
                    <Text
                      style={[
                        styles.airportIataCode,
                        active && styles.airportHubTextActive,
                      ]}
                    >
                      {ap.airportCode}
                    </Text>
                    {ap.topRating ? (
                      <View
                        style={[
                          styles.airportRatingBadge,
                          active && styles.airportRatingBadgeActive,
                        ]}
                      >
                        <Star
                          size={10}
                          color={active ? '#FFFFFF' : '#B45309'}
                          fill={active ? '#FFFFFF' : '#B45309'}
                        />
                        <Text
                          style={[
                            styles.airportRatingText,
                            active && styles.airportHubTextActive,
                          ]}
                        >
                          {ap.topRating.toFixed(1)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.airportCityName,
                      active && styles.airportHubTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ap.city}
                  </Text>
                  <Text
                    style={[
                      styles.airportMetaLine,
                      active && styles.airportHubMetaActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ap.totalSpots} lounges
                    {ap.internationalCount > 0 ? ` · ${ap.internationalCount} Int'l` : ''}
                  </Text>
                </ScalePressable>
              );
            })}
          </View>
        </View>

        {/* Quiet My Cards Status Bar (Removed bulky "Your Wallet" panel) */}
        <ScalePressable
          onPress={() => router.push('/(tabs)/my-cards' as never)}
          style={[styles.card, { marginTop: 14, paddingVertical: 12 }]}
        >
          <View style={styles.sectionTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Wallet size={16} color={LedgerTheme.colors.accent} />
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {focusedCard
                  ? `Checking 1 card: ${focusedCard.card_name}`
                  : ownedCards.length > 0
                    ? `Checking ${ownedCards.length} Saved Card${ownedCards.length === 1 ? '' : 's'} from My Cards`
                    : 'No Saved Cards Yet — Add in My Cards'}
              </Text>
            </View>
            <Text style={styles.manageLink}>My Cards →</Text>
          </View>
        </ScalePressable>

        {/* Verdict Banner */}
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.bankEyebrow}>
            {airportReport.airportCode} Terminal Access Verdict
          </Text>
          <Text style={styles.airportHeadline}>
            {airportReport.city} ({airportReport.airportCode}) · {airportReport.totalSpots}{' '}
            Lounge{airportReport.totalSpots === 1 ? '' : 's'}
          </Text>
          <Text style={styles.spotSub}>
            {activeEvalCards.length === 0
              ? `Listing all participating terminals at ${airportReport.city}. Add your cards in My Cards to verify entry automatically.`
              : `With ${activeEvalCards.length} active card${activeEvalCards.length === 1 ? '' : 's'}: ${airportReport.accessibleNoSpendCount} unconditional, ${airportReport.spendGatedCount} spend-gated, ${airportReport.notCoveredCount} not covered.`}
          </Text>

          {activeEvalCards.length > 0 && airportReport.totalSpots > 0 && (
            <View style={styles.coverageWrap}>
              {(() => {
                const covered =
                  airportReport.accessibleNoSpendCount + airportReport.spendGatedCount;
                const pct = Math.round((covered / airportReport.totalSpots) * 100);
                return (
                  <>
                    <Text style={styles.coverageLabel}>
                      {covered}/{airportReport.totalSpots} terminals covered ({pct}%)
                    </Text>
                    <AnimatedProgressBar percent={pct} height={7} />
                  </>
                );
              })()}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statTile, styles.statTileOk]}>
              <Text style={[styles.statVal, { color: LedgerTheme.colors.accent }]}>
                {airportReport.accessibleNoSpendCount}
              </Text>
              <Text style={[styles.statLbl, { color: LedgerTheme.colors.accent }]}>
                No-Spend Open
              </Text>
            </View>
            <View style={[styles.statTile, styles.statTileWarn]}>
              <Text style={[styles.statVal, { color: LedgerTheme.colors.warn }]}>
                {airportReport.spendGatedCount}
              </Text>
              <Text style={[styles.statLbl, { color: LedgerTheme.colors.warn }]}>
                Spend-Gated
              </Text>
            </View>
            <View style={[styles.statTile, styles.statTileMuted]}>
              <Text style={[styles.statVal, { color: LedgerTheme.colors.inkSecondary }]}>
                {airportReport.notCoveredCount}
              </Text>
              <Text style={[styles.statLbl, { color: LedgerTheme.colors.inkSecondary }]}>
                Not Covered
              </Text>
            </View>
          </View>
        </View>

        {/* Compact QR Portal & Claim Guide Action Bar (Moved to dedicated /lounge-guide page) */}
        <ScalePressable
          onPress={() =>
            router.push({
              pathname: '/lounge-guide',
              params: { airport: airportReport.airportCode },
            } as never)
          }
          accessibilityRole="button"
          accessibilityLabel={`Open QR portals and claim steps for ${airportReport.airportCode}`}
          style={[styles.card, { marginTop: 14, paddingVertical: 14 }]}
        >
          <View style={styles.sectionTopRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <View style={styles.guideIconCircle}>
                <QrCode size={17} color={LedgerTheme.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.sectionTitle}>
                  Claim Online QR ({airportReport.claimPortals.map((p) => p.name).join(' · ')})
                </Text>
                <Text style={styles.spotNote} numberOfLines={1}>
                  See which portal fits {airportReport.airportCode} &amp; 4-step phone QR guide
                </Text>
              </View>
            </View>
            <View style={styles.openGuidePill}>
              <Text style={styles.openGuidePillText}>Guide</Text>
              <ChevronRight size={14} color="#FFFFFF" />
            </View>
          </View>
          {airportReport.bestTerminalTip ? (
            <View style={styles.bestTipBox}>
              <Award size={15} color={LedgerTheme.colors.accent} style={{ marginTop: 1 }} />
              <Text style={styles.bestTipText}>{airportReport.bestTerminalTip}</Text>
            </View>
          ) : null}
        </ScalePressable>

        {/* Terminal Type Filter Pills */}
        <View style={styles.termFilterRow}>
          {(
            [
              ['all', `All (${airportReport.spotEvaluations.length})`],
              ['domestic', 'Domestic'],
              ['international', 'International'],
            ] as const
          ).map(([id, label]) => {
            const active = terminalFilter === id;
            return (
              <ScalePressable
                key={id}
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setTerminalFilter(id);
                }}
                style={[styles.termFilterPill, active && styles.termFilterPillActive]}
              >
                <Text
                  style={[styles.termFilterText, active && styles.termFilterTextActive]}
                >
                  {label}
                </Text>
              </ScalePressable>
            );
          })}
        </View>

        {/* Terminal Spot Cards */}
        <View style={{ gap: 16, marginTop: 12 }}>
          {airportReport.spotEvaluations
            .filter((ev) => {
              if (focusedCard && ev.verdict === 'not_covered') return false;
              return terminalFilter === 'all'
                ? true
                : /international/i.test(ev.spot.terminal_type) ===
                  (terminalFilter === 'international');
            })
            .map((ev) => {
            const { spot, verdict, noSpendCards, spendGatedCards, blockedCards, bestLoungeBadge, claimPortals } = ev;
            const isIntl = /international/i.test(spot.terminal_type);
            const coverImg = getLoungePhotoSource(spot.local_photo_path, isIntl);
            const spendExpanded = Boolean(expandedSpendGated[spot.lounge_code]);
            return (
              <CalmFilterItem key={spot.lounge_code}>
                <View style={[styles.card, styles.spotCardBleed, bestLoungeBadge && styles.bestTerminalCard]}>
                  <ScalePressable
                    onPress={() => router.push(`/lounge/${spot.lounge_code}` as never)}
                  >
                    <View style={styles.spotCoverWrap}>
                      <Image source={coverImg} style={styles.spotCoverImg} />
                      <View style={styles.spotCoverOverlay}>
                        <View style={styles.termBadgeOverlay}>
                          <Text style={styles.termBadgeOverlayText}>{spot.terminal}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {typeof spot.google_rating === 'number' && (
                            <View style={styles.googleRatingOverlay}>
                              <Star size={11} color="#FBBF24" fill="#FBBF24" />
                              <Text style={styles.googleRatingOverlayText}>
                                {spot.google_rating.toFixed(1)}
                                {spot.google_review_count
                                  ? ` (${spot.google_review_count.toLocaleString('en-IN')})`
                                  : ''}
                              </Text>
                            </View>
                          )}
                          {bestLoungeBadge ? (
                            <View style={styles.bestBadgePill}>
                              <Award size={11} color={LedgerTheme.colors.surface} />
                              <Text style={styles.bestBadgeText}>{bestLoungeBadge.label}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </ScalePressable>
                  <View style={styles.spotCardBody}>
                  <ScalePressable
                    onPress={() => router.push(`/lounge/${spot.lounge_code}` as never)}
                    style={styles.cardHeader}
                  >
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.cityRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            isIntl && { backgroundColor: LedgerTheme.colors.tintPrimary },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              isIntl && { color: LedgerTheme.colors.accent },
                            ]}
                          >
                            {spot.terminal_type}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardTitle}>{spot.lounge_name}</Text>
                      {bestLoungeBadge ? (
                        <Text style={styles.bestReasonText}>{bestLoungeBadge.reason}</Text>
                      ) : null}
                    </View>

                    {activeEvalCards.length > 0 && (
                      <View
                        style={[
                          styles.verdictPill,
                          verdict === 'accessible_no_spend' && styles.verdictOk,
                          verdict === 'spend_gated' && styles.verdictWarn,
                        ]}
                      >
                        {verdict === 'accessible_no_spend' && (
                          <CheckCircle2 size={14} color={LedgerTheme.colors.accent} />
                        )}
                        {verdict === 'spend_gated' && (
                          <Clock size={14} color={LedgerTheme.colors.warn} />
                        )}
                        {verdict === 'not_covered' && (
                          <XCircle size={14} color={LedgerTheme.colors.inkMuted} />
                        )}
                        <Text
                          style={[
                            styles.verdictText,
                            verdict === 'accessible_no_spend' && {
                              color: LedgerTheme.colors.accent,
                            },
                            verdict === 'spend_gated' && {
                              color: LedgerTheme.colors.warn,
                            },
                          ]}
                        >
                          {verdict === 'accessible_no_spend'
                            ? 'Accessible'
                            : verdict === 'spend_gated'
                              ? 'Spend-Gated'
                              : 'Not Covered'}
                        </Text>
                      </View>
                    )}
                  </ScalePressable>

                  <Text style={styles.spotAcceptLine}>
                    Accepts: {spot.accepted_networks.join(' · ')}
                  </Text>

                  {noSpendCards.length > 0 && (
                    <View style={{ gap: 8 }}>
                      <Text style={styles.cardUseLabel}>Use for Free Entry</Text>
                      {noSpendCards.map((item) => {
                        const primaryPortal = claimPortals[0];
                        return (
                          <ScalePressable
                            key={`ok-${item.card.card_id}`}
                            onPress={() =>
                              router.push({
                                pathname: '/card/[bankSlug]/[cardSlug]',
                                params: {
                                  bankSlug: item.card.bank_slug,
                                  cardSlug: item.card.card_slug,
                                },
                              })
                            }
                            style={styles.qualOkBox}
                          >
                            <View style={styles.qualTopRow}>
                              <BankLogo
                                bankSlug={item.card.bank_slug}
                                bank={item.card.bank}
                                size="xs"
                              />
                              <Text style={styles.qualCardName} numberOfLines={1}>
                                {item.card.card_name}
                              </Text>
                              <View style={styles.quotaPillOk}>
                                <Text style={styles.quotaPillOkText}>
                                  {getShortQuotaLabel(item.quotaSummary)}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.qualOneLiner} numberOfLines={1}>
                              {item.matchedNetwork} · Online QR via {primaryPortal?.name || 'Portal'}
                            </Text>
                          </ScalePressable>
                        );
                      })}
                    </View>
                  )}

                  {spendGatedCards.length > 0 && (
                    <View style={styles.blockedCollapseWrap}>
                      <ScalePressable
                        onPress={() =>
                          setExpandedSpendGated((prev) => ({
                            ...prev,
                            [spot.lounge_code]: !prev[spot.lounge_code],
                          }))
                        }
                        style={[styles.blockedToggleBtn, { backgroundColor: '#FEF6EA', borderColor: '#E9CFA6' }]}
                      >
                        <Text style={[styles.blockedToggleText, { color: '#9A5B13' }]}>
                          {spendGatedCards.length} spend-gated card{spendGatedCards.length === 1 ? '' : 's'} (prior spend required)
                        </Text>
                        <Text style={[styles.blockedToggleAction, { color: '#9A5B13' }]}>
                          {spendExpanded ? 'Hide' : 'Show'}
                        </Text>
                      </ScalePressable>
                      {spendExpanded && (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          {spendGatedCards.map((item) => (
                            <ScalePressable
                              key={`sg-${item.card.card_id}`}
                              onPress={() =>
                                router.push({
                                  pathname: '/card/[bankSlug]/[cardSlug]',
                                  params: {
                                    bankSlug: item.card.bank_slug,
                                    cardSlug: item.card.card_slug,
                                  },
                                })
                              }
                              style={styles.qualWarnBox}
                            >
                              <View style={styles.qualTopRow}>
                                <BankLogo
                                  bankSlug={item.card.bank_slug}
                                  bank={item.card.bank}
                                  size="xs"
                                />
                                <Text style={styles.qualCardName} numberOfLines={1}>
                                  {item.card.card_name}
                                </Text>
                                <View style={styles.quotaPillWarn}>
                                  <Text style={styles.quotaPillWarnText}>
                                    {getShortSpendLabel(item.spendCondition)}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.qualOneLinerWarn} numberOfLines={1}>
                                {getShortQuotaLabel(item.quotaSummary)} · {item.matchedNetwork}
                              </Text>
                            </ScalePressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {blockedCards.length > 0 && (
                    <View style={styles.blockedCollapseWrap}>
                      <ScalePressable
                        onPress={() =>
                          setExpandedBlocked((prev) => ({
                            ...prev,
                            [spot.lounge_code]: !prev[spot.lounge_code],
                          }))
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                          expandedBlocked[spot.lounge_code]
                            ? 'Hide blocked wallet cards'
                            : `Show ${blockedCards.length} blocked wallet cards`
                        }
                        style={styles.blockedToggleBtn}
                      >
                        <Text style={styles.blockedToggleText}>
                          {blockedCards.length} wallet card{blockedCards.length === 1 ? '' : 's'} not covered here
                        </Text>
                        <Text style={styles.blockedToggleAction}>
                          {expandedBlocked[spot.lounge_code] ? 'Hide' : 'View'}
                        </Text>
                      </ScalePressable>
                      {expandedBlocked[spot.lounge_code] && (
                        <View style={styles.blockedBox}>
                          {blockedCards.map((b) => (
                            <Text key={`blk-${b.card.card_id}`} style={styles.blockedItem}>
                              · {b.card.card_name}: {b.reason}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {spot.terminal_and_hours ? (
                    <Text style={styles.spotNote} numberOfLines={1}>
                      {spot.terminal_and_hours}
                    </Text>
                  ) : null}
                  <View style={styles.spotPortalRow}>
                    <ScalePressable
                      onPress={() => router.push(`/lounge/${spot.lounge_code}` as never)}
                      style={styles.spotPortalPillPrimary}
                    >
                      <Text style={styles.spotPortalPillPrimaryText}>
                        Details, 6 Photos &amp; Reviews
                      </Text>
                      <ChevronRight size={13} color="#FFFFFF" />
                    </ScalePressable>
                    {claimPortals[0] ? (
                      <ScalePressable
                        onPress={() => openUrl(claimPortals[0].url)}
                        style={styles.spotPortalPill}
                      >
                        <QrCode size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.spotPortalPillText}>
                          {claimPortals[0].name}
                        </Text>
                      </ScalePressable>
                    ) : null}
                    {spot.google_maps_url ? (
                      <ScalePressable
                        onPress={() => openUrl(spot.google_maps_url!)}
                        style={styles.spotPortalPill}
                      >
                        <MapPin size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.spotPortalPillText}>Maps</Text>
                      </ScalePressable>
                    ) : null}
                  </View>
                  </View>
                </View>
              </CalmFilterItem>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (subTab === 'matrix') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}
        contentContainerStyle={styles.listContent}
      >
        {segmentedHeader}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Which Card Works at Which Lounge ({cardToLoungeRows.length} Indian Lounges)
          </Text>
          <Text style={styles.spotSub}>
            Spend-free cards appear first for every terminal. Tap any lounge to inspect photos, reviews, hours &amp; live wallet status.
          </Text>
          <View style={{ gap: 10 }}>
            {cardToLoungeRows.slice(0, 80).map((spot) => {
              const noSpend = (spot.eligible_no_spend_card_ids || [])
                .map((id) => cardById.get(id))
                .filter((c): c is CardSummaryItem => Boolean(c));
              const lowSpend = (spot.eligible_low_spend_card_ids || [])
                .map((id) => cardById.get(id))
                .filter((c): c is CardSummaryItem => Boolean(c));
              return (
                <ScalePressable
                  key={`mtx-${spot.lounge_code}`}
                  onPress={() => router.push(`/lounge/${spot.lounge_code}` as never)}
                  style={{
                    backgroundColor: LedgerTheme.colors.canvas,
                    borderWidth: 1,
                    borderColor: LedgerTheme.colors.hairline,
                    borderRadius: 12,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[styles.cardTitle, { fontSize: 14.5, flex: 1 }]} numberOfLines={1}>
                      {spot.city} ({spot.airport_code}) · {spot.lounge_name}
                    </Text>
                    <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                  </View>
                  <Text style={styles.spotNote} numberOfLines={1}>
                    {spot.terminal} · {spot.terminal_type}
                    {spot.google_rating ? ` · ★ ${spot.google_rating.toFixed(1)}` : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: LedgerTheme.colors.accent, fontWeight: '600' }} numberOfLines={2}>
                    Spend-free ({noSpend.length + lowSpend.length}):{' '}
                    {[...noSpend, ...lowSpend]
                      .slice(0, 4)
                      .map((c) => c.card_name)
                      .join(', ') || 'Check portal'}
                  </Text>
                </ScalePressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }

  if (subTab === 'golf') {
    const gq = golfCourseQuery.trim().toLowerCase();
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}
        contentContainerStyle={styles.listContent}
      >
        {segmentedHeader}
        <View style={{ gap: 16 }}>
          {/* Golf Section Switcher (Avoids pushing cards + clubs + helpline manuals onto 1 screen) */}
          <View style={styles.golfSubSegRow}>
            {[
              { id: 'cards' as const, label: `Eligible Cards (${golfEligibleCards.length})` },
              { id: 'clubs' as const, label: `Golf Clubs (${GOLF_CLUBS_MASTER.clubs_count})` },
              { id: 'steps' as const, label: 'Booking Portals' },
            ].map((item) => {
              const active = golfSubSection === item.id;
              return (
                <ScalePressable
                  key={item.id}
                  onPress={() => {
                    triggerCalmLayoutTransition();
                    setGolfSubSection(item.id);
                  }}
                  style={[styles.golfSubSegBtn, active && styles.golfSubSegBtnActive]}
                >
                  <Text
                    style={[styles.golfSubSegText, active && styles.golfSubSegTextActive]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </ScalePressable>
              );
            })}
          </View>

          {/* Cards with Golf Play & Coaching Lessons */}
          {golfSubSection === 'cards' && (
          <View style={styles.card}>
            <View style={styles.sectionTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <GraduationCap size={17} color={LedgerTheme.colors.accent} />
                <Text style={styles.sectionTitle}>Golf Play &amp; Lesson Cards</Text>
              </View>
              <Text style={styles.sectionHint}>{golfEligibleCards.length} top matches</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.termFilterRow}
            >
              {[
                { id: 'all', label: 'All Golf Cards' },
                { id: 'games_lessons', label: 'Games + Lessons' },
                { id: 'lessons', label: 'Lessons Included' },
                { id: 'unlimited', label: 'Unlimited Play' },
              ].map((pill) => {
                const active = golfFilter === pill.id;
                return (
                  <ScalePressable
                    key={pill.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setGolfFilter(pill.id as typeof golfFilter);
                    }}
                    style={[styles.termFilterPill, active && styles.termFilterPillActive]}
                  >
                    <Text style={[styles.termFilterText, active && styles.termFilterTextActive]}>
                      {pill.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>

            <View style={{ gap: 10 }}>
              {golfEligibleCards.map((c) => {
                const quota = parseCardLoungeAndGolfQuotas(c);
                return (
                  <ScalePressable
                    key={c.card_id}
                    onPress={() =>
                      router.push({
                        pathname: '/card/[bankSlug]/[cardSlug]',
                        params: { bankSlug: c.bank_slug, cardSlug: c.card_slug },
                      })
                    }
                    style={styles.qualOkBox}
                  >
                    <View style={styles.qualTopRow}>
                      <CardArtwork
                        localImagePath={c.local_image_path}
                        bank={c.bank}
                        cardName={c.card_name}
                        network={c.card_network}
                        size="sm"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qualCardName} numberOfLines={1}>
                          {c.card_name}
                        </Text>
                        <Text style={styles.qualMeta} numberOfLines={2}>
                          {quota.golfSummaryText}
                        </Text>
                      </View>
                      <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {quota.golfGamesPeriod !== 'none' && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>
                            Games:{' '}
                            {quota.golfGamesTotal === null
                              ? 'Unlimited'
                              : `${quota.golfGamesTotal} / ${quota.golfGamesPeriod}`}
                          </Text>
                        </View>
                      )}
                      {quota.golfLessonsPeriod !== 'none' && (
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>
                            Lessons:{' '}
                            {quota.golfLessonsTotal === null
                              ? 'Unlimited'
                              : `${quota.golfLessonsTotal} / ${quota.golfLessonsPeriod}`}
                          </Text>
                        </View>
                      )}
                    </View>
                  </ScalePressable>
                );
              })}
            </View>
          </View>
          )}

          {golfSubSection === 'clubs' && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Flag size={16} color={LedgerTheme.colors.accent} />
                <Text style={styles.sectionTitle}>
                  Indian Golf Clubs ({GOLF_CLUBS_MASTER.clubs_count})
                </Text>
              </View>
              <Text style={styles.sectionHint}>Google Maps Photos</Text>
            </View>
            <Text style={styles.spotSub}>
              Verified Indian golf clubs participating across HDFC, ICICI, Axis Burgundy, RuPay Select &amp; Mastercard networks.
            </Text>
            <View style={styles.searchBoxInner}>
              <Search size={15} color={LedgerTheme.colors.inkMuted} />
              <TextInput
                value={golfCourseQuery}
                onChangeText={setGolfCourseQuery}
                placeholder="Search golf club or city (Delhi, KGA, BPGC, Oxford)..."
                placeholderTextColor={LedgerTheme.colors.inkMuted}
                style={styles.searchInput}
              />
              {golfCourseQuery.length > 0 && (
                <ScalePressable onPress={() => setGolfCourseQuery('')} hitSlop={8}>
                  <X size={15} color={LedgerTheme.colors.inkMuted} />
                </ScalePressable>
              )}
            </View>
            <View style={{ gap: 12 }}>
              {GOLF_CLUBS_MASTER.clubs
                .filter((cl) => {
                  if (focusedCard && focusedCard.accessible_golf_slugs?.length) {
                    if (!focusedCard.accessible_golf_slugs.includes(cl.slug)) return false;
                  }
                  return (
                    !gq ||
                    cl.club_name.toLowerCase().includes(gq) ||
                    cl.city.toLowerCase().includes(gq) ||
                    (cl.formatted_address || '').toLowerCase().includes(gq)
                  );
                })
                .map((club) => (
                  <ScalePressable
                    key={club.slug}
                    onPress={() => router.push(`/lounge/${club.slug}` as never)}
                    style={styles.golfClubCard}
                  >
                    <View style={styles.golfClubCoverWrap}>
                      <Image
                        source={getGolfPhotoSource(club.local_photo_path)}
                        style={styles.golfClubCoverImg}
                      />
                      <View style={styles.spotCoverOverlay}>
                        <View style={styles.termBadgeOverlay}>
                          <Text style={styles.termBadgeOverlayText}>{club.city}</Text>
                        </View>
                        {typeof club.google_rating === 'number' && (
                          <View style={styles.googleRatingOverlay}>
                            <Star size={11} color="#FBBF24" fill="#FBBF24" />
                            <Text style={styles.googleRatingOverlayText}>
                              {club.google_rating.toFixed(1)}
                              {club.google_review_count
                                ? ` (${club.google_review_count.toLocaleString('en-IN')})`
                                : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.golfClubBody}>
                      <Text style={styles.cardTitle}>{club.club_name}</Text>
                      <Text style={styles.spotNote} numberOfLines={2}>
                        {club.formatted_address || club.city}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>Details, Photos &amp; Cards →</Text>
                        </View>
                        {club.google_maps_url ? (
                          <ScalePressable
                            onPress={() => openUrl(club.google_maps_url!)}
                            style={styles.spotPortalPill}
                          >
                            <MapPin size={11} color={LedgerTheme.colors.accent} />
                            <Text style={styles.spotPortalPillText}>Maps</Text>
                            <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                          </ScalePressable>
                        ) : null}
                      </View>
                    </View>
                  </ScalePressable>
                ))}
            </View>
          </View>
          )}

          {golfSubSection === 'steps' && (
          <>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Flag size={16} color={LedgerTheme.colors.accent} />
              <Text style={styles.sectionTitle}>Golf Claim Portals &amp; Helplines</Text>
            </View>
            <Text style={styles.spotSub}>
              Step-by-step booking procedure across RuPay Select (rupayselect.truztee.com/#/offers), Mastercard World/World Elite (1800-102-6263), Visa TeePass, HDFC, ICICI &amp; Axis Burgundy.
            </Text>
          </View>

          {GOLF_PROGRAM_GUIDES.map((g) => (
            <View key={g.id} style={styles.card}>
              <View style={styles.sectionTopRow}>
                <View style={styles.netChip}>
                  <Text style={styles.netChipText}>{g.networkOrBank}</Text>
                </View>
                <Text style={styles.sectionHint}>{g.bookingWindow}</Text>
              </View>
              <Text style={styles.cardTitle}>{g.programName}</Text>
              <Text style={styles.spotSub}>{g.hours}</Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <ScalePressable
                  onPress={() => openUrl(g.portalUrl)}
                  style={styles.golfPortalBtn}
                >
                  <Globe size={14} color={LedgerTheme.colors.accent} />
                  <Text style={styles.golfPortalBtnText} numberOfLines={1}>
                    {g.portalLabel}
                  </Text>
                  <ExternalLink size={13} color={LedgerTheme.colors.accent} />
                </ScalePressable>
                <ScalePressable
                  onPress={() => openUrl(`tel:${g.helplinePhone.replace(/[^+\d]/g, '')}`)}
                  style={styles.golfPhoneBtn}
                >
                  <Phone size={13} color={LedgerTheme.colors.inkPrimary} />
                  <Text style={styles.golfPhoneBtnText}>{g.helplinePhone}</Text>
                </ScalePressable>
              </View>

              {g.supportEmail ? (
                <Text style={styles.spotNote}>Email: {g.supportEmail}{g.altPhone ? ` · Alt: ${g.altPhone}` : ''}</Text>
              ) : null}

              <View style={styles.golfStepsBox}>
                {g.steps.map((st, idx) => (
                  <Text key={idx} style={styles.golfStepText}>
                    {idx + 1}. {st}
                  </Text>
                ))}
              </View>

              {g.notes.map((nt, idx) => (
                <Text key={idx} style={styles.qualMetaWarn}>
                  • {nt}
                </Text>
              ))}

              {g.courseGroups && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={styles.sectionTitle}>Mastercard Participating Golf Courses</Text>
                  <View style={styles.searchBoxInner}>
                    <Search size={15} color={LedgerTheme.colors.inkMuted} />
                    <TextInput
                      value={golfCourseQuery}
                      onChangeText={setGolfCourseQuery}
                      placeholder="Filter city or club (Delhi, Mumbai, KGA, BPGC)..."
                      placeholderTextColor={LedgerTheme.colors.inkMuted}
                      style={styles.searchInput}
                    />
                  </View>
                  {g.courseGroups.map((grp) => {
                    const matched = grp.cities.filter(
                      (c) =>
                        !gq ||
                        c.city.toLowerCase().includes(gq) ||
                        c.courses.toLowerCase().includes(gq)
                    );
                    if (matched.length === 0) return null;
                    return (
                      <View key={grp.type} style={{ gap: 5 }}>
                        <Text style={styles.bankEyebrow}>{grp.type}</Text>
                        {matched.map((row) => (
                          <View key={`${grp.type}_${row.city}`} style={styles.golfCourseRow}>
                            <Text style={styles.golfCourseCity}>{row.city}</Text>
                            <Text style={styles.golfCourseList}>{row.courses}</Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
          </>
          )}
        </View>
      </ScrollView>
    );
  }

  if (subTab === 'programs') {
    return (
      <FlatList
        data={filteredPrograms}
        keyExtractor={(item) => item.program_id}
        renderItem={renderProgram}
        ListHeaderComponent={segmentedHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No lounge program matched "{query}".</Text>
        }
      />
    );
  }

  if (subTab === 'spots') {
    return (
      <FlatList
        data={filteredSpots}
        keyExtractor={(item) => item.key}
        renderItem={renderSpot}
        ListHeaderComponent={segmentedHeader}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No airport terminal matched "{query}".</Text>
        }
      />
    );
  }

  return (
    <FlatList
      data={filteredBanks}
      keyExtractor={(item) => item.bank_slug}
      renderItem={renderBank}
      ListHeaderComponent={segmentedHeader}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No issuing bank matched "{query}".</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    padding: 18,
    paddingBottom: 44,
  },
  headerBlock: {
    gap: 14,
    marginBottom: 16,
  },
  segmentedScroll: {
    flexDirection: 'row',
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    padding: 5,
    gap: 6,
  },
  segBtn: {
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  segBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  segText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  segTextActive: {
    color: LedgerTheme.colors.surface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchBoxInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 8,
  },
  rulesCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    ...LedgerTheme.shadow.card,
  },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: 10,
    padding: 12,
  },
  warnText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: LedgerTheme.colors.warn,
  },
  ruleGrid: {
    gap: 6,
  },
  ruleItem: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
  ruleLabel: {
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  card: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  sectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    flexShrink: 1,
  },
  sectionHint: {
    fontSize: 13,
    color: LedgerTheme.colors.inkMuted,
  },
  clearLink: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkMuted,
  },
  manageLink: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  hubChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  hubChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  hubChipText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  hubChipTextActive: {
    color: LedgerTheme.colors.surface,
  },
  dropdownBox: {
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    backgroundColor: LedgerTheme.colors.canvas,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  dropdownTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  dropdownSub: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 2,
  },
  dropdownTag: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  ownedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: 'rgba(15,92,77,0.22)',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    maxWidth: '100%',
  },
  ownedChipText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    maxWidth: 190,
  },
  presetBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 13,
    gap: 10,
  },
  presetText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
  presetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    maxWidth: '100%',
  },
  presetPrimaryText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
    flexShrink: 1,
  },
  presetSecondary: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  presetSecondaryText: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
  },
  airportHeadline: {
    fontSize: 20,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  coverageWrap: {
    gap: 5,
    marginTop: 2,
  },
  coverageLabel: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  termFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 2,
  },
  termFilterPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: LedgerTheme.radius.pill,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  termFilterPillActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  termFilterText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  termFilterTextActive: {
    color: '#FFFFFF',
  },
  statTile: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  statTileOk: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: 'rgba(15,92,77,0.22)',
  },
  statTileWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderColor: 'rgba(154,91,19,0.22)',
  },
  statTileMuted: {
    backgroundColor: LedgerTheme.colors.subtle,
    borderColor: LedgerTheme.colors.hairline,
  },
  statVal: {
    fontSize: 20,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  statLbl: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  termBadge: {
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  termBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  typeBadge: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
  },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.subtle,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
  },
  verdictOk: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: 'rgba(15,92,77,0.25)',
  },
  verdictWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderColor: 'rgba(154,91,19,0.25)',
  },
  verdictText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  networkWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  netChip: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  netChipText: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  qualOkBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: 'rgba(15,92,77,0.25)',
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  qualWarnBox: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: 'rgba(154,91,19,0.25)',
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  qualTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualCardName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  qualTagOk: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  qualTagWarn: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  qualMeta: {
    fontSize: 13.5,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  qualMetaWarn: {
    fontSize: 13.5,
    lineHeight: 19,
    color: LedgerTheme.colors.warn,
  },
  blockedBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  blockedTitle: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
  },
  blockedItem: {
    fontSize: 13,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  spotNote: {
    fontSize: 13,
    lineHeight: 18,
    color: LedgerTheme.colors.inkMuted,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  bankInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankEyebrow: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  cardTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 23,
  },
  countBadge: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  previewSpots: {
    backgroundColor: LedgerTheme.colors.subtle,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  spotLine: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  linkBtnPrimary: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  linkBtnPrimaryText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  linkBtnSecondary: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  linkBtnSecondaryText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  terminalTag: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  spotSub: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  pillMuted: {
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  pillMutedText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  pillWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  pillWarnText: {
    color: LedgerTheme.colors.warn,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 36,
    fontSize: 14.5,
    color: LedgerTheme.colors.inkMuted,
  },
  loungeHeroBanner: {
    borderRadius: LedgerTheme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    height: 128,
    position: 'relative',
    backgroundColor: LedgerTheme.colors.subtle,
  },
  loungeHeroImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  loungeHeroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(26, 29, 33, 0.56)',
    gap: 2,
  },
  loungeHeroBadge: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#A7F3D0',
    letterSpacing: 0.3,
  },
  loungeHeroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  portalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 11,
  },
  portalTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  portalDomain: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  portalSub: {
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkSecondary,
  },
  bestTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 12,
    padding: 11,
  },
  bestTipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkPrimary,
  },
  bestTerminalCard: {
    borderColor: 'rgba(15, 92, 77, 0.45)',
  },
  bestBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  bestReasonText: {
    fontSize: 12,
    color: LedgerTheme.colors.accent,
    lineHeight: 17,
  },
  spotPortalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  spotPortalLabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  spotPortalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  spotPortalPillText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  golfStepsBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 11,
    gap: 5,
  },
  golfStepText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkPrimary,
  },
  golfCourseRow: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    padding: 9,
    gap: 2,
  },
  golfCourseCity: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  golfCourseList: {
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.inkSecondary,
  },
  golfPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    maxWidth: '100%',
  },
  golfPortalBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    flexShrink: 1,
  },
  golfPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  golfPhoneBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  loungeShowcaseCard: {
    width: 244,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    overflow: 'hidden',
  },
  loungeShowcaseImg: {
    width: '100%',
    height: 98,
    resizeMode: 'cover',
  },
  loungeShowcaseBody: {
    padding: 11,
    gap: 3,
  },
  loungeShowcaseEyebrow: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  loungeShowcaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  loungeShowcaseSub: {
    fontSize: 11.5,
    lineHeight: 16,
    color: LedgerTheme.colors.inkSecondary,
  },
  spotCardBleed: {
    padding: 0,
    overflow: 'hidden',
    gap: 0,
  },
  spotCoverWrap: {
    width: '100%',
    height: 108,
    position: 'relative',
    backgroundColor: LedgerTheme.colors.subtle,
  },
  spotCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  spotCoverOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  termBadgeOverlay: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  termBadgeOverlayText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  spotCardBody: {
    padding: 16,
    gap: 10,
  },
  walkthroughBox: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7FAF9',
    borderWidth: 1,
    borderColor: '#D5E7E0',
    gap: 10,
  },
  walkthroughTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  walkthroughTag: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  walkthroughPoster: {
    width: '100%',
    height: undefined,
    aspectRatio: 1360 / 740,
    borderRadius: 10,
    resizeMode: 'contain',
    backgroundColor: '#0E1715',
  },
  walkthroughStepsGrid: {
    gap: 8,
  },
  walkthroughStepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  walkthroughStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: LedgerTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkthroughStepNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  walkthroughStepHeading: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  walkthroughStepSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  portalQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portalQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  portalQuickPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  airportHubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  airportHubCard: {
    width: '48.5%',
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 3,
  },
  airportHubCardActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  airportHubTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  airportIataCode: {
    fontSize: 15,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: 0.4,
  },
  airportRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  airportRatingBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  airportRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  airportCityName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  airportMetaLine: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  airportHubTextActive: {
    color: '#FFFFFF',
  },
  airportHubMetaActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  googleRatingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 21, 0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  googleRatingOverlayText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  golfClubCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    overflow: 'hidden',
  },
  golfClubCoverWrap: {
    position: 'relative',
    height: 145,
    backgroundColor: '#0E1715',
  },
  golfClubCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  golfClubBody: {
    padding: 13,
    gap: 7,
  },
  compactGuideBanner: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: LedgerTheme.radius.md,
    borderWidth: 1,
    borderColor: '#CBE0D7',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  compactGuideText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  guideIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openGuidePill: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: 99,
    paddingHorizontal: 12,
  },
  openGuidePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  spotAcceptLine: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17,
  },
  cardUseLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardUseLabelWarn: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.warn,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quotaPillOk: {
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  quotaPillOkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quotaPillWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: '#EAD4AD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  quotaPillWarnText: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.warn,
  },
  qualOneLiner: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
  qualOneLinerWarn: {
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    marginTop: 2,
  },
  blockedCollapseWrap: {
    gap: 8,
  },
  blockedToggleBtn: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LedgerTheme.colors.subtle,
    borderRadius: LedgerTheme.radius.md,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 12,
  },
  blockedToggleText: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  blockedToggleAction: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  spotPortalPillPrimary: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: LedgerTheme.radius.md,
    paddingHorizontal: 12,
  },
  spotPortalPillPrimaryText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  golfSubSegRow: {
    flexDirection: 'row',
    gap: 8,
  },
  golfSubSegBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: LedgerTheme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  golfSubSegBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  golfSubSegText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  golfSubSegTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
