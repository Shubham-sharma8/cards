import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  Bookmark,
  Calculator,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FileText,
  Flag,
  Gauge,
  Globe,
  Headphones,
  IndianRupee,
  Maximize2,
  MessageCircle,
  Minus,
  Phone,
  Plane,
  Plus,
  QrCode,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  Wallet,
  X,
} from 'lucide-react-native';
import {
  ALL_CARDS,
  DEVALUATION_TRACKER,
  getDossierBySlugs,
  getAccessibleGolfClubsForCard,
  getAccessibleIndianLoungesForCard,
  getMatchedLoungesForProgramIds,
} from '../../../src/lib/data';
import { splitDevalSummaryClauses } from '../../../src/lib/devaluations';
import {
  evaluateCardForSpend,
  getRelatedCardFeatureRowsForMobile,
} from '../../../src/lib/advisor';
import { CONVERSION_STRATEGIES } from '../../../src/lib/conversion';
import { matchGolfGuideForCard } from '../../../src/lib/golfGuide';
import { generateDossierAiVerdict } from '../../../src/lib/aiSuggestions';
import { exportSingleCardPdfMobile, shareCardSummary } from '../../../src/lib/pdfExport';
import { getBankHelpBySlug } from '../../../src/lib/bankHelpDirectory';
import type { RewardConversionStrategy } from '../../../src/lib/types';
import {
  formatFeeDisplay,
  formatInr,
  formatLoungeQuota,
  roleLabel,
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_META,
} from '../../../src/lib/format';
import { buildWhatsAppShareUrl, openExternalUrlSafely } from '../../../src/lib/security';
import { LedgerTheme } from '../../../src/lib/theme';
import { BankLogo } from '../../../src/components/BankLogo';
import {
  NativeHorizontalBarChart,
  NativeValueBreakdownChart,
} from '../../../src/components/AnalyticsCharts';
import { FullScreenGraphModal } from '../../../src/components/FullScreenGraphModal';
import { Interactive3DCardModel } from '../../../src/components/Interactive3DCardModel';
import { useCompare } from '../../../src/components/CompareContext';
import {
  CanvaFeatureIcon,
  CanvaFeaturePill,
  resolveBenefitCanvaIcon,
  resolveCategoryCanvaIcon,
  type CanvaIconKey,
} from '../../../src/components/FeatureIcon';
import {
  AnimatedProgressBar,
  AnimatedReveal,
  CalmEntranceView,
  ScalePressable,
  SelectionCheckPop,
  triggerCalmLayoutTransition,
} from '../../../src/components/MotionPrimitives';
import type { CardSummaryItem, SpendCategoryKey } from '../../../src/lib/types';

type SectionTab = 'overview' | 'rewards' | 'lounges' | 'fees' | 'devals';

interface SpendPreset {
  id: string;
  label: string;
  spend: Partial<Record<SpendCategoryKey, number>>;
}

const SPEND_PRESETS: SpendPreset[] = [
  {
    id: '25k',
    label: '₹25k Starter',
    spend: {
      online_shopping_general: 4000,
      amazon_flipkart_myntra: 4000,
      dining_swiggy_zomato: 2500,
      groceries_quick_commerce: 4000,
      upi_scan_and_pay: 4500,
      utilities_bills_telecom: 2500,
      fuel: 2000,
      offline_general_other: 1500,
    },
  },
  {
    id: '50k',
    label: '₹50k Household',
    spend: {
      online_shopping_general: 8000,
      amazon_flipkart_myntra: 7000,
      dining_swiggy_zomato: 5000,
      groceries_quick_commerce: 6000,
      travel_flights_hotels: 6000,
      upi_scan_and_pay: 6000,
      utilities_bills_telecom: 4000,
      fuel: 3500,
      insurance: 2000,
      offline_general_other: 2500,
    },
  },
  {
    id: '1L',
    label: '₹1L Travel & Online',
    spend: {
      online_shopping_general: 14000,
      amazon_flipkart_myntra: 12000,
      dining_swiggy_zomato: 9000,
      groceries_quick_commerce: 9000,
      travel_flights_hotels: 22000,
      upi_scan_and_pay: 8000,
      utilities_bills_telecom: 6000,
      fuel: 5000,
      insurance: 4000,
      international_forex_net_of_markup: 5000,
      offline_general_other: 6000,
    },
  },
  {
    id: '2L',
    label: '₹2L High Spend',
    spend: {
      online_shopping_general: 24000,
      amazon_flipkart_myntra: 20000,
      dining_swiggy_zomato: 16000,
      groceries_quick_commerce: 16000,
      travel_flights_hotels: 48000,
      upi_scan_and_pay: 12000,
      utilities_bills_telecom: 10000,
      fuel: 8000,
      insurance: 12000,
      education_rent_govt: 10000,
      international_forex_net_of_markup: 12000,
      offline_general_other: 12000,
    },
  },
];

function emptySpendMap(): Record<SpendCategoryKey, number> {
  return SPEND_CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Record<SpendCategoryKey, number>);
}

function defaultSpendMap(): Record<SpendCategoryKey, number> {
  return SPEND_CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = SPEND_CATEGORY_META[k].defaultMonthlyInr;
    return acc;
  }, {} as Record<SpendCategoryKey, number>);
}

