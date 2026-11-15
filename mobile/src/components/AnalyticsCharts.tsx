import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { Maximize2 } from 'lucide-react-native';
import { LedgerTheme } from '../lib/theme';
import { ScalePressable } from './MotionPrimitives';

export interface MobileBarDatum {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue: string;
  color?: string;
  onPress?: () => void;
}

const CHART_PALETTE = [
  '#0C5B4C',
  '#1D4ED8',
  '#B45309',
  '#7C3AED',
  '#0369A1',
  '#15803D',
  '#374151',
  '#C2410C',
];

export function NativeMultiBarChart({
  title,
  subtitle,
  data,
  chartHeight = 165,
  onExpandPress,
}: {
  title: string;
  subtitle?: string;
  data: MobileBarDatum[];
  chartHeight?: number;
  onExpandPress?: () => void;
}) {
  const { width: winWidth } = useWindowDimensions();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const svgWidth = Math.max(296, winWidth - 72);
  const padT = 26;
  const padB = 34;
  const plotH = chartHeight - padT - padB;
  const minSlotW = data.length > 3 ? 86 : Math.floor(svgWidth / Math.max(1, data.length));
  const canvasW = Math.max(svgWidth, data.length * minSlotW);
  const barW = Math.min(34, Math.max(18, Math.floor((canvasW / Math.max(1, data.length)) * 0.48)));

  const maxVal = useMemo(() => Math.max(1, ...data.map((d) => (Number.isFinite(d.value) ? d.value : 0))) * 1.18, [data]);

  if (!data.length) return null;
  const active = selectedIdx !== null ? data[selectedIdx] : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onExpandPress ? (
          <ScalePressable onPress={onExpandPress} style={styles.paretoTag}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Maximize2 size={11} color={LedgerTheme.colors.accent} />
              <Text style={styles.paretoTagTxt}>Full-Page Graph</Text>
            </View>
          </ScalePressable>
        ) : null}
      </View>

      {active ? (
        <ScalePressable
          onPress={active.onPress}
          style={styles.tooltipBanner}
          disabled={!active.onPress}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: active.color || CHART_PALETTE[(selectedIdx ?? 0) % CHART_PALETTE.length] },
            ]}
          />
          <Text style={styles.tooltipName} numberOfLines={1}>
            {active.label}
          </Text>
          <Text style={styles.tooltipVal}>{active.displayValue}</Text>
          {active.onPress ? <Text style={styles.tooltipAction}>Open →</Text> : null}
        </ScalePressable>
      ) : (
        <Text style={styles.hintText}>Tap any bar for exact readout</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={canvasW} height={chartHeight}>
          {[0.25, 0.5, 0.75].map((pct) => {
            const y = padT + plotH - pct * plotH;
            return (
              <Line
                key={pct}
                x1={4}
                y1={y}
                x2={canvasW - 4}
                y2={y}
                stroke="#E6E2D8"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            );
          })}
          <Line
            x1={4}
            y1={padT + plotH}
            x2={canvasW - 4}
            y2={padT + plotH}
            stroke="#CBC6BA"
            strokeWidth={1}
          />

          {data.map((d, idx) => {
            const slotW = canvasW / data.length;
            const cx = idx * slotW + slotW / 2;
            const ratio = Math.max(0.06, Math.min(1, d.value / maxVal));
            const bh = Math.round(ratio * plotH);
            const bx = cx - barW / 2;
            const by = padT + plotH - bh;
            const fill = d.color || CHART_PALETTE[idx % CHART_PALETTE.length];
            const isSel = selectedIdx === idx;
            const shortLbl = d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label;

            return (
              <React.Fragment key={d.id}>
                <Rect
                  x={idx * slotW}
                  y={0}
                  width={slotW}
                  height={chartHeight}
                  fill="transparent"
                  onPress={() => {
                    setSelectedIdx(idx);
                    if (isSel && d.onPress) d.onPress();
                  }}
                />
                <Rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={bh}
                  rx={5}
                  fill={fill}
                  opacity={selectedIdx !== null && !isSel ? 0.55 : 1}
                />
                <SvgText
                  x={cx}
                  y={Math.max(12, by - 6)}
                  fontSize="10"
                  fontWeight="600"
                  fill="#111827"
                  textAnchor="middle"
                >
                  {d.displayValue}
                </SvgText>
                <SvgText
                  x={cx}
                  y={padT + plotH + 16}
                  fontSize="9.5"
                  fill="#474F59"
                  textAnchor="middle"
                >
                  {shortLbl}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

export function NativeHorizontalBarChart({
  title,
  subtitle,
  data,
  onExpandPress,
}: {
  title: string;
  subtitle?: string;
  data: MobileBarDatum[];
  onExpandPress?: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const maxAbs = useMemo(
    () => Math.max(1, ...data.map((d) => Math.abs(Number.isFinite(d.value) ? d.value : 0))),
    [data]
  );

  if (!data.length) return null;
  const active = data[Math.min(selectedIdx, data.length - 1)];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onExpandPress ? (
          <ScalePressable onPress={onExpandPress} style={styles.paretoTag}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Maximize2 size={11} color={LedgerTheme.colors.accent} />
              <Text style={styles.paretoTagTxt}>Full-Page Graph</Text>
            </View>
          </ScalePressable>
        ) : null}
      </View>

      <View style={{ gap: 9 }}>
        {data.map((d, idx) => {
          const isSel = idx === selectedIdx;
          const pct = Math.max(5, Math.round((Math.abs(d.value) / maxAbs) * 100));
          const barColor =
            d.value < 0
              ? LedgerTheme.colors.danger
              : d.color || CHART_PALETTE[idx % CHART_PALETTE.length];

          return (
            <ScalePressable
              key={d.id}
              onPress={() => {
                setSelectedIdx(idx);
                if (isSel && d.onPress) d.onPress();
              }}
              style={[styles.hRowCard, isSel && styles.hRowCardActive]}
            >
              <View style={styles.hRowHeader}>
                <Text style={styles.hRowLabel} numberOfLines={1}>
                  {d.label}
                </Text>
                <Text
                  style={[
                    styles.hRowValue,
                    d.value < 0 && { color: LedgerTheme.colors.danger },
                  ]}
                >
                  {d.displayValue}
                </Text>
              </View>
              <View style={styles.hTrack}>
                <View style={[styles.hFill, { width: `${pct}%`, backgroundColor: barColor }]} />
              </View>
              {d.sublabel ? (
                <Text style={styles.hSublabel} numberOfLines={1}>
                  {d.sublabel}
                </Text>
              ) : null}
            </ScalePressable>
          );
        })}
      </View>

      {active?.onPress ? (
        <ScalePressable onPress={active.onPress} style={styles.tooltipBanner}>
          <Text style={styles.tooltipName} numberOfLines={1}>
            {active.label}
          </Text>
          <Text style={styles.tooltipVal}>{active.displayValue}</Text>
          <Text style={styles.tooltipAction}>Open →</Text>
        </ScalePressable>
      ) : null}
    </View>
  );
}

export function NativeValueBreakdownChart({
  title,
  subtitle,
  grossInr,
  feeInr,
  netInr,
}: {
  title: string;
  subtitle?: string;
  grossInr: number;
  feeInr: number;
  netInr: number;
}) {
  const { width: winWidth } = useWindowDimensions();
  const svgW = Math.max(280, winWidth - 72);
  const svgH = 185;
  const maxVal = Math.max(1000, grossInr, feeInr, Math.abs(netInr)) * 1.18;
  const items = [
    { label: 'Gross Reward', value: Math.max(0, grossInr), color: '#0C5B4C' },
    { label: 'Annual Fee', value: Math.max(0, feeInr), color: '#B45309' },
    {
      label: 'Net Profit',
      value: Math.max(0, netInr),
      color: netInr >= 0 ? '#15803D' : '#B42318',
    },
  ];
  const slot = (svgW - 32) / items.length;
  const barW = Math.min(54, Math.floor(slot * 0.52));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: 6,
        }}
      >
        {items.map((item) => {
          const bh = Math.max(8, Math.round((item.value / maxVal) * 104));
          const formattedVal = `₹${Math.round(item.value).toLocaleString('en-IN')}`;
          return (
            <View
              key={item.label}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: '#111827',
                  marginBottom: 6,
                }}
                numberOfLines={1}
              >
                {formattedVal}
              </Text>
              <View style={{ height: 112, justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
                <View
                  style={{
                    width: barW,
                    height: bh,
                    borderRadius: 7,
                    backgroundColor: item.color,
                  }}
                />
              </View>
              <View style={{ width: '100%', height: 1.2, backgroundColor: '#CBC6BA', marginTop: 0 }} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: '#474F59',
                  marginTop: 6,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export interface UtilizationMetric {
  id: string;
  label: string;
  used: number;
  total: number;
  unlimited?: boolean;
  color: string;
}

export function NativeUtilizationChart({
  title,
  subtitle,
  metrics,
}: {
  title: string;
  subtitle?: string;
  metrics: UtilizationMetric[];
}) {
  if (!metrics.length) return null;
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={{ gap: 11 }}>
        {metrics.map((m) => {
          const pct = m.unlimited
            ? 100
            : m.total > 0
            ? Math.min(100, Math.round((m.used / m.total) * 100))
            : 0;
          const readout = m.unlimited
            ? 'Unlimited'
            : `${Math.max(0, m.total - m.used)} left of ${m.total}`;
          return (
            <View key={m.id} style={styles.utilRow}>
              <View style={styles.hRowHeader}>
                <Text style={styles.hRowLabel}>{m.label}</Text>
                <Text style={[styles.hRowValue, { color: m.color }]}>{readout}</Text>
              </View>
              <View style={styles.hTrack}>
                <View style={[styles.hFill, { width: `${Math.max(6, pct)}%`, backgroundColor: m.color }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: LedgerTheme.colors.surface,
    borderRadius: LedgerTheme.radius.lg,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    padding: 16,
    gap: 8,
    ...LedgerTheme.shadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15.5,
    fontWeight: '700',
    color: LedgerTheme.colors.inkPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: LedgerTheme.colors.inkSecondary,
    marginTop: 2,
  },
  hintText: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  tooltipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.tintBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  tooltipName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  tooltipVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  tooltipAction: {
    fontSize: 12,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  paretoTag: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paretoTagTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
  },
  hRowCard: {
    backgroundColor: LedgerTheme.colors.canvas,
    borderWidth: 1,
    borderColor: LedgerTheme.colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },
  hRowCardActive: {
    backgroundColor: LedgerTheme.colors.tintPrimary,
    borderColor: LedgerTheme.colors.accent,
  },
  hRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hRowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: LedgerTheme.colors.inkPrimary,
  },
  hRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: LedgerTheme.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  hTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E8E4DA',
    overflow: 'hidden',
  },
  hFill: {
    height: 9,
    borderRadius: 5,
  },
  hSublabel: {
    fontSize: 11.5,
    color: LedgerTheme.colors.inkMuted,
  },
  utilRow: {
    gap: 5,
  },
});
