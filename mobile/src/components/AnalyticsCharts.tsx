import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
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
            const isNeg = Number.isFinite(d.value) && d.value < 0;
            const isZero = !Number.isFinite(d.value) || d.value === 0;
            const ratio = isZero
              ? 0
              : Math.max(0.06, Math.min(1, Math.abs(d.value) / maxVal));
            const bh = isZero ? 3 : Math.max(6, Math.round(ratio * plotH));
            const bx = cx - barW / 2;
            const by = padT + plotH - bh;
            const fill = isNeg
              ? '#DC2626'
              : isZero
                ? '#CBD5E1'
                : d.color || CHART_PALETTE[idx % CHART_PALETTE.length];
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
                  fill={isNeg ? '#B91C1C' : '#111827'}
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
    { label: 'Gross Reward', value: Math.max(0, grossInr), signed: grossInr, color: '#0C5B4C' },
    { label: 'Annual Fee', value: Math.max(0, feeInr), signed: feeInr, color: '#B45309' },
    {
      label: 'Net Profit',
      value: Math.abs(netInr),
      signed: netInr,
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
          const formattedVal =
            item.signed < 0
              ? `-₹${Math.round(Math.abs(item.signed)).toLocaleString('en-IN')}`
              : `₹${Math.round(item.signed).toLocaleString('en-IN')}`;
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
                  color: item.signed < 0 ? '#B42318' : '#111827',
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

export interface MobileStackedAreaSeries {
  id: string;
  name: string;
  color?: string;
  values: number[];
}

export function NativeGradientStackedAreaChart({
  title,
  subtitle,
  xLabels,
  series,
  markLineY,
  markLineLabel,
}: {
  title: string;
  subtitle?: string;
  xLabels: string[];
  series: MobileStackedAreaSeries[];
  markLineY?: number;
  markLineLabel?: string;
}) {
  const { width: winWidth } = useWindowDimensions();
  const [selectedX, setSelectedX] = useState<number>(Math.max(0, xLabels.length - 1));

  if (!series.length || !xLabels.length) return null;

  const svgW = Math.max(296, winWidth - 68);
  const svgH = 210;
  const padL = 12;
  const padR = 12;
  const padT = 18;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const colTotals = xLabels.map((_, xi) =>
    series.reduce((sum, s) => sum + Math.max(0, s.values[xi] ?? 0), 0)
  );
  const maxY = Math.max(1000, markLineY ?? 0, ...colTotals) * 1.15;

  const getX = (xi: number) =>
    xLabels.length <= 1 ? padL + plotW / 2 : padL + (xi / (xLabels.length - 1)) * plotW;
  const getY = (val: number) => padT + plotH - (Math.max(0, val) / maxY) * plotH;

  // Compute cumulative bands bottom -> top
  const bands = series.map((s, sIdx) => {
    const color = s.color || CHART_PALETTE[sIdx % CHART_PALETTE.length];
    const topPts = xLabels.map((_, xi) => {
      const cumTop = series
        .slice(0, sIdx + 1)
        .reduce((acc, cur) => acc + Math.max(0, cur.values[xi] ?? 0), 0);
      return { x: getX(xi), y: getY(cumTop) };
    });
    const botPts = xLabels.map((_, xi) => {
      const cumBot = series
        .slice(0, sIdx)
        .reduce((acc, cur) => acc + Math.max(0, cur.values[xi] ?? 0), 0);
      return { x: getX(xi), y: getY(cumBot) };
    });

    const lineD = topPts
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ');
    const areaD = [
      lineD,
      ...botPts
        .slice()
        .reverse()
        .map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`),
      'Z',
    ].join(' ');

    return { id: s.id, name: s.name, color, lineD, areaD, topPts };
  });

  const safeX = Math.min(selectedX, xLabels.length - 1);
  const activeTotal = colTotals[safeX] ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.tooltipBanner}>
        <Text style={styles.tooltipName} numberOfLines={1}>
          {xLabels[safeX]} Stacked Total
        </Text>
        <Text style={styles.tooltipVal}>₹{Math.round(activeTotal).toLocaleString('en-IN')}</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {bands.map((b) => (
          <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={[styles.dot, { backgroundColor: b.color }]} />
            <Text style={{ fontSize: 11, color: LedgerTheme.colors.inkSecondary }}>
              {b.name}
            </Text>
          </View>
        ))}
      </View>

      <Svg width={svgW} height={svgH}>
        <Defs>
          {bands.map((b) => (
            <LinearGradient key={`grad-${b.id}`} id={`grad-${b.id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={b.color} stopOpacity="0.58" />
              <Stop offset="1" stopColor={b.color} stopOpacity="0.08" />
            </LinearGradient>
          ))}
        </Defs>

        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padT + plotH - pct * plotH;
          return (
            <Line
              key={pct}
              x1={padL}
              y1={y}
              x2={svgW - padR}
              y2={y}
              stroke="#E6E2D8"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          );
        })}

        {bands
          .slice()
          .reverse()
          .map((b) => (
            <React.Fragment key={b.id}>
              <Path d={b.areaD} fill={`url(#grad-${b.id})`} />
              <Path d={b.lineD} fill="none" stroke={b.color} strokeWidth={2} />
            </React.Fragment>
          ))}

        {typeof markLineY === 'number' && markLineY > 0 && markLineY < maxY && (
          <React.Fragment>
            <Line
              x1={padL}
              y1={getY(markLineY)}
              x2={svgW - padR}
              y2={getY(markLineY)}
              stroke="#991B1B"
              strokeWidth={1.4}
              strokeDasharray="5,4"
            />
            {markLineLabel ? (
              <SvgText
                x={svgW - padR - 4}
                y={Math.max(12, getY(markLineY) - 4)}
                fontSize="9.5"
                fontWeight="700"
                fill="#991B1B"
                textAnchor="end"
              >
                {markLineLabel}
              </SvgText>
            ) : null}
          </React.Fragment>
        )}

        <Line
          x1={getX(safeX)}
          y1={padT}
          x2={getX(safeX)}
          y2={padT + plotH}
          stroke="#0C5B4C"
          strokeWidth={1}
          strokeDasharray="3,3"
        />

        {bands.map((b) => {
          const pt = b.topPts[safeX];
          return pt ? (
            <Circle
              key={`dot-${b.id}`}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill="#FFFFFF"
              stroke={b.color}
              strokeWidth={2}
            />
          ) : null;
        })}

        {xLabels.map((lbl, xi) => {
          const showLbl = xLabels.length <= 7 || xi === 0 || xi === xLabels.length - 1 || xi % 2 === 0;
          const hitW = plotW / Math.max(1, xLabels.length);
          return (
            <React.Fragment key={`${lbl}-${xi}`}>
              <Rect
                x={getX(xi) - hitW / 2}
                y={0}
                width={hitW}
                height={svgH}
                fill="transparent"
                onPress={() => setSelectedX(xi)}
              />
              {showLbl ? (
                <SvgText
                  x={getX(xi)}
                  y={padT + plotH + 17}
                  fontSize="9.5"
                  fontWeight={xi === safeX ? '700' : '400'}
                  fill={xi === safeX ? '#0C5B4C' : '#474F59'}
                  textAnchor="middle"
                >
                  {lbl}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
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
