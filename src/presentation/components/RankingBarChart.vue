<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useElementSize } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import VChart from 'vue-echarts'
import ChartEmpty from './ChartEmpty.vue'
import { useChartTheme } from '@/presentation/composables/useChartTheme'
import { escapeHtml, formatCompact, formatNumber } from '@/presentation/format'

use([BarChart, GridComponent, TooltipComponent, SVGRenderer])

export interface RankingItem {
  label: string
  value: number
  color?: string
  detail?: string
}

const props = withDefaults(
  defineProps<{
    items: RankingItem[]
    valueLabel: string
    formatValue?: (value: number) => string
    formatAxis?: (value: number) => string
  }>(),
  { formatValue: formatNumber, formatAxis: formatCompact },
)

const theme = useChartTheme()
const box = useTemplateRef('box')
const { width } = useElementSize(box)
const labelWidth = computed(() => Math.round(Math.min(160, Math.max(80, width.value * 0.4))))

const BAR_HEIGHT = 30
const height = computed(() => `${props.items.length * BAR_HEIGHT + 40}px`)

const option = computed<EChartsOption>(() => {
  const { chrome, series, axisTooltip, fontFamily } = theme.value

  return {
    textStyle: { fontFamily },
    animationDuration: 500,
    animationEasing: 'cubicOut',
    grid: { left: 8, right: 24, top: 8, bottom: 24, containLabel: true },
    tooltip: {
      ...axisTooltip,
      formatter: (params) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0
        const item = props.items[index]
        if (!item) return ''
        const detail = item.detail ? `<br/><span style="color:${chrome.textMuted}">${escapeHtml(item.detail)}</span>` : ''
        return `${escapeHtml(item.label)}<br/>${escapeHtml(props.valueLabel)}: <b>${props.formatValue(item.value)}</b>${detail}`
      },
    },
    xAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: { color: chrome.textMuted, hideOverlap: true, formatter: (value: number) => props.formatAxis(value) },
      splitLine: { lineStyle: { color: chrome.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: props.items.map((item) => item.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chrome.axis } },
      axisLabel: { color: chrome.textMuted, width: labelWidth.value, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        name: props.valueLabel,
        data: props.items.map((item) => ({
          value: item.value,
          itemStyle: { color: item.color ?? series[0], borderRadius: [0, 4, 4, 0] },
        })),
        barMaxWidth: 18,
        emphasis: { itemStyle: { opacity: 0.85 } },
      },
    ],
  }
})
</script>

<template>
  <ChartEmpty v-if="!items.length" />
  <div v-else ref="box">
    <VChart :option="option" :style="{ height }" autoresize />
  </div>
</template>
