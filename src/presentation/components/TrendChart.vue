<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import { useElementSize } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
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

/** Espaço mínimo por rótulo de mês no eixo, para não encavalar. */
const LABEL_WIDTH = 56
const AXIS_GUTTER = 72

const box = useTemplateRef('box')
const { width } = useElementSize(box)

/** Legenda em HTML: quebra linha à vontade sem invadir o gráfico. Clicar esconde ou mostra a série. */
const hidden = ref(new Set<string>())
watch(
  () => props.series.map((s) => s.name).join('|'),
  () => (hidden.value = new Set()),
)
function toggle(name: string) {
  const next = new Set(hidden.value)
  if (next.has(name)) next.delete(name)
  else if (next.size < props.series.length - 1) next.add(name)
  hidden.value = next
}
const legend = computed(() =>
  props.series.length > 1
    ? props.series.map((s, i) => ({ name: s.name, color: s.color ?? theme.value.series[i % theme.value.series.length]! }))
    : [],
)

/** Mostra um mês a cada `step`, conforme a largura, mas sempre o mês selecionado. */
const step = computed(() => {
  const room = Math.max(1, Math.floor((width.value - AXIS_GUTTER) / LABEL_WIDTH))
  return Math.max(1, Math.ceil(props.categories.length / room))
})
const showsLabel = (index: number, every: number) => {
  if (index === props.highlightIndex) return true
  const near = props.highlightIndex !== undefined && Math.abs(index - props.highlightIndex) < every
  return !near && (props.categories.length - 1 - index) % every === 0
}

const hasData = computed(() => props.series.some((s) => s.data.some((value) => value !== null && value !== 0)))

const option = computed<EChartsOption>(() => {
  const { chrome, series: palette, axisTooltip, fontFamily } = theme.value
  const visible = props.series.filter((s) => !hidden.value.has(s.name))
  // Lido aqui (e não dentro do callback do eixo) para o gráfico se redesenhar quando a largura muda.
  const every = step.value
  const stackTops = new Map(visible.filter((s) => s.stack).map((s) => [s.stack, s.name]))

  return {
    textStyle: { fontFamily },
    animationDuration: 500,
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    legend: { show: false, selected: Object.fromEntries(props.series.map((s) => [s.name, !hidden.value.has(s.name)])) },
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
        interval: (index: number) => showsLabel(index, every),
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
  <div v-else ref="box">
    <ul v-if="legend.length" class="mb-1 flex flex-wrap gap-x-4 gap-y-1.5 text-sm" aria-label="Séries do gráfico">
      <li v-for="item in legend" :key="item.name">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-sm text-left text-muted-foreground transition-opacity duration-(--duration-fast) hover:text-foreground"
          :class="hidden.has(item.name) && 'opacity-40'"
          :aria-pressed="!hidden.has(item.name)"
          @click="toggle(item.name)"
        >
          <span class="size-2.5 shrink-0 rounded-[3px]" :style="{ backgroundColor: item.color }" aria-hidden="true" />
          {{ item.name }}
        </button>
      </li>
    </ul>
    <VChart :option="option" :style="{ height: `${height}px` }" autoresize />
  </div>
</template>
