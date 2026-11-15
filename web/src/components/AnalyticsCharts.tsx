"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EChartCanvas, echarts, type EChartsCoreOption } from "./EChartCanvas";

export interface BarDatum {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  displayValue: string;
  color?: string;
  href?: string;
  extraNote?: string;
}

export const LEDGER_CHART_PALETTE = [
  "#0F5C4D",
  "#1D4ED8",
  "#B45309",
  "#7C3AED",
  "#0369A1",
  "#15803D",
  "#C2410C",
  "#0E7490",
  "#4338CA",
  "#475569",
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(15, 92, 77, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseTooltipStyle() {
  return {
    backgroundColor: "#FFFFFF",
    borderColor: "#E4E4DF",
    borderWidth: 1,
    textStyle: {
      color: "#1A1D21",
      fontSize: 12,
    },
    extraCssText:
      "border-radius: 10px; box-shadow: 0 8px 24px rgba(26,29,33,0.08); padding: 10px 12px;",
  };
}

interface CategoryMultiBarChartProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  unitSuffix?: string;
  height?: number;
  horizontal?: boolean;
  markLineValue?: number;
  markLineLabel?: string;
}

export function CategoryMultiBarChart({
  title,
  subtitle,
  data,
  height = 240,
  horizontal = false,
  markLineValue,
  markLineLabel,
}: CategoryMultiBarChartProps) {
  const router = useRouter();
  const [chartMode, setChartMode] = useState<"bar" | "line">("bar");

  const option = useMemo<EChartsCoreOption>(() => {
    const labels = data.map((d) =>
      d.label.length > 16 ? `${d.label.slice(0, 15)}…` : d.label
    );

    const seriesData = data.map((d, idx) => {
      const val = Number.isFinite(d.value) ? d.value : 0;
      const baseColor =
        val < 0
          ? "#DC2626"
          : val === 0
            ? "#94A3B8"
            : d.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length];

      return {
        value: val,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(
            horizontal ? 1 : 0,
            0,
            0,
            horizontal ? 0 : 1,
            [
              { offset: 0, color: baseColor },
              { offset: 1, color: hexToRgba(baseColor, 0.72) },
            ]
          ),
          borderRadius: horizontal
            ? val < 0
              ? [6, 0, 0, 6]
              : [0, 6, 6, 0]
            : val < 0
              ? [0, 0, 6, 6]
              : [6, 6, 0, 0],
        },
      };
    });

    const axisRotate = !horizontal && data.length > 5 ? 28 : 0;
    const minChartHeight = horizontal ? Math.max(height, data.length * 44 + 54) : height;
    void minChartHeight;

    const markLine =
      typeof markLineValue === "number"
        ? {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: "#9A5B13", type: "dashed", width: 1.5 },
            label: {
              position: "insideEndTop",
              formatter: markLineLabel || `${markLineValue}`,
              color: "#9A5B13",
              fontSize: 11,
              backgroundColor: "#FEF6EA",
              padding: [2, 6],
              borderRadius: 4,
            },
            data: [horizontal ? { xAxis: markLineValue } : { yAxis: markLineValue }],
          }
        : undefined;

    return {
      animationDuration: 450,
      animationEasing: "cubicOut",
      grid: {
        top: 28,
        right: 18,
        bottom: axisRotate ? 52 : 34,
        left: horizontal ? 12 : 44,
        containLabel: true,
      },
      tooltip: {
        ...baseTooltipStyle(),
        trigger: "axis",
        axisPointer: { type: chartMode === "bar" ? "shadow" : "line" },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex?: number } | undefined;
          const idx = typeof first?.dataIndex === "number" ? first.dataIndex : 0;
          const datum = data[idx];
          if (!datum) return "";
          return [
            `<div style="font-weight:600;margin-bottom:2px;">${escapeHtml(datum.label)}</div>`,
            datum.sublabel
              ? `<div style="font-size:11px;color:#717882;margin-bottom:4px;">${escapeHtml(datum.sublabel)}</div>`
              : "",
            `<div style="font-weight:700;color:${datum.value < 0 ? "#B91C1C" : "#0F5C4D"};">${escapeHtml(datum.displayValue)}</div>`,
            datum.extraNote
              ? `<div style="font-size:11px;color:#4B525C;margin-top:4px;">${escapeHtml(datum.extraNote)}</div>`
              : "",
          ].join("");
        },
      },
      toolbox: {
        right: 4,
        top: 0,
        itemSize: 13,
        feature: {
          saveAsImage: {
            title: "Save PNG",
            pixelRatio: 2,
          },
        },
        iconStyle: { borderColor: "#717882" },
      },
      xAxis: horizontal
        ? {
            type: "value",
            splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
            axisLabel: { color: "#717882", fontSize: 11 },
          }
        : {
            type: "category",
            data: labels,
            axisLine: { lineStyle: { color: "#D5D7D0" } },
            axisTick: { show: false },
            axisLabel: {
              color: "#4B525C",
              fontSize: 11,
              interval: 0,
              rotate: axisRotate,
            },
          },
      yAxis: horizontal
        ? {
            type: "category",
            data: labels,
            inverse: true,
            axisLine: { lineStyle: { color: "#D5D7D0" } },
            axisTick: { show: false },
            axisLabel: { color: "#1A1D21", fontSize: 11.5 },
          }
        : {
            type: "value",
            splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
            axisLabel: { color: "#717882", fontSize: 11 },
          },
      series: [
        chartMode === "bar"
          ? {
              type: "bar",
              barMaxWidth: 38,
              data: seriesData,
              label: {
                show: data.length <= 12,
                position: horizontal ? "right" : "top",
                fontSize: 10.5,
                fontWeight: 600,
                color: "#1A1D21",
                formatter: (p: { dataIndex: number }) => data[p.dataIndex]?.displayValue ?? "",
              },
              markLine,
            }
          : {
              type: "line",
              smooth: 0.3,
              symbol: "diamond",
              symbolSize: 9,
              lineStyle: { width: 2.5, color: "#0F5C4D" },
              itemStyle: { color: "#0F5C4D", borderColor: "#FFFFFF", borderWidth: 2 },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(15, 92, 77, 0.28)" },
                  { offset: 1, color: "rgba(15, 92, 77, 0.02)" },
                ]),
              },
              data: data.map((d) => (Number.isFinite(d.value) ? d.value : 0)),
              markPoint: {
                symbolSize: 38,
                label: { fontSize: 10, color: "#FFFFFF" },
                data: [
                  { type: "max", name: "Peak", itemStyle: { color: "#0F5C4D" } },
                  { type: "min", name: "Min", itemStyle: { color: "#9A5B13" } },
                ],
              },
              markLine,
            },
      ],
    };
  }, [data, horizontal, chartMode, markLineValue, markLineLabel, height]);

  if (data.length === 0) return null;
  const resolvedHeight = horizontal ? Math.max(height, data.length * 42 + 48) : height + 40;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
          {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
        </div>
        {!horizontal && (
          <div className="inline-flex items-center rounded-lg border border-[#E4E4DF] bg-[#FAF9F6] p-0.5 shrink-0">
            {(["bar", "line"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setChartMode(m)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  chartMode === m
                    ? "bg-[#0F5C4D] text-white"
                    : "text-[#4B525C] hover:text-[#1A1D21]"
                }`}
              >
                {m === "bar" ? "Bars" : "Line Curve"}
              </button>
            ))}
          </div>
        )}
      </div>

      <EChartCanvas
        option={option}
        height={resolvedHeight}
        onPointClick={({ dataIndex }) => {
          const href = data[dataIndex]?.href;
          if (href) router.push(href);
        }}
      />
    </div>
  );
}

export interface StackedAreaSeriesInput {
  id: string;
  name: string;
  color?: string;
  values: number[];
}

export function GradientStackedAreaChart({
  title,
  subtitle,
  xLabels,
  series,
  valueUnit = "₹",
  markLineY,
  markLineLabel,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  xLabels: string[];
  series: StackedAreaSeriesInput[];
  valueUnit?: "₹" | "%";
  markLineY?: number;
  markLineLabel?: string;
  height?: number;
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animationDuration: 550,
      color: series.map(
        (s, idx) => s.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length]
      ),
      tooltip: {
        ...baseTooltipStyle(),
        trigger: "axis",
        axisPointer: { type: "cross", label: { backgroundColor: "#0F5C4D" } },
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            seriesName?: string;
            value?: number;
            color?: string;
            axisValue?: string;
          }>;
          const xTitle = items[0]?.axisValue ?? "";
          let sum = 0;
          const rows = items
            .map((item) => {
              const v = Number(item.value ?? 0);
              sum += v;
              const formatted =
                valueUnit === "₹"
                  ? `₹${Math.round(v).toLocaleString("en-IN")}`
                  : `${v.toFixed(1)}%`;
              return `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;margin-top:2px;">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(String(item.color || "#0F5C4D"))};margin-right:6px;"></span>${escapeHtml(String(item.seriesName || ""))}</span>
                <strong style="font-variant-numeric:tabular-nums;">${formatted}</strong>
              </div>`;
            })
            .join("");
          const totalFmt =
            valueUnit === "₹"
              ? `₹${Math.round(sum).toLocaleString("en-IN")}`
              : `${sum.toFixed(1)}%`;
          return `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(String(xTitle))}</div>${rows}
            <div style="border-top:1px solid #E4E4DF;margin-top:6px;padding-top:4px;display:flex;justify-content:space-between;font-weight:700;color:#0F5C4D;">
              <span>Stacked Total</span><span>${totalFmt}</span>
            </div>`;
        },
      },
      legend: {
        top: 0,
        left: 0,
        right: 32,
        type: "scroll",
        icon: "roundRect",
        itemWidth: 11,
        itemHeight: 8,
        textStyle: { color: "#4B525C", fontSize: 11.5 },
      },
      toolbox: {
        right: 4,
        top: 0,
        itemSize: 13,
        feature: { saveAsImage: { title: "Save PNG", pixelRatio: 2 } },
        iconStyle: { borderColor: "#717882" },
      },
      grid: { top: 44, right: 20, bottom: 26, left: 16, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xLabels,
        axisLine: { lineStyle: { color: "#D5D7D0" } },
        axisLabel: { color: "#4B525C", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
        axisLabel: {
          color: "#717882",
          fontSize: 11,
          formatter: (val: number) =>
            valueUnit === "₹"
              ? val >= 1000
                ? `₹${(val / 1000).toFixed(0)}k`
                : `₹${val}`
              : `${val}%`,
        },
      },
      series: series.map((s, idx) => {
        const col = s.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length];
        return {
          name: s.name,
          type: "line",
          stack: "Total",
          smooth: 0.35,
          lineStyle: { width: 1.5, color: col },
          showSymbol: xLabels.length <= 8,
          symbolSize: 5,
          emphasis: { focus: "series" },
          areaStyle: {
            opacity: 0.9,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: hexToRgba(col, 0.65) },
              { offset: 1, color: hexToRgba(col, 0.08) },
            ]),
          },
          data: s.values,
          ...(idx === series.length - 1 && typeof markLineY === "number"
            ? {
                markLine: {
                  silent: true,
                  symbol: ["none", "none"],
                  lineStyle: { color: "#991B1B", type: "dashed", width: 1.5 },
                  label: {
                    position: "insideEndTop",
                    formatter: markLineLabel || `Fee ₹${markLineY.toLocaleString("en-IN")}`,
                    color: "#991B1B",
                    backgroundColor: "#FEE2E2",
                    padding: [2, 6],
                    borderRadius: 4,
                    fontSize: 10.5,
                  },
                  data: [{ yAxis: markLineY }],
                },
              }
            : {}),
        };
      }),
    };
  }, [xLabels, series, valueUnit, markLineY, markLineLabel]);

  if (series.length === 0 || xLabels.length === 0) return null;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
        {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
      </div>
      <EChartCanvas option={option} height={height} />
    </div>
  );
}

export interface BumpSeriesInput {
  id: string;
  name: string;
  color?: string;
  ranks: number[];
  rawValues?: string[];
}

export function BumpRankingChart({
  title,
  subtitle,
  xLabels,
  series,
  height = 290,
}: {
  title: string;
  subtitle?: string;
  xLabels: string[];
  series: BumpSeriesInput[];
  height?: number;
}) {
  const maxRank = Math.max(2, series.length);

  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animationDuration: 550,
      tooltip: {
        ...baseTooltipStyle(),
        trigger: "axis",
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            seriesName?: string;
            seriesIndex?: number;
            dataIndex?: number;
            value?: number;
            color?: string;
            axisValue?: string;
          }>;
          const sorted = [...items].sort((a, b) => (a.value ?? 99) - (b.value ?? 99));
          const xLbl = sorted[0]?.axisValue ?? "";
          const rows = sorted
            .map((item) => {
              const sIdx = item.seriesIndex ?? 0;
              const dIdx = item.dataIndex ?? 0;
              const rawVal = series[sIdx]?.rawValues?.[dIdx];
              return `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;margin-top:2px;">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(String(item.color || "#0F5C4D"))};margin-right:6px;"></span><strong>#${item.value}</strong> ${escapeHtml(String(item.seriesName || ""))}</span>
                ${rawVal ? `<span style="color:#0F5C4D;font-weight:600;">${escapeHtml(rawVal)}</span>` : ""}
              </div>`;
            })
            .join("");
          return `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(String(xLbl))}</div>${rows}`;
        },
      },
      legend: {
        top: 0,
        left: 0,
        right: 32,
        type: "scroll",
        textStyle: { color: "#4B525C", fontSize: 11.5 },
      },
      toolbox: {
        right: 4,
        top: 0,
        itemSize: 13,
        feature: { saveAsImage: { title: "Save PNG", pixelRatio: 2 } },
        iconStyle: { borderColor: "#717882" },
      },
      grid: { top: 44, right: 112, bottom: 30, left: 32, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xLabels,
        splitLine: { show: true, lineStyle: { color: "#F1EFE9" } },
        axisLabel: { color: "#4B525C", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        max: maxRank,
        interval: 1,
        axisLabel: {
          color: "#717882",
          fontSize: 11,
          formatter: "#{value}",
        },
        splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
      },
      series: series.map((s, idx) => {
        const col = s.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length];
        return {
          name: s.name,
          type: "line",
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 11,
          lineStyle: { width: 3.2, color: col },
          itemStyle: { color: "#FFFFFF", borderColor: col, borderWidth: 3 },
          emphasis: { focus: "series" },
          endLabel: {
            show: true,
            formatter: () => (s.name.length > 16 ? `${s.name.slice(0, 15)}…` : s.name),
            fontSize: 10.5,
            fontWeight: 600,
            color: col,
          },
          labelLayout: { moveOverlap: "shiftY" },
          data: s.ranks,
        };
      }),
    };
  }, [xLabels, series, maxRank]);

  if (series.length === 0 || xLabels.length === 0) return null;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
        {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
      </div>
      <EChartCanvas option={option} height={height} />
    </div>
  );
}

export interface SpendCurvePoint {
  spendLabel: string;
  monthlySpendInr: number;
  netAnnualBenefitInr: number;
  effectiveYieldPct: number;
  conservativeBenefitInr: number;
}

export function SpendStudyMarklineChart({
  title,
  subtitle,
  points,
  annualFeeInr,
  waiverSpendMonthlyInr,
  height = 290,
}: {
  title: string;
  subtitle?: string;
  points: SpendCurvePoint[];
  annualFeeInr: number;
  waiverSpendMonthlyInr?: number | null;
  height?: number;
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const xData = points.map((p) => p.spendLabel);
    const netData = points.map((p) => p.netAnnualBenefitInr);
    const yieldData = points.map((p) => Number(p.effectiveYieldPct.toFixed(2)));
    const bandBase = points.map((p) => p.conservativeBenefitInr);
    const bandSpread = points.map((p) =>
      Math.max(0, p.netAnnualBenefitInr - p.conservativeBenefitInr)
    );

    const breakevenIdx = points.findIndex((p) => p.netAnnualBenefitInr >= 0);
    const waiverIdx =
      waiverSpendMonthlyInr && waiverSpendMonthlyInr > 0
        ? points.findIndex((p) => p.monthlySpendInr >= waiverSpendMonthlyInr)
        : -1;

    const markLines: Array<Record<string, unknown>> = [
      { yAxis: 0, name: "Fee Breakeven", label: { show: false }, lineStyle: { color: "#D5D7D0", type: "dashed" } },
    ];
    if (breakevenIdx > 0) {
      markLines.push({
        xAxis: breakevenIdx,
        lineStyle: { color: "#0F5C4D", type: "dashed", width: 1.5 },
        label: {
          formatter: `Breakeven ${points[breakevenIdx].spendLabel}`,
          color: "#0F5C4D",
          backgroundColor: "#EEF5F2",
          padding: [2, 6],
          borderRadius: 4,
          fontSize: 10.5,
        },
      });
    }
    if (waiverIdx > 0) {
      markLines.push({
        xAxis: waiverIdx,
        lineStyle: { color: "#9A5B13", type: "dashed", width: 1.5 },
        label: {
          formatter: `Fee Waiver ~${points[waiverIdx].spendLabel}`,
          color: "#9A5B13",
          backgroundColor: "#FEF6EA",
          padding: [2, 6],
          borderRadius: 4,
          fontSize: 10.5,
        },
      });
    }

    const markAreas: Array<Array<Record<string, unknown>>> = [];
    if (breakevenIdx > 0) {
      markAreas.push([
        { xAxis: 0, itemStyle: { color: "rgba(220, 38, 38, 0.08)" }, name: "Fee Loss Zone" },
        { xAxis: breakevenIdx },
      ]);
      markAreas.push([
        {
          xAxis: breakevenIdx,
          itemStyle: { color: "rgba(15, 92, 77, 0.08)" },
          name: "Net Profit Zone",
        },
        { xAxis: points.length - 1 },
      ]);
    } else if (annualFeeInr === 0) {
      markAreas.push([
        {
          xAxis: 0,
          itemStyle: { color: "rgba(15, 92, 77, 0.08)" },
          name: "LTF Profit Zone",
        },
        { xAxis: points.length - 1 },
      ]);
    }

    return {
      animationDuration: 550,
      tooltip: {
        ...baseTooltipStyle(),
        trigger: "axis",
        formatter: (params: unknown) => {
          const arr = (Array.isArray(params) ? params : [params]) as Array<{
            dataIndex?: number;
          }>;
          const idx = arr[0]?.dataIndex ?? 0;
          const pt = points[idx];
          if (!pt) return "";
          return `
            <div style="font-weight:600;margin-bottom:4px;">Monthly Spend: ${escapeHtml(pt.spendLabel)}</div>
            <div style="font-size:12px;">Net Annual Value: <strong style="color:${pt.netAnnualBenefitInr >= 0 ? "#0F5C4D" : "#B91C1C"};">₹${Math.round(pt.netAnnualBenefitInr).toLocaleString("en-IN")}/yr</strong></div>
            <div style="font-size:12px;color:#1D4ED8;margin-top:2px;">Blended Effective Return: <strong>${pt.effectiveYieldPct.toFixed(2)}%</strong></div>
            <div style="font-size:11px;color:#717882;margin-top:2px;">Conservative floor: ₹${Math.round(pt.conservativeBenefitInr).toLocaleString("en-IN")}/yr</div>
          `;
        },
      },
      legend: {
        top: 0,
        left: 0,
        data: ["Net Annual Value (₹)", "Effective Yield (%)"],
        textStyle: { color: "#4B525C", fontSize: 11.5 },
      },
      toolbox: {
        right: 4,
        top: 0,
        itemSize: 13,
        feature: { saveAsImage: { title: "Save PNG", pixelRatio: 2 } },
        iconStyle: { borderColor: "#717882" },
      },
      grid: { top: 46, right: 48, bottom: 28, left: 18, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xData,
        axisLabel: { color: "#4B525C", fontSize: 11 },
      },
      yAxis: [
        {
          type: "value",
          name: "Net ₹/yr",
          nameTextStyle: { color: "#717882", fontSize: 10.5 },
          splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
          axisLabel: {
            color: "#717882",
            fontSize: 11,
            formatter: (v: number) => (Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`),
          },
        },
        {
          type: "value",
          name: "Yield %",
          nameTextStyle: { color: "#1D4ED8", fontSize: 10.5 },
          splitLine: { show: false },
          axisLabel: { color: "#1D4ED8", fontSize: 11, formatter: "{value}%" },
        },
      ],
      series: [
        {
          name: "Confidence Lower",
          type: "line",
          stack: "confidence-band",
          lineStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          data: bandBase,
        },
        {
          name: "Confidence Band",
          type: "line",
          stack: "confidence-band",
          lineStyle: { opacity: 0 },
          areaStyle: { color: "rgba(15, 92, 77, 0.14)" },
          symbol: "none",
          silent: true,
          data: bandSpread,
        },
        {
          name: "Net Annual Value (₹)",
          type: "line",
          smooth: 0.3,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { width: 3, color: "#0F5C4D" },
          itemStyle: { color: "#0F5C4D", borderColor: "#FFFFFF", borderWidth: 1.5 },
          data: netData,
          markLine: {
            symbol: ["none", "none"],
            data: markLines,
          },
          markArea: {
            silent: true,
            label: { fontSize: 10, color: "#4B525C", position: "insideTop" },
            data: markAreas,
          },
        },
        {
          name: "Effective Yield (%)",
          type: "line",
          yAxisIndex: 1,
          smooth: 0.3,
          symbol: "diamond",
          symbolSize: 7,
          lineStyle: { width: 2, type: "dashed", color: "#1D4ED8" },
          itemStyle: { color: "#1D4ED8" },
          data: yieldData,
        },
      ],
    };
  }, [points, annualFeeInr, waiverSpendMonthlyInr]);

  if (points.length === 0) return null;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
        {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
      </div>
      <EChartCanvas option={option} height={height} />
    </div>
  );
}