export default function CardDossierScreen() {
  const { bankSlug, cardSlug } = useLocalSearchParams<{
    bankSlug: string;
    cardSlug: string;
  }>();
  const router = useRouter();
  const { isSelected, toggleItem, isSaved, toggleSaved, isOwned, toggleOwned } =
    useCompare();

  const dossier = useMemo(
    () =>
      bankSlug && cardSlug ? getDossierBySlugs(String(bankSlug), String(cardSlug)) : null,
    [bankSlug, cardSlug]
  );

  const matchedLounges = useMemo(
    () =>
      dossier
        ? getMatchedLoungesForProgramIds(dossier.lounge_access_detailed.program_ids || [])
        : [],
    [dossier]
  );

  const accessibleIndianLounges = useMemo(
    () => (dossier ? getAccessibleIndianLoungesForCard(dossier.identity.card_id) : []),
    [dossier]
  );

  const accessibleGolfClubs = useMemo(
    () => (dossier ? getAccessibleGolfClubsForCard(dossier.identity.card_id) : []),
    [dossier]
  );

  const cardSummaryMeta = useMemo(
    () =>
      dossier ? ALL_CARDS.find((c) => c.card_id === dossier.identity.card_id) ?? null : null,
    [dossier]
  );

  const domesticIndiaLoungeCount = useMemo(() => {
    if (cardSummaryMeta?.domestic_lounge_accessible_count != null) {
      return cardSummaryMeta.domestic_lounge_accessible_count;
    }
    return accessibleIndianLounges.filter(
      (s) => !String(s.terminal_type || '').toLowerCase().includes('international')
    ).length;
  }, [accessibleIndianLounges, cardSummaryMeta]);

  const relatedRows = useMemo(
    () => (dossier ? getRelatedCardFeatureRowsForMobile(dossier) : []),
    [dossier]
  );

  const [activeTab, setActiveTab] = useState<SectionTab>('overview');
  const [benefitGroupFilter, setBenefitGroupFilter] = useState<'all' | 'highlights' | 'welcome' | 'milestones'>('all');
  const [loungeQuery, setLoungeQuery] = useState('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [openDevalIdx, setOpenDevalIdx] = useState<number | null>(0);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [fullGraphOpen, setFullGraphOpen] = useState(false);

  const issuerDevalEvents = useMemo(() => {
    if (!dossier) return [];
    const bankLower = dossier.identity.bank.toLowerCase();
    const firstWord = bankLower.split(' ')[0];
    return DEVALUATION_TRACKER.timeline_2024_2026.filter((ev) => {
      const evLower = ev.issuer.toLowerCase();
      return evLower.includes(bankLower) || bankLower.includes(evLower) || evLower.includes(firstWord);
    });
  }, [dossier]);

  const bankHelp = useMemo(
    () => (dossier ? getBankHelpBySlug(dossier.identity.bank_slug) : null),
    [dossier]
  );
  const [simSpend, setSimSpend] = useState<Record<SpendCategoryKey, number>>(() =>
    defaultSpendMap()
  );
  const [activePresetId, setActivePresetId] = useState<string>('custom');
  const [conversionStrategy, setConversionStrategy] =
    useState<RewardConversionStrategy>('default_inr');
  const [includeGst, setIncludeGst] = useState<boolean>(
    () => dossier?.fees_and_charges_detailed.gst_applicable ?? true
  );

  const subRatings = useMemo(() => {
    if (!dossier) return [];
    const seen = new Set<string>();
    const out: Array<{ label: string; score: number }> = [];
    for (const [rawKey, score] of Object.entries(
      dossier.ratings.category_sub_ratings || {}
    )) {
      const normalized = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      const label = rawKey
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      out.push({ label, score });
    }
    return out;
  }, [dossier]);

  const displayLounges = useMemo(() => {
    const base =
      accessibleIndianLounges.length > 0
        ? accessibleIndianLounges.map((s) => ({
            lounge_code: s.lounge_code,
            city: s.city,
            lounge_name: s.lounge_name,
            terminal: s.terminal,
            terminal_type: s.terminal_type,
            google_rating: s.google_rating,
          }))
        : matchedLounges.map((s) => ({
            lounge_code: undefined as string | undefined,
            city: s.city,
            lounge_name: s.lounge_name,
            terminal: s.terminal,
            terminal_type: s.terminal_type,
            google_rating: undefined as number | undefined,
          }));
    const q = loungeQuery.trim().toLowerCase();
    const list = !q
      ? base
      : base.filter(
          (s) =>
            s.city.toLowerCase().includes(q) ||
            s.lounge_name.toLowerCase().includes(q) ||
            s.terminal.toLowerCase().includes(q)
        );
    return list.slice(0, 120);
  }, [accessibleIndianLounges, matchedLounges, loungeQuery]);

  const simResult = useMemo(() => {
    if (!dossier) return null;
    const rates = dossier.reward_calculator_model.effective_return_pct_by_category;
    const monthlyTotal = SPEND_CATEGORY_KEYS.reduce(
      (sum, key) => sum + (simSpend[key] || 0),
      0
    );

    const summaryCard: CardSummaryItem =
      ALL_CARDS.find((c) => c.card_id === dossier.identity.card_id) ?? {
        card_id: dossier.identity.card_id,
        card_name: dossier.identity.card_name,
        bank: dossier.identity.bank,
        bank_slug: dossier.identity.bank_slug,
        card_slug: dossier.identity.card_slug,
        primary_category: dossier.identity.primary_category,
        categories: dossier.identity.categories,
        card_network: dossier.identity.card_network,
        card_tier: dossier.identity.card_tier,
        status: dossier.identity.status,
        annual_fee_inr: dossier.fees_and_charges_detailed.annual_fee_inr,
        fee_waiver_spend_inr: dossier.fees_and_charges_detailed.fee_waiver_spend_inr,
        forex_markup_pct: dossier.fees_and_charges_detailed.forex_markup_pct,
        overall_rating: dossier.ratings.overall_market_rating,
        local_image_path: dossier.visual_assets.local_image_path,
        image_url: dossier.visual_assets.image_url,
        card_theme: dossier.visual_assets.card_theme ?? null,
        filter_tags: dossier.filter_tags,
        effective_return_pct_by_category: rates,
        monthly_category_caps_inr: dossier.reward_calculator_model.monthly_category_caps_inr,
        golf_summary: dossier.benefits_features_and_faqs.golf_summary ?? null,
      };

    const applyGst = includeGst && dossier.fees_and_charges_detailed.gst_applicable;
    const waiverThreshold = dossier.fees_and_charges_detailed.fee_waiver_spend_inr;
    const ev = evaluateCardForSpend(
      summaryCard,
      simSpend,
      applyGst,
      waiverThreshold,
      conversionStrategy
    );
    const byKey = new Map(ev.categoryBreakdown.map((item) => [item.key, item]));

    const categoryRows = SPEND_CATEGORY_KEYS.map((key) => {
      const mSpend = simSpend[key] || 0;
      const hit = byKey.get(key);
      const pct = mSpend > 0 && hit ? hit.effectivePct : (rates?.[key] ?? 0);
      const annReward = mSpend > 0 && hit ? hit.annualReward : 0;
      return { key, mSpend, pct, annReward };
    });

    const annualSpend = ev.annualSpendInr;
    const annualFee = dossier.fees_and_charges_detailed.annual_fee_inr;
    const isLtf = annualFee === 0;
    const waiverMet = ev.waiverMet;
    const waiverProgressPct =
      waiverThreshold && waiverThreshold > 0
        ? Math.min(100, Math.round((annualSpend / waiverThreshold) * 100))
        : isLtf
          ? 100
          : 0;
    const remainingForWaiver =
      waiverThreshold && waiverThreshold > 0 ? Math.max(0, waiverThreshold - annualSpend) : 0;

    return {
      monthlyTotal,
      annualSpend,
      grossAnnualRewards: ev.grossAnnualRewardsInr,
      conversionResult: ev.conversionResult,
      annualFee,
      waiverThreshold,
      isLtf,
      waiverMet,
      waiverProgressPct,
      remainingForWaiver,
      feeCharged: ev.effectiveFeeInr,
      netAnnualBenefit: ev.netAnnualBenefitInr,
      netYieldPct: ev.netReturnPct,
      capNotes: ev.capNotes,
      categoryRows,
    };
  }, [dossier, simSpend, includeGst, conversionStrategy]);

  if (!dossier || !simResult) {
    return (
      <View style={styles.notFoundWrap}>
        <Stack.Screen options={{ title: 'Card Not Found' }} />
        <Text style={styles.notFoundTitle}>Card dossier not found</Text>
        <ScalePressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </ScalePressable>
      </View>
    );
  }

  const { identity, fees_and_charges_detailed: fees, lounge_access_detailed: lounge } = dossier;
  const compared = isSelected(identity.card_id);
  const saved = isSaved(identity.card_id);
  const owned = isOwned(identity.card_id);
  const golfSummary = dossier.benefits_features_and_faqs.golf_summary;
  const golfBenefits = dossier.benefits_features_and_faqs.golf_benefits || [];
  const hasGolf = Boolean(
    dossier.filter_tags.has_golf ||
      golfSummary?.has_golf ||
      golfBenefits.length > 0 ||
      (identity.categories || []).includes('Golf')
  );
  const welcomeItems = Array.isArray(dossier.benefits_features_and_faqs.welcome_benefit)
    ? dossier.benefits_features_and_faqs.welcome_benefit
    : dossier.benefits_features_and_faqs.welcome_benefit
      ? [dossier.benefits_features_and_faqs.welcome_benefit]
      : [];

  const cardTheme = dossier.visual_assets.card_theme ?? null;
  const domLoungeQuota = formatLoungeQuota(
    lounge.domestic.visits_per_year,
    lounge.domestic.visits_per_quarter,
    lounge.has_domestic_lounge
  );
  const intlLoungeQuota = formatLoungeQuota(
    lounge.international.visits_per_year,
    0,
    lounge.has_international_lounge
  );
  const spendCriteriaHasThreshold = /(?:₹|rs\.?|inr|\d{3,})\s*(?:spend|quarter|qtr)/i.test(
    lounge.domestic.spend_criteria || ''
  );
  const isNoSpendLounge = Boolean(lounge.no_spend_domestic_lounge) && !spendCriteriaHasThreshold;

  const topReturnEntry = (
    Object.entries(dossier.reward_calculator_model.effective_return_pct_by_category || {}).filter(
      ([k]) => k !== 'international_forex_net_of_markup'
    ) as Array<[SpendCategoryKey, number]>
  ).sort((a, b) => b[1] - a[1])[0];

  const aiVerdict = generateDossierAiVerdict({
    cardName: identity.card_name,
    bank: identity.bank,
    annualFeeInr: fees.annual_fee_inr,
    feeWaiverSpendInr: fees.fee_waiver_spend_inr,
    overallRating: dossier.ratings.overall_market_rating,
    isLtf: dossier.filter_tags.is_ltf,
    isInviteOnly: dossier.filter_tags.is_invite_only,
    hasNoSpendLounge: dossier.filter_tags.no_spend_domestic_lounge,
    hasGolf: Boolean(hasGolf),
    zeroOrLowForex: dossier.filter_tags.zero_or_low_forex,
    devaluationRiskScore: dossier.devaluation_analysis.devaluation_risk_score,
    minIncomeInr: dossier.eligibility_detailed.min_monthly_income_salaried_inr,
    transferPartnerNames: (dossier.reward_calculator_model.transfer_partners || []).map((p) =>
      typeof p === 'string' ? p : p.partner || ''
    ),
    topCategoryLabel: topReturnEntry
      ? SPEND_CATEGORY_META[topReturnEntry[0]]?.shortLabel ?? topReturnEntry[0]
      : identity.primary_category,
    topCategoryPct: topReturnEntry
      ? topReturnEntry[1]
      : dossier.reward_calculator_model.accelerated_reward_rate_pct,
  });

  const sanitizeLoungeSummary = (text?: string | null) =>
    (text || '').replace(/\b999\b/g, 'Unlimited');

  const heroFeaturePills = (() => {
    const pills: Array<{ icon: CanvaIconKey; label: string }> = [];
    const seen = new Set<string>();
    const add = (icon: CanvaIconKey, label: string) => {
      if (seen.has(label) || pills.length >= 6) return;
      seen.add(label);
      pills.push({ icon, label });
    };
    const calc = dossier.reward_calculator_model;
    const tags = dossier.filter_tags;
    const cats = new Set([identity.primary_category, ...(identity.categories || [])]);
    if (
      cats.has('Travel & Miles') ||
      (calc.effective_return_pct_by_category?.travel_flights_hotels ?? 0) >= 2.5
    ) {
      add('travel', 'Travel');
    }
    if (lounge.has_domestic_lounge || lounge.has_international_lounge) {
      add('lounge', isNoSpendLounge ? 'Lounge Access' : 'Lounge (Spend-Linked)');
    }
    if (calc.accelerated_reward_rate_pct > 0 || cats.has('Super-Premium')) {
      add('rewards', 'Rewards');
    }
    if (cats.has('Cashback') || tags.is_ltf) {
      add('cashback', tags.is_ltf ? 'Lifetime Free' : 'Cashback');
    }
    if (cats.has('Fuel') || (calc.effective_return_pct_by_category?.fuel ?? 0) >= 2) {
      add('fuel', 'Fuel');
    }
    if (cats.has('Online Shopping') || cats.has('Dining, Groceries & Movies')) {
      add('shopping', 'Shopping & Dining');
    }
    if (tags.zero_forex || tags.zero_or_low_forex) {
      add('forex', tags.zero_forex ? 'Zero Forex' : 'Low Forex');
    }
    if (tags.is_rupay_upi) {
      add('cashback', 'RuPay UPI');
    }
    if (hasGolf) {
      add('golf', 'Golf Privileges');
    }
    if (pills.length === 0) {
      add(resolveCategoryCanvaIcon(identity.primary_category), identity.primary_category);
    }
    return pills;
  })();

  const highlightSummaryCards = (() => {
    const calc = dossier.reward_calculator_model;
    const benefits = dossier.benefits_features_and_faqs;
    const tags = dossier.filter_tags;
    const peakRate = Math.max(calc.accelerated_reward_rate_pct || 0, calc.base_reward_rate_pct || 0);
    const rawH0 = (benefits.highlights?.[0] || '').trim();
    const looksLikeCardTitle =
      !rawH0 ||
      rawH0.toLowerCase() === identity.card_name.toLowerCase() ||
      (!/[0-9%]/.test(rawH0) && /(?:credit\s*card|debit\s*card|\bcard)$/i.test(rawH0));
    const rewardSummary =
      !looksLikeCardTitle && rawH0.length <= 96
        ? rawH0
        : peakRate > 0
          ? `Up to ${peakRate.toFixed(1)}% value-back in ${identity.primary_category}`
          : calc.earn_unit || 'Everyday reward earnings across card spends';

    const loungeSummary =
      lounge.has_domestic_lounge || lounge.has_international_lounge
        ? lounge.has_domestic_lounge && lounge.has_international_lounge
          ? `${domLoungeQuota} domestic & ${intlLoungeQuota} international visits`
          : lounge.has_domestic_lounge
            ? `${domLoungeQuota} domestic airport lounge visits${isNoSpendLounge ? ' (no spend cap)' : ''}`
            : `${intlLoungeQuota} international airport lounge visits`
        : tags.has_railway_lounge
          ? sanitizeLoungeSummary(lounge.railway.summary) || 'Complimentary IRCTC railway lounge visits'
          : 'No complimentary airport lounge visits included';

    const thirdCard = (() => {
      if (tags.zero_forex || tags.zero_or_low_forex) {
        return {
          icon: 'forex' as CanvaIconKey,
          title: 'Low Forex Markup',
          detail: `${fees.forex_markup_pct}% + GST foreign currency markup on international spends`,
        };
      }
      if (hasGolf) {
        return {
          icon: 'golf' as CanvaIconKey,
          title: 'Golf & Club Access',
          detail:
            golfSummary?.complimentary_access ||
            golfBenefits[0] ||
            'Complimentary golf green fees & coaching lessons',
        };
      }
      if (
        (identity.categories || []).includes('Fuel') ||
        (calc.effective_return_pct_by_category?.fuel ?? 0) >= 2
      ) {
        return {
          icon: 'fuel' as CanvaIconKey,
          title: 'Fuel Savings',
          detail:
            fees.fuel_surcharge_waiver ||
            `Up to ${calc.effective_return_pct_by_category?.fuel?.toFixed(1) ?? '2.5'}% fuel return`,
        };
      }
      if (welcomeItems.length > 0 && welcomeItems[0]) {
        return {
          icon: 'welcome' as CanvaIconKey,
          title: 'Welcome Benefit',
          detail: welcomeItems[0],
        };
      }
      const primaryIcon = resolveCategoryCanvaIcon(identity.primary_category);
      return {
        icon: (primaryIcon === 'rewards' ? 'travel' : primaryIcon) as CanvaIconKey,
        title:
          identity.primary_category === 'Travel & Miles'
            ? 'Travel & Redemption'
            : identity.primary_category,
        detail:
          benefits.highlights?.[1] ||
          benefits.about_overview ||
          `Built for ${dossier.pros_and_cons.best_for_whom || identity.primary_category}`,
      };
    })();

    return [
      { icon: 'rewards' as CanvaIconKey, title: 'Rewards', detail: rewardSummary },
      { icon: 'lounge' as CanvaIconKey, title: 'Lounge Access', detail: loungeSummary },
      thirdCard,
    ];
  })();

  const openUrl = (url?: string | null) => {
    void openExternalUrlSafely(url);
  };

  const applyPreset = (preset: SpendPreset) => {
    const next = emptySpendMap();
    for (const k of SPEND_CATEGORY_KEYS) {
      next[k] = preset.spend[k] ?? 0;
    }
    setSimSpend(next);
    setActivePresetId(preset.id);
  };

  const bumpCategory = (key: SpendCategoryKey, delta: number) => {
    setActivePresetId('custom');
    setSimSpend((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(SPEND_CATEGORY_META[key].maxInr, (prev[key] || 0) + delta)),
    }));
  };

  const renderRelatedMatrix = () => {
    const alternatives = relatedRows.filter((r) => !r.is_current);
    if (alternatives.length === 0) return null;
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Similar Cards &amp; Alternatives</Text>
        <Text style={styles.metaNote}>
          Swipe to compare fees, peak return &amp; lounge quota. Tap any card to open its full dossier.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingVertical: 4, paddingRight: 8 }}
        >
          {alternatives.map((row) => {
            const rowCompared = isSelected(row.card_id);
            return (
              <View
                key={row.card_id}
                style={{
                  width: 244,
                  backgroundColor: LedgerTheme.colors.canvas,
                  borderWidth: 1,
                  borderColor: LedgerTheme.colors.hairline,
                  borderRadius: 14,
                  padding: 15,
                  gap: 10,
                }}
              >
                <ScalePressable
                  onPress={() =>
                    router.push({
                      pathname: '/card/[bankSlug]/[cardSlug]',
                      params: { bankSlug: row.bank_slug, cardSlug: row.card_slug },
                    })
                  }
                  style={{ gap: 6 }}
                >
                  <View style={styles.bankInlineRow}>
                    <BankLogo bankSlug={row.bank_slug} bank={row.bank} size="xs" />
                    <Text style={styles.matrixRole}>{roleLabel(row.relation_label)}</Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 15.5,
                      fontWeight: '700',
                      color: LedgerTheme.colors.inkPrimary,
                      lineHeight: 21,
                    }}
                  >
                    {row.card_name}
                  </Text>
                </ScalePressable>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.metaNote}>Annual Fee</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: LedgerTheme.colors.inkPrimary }}>
                      {row.annual_fee_inr === 0 ? '₹0 LTF' : formatInr(row.annual_fee_inr)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.metaNote}>Peak Return</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: LedgerTheme.colors.accent }}>
                      {row.peak_pct.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={styles.metaNote}>Lounge</Text>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, textAlign: 'right', fontSize: 12.5, fontWeight: '600', color: LedgerTheme.colors.inkSecondary }}
                    >
                      {row.dom_lounge || 'None'}
                    </Text>
                  </View>
                </View>

                <ScalePressable
                  onPress={() =>
                    toggleItem({
                      card_id: row.card_id,
                      card_name: row.card_name,
                      bank: row.bank,
                      bank_slug: row.bank_slug,
                      card_slug: row.card_slug,
                      annual_fee_inr: row.annual_fee_inr,
                      overall_rating: row.market_rating,
                    })
                  }
                  style={[
                    styles.matrixCmpBtn,
                    { paddingVertical: 8, width: '100%' },
                    rowCompared && styles.matrixCmpBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.matrixCmpText,
                      { fontWeight: '700' },
                      rowCompared && { color: LedgerTheme.colors.accent },
                    ]}
                  >
                    {rowCompared ? '✓ Added to Compare' : '+ Compare Side-by-Side'}
                  </Text>
                </ScalePressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen
        options={{
          title: identity.card_name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => toggleOwned(identity.card_id)}
                style={[styles.topHeaderBtn, owned && styles.topHeaderBtnActive]}
                accessibilityLabel={owned ? 'Remove from wallet' : 'Add to my wallet'}
              >
                <Wallet size={15} color={owned ? '#FFFFFF' : LedgerTheme.colors.accent} />
                <Text style={[styles.topHeaderBtnTxt, owned && { color: '#FFFFFF' }]}>
                  {owned ? 'Wallet' : '+ Wallet'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShareSheetOpen(true)}
                style={styles.topHeaderIconBtn}
                accessibilityLabel="Share card options"
              >
                <Share2 size={16} color={LedgerTheme.colors.inkPrimary} />
              </Pressable>
            </View>
          ),
        }}
      />

      {/* Hero Summary Card */}
      <CalmEntranceView>
        <View
          style={[
            styles.heroCard,
            cardTheme
              ? {
                  backgroundColor: cardTheme.soft_bg_hex,
                  borderColor: cardTheme.border_hex,
                }
              : null,
          ]}
        >
          <View
            style={[
              styles.heroAccentStrip,
              { backgroundColor: cardTheme?.primary_hex || LedgerTheme.colors.accent },
            ]}
          />
          <View style={styles.heroTopColumn}>
            <Interactive3DCardModel
              localImagePath={dossier.visual_assets.local_image_path}
              imageUrl={dossier.visual_assets.image_url}
              bank={identity.bank}
              cardName={identity.card_name}
              network={identity.card_network}
              tier={identity.card_tier}
              annualFeeLabel={
                fees.annual_fee_inr === 0 ? 'Lifetime Free (₹0)' : formatInr(fees.annual_fee_inr)
              }
              loungeLabel={
                dossier.lounge_access_detailed.domestic?.summary || `${identity.card_network}`
              }
              rewardHighlight={
                dossier.pros_and_cons.best_for_whom || identity.primary_category
              }
              cardTheme={cardTheme}
            />
            <View style={[styles.heroMeta, { width: '100%' }]}>
              <View style={styles.bankInlineRow}>
                <BankLogo bankSlug={identity.bank_slug} bank={identity.bank} size="xs" />
                <Text style={styles.bankLabel} numberOfLines={1}>
                  {identity.bank} · {identity.card_network} · {identity.card_tier}
                </Text>
              </View>
              <Text style={styles.cardName}>{identity.card_name}</Text>
              <View style={styles.scoreRow}>
                <View style={styles.scorePill}>
                  <Star size={12} color={LedgerTheme.colors.warn} />
                  <Text style={styles.scorePillText}>
                    {dossier.ratings.overall_market_rating.toFixed(2)} Market Rating
                  </Text>
                </View>
                <View style={styles.scorePill}>
                  <Tag size={12} color={LedgerTheme.colors.accent} />
                  <Text style={styles.scorePillText}>
                    {identity.primary_category}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {heroFeaturePills.length > 0 && (
            <View style={styles.heroPillRow}>
              {heroFeaturePills.map((pill) => (
                <CanvaFeaturePill
                  key={pill.label}
                  icon={pill.icon}
                  label={pill.label}
                  tone="blue"
                />
              ))}
            </View>
          )}

          <View style={styles.heroActions}>
            <ScalePressable
              onPress={() =>
                toggleItem({
                  card_id: identity.card_id,
                  card_name: identity.card_name,
                  bank: identity.bank,
                  bank_slug: identity.bank_slug,
                  card_slug: identity.card_slug,
                  annual_fee_inr: fees.annual_fee_inr,
                  overall_rating: dossier.ratings.overall_market_rating,
                })
              }
              style={[styles.actionBtn, compared && styles.actionBtnActive]}
            >
              <SelectionCheckPop active={compared}>
                {compared ? (
                  <Check size={15} color={LedgerTheme.colors.accent} />
                ) : (
                  <Plus size={15} color={LedgerTheme.colors.inkPrimary} />
                )}
              </SelectionCheckPop>
              <Text
                style={[
                  styles.actionBtnText,
                  compared && { color: LedgerTheme.colors.accent },
                ]}
              >
                {compared ? 'Added to Compare' : 'Compare'}
              </Text>
            </ScalePressable>

            {dossier.official_and_reference_links.bank_url ? (
              <ScalePressable
                onPress={() => openUrl(dossier.official_and_reference_links.bank_url)}
                style={styles.actionBtnPrimary}
              >
                <ExternalLink size={14} color={LedgerTheme.colors.surface} />
                <Text style={styles.actionBtnPrimaryText}>Official Bank Page</Text>
              </ScalePressable>
            ) : null}
          </View>

          {/* Key Numbers Strip */}
          <View style={styles.keyGrid}>
            {(() => {
              const feeInfo = formatFeeDisplay(fees.joining_fee_inr, fees.annual_fee_inr);
              if (feeInfo.isSplit) {
                return (
                  <>
                    <View style={styles.keyCell}>
                      <View style={styles.keyLabelRow}>
                        <IndianRupee size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.keyLabel}>Joining Fee</Text>
                      </View>
                      <Text style={styles.keyVal}>{feeInfo.joiningText}</Text>
                    </View>
                    <View style={styles.keyCell}>
                      <View style={styles.keyLabelRow}>
                        <CalendarCheck size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.keyLabel}>Annual Fee</Text>
                      </View>
                      <Text style={styles.keyVal}>{feeInfo.annualText}</Text>
                    </View>
                  </>
                );
              }
              return (
                <View style={styles.keyCell}>
                  <View style={styles.keyLabelRow}>
                    <IndianRupee size={12} color={LedgerTheme.colors.accent} />
                    <Text style={styles.keyLabel}>Joining Fee</Text>
                  </View>
                  <Text style={styles.keyVal}>{feeInfo.primaryText}</Text>
                </View>
              );
            })()}
            <View style={styles.keyCell}>
              <View style={styles.keyLabelRow}>
                <Plane size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.keyLabel}>India Lounges</Text>
              </View>
              <Text style={styles.keyVal}>
                {domesticIndiaLoungeCount > 0 ? `${domesticIndiaLoungeCount} lounges` : domLoungeQuota}
              </Text>
            </View>
            <View style={styles.keyCell}>
              <View style={styles.keyLabelRow}>
                <CalendarCheck size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.keyLabel}>Waiver Spend</Text>
              </View>
              <Text style={styles.keyVal}>
                {fees.fee_waiver_spend_inr ? formatInr(fees.fee_waiver_spend_inr) : 'N/A'}
              </Text>
            </View>
            <View style={styles.keyCell}>
              <View style={styles.keyLabelRow}>
                <Globe size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.keyLabel}>Forex Markup</Text>
              </View>
              <Text style={styles.keyVal}>{fees.forex_markup_pct}%</Text>
            </View>
            <View style={styles.keyCell}>
              <View style={styles.keyLabelRow}>
                <Gauge size={12} color={LedgerTheme.colors.accent} />
                <Text style={styles.keyLabel}>Min CIBIL</Text>
              </View>
              <Text style={styles.keyVal}>{dossier.eligibility_detailed.min_cibil_score}+</Text>
            </View>
          </View>
        </View>
      </CalmEntranceView>

      {/* Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScroll}
      >
        {(
          [
            ['overview', 'Overview'],
            ['rewards', 'Calc & Rates'],
            ['lounges', `Lounges (${accessibleIndianLounges.length || matchedLounges.length})`],
            ['fees', 'Fees & Eligibility'],
            ['devals', 'Deval & FAQs'],
          ] as Array<[SectionTab, string]>
        ).map(([key, label]) => {
          const active = activeTab === key;
          return (
            <ScalePressable
              key={key}
              onPress={() => {
                triggerCalmLayoutTransition();
                setActiveTab(key);
              }}
              style={[styles.tabPill, active && styles.tabPillActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label}
              </Text>
            </ScalePressable>
          );
        })}
      </ScrollView>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <View style={styles.sectionStack}>
          {/* 3-Card Highlight Summary Strip */}
          <View style={styles.highlightCardsStack}>
            {highlightSummaryCards.map((hc) => (
              <View key={hc.title} style={styles.highlightCard}>
                <View style={styles.highlightIconWrap}>
                  <CanvaFeatureIcon icon={hc.icon} size={20} />
                </View>
                <View style={styles.highlightTextCol}>
                  <Text style={styles.highlightTitle}>{hc.title}</Text>
                  <Text style={styles.highlightDetail}>{hc.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Personalized Annual Value Preview Card */}
          <View style={styles.calcPreviewCard}>
            <View style={styles.calcPreviewTop}>
              <View style={styles.calcPreviewLeft}>
                <View style={styles.calcTitleRow}>
                  <Calculator size={15} color={LedgerTheme.colors.accent} />
                  <Text style={styles.panelTitle}>Your Annual Net Value Preview</Text>
                </View>
                <Text style={styles.metaNote}>
                  At {formatInr(simResult.monthlyTotal)}/mo ({formatInr(simResult.annualSpend)}/yr) · Fee{' '}
                  {simResult.waiverMet ? 'Waived (₹0)' : formatInr(simResult.feeCharged)}
                </Text>
              </View>
              <View style={styles.calcPreviewRight}>
                <Text
                  style={[
                    styles.netBigVal,
                    {
                      color:
                        simResult.netAnnualBenefit >= 0
                          ? LedgerTheme.colors.accent
                          : LedgerTheme.colors.danger,
                    },
                  ]}
                >
                  {formatInr(simResult.netAnnualBenefit)}/yr
                </Text>
                <Text style={styles.metaNote}>
                  {simResult.netYieldPct.toFixed(2)}% net yield
                </Text>
              </View>
            </View>

            {simResult.waiverThreshold && !simResult.isLtf ? (
              <View style={styles.waiverTrackBox}>
                <View style={styles.waiverTextRow}>
                  <Text style={styles.metaNote}>
                    Fee waiver target ({formatInr(simResult.waiverThreshold)}/yr)
                  </Text>
                  <Text style={styles.waiverPctText}>{simResult.waiverProgressPct}%</Text>
                </View>
                <AnimatedProgressBar
                  percent={simResult.waiverProgressPct}
                  fillColor={
                    simResult.waiverMet ? LedgerTheme.colors.accent : LedgerTheme.colors.warn
                  }
                />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
              <ScalePressable
                onPress={() => {
                  triggerCalmLayoutTransition();
                  setActiveTab('rewards');
                }}
                style={[styles.tuneBtn, { flex: 1 }]}
              >
                <Text style={styles.tuneBtnText}>
                  Tune Spend Inputs →
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={() => setFullGraphOpen(true)}
                style={[styles.tuneBtn, { backgroundColor: LedgerTheme.colors.accent }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Maximize2 size={13} color="#FFFFFF" />
                  <Text style={[styles.tuneBtnText, { color: '#FFFFFF' }]}>Full-Page Graph</Text>
                </View>
              </ScalePressable>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.verdictTopRow}>
              <View style={styles.bankInlineRow}>
                <Sparkles size={14} color={LedgerTheme.colors.accent} />
                <Text style={styles.aiVerdictTag}>AI Card Analyst</Text>
              </View>
              <Text
                style={[
                  styles.aiTonePill,
                  aiVerdict.tone === 'positive'
                    ? styles.aiToneGood
                    : aiVerdict.tone === 'caution'
                      ? styles.aiToneWarn
                      : styles.aiToneNeutral,
                ]}
              >
                {aiVerdict.badgeLabel}
              </Text>
            </View>
            <Text style={styles.bodyText}>{aiVerdict.summary}</Text>
            <View style={styles.fitBox}>
              <Text style={styles.fitLabel}>Apply If</Text>
              <Text style={styles.fitVal}>{aiVerdict.applyIf}</Text>
            </View>
            <View style={styles.fitBoxWarn}>
              <Text style={styles.fitLabelWarn}>Skip If</Text>
              <Text style={styles.fitVal}>{aiVerdict.skipIf}</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Verdict & Fit</Text>
            <Text style={styles.bodyText}>{dossier.pros_and_cons.verdict}</Text>
            <View style={styles.fitBox}>
              <Text style={styles.fitLabel}>Best For Whom</Text>
              <Text style={styles.fitVal}>{dossier.pros_and_cons.best_for_whom}</Text>
            </View>
            <View style={styles.fitBoxWarn}>
              <Text style={styles.fitLabelWarn}>Not Ideal For</Text>
              <Text style={styles.fitVal}>{dossier.pros_and_cons.not_ideal_for}</Text>
            </View>
            <Text style={styles.metaNote}>
              Recommended monthly spend: {dossier.pros_and_cons.recommended_monthly_spend_inr}
            </Text>
          </View>

          <View style={styles.prosConsSplitWrap}>
            <View style={styles.prosCardBox}>
              <View style={styles.prosConsHeader}>
                <View style={styles.prosBadgeIcon}>
                  <CheckCircle2 size={14} color={LedgerTheme.colors.surface} />
                </View>
                <Text style={styles.prosHeaderTitle}>What Works (Pros)</Text>
                <View style={styles.prosCountPill}>
                  <Text style={styles.prosCountText}>
                    {(dossier.pros_and_cons.pros || []).length}
                  </Text>
                </View>
              </View>
              {(dossier.pros_and_cons.pros || []).map((p, idx) => (
                <View key={`pro_${idx}`} style={styles.proItemCard}>
                  <Check size={14} color={LedgerTheme.colors.accent} style={{ marginTop: 2 }} />
                  <Text style={styles.proItemText}>{p}</Text>
                </View>
              ))}
            </View>

            <View style={styles.consCardBox}>
              <View style={styles.prosConsHeader}>
                <View style={styles.consBadgeIcon}>
                  <AlertTriangle size={14} color={LedgerTheme.colors.surface} />
                </View>
                <Text style={styles.consHeaderTitle}>Watch-Outs (Cons)</Text>
                <View style={styles.consCountPill}>
                  <Text style={styles.consCountText}>
                    {(dossier.pros_and_cons.cons || []).length}
                  </Text>
                </View>
              </View>
              {(dossier.pros_and_cons.cons || []).map((c, idx) => (
                <View key={`con_${idx}`} style={styles.conItemCard}>
                  <AlertTriangle size={14} color={LedgerTheme.colors.warn} style={{ marginTop: 2 }} />
                  <Text style={styles.conItemText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>

          {(dossier.reddit_user_feedback.optimization_tips || []).length > 0 && (
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: '#EEF5F2',
                  borderColor: 'rgba(15,92,77,0.28)',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Sparkles size={16} color={LedgerTheme.colors.accent} />
                <Text style={[styles.panelTitle, { color: LedgerTheme.colors.accent, marginBottom: 0 }]}>
                  Pro Hacks &amp; Community Tips
                </Text>
              </View>
              {(dossier.reddit_user_feedback.optimization_tips || []).map((tip, i) => (
                <View
                  key={`ov_tip_${i}`}
                  style={[
                    styles.proItemCard,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: 'rgba(15,92,77,0.16)',
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                    },
                  ]}
                >
                  <CheckCircle2 size={14} color="#16A34A" style={{ marginTop: 2 }} />
                  <Text style={styles.proItemText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {(welcomeItems.length > 0 ||
            (dossier.benefits_features_and_faqs.highlights || []).length > 0 ||
            (dossier.benefits_features_and_faqs.milestone_benefits || []).length > 0) && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Key Highlights, Welcome &amp; Milestone Benefits</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                {(
                  [
                    ['all', 'All Perks'],
                    ['highlights', 'Highlights'],
                    ['welcome', 'Welcome'],
                    ['milestones', 'Milestones'],
                  ] as const
                ).map(([k, lbl]) => {
                  const active = benefitGroupFilter === k;
                  return (
                    <ScalePressable
                      key={k}
                      onPress={() => setBenefitGroupFilter(k)}
                      style={[
                        styles.qrPortalPill,
                        active && { backgroundColor: LedgerTheme.colors.accent, borderColor: LedgerTheme.colors.accent },
                      ]}
                    >
                      <Text style={[styles.qrPortalPillText, active && { color: '#FFFFFF' }]}>{lbl}</Text>
                    </ScalePressable>
                  );
                })}
              </ScrollView>
              {(benefitGroupFilter === 'all' || benefitGroupFilter === 'highlights') &&
                (dossier.benefits_features_and_faqs.highlights || [])
                  .slice(0, 6)
                  .map((item, i) => (
                    <View key={`hl_${i}`} style={styles.benefitRow}>
                      <View style={styles.benefitIconWrap}>
                        <CanvaFeatureIcon icon={resolveBenefitCanvaIcon(item)} size={18} />
                      </View>
                      <Text style={styles.benefitText}>{item}</Text>
                    </View>
                  ))}
              {(benefitGroupFilter === 'all' || benefitGroupFilter === 'welcome') &&
                welcomeItems.map((w, i) => (
                  <View key={`w_${i}`} style={styles.benefitRow}>
                    <View style={styles.benefitIconWrap}>
                      <CanvaFeatureIcon icon="welcome" size={18} />
                    </View>
                    <Text style={styles.benefitText}>{w}</Text>
                  </View>
                ))}
              {(benefitGroupFilter === 'all' || benefitGroupFilter === 'milestones') &&
                (dossier.benefits_features_and_faqs.milestone_benefits || []).map((m, i) => (
                  <View key={`m_${i}`} style={styles.benefitRow}>
                    <View style={styles.benefitIconWrap}>
                      <CanvaFeatureIcon icon={resolveBenefitCanvaIcon(m)} size={18} />
                    </View>
                    <Text style={styles.benefitText}>{m}</Text>
                  </View>
                ))}
            </View>
          )}

          {hasGolf && (
            <View style={styles.panel}>
              <View style={styles.calcTitleRow}>
                <Flag size={15} color={LedgerTheme.colors.accent} />
                <Text style={styles.panelTitle}>Golf Privileges &amp; Club Access</Text>
              </View>
              {golfSummary ? (
                <View style={styles.golfGrid}>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Complimentary Access</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.complimentary_access || 'Included'}
                    </Text>
                  </View>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Eligible Courses</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.eligible_courses || 'Domestic / Participating'}
                    </Text>
                  </View>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Spend Condition</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.spend_condition || 'None / Standard cardholder quota'}
                    </Text>
                  </View>
                </View>
              ) : null}
              {golfBenefits.map((gb, i) => (
                <View key={`gb_${i}`} style={styles.benefitRow}>
                  <View style={styles.benefitIconWrap}>
                    <CanvaFeatureIcon icon="golf" size={16} />
                  </View>
                  <Text style={styles.benefitText}>{gb}</Text>
                </View>
              ))}
            </View>
          )}

          {renderRelatedMatrix()}

          {(dossier.latest_offers || []).length > 0 && (
            <View style={styles.panel}>
              <View style={styles.calcTitleRow}>
                <Tag size={15} color={LedgerTheme.colors.accent} />
                <Text style={styles.panelTitle}>
                  Latest {identity.bank} & Card Offers ({dossier.latest_offers?.length})
                </Text>
              </View>
              {(dossier.latest_offers || []).map((offer) => (
                <ScalePressable
                  key={offer.offer_id}
                  onPress={() => openUrl(offer.offer_url)}
                  style={styles.offerInlineCard}
                >
                  <View style={styles.offerInlineTop}>
                    <Text style={styles.offerInlineCategory}>{offer.category}</Text>
                    <Text style={styles.offerInlineValid}>{offer.valid_till}</Text>
                  </View>
                  <Text style={styles.offerInlineTitle}>{offer.title}</Text>
                  {offer.summary !== offer.title ? (
                    <Text style={styles.metaNote}>{offer.summary}</Text>
                  ) : null}
                  <View style={styles.offerInlineFooter}>
                    <Text style={styles.offerInlineLink}>Open Official Bank Offer</Text>
                    <ExternalLink size={13} color={LedgerTheme.colors.accent} />
                  </View>
                </ScalePressable>
              ))}
            </View>
          )}

          {subRatings.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Category Sub-Ratings</Text>
              <View style={styles.subRatingsList}>
                {subRatings.map((sr) => (
                  <View key={sr.label} style={styles.subRatingRow}>
                    <Text style={styles.subRatingLabel}>{sr.label}</Text>
                    <AnimatedProgressBar
                      percent={(sr.score / 5) * 100}
                      height={7}
                      style={{ flex: 1 }}
                    />
                    <Text style={styles.subRatingVal}>{sr.score.toFixed(1)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* TAB 2: CALCULATOR & REWARDS */}
      {activeTab === 'rewards' && (
        <View style={styles.sectionStack}>
          {/* Interactive Annual Worth Simulator */}
          <View style={styles.panel}>
            <View style={styles.calcTitleRow}>
              <Calculator size={16} color={LedgerTheme.colors.accent} />
              <Text style={styles.panelTitle}>
                Monthly-to-Annual Benefit & Fee Waiver Simulator
              </Text>
            </View>
            <Text style={styles.metaNote}>
              Enter your monthly spends below. We annualize returns, check fee waiver thresholds, and compute net ₹ gained after fee & GST.
            </Text>

            {/* Quick Presets */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsScroll}
            >
              {SPEND_PRESETS.map((p) => {
                const active = activePresetId === p.id;
                return (
                  <ScalePressable
                    key={p.id}
                    onPress={() => applyPreset(p)}
                    style={[styles.presetBtn, active && styles.presetBtnActive]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        active && { color: LedgerTheme.colors.surface },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>

            {/* Conversion Strategy Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.presetsScroll}
            >
              {CONVERSION_STRATEGIES.map((st) => {
                const active = conversionStrategy === st.id;
                return (
                  <ScalePressable
                    key={st.id}
                    onPress={() => setConversionStrategy(st.id)}
                    style={[styles.presetBtn, active && styles.presetBtnActive]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        active && { color: LedgerTheme.colors.surface },
                      ]}
                    >
                      {st.shortLabel}
                    </Text>
                  </ScalePressable>
                );
              })}
            </ScrollView>

            {conversionStrategy !== 'default_inr' && (
              <View style={styles.waiverCard}>
                <Text style={styles.subHeader}>
                  {simResult.conversionResult.supportsStrategy &&
                  simResult.conversionResult.convertedUnitsPerYear > 0
                    ? `~${simResult.conversionResult.convertedUnitsPerYear.toLocaleString('en-IN')} ${simResult.conversionResult.unitLabel} / yr`
                    : 'Conversion Ratio'}
                </Text>
                <Text style={styles.metaNote}>{simResult.conversionResult.ratioText}</Text>
                {simResult.conversionResult.overflowNote ? (
                  <Text style={styles.bulletBad}>{simResult.conversionResult.overflowNote}</Text>
                ) : null}
              </View>
            )}

            {/* 4 KPI Summary Cards */}
            <View style={styles.simKpiGrid}>
              <View style={styles.simKpiCell}>
                <Text style={styles.keyLabel}>Annual Spend</Text>
                <Text style={styles.keyVal}>{formatInr(simResult.annualSpend)}</Text>
              </View>
              <View style={styles.simKpiCell}>
                <Text style={styles.keyLabel}>Gross Rewards</Text>
                <Text style={[styles.keyVal, { color: LedgerTheme.colors.accent }]}>
                  {formatInr(simResult.grossAnnualRewards)}
                </Text>
              </View>
              <View style={styles.simKpiCell}>
                <Text style={styles.keyLabel}>Effective Fee</Text>
                <Text
                  style={[
                    styles.keyVal,
                    simResult.waiverMet && { color: LedgerTheme.colors.accent },
                  ]}
                >
                  {simResult.feeCharged === 0
                    ? simResult.isLtf
                      ? '₹0 (LTF)'
                      : '₹0 (Waived)'
                    : formatInr(simResult.feeCharged)}
                </Text>
              </View>
              <View style={styles.simKpiCell}>
                <Text style={styles.keyLabel}>Net Benefit / Yr</Text>
                <Text
                  style={[
                    styles.keyVal,
                    {
                      color:
                        simResult.netAnnualBenefit >= 0
                          ? LedgerTheme.colors.accent
                          : LedgerTheme.colors.danger,
                    },
                  ]}
                >
                  {formatInr(simResult.netAnnualBenefit)} ({simResult.netYieldPct.toFixed(1)}%)
                </Text>
              </View>
            </View>

            {/* Annual Gross vs Fee vs Net Benefit Chart */}
            <NativeValueBreakdownChart
              title="Annual Gross vs. Fee vs. Net Value"
              subtitle={`At ${formatInr(simResult.annualSpend / 12)}/mo spend`}
              grossInr={simResult.grossAnnualRewards}
              feeInr={simResult.feeCharged}
              netInr={simResult.netAnnualBenefit}
            />

            {/* Fee Waiver Progress Tracker */}
            {simResult.waiverThreshold && !simResult.isLtf ? (
              <View style={styles.waiverCard}>
                <View style={styles.waiverTextRow}>
                  <Text style={styles.subHeader}>Annual Fee Waiver Tracker</Text>
                  <Text
                    style={[
                      styles.waiverPctText,
                      {
                        color: simResult.waiverMet
                          ? LedgerTheme.colors.accent
                          : LedgerTheme.colors.warn,
                      },
                    ]}
                  >
                    {simResult.waiverMet
                      ? 'Waiver Unlocked'
                      : `${formatInr(simResult.remainingForWaiver)} short`}
                  </Text>
                </View>
                <AnimatedProgressBar
                  percent={simResult.waiverProgressPct}
                  fillColor={
                    simResult.waiverMet ? LedgerTheme.colors.accent : LedgerTheme.colors.warn
                  }
                  height={8}
                />
                <Text style={styles.metaNote}>
                  Spend {formatInr(simResult.annualSpend)} / {formatInr(simResult.waiverThreshold)} required in 12 months
                </Text>
              </View>
            ) : null}

            {/* GST Toggle + Verdict */}
            <View style={styles.gstRow}>
              <ScalePressable
                onPress={() => setIncludeGst((v) => !v)}
                style={[styles.gstBtn, includeGst && styles.gstBtnActive]}
              >
                <Text
                  style={[
                    styles.gstBtnText,
                    includeGst && { color: LedgerTheme.colors.accent },
                  ]}
                >
                  18% GST on Fee: {includeGst ? 'Included' : 'Excluded'}
                </Text>
              </ScalePressable>
              <View
                style={[
                  styles.verdictPill,
                  {
                    backgroundColor:
                      simResult.netAnnualBenefit > 0
                        ? LedgerTheme.colors.tintPrimary
                        : LedgerTheme.colors.tintDanger,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.verdictPillText,
                    {
                      color:
                        simResult.netAnnualBenefit > 0
                          ? LedgerTheme.colors.accent
                          : LedgerTheme.colors.danger,
                    },
                  ]}
                >
                  {simResult.netAnnualBenefit > 0
                    ? `Worth holding (+${formatInr(simResult.netAnnualBenefit)}/yr)`
                    : 'Fee exceeds earned rewards'}
                </Text>
              </View>
            </View>

            {simResult.capNotes.length > 0 && (
              <AnimatedReveal style={styles.capNotesBox}>
                <Text style={styles.subHeader}>Monthly Caps Applied in Calculation</Text>
                {simResult.capNotes.map((note, idx) => (
                  <Text key={`cn_${idx}`} style={styles.capNoteItem}>
                    · {note}
                  </Text>
                ))}
              </AnimatedReveal>
            )}

            {/* All 12 Category Steppers */}
            <Text style={[styles.subHeader, { marginTop: 4 }]}>
              Adjust Monthly Spend by Category
            </Text>
            <View style={styles.rateTable}>
              {simResult.categoryRows.map(({ key, mSpend, pct, annReward }) => (
                <View key={key} style={styles.simRow}>
                  <View style={styles.simLabelCol}>
                    <Text style={styles.rateLabel}>{SPEND_CATEGORY_META[key].shortLabel}</Text>
                    <Text style={styles.metaNote}>
                      {pct.toFixed(1)}% · +{formatInr(annReward)}/yr
                    </Text>
                  </View>
                  <View style={styles.stepperGroup}>
                    <ScalePressable
                      onPress={() => bumpCategory(key, -1000)}
                      style={styles.stepBtn}
                    >
                      <Minus size={13} color={LedgerTheme.colors.inkPrimary} />
                    </ScalePressable>
                    <Text style={styles.stepVal}>{formatInr(mSpend)}</Text>
                    <ScalePressable
                      onPress={() => bumpCategory(key, 1000)}
                      style={styles.stepBtn}
                    >
                      <Plus size={13} color={LedgerTheme.colors.inkPrimary} />
                    </ScalePressable>
                  </View>
                </View>
              ))}
            </View>

            {(dossier.benefits_features_and_faqs.milestone_benefits || []).length > 0 && (
              <View style={styles.milestoneNoteBox}>
                <Text style={styles.fitLabel}>Potential Milestone Additions</Text>
                {dossier.benefits_features_and_faqs.milestone_benefits.map((m, i) => (
                  <Text key={`ms_${i}`} style={styles.metaNote}>
                    · {m}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Effective Return Rate by Spend Category</Text>
            <Text style={styles.metaNote}>
              Earn Unit: {dossier.reward_calculator_model.earn_unit} · Base:{' '}
              {dossier.reward_calculator_model.base_reward_rate_pct}% · Expiry:{' '}
              {dossier.reward_calculator_model.point_expiry}
            </Text>
            {(() => {
              const chartRows = SPEND_CATEGORY_KEYS.map((k) => ({
                key: k,
                pct: dossier.reward_calculator_model.effective_return_pct_by_category[k] ?? 0,
              }))
                .filter((r) => r.pct !== 0)
                .sort((a, b) => b.pct - a.pct);
              if (chartRows.length < 2) return null;
              return (
                <View style={{ marginVertical: 4 }}>
                  <NativeHorizontalBarChart
                    title="Category Return Profile (%)"
                    subtitle="Post-cap effective return per ₹100 spent · Expand for simulator"
                    onExpandPress={() => setFullGraphOpen(true)}
                    data={chartRows.map((r) => ({
                      id: r.key,
                      label: SPEND_CATEGORY_META[r.key].shortLabel,
                      value: Number(r.pct.toFixed(2)),
                      displayValue: `${r.pct.toFixed(1)}%`,
                    }))}
                  />
                </View>
              );
            })()}
            <View style={styles.rateTable}>
              {SPEND_CATEGORY_KEYS.map((key) => {
                const pct =
                  dossier.reward_calculator_model.effective_return_pct_by_category[key] ?? 0;
                const caveat = dossier.reward_calculator_model.category_caveats?.[key];
                return (
                  <View key={key} style={[styles.rateRow, caveat ? { flexDirection: 'column', alignItems: 'stretch', gap: 3 } : null]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.rateLabel}>{SPEND_CATEGORY_META[key].label}</Text>
                      <Text
                        style={[
                          styles.rateVal,
                          pct >= 3 && { color: LedgerTheme.colors.accent },
                          pct < 0 && { color: LedgerTheme.colors.danger },
                        ]}
                      >
                        {pct.toFixed(2)}%
                      </Text>
                    </View>
                    {caveat ? (
                      <Text style={{ fontSize: 11, color: '#9A5B13', fontWeight: '500' }}>
                        ⚠ {caveat}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Earning Rules & Monthly Caps</Text>
            {(dossier.reward_calculator_model.reward_earning_rules || []).map((rule, i) => (
              <Text key={`rr_${i}`} style={styles.bodyText}>
                · {rule}
              </Text>
            ))}
            {(dossier.reward_calculator_model.monthly_capping_rules || []).length > 0 && (
              <>
                <Text style={[styles.subHeader, { marginTop: 8 }]}>Capping Rules</Text>
                {dossier.reward_calculator_model.monthly_capping_rules.map((cap, i) => (
                  <Text key={`cap_${i}`} style={styles.bulletBad}>
                    ! {cap}
                  </Text>
                ))}
              </>
            )}
            {(dossier.reward_calculator_model.excluded_categories || []).length > 0 && (
              <>
                <Text style={[styles.subHeader, { marginTop: 8 }]}>Exclusions</Text>
                <Text style={styles.metaNote}>
                  {dossier.reward_calculator_model.excluded_categories.join(', ')}
                </Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* TAB 3: LOUNGES */}
      {activeTab === 'lounges' && (
        <View style={styles.sectionStack}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Airport & Railway Lounge Rules</Text>
            <View style={styles.loungeRuleBlock}>
              <Text style={styles.subHeader}>
                Domestic Airport Lounge · {domLoungeQuota}
              </Text>
              <Text style={styles.bodyText}>
                {lounge.has_domestic_lounge
                  ? sanitizeLoungeSummary(lounge.domestic.summary)
                  : 'No complimentary domestic airport lounge visits'}
              </Text>
              <Text style={styles.metaNote}>
                Spend condition:{' '}
                {spendCriteriaHasThreshold
                  ? lounge.domestic.spend_criteria
                  : isNoSpendLounge
                    ? 'No minimum spend required'
                    : lounge.domestic.spend_criteria || 'Not specified'}
              </Text>
            </View>
            <View style={styles.loungeRuleBlock}>
              <Text style={styles.subHeader}>
                International Lounge · {intlLoungeQuota}
              </Text>
              <Text style={styles.bodyText}>
                {lounge.has_international_lounge
                  ? sanitizeLoungeSummary(lounge.international.summary)
                  : 'No complimentary international airport lounge visits'}
              </Text>
              <Text style={styles.metaNote}>
                Program: {lounge.international.program} · Guest fee: {lounge.international.guest_fee}
              </Text>
            </View>
            {lounge.has_railway_lounge && (
              <View style={styles.loungeRuleBlock}>
                <Text style={styles.subHeader}>IRCTC Railway Lounge</Text>
                <Text style={styles.bodyText}>
                  {sanitizeLoungeSummary(lounge.railway.summary)}
                </Text>
              </View>
            )}

            {(lounge.applicable_lounge_links || []).map((lnk, idx) => (
              <ScalePressable
                key={`ll_${idx}`}
                onPress={() => openUrl(lnk.url)}
                style={styles.pdfBtn}
              >
                <Plane size={14} color={LedgerTheme.colors.accent} />
                <Text style={styles.pdfBtnText} numberOfLines={1}>
                  {lnk.title}
                </Text>
                <ExternalLink size={14} color={LedgerTheme.colors.accent} />
              </ScalePressable>
            ))}

            <View style={styles.onlineQrStrip}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <QrCode size={14} color={LedgerTheme.colors.accent} />
                <Text style={styles.subHeader}>Online Cardless QR Portals</Text>
              </View>
              <Text style={styles.metaNote}>
                Skip carrying the physical card: generate an instant QR pass (₹2/₹25 hold + OTP) at the official airport portal:
              </Text>
              <View style={styles.qrPortalChipsRow}>
                {[
                  ['LoungeOne QR', 'https://www.loungeone.ai'],
                  ['TFS Travel Club', 'https://www.loungeaccess.travelfoodservices.com'],
                  ['HOI Pass', 'https://www.lms.hoi.in'],
                ].map(([label, url]) => (
                  <ScalePressable
                    key={label}
                    onPress={() => openUrl(url)}
                    style={styles.qrPortalPill}
                  >
                    <Text style={styles.qrPortalPillText}>{label}</Text>
                    <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                  </ScalePressable>
                ))}
              </View>
            </View>
          </View>

          {hasGolf && (
            <View style={styles.panel}>
              <View style={styles.calcTitleRow}>
                <Flag size={15} color={LedgerTheme.colors.accent} />
                <Text style={styles.panelTitle}>Golf Course &amp; Club Privileges</Text>
              </View>
              {golfSummary ? (
                <View style={styles.golfGrid}>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Complimentary Rounds</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.complimentary_access || 'Included'}
                    </Text>
                  </View>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Eligible Courses</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.eligible_courses || 'Domestic / Participating'}
                    </Text>
                  </View>
                  <View style={styles.golfRow}>
                    <Text style={styles.golfLabel}>Spend Condition</Text>
                    <Text style={styles.golfVal}>
                      {golfSummary.spend_condition || 'None'}
                    </Text>
                  </View>
                </View>
              ) : null}
              {golfBenefits.map((gb, i) => (
                <Text key={`lgb_${i}`} style={styles.bodyText}>
                  · {gb}
                </Text>
              ))}
              {(() => {
                const guide = matchGolfGuideForCard(
                  identity.bank,
                  identity.card_network,
                  identity.card_name
                );
                return (
                  <View style={styles.golfClaimBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={styles.subHeader}>How to Claim ({guide.networkOrBank})</Text>
                      <ScalePressable
                        onPress={() =>
                          router.push({
                            pathname: '/(tabs)/lounges',
                            params: { subTab: 'golf' },
                          })
                        }
                      >
                        <Text style={styles.qrPortalPillText}>All Golf Lists →</Text>
                      </ScalePressable>
                    </View>
                    <View style={styles.qrPortalChipsRow}>
                      <ScalePressable
                        onPress={() => openUrl(guide.portalUrl)}
                        style={styles.qrPortalPill}
                      >
                        <Globe size={12} color={LedgerTheme.colors.accent} />
                        <Text style={styles.qrPortalPillText}>{guide.portalLabel}</Text>
                        <ExternalLink size={11} color={LedgerTheme.colors.accent} />
                      </ScalePressable>
                      <ScalePressable
                        onPress={() => openUrl(`tel:${guide.helplinePhone.replace(/[^+\d]/g, '')}`)}
                        style={styles.golfPhonePill}
                      >
                        <Phone size={12} color={LedgerTheme.colors.inkPrimary} />
                        <Text style={styles.golfPhoneText}>{guide.helplinePhone}</Text>
                      </ScalePressable>
                    </View>
                    <Text style={styles.metaNote}>
                      Window: {guide.bookingWindow} · {guide.steps[0]} {guide.steps[1]}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {(accessibleIndianLounges.length > 0 || matchedLounges.length > 0) && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Domestic Lounges Accessible in India ({domesticIndiaLoungeCount || accessibleIndianLounges.length || matchedLounges.length})
              </Text>
              <Text style={styles.metaNote}>
                Tap any Indian airport lounge below for photos, terminal guide, hours, reviews &amp; live wallet check.
              </Text>
              <View style={styles.searchBox}>
                <Search size={15} color={LedgerTheme.colors.inkMuted} />
                <TextInput
                  value={loungeQuery}
                  onChangeText={setLoungeQuery}
                  placeholder="Filter by city, terminal, or lounge name..."
                  placeholderTextColor={LedgerTheme.colors.inkMuted}
                  style={styles.searchInput}
                />
              </View>
              {displayLounges.map((spot, idx) => (
                <ScalePressable
                  key={`sp_${spot.lounge_code || idx}`}
                  onPress={() => {
                    if (spot.lounge_code) {
                      router.push(`/lounge/${spot.lounge_code}` as never);
                    }
                  }}
                  style={[styles.spotItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotTitle}>
                      {spot.city} · {spot.lounge_name}
                    </Text>
                    <Text style={styles.metaNote}>
                      {spot.terminal} ({spot.terminal_type})
                      {spot.google_rating ? ` · ★ ${spot.google_rating.toFixed(1)}` : ''}
                    </Text>
                  </View>
                  {spot.lounge_code ? (
                    <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                  ) : null}
                </ScalePressable>
              ))}
            </View>
          )}

          {accessibleGolfClubs.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Accessible Indian Golf Clubs ({accessibleGolfClubs.length})
              </Text>
              {accessibleGolfClubs.slice(0, 10).map((club) => (
                <ScalePressable
                  key={club.slug}
                  onPress={() => router.push(`/lounge/${club.slug}` as never)}
                  style={[styles.spotItem, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotTitle}>
                      {club.city} · {club.club_name}
                    </Text>
                    <Text style={styles.metaNote}>
                      Golf Club{club.google_rating ? ` · ★ ${club.google_rating.toFixed(1)}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={15} color={LedgerTheme.colors.accent} />
                </ScalePressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* TAB 4: FEES & ELIGIBILITY */}
      {activeTab === 'fees' && (
        <View style={styles.sectionStack}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Fees, Interest & Markup Ledger</Text>
            {[
              ['Joining Fee', formatInr(fees.joining_fee_inr, true)],
              ['Annual Renewal Fee', formatInr(fees.annual_fee_inr, true)],
              [
                'Fee Waiver Condition',
                fees.fee_waiver_spend_inr
                  ? `${formatInr(fees.fee_waiver_spend_inr)} annual spend`
                  : 'None',
              ],
              ['Forex Markup', `${fees.forex_markup_pct}%`],
              ['Finance Charge (APR)', `${fees.apr_monthly_pct}% / mo (${fees.apr_annual_pct}% p.a.)`],
              ['Cash Advance Fee', fees.cash_advance_fee],
              ['Fuel Surcharge Waiver', fees.fuel_surcharge_waiver],
              ['Redemption Fee', fees.redemption_fee],
            ].map(([k, v]) => (
              <View key={k} style={styles.rateRow}>
                <Text style={styles.rateLabel}>{k}</Text>
                <Text style={styles.rateVal}>{v}</Text>
              </View>
            ))}

            {(fees.late_payment_slabs || []).length > 0 && (
              <>
                <Text style={[styles.subHeader, { marginTop: 10 }]}>Late Payment Slabs</Text>
                {fees.late_payment_slabs.map((slab, idx) => (
                  <View key={`sl_${idx}`} style={styles.rateRow}>
                    <Text style={styles.rateLabel}>
                      {slab.statement_balance_slab || slab.balance_range}
                    </Text>
                    <Text style={styles.rateVal}>{slab.late_fee_inr || slab.fee}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Eligibility Criteria</Text>
            {[
              ['Occupation', dossier.eligibility_detailed.occupation],
              ['Age Bracket', dossier.eligibility_detailed.age_range],
              [
                'Salaried Income Floor',
                dossier.eligibility_detailed.min_monthly_income_salaried_inr
                  ? `${formatInr(dossier.eligibility_detailed.min_monthly_income_salaried_inr)} / month`
                  : 'Bank discretion / FD-backed',
              ],
              [
                'Self-Employed ITR',
                dossier.eligibility_detailed.min_annual_itr_self_employed_inr
                  ? `${formatInr(dossier.eligibility_detailed.min_annual_itr_self_employed_inr)} p.a.`
                  : 'Bank discretion',
              ],
              ['Target CIBIL Score', `${dossier.eligibility_detailed.min_cibil_score}+`],
            ].map(([k, v]) => (
              <View key={k} style={styles.rateRow}>
                <Text style={styles.rateLabel}>{k}</Text>
                <Text style={styles.rateVal}>{v}</Text>
              </View>
            ))}
            {dossier.eligibility_detailed.approval_notes ? (
              <Text style={styles.metaNote}>{dossier.eligibility_detailed.approval_notes}</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* TAB 5: DEVALUATIONS, ESCALATION, FAQS & ALTERNATES */}
      {activeTab === 'devals' && (
        <View style={styles.sectionStack}>
          <View style={styles.panel}>
            <View style={styles.devalHeader}>
              <ShieldAlert size={16} color={LedgerTheme.colors.warn} />
              <Text style={[styles.panelTitle, { flex: 1 }]}>
                Devaluation Risk ({dossier.devaluation_analysis.devaluation_risk_score.toFixed(1)}
                /10 · {dossier.devaluation_analysis.devaluation_frequency})
              </Text>
              <ScalePressable
                onPress={() => router.push('/devaluations')}
                style={styles.devalTimelinePill}
              >
                <Text style={styles.devalTimelinePillText}>Timeline →</Text>
              </ScalePressable>
            </View>
            {(dossier.devaluation_analysis.devaluation_history || []).map((h, i) => {
              const isOpen = openDevalIdx === i;
              const clauses = splitDevalSummaryClauses(h);
              return (
                <ScalePressable
                  key={`dh_${i}`}
                  onPress={() => {
                    triggerCalmLayoutTransition();
                    setOpenDevalIdx(isOpen ? null : i);
                  }}
                  style={styles.devalExpandBox}
                >
                  <View style={styles.devalExpandHead}>
                    <Text style={styles.devalExpandTitle} numberOfLines={isOpen ? undefined : 2}>
                      {h}
                    </Text>
                    {isOpen ? (
                      <ChevronUp size={15} color={LedgerTheme.colors.warn} />
                    ) : (
                      <ChevronDown size={15} color={LedgerTheme.colors.inkMuted} />
                    )}
                  </View>
                  {isOpen && (
                    <View style={styles.devalExpandBody}>
                      {clauses.map((cl, cIdx) => (
                        <Text key={cIdx} style={styles.devalClauseSmall}>
                          • {cl}
                        </Text>
                      ))}
                      <Text style={styles.devalMetaHint}>
                        Last tracked: {dossier.devaluation_analysis.last_devalued_on || 'Audited 2024–2026'}
                      </Text>
                    </View>
                  )}
                </ScalePressable>
              );
            })}
            {issuerDevalEvents.length > 0 && (
              <View style={styles.devalIssuerBox}>
                <Text style={styles.devalIssuerHeading}>
                  Issuer Timeline Events ({issuerDevalEvents.length})
                </Text>
                {issuerDevalEvents.slice(0, 3).map((ev, eIdx) => {
                  const keyIdx = 1000 + eIdx;
                  const isOpen = openDevalIdx === keyIdx;
                  const clauses = splitDevalSummaryClauses(ev.summary);
                  return (
                    <ScalePressable
                      key={`${ev.date}_${eIdx}`}
                      onPress={() => {
                        triggerCalmLayoutTransition();
                        setOpenDevalIdx(isOpen ? null : keyIdx);
                      }}
                      style={styles.devalEventRow}
                    >
                      <View style={styles.devalEventTop}>
                        <Text style={styles.devalEventDate}>
                          {ev.date} · {ev.issuer}
                        </Text>
                        <Text style={styles.devalEventSeverity}>{ev.severity.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.devalEventSummary} numberOfLines={isOpen ? undefined : 2}>
                        {ev.summary}
                      </Text>
                      {isOpen && (
                        <View style={styles.devalExpandBody}>
                          {clauses.map((cl, cIdx) => (
                            <Text key={cIdx} style={styles.devalClauseSmall}>
                              • {cl}
                            </Text>
                          ))}
                          {ev.cards_affected.length > 0 && (
                            <Text style={styles.devalMetaHint}>
                              Cards impacted: {ev.cards_affected.join(', ')}
                            </Text>
                          )}
                        </View>
                      )}
                    </ScalePressable>
                  );
                })}
              </View>
            )}
            {(dossier.devaluation_analysis.watch_out_vectors || []).map((v, i) => (
              <Text key={`wv_${i}`} style={styles.bulletBad}>
                ! {v}
              </Text>
            ))}
            <ScalePressable
              onPress={() => router.push('/devaluations')}
              style={styles.devalAllBtn}
            >
              <ShieldAlert size={14} color={LedgerTheme.colors.warn} />
              <Text style={styles.devalAllBtnText}>All Issuer Devaluations</Text>
              <ChevronRight size={14} color={LedgerTheme.colors.warn} />
            </ScalePressable>
          </View>

          {bankHelp && (
            <View style={styles.panel}>
              <View style={styles.devalHeader}>
                <Headphones size={16} color={LedgerTheme.colors.accent} />
                <Text style={[styles.panelTitle, { flex: 1 }]}>
                  {bankHelp.bank} Helplines &amp; L1/L2/PNO
                </Text>
              </View>
              <Text style={styles.metaNote}>
                24×7 Toll-Free: {bankHelp.helplineTollFree} · Card Block: {bankHelp.cardBlockNumber}
              </Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                {[
                  ['L1 Care', bankHelp.l1Email],
                  ['L2 Nodal', bankHelp.l2NodalEmail],
                  ['L3 PNO', bankHelp.l3PnoEmail],
                  ['Governance', bankHelp.governanceEmail],
                ].map(([tier, email]) => (
                  <ScalePressable
                    key={tier}
                    onPress={() => void openExternalUrlSafely(`mailto:${email}`)}
                    style={styles.rateRow}
                  >
                    <Text style={styles.rateLabel}>{tier}</Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.rateVal, { color: LedgerTheme.colors.accent, maxWidth: '70%' }]}
                    >
                      {email}
                    </Text>
                  </ScalePressable>
                ))}
              </View>
              <ScalePressable
                onPress={() =>
                  router.push({
                    pathname: '/help',
                    params: { bank: identity.bank_slug },
                  } as never)
                }
                style={styles.pdfBtn}
              >
                <Phone size={14} color={LedgerTheme.colors.accent} />
                <Text style={styles.pdfBtnText}>
                  Full L1 / L2 / L3 PNO &amp; Ombudsman Guide
                </Text>
                <ChevronRight size={14} color={LedgerTheme.colors.accent} />
              </ScalePressable>
            </View>
          )}

          {(dossier.reddit_user_feedback.optimization_tips || []).length > 0 && (
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: '#EEF5F2',
                  borderColor: 'rgba(15,92,77,0.28)',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Sparkles size={16} color={LedgerTheme.colors.accent} />
                <Text style={[styles.panelTitle, { color: LedgerTheme.colors.accent, marginBottom: 0 }]}>
                  Pro Hacks &amp; Reward Optimization Tips
                </Text>
              </View>
              {(dossier.reddit_user_feedback.optimization_tips || []).map((tip, i) => (
                <View
                  key={`opt_tip_${i}`}
                  style={[
                    styles.proItemCard,
                    {
                      backgroundColor: '#FFFFFF',
                      borderColor: 'rgba(15,92,77,0.16)',
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                    },
                  ]}
                >
                  <CheckCircle2 size={14} color="#16A34A" style={{ marginTop: 2 }} />
                  <Text style={styles.proItemText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {(dossier.reddit_user_feedback.practical_community_warnings || []).length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>
                Verified Card Watch-Outs &amp; Restrictions
              </Text>
              {(dossier.reddit_user_feedback.practical_community_warnings || []).map((w, i) => (
                <View key={`cw_${i}`} style={styles.warnChip}>
                  <AlertTriangle size={13} color={LedgerTheme.colors.warn} style={{ marginTop: 2 }} />
                  <Text style={styles.warnChipText}>{w}</Text>
                </View>
              ))}
            </View>
          )}

          {(dossier.benefits_features_and_faqs.faqs || []).length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Frequently Asked Questions</Text>
              {dossier.benefits_features_and_faqs.faqs.map((faq, idx) => {
                const open = openFaqIdx === idx;
                const qText = faq.q || faq.question || '';
                const aText = faq.a || faq.answer || '';
                return (
                  <ScalePressable
                    key={`faq_${idx}`}
                    onPress={() => {
                      triggerCalmLayoutTransition();
                      setOpenFaqIdx(open ? null : idx);
                    }}
                    style={styles.faqItem}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQ}>{qText}</Text>
                      {open ? (
                        <ChevronUp size={16} color={LedgerTheme.colors.inkMuted} />
                      ) : (
                        <ChevronDown size={16} color={LedgerTheme.colors.inkMuted} />
                      )}
                    </View>
                    {open && (
                      <AnimatedReveal>
                        <Text style={styles.faqA}>{aText}</Text>
                      </AnimatedReveal>
                    )}
                  </ScalePressable>
                );
              })}
            </View>
          )}

          {renderRelatedMatrix()}

          {(dossier.alternate_options || []).length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Alternate Options to Consider</Text>
              {dossier.alternate_options.map((alt) => (
                <ScalePressable
                  key={alt.card_id}
                  onPress={() =>
                    router.push({
                      pathname: '/card/[bankSlug]/[cardSlug]',
                      params: { bankSlug: alt.bank_slug, cardSlug: alt.card_slug },
                    })
                  }
                  style={styles.altCard}
                >
                  <View style={styles.bankInlineRow}>
                    <BankLogo bankSlug={alt.bank_slug} bank={alt.bank} size="xs" />
                    <Text style={styles.altRole}>
                      {alt.bank} · {roleLabel(alt.role)}
                    </Text>
                  </View>
                  <Text style={styles.altName}>
                    {alt.card_name} · {formatInr(alt.annual_fee_inr, true)}
                  </Text>
                  <Text style={styles.metaNote}>{alt.reason}</Text>
                </ScalePressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Bottom Official Bank MITC & Regulatory PDFs */}
      <View style={styles.panel}>
        <View style={styles.devalHeader}>
          <CanvaFeatureIcon icon="mitc" size={20} />
          <Text style={[styles.panelTitle, { flex: 1 }]}>
            Official Bank MITC &amp; Disclosures
          </Text>
        </View>
        <Text style={styles.metaNote}>
          Always verify latest fee waiver thresholds, category exclusions, and reward caps on the bank’s official PDF before applying.
        </Text>
        <View style={{ gap: 8, marginTop: 4 }}>
          {dossier.official_and_reference_links.mitc_pdf_url ? (
            <ScalePressable
              onPress={() => openUrl(dossier.official_and_reference_links.mitc_pdf_url)}
              style={styles.pdfBtn}
            >
              <FileText size={15} color={LedgerTheme.colors.accent} />
              <Text style={styles.pdfBtnText}>Official Bank MITC PDF</Text>
              <ExternalLink size={14} color={LedgerTheme.colors.accent} />
            </ScalePressable>
          ) : null}
          {dossier.official_and_reference_links.bank_url ? (
            <ScalePressable
              onPress={() => openUrl(dossier.official_and_reference_links.bank_url)}
              style={styles.pdfBtn}
            >
              <Globe size={15} color={LedgerTheme.colors.accent} />
              <Text style={styles.pdfBtnText}>Issuer Card Product Page</Text>
              <ExternalLink size={14} color={LedgerTheme.colors.accent} />
            </ScalePressable>
          ) : null}
          <ScalePressable
            onPress={() => router.push('/devaluations')}
            style={styles.pdfBtn}
          >
            <CanvaFeatureIcon icon="devaluation" size={16} />
            <Text style={styles.pdfBtnText}>Issuer Devaluations &amp; Schedule PDFs</Text>
            <ChevronRight size={14} color={LedgerTheme.colors.accent} />
          </ScalePressable>
        </View>
      </View>

      {/* Share Action Sheet Modal (WhatsApp · Image/PDF Report · Copy/Share · Save) */}
      <Modal
        visible={shareSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShareSheetOpen(false)}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <SafeAreaView>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  Share {identity.card_name}
                </Text>
                <Pressable onPress={() => setShareSheetOpen(false)} style={styles.sheetCloseBtn}>
                  <X size={18} color={LedgerTheme.colors.inkPrimary} />
                </Pressable>
              </View>

              <View style={{ gap: 10, marginTop: 12 }}>
                <ScalePressable
                  onPress={() => {
                    setShareSheetOpen(false);
                    const feeLabel =
                      fees.annual_fee_inr === 0
                        ? 'Lifetime Free'
                        : `${formatInr(fees.annual_fee_inr)}/yr`;
                    const msg = `${identity.card_name} (${identity.bank}) — ${feeLabel} · ★ ${dossier.ratings.overall_market_rating.toFixed(2)}/5\nhttps://card.cogify.me/${identity.bank_slug}/${identity.card_slug}`;
                    void openExternalUrlSafely(buildWhatsAppShareUrl(msg)).then((ok) => {
                      if (!ok) void shareCardSummary(dossier);
                    });
                  }}
                  style={[styles.sheetOptionBtn, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
                >
                  <MessageCircle size={18} color="#15803D" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetOptionTitle, { color: '#15803D' }]}>Share on WhatsApp</Text>
                    <Text style={styles.sheetOptionSub}>Send card highlights & link directly</Text>
                  </View>
                </ScalePressable>

                <ScalePressable
                  onPress={() => {
                    setShareSheetOpen(false);
                    void exportSingleCardPdfMobile(dossier);
                  }}
                  style={styles.sheetOptionBtn}
                >
                  <FileText size={18} color={LedgerTheme.colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Export Visual PDF Report</Text>
                    <Text style={styles.sheetOptionSub}>Includes card image, 12-category chart, caps & L1/L2/PNO help</Text>
                  </View>
                </ScalePressable>

                <ScalePressable
                  onPress={() => {
                    setShareSheetOpen(false);
                    void shareCardSummary(dossier);
                  }}
                  style={styles.sheetOptionBtn}
                >
                  <Share2 size={18} color={LedgerTheme.colors.inkPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>Native Share / Copy Summary</Text>
                    <Text style={styles.sheetOptionSub}>AirDrop, Messages, Notes or Clipboard</Text>
                  </View>
                </ScalePressable>

                <ScalePressable
                  onPress={() => {
                    toggleSaved(identity.card_id);
                    setShareSheetOpen(false);
                  }}
                  style={styles.sheetOptionBtn}
                >
                  <Bookmark
                    size={18}
                    color={saved ? LedgerTheme.colors.accent : LedgerTheme.colors.inkSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetOptionTitle}>
                      {saved ? 'Remove from Saved Cards' : 'Save Card to Bookmarks'}
                    </Text>
                    <Text style={styles.sheetOptionSub}>Quick access from your Saved list</Text>
                  </View>
                </ScalePressable>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full-Page Interactive 12-Category Return Graph Modal */}
      <FullScreenGraphModal
        visible={fullGraphOpen}
        onClose={() => setFullGraphOpen(false)}
        title={identity.card_name}
        subtitle={`Interactive Post-Cap Return (%) · Unit: ${dossier.reward_calculator_model.earn_unit}`}
        categories={SPEND_CATEGORY_KEYS.map((k) => SPEND_CATEGORY_META[k].shortLabel)}
        categoryKeys={SPEND_CATEGORY_KEYS}
        caveats={dossier.reward_calculator_model.category_caveats}
        annualFeeInr={fees.annual_fee_inr}
        series={[
          {
            label: identity.card_name,
            color: cardTheme?.primary_hex || LedgerTheme.colors.accent,
            values: SPEND_CATEGORY_KEYS.map(
              (k) => dossier.reward_calculator_model.effective_return_pct_by_category[k] ?? 0
            ),
          },
        ]}
        benchmarkSeries={{
          label: 'Market Benchmark (2% Flat)',
          color: '#64748B',
          values: SPEND_CATEGORY_KEYS.map((k) => (k === 'fuel' || k === 'education_rent_govt' ? 0 : 2)),
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  content: {
    padding: 18,
    paddingBottom: 42,
    gap: 18,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  heroTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroTopColumn: {
    flexDirection: 'column',
    gap: 14,
    alignItems: 'center',
  },
  heroMeta: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  bankLabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
    flex: 1,
  },
  bankInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  highlightCardsStack: {
    gap: 8,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.blueSoftBorder,
    borderRadius: 11,
    padding: 12,
  },
  highlightIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.blueSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextCol: {
    flex: 1,
    gap: 2,
  },
  highlightTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  highlightDetail: {
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17.5,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  benefitIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.blueSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 19,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 26,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scorePillText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minWidth: 96,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveActionBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  actionBtnPrimary: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: LedgerTheme.colors.accent,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.surface,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
  },
  keyCell: {
    width: '48%',
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 10,
    padding: 11,
  },
  keyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  keyLabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  keyVal: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  tabScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  tabPill: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  tabTextActive: {
    color: LedgerTheme.colors.surface,
  },
  sectionStack: {
    gap: 12,
  },
  calcPreviewCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  calcPreviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  calcPreviewLeft: {
    flex: 1,
    gap: 3,
  },
  calcTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calcPreviewRight: {
    alignItems: 'flex-end',
  },
  netBigVal: {
    fontSize: 16,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  waiverTrackBox: {
    gap: 5,
    paddingTop: 2,
  },
  waiverTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waiverPctText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  tuneBtn: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tuneBtnText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  presetsScroll: {
    gap: 7,
    paddingVertical: 2,
  },
  presetBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    justifyContent: 'center',
  },
  presetBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  simKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  simKpiCell: {
    width: '48%',
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 9,
    padding: 9,
  },
  waiverCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 9,
    padding: 10,
    gap: 6,
  },
  gstRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gstBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  gstBtnActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#C5DFD6',
  },
  gstBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  verdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verdictPillText: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  simRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  simLabelCol: {
    flex: 1,
    gap: 1,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    width: 68,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  milestoneNoteBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 8,
    padding: 10,
    gap: 3,
    marginTop: 4,
  },
  matrixTable: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 9,
    overflow: 'hidden',
  },
  matrixHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LedgerTheme.colors.subtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
  },
  matrixHeadText: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
  },
  matrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
    backgroundColor: LedgerTheme.colors.surface,
  },
  matrixRowCurrent: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  matrixCellCard: {
    width: 162,
    paddingRight: 14,
  },
  matrixRole: {
    fontSize: 10,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  matrixCardName: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 16,
  },
  matrixCellNum: {
    width: 82,
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    paddingRight: 12,
  },
  matrixCellPct: {
    width: 60,
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    paddingRight: 12,
  },
  matrixCellLounge: {
    width: 86,
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
    paddingRight: 12,
  },
  matrixCellAction: {
    width: 68,
    alignItems: 'flex-start',
  },
  matrixCmpBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  matrixCmpBtnActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: '#A9CEC3',
  },
  matrixCmpText: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  panel: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  panelTitle: {
    fontSize: 17.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  subHeader: {
    fontSize: 14.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  bodyText: {
    fontSize: 13.5,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 19,
  },
  metaNote: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
    lineHeight: 17,
  },
  fitBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  fitLabel: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  fitBoxWarn: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  fitLabelWarn: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  fitVal: {
    fontSize: 13,
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 18,
  },
  bulletGood: {
    fontSize: 13,
    color: LedgerTheme.colors.accentDark,
    lineHeight: 18,
  },
  bulletBad: {
    fontSize: 13,
    color: LedgerTheme.colors.warn,
    lineHeight: 18,
  },
  subRatingsList: {
    gap: 8,
  },
  subRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subRatingLabel: {
    width: 112,
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
  },
  subRatingVal: {
    width: 30,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  rateTable: {
    gap: 6,
    marginTop: 4,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  rateLabel: {
    flex: 1,
    fontSize: 12.5,
    color: LedgerTheme.colors.inkSecondary,
  },
  rateVal: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  loungeRuleBlock: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  pdfBtnText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 9,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: LedgerTheme.colors.inkPrimary,
    paddingVertical: 6,
  },
  spotItem: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
  },
  spotTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  devalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnChip: {
    flexDirection: 'row',
    gap: 7,
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: 8,
    padding: 9,
  },
  warnChipText: {
    flex: 1,
    fontSize: 12.5,
    color: LedgerTheme.colors.warn,
    lineHeight: 17,
  },
  faqItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.subtle,
    gap: 6,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  faqQ: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  faqA: {
    fontSize: 13,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 18,
  },
  altCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 10,
    gap: 3,
  },
  altRole: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  altName: {
    fontSize: 14,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  offerInlineCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 10,
    gap: 5,
  },
  offerInlineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  offerInlineCategory: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.inkSecondary,
    backgroundColor: LedgerTheme.colors.blueSoftBg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.blueSoftBorder,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  offerInlineValid: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  offerInlineTitle: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    lineHeight: 18,
  },
  offerInlineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  offerInlineLink: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  golfGrid: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 9,
    padding: 10,
    gap: 6,
  },
  golfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  golfLabel: {
    fontSize: 12,
    color: LedgerTheme.colors.inkMuted,
  },
  golfVal: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  capNotesBox: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderRadius: 9,
    padding: 10,
    gap: 4,
  },
  capNoteItem: {
    fontSize: 12,
    color: LedgerTheme.colors.warn,
    lineHeight: 17,
  },
  verdictTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  aiVerdictTag: {
    fontSize: 12.5,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  aiTonePill: {
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  aiToneGood: {
    color: LedgerTheme.colors.accent,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  aiToneWarn: {
    color: LedgerTheme.colors.warn,
    backgroundColor: LedgerTheme.colors.tintWarn,
  },
  aiToneNeutral: {
    color: LedgerTheme.colors.inkSecondary,
    backgroundColor: LedgerTheme.colors.subtle,
  },
  devalTimelinePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.25)',
  },
  devalTimelinePillText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  devalExpandBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.2)',
    backgroundColor: LedgerTheme.colors.tintWarn,
    padding: 11,
    gap: 6,
  },
  devalExpandHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  devalExpandTitle: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
  },
  devalExpandBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(180, 83, 9, 0.14)',
    paddingTop: 7,
    gap: 4,
  },
  devalClauseSmall: {
    fontSize: 12.5,
    lineHeight: 18,
    color: LedgerTheme.colors.inkSecondary,
  },
  devalMetaHint: {
    fontSize: 11.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    marginTop: 2,
  },
  devalIssuerBox: {
    gap: 7,
    marginTop: 2,
  },
  devalIssuerHeading: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkMuted,
  },
  devalEventRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
    padding: 11,
    gap: 5,
  },
  devalEventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  devalEventDate: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  devalEventSeverity: {
    fontSize: 10.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  devalEventSummary: {
    fontSize: 13,
    lineHeight: 18.5,
    color: LedgerTheme.colors.inkPrimary,
  },
  devalAllBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.3)',
    backgroundColor: LedgerTheme.colors.tintWarn,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  devalAllBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  onlineQrStrip: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    gap: 6,
  },
  qrPortalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  qrPortalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  qrPortalPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  golfClaimBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: LedgerTheme.colors.hairline,
    gap: 7,
  },
  golfPhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  golfPhoneText: {
    fontSize: 12,
    fontWeight: '500',
    color: LedgerTheme.colors.inkPrimary,
    fontVariant: ['tabular-nums'],
  },
  prosConsSplitWrap: {
    gap: 12,
  },
  prosCardBox: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 13,
    padding: 14,
    gap: 8,
  },
  consCardBox: {
    backgroundColor: LedgerTheme.colors.tintWarn,
    borderWidth: 1,
    borderColor: '#EED8B5',
    borderRadius: 13,
    padding: 14,
    gap: 8,
  },
  prosConsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  prosBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: LedgerTheme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: LedgerTheme.colors.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prosHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
  },
  consHeaderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
  },
  prosCountPill: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#C5DFD6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  prosCountText: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  consCountPill: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: '#EED8B5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  consCountText: {
    fontSize: 11,
    fontWeight: '500',
    color: LedgerTheme.colors.warn,
    fontVariant: ['tabular-nums'],
  },
  proItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: '#D8EAE3',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  conItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#F3E2C7',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  proItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: LedgerTheme.colors.inkPrimary,
  },
  conItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: LedgerTheme.colors.inkSecondary,
  },
  topHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  topHeaderBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  topHeaderBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  topHeaderIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.creamWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: LedgerTheme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    flex: 1,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LedgerTheme.colors.creamWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  sheetOptionSub: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 1,
  },
});
