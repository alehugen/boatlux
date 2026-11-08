<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RevenueFlow, RevenueSliceKey } from '@/application'
import { formatCurrencyWhole } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = defineProps<{ flow: RevenueFlow; info?: string }>()

const SLICES: Record<RevenueSliceKey, { label: string; color: string }> = {
  taxes: { label: 'impostos', color: 'bg-[#2c4d73]' },
  costOfSales: { label: 'custos das vendas', color: 'bg-[#3c6690]' },
  variableExpenses: { label: 'despesas variáveis', color: 'bg-[#5583ad]' },
  fixedExpenses: { label: 'despesas fixas e outras', color: 'bg-[#7aa3c8]' },
}

type Segment = {
  key: string
  weight: number
  per100: number
  label: string
  color: string
  tone: 'cost' | 'gain' | 'loss'
}

const per100 = (value: number) => (value / props.flow.revenue) * 100
const formatPer100 = (value: number) => (value > 0 && value < 0.5 ? '< R$ 1' : formatCurrencyWhole(value))

const spent = computed(() => props.flow.revenue - props.flow.result)
const inLoss = computed(() => props.flow.result < 0)

/** Partes da barra. No prejuízo, o que passa da receita é cortado e vira o trecho "faltam". */
const segments = computed<Segment[]>(() => {
  const list: Segment[] = []
  let used = 0
  for (const slice of props.flow.slices) {
    const inside = Math.max(0, Math.min(slice.value, props.flow.revenue - used))
    used += slice.value
    list.push({
      key: slice.key,
      weight: inside,
      per100: per100(slice.value),
      label: SLICES[slice.key].label,
      color: SLICES[slice.key].color,
      tone: 'cost',
    })
  }
  const result = props.flow.result
  list.push(
    result >= 0
      ? { key: 'result', weight: result, per100: per100(result), label: 'sobram', color: 'bg-water', tone: 'gain' }
      : { key: 'result', weight: -result, per100: per100(-result), label: 'faltam', color: 'bar-shortfall', tone: 'loss' },
  )
  return list
})

const total = computed(() => Math.max(props.flow.revenue, spent.value))
const shareOf = (segment: Segment) => segment.weight / total.value

const title = computed(() =>
  inLoss.value
    ? `De cada R$ 100 vendidos, a operação gastou ${formatCurrencyWhole(per100(spent.value))}`
    : 'De cada R$ 100 vendidos',
)

/** Na entrada, as fatias crescem em sequência; nas trocas de período, todas juntas. */
const grown = ref(false)
const staggered = ref(true)
const STAGGER_MS = 90
onMounted(() =>
  requestAnimationFrame(() => {
    grown.value = true
    setTimeout(() => (staggered.value = false), 1600)
  }),
)
const delayOf = (index: number, base = 0) => (staggered.value ? `${base + index * STAGGER_MS}ms` : '0ms')
</script>

<template>
  <figure class="space-y-3">
    <figcaption class="flex items-start gap-1 text-lg text-band-muted" :class="inLoss && 'pb-5'">
      {{ title }}
      <InfoTip v-if="info" :text="info" on-band />
    </figcaption>

    <div class="relative flex h-14 gap-0.5" aria-hidden="true">
      <div
        v-for="(segment, index) in segments"
        :key="segment.key"
        class="h-full min-w-0 basis-0 transition-[flex-grow,filter] duration-(--duration-slower) ease-(--ease-out) first:rounded-l-md last:rounded-r-md hover:brightness-110"
        :class="segment.color"
        :style="{ flexGrow: grown ? segment.weight : 0, transitionDelay: delayOf(index) }"
      />
      <div
        v-if="inLoss"
        class="absolute -inset-y-3 border-l-2 border-dashed border-band-foreground transition-[left,opacity] duration-(--duration-slower) ease-(--ease-out)"
        :style="{ left: `${(flow.revenue / total) * 100}%`, opacity: grown ? 1 : 0, transitionDelay: delayOf(segments.length) }"
      >
        <span class="absolute -top-6 -translate-x-1/2 text-xs whitespace-nowrap">receita</span>
      </div>
    </div>

    <ul class="flex gap-0.5">
      <li
        v-for="(segment, index) in segments"
        :key="segment.key"
        class="min-w-0 basis-0 text-sm leading-snug text-band-muted transition-[opacity,translate] duration-(--duration-slow) ease-(--ease-out)"
        :class="[segment.key === 'result' && 'text-right whitespace-nowrap', !grown && 'translate-y-1 opacity-0']"
        :style="{ flexGrow: segment.weight, transitionDelay: delayOf(index, 350) }"
      >
        <span
          class="block text-xl figure"
          :class="{
            'text-band-foreground': segment.tone === 'cost',
            'text-water': segment.tone === 'gain',
            'text-band-loss': segment.tone === 'loss',
            'sr-only': shareOf(segment) < 0.03,
          }"
          >{{ formatPer100(segment.per100) }}</span
        >{{ ' ' }}<span
          class="block"
          :class="[segment.key !== 'result' && 'truncate', segment.key !== 'result' && shareOf(segment) < 0.07 && 'sr-only']"
          >{{ segment.label }}</span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.bar-shortfall {
  background: repeating-linear-gradient(135deg, #c4314b 0 8px, #a52740 8px 16px);
}
</style>
