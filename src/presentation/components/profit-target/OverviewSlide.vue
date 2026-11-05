<script setup lang="ts">
import { computed } from 'vue'
import type { ProfitTargetBase, ReachableProjection } from '@/application'
import SampleStatement from '@/presentation/components/SampleStatement.vue'
import StatCard from '@/presentation/components/StatCard.vue'
import StatGrid from '@/presentation/components/StatGrid.vue'
import { formatCurrencyCompact, formatPercent } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  projection: ReachableProjection
  reference: string
  revenueName: string
}>()

const bars = computed(() => {
  const { projection: p, base } = props
  const scale = Math.max(p.revenue, base.revenue)
  const width = (value: number) => `${(value / scale) * 100}%`
  return {
    current: width(base.revenue),
    shared: width(Math.min(p.revenue, base.revenue)),
    extra: width(Math.max(0, p.revenue - base.revenue)),
  }
})

const receipt = computed(() => [
  { label: 'Receita necessária', value: props.projection.revenue, kind: 'start' as const },
  { label: 'Custos variáveis', value: -props.projection.variableCosts, kind: 'step' as const },
  { label: 'Despesas fixas', value: -props.projection.fixedCosts, kind: 'step' as const },
  { label: 'Lucro por mês', value: props.projection.target, kind: 'total' as const },
])
</script>

<template>
  <div class="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
    <div class="min-w-0 space-y-8">
      <div aria-live="polite">
        <p class="text-body">Para lucrar {{ formatCurrencyCompact(projection.target) }} por mês, a receita precisa chegar a</p>
        <p class="mt-1 text-4xl font-bold tracking-tight figure sm:text-5xl">
          {{ formatCurrencyCompact(projection.revenue) }}
          <span class="block text-lg font-medium tracking-normal text-muted-foreground sm:inline">por mês</span>
        </p>
        <p v-if="projection.status === 'reached'" class="mt-3 font-medium text-success">
          Meta atingida: o resultado operacional {{ reference }} foi de
          {{ formatCurrencyCompact(base.profit) }}.
        </p>
      </div>

      <div
        class="space-y-4"
        role="img"
        :aria-label="`${revenueName} ${reference}: ${formatCurrencyCompact(base.revenue)}. ${revenueName} na meta: ${formatCurrencyCompact(projection.revenue)}.`"
      >
        <div>
          <div class="mb-1.5 flex justify-between gap-3 text-sm">
            <span class="text-muted-foreground">{{ revenueName }} {{ reference }}</span>
            <span class="font-medium figure">{{ formatCurrencyCompact(base.revenue) }}</span>
          </div>
          <div class="h-3 rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-strong transition-[width] duration-(--duration-slow) ease-out"
              :style="{ width: bars.current }"
            />
          </div>
        </div>
        <div>
          <div class="mb-1.5 flex justify-between gap-3 text-sm">
            <span class="text-muted-foreground">{{ revenueName }} na meta</span>
            <span class="font-medium figure">{{ formatCurrencyCompact(projection.revenue) }}</span>
          </div>
          <div class="flex h-3 gap-0.5 rounded-full bg-muted">
            <div
              class="h-full rounded-l-full bg-strong transition-[width] duration-(--duration-slow) ease-out"
              :class="projection.revenueGap <= 0 && 'rounded-r-full'"
              :style="{ width: bars.shared }"
            />
            <div
              class="h-full rounded-r-full bg-primary transition-[width] duration-(--duration-slow) ease-out"
              :style="{ width: bars.extra }"
            />
          </div>
        </div>
      </div>

      <StatGrid columns="grid-cols-1 sm:grid-cols-3">
        <StatCard
          :label="projection.revenueGap >= 0 ? 'Faturar a mais' : 'Receita acima do necessário'"
          :value="formatCurrencyCompact(Math.abs(projection.revenueGap))"
          :hint="
            projection.revenueChange !== null
              ? `${projection.revenueGap >= 0 ? '+' : ''}${formatPercent(projection.revenueChange)} sobre a receita ${reference}`
              : undefined
          "
        />
        <StatCard
          v-if="projection.purchasesChange !== null"
          :label="projection.purchasesChange >= 0 ? 'Comprar a mais para vender' : 'Compras a menos'"
          :value="formatCurrencyCompact(Math.abs(projection.purchasesChange))"
          hint="Mercadorias e serviços, por mês"
        />
        <StatCard label="Despesas fixas" :value="formatCurrencyCompact(projection.fixedCosts)" hint="Continuam iguais por mês" />
      </StatGrid>
    </div>

    <div class="drop-shadow-[0_18px_24px_rgb(8_6_28/0.22)]">
      <SampleStatement :lines="receipt" issuer="Meta de lucro" caption="Projeção mensal" />
    </div>
  </div>
</template>
