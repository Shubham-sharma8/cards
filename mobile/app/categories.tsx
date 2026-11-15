import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { CATEGORY_OPTIONS } from '../src/lib/advisor';
import { ALL_CARDS } from '../src/lib/data';
import { resolveOpenMediaSource } from '../src/lib/openMedia';
import { LedgerTheme } from '../src/lib/theme';
import { CanvaFeatureIcon, resolveCategoryCanvaIcon } from '../src/components/FeatureIcon';
import { NativeHorizontalBarChart } from '../src/components/AnalyticsCharts';
import { ScalePressable } from '../src/components/MotionPrimitives';

export default function CategoriesHubScreen() {
  const router = useRouter();

  const categoryStats = useMemo(() => {
    return CATEGORY_OPTIONS.map((opt) => {
      const matching = ALL_CARDS.filter(
        (c) =>
          c.primary_category === opt.datasetCategory ||
          c.categories.includes(opt.datasetCategory)
      );
      const peakPct = matching.reduce((max, card) => {
        const val = card.effective_return_pct_by_category?.[opt.keyReturnKey] ?? 0;
        return val > max ? val : max;
      }, 0);
      return {
        ...opt,
        count: matching.length,
        peakPct,
      };
    });
  }, []);

  const experiences = [
    {
      title: 'Airport Lounges',
      sub: '115+ India Terminals',
      topic: 'airport-lounge' as const,
      icon: 'lounge' as const,
      onPress: () => router.push('/(tabs)/lounges'),
    },
    {
      title: 'Golf Rounds',
      sub: '40+ India Courses',
      topic: 'golf-course' as const,
      icon: 'golf' as const,
      onPress: () =>
        router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'golf' } } as never),
    },
    {
      title: 'Dining & Swiggy',
      sub: 'Up to 10% Returns',
      topic: 'indian-dining' as const,
      icon: 'dining' as const,
      onPress: () =>
        router.push({
          pathname: '/categories/[categoryId]',
          params: { categoryId: 'dining-groceries' },
        } as never),
    },
    {
      title: 'Travel & Miles',
      sub: 'Airlines & Stays',
      topic: 'airline-business' as const,
      icon: 'travel' as const,
      onPress: () =>
        router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'travel' } } as never),
    },
    {
      title: 'Shopping & Online',
      sub: '5% Online Cashback',
      topic: 'retail-shopping' as const,
      icon: 'shopping' as const,
      onPress: () =>
        router.push({
          pathname: '/categories/[categoryId]',
          params: { categoryId: 'online-shopping' },
        } as never),
    },
    {
      title: 'Fuel Cashback',
      sub: 'HPCL · IOCL · BPCL',
      topic: 'fuel-station' as const,
      icon: 'fuel' as const,
      onPress: () =>
        router.push({ pathname: '/categories/[categoryId]', params: { categoryId: 'fuel' } } as never),
    },
  ];

  const topPeakChartData = useMemo(
    () =>
      [...categoryStats]
        .filter((s) => s.peakPct > 0)
        .sort((a, b) => b.peakPct - a.peakPct)
        .slice(0, 8)
        .map((s) => ({
          id: s.id,
          label: s.shortLabel,
          sublabel: `${s.count} eligible cards · ${s.blurb}`,
          value: Number(s.peakPct.toFixed(1)),
          displayValue: `${s.peakPct.toFixed(1)}% peak`,
          onPress: () =>
            router.push({
              pathname: '/categories/[categoryId]',
              params: { categoryId: s.id },
            } as never),
        })),
    [categoryStats, router]
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Spend Categories' }} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Visual Experience Zones</Text>
          <Text style={styles.sectionSub}>Tap any category highlight to open its dedicated page</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          >
            {experiences.map((exp) => (
              <ScalePressable key={exp.title} onPress={exp.onPress} style={styles.expCard}>
                <Image source={resolveOpenMediaSource(exp.topic)} style={styles.expImg} />
                <View style={styles.expOverlay}>
                  <CanvaFeatureIcon icon={exp.icon} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle} numberOfLines={1}>
                      {exp.title}
                    </Text>
                    <Text style={styles.expSub} numberOfLines={1}>
                      {exp.sub}
                    </Text>
                  </View>
                </View>
              </ScalePressable>
            ))}
          </ScrollView>
        </View>

        <NativeHorizontalBarChart
          title="Peak Return Rate by Spend Vertical"
          subtitle="Tap any category bar to inspect leading cards"
          data={topPeakChartData}
        />

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>All {categoryStats.length} Categories</Text>
          <Text style={styles.sectionSub}>Each category opens a dedicated leaderboard &amp; graphs page</Text>

          <View style={styles.grid}>
            {categoryStats.map((cat) => (
              <ScalePressable
                key={cat.id}
                onPress={() =>
                  router.push({
                    pathname: '/categories/[categoryId]',
                    params: { categoryId: cat.id },
                  } as never)
                }
                style={styles.catSquare}
              >
                <View style={styles.catTop}>
                  <CanvaFeatureIcon icon={resolveCategoryCanvaIcon(cat.datasetCategory)} size={28} />
                  <ChevronRight size={15} color={LedgerTheme.colors.inkMuted} />
                </View>
                <Text style={styles.catTitle} numberOfLines={1}>
                  {cat.shortLabel}
                </Text>
                <Text style={styles.catBlurb} numberOfLines={2}>
                  {cat.blurb}
                </Text>
                <Text style={styles.catCount}>{cat.count} cards</Text>
              </ScalePressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  scrollContent: { padding: 16, gap: 22, paddingBottom: 44 },
  sectionBlock: { gap: 10 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: LedgerTheme.colors.inkPrimary },
  sectionSub: { fontSize: 13.5, color: LedgerTheme.colors.inkSecondary, marginTop: -4 },
  expCard: {
    width: 214,
    height: 136,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#16201D',
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  expImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  expOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: 'rgba(13, 21, 18, 0.78)',
  },
  expTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  expSub: { fontSize: 11.5, color: '#D1DDD8' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  catSquare: {
    width: '48%',
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 18,
    padding: 15,
    gap: 8,
    ...LedgerTheme.shadow.card,
  },
  catTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
    marginTop: 2,
  },
  catBlurb: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    lineHeight: 17,
  },
  catCount: {
    fontSize: 12.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    marginTop: 'auto',
  },
});
