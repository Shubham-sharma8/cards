import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  QrCode,
  ShieldAlert,
  Train,
} from 'lucide-react-native';
import { LOUNGE_CATALOG } from '../src/lib/data';
import {
  getAirportClaimPortals,
  getPortalLoungeMappings,
} from '../src/lib/loungeChecker';
import { openExternalUrlSafely } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';
import { ScalePressable } from '../src/components/MotionPrimitives';

type GuideSection = 'portals' | 'steps' | 'rules';

export default function LoungeGuideScreen() {
  const params = useLocalSearchParams<{ section?: string; airport?: string }>();
  const initialSection: GuideSection =
    params.section === 'steps' || params.section === 'rules' ? params.section : 'portals';
  const [activeSection, setActiveSection] = useState<GuideSection>(initialSection);

  const airportCode = (params.airport || '').toUpperCase().trim();
  const airportPortals = useMemo(
    () => (airportCode ? getAirportClaimPortals(airportCode) : []),
    [airportCode]
  );
  const airportPortalIds = useMemo(
    () => new Set(airportPortals.map((p) => p.id)),
    [airportPortals]
  );
  const mappings = useMemo(() => getPortalLoungeMappings(), []);
  const rules = LOUNGE_CATALOG.network_rules;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: LedgerTheme.colors.canvas }}
      contentContainerStyle={styles.content}
    >
      {/* Header Summary Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <QrCode size={18} color={LedgerTheme.colors.accent} />
          <Text style={styles.heroTitle}>Cardless Lounge Claim Guide</Text>
        </View>
        <Text style={styles.heroSub}>
          {airportCode
            ? `Showing official QR websites for ${airportCode} + 4-step phone entry instructions.`
            : 'Match every Indian airport lounge to its official QR portal and claim without carrying a physical card.'}
        </Text>

        {/* Sub-Section Segmented Control (min 44pt touch target) */}
        <View style={styles.segWrap}>
          {(
            [
              { id: 'portals', label: 'Portals by Lounge' },
              { id: 'steps', label: '4-Step QR Claim' },
              { id: 'rules', label: 'Fee Traps' },
            ] as const
          ).map((tab) => {
            const active = activeSection === tab.id;
            return (
              <ScalePressable
                key={tab.id}
                onPress={() => setActiveSection(tab.id)}
                accessibilityRole="button"
                accessibilityLabel={`${tab.label}${active ? ' selected' : ''}`}
                style={[styles.segPill, active && styles.segPillActive]}
              >
                <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </ScalePressable>
            );
          })}
        </View>
      </View>

      {activeSection === 'portals' && (
        <View style={{ gap: 12 }}>
          {airportCode ? (
            <View style={styles.highlightBox}>
              <CheckCircle2 size={16} color={LedgerTheme.colors.accent} />
              <Text style={styles.highlightText}>
                For <Text style={{ fontWeight: '600' }}>{airportCode}</Text>, use:{' '}
                {airportPortals.map((p) => p.name).join(' or ')}
              </Text>
            </View>
          ) : null}

          {mappings.map((item) => {
            const isMatch = airportCode ? airportPortalIds.has(item.portal.id) : false;
            return (
              <View
                key={item.portal.id}
                style={[styles.card, isMatch && styles.cardHighlighted]}
              >
                <View style={styles.portalHead}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Globe size={15} color={LedgerTheme.colors.accent} />
                      <Text style={styles.cardTitle}>{item.portal.name}</Text>
                      {isMatch && (
                        <View style={styles.matchTag}>
                          <Text style={styles.matchTagText}>{airportCode} Match</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.operatorText}>{item.operators}</Text>
                  </View>
                  <ScalePressable
                    onPress={() => openExternalUrlSafely(item.portal.url)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.portal.name}`}
                    style={styles.openBtn}
                  >
                    <Text style={styles.openBtnText}>Open</Text>
                    <ExternalLink size={13} color="#FFFFFF" />
                  </ScalePressable>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Which Lounges &amp; Airports</Text>
                  <Text style={styles.detailBody}>{item.loungeExamples}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Eligible Cards</Text>
                  <Text style={styles.detailBody}>{item.acceptedCards}</Text>
                </View>

                <View style={styles.airportChipsRow}>
                  {item.airports.slice(0, 10).map((ap) => (
                    <View key={ap} style={styles.apChip}>
                      <Text style={styles.apChipText}>{ap}</Text>
                    </View>
                  ))}
                  {item.airports.length > 10 && (
                    <View style={styles.apChip}>
                      <Text style={styles.apChipText}>+{item.airports.length - 10}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {activeSection === 'steps' && (
        <View style={{ gap: 12 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Visual 4-Step QR Walkthrough</Text>
            <Text style={styles.operatorText}>
              Generate QR before security check so poor basement network never delays entry.
            </Text>
            <Image
              source={require('../assets/illustrations/lounge-claim-guide.png')}
              style={styles.poster}
            />
            <View style={{ gap: 10 }}>
              {[
                {
                  num: '1',
                  title: 'Open Airport Portal',
                  body: 'Pick LoungeOne.ai (Adani/080), lms.hoi.in (Encalm DEL/HYD), or TFS Portal (Travel Club MAA/CCU).',
                },
                {
                  num: '2',
                  title: 'Check Card Eligibility',
                  body: 'Enter card number & expiry. Portal immediately confirms free/spend-unlocked visits.',
                },
                {
                  num: '3',
                  title: 'Verify ₹2 / ₹25 Token Hold',
                  body: 'Complete OTP verification once. The small authorization hold reverses automatically.',
                },
                {
                  num: '4',
                  title: 'Show Phone QR at Desk',
                  body: 'Scan your dynamic QR + boarding pass at reception — physical card not required.',
                },
              ].map((st) => (
                <View key={st.num} style={styles.stepBox}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{st.num}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.stepHeading}>{st.title}</Text>
                    <Text style={styles.detailBody}>{st.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {activeSection === 'rules' && (
        <View style={{ gap: 12 }}>
          {rules?.priority_pass_domestic_warning ? (
            <View style={styles.warnCard}>
              <View style={styles.warnHead}>
                <AlertTriangle size={17} color={LedgerTheme.colors.warn} />
                <Text style={styles.warnTitle}>Priority Pass Domestic Trap</Text>
              </View>
              <Text style={styles.detailBody}>{rules.priority_pass_domestic_warning}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.warnHead}>
              <ShieldAlert size={17} color={LedgerTheme.colors.accent} />
              <Text style={styles.cardTitle}>Card Validation Hold Amounts</Text>
            </View>
            {rules?.visa_validation_charge ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Visa &amp; RuPay Cards</Text>
                <Text style={styles.detailBody}>{rules.visa_validation_charge}</Text>
              </View>
            ) : null}
            {rules?.mastercard_validation_charge ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mastercard Cards</Text>
                <Text style={styles.detailBody}>{rules.mastercard_validation_charge}</Text>
              </View>
            ) : null}
          </View>

          {rules?.irctc_railway_lounge_terms?.quota ? (
            <View style={styles.card}>
              <View style={styles.warnHead}>
                <Train size={17} color={LedgerTheme.colors.accent} />
                <Text style={styles.cardTitle}>IRCTC Railway Lounge Rules</Text>
              </View>
              <Text style={styles.detailBody}>{rules.irctc_railway_lounge_terms.quota}</Text>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 42,
    gap: 14,
  },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: LedgerTheme.radius.lg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 16,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  heroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: LedgerTheme.colors.inkSecondary,
  },
  segWrap: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  segPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: LedgerTheme.radius.md,
    backgroundColor: LedgerTheme.colors.subtle,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segPillActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  segText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  segTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: LedgerTheme.radius.md,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.accent,
    padding: 12,
  },
  highlightText: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  card: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: LedgerTheme.radius.lg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 16,
    gap: 12,
  },
  cardHighlighted: {
    borderColor: LedgerTheme.colors.accent,
    borderWidth: 1.5,
  },
  portalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  operatorText: {
    fontSize: 13,
    lineHeight: 18,
    color: LedgerTheme.colors.inkSecondary,
  },
  matchTag: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  matchTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
  },
  openBtn: {
    minHeight: 44,
    minWidth: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: LedgerTheme.colors.accent,
    borderRadius: LedgerTheme.radius.md,
    paddingHorizontal: 14,
  },
  openBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailRow: {
    gap: 3,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  detailLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailBody: {
    fontSize: 13.5,
    lineHeight: 20,
    color: LedgerTheme.colors.inkPrimary,
  },
  airportChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  apChip: {
    backgroundColor: LedgerTheme.colors.subtle,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  apChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
  },
  poster: {
    width: '100%',
    height: 190,
    borderRadius: LedgerTheme.radius.md,
    resizeMode: 'cover',
    backgroundColor: LedgerTheme.colors.subtle,
  },
  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: LedgerTheme.radius.md,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 12,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: LedgerTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepHeading: {
    fontSize: 14.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  warnCard: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: LedgerTheme.radius.lg,
    borderWidth: 1,
    borderColor: '#EAD4AD',
    padding: 16,
    gap: 8,
  },
  warnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warnTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: LedgerTheme.colors.warn,
  },
});
