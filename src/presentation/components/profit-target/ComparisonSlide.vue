<script setup lang="ts">
import { computed } from 'vue'
import type { ProfitTargetBase, ReachableProjection } from '@/application'
import { OPERATING_RESULT } from '@/presentation/composables/useProfitTarget'
import { formatCurrencyWhole, formatPercent, formatSignedCurrency } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  projection: ReachableProjection
  reference: string
  revenueName: string
}>()

interface ComparisonRow {
  label: string
  hint?: string
  today: number
  goal: number
  gain?: boolean
  result?: boolean
}

const comparison = computed(() => {
  const { projection: p, base, revenueName } = props
  const purchases = p.variableLines.filter((line) => line.kind === 'purchases')
  const purchasesToday = purchases.reduce((total, line) => total + line.value, 0)
  const purchasesGoal = purchases.reduce((total, line) => total + line.projected, 0)
  const variableToday = base.revenue * (1 - base.contributionRatio)

  const rows: ComparisonRow[] = [
    { label: revenueName, today: base.revenue, goal: p.revenue, gain: true },
    ...(purchases.length
      ? [
          { label: 'Compras para vender', hint: 'Mercadorias e serviços', today: purchasesToday, goal: purchasesGoal },
          {
            label: 'Outros custos variáveis',
            hint: 'Impostos e despesas variáveis',
            today: variableToday - purchasesToday,
            goal: p.variableCosts - purchasesGoal,
          },
        ]
      : [{ label: 'Custos variáveis', hint: 'Impostos, custos e despesas variáveis', today: variableToday, goal: p.variableCosts }]),
    { label: 'Despesas operacionais', hint: 'Fixas, iguais na meta', today: base.fixedCosts, goal: p.fixedCosts },
    { label: OPERATING_RESULT, today: base.profit, goal: p.target, gain: true, result: true },
  ]
  const scale = Math.max(...rows.flatMap((row) => [Math.abs(row.today), Math.abs(row.goal)]), 1)
  return {
    rows: rows.map((row) => ({
      ...row,
      todayWidth: `${(Math.abs(row.today) / scale) * 100}%`,
      goalWidth: `${(Math.abs(row.goal) / scale) * 100}%`,
      change: row.goal - row.today,
    })),
    marginToday: base.profit / base.revenue,
    marginGoal: p.revenue ? p.target / p.revenue : null,
  }
})
</script>

<template>
  <div class="mt-1 space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <dl class="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt class="text-sm text-muted-foreground">Margem de lucro {{ reference }}</dt>
          <dd class="text-2xl font-semibold figure" :class="comparison.marginToday < 0 && 'text-destructive'">
            {{ formatPercent(comparison.marginToday) }}
          </dd>
        </div>
        <div v-if="comparison.marginGoal !== null">
          <dt class="text-sm text-muted-foreground">Margem de lucro na meta</dt>
          <dd class="text-2xl font-semibold text-marker-ink figure">{{ formatPercent(comparison.marginGoal) }}</dd>
        </div>
      </dl>
      <ul class="flex gap-4 text-sm text-muted-foreground" aria-label="Legenda">
        <li class="flex items-center gap-2"><span class="h-2.5 w-5 rounded-full bg-strong" aria-hidden="true" />Hoje</li>
        <li class="flex items-center gap-2"><span class="h-2.5 w-5 rounded-full bg-primary" aria-hidden="true" />Na meta</li>
      </ul>
    </div>

    <ul class="divide-y rounded-lg border">
      <li
        v-for="row in comparison.rows"
        :key="row.label"
        class="grid items-center gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_7.5rem]"
        :class="row.result && 'bg-accent/40'"
      >
        <div>
          <p class="font-medium" :class="row.result && 'font-semibold'">{{ row.label }}</p>
          <p v-if="row.hint" class="text-xs text-muted-foreground">{{ row.hint }}</p>
        </div>
        <div class="min-w-0 space-y-1.5">
          <div class="flex items-center gap-3">
            <div class="h-2.5 min-w-0 flex-1">
              <div
                class="h-full rounded-full transition-[width] duration-(--duration-slow) ease-out"
                :class="row.today < 0 ? 'bg-destructive' : 'bg-strong'"
                :style="{ width: row.todayWidth }"
              />
            </div>
            <span class="w-24 shrink-0 text-right text-sm text-muted-foreground figure">
              <span class="sr-only">Hoje: </span>{{ formatCurrencyWhole(row.today) }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <div class="h-2.5 min-w-0 flex-1">
              <div
                class="h-full rounded-full bg-primary transition-[width] duration-(--duration-slow) ease-out"
                :style="{ width: row.goalWidth }"
              />
            </div>
            <span class="w-24 shrink-0 text-right text-sm font-medium figure">
              <span class="sr-only">Na meta: </span>{{ formatCurrencyWhole(row.goal) }}
            </span>
          </div>
        </div>
        <p class="text-sm figure sm:text-right" :class="Math.abs(row.change) < 0.5 ? 'text-muted-foreground' : row.gain && row.change > 0 ? 'font-medium text-success' : 'text-body'">
          {{ Math.abs(row.change) < 0.5 ? 'igual' : formatSignedCurrency(row.change) }}
        </p>
      </li>
    </ul>
  </div>
</template>
