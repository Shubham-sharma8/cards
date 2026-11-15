import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  Flag,
  MapPin,
  MessageSquareQuote,
  Plane,
  QrCode,
  Search,
  ShieldAlert,
  Star,
  Wallet,
} from 'lucide-react-native';
import {
  ALL_CARDS,
  GOLF_CLUBS_MASTER,
  LOUNGE_ACCESS_MASTER,
} from '../../src/lib/data';
import { formatFeeDisplay } from '../../src/lib/format';
import { openExternalUrlSafely } from '../../src/lib/security';
import { LedgerTheme } from '../../src/lib/theme';
import { getVenuePhotoSource } from '../../src/lib/venuePhotos';
import { BankLogo } from '../../src/components/BankLogo';
import { useCompare } from '../../src/components/CompareContext';
import { CalmEntranceView, ScalePressable } from '../../src/components/MotionPrimitives';
import type {
  CardSummaryItem,
  GolfClubSpot,
  ParticipatingAirportLoungeSpot,
} from '../../src/lib/types';

const GALLERY_WIDTH = Math.min(Dimensions.get('window').width - 32, 440);

function buildCardsLookup() {
  const map = new Map<string, CardSummaryItem>();
  for (const c of ALL_CARDS) {
    map.set(c.card_id, c);
  }
  return map;
}

