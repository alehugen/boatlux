<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import ChartEmpty from './ChartEmpty.vue'
import { useChartTheme } from '@/presentation/composables/useChartTheme'
import { formatCurrency, formatCurrencyCompact } from '@/presentation/format'

use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, SVGRenderer])

export interface TrendSeries {
  name: string
  type: 'bar' | 'line'
  data: (number | null)[]
  color?: string
  stack?: string
}

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: TrendSeries[]
    height?: number
    highlightIndex?: number
  }>(),
  { height: 280, highlightIndex: undefined },
)

const theme = useChartTheme()

const hasData = computed(() => props.series.some((s) => s.data.some((value) => value !== null && value !== 0)))

const option = computed<EChartsOption>(() => {
  const { chrome, series: palette, axisTooltip, fontFamily } = theme.value
  const hasLegend = props.series.length > 1
  const stackTops = new Map(props.series.filter((s) => s.stack).map((s) => [s.stack, s.name]))

  return {
    textStyle: { fontFamily },
    animationDuration: 500,
    grid: { left: 8, right: 16, top: hasLegend ? 40 : 12, bottom: 8, containLabel: true },
    legend: hasLegend
      ? { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: chrome.textMuted } }
      : undefined,
    tooltip: {
      ...axisTooltip,
      valueFormatter: (value) => (value == null ? '—' : formatCurrency(Number(value))),
    },
    xAxis: {
      type: 'category',
      data: props.categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chrome.axis } },
      axisLabel: {
        color: chrome.textMuted,
        formatter: (value: string, index: number) => (index === props.highlightIndex ? `{active|${value}}` : value),
        rich: { active: { color: chrome.text, fontWeight: 700 } },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: chrome.textMuted, formatter: (v: number) => formatCurrencyCompact(v) },
      splitLine: { lineStyle: { color: chrome.grid } },
    },
    series: props.series.map((s, i) => {
      const color = s.color ?? palette[i % palette.length]
      if (s.type === 'line') {
        return {
          type: 'line',
          name: s.name,
          data: s.data,
          color,
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 8,
          showSymbol: props.categories.length <= 12,
          connectNulls: false,
        }
      }
      const roundsEnd = !s.stack || stackTops.get(s.stack) === s.name
      return {
        type: 'bar',
        name: s.name,
        stack: s.stack,
        color,
        barMaxWidth: 28,
        data: s.data.map((value) => ({
          value,
          itemStyle: {
            borderRadius: roundsEnd ? ((value ?? 0) >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]) : 0,
            borderColor: chrome.surface,
            borderWidth: s.stack ? 1 : 0,
          },
        })),
      }
    }),
  }
})
</script>

<template>
  <ChartEmpty v-if="!hasData" />
  <VChart v-else :option="option" :style="{ height: `${height}px` }" autoresize />
</template>
