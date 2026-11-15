import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronRight,
  ExternalLink,
  Phone,
  PhoneCall,
  Scale,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react-native';
import { BANK_HELP_DIRECTORY, RBI_OMBUDSMAN_INFO } from '../src/lib/bankHelpDirectory';
import { openExternalUrlSafely } from '../src/lib/security';
import { LedgerTheme } from '../src/lib/theme';
import { BankLogo } from '../src/components/BankLogo';
import { ScalePressable } from '../src/components/MotionPrimitives';

type MainSection = 'directory' | 'rbi';

export default function HelpDirectoryScreen() {
  const router = useRouter();
  const [mainSection, setMainSection] = useState<MainSection>('directory');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BANK_HELP_DIRECTORY;
    return BANK_HELP_DIRECTORY.filter((b) =>
      `${b.bank} ${b.bank_slug} ${b.helplineTollFree} ${b.l1Email} ${b.l2NodalEmail} ${b.l3PnoEmail}`
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Customer Support' }} />

      {/* Clean Top Section Switcher — Banks Grid vs RBI & Fraud */}
      <View style={styles.topSegmentWrap}>
        <ScalePressable
          onPress={() => setMainSection('directory')}
          style={[styles.topSegmentBtn, mainSection === 'directory' && styles.topSegmentBtnActive]}
        >
          <PhoneCall
            size={16}
            color={mainSection === 'directory' ? '#FFFFFF' : LedgerTheme.colors.inkSecondary}
          />
          <Text
            style={[
              styles.topSegmentText,
              mainSection === 'directory' && styles.topSegmentTextActive,
            ]}
          >
            Banks ({BANK_HELP_DIRECTORY.length})
          </Text>
        </ScalePressable>

        <ScalePressable
          onPress={() => setMainSection('rbi')}
          style={[styles.topSegmentBtn, mainSection === 'rbi' && styles.topSegmentBtnActive]}
        >
          <Scale
            size={16}
            color={mainSection === 'rbi' ? '#FFFFFF' : LedgerTheme.colors.inkSecondary}
          />
          <Text
            style={[
              styles.topSegmentText,
              mainSection === 'rbi' && styles.topSegmentTextActive,
            ]}
          >
            RBI &amp; Fraud (1930)
          </Text>
        </ScalePressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mainSection === 'rbi' ? (
          <View style={styles.sectionStack}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>RBI INTEGRATED OMBUDSMAN &amp; FRAUD DESK</Text>
              <Text style={styles.heroTitle}>Emergency Blocking &amp; 30-Day RBI Escalation</Text>
              <Text style={styles.heroDesc}>
                Dial national cyber fraud or RBI grievance numbers directly below. Always preserve your L1 Service Request (SR) ticket before escalating to L2 or L3 PNO.
              </Text>

              <View style={styles.emergencyButtonsStack}>
                <ScalePressable
                  onPress={() => openExternalUrlSafely('tel:1930')}
                  style={[styles.bigDialBtn, { backgroundColor: '#B42318' }]}
                >
                  <ShieldAlert size={20} color="#FFFFFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bigDialTitle}>Direct Dial 1930 · National Cyber Fraud</Text>
                    <Text style={styles.bigDialSub}>
                      Report unauthorized card transactions for RBI zero-liability protection
                    </Text>
                  </View>
                  <Phone size={18} color="#FFFFFF" />
                </ScalePressable>

                <ScalePressable
                  onPress={() => openExternalUrlSafely('tel:14448')}
                  style={[styles.bigDialBtn, { backgroundColor: LedgerTheme.colors.accent }]}
                >
                  <Scale size={20} color="#FFFFFF" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bigDialTitle}>Direct Dial 14448 · RBI Ombudsman (CRPC)</Text>
                    <Text style={styles.bigDialSub}>
                      Escalate complaints unresolved after 30 calendar days
                    </Text>
                  </View>
                  <Phone size={18} color="#FFFFFF" />
                </ScalePressable>

                <ScalePressable
                  onPress={() => openExternalUrlSafely(RBI_OMBUDSMAN_INFO.portalUrl)}
                  style={styles.secondaryActionBtn}
                >
                  <ExternalLink size={18} color={LedgerTheme.colors.accent} />
                  <Text style={styles.secondaryActionText}>Open RBI CMS Portal (cms.rbi.org.in)</Text>
                </ScalePressable>
              </View>
            </View>

            <View style={styles.stepsCard}>
              <Text style={styles.sectionHeading}>4-Step RBI Grievance Ladder</Text>
              {[
                {
                  tier: 'Level 1 · Day 0–7',
                  title: '24×7 Care & L1 Email Desk',
                  body: 'Call your issuer toll-free line or email L1 Support and note your Complaint / SR Ticket ID.',
                  bg: '#F3FAF7',
                  border: '#CBE0D7',
                  color: LedgerTheme.colors.accent,
                },
                {
                  tier: 'Level 2 · Day 7–14',
                  title: 'Nodal Grievance Officer',
                  body: 'Forward your L1 SR Ticket ID to the bank Grievance / Nodal Officer desk.',
                  bg: '#F1F5FF',
                  border: '#C7D7FE',
                  color: '#1D4ED8',
                },
                {
                  tier: 'Level 3 · Day 14–21',
                  title: 'Principal Nodal Officer (PNO)',
                  body: 'Escalate to the PNO & Governance email citing all prior SR numbers and disputed ₹ amount.',
                  bg: '#FEF6EA',
                  border: '#F2D7B4',
                  color: LedgerTheme.colors.warn,
                },
                {
                  tier: 'Level 4 · After 30 Days',
                  title: 'RBI Integrated Ombudsman',
                  body: 'File free online at cms.rbi.org.in or call 14448 if unresolved after 30 calendar days.',
                  bg: '#FEF2F2',
                  border: '#FECACA',
                  color: LedgerTheme.colors.danger,
                },
              ].map((step) => (
                <View
                  key={step.tier}
                  style={[styles.stepTile, { backgroundColor: step.bg, borderColor: step.border }]}
                >
                  <Text style={[styles.stepTier, { color: step.color }]}>{step.tier}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.sectionStack}>
            <View style={styles.selectorCard}>
              <Text style={styles.sectionHeading}>Select Your Bank</Text>
              <Text style={styles.sectionLead}>
                Tap any bank square to open its dedicated Direct Dial &amp; L1/L2/PNO page.
              </Text>

              <View style={styles.searchWrap}>
                <Search size={18} color={LedgerTheme.colors.inkMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search bank or PNO email..."
                  placeholderTextColor={LedgerTheme.colors.inkMuted}
                  style={styles.searchInput}
                />
                {query.trim().length > 0 && (
                  <ScalePressable onPress={() => setQuery('')} hitSlop={8}>
                    <X size={17} color={LedgerTheme.colors.inkMuted} />
                  </ScalePressable>
                )}
              </View>

              {/* 2-in-a-row Clean Square Bank Icon Grid — Bigger Icon, Smaller Name, No PSU Tag */}
              <View style={styles.squareGrid}>
                {filtered.map((bank) => (
                  <ScalePressable
                    key={bank.bank_slug}
                    onPress={() =>
                      router.push({
                        pathname: '/help/[bankSlug]',
                        params: { bankSlug: bank.bank_slug },
                      } as never)
                    }
                    style={styles.squareBankCard}
                  >
                    <View style={styles.squareChevron}>
                      <ChevronRight size={15} color={LedgerTheme.colors.inkMuted} />
                    </View>
                    <BankLogo bank={bank.bank} bankSlug={bank.bank_slug} size="xl" />
                    <Text style={styles.squareBankName} numberOfLines={2}>
                      {bank.bank}
                    </Text>
                  </ScalePressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  topSegmentWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  topSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  topSegmentBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  topSegmentText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkSecondary,
  },
  topSegmentTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionStack: {
    gap: 18,
  },
  selectorCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 16,
    gap: 14,
    ...LedgerTheme.shadow.card,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: LedgerTheme.colors.inkPrimary,
  },
  sectionLead: {
    fontSize: 14,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairlineStrong,
    borderRadius: 14,
    paddingHorizontal: 13,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  squareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  squareBankCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    position: 'relative',
  },
  squareChevron: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  squareBankName: {
    fontSize: 12,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 18,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: LedgerTheme.colors.accent,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 29,
  },
  heroDesc: {
    fontSize: 15,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 22,
  },
  emergencyButtonsStack: {
    gap: 10,
    marginTop: 4,
  },
  bigDialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bigDialTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bigDialSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  secondaryActionText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  stepsCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 18,
    gap: 12,
  },
  stepTile: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  stepTier: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
    color: LedgerTheme.colors.inkSecondary,
  },
});
