<script setup lang="ts">
import { PhSailboat } from '@phosphor-icons/vue'
import { computed } from 'vue'
import type { Stock, StockGroup } from '@/domain/stock'
import { formatCurrencyCompact, formatCurrencyWhole } from '@/presentation/format'
import InfoTip from './InfoTip.vue'

const props = defineProps<{ stock: Stock }>()

/** Na Boatlux, as embarcações começam com J (jet ski) ou L (lancha). */
const KINDS: Record<string, string> = { J: 'Jet ski', L: 'Lancha' }
const kindOf = (label: string) => KINDS[label.trim().charAt(0).toUpperCase()] ?? null

const kinds = computed(() => {
  const counts = new Map<string, number>()
  for (const item of props.stock.items) {
    const kind = kindOf(item.group)
    if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  return [...counts].map(([label, count]) => ({ label, count }))
})

const groups = computed(() => [...props.stock.groups].sort((a, b) => b.total - a.total))
const largest = computed(() => Math.max(...groups.value.map((group) => group.total), 1))

const quotas = (count: number) => `${count} ${count === 1 ? 'cota' : 'cotas'}`

function detail(group: StockGroup) {
  const values = group.items.map((item) => item.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (group.items.length === 1) return `1 cota`
  if (min === max) return `${quotas(group.items.length)} de ${formatCurrencyWhole(min)}`
  return `${quotas(group.items.length)}, de ${formatCurrencyWhole(min)} a ${formatCurrencyWhole(max)}`
}

const INFO =
  'Cotas disponíveis na aba de estoque, agrupadas por embarcação (o código antes do traço, como L29 em "L29 - 03"). O valor total soma o valor de todas as cotas. Não muda com o período nem com o regime escolhidos no topo da página.'
</script>

<template>
  <article class="surface flex min-w-0 flex-col p-6" aria-labelledby="estoque-titulo">
    <header>
      <h3 id="estoque-titulo" class="flex items-center gap-2 text-lg text-foreground">
        <PhSailboat :size="22" class="text-primary" aria-hidden="true" />
        Estoque
        <InfoTip :text="INFO" />
      </h3>
      <p class="text-sm text-muted-foreground">Cotas disponíveis para venda</p>
    </header>

    <dl class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="col-span-2 sm:col-span-1">
        <dt class="text-sm text-muted-foreground">Valor em estoque</dt>
        <dd class="text-[1.75rem] leading-tight figure text-foreground">{{ formatCurrencyCompact(stock.total) }}</dd>
      </div>
      <div>
        <dt class="text-sm text-muted-foreground">Cotas</dt>
        <dd class="text-xl leading-tight figure text-foreground">{{ stock.items.length }}</dd>
      </div>
      <div v-if="kinds.length">
        <dt class="text-sm text-muted-foreground">Por tipo</dt>
        <dd class="text-sm leading-snug text-foreground">
          <span v-for="kind in kinds" :key="kind.label" class="block">
            <span class="figure">{{ kind.count }}</span> {{ kind.count === 1 ? kind.label.toLowerCase() : `${kind.label.toLowerCase()}s` }}
          </span>
        </dd>
      </div>
    </dl>

    <ul class="mt-6 space-y-4 border-t border-border pt-5">
      <li v-for="group in groups" :key="group.label">
        <div class="flex items-baseline justify-between gap-3">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate text-foreground">{{ group.label }}</span>
            <span v-if="kindOf(group.label)" class="rounded-sm bg-water-soft px-1.5 py-0.5 text-xs text-foreground">
              {{ kindOf(group.label) }}
            </span>
          </span>
          <span class="figure whitespace-nowrap text-foreground">{{ formatCurrencyWhole(group.total) }}</span>
        </div>
        <div class="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden="true">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${(group.total / largest) * 100}%` }" />
        </div>
        <p class="mt-1 text-sm text-muted-foreground">{{ detail(group) }}</p>
      </li>
    </ul>
  </article>
</template>
