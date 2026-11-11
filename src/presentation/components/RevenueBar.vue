<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RevenueFlow, RevenueSliceKey } from '@/application'
import { formatCurrencyWhole } from '@/presentation/format'
import InfoTip from './InfoTip.vue'
import RevenueSliceTip, { type SliceDetail } from './RevenueSliceTip.vue'

const props = defineProps<{ flow: RevenueFlow; info?: string }>()

/** Cada fatia é a diferença entre dois resultados da DRE; `how` explica a conta no detalhe. */
const SLICES: Record<RevenueSliceKey, { label: string; color: string; how: string }> = {
  taxes: { label: 'impostos', color: 'bg-[#2c4d73]', how: 'A linha Impostos sobre venda da DRE.' },
  costOfSales: {
    label: 'custos das vendas',
    color: 'bg-[#3c6690]',
    how: 'Receita bruta, menos os impostos, menos o Lucro operacional bruto da DRE.',
  },
  variableExpenses: {
    label: 'despesas variáveis',
    color: 'bg-[#5583ad]',
    how: 'Lucro operacional bruto menos a Margem de contribuição da DRE.',
  },
  fixedExpenses: {
    label: 'despesas fixas e outras',
    color: 'bg-[#7aa3c8]',
    how: 'Margem de contribuição menos o EBITDA da DRE: despesas operacionais, já descontadas outras receitas.',
  },
}

type Segment = {
  key: string
  weight: number
  per100: string
  label: string
  color: string
  tone: 'cost' | 'gain' | 'loss'
  detail: SliceDetail
}

const per100 = (value: number) => (value / props.flow.revenue) * 100

/**
 * Arredonda para reais inteiros mantendo o total (maiores restos): as partes somam exatamente R$ 100,
 * em vez de 99 ou 101 por arredondar cada uma sozinha.
 */
function roundKeepingTotal(values: number[], total: number): number[] {
  const rounded = values.map(Math.floor)
  let missing = total - rounded.reduce((a, b) => a + b, 0)
  const byRemainder = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of byRemainder) {
    if (missing <= 0) break
    rounded[i]! += 1
    missing -= 1
  }
  return rounded
}
const formatPer100 = (rounded: number, raw: number) => (rounded === 0 && raw > 0 ? '< R$ 1' : formatCurrencyWhole(rounded))

const spent = computed(() => props.flow.revenue - props.flow.result)
const inLoss = computed(() => props.flow.result < 0)
/** No prejuízo, quanto a operação gastou de cada R$ 100 (passa de 100). */
const spentPer100 = computed(() => Math.round(per100(spent.value)))

/** Partes da barra. No prejuízo, o que passa da receita é cortado e vira o trecho "faltam". */
const segments = computed<Segment[]>(() => {
  const { revenue, slices, result } = props.flow
  const raw = slices.map((slice) => per100(slice.value))
  const rounded = inLoss.value ? roundKeepingTotal(raw, spentPer100.value) : roundKeepingTotal([...raw, per100(result)], 100)

  const list: Segment[] = []
  let used = 0
  slices.forEach((slice, i) => {
    const inside = Math.max(0, Math.min(slice.value, revenue - used))
    used += slice.value
    const { label, color, how } = SLICES[slice.key]
    const text = formatPer100(rounded[i]!, raw[i]!)
    list.push({
      key: slice.key,
      weight: inside,
      per100: text,
      label,
      color,
      tone: 'cost',
      detail: { title: label, per100: text, how, amount: -slice.value, parts: slice.parts, revenue },
    })
  })

  const resultText = formatPer100(inLoss.value ? spentPer100.value - 100 : rounded.at(-1)!, Math.abs(per100(result)))
  const detail: SliceDetail = {
    title: inLoss.value ? 'faltam' : 'sobram',
    per100: resultText,
    how: inLoss.value
      ? 'O EBITDA da DRE ficou negativo: as etapas gastaram mais que a receita bruta, e esta é a diferença.'
      : 'O EBITDA da DRE: o que fica da receita bruta depois de todas as etapas.',
    amount: result,
    parts: [],
    revenue,
  }
  list.push(
    result >= 0
      ? { key: 'result', weight: result, per100: resultText, label: 'sobram', color: 'bg-water', tone: 'gain', detail }
      : { key: 'result', weight: -result, per100: resultText, label: 'faltam', color: 'bar-shortfall', tone: 'loss', detail },
  )
  return list
})

const total = computed(() => Math.max(props.flow.revenue, spent.value))
const shareOf = (segment: Segment) => segment.weight / total.value

const title = computed(() =>
  inLoss.value ? `De cada R$ 100 vendidos, a operação gastou ${formatCurrencyWhole(spentPer100.value)}` : 'De cada R$ 100 vendidos',
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

    <!-- Passar o mouse (ou focar com o teclado) numa parte mostra a conta e as linhas da DRE que a compõem. -->
    <div class="relative flex h-14 gap-0.5">
      <RevenueSliceTip v-for="(segment, index) in segments" :key="segment.key" :detail="segment.detail">
        <div
          tabindex="0"
          :aria-label="`${segment.label}: ${segment.per100} de cada R$ 100. Ver de onde vem o valor`"
          class="h-full min-w-0 basis-0 cursor-help outline-none transition-[flex-grow,filter] duration-(--duration-slower) ease-(--ease-out) first:rounded-l-md last:rounded-r-md hover:brightness-115 focus-visible:ring-2 focus-visible:ring-band-foreground data-[state$=open]:brightness-115"
          :class="segment.color"
          :style="{ flexGrow: grown ? segment.weight : 0, transitionDelay: delayOf(index) }"
        />
      </RevenueSliceTip>
      <div
        v-if="inLoss"
        class="pointer-events-none absolute -inset-y-3 border-l-2 border-dashed border-band-foreground transition-[left,opacity] duration-(--duration-slower) ease-(--ease-out)"
        :style="{ left: `${(flow.revenue / total) * 100}%`, opacity: grown ? 1 : 0, transitionDelay: delayOf(segments.length) }"
        aria-hidden="true"
      >
        <span class="absolute -top-6 -translate-x-1/2 text-xs whitespace-nowrap">receita</span>
      </div>
    </div>

    <ul class="flex gap-0.5" aria-hidden="true">
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
          >{{ segment.per100 }}</span
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