export default function LoungeOrGolfDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { ownedIds } = useCompare();

  const paramVal = String(code || '').trim();
  const paramLower = paramVal.toLowerCase();

  const cardsById = useMemo(() => buildCardsLookup(), []);

  const loungeSpot: ParticipatingAirportLoungeSpot | null = useMemo(
    () =>
      (LOUNGE_ACCESS_MASTER.participating_indian_airport_lounges || []).find(
        (l) => String(l.lounge_code || '').toLowerCase() === paramLower
      ) ?? null,
    [paramLower]
  );

  const golfClub: GolfClubSpot | null = useMemo(
    () =>
      !loungeSpot
        ? (GOLF_CLUBS_MASTER.clubs || []).find(
            (g) => String(g.slug || '').toLowerCase() === paramLower
          ) ?? null
        : null,
    [loungeSpot, paramLower]
  );

  const isGolf = Boolean(golfClub);
  const venue = loungeSpot || golfClub;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [cardQuery, setCardQuery] = useState('');
  const [showHighSpendCards, setShowHighSpendCards] = useState(false);

  const photos = useMemo(() => {
    if (!venue) return [];
    const list =
      venue.gallery_photos && venue.gallery_photos.length > 0
        ? venue.gallery_photos
        : venue.local_photo_path
          ? [venue.local_photo_path]
          : [];
    return list.slice(0, 6);
  }, [venue]);

  const cardBuckets = useMemo(() => {
    if (!venue) {
      return {
        noSpendCards: [] as CardSummaryItem[],
        lowSpendCards: [] as CardSummaryItem[],
        highSpendCards: [] as CardSummaryItem[],
      };
    }

    const resolve = (ids: string[] | undefined) =>
      (ids || [])
        .map((id) => cardsById.get(id))
        .filter((c): c is CardSummaryItem => Boolean(c));

    if (loungeSpot) {
      return {
        noSpendCards: resolve(loungeSpot.eligible_no_spend_card_ids),
        lowSpendCards: resolve(loungeSpot.eligible_low_spend_card_ids),
        highSpendCards: resolve(loungeSpot.eligible_high_spend_card_ids),
      };
    }

    return {
      noSpendCards: resolve(golfClub?.eligible_no_spend_card_ids),
      lowSpendCards: [] as CardSummaryItem[],
      highSpendCards: resolve(golfClub?.eligible_high_spend_card_ids),
    };
  }, [venue, loungeSpot, golfClub, cardsById]);

  const myCardsVerdict = useMemo(() => {
    const ownedCards = ownedIds
      .map((id) => cardsById.get(id))
      .filter((c): c is CardSummaryItem => Boolean(c));

    const noSpendSet = new Set(cardBuckets.noSpendCards.map((c) => c.card_id));
    const lowSpendSet = new Set(cardBuckets.lowSpendCards.map((c) => c.card_id));
    const highSpendSet = new Set(cardBuckets.highSpendCards.map((c) => c.card_id));

    const freeAccess = ownedCards.filter((c) => noSpendSet.has(c.card_id));
    const lowSpendAccess = ownedCards.filter((c) => lowSpendSet.has(c.card_id));
    const highSpendAccess = ownedCards.filter((c) => highSpendSet.has(c.card_id));
    const blocked = ownedCards.filter(
      (c) => !noSpendSet.has(c.card_id) && !lowSpendSet.has(c.card_id) && !highSpendSet.has(c.card_id)
    );

    return {
      ownedCount: ownedCards.length,
      freeAccess,
      lowSpendAccess,
      highSpendAccess,
      blocked,
    };
  }, [ownedIds, cardsById, cardBuckets]);

  const filteredPrimaryCards = useMemo(() => {
    const combined = [...cardBuckets.noSpendCards, ...cardBuckets.lowSpendCards];
    const q = cardQuery.trim().toLowerCase();
    const list = !q
      ? combined
      : combined.filter(
          (c) =>
            c.card_name.toLowerCase().includes(q) ||
            c.bank.toLowerCase().includes(q) ||
            c.card_network.toLowerCase().includes(q)
        );
    return list.slice(0, 45);
  }, [cardBuckets, cardQuery]);

  const filteredHighSpendCards = useMemo(() => {
    const q = cardQuery.trim().toLowerCase();
    const list = !q
      ? cardBuckets.highSpendCards
      : cardBuckets.highSpendCards.filter(
          (c) =>
            c.card_name.toLowerCase().includes(q) ||
            c.bank.toLowerCase().includes(q) ||
            c.card_network.toLowerCase().includes(q)
        );
    return list.slice(0, 45);
  }, [cardBuckets, cardQuery]);

  if (!venue) {
    return (
      <View style={styles.emptyWrap}>
        <Stack.Screen options={{ title: 'Venue Not Found' }} />
        <Text style={styles.emptyTitle}>Lounge or Golf Club Not Found</Text>
        <Text style={styles.emptySub}>
          No Indian lounge or golf club matched &ldquo;{paramVal}&rdquo;.
        </Text>
        <ScalePressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </ScalePressable>
      </View>
    );
  }

  const venueName = loungeSpot ? loungeSpot.lounge_name : golfClub!.club_name;
  const venueLocation = loungeSpot
    ? `${loungeSpot.city} (${loungeSpot.airport_code}) · ${loungeSpot.terminal}`
    : `${golfClub!.city} · ${golfClub!.formatted_address}`;

  const renderCardRow = (c: CardSummaryItem, spendNote?: string) => {
    const fee = formatFeeDisplay(c.joining_fee_inr, c.annual_fee_inr);
    const isOwned = ownedIds.includes(c.card_id);
    return (
      <ScalePressable
        key={c.card_id}
        onPress={() => router.push(`/card/${c.bank_slug}/${c.card_slug}` as never)}
        style={[styles.cardRow, isOwned && styles.cardRowOwned]}
      >
        <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.cardRowName} numberOfLines={1}>
              {c.card_name}
            </Text>
            {isOwned ? (
              <View style={styles.ownedTag}>
                <Text style={styles.ownedTagText}>In My Cards</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardRowMeta} numberOfLines={1}>
            {c.bank} · {c.card_network} · {fee.primaryText}
          </Text>
          {spendNote ? (
            <Text style={styles.cardSpendWarn} numberOfLines={1}>
              {spendNote}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={15} color={LedgerTheme.colors.accent} />
      </ScalePressable>
    );
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: loungeSpot ? `${loungeSpot.airport_code} Lounge` : `${golfClub!.city} Golf`,
        }}
      />

      {/* 1. LIVE MY CARDS ELIGIBILITY VERDICT */}
      <CalmEntranceView delayMs={20}>
        {myCardsVerdict.ownedCount === 0 ? (
          <View style={[styles.verdictCard, { backgroundColor: '#F3F2EE', borderColor: LedgerTheme.colors.hairline }]}>
            <View style={styles.verdictTop}>
              <Wallet size={18} color={LedgerTheme.colors.accent} />
              <Text style={styles.verdictTitle}>Check With Your Saved Cards</Text>
            </View>
            <Text style={styles.verdictSub}>
              Add your credit cards in My Cards and we will instantly verify whether you get complimentary entry here.
            </Text>
            <ScalePressable onPress={() => router.push('/(tabs)/my-cards' as never)} style={styles.verdictCta}>
              <Text style={styles.verdictCtaText}>Add Cards in My Cards →</Text>
            </ScalePressable>
          </View>
        ) : myCardsVerdict.freeAccess.length > 0 || myCardsVerdict.lowSpendAccess.length > 0 ? (
          <View style={[styles.verdictCard, { backgroundColor: '#EEF5F2', borderColor: '#B5D7C8' }]}>
            <View style={styles.verdictTop}>
              <CheckCircle2 size={19} color="#0F5C4D" />
              <Text style={[styles.verdictTitle, { color: '#0F5C4D' }]}>
                You Can Access This {isGolf ? 'Golf Club' : 'Lounge'}
              </Text>
            </View>
            <Text style={styles.verdictSub}>
              {myCardsVerdict.freeAccess.length + myCardsVerdict.lowSpendAccess.length} card(s) from your My Cards wallet unlock complimentary entry:
            </Text>
            <View style={styles.verdictChipsWrap}>
              {[...myCardsVerdict.freeAccess, ...myCardsVerdict.lowSpendAccess].map((c) => (
                <ScalePressable
                  key={c.card_id}
                  onPress={() => router.push(`/card/${c.bank_slug}/${c.card_slug}` as never)}
                  style={styles.verdictChip}
                >
                  <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                  <Text style={styles.verdictChipText} numberOfLines={1}>
                    {c.card_name}
                  </Text>
                  <Text style={styles.verdictFreePill}>
                    {c.lounge_spend_threshold_inr && c.lounge_spend_threshold_inr > 0
                      ? `₹${c.lounge_spend_threshold_inr.toLocaleString('en-IN')} spend`
                      : 'No-Spend Free'}
                  </Text>
                </ScalePressable>
              ))}
            </View>
          </View>
        ) : myCardsVerdict.highSpendAccess.length > 0 ? (
          <View style={[styles.verdictCard, { backgroundColor: '#FEF6EA', borderColor: '#E9CFA6' }]}>
            <View style={styles.verdictTop}>
              <ShieldAlert size={19} color="#9A5B13" />
              <Text style={[styles.verdictTitle, { color: '#9A5B13' }]}>
                Unlocked Only After Quarterly/Monthly Spend
              </Text>
            </View>
            <Text style={styles.verdictSub}>
              Your saved card(s) grant entry only after meeting spend criteria (≥ ₹15,000):
            </Text>
            <View style={styles.verdictChipsWrap}>
              {myCardsVerdict.highSpendAccess.map((c) => (
                <ScalePressable
                  key={c.card_id}
                  onPress={() => router.push(`/card/${c.bank_slug}/${c.card_slug}` as never)}
                  style={styles.verdictChip}
                >
                  <BankLogo bankSlug={c.bank_slug} bank={c.bank} size="xs" />
                  <Text style={styles.verdictChipText} numberOfLines={1}>
                    {c.card_name}
                  </Text>
                  <Text style={[styles.verdictFreePill, { backgroundColor: '#FEF3C7', color: '#92400E' }]}>
                    {c.lounge_spend_condition || 'Spend-Gated'}
                  </Text>
                </ScalePressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={[styles.verdictCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={styles.verdictTop}>
              <ShieldAlert size={19} color="#B91C1C" />
              <Text style={[styles.verdictTitle, { color: '#B91C1C' }]}>
                Not Unlocked by Your Saved Cards
              </Text>
            </View>
            <Text style={styles.verdictSub}>
              None of your {myCardsVerdict.ownedCount} cards in My Cards currently qualify here. Check eligible spend-free cards below.
            </Text>
          </View>
        )}
      </CalmEntranceView>

      {/* 2. PHOTO GALLERY (5-6 IMAGES) + HERO INFO */}
      <CalmEntranceView delayMs={50} style={styles.heroPanel}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / GALLERY_WIDTH);
            if (!Number.isNaN(idx)) setActivePhotoIdx(idx);
          }}
        >
          {photos.map((photoPath, idx) => (
            <View key={`${photoPath}-${idx}`} style={[styles.photoSlide, { width: GALLERY_WIDTH - 24 }]}>
              <Image
                source={getVenuePhotoSource(photoPath, isGolf)}
                style={styles.heroImg}
                resizeMode="cover"
              />
              <View style={styles.photoIndexBadge}>
                <Text style={styles.photoIndexText}>
                  {idx + 1} / {photos.length}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {photos.length > 1 && (
          <View style={styles.dotsRow}>
            {photos.map((_, idx) => (
              <View
                key={`dot_${idx}`}
                style={[styles.dot, idx === activePhotoIdx && styles.dotActive]}
              />
            ))}
          </View>
        )}

        <View style={styles.heroMeta}>
          <View style={styles.typeRow}>
            <View style={styles.typePill}>
              {isGolf ? (
                <Flag size={12} color={LedgerTheme.colors.accent} />
              ) : (
                <Plane size={12} color={LedgerTheme.colors.accent} />
              )}
              <Text style={styles.typePillText}>
                {loungeSpot ? `${loungeSpot.terminal_type} Lounge` : 'Indian Golf Club'}
              </Text>
            </View>
            {venue.google_rating ? (
              <View style={styles.ratingPill}>
                <Star size={12} color="#B45309" fill="#B45309" />
                <Text style={styles.ratingPillText}>
                  {venue.google_rating.toFixed(1)} ({(venue.google_review_count || 0).toLocaleString('en-IN')})
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.venueTitle}>{venueName}</Text>

          <View style={styles.infoRow}>
            <MapPin size={14} color={LedgerTheme.colors.accent} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{venueLocation}</Text>
          </View>

          {loungeSpot?.terminal_and_hours ? (
            <View style={styles.infoRow}>
              <Clock size={14} color={LedgerTheme.colors.inkSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.infoText}>{loungeSpot.terminal_and_hours}</Text>
            </View>
          ) : null}

          {loungeSpot?.airport_guide_note ? (
            <Text style={styles.guideNote}>{loungeSpot.airport_guide_note}</Text>
          ) : null}

          {venue.google_maps_url ? (
            <ScalePressable
              onPress={() => openExternalUrlSafely(venue.google_maps_url!)}
              style={styles.mapsBtn}
            >
              <MapPin size={14} color="#FFFFFF" />
              <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
              <ExternalLink size={13} color="#FFFFFF" />
            </ScalePressable>
          ) : null}
        </View>
      </CalmEntranceView>

      {/* 3. HOW TO ACCESS (LMS.HOI / LOUNGEONE / TFS / RUPAY / MASTERCARD / GOLF DESKS) */}
      {(venue.how_to_access || []).length > 0 && (
        <CalmEntranceView delayMs={80} style={styles.panel}>
          <View style={styles.sectionHeader}>
            <QrCode size={16} color={LedgerTheme.colors.accent} />
            <Text style={styles.sectionTitle}>How to Access &amp; Generate Pass</Text>
          </View>
          {(venue.how_to_access || []).map((method, idx) => (
            <View key={`${method.channel}-${idx}`} style={styles.methodCard}>
              <View style={styles.methodTop}>
                <Text style={styles.methodChannel}>{method.channel}</Text>
                {method.url ? (
                  <ScalePressable
                    onPress={() => openExternalUrlSafely(method.url!)}
                    style={styles.methodLinkBtn}
                  >
                    <Text style={styles.methodLinkText}>Open Portal</Text>
                    <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                  </ScalePressable>
                ) : null}
              </View>
              {(method.steps || []).map((step, sIdx) => (
                <Text key={`step_${sIdx}`} style={styles.methodStep}>
                  {sIdx + 1}. {step}
                </Text>
              ))}
            </View>
          ))}
        </CalmEntranceView>
      )}

      {/* 4. PEOPLE REVIEWS */}
      {(venue.people_reviews || []).length > 0 && (
        <CalmEntranceView delayMs={110} style={styles.panel}>
          <View style={styles.sectionHeader}>
            <MessageSquareQuote size={16} color={LedgerTheme.colors.accent} />
            <Text style={styles.sectionTitle}>Traveler &amp; Community Reviews</Text>
          </View>
          {(venue.people_reviews || []).map((rev, idx) => (
            <View key={`rev_${idx}`} style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <Text style={styles.reviewAuthor}>{rev.author}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {rev.tag ? (
                    <View style={styles.reviewTagPill}>
                      <Text style={styles.reviewTagText}>{rev.tag}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.reviewStars}>★ {rev.rating.toFixed(1)}</Text>
                </View>
              </View>
              <Text style={styles.reviewComment}>&ldquo;{rev.comment}&rdquo;</Text>
            </View>
          ))}
        </CalmEntranceView>
      )}

      {/* 5. ELIGIBLE CARDS (NO-SPEND & LOW-SPEND FIRST; >= ₹15,000 COLLAPSED INITIALLY) */}
      <CalmEntranceView delayMs={140} style={styles.panel}>
        <Text style={styles.sectionTitle}>
          Accepted Cards Here ({cardBuckets.noSpendCards.length + cardBuckets.lowSpendCards.length} Direct / Low-Spend)
        </Text>
        <Text style={styles.sectionSub}>
          Prioritizing cards with zero or &lt; ₹15,000 spend criteria first. Spend-gated (₹15,000+) cards are collapsed below.
        </Text>

        <View style={styles.searchBox}>
          <Search size={15} color={LedgerTheme.colors.inkMuted} />
          <TextInput
            value={cardQuery}
            onChangeText={setCardQuery}
            placeholder="Search bank, card name, Visa / RuPay..."
            placeholderTextColor={LedgerTheme.colors.inkMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={{ gap: 8 }}>
          {filteredPrimaryCards.length > 0 ? (
            filteredPrimaryCards.map((c) =>
              renderCardRow(
                c,
                c.lounge_spend_threshold_inr && c.lounge_spend_threshold_inr > 0
                  ? `Low spend: ₹${c.lounge_spend_threshold_inr.toLocaleString('en-IN')}`
                  : undefined
              )
            )
          ) : (
            <Text style={styles.emptyFilterText}>
              No zero/low-spend cards matched &ldquo;{cardQuery}&rdquo;. Check the ₹15,000+ spend-gated cards section below.
            </Text>
          )}
        </View>

        {cardBuckets.highSpendCards.length > 0 && (
          <View style={styles.highSpendToggleWrap}>
            <ScalePressable
              onPress={() => setShowHighSpendCards((prev) => !prev)}
              style={styles.highSpendToggleBtn}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.highSpendToggleTitle}>
                  Spend-Gated Cards (₹15,000+ Spend Criteria) · {cardBuckets.highSpendCards.length}
                </Text>
                <Text style={styles.highSpendToggleSub}>
                  Collapsed by default so spend-free cards stay prioritized
                </Text>
              </View>
              {showHighSpendCards ? (
                <ChevronUp size={18} color={LedgerTheme.colors.inkSecondary} />
              ) : (
                <ChevronDown size={18} color={LedgerTheme.colors.inkSecondary} />
              )}
            </ScalePressable>

            {showHighSpendCards && (
              <View style={{ gap: 8, marginTop: 10 }}>
                {filteredHighSpendCards.map((c) =>
                  renderCardRow(
                    c,
                    c.lounge_spend_condition ||
                      (c.lounge_spend_threshold_inr
                        ? `Requires ₹${c.lounge_spend_threshold_inr.toLocaleString('en-IN')} prior spend`
                        : 'Spend-gated access')
                  )
                )}
              </View>
            )}
          </View>
        )}
      </CalmEntranceView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  content: {
    padding: 16,
    paddingBottom: 42,
    gap: 14,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: LedgerTheme.colors.canvas,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  emptySub: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13.5,
  },
  verdictCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  verdictTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verdictTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    flex: 1,
  },
  verdictSub: {
    fontSize: 13,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  verdictCta: {
    alignSelf: 'flex-start',
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    marginTop: 2,
  },
  verdictCtaText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  verdictChipsWrap: {
    gap: 7,
    marginTop: 2,
  },
  verdictChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  verdictChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  verdictFreePill: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F5C4D',
    backgroundColor: '#EEF5F2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroPanel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  photoSlide: {
    height: 195,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginRight: 8,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  photoIndexBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  photoIndexText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 16,
    backgroundColor: LedgerTheme.colors.accent,
  },
  heroMeta: {
    paddingHorizontal: 4,
    gap: 8,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF6EA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A5B13',
  },
  venueTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  guideNote: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkMuted,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    padding: 10,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: LedgerTheme.colors.accent,
    paddingVertical: 11,
    borderRadius: 11,
    marginTop: 2,
  },
  mapsBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  sectionSub: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkMuted,
  },
  methodCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
    gap: 6,
  },
  methodTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  methodChannel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    flex: 1,
  },
  methodLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  methodLinkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  methodStep: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkSecondary,
  },
  reviewCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
    gap: 6,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  reviewTagPill: {
    backgroundColor: '#EEF5F2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewTagText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#0F5C4D',
  },
  reviewStars: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A5B13',
  },
  reviewComment: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkSecondary,
    fontStyle: 'italic',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 10,
  },
  cardRowOwned: {
    backgroundColor: '#EEF5F2',
    borderColor: '#A7D7C5',
  },
  cardRowName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
    flexShrink: 1,
  },
  cardRowMeta: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
  cardSpendWarn: {
    fontSize: 11,
    color: '#9A5B13',
    fontWeight: '500',
    marginTop: 2,
  },
  ownedTag: {
    backgroundColor: '#0F5C4D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ownedTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyFilterText: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
    paddingVertical: 8,
  },
  highSpendToggleWrap: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  highSpendToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F6F2',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 12,
  },
  highSpendToggleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  highSpendToggleSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 2,
  },
});
