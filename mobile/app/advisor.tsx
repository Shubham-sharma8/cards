import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react-native';
import { ALL_CARDS, getAdvisorMetaMap } from '../src/lib/data';
import {
  CATEGORY_OPTIONS,
  evaluateTwoCardCombo,
  findBestTwoCardCombo,
  scoreCardsForProfile,
  type MobileAdvisorProfile,
} from '../src/lib/advisor';
import { CONVERSION_STRATEGIES } from '../src/lib/conversion';
import {
  AI_PROMPT_EXAMPLES,
  generateAdvisorAiSummary,
  parseNaturalLanguagePromptToProfile,
} from '../src/lib/aiSuggestions';
import {
  formatInr,
  matchesTokenizedQuery,
  SPEND_CATEGORY_META,
} from '../src/lib/format';
import { LedgerTheme } from '../src/lib/theme';
import { LedgerCardItem } from '../src/components/LedgerCardItem';
import { BankLogo } from '../src/components/BankLogo';
import { CardArtwork } from '../src/components/CardArtwork';
import {
  CanvaFeatureIcon,
  resolveCategoryCanvaIcon,
} from '../src/components/FeatureIcon';
import {
  AiOrb3D,
  AiShimmerStrip,
  AnimatedReveal,
  CalmEntranceView,
  ScalePressable,
  triggerCalmLayoutTransition,
} from '../src/components/MotionPrimitives';
import { useCompare } from '../src/components/CompareContext';
import type {
  AdvisorPriorityMode,
  CardSummaryItem,
  RewardConversionStrategy,
  SpendCategoryKey,
} from '../src/lib/types';

type AdvisorTab = 'match' | 'combo' | 'saved';
type PickerFilter =
  | 'all'
  | 'ltf'
  | 'upi'
  | 'cashback'
  | 'travel'
  | 'dining'
  | 'fuel';

const PICKER_FILTERS: Array<{ id: PickerFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ltf', label: 'Lifetime Free' },
  { id: 'upi', label: 'RuPay UPI' },
  { id: 'cashback', label: 'Cashback' },
  { id: 'travel', label: 'Travel' },
  { id: 'dining', label: 'Dining' },
  { id: 'fuel', label: 'Fuel' },
];

function findCardIdByPatterns(patterns: string[]): string | null {
  for (const pat of patterns) {
    const q = pat.toLowerCase();
    const hit = ALL_CARDS.find(
      (c) =>
        c.card_name.toLowerCase().includes(q) ||
        c.card_id.toLowerCase().includes(q)
    );
    if (hit) return hit.card_id;
  }
  return null;
}

function getPeakReturnPct(card: CardSummaryItem): number {
  let max = 0;
  for (const [k, v] of Object.entries(card.effective_return_pct_by_category || {})) {
    if (k === 'international_forex_net_of_markup') continue;
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}

const INCOME_PRESETS = [
  { label: '₹35k', value: 35000 },
  { label: '₹75k', value: 75000 },
  { label: '₹1.5L', value: 150000 },
  { label: '₹3L', value: 300000 },
  { label: '₹5L', value: 500000 },
  { label: '₹8L+', value: 800000 },
];

const CIBIL_PRESETS = [
  { label: 'New / <720', value: 700 },
  { label: '750+', value: 750 },
  { label: '780+', value: 785 },
];

const ADVISOR_SPEND_KEYS: SpendCategoryKey[] = [
  'groceries_quick_commerce',
  'fuel',
  'online_shopping_general',
  'amazon_flipkart_myntra',
  'dining_swiggy_zomato',
  'travel_flights_hotels',
  'upi_scan_and_pay',
  'utilities_bills_telecom',
  'insurance',
];

const EXTRA_SPEND_KEYS: SpendCategoryKey[] = [
  'education_rent_govt',
  'offline_general_other',
];

const PRIORITY_MODES: Array<{ id: AdvisorPriorityMode; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'max_net', label: 'Max Net ₹' },
  { id: 'low_fee_uncapped', label: 'Low Fee & Uncapped' },
  { id: 'travel_lounge', label: 'Travel & Lounge' },
];

const INITIAL_SPEND: Record<SpendCategoryKey, number> = {
  online_shopping_general: 7000,
  amazon_flipkart_myntra: 6000,
  dining_swiggy_zomato: 4000,
  groceries_quick_commerce: 6000,
  travel_flights_hotels: 6000,
  upi_scan_and_pay: 5000,
  utilities_bills_telecom: 3500,
  fuel: 3000,
  insurance: 1500,
  education_rent_govt: 0,
  international_forex_net_of_markup: 0,
  offline_general_other: 4000,
};

