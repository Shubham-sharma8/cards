import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CreditCard,
  ExternalLink,
  Mail,
  Phone,
  PhoneCall,
  Scale,
  ShieldAlert,
} from 'lucide-react-native';
import { BANK_HELP_DIRECTORY } from '../../src/lib/bankHelpDirectory';
import { openExternalUrlSafely } from '../../src/lib/security';
import { LedgerTheme } from '../../src/lib/theme';
import { BankLogo } from '../../src/components/BankLogo';
import { ScalePressable } from '../../src/components/MotionPrimitives';

type BankDetailSection = 'dial' | 'escalation';

function buildTelHref(raw: string): string {
  const first = raw.split('/')[0].replace(/\(.*?\)/g, '').replace(/[^\d+]/g, '');
  return first.length >= 4 ? `tel:${first}` : '';
}

function buildAltTelHref(raw: string): string {
  const parts = raw.split('/');
  const candidate = (parts[1] || parts[0] || '').replace(/\(.*?\)/g, '').replace(/[^\d+]/g, '');
  return candidate.length >= 4 ? `tel:${candidate}` : '';
}

export default function BankSupportDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bankSlug?: string }>();
  const [section, setSection] = useState<BankDetailSection>('dial');

  const bank = useMemo(() => {
    const slug = typeof params.bankSlug === 'string' ? params.bankSlug : '';
    return (
      BANK_HELP_DIRECTORY.find((b) => b.bank_slug === slug) ??
      BANK_HELP_DIRECTORY[0]
    );
  }, [params.bankSlug]);

  if (!bank) return null;

  const tollFreeHref = buildTelHref(bank.helplineTollFree);
  const altHref = buildTelHref(bank.helplineAlt);
  const blockHref = buildTelHref(bank.cardBlockNumber);
  const pnoHref = buildAltTelHref(bank.pnoPhone);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: bank.bank, headerBackTitle: 'Banks' }} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dedicated Issuer Identity Header */}
        <View style={styles.heroCard}>
          <BankLogo bank={bank.bank} bankSlug={bank.bank_slug} size="2xl" />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.bankTitle}>{bank.bank}</Text>
            <Text style={styles.bankSubtitle}>
              Official 24×7 Helplines, Card Block &amp; L1 / L2 / L3 PNO Escalation
            </Text>
            <ScalePressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/finder',
                  params: { q: bank.bank },
                } as never)
              }
              style={styles.cardsLinkPill}
            >
              <CreditCard size={14} color={LedgerTheme.colors.accent} />
              <Text style={styles.cardsLinkText}>Browse {bank.bank} Cards →</Text>
            </ScalePressable>
          </View>
        </View>

        {/* Segmented Sub-Pages inside Issuer Support */}
        <View style={styles.segmentWrap}>
          <ScalePressable
            onPress={() => setSection('dial')}
            style={[styles.segmentBtn, section === 'dial' && styles.segmentBtnActive]}
          >
            <Phone size={16} color={section === 'dial' ? '#FFFFFF' : LedgerTheme.colors.inkPrimary} />
            <Text style={[styles.segmentText, section === 'dial' && styles.segmentTextActive]}>
              Direct Dial &amp; Block
            </Text>
          </ScalePressable>

          <ScalePressable
            onPress={() => setSection('escalation')}
            style={[styles.segmentBtn, section === 'escalation' && styles.segmentBtnActive]}
          >
            <Mail
              size={16}
              color={section === 'escalation' ? '#FFFFFF' : LedgerTheme.colors.inkPrimary}
            />
            <Text
              style={[styles.segmentText, section === 'escalation' && styles.segmentTextActive]}
            >
              L1 / L2 / L3 PNO
            </Text>
          </ScalePressable>
        </View>

        {section === 'dial' ? (
          <View style={styles.stack}>
            <View style={styles.infoCard}>
              <Text style={styles.eyebrow}>24×7 CUSTOMER CARE HELPLINE</Text>
              <Text style={styles.bigPhone}>{bank.helplineTollFree}</Text>
              {bank.helplineAlt ? (
                <Text style={styles.subPhone}>Alternate / NRI: {bank.helplineAlt}</Text>
              ) : null}

              <View style={styles.dialRow}>
                {tollFreeHref ? (
                  <ScalePressable
                    onPress={() => openExternalUrlSafely(tollFreeHref)}
                    style={styles.dialPrimaryBtn}
                  >
                    <PhoneCall size={18} color="#FFFFFF" />
                    <Text style={styles.dialPrimaryTxt}>Direct Dial Care</Text>
                  </ScalePressable>
                ) : null}

                {altHref && altHref !== tollFreeHref ? (
                  <ScalePressable
                    onPress={() => openExternalUrlSafely(altHref)}
                    style={styles.dialSecondaryBtn}
                  >
                    <Phone size={17} color={LedgerTheme.colors.accent} />
                    <Text style={styles.dialSecondaryTxt}>Dial Alt Line</Text>
                  </ScalePressable>
                ) : null}
              </View>
            </View>

            <View style={[styles.infoCard, styles.dangerCard]}>
              <Text style={[styles.eyebrow, { color: LedgerTheme.colors.danger }]}>
                LOST / STOLEN CARD BLOCKING
              </Text>
              <Text style={[styles.bigPhone, { color: '#7F1D1D' }]}>{bank.cardBlockNumber}</Text>

              {blockHref ? (
                <ScalePressable
                  onPress={() => openExternalUrlSafely(blockHref)}
                  style={[styles.dialPrimaryBtn, { backgroundColor: '#B42318', marginTop: 4 }]}
                >
                  <ShieldAlert size={18} color="#FFFFFF" />
                  <Text style={styles.dialPrimaryTxt}>Direct Dial Card Block</Text>
                </ScalePressable>
              ) : null}
            </View>

            {pnoHref ? (
              <View style={styles.infoCard}>
                <Text style={styles.eyebrow}>PRINCIPAL NODAL OFFICER (PNO) PHONE</Text>
                <Text style={styles.bigPhone}>{bank.pnoPhone}</Text>
                <ScalePressable
                  onPress={() => openExternalUrlSafely(pnoHref)}
                  style={styles.dialSecondaryBtn}
                >
                  <Phone size={17} color={LedgerTheme.colors.accent} />
                  <Text style={styles.dialSecondaryTxt}>Direct Dial PNO Desk</Text>
                </ScalePressable>
              </View>
            ) : null}

            <ScalePressable
              onPress={() => openExternalUrlSafely(bank.l1PortalUrl)}
              style={styles.portalBtn}
            >
              <ExternalLink size={18} color={LedgerTheme.colors.accent} />
              <Text style={styles.portalBtnTxt}>Open {bank.bank} Support Portal</Text>
            </ScalePressable>

            <ScalePressable
              onPress={() => openExternalUrlSafely('tel:1930')}
              style={styles.fraudBanner}
            >
              <ShieldAlert size={20} color="#B42318" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fraudTitle}>Unauthorized Cyber Fraud? Tap to Dial 1930</Text>
                <Text style={styles.fraudSub}>
                  Report within 3 working days for RBI zero-liability protection
                </Text>
              </View>
              <Phone size={18} color="#B42318" />
            </ScalePressable>
          </View>
        ) : (
          <View style={styles.stack}>
            <ScalePressable
              onPress={() => openExternalUrlSafely(`mailto:${bank.l1Email}`)}
              style={[styles.tierCard, { backgroundColor: '#F3FAF7', borderColor: '#CBE0D7' }]}
            >
              <View style={styles.tierTopRow}>
                <Text style={[styles.tierTitle, { color: LedgerTheme.colors.accent }]}>
                  L1 · Customer Care ({bank.l1Sla})
                </Text>
                <Mail size={18} color={LedgerTheme.colors.accent} />
              </View>
              <Text style={styles.tierEmail}>{bank.l1Email}</Text>
              <Text style={styles.tierHint}>Tap to compose email and request SR Ticket ID</Text>
            </ScalePressable>

            <ScalePressable
              onPress={() => openExternalUrlSafely(`mailto:${bank.l2NodalEmail}`)}
              style={[styles.tierCard, { backgroundColor: '#F1F5FF', borderColor: '#C7D7FE' }]}
            >
              <View style={styles.tierTopRow}>
                <Text style={[styles.tierTitle, { color: '#1D4ED8' }]}>
                  L2 · {bank.l2NodalLabel} ({bank.l2Sla})
                </Text>
                <Mail size={18} color="#1D4ED8" />
              </View>
              <Text style={styles.tierEmail}>{bank.l2NodalEmail}</Text>
              <Text style={styles.tierHint}>Attach your L1 Service Request Ticket ID</Text>
            </ScalePressable>

            <ScalePressable
              onPress={() => openExternalUrlSafely(`mailto:${bank.l3PnoEmail}`)}
              style={[styles.tierCard, { backgroundColor: '#FEF6EA', borderColor: '#F2D7B4' }]}
            >
              <View style={styles.tierTopRow}>
                <Text style={[styles.tierTitle, { color: LedgerTheme.colors.warn }]}>
                  L3 · Principal Nodal Officer ({bank.pnoPhone})
                </Text>
                <Mail size={18} color={LedgerTheme.colors.warn} />
              </View>
              <Text style={styles.tierEmail}>{bank.l3PnoEmail}</Text>
              <Text style={styles.tierGov}>Governance: {bank.governanceEmail}</Text>
            </ScalePressable>

            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Escalation Note</Text>
              <Text style={styles.noteBody}>{bank.escalationNote}</Text>
            </View>

            <ScalePressable
              onPress={() => openExternalUrlSafely(bank.grievancePageUrl)}
              style={styles.portalBtn}
            >
              <ExternalLink size={18} color={LedgerTheme.colors.accent} />
              <Text style={styles.portalBtnTxt}>Open Official Grievance Policy Page</Text>
            </ScalePressable>

            <ScalePressable
              onPress={() => openExternalUrlSafely('tel:14448')}
              style={styles.rbiBtn}
            >
              <Scale size={18} color="#FFFFFF" />
              <Text style={styles.rbiBtnTxt}>Unresolved 30+ Days? Direct Dial RBI 14448</Text>
            </ScalePressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 48 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 22,
    padding: 18,
    ...LedgerTheme.shadow.card,
  },
  bankTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 27,
  },
  bankSubtitle: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 19,
  },
  cardsLinkPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginTop: 2,
  },
  cardsLinkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  segmentText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  stack: { gap: 14 },
  infoCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: LedgerTheme.colors.inkMuted,
  },
  bigPhone: {
    fontSize: 20,
    fontWeight: '800',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  subPhone: {
    fontSize: 14.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  dialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  dialPrimaryBtn: {
    flex: 1,
    minWidth: 155,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dialPrimaryTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dialSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dialSecondaryTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  portalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  portalBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  fraudBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 15,
  },
  fraudTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  fraudSub: {
    fontSize: 12.5,
    color: '#7F1D1D',
    marginTop: 2,
  },
  tierCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  tierEmail: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  tierHint: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  tierGov: {
    fontSize: 14,
    fontWeight: '600',
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
  noteBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 15,
    gap: 5,
  },
  noteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
  rbiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F5C4D',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  rbiBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
