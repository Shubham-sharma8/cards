"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption, EChartsType } from "echarts/core";

let registered = false;
function ensureEChartsRegistered() {
  if (registered) return;
  echarts.use([
    BarChart,
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    MarkPointComponent,
    MarkAreaComponent,
    VisualMapComponent,
    DataZoomComponent,
    ToolboxComponent,
    TitleComponent,
    LabelLayout,
    CanvasRenderer,
  ]);
  registered = true;
}

export { echarts };
export type { EChartsCoreOption };

interface EChartCanvasProps {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  onPointClick?: (params: {
    dataIndex: number;
    seriesIndex: number;
    name: string;
    seriesName?: string;
  }) => void;
}

export function EChartCanvas({
  option,
  height = 280,
  className = "",
  onPointClick,
}: EChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const clickHandlerRef = useRef(onPointClick);

  useEffect(() => {
    clickHandlerRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    ensureEChartsRegistered();

    const instance = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = instance;

    instance.on("click", (params) => {
      if (clickHandlerRef.current && typeof params.dataIndex === "number") {
        clickHandlerRef.current({
          dataIndex: params.dataIndex,
          seriesIndex: typeof params.seriesIndex === "number" ? params.seriesIndex : 0,
          name: String(params.name ?? ""),
          seriesName: params.seriesName ? String(params.seriesName) : undefined,
        });
      }
    });

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            instance.resize();
          })
        : null;
    ro?.observe(el);

    const onWindowResize = () => instance.resize();
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      ro?.disconnect();
      instance.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = chartRef.current;
    if (!instance) return;
    instance.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className={`min-w-0 select-none ${className}`}
    />
  );
}
