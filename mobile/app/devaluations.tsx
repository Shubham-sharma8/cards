import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react-native';
import {
  ALL_CARDS,
  DEVALUATION_TRACKER,
  getDossierBySlugs,
} from '../src/lib/data';
import { formatInr, matchesTokenizedQuery } from '../src/lib/format';
import {
  matchCardForDevalMention,
  splitDevalSummaryClauses,
} from '../src/lib/devaluations';
import { openExternalUrlSafely } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';
import { BankLogo } from '../src/components/BankLogo';
import { CardArtwork } from '../src/components/CardArtwork';
import { NativeMultiBarChart } from '../src/components/AnalyticsCharts';
import { FullScreenGraphModal } from '../src/components/FullScreenGraphModal';
import { CanvaFeatureIcon } from '../src/components/FeatureIcon';
import { useCompare } from '../src/components/CompareContext';
import {
  AnimatedProgressBar,
  CalmEntranceView,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../src/components/MotionPrimitives';
import type { CardSummaryItem, DevaluationEvent } from '../src/lib/types';

interface DevalSummarySelection {
  event: DevaluationEvent;
  cardMention: string | null;
  matchedCard: CardSummaryItem | null;
}

export default function DevaluationsScreen() {
  const router = useRouter();
  const { ownedIds, toggleItem, isSelected } = useCompare();

  const [query, setQuery] = useState('');
  const [selectedIssuer, setSelectedIssuer] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'high' | 'wallet'>('all');
  const [issuerFilter, setIssuerFilter] = useState<'all' | 'high_risk'>('all');
  const [summaryModal, setSummaryModal] = useState<DevalSummarySelection | null>(null);
  const [fullGraphOpen, setFullGraphOpen] = useState(false);

  const ownedCards = useMemo(() => {
    const set = new Set(ownedIds);
    return ALL_CARDS.filter((c) => set.has(c.card_id));
  }, [ownedIds]);

  const issuerProfiles = useMemo(
    () =>
      Object.entries(DEVALUATION_TRACKER.issuer_devaluation_profiles || {}).sort(
        ([, a], [, b]) => b.risk_score - a.risk_score
      ),
    []
  );

  const timeline = DEVALUATION_TRACKER.timeline_2024_2026 || [];

  const walletImpactCount = useMemo(() => {
    if (ownedCards.length === 0) return 0;
    return timeline.filter((ev) =>
      ownedCards.some((oc) =>
        ev.cards_affected.some((m) => matchCardForDevalMention(ev.issuer, m, [oc]) !== null)
      )
    ).length;
  }, [timeline, ownedCards]);

  const filteredTimeline = useMemo(() => {
    const q = query.trim();
    return timeline.filter((ev) => {
      if (selectedIssuer && ev.issuer.toLowerCase() !== selectedIssuer.toLowerCase()) {
        return false;
      }
      if (timelineFilter === 'high' && !ev.severity.toLowerCase().includes('high')) {
        return false;
      }
      if (timelineFilter === 'wallet') {
        const hitOwned = ownedCards.some((oc) =>
          ev.cards_affected.some((m) => matchCardForDevalMention(ev.issuer, m, [oc]) !== null)
        );
        if (!hitOwned) return false;
      }
      if (!q) return true;
      return matchesTokenizedQuery(
        q,
        ev.issuer,
        ev.date,
        ev.severity,
        ev.summary,
        ev.cards_affected,
        ev.source_ref
      );
    });
  }, [timeline, selectedIssuer, timelineFilter, ownedCards, query]);

  const filteredIssuers = useMemo(
    () =>
      issuerFilter === 'high_risk'
        ? issuerProfiles.filter(([, p]) => p.risk_score >= 6.5)
        : issuerProfiles,
    [issuerProfiles, issuerFilter]
  );

  const openSummary = (event: DevaluationEvent, cardMention: string | null) => {
    const targetName = cardMention || event.cards_affected[0] || null;
    const matchedCard = targetName
      ? matchCardForDevalMention(event.issuer, targetName, ALL_CARDS)
      : null;
    setSummaryModal({ event, cardMention: targetName, matchedCard });
  };

  const matchedDossier = useMemo(() => {
    const mc = summaryModal?.matchedCard;
    if (!mc) return null;
    return getDossierBySlugs(mc.bank_slug, mc.card_slug);
  }, [summaryModal]);

  const saferAlternates = useMemo(() => {
    const mc = summaryModal?.matchedCard;
    if (!mc) return [];
    return ALL_CARDS.filter(
      (c) =>
        c.card_id !== mc.card_id &&
        c.primary_category === mc.primary_category &&
        c.status === 'active'
    )
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 3);
  }, [summaryModal]);

  return (
    <View style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <CalmEntranceView delayMs={20}>
          <View style={styles.introCard}>
            <View style={styles.introHead}>
              <ShieldAlert size={18} color={LedgerTheme.colors.warn} />
              <Text style={styles.introTitle}>Indian Issuer Devaluation Risk</Text>
            </View>
            <Text style={styles.introSub}>
              Tap any card badge or devaluation event below to read the exact impact summary, cap
              changes, and safer replacement options.
            </Text>

            {ownedCards.length > 0 && (
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setTimelineFilter((prev) => (prev === 'wallet' ? 'all' : 'wallet'));
                }}
                style={[
                  styles.walletExposePill,
                  timelineFilter === 'wallet' && styles.walletExposePillActive,
                ]}
              >
                <Wallet
                  size={14}
                  color={timelineFilter === 'wallet' ? '#FFFFFF' : LedgerTheme.colors.warn}
                />
                <Text
                  style={[
                    styles.walletExposeText,
                    timelineFilter === 'wallet' && { color: '#FFFFFF' },
                  ]}
                >
                  {walletImpactCount > 0
                    ? `${walletImpactCount} events affect your wallet cards`
                    : `${ownedCards.length} wallet cards currently unaffected`}
                </Text>
              </ScalePressable>
            )}
          </View>
        </CalmEntranceView>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Search size={16} color={LedgerTheme.colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search card, bank, lounge cutoff, rent exclusion..."
            placeholderTextColor={LedgerTheme.colors.inkMuted}
            style={styles.searchInput}
          />
          {query.trim().length > 0 && (
            <ScalePressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={LedgerTheme.colors.inkMuted} />
            </ScalePressable>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              2024–2026 Timeline ({filteredTimeline.length})
            </Text>
            {selectedIssuer && (
              <ScalePressable onPress={() => setSelectedIssuer(null)} hitSlop={6}>
                <Text style={styles.clearIssuerText}>
                  Filtered: {selectedIssuer} · Tap to clear
                </Text>
              </ScalePressable>
            )}
          </View>
          <View style={styles.filterPillsRow}>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setTimelineFilter('all');
              }}
              style={[styles.filterPill, timelineFilter === 'all' && styles.filterPillActive]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  timelineFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                All ({timeline.length})
              </Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setTimelineFilter('high');
              }}
              style={[
                styles.filterPill,
                timelineFilter === 'high' && styles.filterPillWarnActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  timelineFilter === 'high' && styles.filterPillWarnTextActive,
                ]}
              >
                High
              </Text>
            </ScalePressable>
          </View>
        </View>

        <View style={styles.stack}>
          {filteredTimeline.map((ev, idx) => {
            const isHigh = ev.severity.toLowerCase().includes('high');
            return (
              <CalmEntranceView
                key={`ev_${ev.date}_${ev.issuer}_${idx}`}
                delayMs={40 + Math.min(idx, 6) * 35}
              >
                <ScalePressable
                  onPress={() => openSummary(ev, null)}
                  style={styles.eventCard}
                >
                  <View style={styles.eventTop}>
                    <View style={styles.dateRow}>
                      <Calendar size={13} color={LedgerTheme.colors.inkMuted} />
                      <Text style={styles.dateText}>{ev.date}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.sevBadge, isHigh && styles.sevBadgeHigh]}>
                        <Text style={[styles.sevText, isHigh && styles.sevTextHigh]}>
                          {ev.severity}
                        </Text>
                      </View>
                      <Text style={styles.summaryTriggerLabel}>Summary →</Text>
                    </View>
                  </View>
                  <View style={styles.issuerRow}>
                    <BankLogo bank={ev.issuer} size="sm" />
                    <Text style={styles.issuerText}>{ev.issuer}</Text>
                  </View>
                  <Text style={styles.summaryText}>{ev.summary}</Text>
                  {(ev.cards_affected || []).length > 0 && (
                    <View style={styles.cardsWrap}>
                      {ev.cards_affected.map((cardName, ci) => (
                        <ScalePressable
                          key={`c_${ci}`}
                          onPress={() => openSummary(ev, cardName)}
                          style={styles.cardPill}
                        >
                          <Text style={styles.cardPillText}>{cardName} ↗</Text>
                        </ScalePressable>
                      ))}
                    </View>
                  )}
                  {(ev.pdf_url || ev.mitc_pdf_url) && (
                    <View style={styles.pdfChipsRow}>
                      {ev.pdf_url ? (
                        <ScalePressable
                          onPress={() => void openExternalUrlSafely(ev.pdf_url)}
                          style={styles.pdfChipBtn}
                        >
                          <FileText size={11} color={LedgerTheme.colors.accent} />
                          <Text style={styles.pdfChipTxt}>Bank T&amp;C / Circular PDF</Text>
                          <ExternalLink size={10} color={LedgerTheme.colors.accent} />
                        </ScalePressable>
                      ) : null}
                      {ev.mitc_pdf_url && ev.mitc_pdf_url !== ev.pdf_url ? (
                        <ScalePressable
                          onPress={() => void openExternalUrlSafely(ev.mitc_pdf_url)}
                          style={styles.pdfChipBtn}
                        >
                          <CanvaFeatureIcon icon="mitc" size={12} />
                          <Text style={styles.pdfChipTxt}>Bank MITC PDF</Text>
                          <ExternalLink size={10} color={LedgerTheme.colors.accent} />
                        </ScalePressable>
                      ) : null}
                    </View>
                  )}
                </ScalePressable>
              </CalmEntranceView>
            );
          })}

          {filteredTimeline.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No matching devaluation events</Text>
              <ScalePressable
                onPress={() => {
                  setQuery('');
                  setSelectedIssuer(null);
                  setTimelineFilter('all');
                }}
              >
                <Text style={styles.clearIssuerText}>Reset filters</Text>
              </ScalePressable>
            </View>
          )}
        </View>

        <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
          <Text style={styles.sectionTitle}>
            Issuer Risk Profiles ({filteredIssuers.length})
          </Text>
          <View style={styles.filterPillsRow}>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setIssuerFilter('all');
              }}
              style={[styles.filterPill, issuerFilter === 'all' && styles.filterPillActive]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  issuerFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </ScalePressable>
            <ScalePressable
              onPress={() => {
                triggerCalmLayoutTransition();
                setIssuerFilter('high_risk');
              }}
              style={[
                styles.filterPill,
                issuerFilter === 'high_risk' && styles.filterPillWarnActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  issuerFilter === 'high_risk' && styles.filterPillWarnTextActive,
                ]}
              >
                Risk ≥ 6.5
              </Text>
            </ScalePressable>
          </View>
        </View>
        {filteredIssuers.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <NativeMultiBarChart
              title="Issuer Devaluation Risk Score (/10)"
              subtitle="Tap a bar to filter timeline or expand full-page graph"
              chartHeight={160}
              onExpandPress={() => setFullGraphOpen(true)}
              data={filteredIssuers.slice(0, 10).map(([bank, profile]) => ({
                id: bank,
                label: bank.replace(/Bank|India/gi, '').trim() || bank,
                value: profile.risk_score,
                displayValue: profile.risk_score.toFixed(1),
                color:
                  profile.risk_score >= 7.5
                    ? LedgerTheme.colors.danger
                    : profile.risk_score >= 6.5
                      ? LedgerTheme.colors.warn
                      : LedgerTheme.colors.accent,
                onPress: () => {
                  triggerCalmLayoutTransition();
                  setSelectedIssuer(
                    selectedIssuer?.toLowerCase() === bank.toLowerCase() ? null : bank
                  );
                },
              }))}
            />
          </View>
        )}
        <View style={styles.stack}>
          {filteredIssuers.map(([bank, profile], idx) => {
            const high = profile.risk_score >= 6.5;
            const barColor =
              profile.risk_score >= 7.5
                ? LedgerTheme.colors.danger
                : high
                  ? LedgerTheme.colors.warn
                  : LedgerTheme.colors.accent;
            const activeBank = selectedIssuer?.toLowerCase() === bank.toLowerCase();
            return (
              <CalmEntranceView key={bank} delayMs={60 + Math.min(idx, 6) * 30}>
                <ScalePressable
                  onPress={() => {
                    triggerCalmLayoutTransition();
                    setSelectedIssuer(activeBank ? null : bank);
                  }}
                  style={[styles.profileCard, activeBank && styles.profileCardActive]}
                >
                  <View style={styles.profileTop}>
                    <View style={styles.profileBankRow}>
                      <BankLogo bank={bank} size="sm" />
                      <Text style={styles.profileBank}>{bank}</Text>
                    </View>
                    <View style={[styles.riskBadge, high && styles.riskBadgeHigh]}>
                      {high && <AlertTriangle size={12} color={LedgerTheme.colors.warn} />}
                      <Text style={[styles.riskVal, high && styles.riskValHigh]}>
                        {profile.risk_score.toFixed(1)}/10 · {profile.frequency}
                      </Text>
                    </View>
                  </View>
                  <AnimatedProgressBar
                    percent={Math.min(100, Math.max(0, profile.risk_score * 10))}
                    height={6}
                    fillColor={barColor}
                  />
                  <Text style={styles.profileNote}>{profile.note}</Text>
                  {(profile.mitc_pdf_url || profile.devaluation_pdf_url) && (
                    <View style={styles.pdfChipsRow}>
                      {profile.mitc_pdf_url ? (
                        <ScalePressable
                          onPress={() => void openExternalUrlSafely(profile.mitc_pdf_url)}
                          style={styles.pdfChipBtn}
                        >
                          <CanvaFeatureIcon icon="mitc" size={12} />
                          <Text style={styles.pdfChipTxt}>MITC PDF</Text>
                          <ExternalLink size={10} color={LedgerTheme.colors.accent} />
                        </ScalePressable>
                      ) : null}
                      {profile.devaluation_pdf_url && profile.devaluation_pdf_url !== profile.mitc_pdf_url ? (
                        <ScalePressable
                          onPress={() => void openExternalUrlSafely(profile.devaluation_pdf_url)}
                          style={styles.pdfChipBtn}
                        >
                          <FileText size={11} color={LedgerTheme.colors.accent} />
                          <Text style={styles.pdfChipTxt}>Revision / T&amp;C Page</Text>
                          <ExternalLink size={10} color={LedgerTheme.colors.accent} />
                        </ScalePressable>
                      ) : null}
                    </View>
                  )}
                </ScalePressable>
              </CalmEntranceView>
            );
          })}
        </View>
      </ScrollView>

      {/* Interactive Card Devaluation Summary Modal */}
      <Modal
        visible={Boolean(summaryModal)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSummaryModal(null)}
      >
        {summaryModal && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalEyebrow}>
                  {summaryModal.event.issuer} · Effective {summaryModal.event.date}
                </Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {summaryModal.cardMention
                    ? `${summaryModal.cardMention} — Devaluation Summary`
                    : `${summaryModal.event.issuer} Revision Summary`}
                </Text>
              </View>
              <ScalePressable
                onPress={() => setSummaryModal(null)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <X size={18} color={LedgerTheme.colors.inkPrimary} />
              </ScalePressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {summaryModal.matchedCard && (() => {
                const mc = summaryModal.matchedCard;
                const compared = isSelected(mc.card_id);
                return (
                  <View style={styles.matchedCardBox}>
                    <View style={styles.matchedCardTop}>
                      <CardArtwork
                        localImagePath={mc.local_image_path}
                        imageUrl={mc.image_url}
                        bank={mc.bank}
                        cardName={mc.card_name}
                        network={mc.card_network}
                        cardTheme={mc.card_theme}
                        size="md"
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.issuerRow}>
                          <BankLogo bankSlug={mc.bank_slug} bank={mc.bank} size="xs" />
                          <Text style={styles.dateText}>{mc.bank}</Text>
                        </View>
                        <Text style={styles.matchedCardName}>{mc.card_name}</Text>
                        <Text style={styles.matchedCardMeta}>
                          {mc.annual_fee_inr === 0 ? '₹0 (LTF)' : formatInr(mc.annual_fee_inr)} ·{' '}
                          {mc.overall_rating.toFixed(1)}/10 rating
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalActionRow}>
                      <ScalePressable
                        onPress={() => {
                          setSummaryModal(null);
                          router.push({
                            pathname: '/card/[bankSlug]/[cardSlug]',
                            params: { bankSlug: mc.bank_slug, cardSlug: mc.card_slug },
                          });
                        }}
                        style={styles.primaryModalBtn}
                      >
                        <Text style={styles.primaryModalBtnText}>Open Full Dossier</Text>
                        <ChevronRight size={15} color="#FFFFFF" />
                      </ScalePressable>

                      <ScalePressable
                        onPress={() =>
                          toggleItem({
                            card_id: mc.card_id,
                            card_name: mc.card_name,
                            bank: mc.bank,
                            bank_slug: mc.bank_slug,
                            card_slug: mc.card_slug,
                            annual_fee_inr: mc.annual_fee_inr,
                            overall_rating: mc.overall_rating,
                          })
                        }
                        style={[
                          styles.secondaryModalBtn,
                          compared && {
                            borderColor: LedgerTheme.colors.accent,
                            backgroundColor: LedgerTheme.colors.tintPrimary,
                          },
                        ]}
                      >
                        {compared ? (
                          <Check size={14} color={LedgerTheme.colors.accent} />
                        ) : (
                          <Plus size={14} color={LedgerTheme.colors.inkPrimary} />
                        )}
                        <Text
                          style={[
                            styles.secondaryModalBtnText,
                            compared && { color: LedgerTheme.colors.accent },
                          ]}
                        >
                          {compared ? 'Added' : 'Compare'}
                        </Text>
                      </ScalePressable>
                    </View>
                  </View>
                );
              })()}

              {/* Parsed Impact Summary */}
              <View style={styles.modalSection}>
                <View style={styles.eventTop}>
                  <Text style={styles.modalSectionTitle}>What Changed &amp; Impact</Text>
                  <View
                    style={[
                      styles.sevBadge,
                      summaryModal.event.severity.toLowerCase().includes('high') &&
                        styles.sevBadgeHigh,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sevText,
                        summaryModal.event.severity.toLowerCase().includes('high') &&
                          styles.sevTextHigh,
                      ]}
                    >
                      {summaryModal.event.severity} Severity
                    </Text>
                  </View>
                </View>

                {splitDevalSummaryClauses(summaryModal.event.summary).map((clause, i) => (
                  <View key={i} style={styles.clauseRow}>
                    <AlertTriangle
                      size={14}
                      color={LedgerTheme.colors.warn}
                      style={{ marginTop: 2 }}
                    />
                    <Text style={styles.clauseText}>{clause}</Text>
                  </View>
                ))}

                {summaryModal.event.source_ref ? (
                  <Text style={styles.sourceText}>
                    Verified Source: {summaryModal.event.source_ref}
                  </Text>
                ) : null}
                {(summaryModal.event.pdf_url || summaryModal.event.mitc_pdf_url) && (
                  <View style={styles.pdfChipsRow}>
                    {summaryModal.event.pdf_url ? (
                      <ScalePressable
                        onPress={() => void openExternalUrlSafely(summaryModal.event.pdf_url)}
                        style={styles.pdfChipBtn}
                      >
                        <FileText size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.pdfChipTxt}>Open Official Revision / KFS</Text>
                        <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                      </ScalePressable>
                    ) : null}
                    {summaryModal.event.mitc_pdf_url ? (
                      <ScalePressable
                        onPress={() => void openExternalUrlSafely(summaryModal.event.mitc_pdf_url)}
                        style={styles.pdfChipBtn}
                      >
                        <CanvaFeatureIcon icon="mitc" size={12} />
                        <Text style={styles.pdfChipTxt}>Open Bank MITC PDF</Text>
                        <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                      </ScalePressable>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Card-Specific Devaluation History from Dossier */}
              {matchedDossier &&
                (matchedDossier.devaluation_analysis.devaluation_history.length > 0 ||
                  matchedDossier.devaluation_analysis.watch_out_vectors.length > 0) && (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>
                      Card Track Record ({matchedDossier.devaluation_analysis.devaluation_risk_score.toFixed(1)}/10 Risk)
                    </Text>
                    {matchedDossier.devaluation_analysis.devaluation_history.map((h, i) => (
                      <Text key={`dh_${i}`} style={styles.clauseText}>
                        • {h}
                      </Text>
                    ))}
                    {matchedDossier.devaluation_analysis.watch_out_vectors.map((v, i) => (
                      <Text key={`wv_${i}`} style={styles.watchVecText}>
                        Watch out: {v}
                      </Text>
                    ))}
                  </View>
                )}

              {/* Switch Other Affected Cards in This Revision */}
              {(summaryModal.event.cards_affected || []).length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>
                    Other Affected Cards in This Update
                  </Text>
                  <View style={styles.cardsWrap}>
                    {summaryModal.event.cards_affected.map((cName) => {
                      const active = summaryModal.cardMention === cName;
                      return (
                        <ScalePressable
                          key={cName}
                          onPress={() => openSummary(summaryModal.event, cName)}
                          style={[styles.cardPill, active && styles.cardPillSelected]}
                        >
                          <Text
                            style={[
                              styles.cardPillText,
                              active && { color: '#FFFFFF', fontWeight: '500' },
                            ]}
                          >
                            {cName}
                          </Text>
                        </ScalePressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Safer Alternates */}
              {saferAlternates.length > 0 && (
                <View style={[styles.modalSection, { borderColor: LedgerTheme.colors.tintBorder }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={15} color={LedgerTheme.colors.accent} />
                    <Text style={[styles.modalSectionTitle, { color: LedgerTheme.colors.accent }]}>
                      Top Alternatives in {summaryModal.matchedCard?.primary_category}
                    </Text>
                  </View>
                  {saferAlternates.map((alt) => (
                    <ScalePressable
                      key={alt.card_id}
                      onPress={() => {
                        setSummaryModal(null);
                        router.push({
                          pathname: '/card/[bankSlug]/[cardSlug]',
                          params: { bankSlug: alt.bank_slug, cardSlug: alt.card_slug },
                        });
                      }}
                      style={styles.altRow}
                    >
                      <BankLogo bankSlug={alt.bank_slug} bank={alt.bank} size="xs" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.altName} numberOfLines={1}>
                          {alt.card_name}
                        </Text>
                        <Text style={styles.altMeta}>
                          {alt.annual_fee_inr === 0 ? 'LTF ₹0' : formatInr(alt.annual_fee_inr)} ·{' '}
                          {alt.overall_rating.toFixed(1)}/10
                        </Text>
                      </View>
                      <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                    </ScalePressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      <FullScreenGraphModal
        visible={fullGraphOpen}
        onClose={() => setFullGraphOpen(false)}
        title="Issuer Devaluation Risk Score (/10)"
        subtitle="Comparing 16 major Indian credit card issuers by policy churn & devaluations"
        categories={filteredIssuers.map(([bank]) => bank.replace(/Bank|Small Finance|India/gi, '').trim().slice(0, 12))}
        series={[
          {
            label: 'Devaluation Risk (/10)',
            color: LedgerTheme.colors.warn,
            values: filteredIssuers.map(([, p]) => p.risk_score),
          },
        ]}
        valueSuffix="/10"
      />
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
    paddingBottom: 42,
    gap: 14,
  },
  introCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...LedgerTheme.shadow.card,
  },
  introHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  introTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  introSub: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  walletExposePill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: '#DFB684',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  walletExposePillActive: {
    backgroundColor: LedgerTheme.colors.warn,
    borderColor: LedgerTheme.colors.warn,
  },
  walletExposeText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: LedgerTheme.colors.inkPrimary,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  clearIssuerText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  filterPillActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  filterPillWarnActive: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderColor: '#DFB684',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  filterPillTextActive: {
    color: LedgerTheme.colors.accent,
  },
  filterPillWarnTextActive: {
    color: LedgerTheme.colors.warn,
  },
  stack: {
    gap: 12,
  },
  eventCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...LedgerTheme.shadow.card,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  sevBadge: {
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
  },
  sevBadgeHigh: {
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  sevText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  sevTextHigh: {
    color: LedgerTheme.colors.warn,
  },
  summaryTriggerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  issuerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  issuerText: {
    fontSize: 16.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  summaryText: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  cardsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  cardPill: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  cardPillSelected: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  cardPillText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkPrimary,
  },
  profileCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 7,
    ...LedgerTheme.shadow.card,
  },
  profileCardActive: {
    borderColor: LedgerTheme.colors.accent,
    backgroundColor: '#F7FBF9',
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  profileBankRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBank: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  riskBadgeHigh: {
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  riskVal: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  riskValHigh: {
    color: LedgerTheme.colors.warn,
  },
  profileNote: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  emptyBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: LedgerTheme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  modalEyebrow: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: LedgerTheme.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  matchedCardBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  matchedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchedCardName: {
    fontSize: 15.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  matchedCardMeta: {
    fontSize: 12.5,
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryModalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
  },
  primaryModalBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  secondaryModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  secondaryModalBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalSection: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 14,
    gap: 9,
  },
  modalSectionTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    padding: 10,
  },
  clauseText: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 19,
  },
  sourceText: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  watchVecText: {
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    padding: 10,
  },
  altName: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  altMeta: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
  },
  pdfChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pdfChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  pdfChipTxt: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
});
