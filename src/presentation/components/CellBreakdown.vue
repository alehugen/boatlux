<script setup lang="ts">
import { PhCheckCircle, PhWarning } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { CellBreakdown } from '@/application'
import SortableHead from '@/presentation/components/SortableHead.vue'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/presentation/components/ui/table'
import { useTableSort } from '@/presentation/composables/useTableSort'
import { formatCurrency, formatPercent, prettifyLabel } from '@/presentation/format'

const props = defineProps<{ breakdown: CellBreakdown }>()

const ROUNDING = 0.05
const matches = computed(() => Math.abs(props.breakdown.difference) <= ROUNDING)
const largest = computed(() => Math.max(...props.breakdown.accounts.map((account) => Math.abs(account.total)), 1))

const entrySort = useTableSort(() => props.breakdown.entries, {
  date: (entry) => entry.date,
  description: (entry) => entry.description,
  classification: (entry) => prettifyLabel(entry.classification),
  unit: (entry) => entry.unit,
  value: (entry) => entry.value,
})

const formatDate = (date: string) => {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : date
}
</script>

<template>
  <div class="space-y-6">
    <dl class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl border p-4">
        <dt class="text-sm text-muted-foreground">Valor na DRE</dt>
        <dd class="text-2xl font-semibold figure" :class="breakdown.value < 0 && 'text-destructive'">
          {{ formatCurrency(breakdown.value) }}
        </dd>
      </div>
      <div class="rounded-xl border p-4">
        <dt class="text-sm text-muted-foreground">
          Soma de {{ breakdown.entries.length }} {{ breakdown.entries.length === 1 ? 'lançamento' : 'lançamentos' }}
        </dt>
        <dd class="text-2xl font-semibold figure" :class="breakdown.total < 0 && 'text-destructive'">
          {{ formatCurrency(breakdown.total) }}
        </dd>
      </div>
      <div class="flex items-center gap-3 rounded-xl border p-4" :class="matches ? 'bg-success-soft' : 'bg-destructive-soft'">
        <component
          :is="matches ? PhCheckCircle : PhWarning"
          :size="24"
          weight="fill"
          class="shrink-0"
          :class="matches ? 'text-success' : 'text-destructive'"
          aria-hidden="true"
        />
        <div>
          <dt class="text-sm font-semibold text-foreground">{{ matches ? 'Confere' : 'Não confere' }}</dt>
          <dd class="text-sm text-body">
            <template v-if="matches">A soma dos lançamentos é o valor da DRE.</template>
            <template v-else>Diferença de <span class="figure">{{ formatCurrency(breakdown.difference) }}</span>.</template>
          </dd>
        </div>
      </div>
    </dl>

    <section v-if="breakdown.accounts.length > 1" aria-labelledby="composicao-contas">
      <h3 id="composicao-contas" class="font-semibold">Por conta</h3>
      <ul class="mt-3 space-y-2.5">
        <li v-for="account in breakdown.accounts" :key="account.label">
          <div class="flex justify-between gap-3 text-sm">
            <span>{{ prettifyLabel(account.label) }}</span>
            <span class="figure" :class="account.total < 0 && 'text-destructive'">
              {{ formatCurrency(account.total) }}
              <span class="text-muted-foreground">
                ({{ breakdown.total ? formatPercent(account.total / breakdown.total) : '–' }})
              </span>
            </span>
          </div>
          <div class="mt-1 h-2 rounded-full bg-muted">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${(Math.abs(account.total) / largest) * 100}%` }" />
          </div>
        </li>
      </ul>
    </section>

    <section aria-labelledby="composicao-lancamentos">
      <h3 id="composicao-lancamentos" class="font-semibold">Lançamentos</h3>
      <p v-if="!breakdown.entries.length" class="mt-2 text-sm text-body">
        Nenhum lançamento desta conta foi pago neste mês na aba de fluxo de caixa.
      </p>
      <div v-else class="mt-3 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader class="bg-muted">
            <TableRow>
              <SortableHead :sort="entrySort" column="date">Pagamento</SortableHead>
              <SortableHead :sort="entrySort" column="description">Histórico</SortableHead>
              <SortableHead v-if="breakdown.accounts.length > 1" :sort="entrySort" column="classification">Conta</SortableHead>
              <SortableHead :sort="entrySort" column="unit">Unidade</SortableHead>
              <SortableHead :sort="entrySort" column="value" align="right">Valor</SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(entry, index) in entrySort.rows" :key="index">
              <TableCell class="px-3 figure whitespace-nowrap">{{ formatDate(entry.date) }}</TableCell>
              <TableCell class="max-w-80 px-3 whitespace-normal">{{ entry.description || '–' }}</TableCell>
              <TableCell v-if="breakdown.accounts.length > 1" class="px-3">{{ prettifyLabel(entry.classification) }}</TableCell>
              <TableCell class="px-3 text-muted-foreground">{{ entry.unit || '–' }}</TableCell>
              <TableCell class="px-3 text-right figure whitespace-nowrap" :class="entry.value < 0 && 'text-destructive'">
                {{ formatCurrency(entry.value) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  </div>
</template>
