<script setup lang="ts">
import { computed } from 'vue'
import type { ProfitTargetBase, ReachableProjection } from '@/application'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/presentation/components/ui/table'
import { OPERATING_RESULT } from '@/presentation/composables/useProfitTarget'
import { formatCurrencyWhole, formatPercent, formatSignedCurrency, prettifyLabel } from '@/presentation/format'

const props = defineProps<{
  base: ProfitTargetBase
  projection: ReachableProjection
  reference: string
  revenueName: string
}>()

interface DetailRow {
  label: string
  current: number
  projected: number
  share: number
  total?: boolean
  purchases?: boolean
  fixed?: boolean
}

const rows = computed<DetailRow[]>(() => {
  const { projection: p, base, revenueName } = props
  const share = (value: number) => value / base.revenue
  return [
    { label: revenueName, current: base.revenue, projected: p.revenue, share: 1, total: true },
    ...p.variableLines.map((line) => ({
      label: prettifyLabel(line.label),
      current: -line.value,
      projected: -line.projected,
      share: -line.ratio,
      purchases: line.kind === 'purchases',
    })),
    {
      label: 'Margem de contribuição',
      current: base.revenue * base.contributionRatio,
      projected: p.revenue * base.contributionRatio,
      share: base.contributionRatio,
      total: true,
    },
    {
      label: 'Despesas operacionais',
      current: -base.fixedCosts,
      projected: -base.fixedCosts,
      share: share(-base.fixedCosts),
      fixed: true,
    },
    { label: OPERATING_RESULT, current: base.profit, projected: p.target, share: share(base.profit), total: true },
  ]
})
</script>

<template>
  <div class="mt-1 space-y-4">
    <p class="text-sm text-muted-foreground">Valores por mês. Custos variáveis acompanham a receita; despesas fixas ficam iguais.</p>
    <div class="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader class="bg-muted">
          <TableRow>
            <TableHead class="sticky left-0 bg-muted px-4">Linha da DRE</TableHead>
            <TableHead class="px-4 text-right">Valor {{ reference }}</TableHead>
            <TableHead class="hidden px-4 text-right sm:table-cell">% da receita</TableHead>
            <TableHead class="px-4 text-right">Na meta</TableHead>
            <TableHead class="px-4 text-right">Diferença</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in rows"
            :key="row.label"
            class="*:bg-card"
            :class="[row.total && 'font-semibold', row.purchases && '*:bg-accent']"
          >
            <TableCell class="sticky left-0 min-w-44 px-4 whitespace-normal sm:min-w-0">
              {{ row.label }}
              <span
                v-if="row.purchases"
                class="ml-2 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
              >
                compras
              </span>
            </TableCell>
            <TableCell class="px-4 text-right figure" :class="row.current < 0 && 'text-destructive'">
              {{ formatCurrencyWhole(row.current) }}
            </TableCell>
            <TableCell class="hidden px-4 text-right text-muted-foreground figure sm:table-cell">
              {{ formatPercent(row.share) }}
            </TableCell>
            <TableCell class="px-4 text-right figure" :class="row.projected < 0 && 'text-destructive'">
              {{ formatCurrencyWhole(row.projected) }}
            </TableCell>
            <TableCell class="px-4 text-right figure" :class="row.fixed && 'text-muted-foreground'">
              {{ row.fixed ? 'igual' : formatSignedCurrency(row.projected - row.current) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
