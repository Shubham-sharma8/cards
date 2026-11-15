import React, { useMemo, useState } from 'react';
import {
  Image,
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
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Info,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Store,
  Wallet,
  X,
} from 'lucide-react-native';
import { ALL_CARDS, MERCHANT_DIRECTORY } from '../src/lib/data';
import {
  recommendCardsForMerchant,
  type MerchantBrandRecord,
  type MerchantStatementVariant,
} from '../src/lib/merchants';
import { BRAND_LOGOS } from '../src/lib/brandLogos';
import { formatInr, matchesTokenizedQuery } from '../src/lib/format';
import { openExternalUrlSafely } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';
import { BankLogo } from '../src/components/BankLogo';
import { useCompare } from '../src/components/CompareContext';
import { CalmEntranceView, ScalePressable } from '../src/components/MotionPrimitives';

function BrandBadgeImage({
  brand,
  size = 40,
}: {
  brand: MerchantBrandRecord;
  size?: number;
}) {
  const logoSrc = BRAND_LOGOS[brand.brand_slug];
  const initials = brand.brand_name
    .split(/[\s/&()-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  if (logoSrc) {
    return (
      <View style={[styles.avatarBox, { width: size, height: size }]}>
        <Image
          source={logoSrc}
          style={{ width: size - 10, height: size - 10 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={[styles.avatarFallback, { width: size, height: size }]}>
      <Text style={styles.avatarInitials}>{initials || 'MC'}</Text>
    </View>
  );
}

export default function MerchantsScreen() {
  const router = useRouter();
  const { ownedIds, toggleOwned } = useCompare();

  const [query, setQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<
    'all' | '5_safe' | '0_exempt' | 'mixed'
  >('all');
  const [monthlySpendInr, setMonthlySpendInr] = useState<number>(10000);
  const [activeBrand, setActiveBrand] = useState<MerchantBrandRecord | null>(null);
  const [activeVariant, setActiveVariant] = useState<MerchantStatementVariant | null>(
    null
  );

  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const filteredBrands = useMemo(() => {
    return MERCHANT_DIRECTORY.brands.filter((b) => {
      if (selectedSegment !== 'All' && b.primary_segment !== selectedSegment) {
        return false;
      }
      if (statusFilter === '5_safe' && b.overall_sbi_status !== '5% Safe') {
        return false;
      }
      if (statusFilter === '0_exempt' && b.overall_sbi_status !== '0% Exempt') {
        return false;
      }
      if (
        statusFilter === 'mixed' &&
        b.overall_sbi_status !== 'Mixed — Check Statement Name'
      ) {
        return false;
      }
      if (!query.trim()) return true;
      const descText = b.variants
        .map(
          (v) =>
            `${v.platform_label} ${v.statement_descriptor} ${v.sbi_exemption_category ?? ''} ${v.probable_mcc ?? ''}`
        )
        .join(' ');
      const hay = `${b.brand_name} ${b.domain} ${b.primary_segment} ${b.sbi_exemption_reason ?? ''} ${b.payment_watchout} ${descText}`;
      return matchesTokenizedQuery(hay, query);
    });
  }, [selectedSegment, statusFilter, query]);

  const currentVariant = useMemo(() => {
    if (!activeBrand) return null;
    if (
      activeVariant &&
      activeBrand.variants.some((v) => v.variant_id === activeVariant.variant_id)
    ) {
      return activeVariant;
    }
    return activeBrand.variants[0] ?? null;
  }, [activeBrand, activeVariant]);

  const modalRecommendation = useMemo(() => {
    if (!activeBrand || !currentVariant) return null;
    return recommendCardsForMerchant({
      brand: activeBrand,
      variant: currentVariant,
      allCards: ALL_CARDS,
      ownedIds,
      monthlySpendInr,
    });
  }, [activeBrand, currentVariant, ownedIds, monthlySpendInr]);

  const openBrandModal = (brand: MerchantBrandRecord) => {
    setActiveBrand(brand);
    setActiveVariant(brand.variants[0] ?? null);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CalmEntranceView style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Store size={13} color={LedgerTheme.colors.accent} />
            <Text style={styles.heroBadgeText}>
              {MERCHANT_DIRECTORY.total_brands} Brands · {MERCHANT_DIRECTORY.total_descriptors} Descriptors
            </Text>
          </View>
          <Text style={styles.heroTitle}>Merchant &amp; Statement MCC Advisor</Text>
          <Text style={styles.heroSub}>
            Check whether a checkout statement descriptor gets SBI Cashback 5% or falls into a 0% MCC trap (Insurance, Utilities, Railways, Rent, Jewellery) — and see which card in your wallet ({ownedIds.length}) wins.
          </Text>

          <View style={styles.searchWrap}>
            <Search size={16} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search brand or statement name (e.g. PHONEPE, Acko, AMAZON)..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <ScalePressable onPress={() => setQuery('')} hitSlop={8}>
                <X size={16} color={LedgerTheme.colors.inkMuted} />
              </ScalePressable>
            )}
          </View>

          <View style={styles.spendBox}>
            <View style={styles.rowBetween}>
              <Text style={styles.spendLabel}>Monthly spend on merchant</Text>
              <Text style={styles.spendValue}>
                {formatInr(monthlySpendInr)}/mo
              </Text>
            </View>
            <View style={styles.stepperRow}>
              <ScalePressable
                onPress={() => setMonthlySpendInr((v) => Math.max(1000, v - 2000))}
                style={styles.stepBtn}
              >
                <Minus size={14} color={LedgerTheme.colors.inkPrimary} />
              </ScalePressable>
              {[2000, 5000, 10000, 25000].map((amt) => (
                <ScalePressable
                  key={amt}
                  onPress={() => setMonthlySpendInr(amt)}
                  style={[
                    styles.presetChip,
                    monthlySpendInr === amt && styles.presetChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      monthlySpendInr === amt && styles.presetChipTextActive,
                    ]}
                  >
                    {formatInr(amt)}
                  </Text>
                </ScalePressable>
              ))}
              <ScalePressable
                onPress={() => setMonthlySpendInr((v) => Math.min(100000, v + 2000))}
                style={styles.stepBtn}
              >
                <Plus size={14} color={LedgerTheme.colors.accent} />
              </ScalePressable>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(
              [
                { id: 'all', label: 'All Statuses' },
                { id: '5_safe', label: 'SBI 5% Safe' },
                { id: '0_exempt', label: '0% Exempt Traps' },
                { id: 'mixed', label: 'Mixed Descriptor' },
              ] as const
            ).map((s) => (
              <ScalePressable
                key={s.id}
                onPress={() => setStatusFilter(s.id)}
                style={[
                  styles.filterPill,
                  statusFilter === s.id && styles.filterPillDark,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    statusFilter === s.id && styles.filterPillTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </ScalePressable>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {['All', ...MERCHANT_DIRECTORY.segments].map((seg) => (
              <ScalePressable
                key={seg}
                onPress={() => setSelectedSegment(seg)}
                style={[
                  styles.filterPill,
                  selectedSegment === seg && styles.filterPillGreen,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedSegment === seg && styles.filterPillTextActive,
                  ]}
                >
                  {seg}
                </Text>
              </ScalePressable>
            ))}
          </ScrollView>
        </CalmEntranceView>

        <View style={styles.rowBetween}>
          <Text style={styles.countText}>
            Showing {filteredBrands.length} merchants
          </Text>
          <ScalePressable onPress={() => router.push('/(tabs)/my-cards')}>
            <Text style={styles.walletLink}>My Cards ({ownedIds.length}) →</Text>
          </ScalePressable>
        </View>

        {filteredBrands.map((brand) => {
          const primaryVar = brand.variants[0];
          const preview = recommendCardsForMerchant({
            brand,
            variant: primaryVar,
            allCards: ALL_CARDS,
            ownedIds,
            monthlySpendInr,
          });
          const winner = preview.bestOwned || preview.topMarket[0];
          const isZero = brand.overall_sbi_status === '0% Exempt';
          const isMixed =
            brand.overall_sbi_status === 'Mixed — Check Statement Name';

          return (
            <ScalePressable
              key={brand.brand_slug}
              onPress={() => openBrandModal(brand)}
              style={styles.brandCard}
            >
              <View style={styles.brandTopRow}>
                <BrandBadgeImage brand={brand} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.brandName} numberOfLines={1}>
                    {brand.brand_name}
                  </Text>
                  <Text style={styles.brandMeta} numberOfLines={1}>
                    {brand.primary_segment} · {brand.variants.length}{' '}
                    {brand.variants.length === 1 ? 'descriptor' : 'descriptors'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusTag,
                    isZero
                      ? styles.statusZero
                      : isMixed
                        ? styles.statusMixed
                        : styles.statusSafe,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTagText,
                      isZero
                        ? { color: '#991B1B' }
                        : isMixed
                          ? { color: '#9A5B13' }
                          : { color: '#0F5C4D' },
                    ]}
                  >
                    {isMixed ? 'Mixed' : brand.overall_sbi_status}
                  </Text>
                </View>
              </View>

              <View style={styles.descriptorChip}>
                <Text style={styles.descriptorMono} numberOfLines={1}>
                  {primaryVar.statement_descriptor}
                </Text>
              </View>

              {winner && (
                <View style={styles.brandFooterRow}>
                  <View style={styles.winnerRow}>
                    <CreditCard size={13} color={LedgerTheme.colors.accent} />
                    <Text style={styles.winnerText} numberOfLines={1}>
                      {preview.bestOwned ? 'Use' : 'Best'}: {winner.card.card_name}
                    </Text>
                  </View>
                  <Text style={styles.winnerPct}>
                    {winner.effectivePct.toFixed(1)}%
                  </Text>
                </View>
              )}
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* Merchant Statement Descriptor & Card Recommendation Modal */}
      <Modal
        visible={Boolean(activeBrand && currentVariant && modalRecommendation)}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveBrand(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveBrand(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {activeBrand && currentVariant && modalRecommendation && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <BrandBadgeImage brand={activeBrand} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>
                        {activeBrand.brand_name}
                      </Text>
                      <ScalePressable
                        onPress={() => openExternalUrlSafely(activeBrand.website)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Text style={styles.modalLink}>{activeBrand.domain}</Text>
                        <ExternalLink size={12} color={LedgerTheme.colors.accent} />
                      </ScalePressable>
                    </View>
                  </View>
                  <ScalePressable onPress={() => setActiveBrand(null)} hitSlop={10}>
                    <X size={20} color={LedgerTheme.colors.inkMuted} />
                  </ScalePressable>
                </View>

                <View
                  style={[
                    styles.watchoutBox,
                    activeBrand.overall_sbi_status === '0% Exempt'
                      ? styles.watchoutRed
                      : activeBrand.has_descriptor_trap
                        ? styles.watchoutAmber
                        : styles.watchoutGreen,
                  ]}
                >
                  {activeBrand.overall_sbi_status === '0% Exempt' ? (
                    <ShieldAlert size={16} color="#991B1B" />
                  ) : activeBrand.has_descriptor_trap ? (
                    <AlertTriangle size={16} color="#9A5B13" />
                  ) : (
                    <CheckCircle2 size={16} color="#0F5C4D" />
                  )}
                  <Text style={styles.watchoutText}>
                    {activeBrand.sbi_exemption_reason
                      ? `SBI Exempt (${activeBrand.sbi_exemption_reason}): `
                      : ''}
                    {activeBrand.payment_watchout}
                  </Text>
                </View>

                <Text style={styles.sectionLabel}>
                  1. STATEMENT DESCRIPTORS ({activeBrand.variants.length})
                </Text>
                {activeBrand.variants.map((v) => {
                  const selected = v.variant_id === currentVariant.variant_id;
                  return (
                    <ScalePressable
                      key={v.variant_id}
                      onPress={() => setActiveVariant(v)}
                      style={[
                        styles.variantRow,
                        selected && styles.variantRowActive,
                      ]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.variantTitle}>{v.platform_label}</Text>
                        <Text
                          style={[
                            styles.variantStatus,
                            v.sbi_cashback_status === '0% Exempt'
                              ? { color: '#991B1B' }
                              : v.sbi_cashback_status === '5%'
                                ? { color: '#0F5C4D' }
                                : { color: '#4B525C' },
                          ]}
                        >
                          SBI CB: {v.sbi_cashback_status}
                        </Text>
                      </View>
                      <Text style={styles.descriptorMono}>{v.statement_descriptor}</Text>
                      {(v.probable_mcc || v.sbi_exemption_category) && (
                        <Text style={styles.variantMcc}>
                          {v.probable_mcc ? `MCC ${v.probable_mcc}` : ''}
                          {v.probable_mcc && v.sbi_exemption_category ? ' · ' : ''}
                          {v.sbi_exemption_category
                            ? `Exempt: ${v.sbi_exemption_category}`
                            : ''}
                        </Text>
                      )}
                    </ScalePressable>
                  );
                })}

                <Text style={styles.sectionLabel}>
                  2. CARD FROM YOUR WALLET ({ownedIds.length})
                </Text>
                {ownedIds.length === 0 ? (
                  <ScalePressable
                    onPress={() => {
                      setActiveBrand(null);
                      router.push('/(tabs)/my-cards');
                    }}
                    style={styles.emptyWalletBox}
                  >
                    <Wallet size={16} color={LedgerTheme.colors.accent} />
                    <Text style={styles.emptyWalletText}>
                      Add cards in My Cards to see exact swipe pick &amp; traps here →
                    </Text>
                  </ScalePressable>
                ) : (
                  modalRecommendation.topOwned.slice(0, 3).map((m, idx) => (
                    <ScalePressable
                      key={m.card.card_id}
                      onPress={() => {
                        setActiveBrand(null);
                        router.push(`/card/${m.card.bank_slug}/${m.card.card_slug}`);
                      }}
                      style={[
                        styles.recRow,
                        idx === 0 && styles.recRowHighlight,
                      ]}
                    >
                      <BankLogo bankSlug={m.card.bank_slug} bank={m.card.bank} size="xs" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.recName} numberOfLines={1}>
                          {idx === 0 ? 'Swipe First: ' : 'Alt: '}
                          {m.card.card_name}
                        </Text>
                        <Text style={styles.recReason}>{m.reason}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.recPct}>{m.effectivePct.toFixed(1)}%</Text>
                        <Text style={styles.recAmt}>
                          +{formatInr(m.monthlyRewardInr)}/mo
                        </Text>
                      </View>
                    </ScalePressable>
                  ))
                )}

                <View style={styles.rowBetween}>
                  <Text style={styles.sectionLabel}>
                    3. BEST CARD TO ADD / MARKET PICKS
                  </Text>
                  {modalRecommendation.incrementalAnnualGainInr > 0 && (
                    <Text style={styles.boostText}>
                      +{formatInr(modalRecommendation.incrementalAnnualGainInr)}/yr boost
                    </Text>
                  )}
                </View>

                {modalRecommendation.topMarket.slice(0, 4).map((m) => {
                  const isOwned = ownedSet.has(m.card.card_id);
                  return (
                    <View key={m.card.card_id} style={styles.recRow}>
                      <BankLogo bankSlug={m.card.bank_slug} bank={m.card.bank} size="xs" />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.recName} numberOfLines={1}>
                          {m.card.card_name}
                        </Text>
                        <Text style={styles.recReason}>{m.reason}</Text>
                        {!isOwned && (
                          <ScalePressable onPress={() => toggleOwned(m.card.card_id)}>
                            <Text style={styles.addWalletBtn}>+ Add to My Cards</Text>
                          </ScalePressable>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.recPct}>{m.effectivePct.toFixed(1)}%</Text>
                        <Text style={styles.recAmt}>
                          +{formatInr(m.annualRewardInr)}/yr
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {modalRecommendation.specialHackNote && (
                  <View style={styles.hackBox}>
                    <Sparkles size={15} color={LedgerTheme.colors.accent} />
                    <Text style={styles.hackText}>
                      {modalRecommendation.specialHackNote}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 32 },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: LedgerTheme.radius.lg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 16,
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  spendBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 10,
    gap: 8,
  },
  spendLabel: { fontSize: 12, color: LedgerTheme.colors.inkSecondary },
  spendValue: {
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  presetChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  presetChipText: { fontSize: 11.5, color: LedgerTheme.colors.inkSecondary },
  presetChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  filterPillDark: {
    backgroundColor: LedgerTheme.colors.inkPrimary,
    borderColor: LedgerTheme.colors.inkPrimary,
  },
  filterPillGreen: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  filterPillText: { fontSize: 12, color: LedgerTheme.colors.inkSecondary },
  filterPillTextActive: { color: '#FFFFFF', fontWeight: '600' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  countText: { fontSize: 12, color: LedgerTheme.colors.inkMuted },
  walletLink: {
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  brandCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: LedgerTheme.radius.md,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 13,
    gap: 9,
  },
  brandTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBox: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  brandName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  brandMeta: { fontSize: 11.5, color: LedgerTheme.colors.inkMuted },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusSafe: {
    backgroundColor: '#EEF5F2',
    borderColor: 'rgba(15,92,77,0.25)',
  },
  statusMixed: {
    backgroundColor: '#FEF6EA',
    borderColor: 'rgba(154,91,19,0.28)',
  },
  statusZero: {
    backgroundColor: '#FEE2E2',
    borderColor: 'rgba(153,27,27,0.25)',
  },
  statusTagText: { fontSize: 10.5, fontWeight: '600' },
  descriptorChip: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  descriptorMono: {
    fontSize: 11,
    fontFamily: 'Courier',
    color: LedgerTheme.colors.inkSecondary,
  },
  brandFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  winnerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  winnerText: { fontSize: 12, color: LedgerTheme.colors.inkPrimary, flex: 1 },
  winnerPct: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: LedgerTheme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalLink: { fontSize: 12, color: LedgerTheme.colors.accent },
  watchoutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  watchoutRed: {
    backgroundColor: '#FEE2E2',
    borderColor: 'rgba(153,27,27,0.25)',
  },
  watchoutAmber: {
    backgroundColor: '#FEF6EA',
    borderColor: 'rgba(154,91,19,0.25)',
  },
  watchoutGreen: {
    backgroundColor: '#EEF5F2',
    borderColor: 'rgba(15,92,77,0.2)',
  },
  watchoutText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkPrimary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: LedgerTheme.colors.inkMuted,
  },
  variantRow: {
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    gap: 4,
  },
  variantRowActive: {
    borderColor: LedgerTheme.colors.accent,
    backgroundColor: '#FFFFFF',
  },
  variantTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  variantStatus: { fontSize: 11.5, fontWeight: '700' },
  variantMcc: { fontSize: 11, color: '#991B1B', fontWeight: '500' },
  emptyWalletBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  emptyWalletText: {
    flex: 1,
    fontSize: 12.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  recRowHighlight: {
    backgroundColor: '#EEF5F2',
    borderColor: 'rgba(15,92,77,0.35)',
  },
  recName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  recReason: {
    fontSize: 11.5,
    lineHeight: 16,
    color: LedgerTheme.colors.inkSecondary,
  },
  recPct: { fontSize: 14, fontWeight: '700', color: LedgerTheme.colors.accent },
  recAmt: { fontSize: 11, color: LedgerTheme.colors.inkMuted },
  boostText: { fontSize: 11.5, fontWeight: '700', color: LedgerTheme.colors.accent },
  addWalletBtn: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
    marginTop: 4,
  },
  hackBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#EEF5F2',
    borderWidth: 1,
    borderColor: 'rgba(15,92,77,0.25)',
  },
  hackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: LedgerTheme.colors.accent,
  },
});
