import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Line, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import {
  AlertTriangle,
  BarChart2,
  BarChart3,
  Layers,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react-native';
import { LedgerTheme } from '../lib/theme';
import { formatInr as formatINR } from '../lib/format';

export interface FullScreenGraphSeriesItem {
  label: string;
  color: string;
  values: number[];
}

export interface FullScreenGraphModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  categories: string[];
  categoryKeys?: string[];
  series: FullScreenGraphSeriesItem[];
  valueSuffix?: string;
  caveats?: Record<string, string>;
  annualFeeInr?: number;
  benchmarkSeries?: FullScreenGraphSeriesItem | null;
  itemKind?: 'card' | 'category';
}

type GraphMode = 'horizontal' | 'vertical' | 'waterfall';

const SPEND_PRESETS = [15000, 30000, 60000, 100000, 200000];

function splitTwoLines(raw: string): [string, string] {
  const clean = raw.replace(/\s+/g, ' ').trim();
  if (clean.length <= 11) return [clean, ''];
  const words = clean.split(' ');
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 ? `${line1} ${w}` : w).length <= 11) {
      line1 = line1 ? `${line1} ${w}` : w;
    } else if (!line1) {
      line1 = w.slice(0, 11);
      line2 = w.slice(11);
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }
  if (line2.length > 12) line2 = `${line2.slice(0, 11)}…`;
  return [line1, line2];
}