export default function AdvisorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    tab?: string;
    income?: string;
    strategy?: string;
    q?: string;
  }>();
  const { savedIds, clearSaved, isSelected, toggleItem, isSaved, toggleSaved } =
    useCompare();

  const [tab, setTab] = useState<AdvisorTab>(
    params.tab === 'combo' ? 'combo' : params.tab === 'saved' ? 'saved' : 'match'
  );

  useEffect(() => {
    if (params.tab === 'combo' || params.tab === 'saved' || params.tab === 'match') {
      setTab(params.tab);
    }
  }, [params.tab]);

  const [monthlyIncomeInr, setMonthlyIncomeInr] = useState(75000);
  const [cibilScore, setCibilScore] = useState(750);
  const [feePreference, setFeePreference] =
    useState<MobileAdvisorProfile['feePreference']>('any');
  const [priorityMode, setPriorityMode] = useState<AdvisorPriorityMode>('balanced');
  const [conversionStrategy, setConversionStrategy] =
    useState<RewardConversionStrategy>('default_inr');
  const [avoidHighDevaluation, setAvoidHighDevaluation] = useState(false);

  useEffect(() => {
    if (params.q && params.q.trim()) {
      const cleanQ = params.q.trim();
      setAiPromptText(cleanQ);
      const patch = parseNaturalLanguagePromptToProfile(cleanQ, INITIAL_SPEND);
      setAiChips(patch.detectedChips);
      if (patch.monthlyIncomeInr !== undefined) setMonthlyIncomeInr(patch.monthlyIncomeInr);
      if (patch.feePreference !== undefined) setFeePreference(patch.feePreference);
      if (patch.priorityMode !== undefined) setPriorityMode(patch.priorityMode);
      if (patch.conversionStrategy !== undefined) {
        setConversionStrategy(patch.conversionStrategy);
      }
      if (patch.avoidHighDevaluation !== undefined) {
        setAvoidHighDevaluation(patch.avoidHighDevaluation);
      }
      setNeedRupayUpi(Boolean(patch.needRupayUpi));
      setNeedNoSpendLounge(Boolean(patch.needNoSpendLounge));
      setNeedZeroLowForex(Boolean(patch.needZeroLowForex));
      setNeedGolf(Boolean(patch.needGolf));
      if (patch.preferredGoals) setPreferredGoals(patch.preferredGoals);
      setMonthlySpend(patch.monthlySpend);
    }
    if (params.income) {
      const parsed = Number(params.income);
      if (Number.isFinite(parsed) && parsed >= 25000) {
        setMonthlyIncomeInr(parsed);
        if (parsed >= 250000) {
          setMonthlySpend((prev) => ({
            ...prev,
            travel_flights_hotels: 28000,
            online_shopping_general: 20000,
            dining_swiggy_zomato: 14000,
            groceries_quick_commerce: 12000,
            offline_general_other: 12000,
          }));
        } else if (parsed >= 150000) {
          setMonthlySpend((prev) => ({
            ...prev,
            travel_flights_hotels: 15000,
            online_shopping_general: 14000,
            dining_swiggy_zomato: 10000,
          }));
        }
      }
    }
    if (
      params.strategy &&
      ['default_inr', 'cash_statement', 'air_miles', 'accor_all'].includes(params.strategy)
    ) {
      setConversionStrategy(params.strategy as RewardConversionStrategy);
    }
  }, [params.income, params.strategy, params.q]);
  const [strictEligibility, setStrictEligibility] = useState(false);
  const [showExtraSpends, setShowExtraSpends] = useState(false);
  const [expandedLimitCards, setExpandedLimitCards] = useState<Record<string, boolean>>({});
  const [aiPromptText, setAiPromptText] = useState('');
  const [aiChips, setAiChips] = useState<string[]>([]);
  const [needRupayUpi, setNeedRupayUpi] = useState(false);
  const [needNoSpendLounge, setNeedNoSpendLounge] = useState(false);
  const [needZeroLowForex, setNeedZeroLowForex] = useState(false);
  const [needGolf, setNeedGolf] = useState(false);
  const [preferredGoals, setPreferredGoals] = useState<string[]>([
    'Cashback',
    'Online Shopping',
  ]);
  const [monthlySpend, setMonthlySpend] =
    useState<Record<SpendCategoryKey, number>>(INITIAL_SPEND);

  const advisorMetaMap = useMemo(() => getAdvisorMetaMap(), []);

  // Interactive Box-Type 2-Card Combo state
  const [manualCardAId, setManualCardAId] = useState<string | null>(null);
  const [manualCardBId, setManualCardBId] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'A' | 'B' | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerFilter, setPickerFilter] = useState<PickerFilter>('all');

  const applyAiPrompt = (rawText: string) => {
    const clean = rawText.trim();
    if (!clean) return;
    triggerCalmLayoutTransition();
    setAiPromptText(clean);
    const patch = parseNaturalLanguagePromptToProfile(clean, INITIAL_SPEND);
    setAiChips(patch.detectedChips);
    if (patch.monthlyIncomeInr !== undefined) setMonthlyIncomeInr(patch.monthlyIncomeInr);
    if (patch.feePreference !== undefined) setFeePreference(patch.feePreference);
    if (patch.priorityMode !== undefined) setPriorityMode(patch.priorityMode);
    if (patch.conversionStrategy !== undefined) {
      setConversionStrategy(patch.conversionStrategy);
    }
    if (patch.avoidHighDevaluation !== undefined) {
      setAvoidHighDevaluation(patch.avoidHighDevaluation);
    }
    setNeedRupayUpi(Boolean(patch.needRupayUpi));
    setNeedNoSpendLounge(Boolean(patch.needNoSpendLounge));
    setNeedZeroLowForex(Boolean(patch.needZeroLowForex));
    setNeedGolf(Boolean(patch.needGolf));
    if (patch.preferredGoals) setPreferredGoals(patch.preferredGoals);
    setMonthlySpend(patch.monthlySpend);
  };

  const curatedCombos = useMemo(() => {
    const infinia = findCardIdByPatterns(['hdfc bank infinia', 'infinia metal', 'infinia']);
    const hsbcPremier = findCardIdByPatterns(['hsbc premier']);
    const sbiCb = findCardIdByPatterns(['cashback sbi']);
    const hsbcLive = findCardIdByPatterns(['hsbc live+']);
    const atlas = findCardIdByPatterns(['axis bank atlas']);
    const tataNeuInf = findCardIdByPatterns(['tata neu infinity']);
    const amazonIcici = findCardIdByPatterns(['amazon pay icici']);
    const swiggyHdfc = findCardIdByPatterns(['swiggy hdfc']);
    const airtelAxis = findCardIdByPatterns(['airtel axis']);

    const list: Array<{ id: string; label: string; a: string; b: string }> = [];
    if (infinia && atlas) {
      list.push({ id: 'hni_infinia_atlas', label: 'Infinia + Axis Atlas', a: infinia, b: atlas });
    }
    if (hsbcPremier && atlas) {
      list.push({ id: 'hni_premier_atlas', label: 'HSBC Premier + Atlas', a: hsbcPremier, b: atlas });
    }
    if (sbiCb && hsbcLive) {
      list.push({ id: 'cb_live', label: 'SBI Cashback + HSBC Live+', a: sbiCb, b: hsbcLive });
    }
    if (atlas && tataNeuInf) {
      list.push({ id: 'atlas_neu', label: 'Axis Atlas + Tata Neu Inf.', a: atlas, b: tataNeuInf });
    }
    if (amazonIcici && swiggyHdfc) {
      list.push({ id: 'amz_swg', label: 'Amazon ICICI + Swiggy HDFC', a: amazonIcici, b: swiggyHdfc });
    }
    if (airtelAxis && hsbcLive) {
      list.push({ id: 'air_live', label: 'Airtel Axis + HSBC Live+', a: airtelAxis, b: hsbcLive });
    }
    return list;
  }, []);

  const profile: MobileAdvisorProfile = useMemo(
    () => ({
      monthlyIncomeInr,
      cibilScore,
      feePreference,
      priorityMode,
      conversionStrategy,
      avoidHighDevaluation,
      strictEligibility,
      needRupayUpi,
      needNoSpendLounge,
      needZeroLowForex,
      needGolf,
      preferredGoals,
      monthlySpend,
    }),
    [
      monthlyIncomeInr,
      cibilScore,
      feePreference,
      priorityMode,
      conversionStrategy,
      avoidHighDevaluation,
      strictEligibility,
      needRupayUpi,
      needNoSpendLounge,
      needZeroLowForex,
      needGolf,
      preferredGoals,
      monthlySpend,
    ]
  );

  const matches = useMemo(
    () => scoreCardsForProfile(ALL_CARDS, profile, 16, advisorMetaMap),
    [profile, advisorMetaMap]
  );

  const unlockedPremiumPicks = useMemo(() => {
    if (monthlyIncomeInr < 150000) return [];
    return matches.filter(
      (r) =>
        r.eligibilityStatus === 'likely_eligible' &&
        !r.card.filter_tags.is_fd_backed &&
        ((r.minRequiredIncomeInr ?? 0) >= 100000 ||
          r.card.filter_tags.is_invite_only ||
          /super-?premium|metal|private|luxury/i.test(r.card.card_tier || ''))
    );
  }, [matches, monthlyIncomeInr]);

  const bestAutoCombo = useMemo(
    () =>
      findBestTwoCardCombo(ALL_CARDS, monthlySpend, true, {
        profile,
        metaMap: advisorMetaMap,
        conversionStrategy,
      }),
    [monthlySpend, profile, advisorMetaMap, conversionStrategy]
  );

  const aiSummary = useMemo(
    () => generateAdvisorAiSummary(profile, matches, bestAutoCombo),
    [profile, matches, bestAutoCombo]
  );

  const activeCombo = useMemo(() => {
    if (!bestAutoCombo) return null;
    if (!manualCardAId && !manualCardBId) return bestAutoCombo;

    let cardA =
      (manualCardAId && ALL_CARDS.find((c) => c.card_id === manualCardAId)) ||
      bestAutoCombo.cardA;
    let cardB =
      (manualCardBId && ALL_CARDS.find((c) => c.card_id === manualCardBId)) ||
      bestAutoCombo.cardB;

    if (cardA.card_id === cardB.card_id) {
      const alt = ALL_CARDS.find((c) => c.card_id !== cardA.card_id);
      if (alt) {
        if (manualCardAId && !manualCardBId) cardB = alt;
        else cardA = alt;
      }
    }
    return evaluateTwoCardCombo(cardA, cardB, monthlySpend, true, conversionStrategy);
  }, [bestAutoCombo, manualCardAId, manualCardBId, monthlySpend, conversionStrategy]);

  const isCustomCombo = Boolean(manualCardAId || manualCardBId);

  const filteredPickerCards = useMemo(() => {
    return ALL_CARDS.filter((c) => {
      const t = c.filter_tags;
      if (pickerFilter === 'ltf' && !t.is_ltf) return false;
      if (pickerFilter === 'upi' && !t.is_rupay_upi) return false;
      if (
        pickerFilter === 'cashback' &&
        c.primary_category !== 'Cashback' &&
        !c.categories.includes('Cashback')
      ) {
        return false;
      }
      if (
        pickerFilter === 'travel' &&
        c.primary_category !== 'Travel & Miles' &&
        !c.categories.includes('Travel & Miles')
      ) {
        return false;
      }
      if (
        pickerFilter === 'dining' &&
        c.primary_category !== 'Dining, Groceries & Movies' &&
        !c.categories.includes('Dining, Groceries & Movies')
      ) {
        return false;
      }
      if (
        pickerFilter === 'fuel' &&
        c.primary_category !== 'Fuel' &&
        !c.categories.includes('Fuel')
      ) {
        return false;
      }
      if (
        pickerQuery.trim() &&
        !matchesTokenizedQuery(
          pickerQuery,
          c.card_name,
          c.bank,
          c.primary_category,
          c.categories,
          t.best_for_tags
        )
      ) {
        return false;
      }
      return true;
    }).sort((a, b) => b.overall_rating - a.overall_rating);
  }, [pickerFilter, pickerQuery]);

  const savedCards = useMemo(
    () => ALL_CARDS.filter((c) => savedIds.includes(c.card_id)),
    [savedIds]
  );

  const totalMonthlySpend = useMemo(
    () => Object.values(monthlySpend).reduce((sum, v) => sum + (v || 0), 0),
    [monthlySpend]
  );

  const toggleGoal = (cat: string) => {
    triggerCalmLayoutTransition();
    setPreferredGoals((prev) =>
      prev.includes(cat) ? prev.filter((x) => x !== cat) : [...prev, cat]
    );
  };

  const stepSpend = (key: SpendCategoryKey, delta: number) => {
    const maxInr = SPEND_CATEGORY_META[key].maxInr;
    setMonthlySpend((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(maxInr, (prev[key] ?? 0) + delta)),
    }));
  };

  const openPickerFor = (target: 'A' | 'B') => {
    setPickerTarget(target);
    setPickerQuery('');
  };

  const assignPickerCard = (cardId: string) => {
    if (!activeCombo || !pickerTarget) return;
    triggerCalmLayoutTransition();
    if (pickerTarget === 'A') {
      if (cardId === activeCombo.cardB.card_id) {
        setManualCardBId(activeCombo.cardA.card_id);
      } else if (!manualCardBId) {
        setManualCardBId(activeCombo.cardB.card_id);
      }
      setManualCardAId(cardId);
    } else {
      if (cardId === activeCombo.cardA.card_id) {
        setManualCardAId(activeCombo.cardB.card_id);
      } else if (!manualCardAId) {
        setManualCardAId(activeCombo.cardA.card_id);
      }
      setManualCardBId(cardId);
    }
    setPickerTarget(null);
  };

  const swapComboCards = () => {
    if (!activeCombo) return;
    triggerCalmLayoutTransition();
    const curA = activeCombo.cardA.card_id;
    const curB = activeCombo.cardB.card_id;
    setManualCardAId(curB);
    setManualCardBId(curA);
  };

  const resetComboToAuto = () => {
    triggerCalmLayoutTransition();
    setManualCardAId(null);
    setManualCardBId(null);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen options={{ title: 'Personalized Card Advisor' }} />

      {/* Top Mode Tabs */}
      <View style={styles.tabBar}>
        {(
          [
            ['match', 'Best For Me'],
            ['combo', '2-Card Combo'],
            ['saved', `Saved (${savedCards.length})`],
          ] as Array<[AdvisorTab, string]>
        ).map(([k, label]) => {
          const active = tab === k;
          return (
            <ScalePressable
              key={k}
              onPress={() => {
                triggerCalmLayoutTransition();
                setTab(k);
              }}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label}
              </Text>
            </ScalePressable>
          );
        })}
      </View>

      <ScalePressable
        onPress={() => router.push('/my-cards' as never)}
        style={styles.walletBanner}
      >
        <View style={styles.inlineIcon}>
          <Wallet size={15} color={LedgerTheme.colors.accent} />
          <Text style={styles.walletBannerText}>
            Already own cards? Open My Cards Wallet Matrix →
          </Text>
        </View>
      </ScalePressable>

      {tab !== 'saved' && (
        <View style={[styles.aiPromptCard, { overflow: 'hidden' }]}>
          <AiShimmerStrip />
          <View style={styles.rowBetween}>
            <View style={[styles.inlineIcon, { gap: 10 }]}>
              <AiOrb3D size={30} />
              <Image
                source={require('../assets/illustrations/ai-vault-3d.webp')}
                style={{ width: 42, height: 32, borderRadius: 7, resizeMode: 'cover' }}
              />
              <Text style={styles.aiTitle}>AI Smart Profiler (3D)</Text>
            </View>
            {aiChips.length > 0 && (
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setAiPromptText('');
                  setAiChips([]);
                }}
                hitSlop={8}
              >
                <Text style={styles.clearLink}>Clear</Text>
              </ScalePressable>
            )}
          </View>
          <View style={styles.aiInputRow}>
            <TextInput
              value={aiPromptText}
              onChangeText={setAiPromptText}
              placeholder="e.g. 3L salary, 30k flights, Accor, zero forex..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              returnKeyType="done"
              onSubmitEditing={() => applyAiPrompt(aiPromptText)}
              style={styles.aiInput}
            />
            <ScalePressable
              onPress={() => applyAiPrompt(aiPromptText)}
              style={styles.aiApplyBtn}
            >
              <Text style={styles.aiApplyText}>Tune</Text>
            </ScalePressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollChips}
          >
            {AI_PROMPT_EXAMPLES.map((ex) => (
              <ScalePressable
                key={ex.id}
                onPress={() => applyAiPrompt(ex.prompt)}
                style={styles.aiExampleChip}
              >
                <Text style={styles.aiExampleText}>{ex.label}</Text>
              </ScalePressable>
            ))}
          </ScrollView>
          {aiChips.length > 0 && (
            <View style={styles.aiChipsWrap}>
              {aiChips.map((chip, idx) => (
                <Text key={`${chip}-${idx}`} style={styles.aiDetectedBadge}>
                  {chip}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {tab === 'saved' ? (
        <View style={styles.sectionStack}>
          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.panelTitle}>
                Saved Watchlist ({savedCards.length})
              </Text>
              {savedCards.length > 0 && (
                <ScalePressable onPress={clearSaved} hitSlop={8}>
                  <Text style={styles.clearLink}>Clear Saved</Text>
                </ScalePressable>
              )}
            </View>
            <Text style={styles.metaNote}>
              Bookmark any card across Discover, Finder, or Card Dossiers to shortlist here.
            </Text>
          </View>

          {savedCards.length === 0 ? (
            <View style={styles.emptyPanel}>
              <Bookmark size={22} color={LedgerTheme.colors.accent} />
              <Text style={styles.emptyTitle}>No bookmarked cards yet</Text>
              <Text style={styles.metaNote}>
                Tap the bookmark icon on any card to build your shortlist.
              </Text>
              <ScalePressable
                onPress={() => setTab('match')}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Run Card Advisor</Text>
              </ScalePressable>
            </View>
          ) : (
            savedCards.map((card, idx) => (
              <CalmEntranceView key={card.card_id} delayMs={idx * 30}>
                <LedgerCardItem
                  card={card}
                  onPress={(c) =>
                    router.push({
                      pathname: '/card/[bankSlug]/[cardSlug]',
                      params: { bankSlug: c.bank_slug, cardSlug: c.card_slug },
                    })
                  }
                />
              </CalmEntranceView>
            ))
          )}
        </View>
      ) : (
        <View style={styles.sectionStack}>
          {/* Income & Eligibility Profile */}
          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={[styles.panelTitle, styles.panelTitleFlex]}>
                Eligibility &amp; Preferences
              </Text>
              <Text style={styles.accentBadge}>
                {formatInr(totalMonthlySpend)}/mo spend
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Monthly Net Income</Text>
            <View style={styles.chipRow}>
              {INCOME_PRESETS.map((inc) => {
                const active = monthlyIncomeInr === inc.value;
                return (
                  <ScalePressable
                    key={inc.label}
                    onPress={() => setMonthlyIncomeInr(inc.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {inc.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>CIBIL Score Range</Text>
            <View style={styles.chipRow}>
              {CIBIL_PRESETS.map((cb) => {
                const active = cibilScore === cb.value;
                return (
                  <ScalePressable
                    key={cb.label}
                    onPress={() => setCibilScore(cb.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cb.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Annual Fee Comfort</Text>
            <View style={styles.chipRow}>
              {(
                [
                  ['any', 'All Fees'],
                  ['low_fee', '<= ₹1,500'],
                  ['ltf_only', 'Lifetime Free'],
                ] as const
              ).map(([k, lbl]) => {
                const active = feePreference === k;
                return (
                  <ScalePressable
                    key={k}
                    onPress={() => setFeePreference(k)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {lbl}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Optimization Priority</Text>
            <View style={styles.chipRow}>
              {PRIORITY_MODES.map((m) => {
                const active = priorityMode === m.id;
                return (
                  <ScalePressable
                    key={m.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setPriorityMode(m.id);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {m.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Reward Conversion Strategy</Text>
            <View style={styles.chipRow}>
              {CONVERSION_STRATEGIES.map((st) => {
                const active = conversionStrategy === st.id;
                return (
                  <ScalePressable
                    key={st.id}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setConversionStrategy(st.id);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {st.shortLabel}
                    </Text>
                  </ScalePressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Limit &amp; Devaluation Guardrails</Text>
            <View style={styles.chipRow}>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setStrictEligibility((v) => !v);
                }}
                style={[styles.chip, strictEligibility && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, strictEligibility && styles.chipTextActive]}
                >
                  Strict Eligibility
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setAvoidHighDevaluation((v) => !v);
                }}
                style={[styles.chip, avoidHighDevaluation && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    avoidHighDevaluation && styles.chipTextActive,
                  ]}
                >
                  Avoid Deval ≥7/10
                </Text>
              </ScalePressable>
            </View>

            <Text style={styles.fieldLabel}>Must-Have Perks</Text>
            <View style={styles.chipRow}>
              <ScalePressable
                onPress={() => setNeedRupayUpi((v) => !v)}
                style={[styles.chip, needRupayUpi && styles.chipActive]}
              >
                <Text style={[styles.chipText, needRupayUpi && styles.chipTextActive]}>
                  RuPay UPI
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => setNeedNoSpendLounge((v) => !v)}
                style={[styles.chip, needNoSpendLounge && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    needNoSpendLounge && styles.chipTextActive,
                  ]}
                >
                  No-Spend Lounge
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => setNeedZeroLowForex((v) => !v)}
                style={[styles.chip, needZeroLowForex && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, needZeroLowForex && styles.chipTextActive]}
                >
                  Zero / Low Forex
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => setNeedGolf((v) => !v)}
                style={[styles.chip, needGolf && styles.chipActive]}
              >
                <Text style={[styles.chipText, needGolf && styles.chipTextActive]}>
                  Golf Privileges
                </Text>
              </ScalePressable>
            </View>

            <Text style={styles.fieldLabel}>Priority Spend Goals</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollChips}
            >
              {CATEGORY_OPTIONS.map((cat) => {
                const active = preferredGoals.includes(cat.datasetCategory);
                return (
                  <ScalePressable
                    key={cat.id}
                    onPress={() => toggleGoal(cat.datasetCategory)}
                    style={[styles.chip, styles.chipRowInner, active && styles.chipActive]}
                  >
                    <CanvaFeatureIcon
                      icon={resolveCategoryCanvaIcon(cat.datasetCategory)}
                      size={14}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {cat.shortLabel}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Monthly Spend Sliders / Steppers */}
          <View style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.panelTitle}>Monthly Spend Mix (₹)</Text>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setShowExtraSpends((v) => !v);
                }}
                hitSlop={8}
              >
                <Text style={styles.extraToggleLink}>
                  {showExtraSpends ? 'Hide Rent/Offline' : '+ Rent & Offline (+2)'}
                </Text>
              </ScalePressable>
            </View>
            <Text style={styles.metaNote}>
              Accounts for monthly caps, shared reward pools, fee waivers, and lounge spend gates.
            </Text>
            {[...ADVISOR_SPEND_KEYS, ...(showExtraSpends ? EXTRA_SPEND_KEYS : [])].map((key) => (
              <View key={key} style={styles.spendRow}>
                <View style={styles.spendLabelWrap}>
                  <CanvaFeatureIcon
                    icon={resolveCategoryCanvaIcon(SPEND_CATEGORY_META[key].shortLabel)}
                    size={15}
                  />
                  <Text style={styles.spendName} numberOfLines={1}>
                    {SPEND_CATEGORY_META[key].shortLabel}
                  </Text>
                </View>
                <View style={styles.stepperGroup}>
                  <ScalePressable
                    onPress={() => stepSpend(key, -1000)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>-1k</Text>
                  </ScalePressable>
                  <Text style={styles.spendVal}>
                    {formatInr(monthlySpend[key] ?? 0)}
                  </Text>
                  <ScalePressable
                    onPress={() => stepSpend(key, 1000)}
                    style={styles.stepBtn}
                  >
                    <Text style={styles.stepText}>+1k</Text>
                  </ScalePressable>
                </View>
              </View>
            ))}
          </View>

          {tab === 'combo' && activeCombo ? (
            <CalmEntranceView style={styles.panel}>
              <View style={styles.rowBetween}>
                <View style={styles.inlineIcon}>
                  <Layers size={17} color={LedgerTheme.colors.accent} />
                  <Text style={styles.panelTitle}>2-Card Wallet Strategy</Text>
                </View>
                <Text
                  style={[
                    styles.comboModeBadge,
                    isCustomCombo && styles.comboModeBadgeCustom,
                  ]}
                >
                  {isCustomCombo ? 'Custom 2-Card Stack' : 'Best Auto Stack'}
                </Text>
              </View>

              <View style={styles.comboSummaryBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.comboNetTitle}>
                    {formatInr(activeCombo.comboNetAnnualInr)}/yr Net
                  </Text>
                  {activeCombo.extraGainOverSingleInr > 0 && (
                    <Text style={styles.accentBadge}>
                      +{formatInr(activeCombo.extraGainOverSingleInr)}/yr vs 1 card
                    </Text>
                  )}
                </View>
                {activeCombo.convertedSummaryLabel ? (
                  <Text style={[styles.accentBadge, { alignSelf: 'flex-start' }]}>
                    {activeCombo.convertedSummaryLabel}
                  </Text>
                ) : null}
                <Text style={styles.metaNote}>
                  Single best card: {formatInr(activeCombo.singleBestNetAnnualInr)}/yr · Annual spend {formatInr(activeCombo.annualSpendInr)}
                </Text>
              </View>

              {activeCombo.spilloverNotes.length > 0 && (
                <View style={styles.spilloverBox}>
                  <View style={styles.inlineIcon}>
                    <Sparkles size={14} color={LedgerTheme.colors.accent} />
                    <Text style={styles.spilloverTitle}>
                      Monthly Cap &amp; Pool Spillover Routing
                    </Text>
                  </View>
                  {activeCombo.spilloverNotes.slice(0, 3).map((note, idx) => (
                    <Text key={idx} style={styles.spilloverItem}>
                      • {note}
                    </Text>
                  ))}
                </View>
              )}

              {/* Quick Curated Stacks + Swap / Reset */}
              {curatedCombos.length > 0 && (
                <View style={styles.curatedSection}>
                  <Text style={styles.fieldLabel}>Popular 2-Card Stacks (1-Tap Test)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollChips}
                  >
                    {curatedCombos.map((preset) => {
                      const active =
                        activeCombo.cardA.card_id === preset.a &&
                        activeCombo.cardB.card_id === preset.b;
                      return (
                        <ScalePressable
                          key={preset.id}
                          onPress={() => {
                            triggerCalmLayoutTransition();
                            setManualCardAId(preset.a);
                            setManualCardBId(preset.b);
                          }}
                          style={[styles.presetChip, active && styles.presetChipActive]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              active && styles.presetChipTextActive,
                            ]}
                          >
                            {preset.label}
                          </Text>
                        </ScalePressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.comboToolsRow}>
                <ScalePressable onPress={swapComboCards} style={styles.comboToolBtn}>
                  <ArrowLeftRight size={14} color={LedgerTheme.colors.accent} />
                  <Text style={styles.comboToolText}>Swap A ↔ B</Text>
                </ScalePressable>
                {isCustomCombo && (
                  <ScalePressable
                    onPress={resetComboToAuto}
                    style={[styles.comboToolBtn, styles.comboToolReset]}
                  >
                    <RotateCcw size={14} color={LedgerTheme.colors.inkSecondary} />
                    <Text style={styles.comboToolResetText}>Reset to Auto-Best</Text>
                  </ScalePressable>
                )}
              </View>

              {/* Box-Type Card A & Card B Slot Pickers */}
              {(
                [
                  {
                    target: 'A' as const,
                    label: 'Slot A',
                    card: activeCombo.cardA,
                    fee: activeCombo.cardAFeeChargedInr,
                    annualSpend: activeCombo.cardAAnnualSpendInr,
                    waiverTarget: activeCombo.cardAWaiverTargetInr,
                    waiverMet: activeCombo.cardAWaiverMet,
                  },
                  {
                    target: 'B' as const,
                    label: 'Slot B',
                    card: activeCombo.cardB,
                    fee: activeCombo.cardBFeeChargedInr,
                    annualSpend: activeCombo.cardBAnnualSpendInr,
                    waiverTarget: activeCombo.cardBWaiverTargetInr,
                    waiverMet: activeCombo.cardBWaiverMet,
                  },
                ]
              ).map((slot) => {
                const peakPct = getPeakReturnPct(slot.card);
                const themePrimary = slot.card.card_theme?.primary_hex || LedgerTheme.colors.accent;
                const waiverShortfall =
                  slot.waiverTarget && slot.waiverTarget > 0 && !slot.waiverMet
                    ? Math.max(0, slot.waiverTarget - slot.annualSpend)
                    : 0;
                return (
                  <ScalePressable
                    key={slot.target}
                    onPress={() => openPickerFor(slot.target)}
                    style={[
                      styles.comboSlotBox,
                      { borderTopColor: themePrimary },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.slotBadgeRow}>
                        <Text style={styles.slotTag}>{slot.label}</Text>
                        <Text style={styles.slotHint}>Tap box to change card</Text>
                      </View>
                      <ScalePressable
                        onPress={() =>
                          router.push({
                            pathname: '/card/[bankSlug]/[cardSlug]',
                            params: {
                              bankSlug: slot.card.bank_slug,
                              cardSlug: slot.card.card_slug,
                            },
                          })
                        }
                        style={styles.dossierMiniBtn}
                      >
                        <Text style={styles.dossierMiniText}>Dossier →</Text>
                      </ScalePressable>
                    </View>

                    <View style={styles.slotMainRow}>
                      <CardArtwork
                        localImagePath={slot.card.local_image_path}
                        imageUrl={slot.card.image_url}
                        bank={slot.card.bank}
                        cardName={slot.card.card_name}
                        network={slot.card.card_network}
                        size="md"
                        cardTheme={slot.card.card_theme}
                        showSplash
                      />
                      <View style={styles.slotDetailsCol}>
                        <View style={styles.bankInlineRow}>
                          <BankLogo
                            bankSlug={slot.card.bank_slug}
                            bank={slot.card.bank}
                            size="xs"
                          />
                          <Text style={styles.comboSlotBank} numberOfLines={1}>
                            {slot.card.bank}
                          </Text>
                        </View>
                        <Text style={styles.comboCardTitle} numberOfLines={2}>
                          {slot.card.card_name}
                        </Text>
                        <View style={styles.slotMetricRow}>
                          <Text style={styles.slotMetricPill}>
                            {formatInr(slot.annualSpend)}/yr
                          </Text>
                          <Text style={styles.slotMetricPill}>
                            Peak {peakPct.toFixed(1)}%
                          </Text>
                          {slot.card.annual_fee_inr === 0 ? (
                            <Text style={styles.slotMetricPill}>LTF ₹0</Text>
                          ) : slot.waiverMet ? (
                            <Text style={styles.slotMetricPill}>Waived</Text>
                          ) : waiverShortfall > 0 ? (
                            <Text style={styles.slotWarnPill}>
                              Short {formatInr(waiverShortfall)}
                            </Text>
                          ) : null}
                          <Text style={styles.slotMetricFee}>
                            Fee: {slot.fee === 0 ? '₹0' : formatInr(slot.fee)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ScalePressable>
                );
              })}

              <Text style={styles.fieldLabel}>Best Card Per Category (Post-Cap)</Text>
              {activeCombo.categorySplit.slice(0, 7).map((row) => (
                <View key={row.key} style={styles.splitRow}>
                  <Text style={styles.splitCat}>
                    {SPEND_CATEGORY_META[row.key].shortLabel} ({formatInr(row.monthlySpendInr)}/mo)
                  </Text>
                  <Text style={styles.splitAssign}>
                    {row.useCard === 'SPLIT' && row.splitNote
                      ? row.splitNote
                      : `Use ${row.useCard} (${row.effectivePct.toFixed(1)}%)`}{' '}
                    → +{formatInr(row.annualRewardInr)}
                  </Text>
                </View>
              ))}
            </CalmEntranceView>
          ) : (
            <View style={styles.sectionStack}>
              <View style={styles.rowBetween}>
                <View style={styles.inlineIcon}>
                  <Sparkles size={16} color={LedgerTheme.colors.accent} />
                  <Text style={styles.panelTitle}>
                    Top Personalized Matches ({matches.length})
                  </Text>
                </View>
              </View>

              {aiSummary && (
                <View style={styles.aiVerdictBox}>
                  <View style={styles.rowBetween}>
                    <View style={styles.inlineIcon}>
                      <Sparkles size={14} color={LedgerTheme.colors.accent} />
                      <Text style={styles.aiVerdictLabel}>AI Portfolio Verdict</Text>
                    </View>
                    {aiSummary.comboNote && (
                      <ScalePressable
                        onPress={() => {
                          triggerCalmLayoutTransition();
                          setTab('combo');
                        }}
                      >
                        <Text style={styles.clearLink}>2-Card Combo →</Text>
                      </ScalePressable>
                    )}
                  </View>
                  <Text style={styles.aiVerdictHeadline}>{aiSummary.headline}</Text>
                  <Text style={styles.aiVerdictSub}>{aiSummary.primaryReason}</Text>
                  {aiSummary.watchOutNote && (
                    <Text style={styles.aiVerdictWarn}>{aiSummary.watchOutNote}</Text>
                  )}
                  {aiSummary.comboNote && (
                    <Text style={styles.aiVerdictCombo}>{aiSummary.comboNote}</Text>
                  )}
                </View>
              )}

              {unlockedPremiumPicks.length > 0 && (
                <View style={styles.spilloverBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.spilloverTitle}>
                      Unlocked for {formatInr(monthlyIncomeInr)}/mo Salary Tier
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.scrollChips}
                  >
                    {unlockedPremiumPicks.slice(0, 4).map((pick) => (
                      <ScalePressable
                        key={pick.card.card_id}
                        onPress={() =>
                          router.push({
                            pathname: '/card/[bankSlug]/[cardSlug]',
                            params: {
                              bankSlug: pick.card.bank_slug,
                              cardSlug: pick.card.card_slug,
                            },
                          })
                        }
                        style={[styles.chip, { backgroundColor: LedgerTheme.colors.surface }]}
                      >
                        <Text style={styles.chipText}>
                          {pick.card.card_name} ·{' '}
                          {pick.conversionResult.supportsStrategy &&
                          pick.conversionResult.convertedUnitsPerYear > 0
                            ? `${pick.conversionResult.convertedUnitsPerYear.toLocaleString('en-IN')} ${pick.conversionResult.unitLabel}/yr`
                            : `${formatInr(pick.netAnnualBenefitInr)}/yr`}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {matches.length === 0 ? (
                <View style={styles.emptyPanel}>
                  <Text style={styles.emptyTitle}>No exact matches found</Text>
                  <Text style={styles.metaNote}>
                    Try relaxing Strict Eligibility, switching LTF Only to &lt;= ₹1,500, or adjusting Priority Mode.
                  </Text>
                </View>
              ) : (
                matches.map((ev, idx) => {
                  const compared = isSelected(ev.card.card_id);
                  const saved = isSaved(ev.card.card_id);
                  const isExpanded = Boolean(expandedLimitCards[ev.card.card_id]);
                  return (
                    <CalmEntranceView
                      key={ev.card.card_id}
                      delayMs={Math.min(idx, 6) * 35}
                      style={[
                        styles.matchCard,
                        {
                          borderTopWidth: 2,
                          borderTopColor:
                            ev.card.card_theme?.primary_hex || LedgerTheme.colors.hairline,
                        },
                      ]}
                    >
                      <ScalePressable
                        onPress={() =>
                          router.push({
                            pathname: '/card/[bankSlug]/[cardSlug]',
                            params: {
                              bankSlug: ev.card.bank_slug,
                              cardSlug: ev.card.card_slug,
                            },
                          })
                        }
                      >
                        <View style={styles.matchTopRow}>
                          <CardArtwork
                            localImagePath={ev.card.local_image_path}
                            imageUrl={ev.card.image_url}
                            bank={ev.card.bank}
                            cardName={ev.card.card_name}
                            network={ev.card.card_network}
                            size="md"
                            cardTheme={ev.card.card_theme}
                          />
                          <View style={styles.matchHeaderCol}>
                            <View style={styles.rowBetween}>
                              <View style={styles.bankInlineRow}>
                                <BankLogo
                                  bankSlug={ev.card.bank_slug}
                                  bank={ev.card.bank}
                                  size="xs"
                                />
                                <Text style={styles.rankTag} numberOfLines={1}>
                                  #{idx + 1} · {ev.card.bank}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.eligBadge,
                                  ev.eligibilityStatus === 'likely_eligible'
                                    ? styles.eligOk
                                    : styles.eligWarn,
                                ]}
                              >
                                {ev.eligibilityLabel}
                              </Text>
                            </View>
                            <Text style={styles.matchTitle} numberOfLines={2}>
                              {ev.card.card_name}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.matchMetrics}>
                          <View style={styles.metricCol}>
                            <Text style={styles.metricLbl}>
                              {ev.conversionResult.supportsStrategy &&
                              ev.conversionResult.convertedUnitsPerYear > 0
                                ? ev.conversionResult.unitLabel
                                : 'Net Benefit / Yr'}
                            </Text>
                            <Text
                              style={[
                                styles.metricNum,
                                {
                                  color:
                                    ev.netAnnualBenefitInr >= 0
                                      ? LedgerTheme.colors.accent
                                      : LedgerTheme.colors.danger,
                                },
                              ]}
                            >
                              {ev.netAnnualBenefitInr >= 0 ? '+' : ''}
                              {formatInr(ev.netAnnualBenefitInr)}
                            </Text>
                            {ev.conversionResult.supportsStrategy &&
                              ev.conversionResult.convertedUnitsPerYear > 0 && (
                                <Text style={styles.metricSub}>
                                  ~{ev.conversionResult.convertedUnitsPerYear.toLocaleString('en-IN')}{' '}
                                  {ev.conversionResult.unitLabel}/yr
                                </Text>
                              )}
                          </View>
                          <View style={styles.metricCol}>
                            <Text style={styles.metricLbl}>Blended Yield</Text>
                            <Text style={styles.metricNum}>
                              {ev.effectiveBlendedReturnPct.toFixed(1)}%
                            </Text>
                            {ev.peakReturnPct > ev.effectiveBlendedReturnPct + 0.4 && (
                              <Text style={styles.metricSub}>
                                Peak {ev.peakReturnPct.toFixed(1)}%
                              </Text>
                            )}
                          </View>
                          <View style={styles.metricCol}>
                            <Text style={styles.metricLbl}>Fee After Waiver</Text>
                            <Text style={styles.metricNum}>
                              {ev.effectiveFeeInr === 0
                                ? '₹0'
                                : formatInr(ev.effectiveFeeInr)}
                            </Text>
                          </View>
                        </View>

                        {/* Reality & Limit Constraint Pills */}
                        <View style={styles.constraintRow}>
                          <Text style={styles.constraintPillNeutral}>
                            {ev.card.filter_tags.is_fd_backed
                              ? 'FD Secured'
                              : ev.minRequiredIncomeInr
                                ? `≥${formatInr(ev.minRequiredIncomeInr)}/mo · CIBIL ${ev.minRequiredCibil}+`
                                : `CIBIL ${ev.minRequiredCibil}+`}
                          </Text>

                          {ev.card.annual_fee_inr === 0 ? (
                            <Text style={styles.constraintPillOk}>LTF ₹0</Text>
                          ) : ev.waiverSpendInr && ev.waiverSpendInr > 0 ? (
                            ev.waiverMet ? (
                              <Text style={styles.constraintPillOk}>
                                Waived ({ev.waiverProgressPct}%)
                              </Text>
                            ) : (
                              <Text style={styles.constraintPillWarn}>
                                Short {formatInr(ev.waiverShortfallInr)} waiver
                              </Text>
                            )
                          ) : null}

                          {ev.loungeSpendGateStatus !== 'none' && (
                            <Text
                              style={
                                ev.loungeSpendGateStatus === 'spend_shortfall'
                                  ? styles.constraintPillWarn
                                  : styles.constraintPillOk
                              }
                            >
                              {ev.loungeSpendGateStatus === 'no_spend'
                                ? 'No-Spend Lounge'
                                : ev.loungeSpendGateStatus === 'unlocked'
                                  ? 'Lounge Unlocked'
                                  : `Lounge Short ${formatInr(ev.loungeQuarterlyShortfallInr)}/qtr`}
                            </Text>
                          )}

                          <Text
                            style={
                              ev.devaluationRiskScore >= 7
                                ? styles.constraintPillWarn
                                : ev.devaluationRiskScore <= 3
                                  ? styles.constraintPillOk
                                  : styles.constraintPillNeutral
                            }
                          >
                            Deval {ev.devaluationRiskScore}/10
                          </Text>

                          {ev.monthlyRewardLostToCapsInr >= 100 && (
                            <Text style={styles.constraintPillWarn}>
                              −{formatInr(ev.monthlyRewardLostToCapsInr)}/mo capped
                            </Text>
                          )}

                          {ev.milestoneEstimatedValueInr > 0 && (
                            <Text style={styles.constraintPillInfo}>
                              +{formatInr(ev.milestoneEstimatedValueInr)}/yr milestone
                            </Text>
                          )}
                        </View>

                        {ev.reasons.length > 0 && (
                          <Text style={styles.reasonLine}>
                            {ev.reasons.join(' · ')}
                          </Text>
                        )}
                      </ScalePressable>

                      {/* Top 2 Limits & Real-World Checks */}
                      {ev.limitAlerts.length > 0 && (
                        <View style={styles.alertStack}>
                          {ev.limitAlerts.slice(0, 2).map((alert, aIdx) => {
                            const isWarn = alert.severity === 'warning';
                            const isPos = alert.severity === 'positive';
                            return (
                              <View
                                key={`${alert.tag}-${aIdx}`}
                                style={[
                                  styles.alertBanner,
                                  isWarn
                                    ? styles.alertBannerWarn
                                    : isPos
                                      ? styles.alertBannerOk
                                      : styles.alertBannerInfo,
                                ]}
                              >
                                <View style={styles.alertIconWrap}>
                                  {isWarn ? (
                                    ev.devaluationRiskScore >= 7 && alert.tag === 'Devaluation' ? (
                                      <ShieldAlert size={15} color={LedgerTheme.colors.warn} />
                                    ) : (
                                      <AlertTriangle size={15} color={LedgerTheme.colors.warn} />
                                    )
                                  ) : isPos ? (
                                    <CheckCircle2 size={15} color={LedgerTheme.colors.accent} />
                                  ) : (
                                    <Info size={15} color="#1D3B8B" />
                                  )}
                                </View>
                                <View style={styles.alertTextWrap}>
                                  <Text
                                    style={[
                                      styles.alertTitle,
                                      isWarn
                                        ? { color: LedgerTheme.colors.warn }
                                        : isPos
                                          ? { color: LedgerTheme.colors.accent }
                                          : { color: '#1D3B8B' },
                                    ]}
                                  >
                                    {alert.title}
                                  </Text>
                                  <Text style={styles.alertDetail}>{alert.detail}</Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Expandable Category Limit & Cap Math Accordion */}
                      {(ev.categoryLimitRows.length > 0 || ev.limitAlerts.length > 2) && (
                        <View style={styles.limitAccordionWrap}>
                          <ScalePressable
                            onPress={() => {
                              triggerCalmLayoutTransition();
                              setExpandedLimitCards((prev) => ({
                                ...prev,
                                [ev.card.card_id]: !prev[ev.card.card_id],
                              }));
                            }}
                            style={styles.limitToggleBtn}
                          >
                            <Text style={styles.limitToggleText}>
                              {isExpanded
                                ? 'Hide Category Limits & Checks'
                                : `Inspect Category Limits (${ev.categoryLimitRows.length} buckets)`}
                            </Text>
                            {isExpanded ? (
                              <ChevronUp size={16} color={LedgerTheme.colors.accent} />
                            ) : (
                              <ChevronDown size={16} color={LedgerTheme.colors.accent} />
                            )}
                          </ScalePressable>

                          {isExpanded && (
                            <AnimatedReveal style={styles.limitDetailsBox}>
                              {ev.limitAlerts.slice(2).map((alert, aIdx) => (
                                <View key={`extra-${aIdx}`} style={styles.extraAlertRow}>
                                  <Text style={styles.extraAlertTitle}>• {alert.title}:</Text>
                                  <Text style={styles.extraAlertDetail}>{alert.detail}</Text>
                                </View>
                              ))}

                              {ev.categoryLimitRows.map((row) => (
                                <View key={row.key} style={styles.catLimitRow}>
                                  <View style={styles.catLimitLeft}>
                                    <Text style={styles.catLimitLabel}>{row.label}</Text>
                                    <Text style={styles.catLimitMeta}>
                                      {formatInr(row.monthlySpendInr)}/mo · Headline {row.headlinePct.toFixed(1)}%
                                      {' → '}
                                      {row.effectivePct.toFixed(1)}%
                                      {row.monthlyCapInr !== null
                                        ? ` (Cap ${formatInr(row.monthlyCapInr)}/mo)`
                                        : ''}
                                    </Text>
                                  </View>
                                  <View style={styles.catLimitRight}>
                                    <Text style={styles.catLimitGain}>
                                      +{formatInr(row.actualMonthlyRewardInr)}/mo
                                    </Text>
                                    {row.lostToCapInr >= 10 && (
                                      <Text style={styles.catLimitLost}>
                                        −{formatInr(row.lostToCapInr)} capped
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              ))}
                            </AnimatedReveal>
                          )}
                        </View>
                      )}

                      <View style={styles.matchActions}>
                        <ScalePressable
                          onPress={() => toggleSaved(ev.card.card_id)}
                          style={[styles.miniBtn, saved && styles.miniBtnActive]}
                        >
                          <Bookmark size={14} color={LedgerTheme.colors.accent} />
                          <Text style={styles.miniBtnText}>
                            {saved ? 'Saved' : 'Save'}
                          </Text>
                        </ScalePressable>
                        <ScalePressable
                          onPress={() =>
                            toggleItem({
                              card_id: ev.card.card_id,
                              card_name: ev.card.card_name,
                              bank: ev.card.bank,
                              bank_slug: ev.card.bank_slug,
                              card_slug: ev.card.card_slug,
                              annual_fee_inr: ev.card.annual_fee_inr,
                              overall_rating: ev.card.overall_rating,
                            })
                          }
                          style={[styles.miniBtn, compared && styles.miniBtnActive]}
                        >
                          {compared ? (
                            <Check size={14} color={LedgerTheme.colors.accent} />
                          ) : (
                            <Plus size={14} color={LedgerTheme.colors.inkSecondary} />
                          )}
                          <Text style={styles.miniBtnText}>
                            {compared ? 'Added' : 'Compare'}
                          </Text>
                        </ScalePressable>
                      </View>
                    </CalmEntranceView>
                  );
                })
              )}
            </View>
          )}
        </View>
      )}
    </ScrollView>

      {/* Searchable Box-Type Card Picker Modal */}
      <Modal
        visible={pickerTarget !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                Select Card for Slot {pickerTarget ?? 'A'}
              </Text>
              <Text style={styles.metaNote}>
                {filteredPickerCards.length} cards matching your filter
              </Text>
            </View>
            <ScalePressable
              onPress={() => setPickerTarget(null)}
              style={styles.modalCloseBtn}
              hitSlop={8}
            >
              <X size={20} color={LedgerTheme.colors.inkPrimary} />
            </ScalePressable>
          </View>

          <View style={styles.modalSearchBox}>
            <Search size={16} color={LedgerTheme.colors.inkMuted} />
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search HDFC, SBI Cashback, HSBC Live+, RuPay..."
              placeholderTextColor={LedgerTheme.colors.inkMuted}
              style={styles.modalSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.modalFilterScroll}
            contentContainerStyle={styles.modalFilterContent}
          >
            {PICKER_FILTERS.map((f) => {
              const active = pickerFilter === f.id;
              return (
                <ScalePressable
                  key={f.id}
                  onPress={() => setPickerFilter(f.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </ScalePressable>
              );
            })}
          </ScrollView>

          <FlatList
            data={filteredPickerCards}
            keyExtractor={(item) => item.card_id}
            contentContainerStyle={styles.modalListContent}
            initialNumToRender={16}
            renderItem={({ item }) => {
              const isCurrentSlot =
                (pickerTarget === 'A' && activeCombo?.cardA.card_id === item.card_id) ||
                (pickerTarget === 'B' && activeCombo?.cardB.card_id === item.card_id);
              const isOtherSlot =
                (pickerTarget === 'A' && activeCombo?.cardB.card_id === item.card_id) ||
                (pickerTarget === 'B' && activeCombo?.cardA.card_id === item.card_id);
              const peak = getPeakReturnPct(item);

              return (
                <ScalePressable
                  onPress={() => assignPickerCard(item.card_id)}
                  style={[
                    styles.pickerCardBox,
                    isCurrentSlot && styles.pickerCardBoxActive,
                  ]}
                >
                  <CardArtwork
                    localImagePath={item.local_image_path}
                    imageUrl={item.image_url}
                    bank={item.bank}
                    cardName={item.card_name}
                    network={item.card_network}
                    size="sm"
                    cardTheme={item.card_theme}
                  />
                  <View style={styles.pickerCardInfo}>
                    <View style={styles.rowBetween}>
                      <View style={styles.bankInlineRow}>
                        <BankLogo bankSlug={item.bank_slug} bank={item.bank} size="xs" />
                        <Text style={styles.pickerBankText} numberOfLines={1}>
                          {item.bank}
                        </Text>
                      </View>
                      {isCurrentSlot ? (
                        <Text style={styles.pickerSlotPill}>Current Slot {pickerTarget}</Text>
                      ) : isOtherSlot ? (
                        <Text style={styles.pickerSwapPill}>
                          In Slot {pickerTarget === 'A' ? 'B' : 'A'} (Swap)
                        </Text>
                      ) : (
                        <Text style={styles.pickerRating}>★ {item.overall_rating.toFixed(1)}</Text>
                      )}
                    </View>
                    <Text style={styles.pickerCardTitle} numberOfLines={1}>
                      {item.card_name}
                    </Text>
                    <Text style={styles.pickerCardMeta}>
                      Fee: {item.annual_fee_inr === 0 ? 'LTF ₹0' : formatInr(item.annual_fee_inr)} · Peak {peak.toFixed(1)}% · {item.primary_category}
                    </Text>
                  </View>
                </ScalePressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  container: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  content: {
    padding: 16,
    paddingBottom: 42,
    gap: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: LedgerTheme.colors.subtle,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  tabTextActive: {
    color: LedgerTheme.colors.accent,
  },
  sectionStack: {
    gap: 14,
  },
  panel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  emptyPanel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 26,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  primaryBtn: {
    marginTop: 6,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.accent,
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  panelTitleFlex: {
    flex: 1,
    flexShrink: 1,
  },
  clearLink: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.danger,
  },
  accentBadge: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    overflow: 'hidden',
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
  comboModeBadge: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
  },
  comboModeBadgeCustom: {
    backgroundColor: LedgerTheme.colors.creamWarm,
    color: LedgerTheme.colors.inkPrimary,
  },
  fieldLabel: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scrollChips: {
    gap: 8,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    justifyContent: 'center',
  },
  chipRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  chipText: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: LedgerTheme.colors.surface,
  },
  metaNote: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkMuted,
    lineHeight: 19,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
    gap: 8,
  },
  spendLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  spendName: {
    flex: 1,
    fontSize: 14,
    color: LedgerTheme.colors.inkPrimary,
  },
  bankInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    minWidth: 40,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  spendVal: {
    width: 78,
    textAlign: 'right',
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  comboSummaryBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
  },
  comboNetTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  curatedSection: {
    gap: 6,
  },
  presetChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.creamWarm,
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  presetChipTextActive: {
    color: LedgerTheme.colors.surface,
  },
  comboToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comboToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  comboToolText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  comboToolReset: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderColor: LedgerTheme.colors.hairline,
  },
  comboToolResetText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  comboSlotBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderTopWidth: 3,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  slotBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotTag: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  slotHint: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
  },
  dossierMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  dossierMiniText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  slotMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotDetailsCol: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  comboSlotBank: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    fontWeight: '500',
    flexShrink: 1,
  },
  comboCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 21,
  },
  slotMetricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  slotMetricPill: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    fontVariant: ['tabular-nums'],
  },
  slotMetricFee: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
    gap: 8,
  },
  splitCat: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    flex: 1,
  },
  splitAssign: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  matchCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    ...LedgerTheme.shadow.card,
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchHeaderCol: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  rankTag: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
    flexShrink: 1,
  },
  eligBadge: {
    fontSize: 11.5,
    fontWeight: '500',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eligOk: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    color: LedgerTheme.colors.accent,
  },
  eligWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    color: LedgerTheme.colors.warn,
  },
  matchTitle: {
    fontSize: 17.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 22,
  },
  matchMetrics: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 11,
    padding: 12,
  },
  metricCol: {
    flex: 1,
  },
  metricLbl: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  metricNum: {
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  reasonLine: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 10,
    lineHeight: 19,
  },
  matchActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.subtle,
  },
  miniBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  miniBtnActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  miniBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  walletBanner: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  walletBannerText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  capNoteLine: {
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    marginTop: 5,
    lineHeight: 17,
  },
  extraToggleLink: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  spilloverBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 12,
    padding: 12,
    gap: 5,
  },
  spilloverTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  spilloverItem: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 18,
  },
  slotWarnPill: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    fontVariant: ['tabular-nums'],
  },
  metricSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  constraintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  constraintPillNeutral: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  constraintPillOk: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  constraintPillWarn: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  constraintPillInfo: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1D3B8B',
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontVariant: ['tabular-nums'],
  },
  alertStack: {
    gap: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  alertBannerWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderColor: '#F3D9B1',
  },
  alertBannerOk: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.tintBorder,
  },
  alertBannerInfo: {
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    borderColor: LedgerTheme.colors.blueSoftBorder,
  },
  alertIconWrap: {
    marginTop: 2,
  },
  alertTextWrap: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 18,
  },
  alertDetail: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17,
  },
  limitAccordionWrap: {
    gap: 8,
  },
  limitToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  limitToggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  limitDetailsBox: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 11,
    gap: 8,
  },
  extraAlertRow: {
    gap: 2,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  extraAlertTitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  extraAlertDetail: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17,
  },
  catLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  catLimitLeft: {
    flex: 1,
    gap: 2,
  },
  catLimitLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  catLimitMeta: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  catLimitRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  catLimitGain: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  catLimitLost: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    fontVariant: ['tabular-nums'],
  },
  modalRoot: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14.5,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 8,
  },
  modalFilterScroll: {
    maxHeight: 52,
    marginTop: 10,
  },
  modalFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  modalListContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  pickerCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  pickerCardBoxActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.accent,
  },
  pickerCardInfo: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  pickerBankText: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    fontWeight: '500',
  },
  pickerCardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  pickerCardMeta: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  pickerSlotPill: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickerSwapPill: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pickerRating: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  aiPromptCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  aiApplyBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiApplyText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  aiExampleChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  aiExampleText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  aiChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 4,
  },
  aiDetectedBadge: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiVerdictBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  aiVerdictLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  aiVerdictHeadline: {
    fontSize: 14.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 20,
  },
  aiVerdictSub: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 18,
  },
  aiVerdictWarn: {
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    lineHeight: 17,
    marginTop: 2,
  },
  aiVerdictCombo: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    lineHeight: 17,
  },
});
