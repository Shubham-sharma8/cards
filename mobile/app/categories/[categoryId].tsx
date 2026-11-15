import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { CATEGORY_OPTIONS } from '../../src/lib/advisor';
import { ALL_CARDS } from '../../src/lib/data';
import { formatInr } from '../../src/lib/format';
import { LedgerTheme } from '../../src/lib/theme';
import { NativeHorizontalBarChart } from '../../src/components/AnalyticsCharts';
import { FullScreenGraphModal } from '../../src/components/FullScreenGraphModal';
import { CanvaFeatureIcon, resolveCategoryCanvaIcon } from '../../src/components/FeatureIcon';
import { LedgerCardItem } from '../../src/components/LedgerCardItem';
import { ScalePressable } from '../../src/components/MotionPrimitives';
import { getCategoryProTips } from '../../src/lib/categoryTips';
import { Sparkles } from 'lucide-react-native';
import type { CardSummaryItem } from '../../src/lib/types';

export default function CategoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const [fullGraphOpen, setFullGraphOpen] = useState(false);

  const category = useMemo(() => {
    const raw = typeof params.categoryId === 'string' ? params.categoryId : '';
    return (
      CATEGORY_OPTIONS.find(
        (o) =>
          o.id === raw ||
          o.datasetCategory.toLowerCase() === raw.toLowerCase()
      ) ?? CATEGORY_OPTIONS[0]
    );
  }, [params.categoryId]);

  const rankedCards = useMemo(() => {
    return ALL_CARDS.filter(
      (c) =>
        c.primary_category === category.datasetCategory ||
        c.categories.includes(category.datasetCategory)
    ).sort((a, b) => {
      const aRate = a.effective_return_pct_by_category?.[category.keyReturnKey] ?? 0;
      const bRate = b.effective_return_pct_by_category?.[category.keyReturnKey] ?? 0;
      if (Math.abs(bRate - aRate) > 0.25) return bRate - aRate;
      return b.overall_rating - a.overall_rating;
    });
  }, [category]);

  const openCard = (card: CardSummaryItem) => {
    router.push({
      pathname: '/card/[bankSlug]/[cardSlug]',
      params: { bankSlug: card.bank_slug, cardSlug: card.card_slug },
    });
  };

  const chartCards = rankedCards.slice(0, 8);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: category.shortLabel, headerBackTitle: 'Categories' }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(category.datasetCategory)} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{category.datasetCategory}</Text>
              <Text style={styles.heroSub}>{category.blurb}</Text>
            </View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpiPill}>
              <Text style={styles.kpiLabel}>Eligible Cards</Text>
              <Text style={styles.kpiVal}>{rankedCards.length}</Text>
            </View>
            <View style={styles.kpiPill}>
              <Text style={styles.kpiLabel}>Peak Earn Rate</Text>
              <Text style={styles.kpiVal}>
                {(
                  rankedCards[0]?.effective_return_pct_by_category?.[category.keyReturnKey] ?? 0
                ).toFixed(1)}
                %
              </Text>
            </View>
          </View>
        </View>

        {chartCards.length > 1 && (
          <NativeHorizontalBarChart
            title={`Top ${category.shortLabel} Earners`}
            subtitle="Effective post-cap return % · Tap any bar to open card"
            onExpandPress={() => setFullGraphOpen(true)}
            data={chartCards.slice(0, 6).map((c) => {
              const rate = c.effective_return_pct_by_category?.[category.keyReturnKey] ?? 0;
              return {
                id: c.card_id,
                label: c.card_name,
                sublabel: `${c.bank} · Fee ${c.annual_fee_inr === 0 ? '₹0' : formatInr(c.annual_fee_inr)}`,
                value: Number(Math.max(0.2, rate || c.overall_rating).toFixed(2)),
                displayValue: rate > 0 ? `${rate.toFixed(1)}%` : `★ ${c.overall_rating.toFixed(1)}`,
                onPress: () => openCard(c),
              };
            })}
          />
        )}

        <View
          style={{
            backgroundColor: '#EEF5F2',
            borderWidth: 1,
            borderColor: 'rgba(15,92,77,0.25)',
            borderRadius: 18,
            padding: 16,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color={LedgerTheme.colors.accent} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: LedgerTheme.colors.accent }}>
              {category.shortLabel} Playbook &amp; Pro Tricks
            </Text>
          </View>
          {getCategoryProTips(category.id).map((tip) => (
            <View
              key={tip.title}
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: 'rgba(15,92,77,0.14)',
                borderRadius: 12,
                padding: 12,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: LedgerTheme.colors.inkPrimary }}>
                {tip.title}
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: LedgerTheme.colors.inkSecondary }}>
                {tip.detail}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.listSection}>
          <Text style={styles.listHeading}>Top Ranked Cards ({rankedCards.length})</Text>
          {rankedCards.slice(0, 20).map((card) => (
            <LedgerCardItem key={card.card_id} card={card} onPress={openCard} compact />
          ))}

          {rankedCards.length > 20 && (
            <ScalePressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/finder',
                  params: { cat: category.datasetCategory },
                })
              }
              style={styles.viewAllBtn}
            >
              <Text style={styles.viewAllTxt}>Search all {rankedCards.length} cards in Finder</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </ScalePressable>
          )}
        </View>
      </ScrollView>

      <FullScreenGraphModal
        visible={fullGraphOpen}
        onClose={() => setFullGraphOpen(false)}
        title={`${category.shortLabel} Leaders`}
        subtitle="Compare post-cap reward rates & simulate annual benefit"
        itemKind="card"
        annualFeeInr={chartCards[0]?.annual_fee_inr ?? 0}
        categories={chartCards.map((c) => c.card_name.replace(/Credit Card/gi, '').trim())}
        series={[
          {
            label: `${category.shortLabel} Return (%)`,
            color: LedgerTheme.colors.accent,
            values: chartCards.map((c) =>
              Number((c.effective_return_pct_by_category?.[category.keyReturnKey] ?? 0).toFixed(2))
            ),
          },
        ]}
        valueSuffix="%"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 48 },
  heroCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    ...LedgerTheme.shadow.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { fontSize: 21, fontWeight: '800', color: LedgerTheme.colors.inkPrimary },
  heroSub: { fontSize: 13.5, color: LedgerTheme.colors.inkSecondary, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiPill: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.creamWarm,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 11,
  },
  kpiLabel: { fontSize: 11.5, color: LedgerTheme.colors.inkMuted },
  kpiVal: { fontSize: 17, fontWeight: '800', color: LedgerTheme.colors.accent, marginTop: 2 },
  listSection: { gap: 12 },
  listHeading: { fontSize: 18, fontWeight: '800', color: LedgerTheme.colors.inkPrimary },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  viewAllTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
