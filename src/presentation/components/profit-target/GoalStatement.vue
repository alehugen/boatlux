<script setup lang="ts">
import { computed } from 'vue'
import ResultStamp from '@/presentation/components/ResultStamp.vue'
import { formatCurrencyCompact, formatPercent } from '@/presentation/format'

/**
 * A conta da meta no estilo da faixa do topo da DRE: receita necessária, o que os custos levam e o lucro.
 * A mini barra usa as mesmas cores do "De cada R$ 100".
 */
const props = defineProps<{ revenue: number; variableCosts: number; fixedCosts: number; profit: number }>()

const share = (value: number) => (props.revenue > 0 ? Math.max(0, value) / props.revenue : 0)
const parts = computed(() => [
  { key: 'variable', value: props.variableCosts, color: 'bg-[#3c6690]' },
  { key: 'fixed', value: props.fixedCosts, color: 'bg-[#7aa3c8]' },
  { key: 'profit', value: props.profit, color: 'bg-water' },
])
const margin = computed(() => (props.revenue > 0 ? props.profit / props.revenue : null))
</script>

<template>
  <figure class="rounded-xl bg-band p-6 text-band-foreground shadow-raised dark:ring-1 dark:ring-band-border">
    <figcaption class="text-sm text-band-muted">Projeção mensal da meta</figcaption>

    <div class="mt-4 flex h-2.5 gap-0.5" aria-hidden="true">
      <div
        v-for="part in parts"
        :key="part.key"
        class="min-w-0 basis-0 transition-[flex-grow] duration-(--duration-slow) ease-out first:rounded-l-full last:rounded-r-full"
        :class="part.color"
        :style="{ flexGrow: share(part.value) }"
      />
    </div>

    <dl class="mt-5 space-y-2.5 text-[0.95rem]">
      <div class="flex items-baseline justify-between gap-4">
        <dt class="text-band-muted">Receita necessária</dt>
        <dd class="figure">{{ formatCurrencyCompact(revenue) }}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-4">
        <dt class="flex items-center gap-2 text-band-muted">
          <span class="size-2 rounded-full bg-[#3c6690]" aria-hidden="true" />
          Custos variáveis
        </dt>
        <dd class="figure text-band-loss">−{{ formatCurrencyCompact(variableCosts) }}</dd>
      </div>
      <div class="flex items-baseline justify-between gap-4">
        <dt class="flex items-center gap-2 text-band-muted">
          <span class="size-2 rounded-full bg-[#7aa3c8]" aria-hidden="true" />
          Despesas fixas
        </dt>
        <dd class="figure text-band-loss">−{{ formatCurrencyCompact(fixedCosts) }}</dd>
      </div>
      <div class="border-t border-band-border pt-4">
        <dt class="flex items-center gap-2 text-band-muted">
          <span class="size-2 rounded-full bg-water" aria-hidden="true" />
          Lucro por mês
        </dt>
        <dd class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span class="text-[2.25rem] leading-none text-water figure">{{ formatCurrencyCompact(profit) }}</span>
          <ResultStamp :positive="profit >= 0" size="sm" />
        </dd>
        <dd v-if="margin !== null" class="mt-2 text-sm text-band-muted">{{ formatPercent(margin) }} da receita</dd>
      </div>
    </dl>
  </figure>
</template>