export function FullScreenGraphModal({
  visible,
  onClose,
  title,
  subtitle,
  categories,
  categoryKeys,
  series,
  valueSuffix = '%',
  caveats,
  annualFeeInr = 0,
  benchmarkSeries,
  itemKind = 'category',
}: FullScreenGraphModalProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [monthlySpend, setMonthlySpend] = useState<number>(60000);
  const [showBenchmark, setShowBenchmark] = useState<boolean>(false);
  const [graphMode, setGraphMode] = useState<GraphMode>('horizontal');

  const screenWidth = Dimensions.get('window').width;
  const activeSeries = useMemo(
    () => (showBenchmark && benchmarkSeries ? [...series, benchmarkSeries] : series),
    [series, benchmarkSeries, showBenchmark]
  );

  const maxVal = useMemo(() => {
    let m = 0.1;
    for (const s of activeSeries) {
      for (const v of s.values) {
        if (Math.abs(v) > m) m = Math.abs(v);
      }
    }
    return Math.ceil(m * 1.15 * 10) / 10;
  }, [activeSeries]);

  const primaryRates = series[0]?.values || [];
  const safeIdx = Math.min(Math.max(0, selectedIdx), Math.max(0, categories.length - 1));
  const focusedRate = primaryRates[safeIdx] ?? 0;

  const avgEffectiveRate = useMemo(() => {
    if (itemKind === 'card') {
      return Math.max(0, focusedRate);
    }
    const positives = primaryRates.filter((v) => v > 0);
    if (!positives.length) return 0;
    const weighted =
      focusedRate * 0.45 +
      (positives.reduce((a, b) => a + b, 0) / positives.length) * 0.55;
    return Math.max(0, weighted);
  }, [primaryRates, focusedRate, itemKind]);

  const projectedAnnualGross = Math.round((monthlySpend * 12 * avgEffectiveRate) / 100);
  const feeCostWithGst = Math.round(annualFeeInr * 1.18);
  const projectedNetAnnual = projectedAnnualGross - feeCostWithGst;

  // Vertical chart layout with generous spacing so labels never overlap
  const svgHeight = 324;
  const padL = 44;
  const padT = 24;
  const padB = 64;
  const plotH = svgHeight - padT - padB;
  const groupW = Math.max(96, activeSeries.length * 26 + 44);
  const svgW = Math.max(screenWidth - 44, padL + categories.length * groupW + 24);

  // Waterfall bar layout (Gross vs Fee vs Net)
  const waterfallMax = Math.max(1000, projectedAnnualGross, feeCostWithGst, Math.abs(projectedNetAnnual)) * 1.18;
  const waterfallWidth = Math.max(280, screenWidth - 64);

  const selectedLabel = categories[safeIdx] || '';
  const selectedKey = categoryKeys?.[safeIdx] || '';
  const selectedCaveat = caveats?.[selectedKey];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <TrendingUp size={18} color={LedgerTheme.colors.accent} />
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close full-page graph">
            <X size={20} color={LedgerTheme.colors.inkPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Interactive Monthly Spend Simulator Strip */}
          <View style={styles.simCard}>
            <View style={styles.simTopRow}>
              <View style={styles.simTitleRow}>
                <SlidersHorizontal size={15} color={LedgerTheme.colors.accent} />
                <Text style={styles.simTitle}>Interactive Return Simulator</Text>
              </View>
              <Text style={styles.simSpendReadout}>{formatINR(monthlySpend)}/mo</Text>
            </View>

            <View style={styles.presetRow}>
              {SPEND_PRESETS.map((amt) => {
                const active = monthlySpend === amt;
                return (
                  <Pressable
                    key={amt}
                    onPress={() => setMonthlySpend(amt)}
                    style={[styles.presetPill, active && styles.presetPillActive]}
                  >
                    <Text style={[styles.presetTxt, active && styles.presetTxtActive]}>
                      {amt >= 100000 ? `₹${amt / 100000}L` : `₹${amt / 1000}k`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.kpisRow}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLbl}>Annual Gross Value</Text>
                <Text style={styles.kpiVal}>{formatINR(projectedAnnualGross)}</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLbl}>Net After Fee (+GST)</Text>
                <Text
                  style={[
                    styles.kpiVal,
                    { color: projectedNetAnnual >= 0 ? LedgerTheme.colors.accent : LedgerTheme.colors.danger },
                  ]}
                >
                  {formatINR(projectedNetAnnual)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLbl}>{itemKind === 'card' ? 'Selected Yield' : 'Focus Rate'}</Text>
                <Text style={styles.kpiVal}>
                  {focusedRate.toFixed(1)}
                  {valueSuffix}
                </Text>
              </View>
            </View>
          </View>

          {/* Chart Mode Switcher */}
          <View style={styles.modeRow}>
            {(
              [
                { key: 'horizontal', label: 'Horizontal Rank', icon: BarChart2 },
                { key: 'vertical', label: 'Vertical Bars', icon: BarChart3 },
                { key: 'waterfall', label: 'Fee & Net Split', icon: Layers },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              const active = graphMode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setGraphMode(m.key)}
                  style={[styles.modePill, active && styles.modePillActive]}
                >
                  <Icon size={14} color={active ? '#FFFFFF' : LedgerTheme.colors.inkSecondary} />
                  <Text style={[styles.modeTxt, active && styles.modeTxtActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Toggle Benchmark Overlay if provided */}
          {benchmarkSeries ? (
            <View style={styles.legendControls}>
              <View style={styles.legendRow}>
                {activeSeries.map((s) => (
                  <View key={s.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.legendLbl} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => setShowBenchmark((v) => !v)}
                style={[styles.benchmarkBtn, showBenchmark && styles.benchmarkBtnActive]}
              >
                <Text style={[styles.benchmarkBtnTxt, showBenchmark && styles.benchmarkBtnTxtActive]}>
                  {showBenchmark ? 'Hide Market Benchmark' : '+ Overlay Market Benchmark'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Mode 1: Horizontal Rank (Zero Label Overlap) */}
          {graphMode === 'horizontal' && (
            <View style={styles.chartBox}>
              <View style={{ gap: 10 }}>
                {categories.map((cat, idx) => {
                  const isSel = idx === safeIdx;
                  const val = activeSeries[0]?.values[idx] ?? 0;
                  const ratio = Math.max(0.04, Math.min(1, Math.max(0, val) / maxVal));
                  return (
                    <Pressable
                      key={`${cat}_${idx}`}
                      onPress={() => setSelectedIdx(idx)}
                      style={[styles.hBarRow, isSel && styles.hBarRowActive]}
                    >
                      <View style={styles.hBarTop}>
                        <Text
                          style={[styles.hBarLabel, isSel && { color: LedgerTheme.colors.accent }]}
                          numberOfLines={1}
                        >
                          {cat}
                        </Text>
                        <Text style={styles.hBarVal}>
                          {val.toFixed(1)}
                          {valueSuffix}
                        </Text>
                      </View>
                      <View style={styles.hBarTrack}>
                        <View
                          style={[
                            styles.hBarFill,
                            {
                              width: `${Math.round(ratio * 100)}%`,
                              backgroundColor:
                                val < 0
                                  ? LedgerTheme.colors.danger
                                  : isSel
                                  ? LedgerTheme.colors.accent
                                  : '#4D8B7E',
                            },
                          ]}
                        />
                      </View>
                      {showBenchmark && activeSeries[1] ? (
                        <View style={styles.hBenchRow}>
                          <Text style={styles.hBenchLbl}>
                            {activeSeries[1].label}: {(activeSeries[1].values[idx] ?? 0).toFixed(1)}
                            {valueSuffix}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hintFooter}>
                Tap any row to inspect exact monthly reward impact and caveats below
              </Text>
            </View>
          )}

          {/* Mode 2: Vertical Scrollable SVG Chart with 2-line non-overlapping labels */}
          {graphMode === 'vertical' && (
            <View style={styles.chartBox}>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <Svg width={svgW} height={svgHeight}>
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const yy = padT + plotH - t * plotH;
                    const tick = (t * maxVal).toFixed(maxVal >= 10 ? 0 : 1);
                    return (
                      <G key={t}>
                        <Line x1={padL} y1={yy} x2={svgW - 12} y2={yy} stroke="#E8E4DA" strokeDasharray="3,3" />
                        <SvgText x={padL - 6} y={yy + 3.5} fontSize="10" fill="#6D7580" textAnchor="end">
                          {`${tick}${valueSuffix}`}
                        </SvgText>
                      </G>
                    );
                  })}
                  <Line x1={padL} y1={padT + plotH} x2={svgW - 12} y2={padT + plotH} stroke="#CBC6BA" strokeWidth={1.2} />

                  {categories.map((cat, cIdx) => {
                    const gx = padL + cIdx * groupW + 14;
                    const barW = Math.min(26, Math.max(14, Math.floor((groupW - 28) / activeSeries.length)));
                    const isSel = cIdx === safeIdx;
                    const [line1, line2] = splitTwoLines(cat);
                    const centerX = gx + (activeSeries.length * (barW + 4)) / 2 - 2;
                    return (
                      <G key={`${cat}_${cIdx}`}>
                        {isSel ? (
                          <Rect
                            x={gx - 10}
                            y={padT}
                            width={groupW - 8}
                            height={plotH}
                            rx={10}
                            fill="#ECFDF5"
                          />
                        ) : null}

                        {activeSeries.map((s, sIdx) => {
                          const raw = s.values[cIdx] ?? 0;
                          const clamped = Math.max(0, raw);
                          const h = Math.max(clamped > 0 ? 6 : 2, (clamped / maxVal) * plotH);
                          const bx = gx + sIdx * (barW + 4);
                          const by = padT + plotH - h;
                          return (
                            <G key={s.label}>
                              <Rect
                                x={bx}
                                y={by}
                                width={barW}
                                height={h}
                                rx={6}
                                fill={raw < 0 ? LedgerTheme.colors.danger : s.color}
                                opacity={isSel ? 1 : 0.78}
                                onPress={() => setSelectedIdx(cIdx)}
                              />
                              <SvgText
                                x={bx + barW / 2}
                                y={by - 6}
                                fontSize="10"
                                fontWeight="700"
                                fill={isSel ? LedgerTheme.colors.accent : '#474F59'}
                                textAnchor="middle"
                              >
                                {raw.toFixed(1)}
                              </SvgText>
                            </G>
                          );
                        })}

                        <SvgText
                          x={centerX}
                          y={padT + plotH + 17}
                          fontSize="10.5"
                          fontWeight={isSel ? '700' : '500'}
                          fill={isSel ? LedgerTheme.colors.accent : '#474F59'}
                          textAnchor="middle"
                          onPress={() => setSelectedIdx(cIdx)}
                        >
                          <TSpan x={centerX} dy="0">
                            {line1}
                          </TSpan>
                          {line2 ? (
                            <TSpan x={centerX} dy="13">
                              {line2}
                            </TSpan>
                          ) : null}
                        </SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </ScrollView>
              <Text style={styles.hintFooter}>
                Swipe horizontally to view all bars · Tap any bar or label to inspect details
              </Text>
            </View>
          )}

          {/* Mode 3: Fee vs Reward Value Waterfall SVG */}
          {graphMode === 'waterfall' && (
            <View style={styles.chartBox}>
              <Text style={styles.waterfallTitle}>
                Gross vs Fee vs Net Annual Benefit ({selectedLabel || 'Portfolio'})
              </Text>
              <Svg width={waterfallWidth} height={210}>
                <Line x1={20} y1={164} x2={waterfallWidth - 16} y2={164} stroke="#CBC6BA" strokeWidth={1.2} />
                {[
                  {
                    label: 'Annual Gross',
                    val: projectedAnnualGross,
                    color: '#0C5B4C',
                  },
                  {
                    label: 'Fee (+GST)',
                    val: feeCostWithGst,
                    color: '#B45309',
                  },
                  {
                    label: 'Net Profit',
                    val: Math.max(0, projectedNetAnnual),
                    color: projectedNetAnnual >= 0 ? '#15803D' : '#B42318',
                  },
                ].map((bar, idx) => {
                  const slot = (waterfallWidth - 40) / 3;
                  const bx = 20 + idx * slot + (slot - 56) / 2;
                  const bh = Math.max(8, Math.round((Math.max(0, bar.val) / waterfallMax) * 124));
                  const by = 164 - bh;
                  return (
                    <G key={bar.label}>
                      <Rect x={bx} y={by} width={56} height={bh} rx={8} fill={bar.color} />
                      <SvgText
                        x={bx + 28}
                        y={by - 7}
                        fontSize="11"
                        fontWeight="700"
                        fill="#111827"
                        textAnchor="middle"
                      >
                        {formatINR(bar.val)}
                      </SvgText>
                      <SvgText
                        x={bx + 28}
                        y={184}
                        fontSize="11"
                        fontWeight="600"
                        fill="#474F59"
                        textAnchor="middle"
                      >
                        {bar.label}
                      </SvgText>
                    </G>
                  );
                })}
              </Svg>
              <Text style={styles.hintFooter}>
                Based on {formatINR(monthlySpend)}/month spend ({formatINR(monthlySpend * 12)}/year)
              </Text>
            </View>
          )}

          {/* Active Card / Category Breakdown Inspector */}
          <View style={styles.inspectorCard}>
            <Text style={styles.inspectorTitle}>
              {itemKind === 'card' ? 'Selected Card:' : 'Selected Category:'} {selectedLabel}
            </Text>
            <View style={styles.inspectorGrid}>
              {activeSeries.map((s) => {
                const v = s.values[safeIdx] ?? 0;
                const sampleSpend = itemKind === 'card' ? monthlySpend : Math.round(monthlySpend * 0.25);
                const monthlyEarned = Math.round((sampleSpend * Math.max(0, v)) / 100);
                return (
                  <View key={s.label} style={styles.inspectorRow}>
                    <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.inspectorCardName} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text style={styles.inspectorRate}>
                      {v.toFixed(1)}
                      {valueSuffix} ({formatINR(monthlyEarned)} on {formatINR(sampleSpend)}/mo)
                    </Text>
                  </View>
                );
              })}
            </View>
            {selectedCaveat ? (
              <View style={styles.caveatBanner}>
                <AlertTriangle size={14} color="#B45309" />
                <Text style={styles.caveatText}>{selectedCaveat}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LedgerTheme.colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.surface,
  },
  headerText: { flex: 1, paddingRight: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700', color: LedgerTheme.colors.inkPrimary, flex: 1 },
  subtitle: { fontSize: 12.5, color: LedgerTheme.colors.inkSecondary, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LedgerTheme.colors.creamWarm,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: { padding: 16, gap: 14, paddingBottom: 32 },
  simCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 14,
    gap: 10,
  },
  simTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  simTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  simTitle: { fontSize: 14, fontWeight: '700', color: LedgerTheme.colors.inkPrimary },
  simSpendReadout: { fontSize: 15.5, fontWeight: '800', color: LedgerTheme.colors.accent },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    backgroundColor: LedgerTheme.colors.canvas,
  },
  presetPillActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  presetTxt: { fontSize: 12.5, fontWeight: '600', color: LedgerTheme.colors.inkSecondary },
  presetTxtActive: { color: '#FFFFFF' },
  kpisRow: { flexDirection: 'row', gap: 8 },
  kpiBox: {
    flex: 1,
    backgroundColor: LedgerTheme.colors.creamWarm,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
  },
  kpiLbl: { fontSize: 11, color: LedgerTheme.colors.inkMuted },
  kpiVal: { fontSize: 14.5, fontWeight: '800', color: LedgerTheme.colors.inkPrimary, marginTop: 2 },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: LedgerTheme.colors.surface,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  modePillActive: {
    backgroundColor: LedgerTheme.colors.accent,
  },
  modeTxt: { fontSize: 11.5, fontWeight: '600', color: LedgerTheme.colors.inkSecondary },
  modeTxtActive: { color: '#FFFFFF' },
  legendControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLbl: { fontSize: 12, fontWeight: '600', color: LedgerTheme.colors.inkSecondary, maxWidth: 140 },
  benchmarkBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.tintBorder,
    backgroundColor: LedgerTheme.colors.tintPrimary,
  },
  benchmarkBtnActive: {
    backgroundColor: LedgerTheme.colors.accent,
    borderColor: LedgerTheme.colors.accent,
  },
  benchmarkBtnTxt: { fontSize: 11.5, fontWeight: '700', color: LedgerTheme.colors.accent },
  benchmarkBtnTxtActive: { color: '#FFFFFF' },
  chartBox: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 14,
    gap: 10,
  },
  hBarRow: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  hBarRowActive: {
    backgroundColor: '#EEF6F3',
    borderColor: LedgerTheme.colors.accent,
  },
  hBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  hBarLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  hBarVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  hBarTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E8E4DA',
    overflow: 'hidden',
  },
  hBarFill: {
    height: 10,
    borderRadius: 6,
  },
  hBenchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  hBenchLbl: {
    fontSize: 11,
    color: LedgerTheme.colors.inkMuted,
  },
  waterfallTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  hintFooter: { fontSize: 11.5, color: LedgerTheme.colors.inkMuted, textAlign: 'center' },
  inspectorCard: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 14,
    gap: 10,
  },
  inspectorTitle: { fontSize: 14.5, fontWeight: '700', color: LedgerTheme.colors.inkPrimary },
  inspectorGrid: { gap: 8 },
  inspectorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inspectorCardName: { flex: 1, fontSize: 13, fontWeight: '600', color: LedgerTheme.colors.inkPrimary },
  inspectorRate: { fontSize: 13, fontWeight: '700', color: LedgerTheme.colors.accent },
  caveatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  caveatText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 16 },
});