export interface LineRaceSeriesInput {
  id: string;
  name: string;
  color?: string;
  values: number[];
}

export function LineRaceChart({
  title,
  subtitle,
  xLabels,
  series,
  height = 285,
}: {
  title: string;
  subtitle?: string;
  xLabels: string[];
  series: LineRaceSeriesInput[];
  height?: number;
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    return {
      animationDuration: 700,
      color: series.map(
        (s, idx) => s.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length]
      ),
      tooltip: {
        ...baseTooltipStyle(),
        trigger: "axis",
        formatter: (params: unknown) => {
          const items = (Array.isArray(params) ? params : [params]) as Array<{
            seriesName?: string;
            value?: number;
            color?: string;
            axisValue?: string;
          }>;
          const sorted = [...items].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
          const xLbl = sorted[0]?.axisValue ?? "";
          const rows = sorted
            .map((item) => {
              const val = Math.round(Number(item.value ?? 0));
              return `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;margin-top:2px;">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escapeHtml(String(item.color || "#0F5C4D"))};margin-right:6px;"></span>${escapeHtml(String(item.seriesName || ""))}</span>
                <strong style="color:${val >= 0 ? "#0F5C4D" : "#B91C1C"};">₹${val.toLocaleString("en-IN")}</strong>
              </div>`;
            })
            .join("");
          return `<div style="font-weight:600;margin-bottom:4px;">${escapeHtml(String(xLbl))} Cumulative Net</div>${rows}`;
        },
      },
      legend: {
        top: 0,
        left: 0,
        right: 32,
        type: "scroll",
        textStyle: { color: "#4B525C", fontSize: 11.5 },
      },
      toolbox: {
        right: 4,
        top: 0,
        itemSize: 13,
        feature: { saveAsImage: { title: "Save PNG", pixelRatio: 2 } },
        iconStyle: { borderColor: "#717882" },
      },
      grid: { top: 44, right: 110, bottom: 26, left: 16, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: xLabels,
        axisLabel: { color: "#4B525C", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#EFECE6", type: "dashed" } },
        axisLabel: {
          color: "#717882",
          fontSize: 11,
          formatter: (v: number) => (Math.abs(v) >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`),
        },
      },
      series: series.map((s, idx) => {
        const col = s.color || LEDGER_CHART_PALETTE[idx % LEDGER_CHART_PALETTE.length];
        return {
          name: s.name,
          type: "line",
          smooth: 0.25,
          showSymbol: false,
          lineStyle: { width: 2.8, color: col },
          endLabel: {
            show: true,
            formatter: (p: { value?: unknown }) =>
              `${s.name.split(" ")[0]} ₹${Math.round(Number(p.value ?? 0)).toLocaleString("en-IN")}`,
            color: col,
            fontSize: 10.5,
            fontWeight: 600,
          },
          labelLayout: { moveOverlap: "shiftY" },
          emphasis: { focus: "series" },
          data: s.values,
          ...(idx === 0
            ? {
                markLine: {
                  silent: true,
                  symbol: ["none", "none"],
                  lineStyle: { color: "#9A5B13", type: "dashed", width: 1.2 },
                  data: [{ yAxis: 0, name: "Breakeven", label: { show: false } }],
                },
              }
            : {}),
        };
      }),
    };
  }, [xLabels, series]);

  if (series.length === 0 || xLabels.length === 0) return null;

  return (
    <div className="bg-white border border-[#E4E4DF] rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-[15.5px] font-medium text-[#1A1D21]">{title}</h3>
        {subtitle && <p className="text-[12px] text-[#4B525C] mt-0.5">{subtitle}</p>}
      </div>
      <EChartCanvas option={option} height={height} />
    </div>
  );
}
